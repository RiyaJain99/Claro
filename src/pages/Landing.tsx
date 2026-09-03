import { Sparkles, Zap, Shield, Home, Mail as MailIcon, ShieldCheck, User, Briefcase, GraduationCap } from 'lucide-react'
import ClaroLogo from '../components/ClaroLogo'

const stackCards = [
    {
        icon: <Briefcase size={14} />,
        category: 'Job Application',
        priority: 'High',
        subject: 'Interview confirmation for the Lead Designer position…',
        sender: 'recruitment@future.io',
        date: '',
        priorityClass: 'bg-red-500/15 text-red-300 border border-red-500/20',
    },
    {
        icon: <GraduationCap size={14} />,
        category: 'Academic',
        priority: 'Medium',
        subject: 'Assignment feedback regarding your thesis proposal…',
        sender: 'prof.smith@university.edu',
        date: '',
        priorityClass: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20',
    },
]

const features = [
    { icon: <Sparkles size={18} />, label: 'AI Classification', desc: '18 categories' },
    { icon: <Zap size={18} />, label: 'Smart Replies', desc: 'One-click drafts' },
    { icon: <Shield size={18} />, label: 'Private', desc: 'Stored locally' },
]

const navItems = [
    { icon: <Home size={20} />, label: 'Home', active: true },
    { icon: <MailIcon size={20} />, label: 'Inbox', active: false },
    { icon: <ShieldCheck size={20} />, label: 'Shield', active: false },
    { icon: <User size={20} />, label: 'Account', active: false },
]

function GoogleIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    )
}

export default function Landing() {
    return (
        <div className="relative min-h-screen flex flex-col" style={{ color: 'var(--text-primary)' }}>
            <div className="mesh-gradient" />

            {/* Sticky top nav */}
            <header className="sticky top-0 z-40 glass-panel">
                <div className="max-w-md md:max-w-5xl mx-auto flex items-center justify-between px-5 h-16">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg logo-glow flex items-center justify-center text-white">
                            <ClaroLogo size={14} />
                        </div>
                        <span className="font-bold tracking-tight text-sm">Claro</span>
                        <span className="text-xs opacity-50 ml-1 hidden sm:inline" style={{ color: 'var(--text-tertiary)' }}>AI Email Agent</span>
                    </div>
                </div>
            </header>

            <main className="relative z-10 flex-1 max-w-md md:max-w-5xl mx-auto w-full px-6 py-12 md:py-20 flex flex-col md:flex-row md:items-center md:gap-16">

                {/* Hero column */}
                <section className="text-center md:text-left flex flex-col items-center md:items-start max-w-md md:max-w-md mb-14 md:mb-0">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-flat mb-7">
                        <Sparkles size={14} className="text-indigo-400" />
                        <span className="text-[11px] font-medium tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                            Powered by Llama 3.1 · Groq
                        </span>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-bold leading-[1.1] tracking-tight mb-5">
                        Your inbox,
                        <br />
                        <span style={{ color: 'var(--accent-light)' }}>finally clear.</span>
                    </h1>

                    <p className="text-sm md:text-base leading-relaxed mb-9 max-w-sm" style={{ color: 'var(--text-secondary)' }}>
                        Claro connects to Gmail and uses AI to classify, summarize, and draft replies — so you focus on what actually matters.
                    </p>

                    <a
                        href="/auth/login"
                        className="flex items-center justify-center gap-3 w-full max-w-xs py-3.5 px-6 bg-white text-zinc-950 font-bold rounded-xl active:scale-95 transition-transform shadow-lg shadow-white/5 mb-4"
                    >
                        <GoogleIcon />
                        Connect Gmail to get started
                    </a>

                    <p className="text-[10px] uppercase tracking-widest opacity-50" style={{ color: 'var(--text-tertiary)' }}>
                        Read-only access · No emails stored on external servers
                    </p>
                </section>

                {/* Card stack column */}
                <section className="relative w-full max-w-sm mx-auto md:mx-0 h-[280px] md:h-[340px] mb-16 md:mb-0">
                    <div className="absolute top-0 w-full glass-card card-stack-item rounded-2xl p-4 origin-bottom -rotate-6 -translate-x-2.5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full glass-card-flat flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
                                    {stackCards[0].icon}
                                </div>
                                <div>
                                    <p className="text-[11px] font-semibold">{stackCards[0].category}</p>
                                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{stackCards[0].sender}</p>
                                </div>
                            </div>
                            <span className={`badge-soft ${stackCards[0].priorityClass}`}>{stackCards[0].priority}</span>
                        </div>
                        <p className="text-xs truncate opacity-70" style={{ color: 'var(--text-secondary)' }}>{stackCards[0].subject}</p>
                    </div>

                    <div className="absolute top-12 w-full glass-card card-stack-item rounded-2xl p-4 origin-bottom rotate-2 translate-x-1.5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full glass-card-flat flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
                                    {stackCards[1].icon}
                                </div>
                                <div>
                                    <p className="text-[11px] font-semibold">{stackCards[1].category}</p>
                                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{stackCards[1].sender}</p>
                                </div>
                            </div>
                            <span className={`badge-soft ${stackCards[1].priorityClass}`}>{stackCards[1].priority}</span>
                        </div>
                        <p className="text-xs truncate opacity-70" style={{ color: 'var(--text-secondary)' }}>{stackCards[1].subject}</p>
                    </div>

                    <div className="absolute top-24 w-full glass-card card-stack-item glow-primary rounded-2xl p-5" style={{ borderColor: 'rgba(99,102,241,0.25)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(99,102,241,0.12)' }}>
                                <Zap size={14} className="text-indigo-400" />
                                <span className="text-[11px] font-semibold" style={{ color: 'var(--accent-light)' }}>Requires Reply</span>
                            </div>
                            <span className="text-red-400 font-bold text-[10px] uppercase tracking-tighter">High</span>
                        </div>
                        <h3 className="text-sm font-bold mb-1.5">Follow-up: Q4 budget review — ple…</h3>
                        <div className="flex items-center gap-2 opacity-80 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                            <span>sarah.c@nexus-corp.com</span>
                            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--text-tertiary)' }} />
                            <span>Jun 17</span>
                        </div>
                    </div>
                </section>
            </main>

            {/* Feature bento */}
            <section className="relative z-10 max-w-md md:max-w-5xl mx-auto w-full px-6 pb-28 md:pb-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {features.map(f => (
                        <div key={f.label} className="glass-card p-6 rounded-2xl hover:bg-white/[0.05] transition-colors group">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-light)' }}>
                                {f.icon}
                            </div>
                            <h4 className="font-bold text-sm mb-1">{f.label}</h4>
                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
                <p className="text-[11px] text-center md:text-left mt-10 opacity-40" style={{ color: 'var(--text-tertiary)' }}>
                    Built with FastAPI · Groq · Gmail API
                </p>
            </section>

            {/* Mobile-only bottom nav, matches reference */}
            <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 glass-panel rounded-t-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.4)]">
                {navItems.map(item => (
                    <button
                        key={item.label}
                        className={`flex flex-col items-center justify-center rounded-xl p-2 active:scale-90 duration-200 ${item.active ? '' : 'hover:bg-white/5'}`}
                        style={item.active
                            ? { background: 'rgba(99,102,241,0.15)', color: 'var(--accent-light)' }
                            : { color: 'var(--text-tertiary)' }}
                    >
                        {item.icon}
                        <span className="text-[10px] font-medium mt-1">{item.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    )
}
