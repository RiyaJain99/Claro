import { useEffect, useRef, useState } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
import { api } from '../api/client'

type Props = {
  open: boolean
  onClose: () => void
  onSent?: () => void
}

export default function ComposeModal({ open, onClose, onSent }: Props) {
  const toRef = useRef<HTMLInputElement | null>(null)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    toRef.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, sending])

  useEffect(() => {
    if (!open) {
      setTo('')
      setSubject('')
      setBody('')
      setError('')
    }
  }, [open])

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError('Please fill in To, Subject, and Message.')
      return
    }
    setSending(true)
    setError('')
    try {
      await api.sendReply(to.trim(), subject.trim(), body.trim())
      onSent?.()
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Failed to send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-on-surface/40" onClick={() => !sending && onClose()} />
      <div className="relative w-full max-w-2xl bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">New Message</h3>
          {!sending && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container transition-colors">
              <X size={15} className="text-secondary" />
            </button>
          )}
        </div>
        <div className="p-5 flex flex-col gap-3">
          <input
            ref={toRef}
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="To"
            disabled={sending}
            className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject"
            disabled={sending}
            className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your message..."
            rows={8}
            disabled={sending}
            className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low font-body-md text-body-md text-on-surface resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          {error && <p className="font-label-sm text-label-sm text-error">{error}</p>}
        </div>
        <div className="flex items-center justify-end px-5 py-4 border-t border-outline-variant gap-2">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 font-label-md text-label-md rounded-lg border border-outline-variant text-secondary hover:bg-surface-container transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2 font-label-md text-label-md rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors flex items-center gap-1.5 disabled:opacity-70"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
