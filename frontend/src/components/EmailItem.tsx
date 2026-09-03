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

const PRIORITY_STYLE: Record<string, string> = {
  High: 'text-error bg-error-container',
  Medium: 'text-on-secondary-container bg-secondary-container',
  Low: 'text-on-surface-variant bg-surface-container',
}

export default function EmailItem({ email, selected, isClassifying, hasDraft, onSelect }: Props) {
  const sender = email.sender.split('<')[0].trim()
  const isHigh = email.classification?.priority === 'High'

  return (
    <div
      onClick={() => onSelect(email)}
      className={`py-stack-sm pr-stack-md flex items-start gap-stack-sm cursor-pointer transition-colors border-b border-l-4 border-outline-variant/40 dark:border-outline/20 ${
        selected
          ? 'bg-surface-container-lowest border-l-primary pl-3'
          : isHigh
          ? 'bg-surface-container-lowest border-l-error pl-3 hover:bg-surface-container-low'
          : 'border-l-transparent pl-4 hover:bg-surface-container-low'
      }`}
    >
      <div className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-[10px] font-bold shrink-0">
        {initials(sender)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-0.5">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="font-label-md text-label-md font-bold text-on-surface truncate max-w-[130px]">{sender}</span>
            {hasDraft && (
              <span title="Reply draft ready" className="shrink-0 text-primary">
                <Reply size={11} />
              </span>
            )}
          </span>
          <span className="font-label-sm text-label-sm text-secondary shrink-0 ml-2">{email.date}</span>
        </div>
        <p className="font-body-md text-body-md text-on-surface truncate mb-0.5 font-semibold">{email.subject}</p>
        <div className="flex items-center gap-2">
          <p className="font-body-md text-body-md text-secondary truncate flex-1">{email.snippet}</p>
          {isClassifying ? (
            <span className="shrink-0 font-label-sm text-label-sm px-2 py-0.5 rounded text-primary bg-surface-container-high animate-pulse">
              Analyzing…
            </span>
          ) : email.classification && (
            <span className={`shrink-0 font-label-sm text-label-sm px-2 py-0.5 rounded ${PRIORITY_STYLE[email.classification.priority] ?? PRIORITY_STYLE.Low}`}>
              {email.classification.priority}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
