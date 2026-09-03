import { useState, useEffect, useRef } from 'react'
import { Sparkles, LogOut, BarChart2, Inbox, ChevronDown, Check, X, Flame, Send, FileText, Loader2 } from 'lucide-react'
import { api } from '../api/client'
import type { Email } from '../types'
import Header from '../components/Header'
import EmailItem from '../components/EmailItem'
import ComposeModal from '../components/ComposeModal'
import SendConfirmModal from '../components/SendConfirmModal'
import AnalyticsView from '../components/AnalyticsView'
import ClaroLogo from '../components/ClaroLogo'

/**
 * Extracts a clean email address from a "Display Name <email@x.com>" string.
 * Gmail's From/To headers usually come formatted this way - we need just
 * the address to call the Gmail send API.
 */
function extractEmail(raw: string): string {
    const match = raw.match(/<([^>]+)>/)
    if (match) return match[1].trim()
    return raw.trim()
}

const ALL_CATEGORIES = [
    'Job Application', 'Recruiter Outreach', 'Internship', 'Placement & Campus',
    'Academic', 'Finance & Banking', 'Bills & Payments', 'Personal',
    'Requires Reply', 'Follow Up Required', 'High Priority', 'Newsletter',
    'Promotions', 'Social', 'Travel', 'Shopping', 'Spam', 'General',
]

