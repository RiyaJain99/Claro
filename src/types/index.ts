export interface Classification {
    category: string;
    priority: 'High' | 'Medium' | 'Low';
    confidence: number;
    summary: string;
    suggestion: string;
    requires_reply: boolean;
    follow_up_needed: boolean;
}

export interface Email {
    id: string;
    threadId: string;
    subject: string;
    sender: string;
    recipient: string;
    date: string;
    snippet: string;
    body: string;
    fetched_at: string;
    classification: Classification | null;
}

export interface Draft {
    id: string;
    email_id: string;
    draft_text: string;
    created_at: string;
    was_sent: boolean;
}

export interface Analytics {
    total_emails: number;
    total_classified: number;
    total_drafts: number;
    category_distribution: Record<string, number>;
    priority_distribution: { High: number; Medium: number; Low: number };
    requires_reply_count: number;
    follow_up_count: number;
    avg_confidence: number;
}

export interface AuthStatus {
    authenticated: boolean;
}
