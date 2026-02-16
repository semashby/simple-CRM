// Database types matching supabase/schema.sql

export type ContactStatus =
    | "new"
    | "contacted"
    | "meeting_scheduled"
    | "proposal_sent"
    | "negotiation"
    | "client"
    | "lost";

export type ActivityType =
    | "call"
    | "email"
    | "meeting"
    | "note"
    | "status_change";

export interface Project {
    id: string;
    name: string;
    description: string | null;
    created_by: string | null;
    created_at: string;
}

export interface Contact {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    function: string | null;
    company_name: string | null;
    branch: string | null;
    linkedin_url: string | null;
    website: string | null;
    location: string | null;
    project_id: string | null;
    source: string;
    status: ContactStatus;
    assigned_to: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface Note {
    id: string;
    contact_id: string;
    content: string;
    created_by: string | null;
    created_at: string;
}

export interface Activity {
    id: string;
    contact_id: string;
    type: ActivityType;
    description: string | null;
    created_by: string | null;
    created_at: string;
}

export interface Reminder {
    id: string;
    contact_id: string;
    assigned_to: string | null;
    due_date: string;
    title: string;
    is_done: boolean;
    created_at: string;
}

// Status display config
export const STATUS_CONFIG: Record<
    ContactStatus,
    { label: string; color: string }
> = {
    new: { label: "New", color: "bg-blue-100 text-blue-800" },
    contacted: { label: "Contacted", color: "bg-yellow-100 text-yellow-800" },
    meeting_scheduled: {
        label: "Meeting",
        color: "bg-purple-100 text-purple-800",
    },
    proposal_sent: {
        label: "Proposal",
        color: "bg-orange-100 text-orange-800",
    },
    negotiation: {
        label: "Negotiation",
        color: "bg-pink-100 text-pink-800",
    },
    client: { label: "Client", color: "bg-green-100 text-green-800" },
    lost: { label: "Lost", color: "bg-slate-100 text-slate-500" },
};
