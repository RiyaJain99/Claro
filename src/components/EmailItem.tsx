import { Reply } from 'lucide-react'
import type { Email } from '../types'

type Props = {
  email: Email
  selected: boolean
  isClassifying?: boolean
  hasDraft?: boolean
  onSelect: (e: Email) => void
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const AVATAR_GRADIENTS = [
  'from-indigo-500 to-purple-500',
  'from-blue-500 to-cyan-500',
  'from-pink-500 to-rose-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
  'from-violet-500 to-fuchsia-500',
]

function gradientFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

const PRIORITY_STYLE: Record<string, string> = {
  High: 'text-red-300 bg-red-500/15 border border-red-500/20',
  Medium: 'text-amber-300 bg-amber-500/15 border border-amber-500/20',
  Low: 'text-zinc-400 bg-white/5 border border-white/10',
}

export default function EmailItem({ email, selected, isClassifying, hasDraft, onSelect }: Props) {
  const sender = email.sender.split('<')[0].trim()
  return (
    <div
      onClick={() => onSelect(email)}
      className={`email-row px-3 py-3 flex items-start gap-3 ${selected ? 'selected' : ''}`}
    >
      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradientFor(sender)} flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-md`}>
        {initials(sender)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-0.5">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold truncate max-w-[130px]" style={{ color: 'var(--text-primary)' }}>{sender}</span>
            {hasDraft && (
              <span title="Reply draft ready" className="shrink-0 text-emerald-400">
                <Reply size={11} />
              </span>
            )}
          </span>
          <span className="text-[10px] shrink-0 ml-2" style={{ color: 'var(--text-tertiary)' }}>{email.date}</span>
        </div>
        <p className="text-xs truncate mb-0.5 font-medium" style={{ color: 'var(--text-primary)' }}>{email.subject}</p>
        <div className="flex items-center gap-2">
          <p className="text-[11px] truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{email.snippet}</p>
          {isClassifying ? (
            <span className="badge-soft shrink-0 text-indigo-300 bg-indigo-500/15 border border-indigo-500/20 animate-pulse">
              Analyzing…
            </span>
          ) : email.classification && (
            <span className={`badge-soft shrink-0 ${PRIORITY_STYLE[email.classification.priority] ?? PRIORITY_STYLE.Low}`}>
              {email.classification.priority}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
