// Database types matching supabase/schema.sql

export type ContactStatus =
    | "new"
    | "contacted"
    | "meeting_scheduled"
    | "client"
    | "lost";

export type ActivityType =
    | "call"
    | "email"
    | "meeting"
    | "note"
    | "status_change"
    | "outcome_logged";

export type CallOutcome =
    | "callback"
    | "callback_priority"
    | "invalid"
    | "meeting_booked"
    | "sale_made";

export type InvalidReason =
    | "wrong_number"
    | "not_interested"
    | "duplicate"
    | "do_not_call"
    | "other";

export interface Project {
    id: string;
    name: string;
    description: string | null;
    created_by: string | null;
    created_at: string;
    status: "active" | "archived";
    vonage_number: string | null;
    transcription_language: string | null;
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
    is_priority?: boolean;
    created_at: string;
}

export interface Profile {
    id: string;
    email: string | null;
    full_name: string | null;
    role: string;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface CallLog {
    id: string;
    contact_id: string;
    outcome: CallOutcome;
    notes: string | null;
    invalid_reason: InvalidReason | null;
    callback_date: string | null;
    meeting_date: string | null;
    meeting_assigned_to: string | null;
    package_sold: string | null;
    sale_value: number | null;
    sold_by: string | null;
    created_by: string | null;
    created_at: string;
}

export type VonageCallStatus = "initiated" | "ringing" | "answered" | "completed" | "failed" | "rejected" | "busy" | "cancelled" | "timeout";

export interface VonageCall {
    id: string;
    contact_id: string;
    project_id: string | null;
    vonage_uuid: string | null;
    from_number: string | null;
    to_number: string | null;
    status: VonageCallStatus;
    duration: number | null;
    recording_url: string | null;
    transcription: string | null;
    created_by: string | null;
    started_at: string | null;
    ended_at: string | null;
    created_at: string;
}

export interface CalendarConnection {
    id: string;
    user_id: string;
    provider: 'google' | 'outlook' | 'apple' | 'calcom';
    calendar_id: string | null;
    calendar_name: string | null;
    access_token: string | null;
    refresh_token: string | null;
    cal_user_id: string | null;
    cal_access_token: string | null;
    cal_refresh_token: string | null;
    token_expires_at: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CalendarEvent {
    id: string;
    connection_id: string;
    user_id: string;
    external_id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    is_all_day: boolean;
    location: string | null;
    status: 'busy' | 'free' | 'tentative';
    synced_at: string;
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
        label: "Meeting Booked",
        color: "bg-purple-100 text-purple-800",
    },
    client: { label: "Client", color: "bg-green-100 text-green-800" },
    lost: { label: "Lost", color: "bg-slate-100 text-slate-500" },
};

// Outcome display config
export const OUTCOME_CONFIG: Record<
    CallOutcome,
    { label: string; color: string; icon: string }
> = {
    callback: {
        label: "Callback",
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        icon: "📞",
    },
    callback_priority: {
        label: "Callback Priority",
        color: "bg-orange-100 text-orange-800 border-orange-200",
        icon: "🔥",
    },
    invalid: {
        label: "Invalid",
        color: "bg-red-100 text-red-800 border-red-200",
        icon: "❌",
    },
    meeting_booked: {
        label: "Meeting Booked",
        color: "bg-purple-100 text-purple-800 border-purple-200",
        icon: "📅",
    },
    sale_made: {
        label: "Sale Made",
        color: "bg-green-100 text-green-800 border-green-200",
        icon: "💰",
    },
};

// Cookied.io packages
export const PACKAGES = [
    { name: "Basic", price: 9.99 },
    { name: "Pro", price: 25 },
    { name: "Agency 10", price: 99 },
    { name: "Agency 25", price: 199 },
    { name: "Agency 50", price: 349 },
    { name: "Agency 100", price: 899 },
    { name: "Unlimited", price: 1499 },
] as const;

// Invalid reasons config
export const INVALID_REASONS: Record<InvalidReason, string> = {
    wrong_number: "Wrong Number",
    not_interested: "Not Interested",
    duplicate: "Duplicate",
    do_not_call: "Do Not Call",
    other: "Other",
};
