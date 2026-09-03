import { useState, useEffect, useRef } from 'react'
import { Sparkles, ChevronDown, Check, X, Flame, Send, FileText, Loader2, Inbox } from 'lucide-react'
import { api } from '../api/client'
import type { Email } from '../types'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import EmailItem from '../components/EmailItem'
import ComposeModal from '../components/ComposeModal'
import SendConfirmModal from '../components/SendConfirmModal'
import AnalyticsView from '../components/AnalyticsView'
import DraftsView from '../components/DraftsView'

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

const TONE_INSTRUCTIONS: Record<string, string> = {
    formal: 'Write a formal, professional reply. Never invent facts. Keep it under 120 words.',
    casual: 'Write a friendly, casual reply. Keep it warm and conversational. Never invent facts. Keep it under 100 words.',
    brief: 'Write a very brief reply under 60 words. Be direct and polite. Never invent facts.',
}

type View = 'inbox' | 'priority' | 'analytics' | 'drafts'

type DashboardProps = {
    onLogout?: () => void
}

export default function Dashboard({ onLogout }: DashboardProps) {
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
    const [view, setView] = useState<View>('inbox')
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
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
    const [emailLimit, setEmailLimit] = useState(20)
    const [replyTone, setReplyTone] = useState<'formal' | 'casual' | 'brief'>('formal')
    const [bulkClassifying, setBulkClassifying] = useState(false)

    /**
     * TRUE AUTO-SEND — opt-in, off by default.
     *
     * When enabled, the BACKGROUND auto-draft pipeline (generateAutoDraft,
     * fired from autoClassifyQueue/handleBulkClassify for emails the AI
     * flags as requires_reply) sends the drafted reply immediately with no
     * modal and no click. This is the one path in the app that skips the
     * human-in-the-loop confirmation gate - it exists because the user
     * explicitly asked for it, not as a default.
     *
     * Manual drafting (the "Generate reply draft"/"Regenerate" buttons in
     * the detail view and Drafts & Review) is NOT affected by this toggle -
     * clicking those is an explicit request to see the wording, so it
     * always stays reviewable via the normal SendConfirmModal flow.
     */
    const [autoSendEnabled, setAutoSendEnabled] = useState<boolean>(() => {
        try {
            return localStorage.getItem('autoSend') === 'true'
        } catch (e) {
            return false
        }
    })
    const autoSendEnabledRef = useRef(autoSendEnabled)
    useEffect(() => {
        autoSendEnabledRef.current = autoSendEnabled
    }, [autoSendEnabled])

    const toggleAutoSend = () => {
        setAutoSendEnabled(prev => {
            const next = !prev
            try {
                localStorage.setItem('autoSend', String(next))
            } catch (e) { }
            return next
        })
    }

    const handleLogoutAction = () => {
        if (onLogout) {
            onLogout()
        } else {
            api.logout().then(() => window.location.reload())
        }
    }


    const fetchEmails = async (refresh = false) => {
        setLoading(true)
        try {
            const data = await api.getEmails(emailLimit, refresh) as Email[]
            setEmails(data)
            setLoading(false)
            autoClassifyQueue(data)
        } catch (e) {
            console.error(e)
            setLoading(false)
        }
    }

    const loadMoreEmails = () => {
        setEmailLimit(prev => prev + 20)
    }

    useEffect(() => {
        fetchEmails()
    }, [emailLimit])

    const handleBulkClassify = async () => {
        setBulkClassifying(true)
        try {
            const result = await api.bulkClassify(10)
            setEmails(prev => prev.map(e => {
                const clf = result.results[e.id] as Email['classification']
                if (clf) {
                    if (clf.requires_reply) {
                        generateAutoDraft({ ...e, classification: clf })
                    }
                    return { ...e, classification: clf }
                }
                return e
            }))
        } catch (e) {
            console.error(e)
        } finally {
            setBulkClassifying(false)
        }
    }

    const selectEmail = async (email: Email) => {
        setSelected(email)
        setCorrectingOpen(false)
        setCorrectionSaved(false)
        setDraftSaved(false)
        setSendError('')
        setConfirmSendOpen(false)

        const cached = autoDrafts[email.id]
        if (cached) {
            setDraft(cached)
            return
        }

        setDraft('')
        try {
            const drafts = await api.getDrafts(email.id) as { draft_text: string }[]
            if (drafts.length > 0) {
                const text = drafts[0].draft_text
                setDraft(text)
                setAutoDrafts(prev => ({ ...prev, [email.id]: text }))
            }
        } catch {
            // no saved drafts
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
    const autoClassifyQueue = async (emailList: Email[]) => {
        const unclassified = emailList.filter(e => !e.classification)
        for (const [i, email] of unclassified.entries()) {
            if (i > 0) {
                // Space out calls so a full inbox load doesn't burst past
                // Groq's free-tier requests-per-minute limit.
                await new Promise(resolve => setTimeout(resolve, 1200))
            }
            setAutoClassifyingIds(prev => new Set(prev).add(email.id))
            try {
                const result = await api.classifyEmail(
                    email.id, email.subject, email.sender, email.snippet, email.body
                ) as any
                setEmails(prev => prev.map(e =>
                    e.id === email.id ? { ...e, classification: result } : e
                ))
                setSelected(prev => prev?.id === email.id ? { ...prev, classification: result } : prev)

                // If this email needs a reply, queue up a background draft too -
                // by the time the user opens it, the draft is already waiting.
                if (result.requires_reply) {
                    generateAutoDraft({ ...email, classification: result })
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
        }
    }

    /**
     * Send a reply for a given email/draft pair with no UI interaction -
     * used only by the auto-send pipeline below. Mirrors confirmAndSend's
     * request shape but doesn't depend on `selected`/`draft` state, since
     * the email being auto-sent is very often not the one the user
     * currently has open.
     */
    const sendEmailNow = async (email: Email, draftText: string) => {
        try {
            const toEmail = extractEmail(email.sender)
            const subject = email.subject.toLowerCase().startsWith('re:')
                ? email.subject
                : `Re: ${email.subject}`
            await api.sendReply(toEmail, subject, draftText, email.threadId)
            setSentEmailIds(prev => new Set(prev).add(email.id))
            setEmails(prev => prev.map(e =>
                e.id === email.id && e.classification
                    ? { ...e, classification: { ...e.classification, requires_reply: false } }
                    : e
            ))
        } catch (e) {
            console.error('Auto-send failed for', email.id, e)
        }
    }

    /**
     * BACKGROUND AUTO-DRAFT (+ optional AUTO-SEND)
     *
     * For any email the AI flags as requires_reply, we generate a reply
     * draft immediately in the background - not waiting for the user to
     * open the email and click "Generate reply draft" themselves.
     *
     * By default this ONLY writes a draft into local state - nothing leaves
     * the user's inbox until they explicitly review it and click "Approve &
     * Send" or "Save Draft" (see SendConfirmModal). If the user has opted
     * into `autoSendEnabled`, this function also sends the draft immediately
     * via sendEmailNow, with no modal and no click - that's the one place
     * in the app the human-in-the-loop gate is skipped, and only because
     * the user explicitly turned it on.
     */
    const generateAutoDraft = async (email: Email) => {
        if (autoDrafts[email.id] || autoDraftingIds.has(email.id)) return
        setAutoDraftingIds(prev => new Set(prev).add(email.id))
        try {
            const result = await api.generateDraft(
                email.id, email.subject, email.sender, email.body, TONE_INSTRUCTIONS.formal
            ) as any
            setAutoDrafts(prev => ({ ...prev, [email.id]: result.reply_draft }))

            if (autoSendEnabledRef.current) {
                await sendEmailNow(email, result.reply_draft)
                return
            }

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

    useEffect(() => {
        api.getFeedbackStats()
            .then((r: any) => setCorrectionsCount(r.total_corrections))
            .catch(() => { })
    }, [correctionSaved])

    const unclassifiedCount = emails.filter(e => !e.classification).length

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
                email.id, email.subject, email.sender, email.body, TONE_INSTRUCTIONS[replyTone]
            ) as any
            // Only touch the open detail panel's textarea if this draft
            // belongs to the currently selected email - this function is
            // also called from the Drafts & Review grid for emails that
            // aren't the one open in the detail view.
            setSelected(prev => {
                if (prev?.id === email.id) setDraft(result.reply_draft)
                return prev
            })
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
     * use before any irreversible external action. The Drafts & Review
     * grid's "Send Now" button routes through this exact same gate.
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

    // Jump into the detail view to review/edit a draft from the Drafts grid.
    const handleReviewEdit = (email: Email) => {
        selectEmail(email)
        setView('inbox')
    }

    // "Send Now" from the Drafts grid selects the email (loading its cached
    // draft the same way the detail view does) then opens the same
    // SendConfirmModal safety gate used everywhere else in the app.
    const handleSendNowFromDrafts = (email: Email) => {
        selectEmail(email)
        setConfirmSendOpen(true)
    }

    const priorityColor = (p?: string) => {
        if (p === 'High') return 'text-error bg-error-container'
        if (p === 'Medium') return 'text-on-secondary-container bg-secondary-container'
        return 'text-secondary bg-surface-container'
    }

    const categoryColor = (c?: string) => {
        const map: Record<string, string> = {
            'Job Application': 'bg-secondary-container text-on-secondary-container',
            'Recruiter Outreach': 'bg-tertiary-container text-on-tertiary-container',
            'Academic': 'bg-surface-container-high text-on-surface',
            'Internship': 'bg-secondary-container text-on-secondary-container',
            'Placement & Campus': 'bg-surface-container-high text-on-surface',
            'High Priority': 'bg-error-container text-on-error-container',
            'Requires Reply': 'bg-primary-container text-on-primary-container',
            'Spam': 'bg-surface-container text-secondary',
        }
        return map[c ?? ''] ?? 'bg-surface-container text-secondary'
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
    const draftsCount = Object.keys(autoDrafts).length

    const activeCategories = Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name]) => name)

    const listSource = view === 'priority' ? priorityEmails : emails

    return (
        <div className="flex h-screen overflow-hidden bg-background text-on-background">

            <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} onSent={() => fetchEmails(true)} />

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

            <Sidebar
                view={view}
                setView={setView}
                onCompose={() => setComposeOpen(true)}
                onLogout={handleLogoutAction}
                draftsCount={draftsCount}
                correctionsCount={correctionsCount}
                autoSendEnabled={autoSendEnabled}
                onToggleAutoSend={toggleAutoSend}
            />

            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-background">
                <TopBar
                    search={search}
                    setSearch={setSearch}
                    onRefresh={() => fetchEmails(true)}
                    view={view}
                    setView={setView}
                    unclassifiedCount={unclassifiedCount}
                    onClassifyUnclassified={handleBulkClassify}
                    classifying={bulkClassifying}
                    onToggleTheme={toggleTheme}
                    theme={theme}
                />

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
                ) : view === 'drafts' ? (
                    <DraftsView
                        emails={emails}
                        autoDrafts={autoDrafts}
                        setAutoDrafts={setAutoDrafts}
                        replyTone={replyTone}
                        setReplyTone={setReplyTone}
                        generateDraft={generateDraft}
                        onReviewEdit={handleReviewEdit}
                        onSendNow={handleSendNowFromDrafts}
                        sentEmailIds={sentEmailIds}
                    />
                ) : (
                    <div className="flex flex-1 overflow-hidden">
                        {/* Email List */}
                        <section className="w-[380px] flex-shrink-0 border-r border-outline-variant bg-surface flex flex-col h-full">
                            <div className="p-stack-md border-b border-outline-variant flex justify-between items-center bg-surface-bright">
                                <div className="flex items-center gap-2 min-w-0">
                                    {view === 'priority' && <Flame size={14} className="text-error shrink-0" />}
                                    <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">
                                        {view === 'priority' ? `Priority · ${priorityEmails.length}` : `Inbox · ${emails.length}`}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {unclassifiedCount > 0 && view === 'inbox' && (
                                        <button
                                            onClick={handleBulkClassify}
                                            disabled={bulkClassifying}
                                            className="font-label-sm text-label-sm px-2 py-1 rounded-md border border-outline-variant text-primary hover:bg-surface-container transition-colors disabled:opacity-50"
                                        >
                                            {bulkClassifying ? 'Classifying…' : `Classify ${unclassifiedCount}`}
                                        </button>
                                    )}
                                    {autoClassifyingIds.size > 0 && (
                                        <span className="font-label-sm text-label-sm flex items-center gap-1.5 text-secondary">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                            Analyzing {autoClassifyingIds.size}
                                        </span>
                                    )}
                                    {autoClassifyingIds.size === 0 && autoDraftingIds.size > 0 && (
                                        <span className="font-label-sm text-label-sm flex items-center gap-1.5 text-secondary">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                            Drafting {autoDraftingIds.size}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {view === 'inbox' && activeCategories.length > 0 && (
                                <div className="px-stack-sm py-2 border-b border-outline-variant flex gap-1.5 overflow-x-auto">
                                    <button
                                        onClick={() => setCategoryFilter(null)}
                                        className={`font-label-sm text-label-sm px-2 py-1 rounded-full shrink-0 transition-colors ${!categoryFilter ? 'bg-primary text-on-primary font-bold' : 'border border-outline-variant text-secondary hover:bg-surface-container'}`}
                                    >
                                        All
                                    </button>
                                    {activeCategories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                                            className={`font-label-sm text-label-sm px-2 py-1 rounded-full shrink-0 transition-colors ${categoryFilter === cat ? 'bg-primary text-on-primary font-bold' : 'border border-outline-variant text-secondary hover:bg-surface-container'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex-1 overflow-y-auto">
                                {loading ? (
                                    <div className="flex flex-col gap-2 p-stack-sm">
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <div key={i} className="rounded-xl h-16 skeleton-shimmer" />
                                        ))}
                                    </div>
                                ) : listSource.length === 0 && view === 'priority' ? (
                                    <div className="flex-1 flex items-center justify-center p-8 text-center">
                                        <div>
                                            <Flame size={28} className="mx-auto mb-3 text-outline" />
                                            <p className="font-body-md text-body-md text-secondary">
                                                Nothing urgent right now.
                                            </p>
                                            <p className="font-label-sm text-label-sm mt-1 text-outline">
                                                Classify emails in your inbox to surface what needs attention.
                                            </p>
                                        </div>
                                    </div>
                                ) : listSource
                                    .filter(e => {
                                        if (categoryFilter && e.classification?.category !== categoryFilter) return false
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
                                            onSelect={selectEmail}
                                        />
                                    ))}
                            </div>
                            {view === 'inbox' && emails.length >= emailLimit && (
                                <div className="px-stack-sm py-2 border-t border-outline-variant">
                                    <button
                                        onClick={loadMoreEmails}
                                        disabled={loading}
                                        className="w-full py-2 font-label-md text-label-md rounded-lg border border-outline-variant text-secondary hover:bg-surface-container transition-colors disabled:opacity-50"
                                    >
                                        Load more emails
                                    </button>
                                </div>
                            )}
                        </section>

                        {/* Email Detail + AI Panel */}
                        {selected ? (
                            <div className="flex flex-1 overflow-hidden">
                                {/* Email Body */}
                                <section className="flex-1 flex flex-col overflow-hidden bg-background email-body">
                                    <div className="p-margin-desktop border-b border-outline-variant bg-surface flex-shrink-0">
                                        <h1 className="font-headline-md text-headline-md text-on-surface mb-2">{selected.subject}</h1>
                                        <p className="font-body-md text-body-md text-secondary">{selected.sender}</p>
                                        <p className="font-label-sm text-label-sm text-outline">{selected.date}</p>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-margin-desktop py-stack-lg">
                                        <div
                                            className="font-body-lg text-body-lg leading-relaxed text-on-surface-variant"
                                            dangerouslySetInnerHTML={{ __html: selected.body || selected.snippet }}
                                        />
                                    </div>
                                </section>

                                {/* AI Panel */}
                                <aside className="w-80 flex-shrink-0 flex flex-col overflow-y-auto bg-surface-container-lowest border-l border-outline-variant p-stack-md gap-stack-md">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={16} className="text-primary" />
                                        <span className="font-headline-sm text-headline-sm text-on-surface">AI Analysis</span>
                                    </div>

                                    {!selected.classification && !classifying && !autoClassifyingIds.has(selected.id) && (
                                        <button
                                            onClick={() => classify(selected)}
                                            className="w-full py-2.5 font-label-md text-label-md rounded-lg border border-outline-variant text-secondary hover:bg-surface-container transition-colors font-medium"
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
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <button
                                                    onClick={() => setCorrectingOpen(v => !v)}
                                                    className={`font-label-sm text-label-sm px-2 py-1 rounded-md flex items-center gap-1 ${categoryColor(selected.classification.category)}`}
                                                    title="Click to correct"
                                                >
                                                    {selected.classification.category}
                                                    <ChevronDown size={11} />
                                                </button>
                                                <span className={`font-label-sm text-label-sm px-2 py-1 rounded-md ${priorityColor(selected.classification.priority)}`}>
                                                    {selected.classification.priority}
                                                </span>
                                            </div>

                                            {correctingOpen && (
                                                <div className="bg-surface border border-outline-variant rounded-lg p-2 max-h-40 overflow-y-auto flex flex-col gap-0.5">
                                                    <div className="flex items-center justify-between px-1 pb-1">
                                                        <span className="font-label-sm text-[10px] uppercase tracking-wide text-secondary">Correct category</span>
                                                        <button onClick={() => setCorrectingOpen(false)} className="p-0.5 hover:bg-surface-container rounded">
                                                            <X size={11} className="text-secondary" />
                                                        </button>
                                                    </div>
                                                    {ALL_CATEGORIES.map(cat => (
                                                        <button
                                                            key={cat}
                                                            onClick={() => correctClassification(cat)}
                                                            className={`text-left font-body-md text-body-md px-2 py-1.5 rounded-lg hover:bg-surface-container transition-colors ${cat === selected.classification?.category ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}
                                                        >
                                                            {cat}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {correctionSaved && (
                                                <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-primary">
                                                    <Check size={12} />
                                                    Correction saved — AI will learn from this
                                                </div>
                                            )}

                                            <div>
                                                <div className="flex justify-between font-label-sm text-label-sm mb-1 text-secondary">
                                                    <span>Confidence</span>
                                                    <span>{Math.round(selected.classification.confidence * 100)}%</span>
                                                </div>
                                                <div className="h-1.5 bg-surface-container rounded-full">
                                                    <div
                                                        className="h-1.5 rounded-full bg-primary transition-all"
                                                        style={{ width: `${selected.classification.confidence * 100}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {selected.classification.summary && (
                                                <p className="font-body-md text-body-md leading-relaxed text-on-surface-variant">
                                                    {selected.classification.summary}
                                                </p>
                                            )}

                                            {selected.classification.suggestion && (
                                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex gap-2">
                                                    <Sparkles size={14} className="text-primary mt-0.5 shrink-0" />
                                                    <p className="font-body-md text-body-md text-primary">{selected.classification.suggestion}</p>
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-2">
                                                {selected.classification.requires_reply && (
                                                    <span className="font-label-sm text-label-sm px-2 py-1 rounded-md bg-primary-container text-on-primary-container">Needs reply</span>
                                                )}
                                                {selected.classification.follow_up_needed && (
                                                    <span className="font-label-sm text-label-sm px-2 py-1 rounded-md bg-surface-container text-secondary">Follow up</span>
                                                )}
                                            </div>

                                            {selected.classification.requires_reply && !draft && !drafting && !autoDraftingIds.has(selected.id) && (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-label-sm text-[10px] uppercase tracking-wide text-secondary">Tone</span>
                                                        {(['formal', 'casual', 'brief'] as const).map(tone => (
                                                            <button
                                                                key={tone}
                                                                onClick={() => setReplyTone(tone)}
                                                                className={`font-label-sm text-label-sm px-2 py-1 rounded-md capitalize transition-colors ${replyTone === tone ? 'bg-primary text-on-primary' : 'border border-outline-variant text-secondary hover:bg-surface-container'}`}
                                                            >
                                                                {tone}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={() => generateDraft(selected)}
                                                        className="w-full py-2.5 font-label-md text-label-md rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors flex items-center justify-center gap-2 font-semibold"
                                                    >
                                                        <Sparkles size={14} />
                                                        Generate reply draft
                                                    </button>
                                                </div>
                                            )}

                                            {selected.classification.requires_reply && !draft && autoDraftingIds.has(selected.id) && (
                                                <div className="flex items-center gap-2 font-label-sm text-label-sm py-2 text-secondary">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
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
                                                        className="w-full h-36 border border-outline-variant rounded-lg bg-surface p-3 font-body-md text-body-md text-on-surface resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                                    />

                                                    {sentEmailIds.has(selected.id) ? (
                                                        <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-primary py-1">
                                                            <Check size={12} />
                                                            Reply sent
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setConfirmSendOpen(true)}
                                                                className="flex-1 py-2 font-label-sm text-label-sm rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors flex items-center justify-center gap-1.5 font-semibold"
                                                            >
                                                                <Send size={13} />
                                                                Approve & Send
                                                            </button>
                                                            <button
                                                                onClick={saveAsDraft}
                                                                disabled={savingDraft}
                                                                className="flex-1 py-2 font-label-sm text-label-sm rounded-lg border border-outline-variant text-secondary hover:bg-surface-container transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                                                            >
                                                                {savingDraft ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                                                                {draftSaved ? 'Saved!' : 'Save Draft'}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {sendError && (
                                                        <p className="font-label-sm text-label-sm text-error">{sendError}</p>
                                                    )}

                                                    <button
                                                        onClick={() => generateDraft(selected)}
                                                        className="font-label-sm text-label-sm hover:opacity-80 transition-opacity self-start text-secondary"
                                                    >
                                                        Regenerate
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </aside>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center bg-background">
                                <div className="text-center">
                                    <Inbox size={32} className="mx-auto mb-3 text-outline" />
                                    <p className="font-body-md text-body-md text-secondary">Select an email to read</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}
