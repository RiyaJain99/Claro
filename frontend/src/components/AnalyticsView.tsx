import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { api } from '../api/client'
import type { Analytics } from '../types'

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

const DONUT_COLORS = [
    '#0425be', '#2e44d4', '#5a6cf0', '#8590f5',
    '#375ea6', '#54647a', '#757686', '#a8adc4',
    '#3c4042', '#6b6f72',
]

function GlassTooltip({ active, payload }: any) {
    if (!active || !payload || !payload.length) return null
    const entry = payload[0]
    return (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md shadow-md text-on-surface">
            <span className="font-semibold">{entry.name}</span>
            <span className="text-secondary"> · {entry.value}</span>
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
    const [backend, setBackend] = useState<Analytics | null>(null)

    useEffect(() => {
        api.getAnalytics()
            .then(setBackend)
            .catch(() => setBackend(null))
    }, [correctionsCount, classifiedCount])

    const total = backend?.total_emails ?? totalEmails
    const classified = backend?.total_classified ?? classifiedCount
    const high = backend?.priority_distribution?.High ?? highPriority
    const medium = backend?.priority_distribution?.Medium ?? mediumPriority
    const low = backend?.priority_distribution?.Low ?? lowPriority
    const replyCount = backend?.requires_reply_count ?? needsReply
    const followUp = backend?.follow_up_count ?? 0
    const avgConfidence = backend?.avg_confidence ?? 0
    const categoryData = Object.entries(backend?.category_distribution ?? categories)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }))

    const priorityData = [
        { name: 'High', value: high, color: '#ba1a1a' },
        { name: 'Medium', value: medium, color: '#54647a' },
        { name: 'Low', value: low, color: '#a8adc4' },
    ]

    const hasData = classified > 0

    return (
        <div className="flex-1 overflow-y-auto bg-background p-margin-desktop">
            <h2 className="font-display-lg text-display-lg text-on-surface mb-2">Analytics</h2>
            <p className="font-body-lg text-body-lg text-secondary mb-stack-lg">
                {correctionsCount > 0
                    ? `AI has learned from ${correctionsCount} of your corrections`
                    : 'Insights from your classified inbox'}
                {avgConfidence > 0 && ` · Avg confidence ${Math.round(avgConfidence * 100)}%`}
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-stack-md mb-stack-lg">
                {[
                    { label: 'Total Emails', value: total },
                    { label: 'Classified', value: classified },
                    { label: 'High Priority', value: high },
                    { label: 'Needs Reply', value: replyCount },
                    { label: 'Follow Up', value: followUp },
                ].map(s => (
                    <div key={s.label} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-md">
                        <p className="font-label-sm text-label-sm text-secondary mb-1 uppercase tracking-wide">{s.label}</p>
                        <p className="font-headline-md text-headline-md text-on-surface">{s.value}</p>
                    </div>
                ))}
            </div>

            {!hasData ? (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-10 flex flex-col items-center justify-center text-center">
                    <p className="font-body-md text-body-md text-secondary">
                        Classify some emails to see your inbox breakdown
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-stack-md">
                    <div className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-lg">
                        <h3 className="font-headline-sm text-headline-sm text-on-surface mb-stack-md">
                            Category Distribution
                        </h3>
                        <div className="flex items-center gap-stack-lg">
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
                                        <span className="font-body-md text-body-md text-on-surface-variant truncate flex-1">{c.name}</span>
                                        <span className="font-label-md text-label-md text-secondary">{c.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-lg">
                        <h3 className="font-headline-sm text-headline-sm text-on-surface mb-stack-md">
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
                                        tick={{ fill: '#505f76', fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(4,37,190,0.05)' }} />
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
