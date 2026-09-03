import { Inbox, BarChart2, FileEdit, LogOut, Sparkles, PenSquare, Zap } from 'lucide-react'
import ClaroLogo from './ClaroLogo'

type View = 'inbox' | 'priority' | 'analytics' | 'drafts'

type Props = {
    view: View
    setView: (v: View) => void
    onCompose: () => void
    onLogout: () => void
    draftsCount: number
    correctionsCount: number
    autoSendEnabled: boolean
    onToggleAutoSend: () => void
}

const NAV_ITEMS: { key: View; label: string; icon: typeof Inbox }[] = [
    { key: 'inbox', label: 'Inbox', icon: Inbox },
    { key: 'analytics', label: 'Analytics', icon: BarChart2 },
    { key: 'drafts', label: 'Drafts', icon: FileEdit },
]

export default function Sidebar({ view, setView, onCompose, onLogout, draftsCount, correctionsCount, autoSendEnabled, onToggleAutoSend }: Props) {
    return (
        <aside className="hidden md:flex flex-col h-full py-stack-lg bg-surface-container-lowest border-r border-outline-variant w-64 shrink-0">
            <div className="px-gutter mb-stack-lg">
                <div className="flex items-center gap-stack-sm mb-stack-md">
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary shrink-0">
                        <ClaroLogo size={17} />
                    </div>
                    <div>
                        <h1 className="font-headline-md text-headline-md font-bold text-primary">Claro AI</h1>
                        <p className="font-label-md text-label-md text-secondary">Priority Assistant</p>
                    </div>
                </div>
                <button
                    onClick={onCompose}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-2.5 px-4 rounded-full font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors shadow-sm"
                >
                    <PenSquare size={15} />
                    Compose with AI
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-stack-sm space-y-1">
                {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
                    const active = view === key || (key === 'inbox' && view === 'priority')
                    const badge = key === 'drafts' ? draftsCount : 0
                    return (
                        <button
                            key={key}
                            onClick={() => setView(key)}
                            className={`w-full flex items-center gap-stack-sm px-4 py-2.5 rounded-full font-label-md text-label-md transition-colors ${
                                active
                                    ? 'text-primary font-bold bg-surface-container-high border-r-4 border-primary'
                                    : 'text-secondary hover:bg-surface-container'
                            }`}
                        >
                            <Icon size={18} />
                            <span>{label}</span>
                            {badge > 0 && (
                                <span className="ml-auto bg-primary text-on-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                    {badge}
                                </span>
                            )}
                        </button>
                    )
                })}
            </nav>

            <div className="px-stack-sm mt-auto pt-stack-md border-t border-outline-variant space-y-1">
                <button
                    onClick={onToggleAutoSend}
                    title={autoSendEnabled
                        ? 'Auto-send is ON — flagged replies send immediately with no review'
                        : 'Auto-send is off — replies are drafted for your review'}
                    className="w-full flex items-center gap-stack-sm px-4 py-2 rounded-lg hover:bg-surface-container transition-colors"
                >
                    <Zap size={15} className={autoSendEnabled ? 'text-primary' : 'text-secondary'} />
                    <span className="font-label-md text-label-md text-secondary flex-1 text-left">Auto-send replies</span>
                    <span
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
                            autoSendEnabled ? 'bg-primary' : 'bg-surface-container-high'
                        }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-surface-container-lowest shadow-sm transition-transform ${
                                autoSendEnabled ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                        />
                    </span>
                </button>
                {autoSendEnabled && (
                    <p className="px-4 font-label-sm text-label-sm text-error leading-snug">
                        Replies to flagged emails send instantly — no confirmation step.
                    </p>
                )}
                {correctionsCount > 0 && (
                    <div className="flex items-center gap-stack-sm px-4 py-2 font-label-sm text-label-sm text-secondary">
                        <Sparkles size={14} className="text-primary" />
                        <span>{correctionsCount} corrections learned</span>
                    </div>
                )}
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-stack-sm px-4 py-2 rounded-full text-secondary hover:bg-error-container hover:text-on-error-container transition-colors font-label-md text-label-md"
                >
                    <LogOut size={16} />
                    <span>Log Out</span>
                </button>
            </div>
        </aside>
    )
}
