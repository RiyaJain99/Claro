const BASE = '';

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
}

export const api = {
    getAuthStatus: () => req<{ authenticated: boolean }>('/auth/status'),
    logout: () => req('/auth/logout', { method: 'POST' }),
    getEmails: (limit = 20, refresh = false) => req<any[]>(`/emails?max_results=${limit}&refresh=${refresh}`),
    classifyEmail: (id: string, subject: string, sender: string, snippet: string, body: string) =>
        req(`/emails/classify`, {
            method: 'POST',
            body: JSON.stringify({ email_id: id, subject, sender, snippet, body }),
        }),
    generateDraft: (id: string, subject: string, sender: string, body: string, instructions?: string) =>
        req(`/emails/draft-reply`, {
            method: 'POST',
            body: JSON.stringify({ email_id: id, subject, sender, body, instructions }),
        }),
    getDrafts: (id: string) => req(`/emails/drafts/${id}`),
    getAnalytics: () => req('/emails/analytics'),
    createGmailDraft: (toEmail: string, subject: string, bodyText: string, threadId?: string) =>
        req<{ status: string; draft_id: string }>('/emails/create-draft', {
            method: 'POST',
            body: JSON.stringify({ to_email: toEmail, subject, body_text: bodyText, thread_id: threadId }),
        }),
    sendReply: (toEmail: string, subject: string, bodyText: string, threadId?: string) =>
        req<{ status: string; message_id: string }>('/emails/send', {
            method: 'POST',
            body: JSON.stringify({ to_email: toEmail, subject, body_text: bodyText, thread_id: threadId }),
        }),
    submitFeedback: (
        emailId: string,
        subject: string,
        sender: string,
        snippet: string,
        originalCategory: string,
        correctedCategory: string,
        originalPriority?: string,
        correctedPriority?: string,
    ) =>
        req('/emails/feedback', {
            method: 'POST',
            body: JSON.stringify({
                email_id: emailId,
                subject,
                sender,
                snippet,
                original_category: originalCategory,
                corrected_category: correctedCategory,
                original_priority: originalPriority || '',
                corrected_priority: correctedPriority || '',
            }),
        }),
    getFeedbackStats: () => req<{ total_corrections: number }>('/emails/feedback/stats'),
};
