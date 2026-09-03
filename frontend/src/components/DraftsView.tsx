import { useState } from 'react'
import { Sparkles, RefreshCw, Send, Edit2, FileEdit, Loader2 } from 'lucide-react'
import type { Email } from '../types'

type Props = {
    emails: Email[]
    autoDrafts: Record<string, string>
    setAutoDrafts: (updater: (prev: Record<string, string>) => Record<string, string>) => void
    replyTone: 'formal' | 'casual' | 'brief'
    setReplyTone: (t: 'formal' | 'casual' | 'brief') => void
    generateDraft: (email: Email) => Promise<void>
    onReviewEdit: (email: Email) => void
    onSendNow: (email: Email) => void
    sentEmailIds: Set<string>
}

function initials(name: string) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '??'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
}

/**
 * DRAFTS & REVIEW — a dedicated review surface for every AI-generated reply.
 *
 * Each card pairs the original email snippet with the proposed draft so the
 * user can approve or edit without hunting through the inbox. "Send Now"
 * intentionally reuses the same SendConfirmModal safety gate as the inbox
 * detail view — there is no one-click send here, only a shortcut to get to
 * that confirmation faster.
 */
export default function DraftsView({
    emails,
    autoDrafts,
    setAutoDrafts,
    replyTone,
    setReplyTone,
    generateDraft,
    onReviewEdit,
    onSendNow,
    sentEmailIds,
}: Props) {
    const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set())

    // Once a reply has actually been sent (manually or via auto-send), it
    // drops out of the review queue - nothing left to approve.
    const draftEmails = emails.filter(e => autoDrafts[e.id] && !sentEmailIds.has(e.id))

    const handleRegenerate = async (email: Email) => {
        setRegeneratingIds(prev => new Set(prev).add(email.id))
        try {
            await generateDraft(email)
        } finally {
            setRegeneratingIds(prev => {
                const next = new Set(prev)
                next.delete(email.id)
                return next
            })
        }
    }

    return (
        <div className="flex-1 overflow-y-auto bg-background p-margin-desktop">
            <div className="mb-stack-lg">
                <h2 className="font-display-lg text-display-lg text-on-surface mb-2">Drafts & Review</h2>
                <p className="font-body-lg text-body-lg text-secondary">
                    Review and approve AI-generated responses before they are sent.
                </p>
            </div>

            {draftEmails.length === 0 ? (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-10 flex flex-col items-center justify-center text-center">
                    <FileEdit size={28} className="mb-3 text-outline" />
                    <p className="font-body-md text-body-md text-secondary">No drafts waiting for review yet.</p>
                    <p className="font-label-sm text-label-sm text-outline mt-1">
                        Drafts appear here automatically once the AI flags an email as needing a reply.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-stack-lg">
                    {draftEmails.map(email => {
                        const sender = email.sender.split('<')[0].trim()
                        const isRegenerating = regeneratingIds.has(email.id)
                        return (
                            <div
                                key={email.id}
                                className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col relative"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-surface-tint" />

                                <div className="p-stack-md border-b border-outline-variant/50">
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold font-label-sm text-label-sm shrink-0">
                                                {initials(sender)}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface truncate">{sender}</h3>
                                                <p className="font-label-sm text-label-sm text-secondary truncate">{email.subject}</p>
                                            </div>
                                        </div>
                                        {email.classification?.priority && (
                                            <span
                                                className={`shrink-0 font-label-sm text-label-sm px-2 py-1 rounded-md uppercase ${
                                                    email.classification.priority === 'High'
                                                        ? 'bg-error-container text-on-error-container'
                                                        : 'bg-surface-container text-secondary'
                                                }`}
                                            >
                                                {email.classification.priority}
                                            </span>
                                        )}
                                    </div>
                                    <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/30">
                                        <p className="font-label-sm text-[10px] text-secondary mb-1 uppercase tracking-wide">Original Email Snippet</p>
                                        <p className="font-body-md text-body-md text-secondary italic line-clamp-2">"{email.snippet}"</p>
                                    </div>
                                </div>

                                <div className="p-stack-md flex-1 flex flex-col">
                                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                                        <Sparkles size={14} className="text-primary" />
                                        <span className="font-label-sm text-label-sm text-primary uppercase font-bold tracking-wider">AI Proposed Draft</span>
                                        <div className="ml-auto flex gap-1 bg-surface-container p-1 rounded-lg">
                                            {(['formal', 'casual', 'brief'] as const).map(tone => (
                                                <button
                                                    key={tone}
                                                    onClick={() => setReplyTone(tone)}
                                                    className={`px-2 py-0.5 rounded-md font-label-sm text-label-sm capitalize transition-colors ${
                                                        replyTone === tone ? 'bg-surface-container-lowest shadow-sm font-semibold text-on-surface' : 'text-secondary hover:text-on-surface'
                                                    }`}
                                                >
                                                    {tone}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <textarea
                                        value={autoDrafts[email.id] ?? ''}
                                        onChange={e => {
                                            const value = e.target.value
                                            setAutoDrafts(prev => ({ ...prev, [email.id]: value }))
                                        }}
                                        className="font-body-lg text-body-lg text-on-surface bg-surface border border-outline-variant/50 rounded-lg p-4 flex-1 min-h-[120px] leading-relaxed resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                <div className="p-stack-md border-t border-outline-variant/50 flex justify-between items-center gap-2">
                                    <button
                                        onClick={() => onReviewEdit(email)}
                                        className="flex-1 py-2 px-3 border border-outline-variant text-secondary rounded-lg font-label-md text-label-md hover:bg-surface-container transition-colors flex justify-center items-center gap-2"
                                    >
                                        <Edit2 size={14} /> Review &amp; Edit
                                    </button>
                                    <button
                                        onClick={() => handleRegenerate(email)}
                                        disabled={isRegenerating}
                                        className="flex-1 py-2 px-3 border border-outline-variant text-secondary rounded-lg font-label-md text-label-md hover:bg-surface-container transition-colors flex justify-center items-center gap-2 disabled:opacity-60"
                                    >
                                        {isRegenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                        Regenerate
                                    </button>
                                    <button
                                        onClick={() => onSendNow(email)}
                                        className="flex-[1.5] py-2 px-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors flex justify-center items-center gap-2 shadow-sm"
                                    >
                                        <Send size={14} /> Send Now
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
