import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
}

export default function ComposeModal({ open, onClose }: Props) {
  const toRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    toRef.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">New Message</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={16} className="text-zinc-700 dark:text-zinc-200" />
          </button>
        </div>
        <div className="p-4">
          <input ref={toRef} placeholder="To" className="w-full mb-3 px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent" />
          <input placeholder="Subject" className="w-full mb-3 px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent" />
          <textarea placeholder="Write your message..." rows={8} className="w-full px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent" />
        </div>
        <div className="flex items-center justify-end px-4 py-3 border-t border-zinc-200 dark:border-zinc-700 gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800">Cancel</button>
          <button className="px-3 py-1 rounded-md bg-blue-600 text-white">Send</button>
        </div>
      </div>
    </div>
  )
}