export default function Dashboard() {
    const [composeOpen, setComposeOpen] = useState(false)
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        try {
            const saved = localStorage.getItem('theme')
            if (saved === 'dark') return 'dark'
            if (saved === 'light') return 'light'
        } catch (e) { }
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    })
    const [emails, setEmails] = useState<Email[]>([])
    const [selected, setSelected] = useState<Email | null>(null)
    const [loading, setLoading] = useState(true)
    const [classifying, setClassifying] = useState(false)
    const [draft, setDraft] = useState('')
    const [drafting, setDrafting] = useState(false)
    const [autoDrafts, setAutoDrafts] = useState<Record<string, string>>({})
    const [autoDraftingIds, setAutoDraftingIds] = useState<Set<string>>(new Set())
    const [view, setView] = useState<'inbox' | 'priority' | 'analytics'>('inbox')
    const [search, setSearch] = useState('')
    const [correctingOpen, setCorrectingOpen] = useState(false)
    const [correctionSaved, setCorrectionSaved] = useState(false)
    const [correctionsCount, setCorrectionsCount] = useState(0)
    const [autoClassifyingIds, setAutoClassifyingIds] = useState<Set<string>>(new Set())
    const [confirmSendOpen, setConfirmSendOpen] = useState(false)
    const [sending, setSending] = useState(false)
    const [sentEmailIds, setSentEmailIds] = useState<Set<string>>(new Set())
    const [savingDraft, setSavingDraft] = useState(false)
    const [draftSaved, setDraftSaved] = useState(false)
    const [sendError, setSendError] = useState('')

    const fetchEmails = async (forceRefresh = false) => {
        setLoading(true)
        try {
            const data = await api.getEmails(20, forceRefresh) as Email[]
            setEmails(data)
            setLoading(false)
            autoClassifyQueue(data)
        } catch (e) {
            console.error(e)
            setLoading(false)
        }
    }

    /**
     * BACKGROUND AUTO-CLASSIFY QUEUE
     *
     * WHY a queue instead of classifying before showing emails:
     * Classifying 20 emails sequentially through Groq takes ~10-15s total.
     * Blocking the UI on that would mean a long loading skeleton with no
     * feedback. Instead we show emails INSTANTLY (existing fast Gmail fetch),
     * then classify them one at a time in the background. Each email's
     * AI badge fades in as its result arrives - the inbox feels alive
     * instead of frozen.
     *
     * We classify sequentially (not in parallel) to respect Groq's rate
     * limits and avoid bursting 20 simultaneous requests.
     */
    /**
     * RATE LIMITING
     *
     * Groq's free tier caps requests-per-minute. Firing 20 classify calls
     * back-to-back (plus auto-drafts on top) reliably blows through that
     * limit, which surfaces as "rate limit reached" errors in the AI panel.
     *
     * Fix: a small fixed delay between each queued call keeps us under the
     * limit in normal use, and a short retry-with-backoff catches the rare
     * case where we still get rate-limited (e.g. right after a fresh
     * inbox load with many emails at once).
     */
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    async function withRateLimitRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
        try {
            return await fn()
        } catch (e: any) {
            const msg = String(e?.message || '')
            const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('rate limit')
            if (isRateLimit && retries > 0) {
                await delay(4000)
                return withRateLimitRetry(fn, retries - 1)
            }
            throw e
        }
    }

    const autoClassifyQueue = async (emailList: Email[]) => {
        const unclassified = emailList.filter(e => !e.classification)
        for (const email of unclassified) {
            setAutoClassifyingIds(prev => new Set(prev).add(email.id))
            try {
                const result = await withRateLimitRetry(() => api.classifyEmail(
                    email.id, email.subject, email.sender, email.snippet, email.body
                )) as any
                setEmails(prev => prev.map(e =>
                    e.id === email.id ? { ...e, classification: result } : e
                ))
                setSelected(prev => prev?.id === email.id ? { ...prev, classification: result } : prev)

                // If this email needs a reply, add it to the draft queue -
                // drafts run sequentially AFTER classification finishes, so
                // we never double up on Groq requests at the same time.
                // Skip if this was a degraded fallback result (confidence 0
                // means the backend couldn't actually reach the AI) - we
                // don't want to draft a reply based on a failed analysis.
                if (result.requires_reply && result.confidence > 0) {
                    draftQueueRef.current.push({ ...email, classification: result })
                }
            } catch (e) {
                console.error('Auto-classify failed for', email.id, e)
            } finally {
                setAutoClassifyingIds(prev => {
                    const next = new Set(prev)
                    next.delete(email.id)
                    return next
                })
            }
            // Stay under Groq's free-tier rate limit before the next call
            await delay(1200)
        }
        runDraftQueue()
    }

    /**
     * BACKGROUND AUTO-DRAFT
     *
     * For any email the AI flags as requires_reply, we generate a reply
     * draft immediately in the background - not waiting for the user to
     * open the email and click "Generate reply draft" themselves.
     *
     * IMPORTANT BOUNDARY: this ONLY writes a draft into local state. It
     * never calls /emails/send or /emails/create-draft. Nothing leaves
     * the user's inbox until they explicitly review the draft and click
     * "Approve & Send" or "Save Draft" themselves (see SendConfirmModal).
     * Auto-drafting saves time; it never removes the human checkpoint
     * before anything irreversible happens.
     */
    const generateAutoDraft = async (email: Email) => {
        if (autoDrafts[email.id] || autoDraftingIds.has(email.id)) return
        setAutoDraftingIds(prev => new Set(prev).add(email.id))
        try {
            const result = await withRateLimitRetry(() => api.generateDraft(
                email.id, email.subject, email.sender, email.body
            )) as any
            setAutoDrafts(prev => ({ ...prev, [email.id]: result.reply_draft }))
            // If the user already has this email open and hasn't started
            // editing their own draft yet, surface it immediately.
            setSelected(prev => {
                if (prev?.id === email.id && !draft) {
                    setDraft(result.reply_draft)
                }
                return prev
            })
        } catch (e) {
            console.error('Auto-draft failed for', email.id, e)
        } finally {
            setAutoDraftingIds(prev => {
                const next = new Set(prev)
                next.delete(email.id)
                return next
            })
        }
    }

    /**
     * Drafts are queued (not fired immediately inside the classify loop)
     * and run AFTER classification finishes for all emails. This keeps
     * us to one Groq call at a time across the whole auto-classify +
     * auto-draft pipeline, rather than two queues racing each other and
     * doubling our request rate.
     */
    const draftQueueRef = useRef<Email[]>([])
    const runDraftQueue = async () => {
        while (draftQueueRef.current.length > 0) {
            const email = draftQueueRef.current.shift()
            if (!email) continue
            await generateAutoDraft(email)
            await delay(1200)
        }
    }

    useEffect(() => { fetchEmails() }, [])

    useEffect(() => {
        api.getFeedbackStats()
            .then((r: any) => setCorrectionsCount(r.total_corrections))
            .catch(() => { })
    }, [correctionSaved])

    const toggleTheme = () => {
        const el = document.documentElement
        if (el.classList.contains('dark')) {
            el.classList.remove('dark')
            localStorage.setItem('theme', 'light')
            setTheme('light')
        } else {
            el.classList.add('dark')
            localStorage.setItem('theme', 'dark')
            setTheme('dark')
        }
    }

    useEffect(() => {
        const saved = localStorage.getItem('theme')
        const el = document.documentElement
        if (saved === 'dark') el.classList.add('dark')
        else if (saved === 'light') el.classList.remove('dark')
        else {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            if (prefersDark) el.classList.add('dark')
            else el.classList.remove('dark')
        }
    }, [])

    const classify = async (email: Email) => {
        setClassifying(true)
        setDraft('')
        setCorrectingOpen(false)
        setCorrectionSaved(false)
        try {
            const result = await api.classifyEmail(
                email.id, email.subject, email.sender, email.snippet, email.body
            ) as any
            setEmails(prev => prev.map(e =>
                e.id === email.id ? { ...e, classification: result } : e
            ))
            setSelected(prev => prev?.id === email.id ? { ...prev, classification: result } : prev)
        } finally {
            setClassifying(false)
        }
    }

    const correctClassification = async (newCategory: string) => {
        if (!selected || !selected.classification) return
        const original = selected.classification.category
        try {
            await api.submitFeedback(
                selected.id,
                selected.subject,
                selected.sender,
                selected.snippet,
                original,
                newCategory,
                selected.classification.priority,
            )
            const updated = { ...selected.classification, category: newCategory }
            setEmails(prev => prev.map(e => e.id === selected.id ? { ...e, classification: updated } : e))
            setSelected(prev => prev ? { ...prev, classification: updated } : prev)
            setCorrectingOpen(false)
            setCorrectionSaved(true)
        } catch (e) {
            console.error(e)
        }
    }

    const generateDraft = async (email: Email) => {
        setDrafting(true)
        setDraftSaved(false)
        setSendError('')
        try {
            const result = await api.generateDraft(
                email.id, email.subject, email.sender, email.body
            ) as any
            setDraft(result.reply_draft)
            setAutoDrafts(prev => ({ ...prev, [email.id]: result.reply_draft }))
        } finally {
            setDrafting(false)
        }
    }

    /**
     * HUMAN-IN-THE-LOOP SEND FLOW
     *
     * Sending an AI-written email is the highest-stakes action in this app -
     * a wrong recipient or a hallucinated detail goes out under the user's
     * name with no undo. So "Approve & Send" never sends directly; it opens
     * a confirmation modal showing exactly what will be sent (to, subject,
     * final body) and only calls the Gmail send API after explicit
     * confirmation. This is the same pattern production email/CRM tools
     * use before any irreversible external action.
     */
    const confirmAndSend = async () => {
        if (!selected) return
        setSending(true)
        setSendError('')
        try {
            const toEmail = extractEmail(selected.sender)
            const subject = selected.subject.toLowerCase().startsWith('re:')
                ? selected.subject
                : `Re: ${selected.subject}`
            await api.sendReply(toEmail, subject, draft, selected.threadId)
            setSentEmailIds(prev => new Set(prev).add(selected.id))
            setConfirmSendOpen(false)
            // Mark as no longer requiring a reply now that we've responded
            const updatedClassification = selected.classification
                ? { ...selected.classification, requires_reply: false }
                : selected.classification
            setEmails(prev => prev.map(e => e.id === selected.id ? { ...e, classification: updatedClassification } : e))
            setSelected(prev => prev ? { ...prev, classification: updatedClassification } : prev)
        } catch (e: any) {
            setSendError(e?.message || 'Failed to send. Please try again.')
        } finally {
            setSending(false)
        }
    }

    const saveAsDraft = async () => {
        if (!selected) return
        setSavingDraft(true)
        setSendError('')
        try {
            const toEmail = extractEmail(selected.sender)
            const subject = selected.subject.toLowerCase().startsWith('re:')
                ? selected.subject
                : `Re: ${selected.subject}`
            await api.createGmailDraft(toEmail, subject, draft, selected.threadId)
            setDraftSaved(true)
        } catch (e: any) {
            setSendError(e?.message || 'Failed to save draft. Please try again.')
        } finally {
            setSavingDraft(false)
        }
    }

    const priorityColor = (p?: string) => {
        if (p === 'High') return 'text-red-300 bg-red-500/15 border border-red-500/20'
        if (p === 'Medium') return 'text-amber-300 bg-amber-500/15 border border-amber-500/20'
        return 'text-zinc-400 bg-white/5 border border-white/10'
    }

    const categoryColor = (c?: string) => {
        const map: Record<string, string> = {
            'Job Application': 'bg-blue-500/15 text-blue-300 border border-blue-500/20',
            'Recruiter Outreach': 'bg-purple-500/15 text-purple-300 border border-purple-500/20',
            'Academic': 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20',
            'Internship': 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20',
            'Placement & Campus': 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20',
            'High Priority': 'bg-red-500/15 text-red-300 border border-red-500/20',
            'Requires Reply': 'bg-orange-500/15 text-orange-300 border border-orange-500/20',
            'Spam': 'bg-white/5 text-zinc-500 border border-white/10',
        }
        return map[c ?? ''] ?? 'bg-white/5 text-zinc-400 border border-white/10'
    }

    const classified = emails.filter(e => e.classification)
    const categories = classified.reduce((acc, e) => {
        const cat = e.classification!.category
        acc[cat] = (acc[cat] || 0) + 1
        return acc
    }, {} as Record<string, number>)
    const highPriority = classified.filter(e => e.classification?.priority === 'High').length
    const mediumPriority = classified.filter(e => e.classification?.priority === 'Medium').length
    const lowPriority = classified.filter(e => e.classification?.priority === 'Low').length
    const needsReply = classified.filter(e => e.classification?.requires_reply).length

    const priorityEmails = emails.filter(e =>
        e.classification?.priority === 'High' ||
        e.classification?.requires_reply ||
        e.classification?.follow_up_needed
    )
    const priorityCount = priorityEmails.length

    const listSource = view === 'priority' ? priorityEmails : emails

    return (
        <div className="flex flex-col h-screen bg-transparent overflow-hidden" style={{ color: 'var(--text-primary)' }}>

            <Header search={search} setSearch={setSearch} onRefresh={() => fetchEmails(true)} onCompose={() => setComposeOpen(true)} onToggleTheme={toggleTheme} theme={theme} />

            <div className="flex flex-1 overflow-hidden gap-3 p-3">

                <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} />

                <SendConfirmModal
                    open={confirmSendOpen}
                    toEmail={selected ? extractEmail(selected.sender) : ''}
                    subject={selected ? (selected.subject.toLowerCase().startsWith('re:') ? selected.subject : `Re: ${selected.subject}`) : ''}
                    body={draft}
                    sending={sending}
                    error={sendError}
                    onConfirm={confirmAndSend}
                    onClose={() => setConfirmSendOpen(false)}
                />

                {/* Sidebar */}
                <div className="w-16 flex-shrink-0 flex flex-col items-center py-4 gap-3 glass-panel rounded-2xl">
                    <div className="w-9 h-9 rounded-xl logo-glow flex items-center justify-center mb-2 text-white">
                        <ClaroLogo size={17} />
                    </div>
                    <button
                        onClick={() => setView('inbox')}
                        className={`p-2.5 rounded-xl transition-colors ${view === 'inbox' ? 'nav-active' : 'hover:bg-white/5'}`}
                        style={view !== 'inbox' ? { color: 'var(--text-tertiary)' } : {}}
                    >
                        <Inbox size={18} />
                    </button>
                    <button
                        onClick={() => setView('priority')}
                        className={`relative p-2.5 rounded-xl transition-colors ${view === 'priority' ? 'nav-active' : 'hover:bg-white/5'}`}
                        style={view !== 'priority' ? { color: 'var(--text-tertiary)' } : {}}
                        title="Priority inbox"
                    >
                        <Flame size={18} />
                        {priorityCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
                                {priorityCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setView('analytics')}
                        className={`p-2.5 rounded-xl transition-colors ${view === 'analytics' ? 'nav-active' : 'hover:bg-white/5'}`}
                        style={view !== 'analytics' ? { color: 'var(--text-tertiary)' } : {}}
                    >
                        <BarChart2 size={18} />
                    </button>
                    {correctionsCount > 0 && (
                        <div className="relative">
                            <div className="w-9 h-9 rounded-xl glass-card-flat flex items-center justify-center" title={`${correctionsCount} corrections learned`}>
                                <Sparkles size={14} className="text-emerald-400" />
                            </div>
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-bold text-white flex items-center justify-center">
                                {correctionsCount}
                            </span>
                        </div>
                    )}
                    <div className="flex-1" />
                    <button
                        onClick={() => api.logout().then(() => window.location.reload())}
                        className="p-2.5 rounded-xl hover:bg-red-500/10 transition-colors"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        <LogOut size={18} />
                    </button>
                </div>

                {view === 'analytics' ? (
                    <AnalyticsView
                        totalEmails={emails.length}
                        classifiedCount={classified.length}
                        highPriority={highPriority}
                        mediumPriority={mediumPriority}
                        lowPriority={lowPriority}
                        needsReply={needsReply}
                        categories={categories}
                        correctionsCount={correctionsCount}
                    />
                ) : (
                    <>
                        {/* Email List */}
                        <div className="w-80 flex-shrink-0 flex flex-col glass-panel rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b flex items-center justify-between gap-2" style={{ borderColor: 'var(--glass-border)' }}>
                                <div className="flex items-center gap-2">
                                    {view === 'priority' && <Flame size={13} className="text-red-400" />}
                                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                        {view === 'priority' ? `Priority · ${priorityEmails.length}` : `Inbox · ${emails.length}`}
                                    </span>
                                </div>
                                {autoClassifyingIds.size > 0 && (
                                    <span className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                        Analyzing {autoClassifyingIds.size}
                                    </span>
                                )}
                                {autoClassifyingIds.size === 0 && autoDraftingIds.size > 0 && (
                                    <span className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Drafting {autoDraftingIds.size}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {loading ? (
                                    <div className="flex flex-col gap-2 p-3">
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <div key={i} className="rounded-xl h-16 skeleton-shimmer" />
                                        ))}
                                    </div>
                                ) : listSource.length === 0 && view === 'priority' ? (
                                    <div className="flex-1 flex items-center justify-center p-8 text-center">
                                        <div>
                                            <Flame size={28} className="mx-auto mb-3 opacity-20" />
                                            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                                Nothing urgent right now.
                                            </p>
                                            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                                                Classify emails in your inbox to surface what needs attention.
                                            </p>
                                        </div>
                                    </div>
                                ) : listSource
                                    .filter(e => {
                                        if (!search) return true
                                        const s = search.toLowerCase()
                                        return (
                                            e.subject.toLowerCase().includes(s) ||
                                            e.sender.toLowerCase().includes(s) ||
                                            e.snippet.toLowerCase().includes(s)
                                        )
                                    })
                                    .map(email => (
                                        <EmailItem
                                            key={email.id}
                                            email={email}
                                            selected={selected?.id === email.id}
                                            isClassifying={autoClassifyingIds.has(email.id)}
                                            hasDraft={Boolean(autoDrafts[email.id])}
                                            onSelect={(e) => { setSelected(e); setDraft(autoDrafts[e.id] || ''); setCorrectingOpen(false); setCorrectionSaved(false); setDraftSaved(false); setSendError(''); setConfirmSendOpen(false) }}
                                        />
                                    ))}
                            </div>
                        </div>

                        {/* Email Detail + AI Panel */}
                        {selected ? (
                            <div className="flex flex-1 gap-3 overflow-hidden">
                                {/* Email Body */}
                                <div className="flex-1 flex flex-col overflow-hidden glass-panel rounded-2xl email-body">
                                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--glass-border)' }}>
                                        <h2 className="text-base font-bold mb-2">{selected.subject}</h2>
                                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selected.sender}</p>
                                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{selected.date}</p>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-6 py-4">
                                        <div
                                            className="text-sm leading-relaxed"
                                            style={{ color: 'var(--text-secondary)' }}
                                            dangerouslySetInnerHTML={{ __html: selected.body || selected.snippet }}
                                        />
                                    </div>
                                </div>

                                {/* AI Panel */}
                                <div className="w-72 flex-shrink-0 flex flex-col overflow-y-auto glass-panel rounded-2xl p-4 gap-4">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={14} className="text-indigo-400" />
                                        <span className="text-sm font-semibold">AI Analysis</span>
                                    </div>

                                    {!selected.classification && !classifying && !autoClassifyingIds.has(selected.id) && (
                                        <button
                                            onClick={() => classify(selected)}
                                            className="w-full py-2.5 text-sm glass-card-flat hover:bg-white/5 transition-colors rounded-xl font-medium"
                                        >
                                            Classify this email
                                        </button>
                                    )}

                                    {(classifying || (autoClassifyingIds.has(selected.id) && !selected.classification)) && (
                                        <div className="flex flex-col gap-2">
                                            <div className="h-5 rounded-lg w-32 skeleton-shimmer" />
                                            <div className="h-3 rounded w-full skeleton-shimmer" />
                                            <div className="h-3 rounded w-3/4 skeleton-shimmer" />
                                        </div>
                                    )}

                                    {selected.classification && !classifying && (
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <button
                                                    onClick={() => setCorrectingOpen(v => !v)}
                                                    className={`badge-soft flex items-center gap-1 ${categoryColor(selected.classification.category)}`}
                                                    title="Click to correct"
                                                >
                                                    {selected.classification.category}
                                                    <ChevronDown size={11} />
                                                </button>
                                                <span className={`badge-soft ${priorityColor(selected.classification.priority)}`}>
                                                    {selected.classification.priority}
                                                </span>
                                            </div>

                                            {correctingOpen && (
                                                <div className="glass-card p-2 max-h-40 overflow-y-auto flex flex-col gap-0.5">
                                                    <div className="flex items-center justify-between px-1 pb-1">
                                                        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Correct category</span>
                                                        <button onClick={() => setCorrectingOpen(false)} className="p-0.5 hover:bg-white/10 rounded">
                                                            <X size={11} style={{ color: 'var(--text-tertiary)' }} />
                                                        </button>
                                                    </div>
                                                    {ALL_CATEGORIES.map(cat => (
                                                        <button
                                                            key={cat}
                                                            onClick={() => correctClassification(cat)}
                                                            className="text-left text-xs px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                                            style={{ color: cat === selected.classification?.category ? 'var(--accent-light)' : 'var(--text-secondary)' }}
                                                        >
                                                            {cat}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {correctionSaved && (
                                                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                                                    <Check size={12} />
                                                    Correction saved — AI will learn from this
                                                </div>
                                            )}

                                            <div>
                                                <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                                                    <span>Confidence</span>
                                                    <span>{Math.round(selected.classification.confidence * 100)}%</span>
                                                </div>
                                                <div className="h-1.5 bg-white/5 rounded-full">
                                                    <div
                                                        className="confidence-fill h-1.5 rounded-full transition-all"
                                                        style={{ width: `${selected.classification.confidence * 100}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {selected.classification.summary && (
                                                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                                    {selected.classification.summary}
                                                </p>
                                            )}

                                            {selected.classification.suggestion && (
                                                <div className="glass-card-flat p-3" style={{ borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.08)' }}>
                                                    <p className="text-xs" style={{ color: 'var(--accent-light)' }}>{selected.classification.suggestion}</p>
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-2">
                                                {selected.classification.requires_reply && (
                                                    <span className="badge-soft bg-orange-500/15 text-orange-300 border border-orange-500/20">Needs reply</span>
                                                )}
                                                {selected.classification.follow_up_needed && (
                                                    <span className="badge-soft bg-white/5 text-zinc-400 border border-white/10">Follow up</span>
                                                )}
                                            </div>

                                            {selected.classification.requires_reply && !draft && !drafting && !autoDraftingIds.has(selected.id) && (
                                                <button
                                                    onClick={() => generateDraft(selected)}
                                                    className="btn-gradient w-full py-2.5 text-sm rounded-xl flex items-center justify-center gap-2 text-white font-medium"
                                                >
                                                    <Sparkles size={13} />
                                                    Generate reply draft
                                                </button>
                                            )}

                                            {selected.classification.requires_reply && !draft && autoDraftingIds.has(selected.id) && (
                                                <div className="flex items-center gap-2 text-xs py-2" style={{ color: 'var(--text-tertiary)' }}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                                    AI is drafting a reply…
                                                </div>
                                            )}

                                            {drafting && (
                                                <div className="h-24 rounded-xl skeleton-shimmer" />
                                            )}

                                            {draft && (
                                                <div className="flex flex-col gap-2">
                                                    <textarea
                                                        value={draft}
                                                        onChange={e => setDraft(e.target.value)}
                                                        className="w-full h-36 glass-card-flat p-3 text-xs resize-none focus:outline-none"
                                                        style={{ color: 'var(--text-primary)' }}
                                                    />

                                                    {sentEmailIds.has(selected.id) ? (
                                                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 py-1">
                                                            <Check size={12} />
                                                            Reply sent
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setConfirmSendOpen(true)}
                                                                className="btn-gradient flex-1 py-2 text-xs rounded-lg flex items-center justify-center gap-1.5 text-white font-medium"
                                                            >
                                                                <Send size={12} />
                                                                Approve & Send
                                                            </button>
                                                            <button
                                                                onClick={saveAsDraft}
                                                                disabled={savingDraft}
                                                                className="flex-1 py-2 text-xs glass-card-flat hover:bg-white/5 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                                                                style={{ color: 'var(--text-secondary)' }}
                                                            >
                                                                {savingDraft ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                                                                {draftSaved ? 'Saved!' : 'Save Draft'}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {sendError && (
                                                        <p className="text-[11px] text-red-400">{sendError}</p>
                                                    )}

                                                    <button
                                                        onClick={() => generateDraft(selected)}
                                                        className="text-xs hover:opacity-80 transition-opacity self-start"
                                                        style={{ color: 'var(--text-tertiary)' }}
                                                    >
                                                        Regenerate
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center glass-panel rounded-2xl">
                                <div className="text-center">
                                    <Inbox size={32} className="mx-auto mb-3 opacity-20" />
                                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Select an email to read</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
