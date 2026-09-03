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
            <div className="modal-backdrop absolute inset-0" onClick={() => !sending && onClose()} />
            <div className="relative w-full max-w-md glass-panel rounded-2xl overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--glass-border)' }}>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                            <Send size={13} style={{ color: 'var(--accent-light)' }} />
                        </div>
                        <h3 className="text-sm font-semibold">Confirm before sending</h3>
                    </div>
                    {!sending && (
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                            <X size={15} style={{ color: 'var(--text-tertiary)' }} />
                        </button>
                    )}
                </div>

                <div className="px-5 py-4 flex flex-col gap-3">
                    <div className="flex items-start gap-2 glass-card-flat p-3" style={{ background: 'rgba(234,179,8,0.06)', borderColor: 'rgba(234,179,8,0.2)' }}>
                        <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-[11px] leading-relaxed text-amber-200/90">
                            This will send a real email from your Gmail account. Review carefully — this action can't be undone.
                        </p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>To</span>
                        <span className="text-xs font-medium">{toEmail}</span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Subject</span>
                        <span className="text-xs font-medium">{subject}</span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Message</span>
                        <div className="glass-card-flat p-3 max-h-40 overflow-y-auto">
                            <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{body}</p>
                        </div>
                    </div>

                    {error && <p className="text-[11px] text-red-400">{error}</p>}
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                    <button
                        onClick={onClose}
                        disabled={sending}
                        className="px-4 py-2 text-xs font-medium rounded-lg glass-card-flat hover:bg-white/5 transition-colors disabled:opacity-50"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={sending}
                        className="btn-gradient px-4 py-2 text-xs font-medium rounded-lg text-white flex items-center gap-1.5 disabled:opacity-70"
                    >
                        {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        {sending ? 'Sending…' : 'Confirm & Send'}
                    </button>
                </div>
            </div>
        </div>
    )
}
