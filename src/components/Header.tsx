import { Search, User, SunMoon, Plus, Moon, RefreshCw } from 'lucide-react'
import ClaroLogo from './ClaroLogo'

type Props = {
  search: string
  setSearch: (s: string) => void
  onRefresh: () => void
  onCompose?: () => void
  onToggleTheme?: () => void
  theme?: 'light' | 'dark'
}

export default function Header({ search, setSearch, onRefresh, onCompose, onToggleTheme, theme }: Props) {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg logo-glow flex items-center justify-center text-white">
            <ClaroLogo size={16} />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Claro</div>
            <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Your smart inbox</div>
          </div>
        </div>

        <div className="flex items-center flex-1 max-w-2xl mx-4">
          <div className="glass-card-flat flex items-center gap-3 px-3 py-2 w-full">
            <Search size={15} style={{ color: 'var(--text-tertiary)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search mail, sender, subject..."
              className="bg-transparent outline-none text-sm w-full"
              style={{ color: 'var(--text-primary)' }}
            />
            <button onClick={onRefresh} className="shrink-0 p-1.5 rounded-md hover:bg-white/10 transition-colors" style={{ color: 'var(--text-tertiary)' }} aria-label="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={onCompose} className="btn-gradient flex items-center gap-1.5 text-white text-xs font-semibold px-3.5 py-2 rounded-lg">
            <Plus size={14} />
            Compose
          </button>
          <button onClick={onToggleTheme} className="p-2 rounded-lg glass-card-flat hover:bg-white/5 transition-colors" aria-label="Toggle theme">
            {theme === 'dark' ? <Moon size={15} style={{ color: 'var(--text-secondary)' }} /> : <SunMoon size={15} style={{ color: 'var(--text-secondary)' }} />}
          </button>
          <div className="w-8 h-8 rounded-full glass-card-flat flex items-center justify-center">
            <User size={14} style={{ color: 'var(--text-tertiary)' }} />
          </div>
        </div>
      </div>
    </header>
  )
}
