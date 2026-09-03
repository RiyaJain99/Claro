import { useRef } from 'react'
import { Sparkles, Zap, Shield, ArrowRight, Briefcase, GraduationCap } from 'lucide-react'
import ClaroLogo from '../components/ClaroLogo'
import ImageStreamHero from '../components/ImageStreamHero'
import { BRAND_GRADIENT_TILES } from '../lib/gradientTiles'

const stackCards = [
    {
        icon: <Briefcase size={14} />,
        category: 'Job Application',
        priority: 'High',
        subject: 'Interview confirmation for the Lead Designer position…',
        sender: 'recruitment@future.io',
        priorityClass: 'bg-error-container text-on-error-container',
    },
    {
        icon: <GraduationCap size={14} />,
        category: 'Academic',
        priority: 'Medium',
        subject: 'Assignment feedback regarding your thesis proposal…',
        sender: 'prof.smith@university.edu',
        priorityClass: 'bg-secondary-container text-on-secondary-container',
    },
]

const features = [
    { icon: <Sparkles size={20} />, label: 'AI Classification', desc: '18 categories' },
    { icon: <Zap size={20} />, label: 'Smart Replies', desc: 'One-click drafts' },
    { icon: <Shield size={20} />, label: 'Private', desc: 'Stored locally' },
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

/**
 * 3D mouse-tracked tilt for the card stack, applied via direct style
 * mutation on refs (not React state) so it stays smooth at 60fps without
 * re-rendering on every mousemove event.
 */
const CARD_DEPTH = [10, 16, 26] // back to front - front card tilts most

function useTiltCards() {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const cardRefs = useRef<(HTMLDivElement | null)[]>([])
    const restRotation = [-6, 2, 0]

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        const px = (e.clientX - rect.left) / rect.width - 0.5
        const py = (e.clientY - rect.top) / rect.height - 0.5

        cardRefs.current.forEach((card, i) => {
            if (!card) return
            const depth = CARD_DEPTH[i] ?? 12
            const rotateY = px * depth
            const rotateX = -py * depth
            card.style.transform = `perspective(900px) rotate(${restRotation[i]}deg) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
        })
    }

    const handleMouseLeave = () => {
        cardRefs.current.forEach((card, i) => {
            if (!card) return
            card.style.transform = `perspective(900px) rotate(${restRotation[i]}deg) rotateX(0deg) rotateY(0deg)`
        })
    }

    return { containerRef, cardRefs, handleMouseMove, handleMouseLeave }
}

export default function Landing() {
    const { containerRef, cardRefs, handleMouseMove, handleMouseLeave } = useTiltCards()

    return (
        <div className="relative min-h-screen overflow-hidden bg-background text-on-background">
            <ImageStreamHero
                images={BRAND_GRADIENT_TILES}
                cards={7}
                speed={22}
                axis={50}
                className="absolute inset-0 -z-10 opacity-70"
            />

            <header className="absolute top-0 left-0 w-full p-margin-mobile md:p-margin-desktop z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container shadow-sm">
                        <ClaroLogo size={16} />
                    </div>
                    <span className="font-headline-sm text-headline-sm text-on-surface font-bold">Claro</span>
                    <span className="font-body-md text-body-md text-outline">AI Email Agent</span>
                </div>
            </header>

            <main className="relative z-0 min-h-screen flex flex-col justify-center px-margin-mobile md:px-margin-desktop pt-24 pb-12 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter items-center flex-grow">

                    {/* Hero column */}
                    <div className="flex flex-col gap-stack-lg max-w-xl z-10 relative opacity-0 animate-fade-in-up">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-highest border border-outline-variant w-max">
                            <Sparkles size={14} className="text-primary" />
                            <span className="font-label-md text-label-md text-on-surface-variant">Powered by Llama 3.1 · Groq</span>
                        </div>

                        <div className="flex flex-col gap-stack-sm">
                            <h1 className="font-display-lg text-display-lg text-on-surface">
                                Your inbox, <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#7b8cf6]">finally clear.</span>
                            </h1>
                            <p className="font-body-lg text-body-lg text-on-surface-variant mt-4 max-w-lg">
                                Claro connects to Gmail and uses AI to classify, summarize, and draft replies — so you focus on what actually matters.
                            </p>
                        </div>

                        <div className="flex flex-col gap-stack-sm mt-2">
                            <a
                                href="/auth/login"
                                className="bg-surface-container-lowest border border-outline-variant hover:bg-surface-container transition-colors duration-300 rounded-full px-6 py-4 flex items-center justify-center gap-3 w-max font-headline-sm text-headline-sm text-on-surface group shadow-sm"
                            >
                                <GoogleIcon />
                                Connect Gmail to get started
                                <ArrowRight size={18} className="text-outline group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
                            </a>
                            <p className="font-label-sm text-label-sm text-outline tracking-wider uppercase mt-2">
                                Read-only access · No emails stored on external servers
                            </p>
                        </div>
                    </div>

                    {/* Preview column - mouse-tracked 3D tilt card stack */}
                    <div className="relative h-[340px] w-full flex items-center justify-center opacity-0 animate-fade-in" style={{ animationDelay: '200ms' }}>
                        <div
                            ref={containerRef}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                            className="relative w-full max-w-sm h-full"
                            style={{ perspective: '900px' }}
                        >
                            <div
                                ref={el => { cardRefs.current[0] = el }}
                                className="absolute top-0 w-full bg-surface-container-lowest border border-outline-variant shadow-sm rounded-2xl p-4 origin-bottom -rotate-6 -ml-2.5 transition-transform duration-150 ease-out will-change-transform"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary">
                                            {stackCards[0].icon}
                                        </div>
                                        <div>
                                            <p className="font-label-md text-label-md font-semibold text-on-surface">{stackCards[0].category}</p>
                                            <p className="font-label-sm text-label-sm text-outline">{stackCards[0].sender}</p>
                                        </div>
                                    </div>
                                    <span className={`font-label-sm text-label-sm px-2 py-1 rounded-md ${stackCards[0].priorityClass}`}>{stackCards[0].priority}</span>
                                </div>
                                <p className="font-body-md text-body-md text-secondary truncate">{stackCards[0].subject}</p>
                            </div>

                            <div
                                ref={el => { cardRefs.current[1] = el }}
                                className="absolute top-12 w-full bg-surface-container-lowest border border-outline-variant shadow-sm rounded-2xl p-4 origin-bottom rotate-2 ml-1.5 transition-transform duration-150 ease-out will-change-transform"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary">
                                            {stackCards[1].icon}
                                        </div>
                                        <div>
                                            <p className="font-label-md text-label-md font-semibold text-on-surface">{stackCards[1].category}</p>
                                            <p className="font-label-sm text-label-sm text-outline">{stackCards[1].sender}</p>
                                        </div>
                                    </div>
                                    <span className={`font-label-sm text-label-sm px-2 py-1 rounded-md ${stackCards[1].priorityClass}`}>{stackCards[1].priority}</span>
                                </div>
                                <p className="font-body-md text-body-md text-secondary truncate">{stackCards[1].subject}</p>
                            </div>

                            <div
                                ref={el => { cardRefs.current[2] = el }}
                                className="absolute top-24 w-full bg-surface-container-lowest border border-primary/25 shadow-md rounded-2xl p-5 transition-transform duration-150 ease-out will-change-transform"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-primary/10">
                                        <Zap size={14} className="text-primary" />
                                        <span className="font-label-sm text-label-sm font-semibold text-primary">Requires Reply</span>
                                    </div>
                                    <span className="font-label-sm text-label-sm font-bold uppercase tracking-tight text-error">High</span>
                                </div>
                                <h3 className="font-body-md text-body-md font-bold text-on-surface mb-1.5">Follow-up: Q4 budget review — ple…</h3>
                                <div className="flex items-center gap-2 font-label-sm text-label-sm text-outline">
                                    <span>sarah.c@nexus-corp.com</span>
                                    <span className="w-1 h-1 rounded-full bg-outline" />
                                    <span>Jun 17</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feature cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-md w-full mt-auto pt-12 opacity-0 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                    {features.map(f => (
                        <div key={f.label} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-4 hover:bg-surface-container-low transition-colors">
                            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                                {f.icon}
                            </div>
                            <div>
                                <h3 className="font-headline-sm text-headline-sm text-on-surface">{f.label}</h3>
                                <p className="font-body-md text-body-md text-outline mt-1">{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 opacity-0 animate-fade-in text-center md:text-left" style={{ animationDelay: '500ms' }}>
                    <span className="font-label-sm text-label-sm text-outline-variant">Built with FastAPI · Groq · Gmail API</span>
                </div>
            </main>
        </div>
    )
}
