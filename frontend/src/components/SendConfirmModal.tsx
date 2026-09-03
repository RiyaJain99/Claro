import { useEffect } from 'react'
import { Send, X, Loader2, AlertTriangle } from 'lucide-react'

type Props = {
    open: boolean
    toEmail: string
    subject: string
    body: string
    sending: boolean
    error: string
    onConfirm: () => void
    onClose: () => void
}

/**
 * SEND CONFIRMATION MODAL — the human-in-the-loop safety gate.
 *
 * This is the last checkpoint before an AI-drafted email actually leaves
 * the user's inbox under their name. It always shows the exact recipient,
 * subject, and final body text - no surprises, no silent auto-send.
 *
 * Interview talking point: this is the same "confirm irreversible action"
 * pattern used in production tools (Stripe payouts, CI/CD deploy gates,
 * email/CRM send flows) - the AI proposes, the human disposes.
 */
export default function SendConfirmModal({ open, toEmail, subject, body, sending, error, onConfirm, onClose }: Props) {
    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !sending) onClose()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [open, sending, onClose])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-on-surface/40" onClick={() => !sending && onClose()} />
            <div className="relative w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary-container flex items-center justify-center">
                            <Send size={13} className="text-on-primary-container" />
                        </div>
                        <h3 className="font-headline-sm text-headline-sm text-on-surface">Confirm before sending</h3>
                    </div>
                    {!sending && (
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container transition-colors">
                            <X size={15} className="text-secondary" />
                        </button>
                    )}
                </div>

                <div className="px-5 py-4 flex flex-col gap-3">
                    <div className="flex items-start gap-2 bg-error-container/40 border border-error/20 rounded-lg p-3">
                        <AlertTriangle size={14} className="text-error mt-0.5 shrink-0" />
                        <p className="font-label-sm text-label-sm leading-relaxed text-on-error-container">
                            This will send a real email from your Gmail account. Review carefully — this action can't be undone.
                        </p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="font-label-sm text-label-sm uppercase tracking-wide text-secondary">To</span>
                        <span className="font-body-md text-body-md font-medium text-on-surface">{toEmail}</span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="font-label-sm text-label-sm uppercase tracking-wide text-secondary">Subject</span>
                        <span className="font-body-md text-body-md font-medium text-on-surface">{subject}</span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="font-label-sm text-label-sm uppercase tracking-wide text-secondary">Message</span>
                        <div className="bg-surface-container-low border border-outline-variant/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                            <p className="font-body-md text-body-md leading-relaxed whitespace-pre-wrap text-on-surface-variant">{body}</p>
                        </div>
                    </div>

                    {error && <p className="font-label-sm text-label-sm text-error">{error}</p>}
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-outline-variant">
                    <button
                        onClick={onClose}
                        disabled={sending}
                        className="px-4 py-2 font-label-md text-label-md rounded-lg border border-outline-variant text-secondary hover:bg-surface-container transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={sending}
                        className="px-4 py-2 font-label-md text-label-md rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors flex items-center gap-1.5 disabled:opacity-70"
                    >
                        {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        {sending ? 'Sending…' : 'Confirm & Send'}
                    </button>
                </div>
            </div>
        </div>
    )
}
