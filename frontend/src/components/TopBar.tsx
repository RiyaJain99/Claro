import { Search, RefreshCw, Bell, Sun, Moon, User } from 'lucide-react'

type View = 'inbox' | 'priority' | 'analytics' | 'drafts'

type Props = {
    search: string
    setSearch: (s: string) => void
    onRefresh: () => void
    view: View
    setView: (v: View) => void
    unclassifiedCount: number
    onClassifyUnclassified: () => void
    classifying: boolean
    onToggleTheme: () => void
    theme: 'light' | 'dark'
}

export default function TopBar({ search, setSearch, onRefresh, view, setView, unclassifiedCount, onClassifyUnclassified, classifying, onToggleTheme, theme }: Props) {
    return (
        <header className="hidden md:flex justify-between items-center px-margin-desktop w-full h-16 border-b border-outline-variant bg-surface-container-lowest shrink-0">
            <div className="flex items-center gap-gutter">
                <div className="relative max-w-md w-64">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-1.5 bg-surface-container-low border border-outline-variant rounded-full font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        placeholder="Search emails, sender, subject..."
                    />
                </div>
                <nav className="flex gap-stack-md">
                    <button
                        onClick={() => setView('priority')}
                        className={`font-headline-sm text-headline-sm pb-1 border-b-2 transition-colors ${
                            view === 'priority' ? 'text-primary font-bold border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'
                        }`}
                    >
                        Priority
                    </button>
                    <button
                        onClick={() => setView('inbox')}
                        className={`font-headline-sm text-headline-sm pb-1 border-b-2 transition-colors ${
                            view === 'inbox' ? 'text-primary font-bold border-primary' : 'text-on-surface-variant border-transparent hover:text-primary'
                        }`}
                    >
                        Recent
                    </button>
                </nav>
            </div>
            <div className="flex items-center gap-stack-md">
                <button
                    onClick={onRefresh}
                    className="hidden lg:flex items-center gap-2 px-4 py-1.5 rounded-full border border-outline-variant text-secondary font-label-md text-label-md hover:bg-surface-container transition-colors"
                >
                    <RefreshCw size={15} />
                    Sync Email
                </button>
                <button
                    onClick={onToggleTheme}
                    className="p-2 text-secondary hover:bg-surface-container rounded-full transition-colors"
                    aria-label="Toggle theme"
                >
                    {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                </button>
                <button
                    onClick={onClassifyUnclassified}
                    disabled={unclassifiedCount === 0 || classifying}
                    className="p-2 text-secondary hover:bg-surface-container rounded-full transition-colors relative disabled:opacity-40 disabled:hover:bg-transparent"
                    title={unclassifiedCount > 0 ? `${unclassifiedCount} unclassified — click to classify` : 'All caught up'}
                >
                    <Bell size={18} className={classifying ? 'animate-pulse' : ''} />
                    {unclassifiedCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />
                    )}
                </button>
                <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-secondary">
                    <User size={16} />
                </div>
            </div>
        </header>
    )
}
