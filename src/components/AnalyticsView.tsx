import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'

type Props = {
    totalEmails: number
    classifiedCount: number
    highPriority: number
    mediumPriority: number
    lowPriority: number
    needsReply: number
    categories: Record<string, number>
    correctionsCount: number
}

// Brand-consistent indigo/violet palette, cycled across category slices
const DONUT_COLORS = [
    '#6366f1', '#818cf8', '#a78bfa', '#c084fc',
    '#f472b6', '#fb923c', '#fbbf24', '#34d399',
    '#22d3ee', '#60a5fa',
]

function GlassTooltip({ active, payload }: any) {
    if (!active || !payload || !payload.length) return null
    const entry = payload[0]
    return (
        <div className="glass-panel rounded-lg px-3 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>
            <span className="font-semibold">{entry.name}</span>
            <span style={{ color: 'var(--text-tertiary)' }}> · {entry.value}</span>
        </div>
    )
}

export default function AnalyticsView({
    totalEmails,
    classifiedCount,
    highPriority,
    mediumPriority,
    lowPriority,
    needsReply,
    categories,
    correctionsCount,
}: Props) {
    const categoryData = Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }))

    const priorityData = [
        { name: 'High', value: highPriority, color: '#f87171' },
        { name: 'Medium', value: mediumPriority, color: '#fbbf24' },
        { name: 'Low', value: lowPriority, color: '#71717a' },
    ]

    const hasData = classifiedCount > 0

    return (
        <div className="flex-1 overflow-y-auto glass-panel rounded-2xl p-8">
            <h2 className="text-lg font-bold mb-1">Analytics</h2>
            <p className="text-xs mb-6" style={{ color: 'var(--text-tertiary)' }}>
                {correctionsCount > 0 ? `AI has learned from ${correctionsCount} of your corrections` : 'Insights from your classified inbox'}
            </p>

            {/* Stat row */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total Emails', value: totalEmails },
                    { label: 'Classified', value: classifiedCount },
                    { label: 'High Priority', value: highPriority },
                    { label: 'Needs Reply', value: needsReply },
                ].map(s => (
                    <div key={s.label} className="glass-card p-4">
                        <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{s.label}</p>
                        <p className="text-2xl font-bold">{s.value}</p>
                    </div>
                ))}
            </div>

            {!hasData ? (
                <div className="glass-card p-10 flex flex-col items-center justify-center text-center">
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        Classify some emails to see your inbox breakdown
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                    {/* Donut: category distribution */}
                    <div className="lg:col-span-3 glass-card p-6">
                        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
                            Category Distribution
                        </h3>
                        <div className="flex items-center gap-6">
                            <div style={{ width: 180, height: 180 }} className="shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={categoryData}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={55}
                                            outerRadius={85}
                                            paddingAngle={2}
                                            stroke="none"
                                        >
                                            {categoryData.map((_, i) => (
                                                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<GlassTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex-1 flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                                {categoryData.map((c, i) => (
                                    <div key={c.name} className="flex items-center gap-2">
                                        <span
                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                            style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                                        />
                                        <span className="text-xs truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
                                        <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{c.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Bar: priority breakdown */}
                    <div className="lg:col-span-2 glass-card p-6">
                        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
                            Priority Breakdown
                        </h3>
                        <div style={{ width: '100%', height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={priorityData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={56}
                                        tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                                        {priorityData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
