"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccessibleProjects } from "@/hooks/use-accessible-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    ArrowLeft,
    Mail,
    Phone,
    Building2,
    MapPin,
    Linkedin,
    Globe,
    Plus,
    Bell,
    MessageSquare,
    PhoneCall,
    User,
    Info,
    Calendar,
    Send,
    CheckCircle2,
    ClipboardList,
    Pencil,
    X,
    FileText,
} from "lucide-react";
import type {
    Contact,
    Note,
    Activity,
    Reminder,
    ContactStatus,
    CallOutcome,
    CallLog,
    InvalidReason,
    VonageCall,
} from "@/lib/types";
import {
    STATUS_CONFIG,
    OUTCOME_CONFIG,
    PACKAGES,
    INVALID_REASONS,
} from "@/lib/types";
import { DialerPanel } from "@/components/dialer-panel";

// Convert Sales Navigator URLs to standard LinkedIn profile URLs
function toLinkedInProfileUrl(url: string): string {
    // Match Sales Navigator URLs like:
    // https://www.linkedin.com/sales/lead/ACwAA...  or /sales/people/ACwAA...
    const salesNavMatch = url.match(/linkedin\.com\/sales\/(?:lead|people)\/([^,/?]+)/);
    if (salesNavMatch) {
        // Extract the member ID and build a standard profile URL
        return `https://www.linkedin.com/in/${salesNavMatch[1]}`;
    }
    return url;
}

export default function ContactDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    // Track project_id for next-contact navigation
    const [projectContacts, setProjectContacts] = useState<{ id: string }[]>([]);
    const [outcomeSaved, setOutcomeSaved] = useState(false);

    const [contact, setContact] = useState<Contact | null>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [callLogs, setCallLogs] = useState<CallLog[]>([]);
    const [vonageCalls, setVonageCalls] = useState<VonageCall[]>([]);
    const [projectVonageNumber, setProjectVonageNumber] = useState<string | null>(null);
    const [projectTranscriptionLang, setProjectTranscriptionLang] = useState<string | null>(null);
    const [newNote, setNewNote] = useState("");
    const { accessibleProjectIds, loading: accessLoading } = useAccessibleProjects();
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Contact>>({});

    // Reminder form
    const [reminderOpen, setReminderOpen] = useState(false);
    const [reminderTitle, setReminderTitle] = useState("");
    const [reminderDate, setReminderDate] = useState("");

    // Outcome dialog
    const [outcomeOpen, setOutcomeOpen] = useState(false);
    const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome | null>(null);
    const [outcomeNotes, setOutcomeNotes] = useState("");
    const [outcomeSaving, setOutcomeSaving] = useState(false);

    // Outcome-specific fields
    const [callbackDate, setCallbackDate] = useState("");
    const [invalidReason, setInvalidReason] = useState<InvalidReason>("not_interested");
    const [meetingDate, setMeetingDate] = useState("");
    const [packageSold, setPackageSold] = useState("");
    const [saleValue, setSaleValue] = useState("");

    // Email & Script
    const [emailOpen, setEmailOpen] = useState(false);
    const [emailTemplates, setEmailTemplates] = useState<{ id: string; name: string; subject: string; body: string }[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState("");
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [emailSending, setEmailSending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [emailError, setEmailError] = useState("");
    const [agentName, setAgentName] = useState("");

    const [scriptOpen, setScriptOpen] = useState(false);
    const [callScripts, setCallScripts] = useState<{ id: string; name: string; body: string }[]>([]);
    const [activeScriptId, setActiveScriptId] = useState("");

    const [teamMembers, setTeamMembers] = useState<{ id: string, full_name: string, email: string }[]>([]);
    const [assignedToUserId, setAssignedToUserId] = useState<string>("");

    const fetchAll = useCallback(async () => {
        const [contactRes, notesRes, actRes, remRes, callLogRes, vonageRes, profilesRes] = await Promise.all([
            supabase.from("contacts").select("*").eq("id", id).single(),
            supabase.from("notes").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
            supabase.from("activities").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
            supabase.from("reminders").select("*").eq("contact_id", id).order("due_date", { ascending: true }),
            supabase.from("call_logs").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
            supabase.from("vonage_calls").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
            supabase.from("profiles").select("id, full_name, email").order("full_name"),
        ]);

        if (contactRes.data) {
            setContact(contactRes.data);
            setEditForm(contactRes.data);

            // Fetch sibling contacts in same project for next-contact nav
            if (contactRes.data.project_id) {
                const [{ data: siblings }, { data: project }] = await Promise.all([
                    supabase
                        .from("contacts")
                        .select("id")
                        .eq("project_id", contactRes.data.project_id)
                        .order("created_at", { ascending: true }),
                    supabase
                        .from("projects")
                        .select("vonage_number, transcription_language")
                        .eq("id", contactRes.data.project_id)
                        .single(),
                ]);
                setProjectContacts(siblings || []);
                setProjectVonageNumber(project?.vonage_number || null);
                setProjectTranscriptionLang(project?.transcription_language || null);
            }
        }
        setNotes(notesRes.data || []);
        setActivities(actRes.data || []);
        setReminders(remRes.data || []);
        setCallLogs(callLogRes.data || []);
        setVonageCalls(vonageRes.data || []);
        setTeamMembers(profilesRes.data || []);

        const { data: userData } = await supabase.auth.getUser();
        if (userData.user && !assignedToUserId) {
            setAssignedToUserId(userData.user.id);
        }
    }, [id, supabase, assignedToUserId]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // Navigate to next contact in the project
    const goToNextContact = () => {
        if (!contact || projectContacts.length === 0) return;
        const currentIndex = projectContacts.findIndex((c) => c.id === contact.id);
        // Find next contact that is NOT the current one
        const nextIndex = (currentIndex + 1) % projectContacts.length;
        if (projectContacts[nextIndex] && projectContacts[nextIndex].id !== contact.id) {
            router.push(`/contacts/${projectContacts[nextIndex].id}`);
        } else {
            // No more contacts, go back to contacts list
            router.push("/contacts");
        }
    };

    const handleSaveEdit = async () => {
        await supabase.from("contacts").update(editForm).eq("id", id);
        setEditing(false);
        fetchAll();
    };

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNote.trim()) return;
        const { data: userData } = await supabase.auth.getUser();

        await supabase.from("notes").insert({
            contact_id: id,
            content: newNote,
            created_by: userData.user?.id,
        });
        await supabase.from("activities").insert({
            contact_id: id,
            type: "note",
            description: `Added a note`,
            created_by: userData.user?.id,
        });
        setNewNote("");
        fetchAll();
    };

    const handleAddReminder = async (e: React.FormEvent) => {
        e.preventDefault();
        const { data: userData } = await supabase.auth.getUser();

        await supabase.from("reminders").insert({
            contact_id: id,
            title: reminderTitle,
            due_date: new Date(reminderDate).toISOString(),
            assigned_to: userData.user?.id,
        });
        setReminderOpen(false);
        setReminderTitle("");
        setReminderDate("");
        fetchAll();
    };

    const handleToggleReminder = async (reminderId: string, isDone: boolean) => {
        await supabase.from("reminders").update({ is_done: !isDone }).eq("id", reminderId);
        fetchAll();
    };

    const logActivity = async (type: string, description: string) => {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from("activities").insert({
            contact_id: id,
            type,
            description,
            created_by: userData.user?.id,
        });
        fetchAll();
    };

    // Reset outcome form
    const resetOutcomeForm = () => {
        setSelectedOutcome(null);
        setOutcomeNotes("");
        setCallbackDate("");
        setInvalidReason("not_interested");
        setMeetingDate("");
        setPackageSold("");
        setSaleValue("");
    };

    // Submit outcome
    const handleSubmitOutcome = async () => {
        if (!selectedOutcome) return;
        setOutcomeSaving(true);

        try {
            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;

            const callLogData: Record<string, unknown> = {
                contact_id: id,
                outcome: selectedOutcome,
                notes: outcomeNotes || null,
                created_by: userId,
            };

            if (selectedOutcome === "callback" || selectedOutcome === "callback_priority") {
                callLogData.callback_date = callbackDate && callbackDate !== "custom" ? new Date(callbackDate).toISOString() : null;
            }
            if (selectedOutcome === "invalid") {
                callLogData.invalid_reason = invalidReason;
            }
            if (selectedOutcome === "meeting_booked") {
                callLogData.meeting_date = meetingDate ? new Date(meetingDate).toISOString() : null;
                callLogData.meeting_assigned_to = assignedToUserId || userId;
            }
            if (selectedOutcome === "sale_made") {
                callLogData.package_sold = packageSold || null;
                callLogData.sale_value = saleValue ? parseFloat(saleValue) : null;
                callLogData.sold_by = userId;
            }

            await supabase.from("call_logs").insert(callLogData);

            let newStatus: ContactStatus | null = null;
            if (selectedOutcome === "callback" || selectedOutcome === "callback_priority") {
                newStatus = "contacted";
            } else if (selectedOutcome === "invalid") {
                newStatus = "lost";
            } else if (selectedOutcome === "meeting_booked") {
                newStatus = "meeting_scheduled";
            } else if (selectedOutcome === "sale_made") {
                newStatus = "client";
            }

            if (newStatus && contact) {
                await supabase.from("contacts").update({ status: newStatus }).eq("id", id);
            }

            const outcomeLabel = OUTCOME_CONFIG[selectedOutcome].label;
            let activityDesc = `Logged outcome: ${outcomeLabel}`;
            if (selectedOutcome === "sale_made" && packageSold) {
                activityDesc += ` — ${packageSold} (€${saleValue || "0"})`;
            }
            if (selectedOutcome === "invalid") {
                activityDesc += ` — ${INVALID_REASONS[invalidReason]}`;
            }

            await supabase.from("activities").insert({
                contact_id: id,
                type: "outcome_logged",
                description: activityDesc,
                created_by: userId,
            });

            if (selectedOutcome === "callback" || selectedOutcome === "callback_priority") {
                if (callbackDate && callbackDate !== "custom") {
                    await supabase.from("reminders").insert({
                        contact_id: id,
                        title: `${selectedOutcome === "callback_priority" ? "🔥 PRIORITY: " : ""}Callback ${contact?.first_name} ${contact?.last_name}`,
                        due_date: new Date(callbackDate).toISOString(),
                        assigned_to: userId,
                        is_priority: selectedOutcome === "callback_priority",
                    });
                }
            }

            if (selectedOutcome === "meeting_booked" && meetingDate) {
                await supabase.from("reminders").insert({
                    contact_id: id,
                    title: `📅 Meeting with ${contact?.first_name} ${contact?.last_name}`,
                    due_date: new Date(meetingDate).toISOString(),
                    assigned_to: assignedToUserId || userId,
                });

                // Push to Google Calendar if connected
                try {
                    // Create an end time (assume 1 hour meeting by default)
                    const start = new Date(meetingDate);
                    const end = new Date(start.getTime() + 60 * 60 * 1000);

                    await fetch('/api/calendar/events', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: `Meeting with ${contact?.first_name} ${contact?.last_name}`,
                            description: `CRM Contact: ${contact?.company_name || 'No company'}\nPhone: ${contact?.phone || 'N/A'}\nEmail: ${contact?.email || 'N/A'}\n\nNotes from call: ${outcomeNotes || 'None'}`,
                            startTime: start.toISOString(),
                            endTime: end.toISOString(),
                            assignedToUserId: assignedToUserId || userId,
                            leadName: `${contact?.first_name} ${contact?.last_name}`,
                            leadEmail: contact?.email
                        })
                    });
                } catch (calendarErr) {
                    console.error("Failed to push meeting to Google Calendar:", calendarErr);
                    // Non-blocking error, we still saved to the CRM
                }
            }

            resetOutcomeForm();
            setOutcomeSaved(true);
            fetchAll();
        } catch (error) {
            console.error("Error saving outcome:", error);
        } finally {
            setOutcomeSaving(false);
        }
    };

    if (!contact) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400">
                Loading...
            </div>
        );
    }

    // Access guard: agents can only see contacts from their assigned projects
    if (!accessLoading && accessibleProjectIds !== null && contact.project_id && !accessibleProjectIds.includes(contact.project_id)) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="rounded-full bg-red-100 p-4">
                    <svg className="h-8 w-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                </div>
                <h2 className="text-lg font-semibold text-slate-700">Access Denied</h2>
                <p className="text-sm text-slate-500 text-center max-w-sm">You don&apos;t have access to this lead list. Ask an admin to assign you to the project.</p>
                <Button variant="outline" onClick={() => router.push("/contacts")}>← Back to Contacts</Button>
            </div>
        );
    }

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    const statusConfig = STATUS_CONFIG[contact.status];

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* ─── HEADER ─── */}
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => router.push("/contacts")}>
                    <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left: Name + badge */}
                    <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 text-xl font-bold text-white">
                            {contact.first_name[0]}{contact.last_name?.[0] || ""}
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-slate-900">
                                {contact.first_name} {contact.last_name}
                            </h1>
                            <p className="text-sm text-slate-500">
                                {contact.function || "No title"}{contact.company_name ? ` · ${contact.company_name}` : ""}
                            </p>
                        </div>
                        <Badge className={`ml-2 ${statusConfig.color}`}>
                            {statusConfig.label}
                        </Badge>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                        {/* View Script */}
                        <Button size="sm" variant="outline" onClick={() => setScriptOpen(true)}>
                            <FileText className="mr-1.5 h-4 w-4" /> Script
                        </Button>

                        {/* Send Email */}
                        {contact.email && (
                            <Button size="sm" variant="outline" onClick={() => {
                                setEmailOpen(true);
                                setEmailSent(false);
                                setEmailError("");
                                // Fetch templates
                                supabase.from("email_templates").select("*").order("created_at", { ascending: false }).then(({ data }: { data: any[] | null }) => {
                                    setEmailTemplates((data as any[]) || []);
                                });
                                // Get agent name
                                supabase.auth.getUser().then(({ data: userData }: { data: { user: { id: string } | null } | null }) => {
                                    if (userData?.user) {
                                        supabase.from("profiles").select("full_name").eq("id", userData.user.id).single().then(({ data: profile }: { data: { full_name: string } | null }) => {
                                            setAgentName(profile?.full_name || "CRM");
                                        });
                                    }
                                });
                            }}>
                                <Mail className="mr-1.5 h-4 w-4" /> Email
                            </Button>
                        )}


                        {/* Log Outcome Button */}
                        <Dialog open={outcomeOpen} onOpenChange={(open) => {
                            setOutcomeOpen(open);
                            if (!open) {
                                resetOutcomeForm();
                                setOutcomeSaved(false);
                            }
                        }}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600 shadow-sm">
                                    <ClipboardList className="mr-1.5 h-4 w-4" /> Log Outcome
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[480px]">
                                <DialogHeader>
                                    <DialogTitle className="text-lg">Log Call Outcome</DialogTitle>
                                    <p className="text-sm text-slate-500">
                                        {contact.first_name} {contact.last_name}{contact.company_name ? ` · ${contact.company_name}` : ""}
                                    </p>
                                </DialogHeader>

                                {/* Success state with Next Contact button */}
                                {outcomeSaved ? (
                                    <div className="flex flex-col items-center py-6 text-center">
                                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                                        </div>
                                        <p className="text-lg font-semibold text-slate-800">Outcome Saved!</p>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Status updated to <Badge className={STATUS_CONFIG[contact.status]?.color || ""}>{STATUS_CONFIG[contact.status]?.label}</Badge>
                                        </p>
                                        <div className="flex gap-3 mt-6 w-full">
                                            <Button
                                                variant="outline"
                                                className="flex-1"
                                                onClick={() => {
                                                    setOutcomeOpen(false);
                                                    setOutcomeSaved(false);
                                                }}
                                            >
                                                Stay Here
                                            </Button>
                                            <Button
                                                className="flex-1 bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600"
                                                onClick={() => {
                                                    setOutcomeOpen(false);
                                                    setOutcomeSaved(false);
                                                    goToNextContact();
                                                }}
                                            >
                                                Next Contact →
                                            </Button>
                                        </div>
                                    </div>
                                ) : !selectedOutcome ? (
                                    <div className="grid grid-cols-1 gap-2 pt-2">
                                        {(Object.entries(OUTCOME_CONFIG) as [CallOutcome, typeof OUTCOME_CONFIG[CallOutcome]][]).map(
                                            ([key, config]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => setSelectedOutcome(key)}
                                                    className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all hover:scale-[1.01] hover:shadow-md ${config.color}`}
                                                >
                                                    <span className="text-2xl">{config.icon}</span>
                                                    <div>
                                                        <p className="font-semibold">{config.label}</p>
                                                        <p className="text-xs opacity-70">
                                                            {key === "callback" && "Schedule a follow-up call"}
                                                            {key === "callback_priority" && "Urgent follow-up needed"}
                                                            {key === "invalid" && "Mark contact as invalid"}
                                                            {key === "meeting_booked" && "Schedule a meeting"}
                                                            {key === "sale_made" && "Record a sale"}
                                                        </p>
                                                    </div>
                                                </button>
                                            )
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4 pt-2">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setSelectedOutcome(null)} className="text-sm text-slate-500 hover:text-slate-700">← Back</button>
                                            <Badge className={OUTCOME_CONFIG[selectedOutcome].color}>
                                                {OUTCOME_CONFIG[selectedOutcome].icon} {OUTCOME_CONFIG[selectedOutcome].label}
                                            </Badge>
                                        </div>

                                        {(selectedOutcome === "callback" || selectedOutcome === "callback_priority") && (
                                            <div className="space-y-3">
                                                <Label>When to call back</Label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {[
                                                        { label: "1 Day", days: 1 },
                                                        { label: "3 Days", days: 3 },
                                                        { label: "1 Week", days: 7 },
                                                        { label: "2 Weeks", days: 14 },
                                                        { label: "1 Month", days: 30 },
                                                        { label: "3 Months", days: 90 },
                                                    ].map((preset) => {
                                                        const presetDate = new Date();
                                                        presetDate.setDate(presetDate.getDate() + preset.days);
                                                        presetDate.setHours(10, 0, 0, 0);
                                                        const presetValue = presetDate.toISOString().slice(0, 16);
                                                        const isSelected = callbackDate === presetValue;
                                                        return (
                                                            <button
                                                                key={preset.days}
                                                                type="button"
                                                                onClick={() => setCallbackDate(presetValue)}
                                                                className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${isSelected
                                                                    ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                                                                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                                                    }`}
                                                            >
                                                                {preset.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCallbackDate("custom")}
                                                        className="text-xs text-cyan-600 hover:underline"
                                                    >
                                                        📅 Pick a specific date & time
                                                    </button>
                                                    {(callbackDate === "custom" || (callbackDate && !["custom"].includes(callbackDate) && ![1, 3, 7, 14, 30, 90].some((d) => {
                                                        const check = new Date();
                                                        check.setDate(check.getDate() + d);
                                                        check.setHours(10, 0, 0, 0);
                                                        return callbackDate === check.toISOString().slice(0, 16);
                                                    }))) && (
                                                            <Input
                                                                type="datetime-local"
                                                                className="mt-2"
                                                                value={callbackDate === "custom" ? "" : callbackDate}
                                                                onChange={(e) => setCallbackDate(e.target.value)}
                                                            />
                                                        )}
                                                </div>
                                                {callbackDate && callbackDate !== "custom" && (
                                                    <p className="text-xs text-slate-500">
                                                        📞 Reminder set for: {new Date(callbackDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} at 10:00 AM
                                                    </p>
                                                )}
                                                {selectedOutcome === "callback_priority" && (
                                                    <p className="text-xs text-orange-600">🔥 This will create a priority reminder</p>
                                                )}
                                            </div>
                                        )}

                                        {selectedOutcome === "invalid" && (
                                            <div className="space-y-2">
                                                <Label>Reason</Label>
                                                <Select value={invalidReason} onValueChange={(v) => setInvalidReason(v as InvalidReason)}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {(Object.entries(INVALID_REASONS) as [InvalidReason, string][]).map(([key, label]) => (
                                                            <SelectItem key={key} value={key}>{label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        {selectedOutcome === "meeting_booked" && (
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label>Meeting Date & Time</Label>
                                                    <Input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} required />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Assign Meeting To:</Label>
                                                    <Select value={assignedToUserId} onValueChange={setAssignedToUserId}>
                                                        <SelectTrigger className="bg-white"><SelectValue placeholder="Select team member..." /></SelectTrigger>
                                                        <SelectContent>
                                                            {teamMembers.map((member) => (
                                                                <SelectItem key={member.id} value={member.id}>
                                                                    {member.full_name || member.email}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        )}

                                        {selectedOutcome === "sale_made" && (
                                            <div className="space-y-3">
                                                <div className="space-y-2">
                                                    <Label>Package Sold</Label>
                                                    <Select value={packageSold} onValueChange={setPackageSold}>
                                                        <SelectTrigger><SelectValue placeholder="Select package..." /></SelectTrigger>
                                                        <SelectContent>
                                                            {PACKAGES.map((pkg) => (
                                                                <SelectItem key={pkg.name} value={pkg.name}>
                                                                    {pkg.name} — €{pkg.price}/yr
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Sale Value (€)</Label>
                                                    <Input type="number" step="0.01" placeholder="e.g. 99.00" value={saleValue} onChange={(e) => setSaleValue(e.target.value)} />
                                                    {packageSold && !saleValue && (
                                                        <button type="button" className="text-xs text-cyan-600 hover:underline" onClick={() => {
                                                            const pkg = PACKAGES.find((p) => p.name === packageSold);
                                                            if (pkg) setSaleValue(pkg.price.toString());
                                                        }}>
                                                            Auto-fill: €{PACKAGES.find((p) => p.name === packageSold)?.price}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label>Notes (optional)</Label>
                                            <Textarea placeholder="Add any additional notes..." value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} rows={3} />
                                        </div>

                                        <Button onClick={handleSubmitOutcome} disabled={outcomeSaving} className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600">
                                            {outcomeSaving ? "Saving..." : "Save Outcome"}
                                        </Button>
                                    </div>
                                )}
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>

            {/* ─── BODY: 2-column layout ─── */}
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                {/* ─── LEFT SIDEBAR ─── */}
                <div className="space-y-5">
                    {/* Dialer Card — TOP */}
                    <DialerPanel
                        contactId={contact.id}
                        projectId={contact.project_id}
                        initialPhone={contact.phone}
                        fromNumber={projectVonageNumber || process.env.NEXT_PUBLIC_VONAGE_DEFAULT_NUMBER || null}
                        transcriptionLanguage={projectTranscriptionLang}
                        onCallEnded={() => fetchAll()}
                    />

                    {/* Contact Info Card */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Contact Info</CardTitle>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(!editing)}>
                                {editing ? <X className="h-4 w-4" /> : <Pencil className="h-3.5 w-3.5" />}
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-0">
                            {editing ? (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><Label className="text-xs">First Name</Label><Input className="h-8 text-sm" value={editForm.first_name || ""} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} /></div>
                                        <div><Label className="text-xs">Last Name</Label><Input className="h-8 text-sm" value={editForm.last_name || ""} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} /></div>
                                    </div>
                                    <div><Label className="text-xs">Email</Label><Input className="h-8 text-sm" value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
                                    <div><Label className="text-xs">Phone</Label><Input className="h-8 text-sm" value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><Label className="text-xs">Company</Label><Input className="h-8 text-sm" value={editForm.company_name || ""} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} /></div>
                                        <div><Label className="text-xs">Branch</Label><Input className="h-8 text-sm" value={editForm.branch || ""} onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><Label className="text-xs">Function</Label><Input className="h-8 text-sm" value={editForm.function || ""} onChange={(e) => setEditForm({ ...editForm, function: e.target.value })} /></div>
                                        <div><Label className="text-xs">Location</Label><Input className="h-8 text-sm" value={editForm.location || ""} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} /></div>
                                    </div>
                                    <div><Label className="text-xs">LinkedIn URL</Label><Input className="h-8 text-sm" value={editForm.linkedin_url || ""} onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })} /></div>
                                    <div><Label className="text-xs">Website</Label><Input className="h-8 text-sm" value={editForm.website || ""} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} /></div>
                                    <div><Label className="text-xs">Source</Label><Input className="h-8 text-sm" value={editForm.source || ""} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} /></div>
                                    <Button onClick={handleSaveEdit} size="sm" className="w-full">Save</Button>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {contact.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={contact.email} />}
                                    {contact.phone && <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={contact.phone} />}
                                    {contact.company_name && <InfoRow icon={<Building2 className="h-4 w-4" />} label="Company" value={contact.company_name} />}
                                    {contact.branch && <InfoRow icon={<Building2 className="h-4 w-4 text-slate-400" />} label="Branch" value={contact.branch} />}
                                    {contact.function && <InfoRow icon={<User className="h-4 w-4" />} label="Function" value={contact.function} />}
                                    {contact.location && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={contact.location} />}
                                    {contact.source && <InfoRow icon={<Info className="h-4 w-4" />} label="Source" value={contact.source} />}
                                    {contact.linkedin_url && (
                                        <a href={toLinkedInProfileUrl(contact.linkedin_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-cyan-600 hover:underline">
                                            <Linkedin className="h-4 w-4" /> LinkedIn Profile
                                        </a>
                                    )}
                                    {contact.website && (
                                        <a href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-cyan-600 hover:underline">
                                            <Globe className="h-4 w-4" /> Website
                                        </a>
                                    )}
                                    {!contact.email && !contact.phone && !contact.company_name && !contact.location && !contact.linkedin_url && !contact.website && !contact.branch && !contact.function && !contact.source && (
                                        <p className="text-sm text-slate-400 italic">No contact details yet</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ─── MAIN CONTENT (Tabs) ─── */}
                <div>
                    <Tabs defaultValue="history" className="w-full">
                        <TabsList className="w-full justify-start">
                            <TabsTrigger value="history" className="gap-1.5">
                                <ClipboardList className="h-4 w-4" /> History
                                {(callLogs.length + notes.length + vonageCalls.length) > 0 && <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold">{callLogs.length + notes.length + vonageCalls.length}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="activity" className="gap-1.5">
                                <Bell className="h-4 w-4" /> Activity
                                {(() => {
                                    const now = new Date();
                                    const pendingReminders = reminders.filter(r => !r.is_done);
                                    const hasOverdue = pendingReminders.some(r => new Date(r.due_date) <= now);
                                    const hasAlmostDue = !hasOverdue && pendingReminders.some(r => {
                                        const diff = new Date(r.due_date).getTime() - now.getTime();
                                        return diff > 0 && diff <= 24 * 60 * 60 * 1000;
                                    });
                                    if (hasOverdue) return <span className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-wiggle">!</span>;
                                    if (hasAlmostDue) return <span className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] font-bold">!</span>;
                                    if (pendingReminders.length > 0) return <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold">{pendingReminders.length}</span>;
                                    return null;
                                })()}
                            </TabsTrigger>
                        </TabsList>

                        {/* ─── History Tab (Call Logs + Notes + Vonage Calls merged chronologically) ─── */}
                        <TabsContent value="history">
                            <Card>
                                <CardContent className="pt-6">
                                    <form onSubmit={handleAddNote} className="mb-5">
                                        <div className="flex gap-2">
                                            <Textarea placeholder="Write a note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2} className="flex-1 text-sm" />
                                            <Button type="submit" size="sm" className="self-end">Add</Button>
                                        </div>
                                    </form>
                                    <Separator className="mb-5" />
                                    {callLogs.length === 0 && vonageCalls.length === 0 && notes.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <ClipboardList className="h-10 w-10 text-slate-300 mb-3" />
                                            <p className="text-sm font-medium text-slate-500">No history yet</p>
                                            <p className="text-xs text-slate-400 mt-1">Call logs, outcomes, and notes will appear here</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {[
                                                ...vonageCalls.map(vc => ({ type: "vonage" as const, date: vc.created_at, data: vc })),
                                                ...callLogs.map(cl => ({ type: "outcome" as const, date: cl.created_at, data: cl })),
                                                ...notes.map(n => ({ type: "note" as const, date: n.created_at, data: n })),
                                            ]
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                .map((item) => {
                                                    if (item.type === "vonage") {
                                                        const vc = item.data as VonageCall;
                                                        return (
                                                            <div key={`vc-${vc.id}`} className="rounded-lg border-l-4 border-l-cyan-500 bg-white p-4 shadow-sm">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <PhoneCall className="h-4 w-4 text-cyan-500" />
                                                                        <span className="font-semibold text-sm text-slate-800">Call</span>
                                                                        {vc.duration != null && <Badge className="bg-cyan-100 text-cyan-700 text-[10px] px-1.5 py-0">{Math.floor(vc.duration / 60)}m {vc.duration % 60}s</Badge>}
                                                                        <Badge className={`text-[10px] px-1.5 py-0 ${vc.status === "completed" || vc.status === "answered" ? "bg-green-100 text-green-700" : vc.status === "failed" || vc.status === "rejected" || vc.status === "busy" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{vc.status}</Badge>
                                                                    </div>
                                                                    <span className="text-xs text-slate-400">{formatDate(vc.created_at)}</span>
                                                                </div>
                                                                <div className="space-y-2 text-sm text-slate-600">
                                                                    {vc.to_number && <p className="text-xs text-slate-400">📞 {vc.to_number}{vc.from_number ? ` (from ${vc.from_number})` : ""}</p>}
                                                                    {vc.recording_url && (<div className="mt-2"><p className="text-xs text-slate-500 mb-1">🎙️ Recording:</p><audio controls className="w-full h-8" preload="none"><source src={vc.recording_url} type="audio/mp3" /></audio></div>)}
                                                                    {vc.transcription && (<details className="mt-2"><summary className="text-xs text-cyan-600 cursor-pointer hover:text-cyan-700">📝 View Transcription</summary><p className="mt-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-md whitespace-pre-wrap leading-relaxed">{vc.transcription}</p></details>)}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    if (item.type === "outcome") {
                                                        const log = item.data as CallLog;
                                                        return (
                                                            <div key={`cl-${log.id}`} className={`rounded-lg border-l-4 bg-white p-4 shadow-sm ${log.outcome === "sale_made" ? "border-l-green-500" : log.outcome === "meeting_booked" ? "border-l-purple-500" : log.outcome === "callback_priority" ? "border-l-orange-500" : log.outcome === "callback" ? "border-l-yellow-500" : "border-l-red-400"}`}>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-lg">{OUTCOME_CONFIG[log.outcome]?.icon}</span>
                                                                        <span className="font-semibold text-sm text-slate-800">{OUTCOME_CONFIG[log.outcome]?.label}</span>
                                                                    </div>
                                                                    <span className="text-xs text-slate-400">{formatDate(log.created_at)}</span>
                                                                </div>
                                                                <div className="space-y-1 text-sm text-slate-600">
                                                                    {log.callback_date && <p>📞 Callback: <span className="font-medium">{formatDate(log.callback_date)}</span></p>}
                                                                    {log.invalid_reason && <p>Reason: <span className="font-medium">{INVALID_REASONS[log.invalid_reason as keyof typeof INVALID_REASONS] || log.invalid_reason}</span></p>}
                                                                    {log.meeting_date && <p>📅 Meeting: <span className="font-medium">{formatDate(log.meeting_date)}</span></p>}
                                                                    {log.package_sold && <p>📦 Package: <span className="font-medium">{log.package_sold}</span></p>}
                                                                    {log.sale_value && <p>💰 Value: <span className="font-medium text-green-700">€{Number(log.sale_value).toFixed(2)}</span></p>}
                                                                    {log.notes && <p className="italic text-slate-500 mt-1">&quot;{log.notes}&quot;</p>}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    const note = item.data as Note;
                                                    return (
                                                        <div key={`n-${note.id}`} className="rounded-lg border-l-4 border-l-slate-300 bg-slate-50 p-4">
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <div className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5 text-slate-400" /><span className="text-xs font-medium text-slate-500 uppercase">Note</span></div>
                                                                <span className="text-xs text-slate-400">{formatDate(note.created_at)}</span>
                                                            </div>
                                                            <p className="text-sm whitespace-pre-wrap text-slate-700">{note.content}</p>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ─── Activity & Reminders Tab ─── */}
                        <TabsContent value="activity">
                            <Card>
                                <CardContent className="pt-6">
                                    {/* Upcoming Reminders */}
                                    {reminders.filter(r => !r.is_done).length > 0 && (
                                        <div className="mb-6">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Upcoming Reminders</h3>
                                                <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
                                                    <DialogTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Plus className="h-4 w-4" /></Button></DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader><DialogTitle>Add Reminder</DialogTitle></DialogHeader>
                                                        <form onSubmit={handleAddReminder} className="space-y-4">
                                                            <div className="space-y-2"><Label>Title</Label><Input value={reminderTitle} onChange={(e) => setReminderTitle(e.target.value)} placeholder="e.g. Follow up on proposal" required /></div>
                                                            <div className="space-y-2"><Label>Due Date</Label><Input type="datetime-local" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} required /></div>
                                                            <Button type="submit" className="w-full">Add Reminder</Button>
                                                        </form>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                            <div className="space-y-2">
                                                {[...reminders].filter(r => !r.is_done).sort((a, b) => { if (a.is_priority && !b.is_priority) return -1; if (!a.is_priority && b.is_priority) return 1; return new Date(a.due_date).getTime() - new Date(b.due_date).getTime(); }).map((r) => {
                                                    const now = new Date();
                                                    const dueDate = new Date(r.due_date);
                                                    const isOverdue = dueDate <= now;
                                                    const isAlmostDue = !isOverdue && (dueDate.getTime() - now.getTime()) <= 24 * 60 * 60 * 1000;
                                                    return (
                                                        <div key={r.id} className={`flex items-center justify-between rounded-lg border p-2.5 text-sm ${isOverdue ? "border-red-300 bg-red-50" : isAlmostDue ? "border-orange-300 bg-orange-50" : r.is_priority ? "border-orange-300 bg-orange-50" : ""}`}>
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                {isOverdue && <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-wiggle shrink-0">!</span>}
                                                                {isAlmostDue && !isOverdue && <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] font-bold shrink-0">!</span>}
                                                                <div className="min-w-0">
                                                                    <p className="truncate font-medium text-slate-700">{r.is_priority && "🔥 "}{r.title}</p>
                                                                    <p className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-slate-400"}`}>{isOverdue ? "⚠️ Overdue — " : ""}{formatDate(r.due_date)}</p>
                                                                </div>
                                                            </div>
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => handleToggleReminder(r.id, r.is_done)}><CheckCircle2 className="h-4 w-4 text-slate-300" /></Button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <Separator className="my-5" />
                                        </div>
                                    )}
                                    {/* Add Reminder when none exist */}
                                    {reminders.filter(r => !r.is_done).length === 0 && (
                                        <div className="mb-4 flex justify-end">
                                            <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
                                                <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" /> Add Reminder</Button></DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader><DialogTitle>Add Reminder</DialogTitle></DialogHeader>
                                                    <form onSubmit={handleAddReminder} className="space-y-4">
                                                        <div className="space-y-2"><Label>Title</Label><Input value={reminderTitle} onChange={(e) => setReminderTitle(e.target.value)} placeholder="e.g. Follow up on proposal" required /></div>
                                                        <div className="space-y-2"><Label>Due Date</Label><Input type="datetime-local" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} required /></div>
                                                        <Button type="submit" className="w-full">Add Reminder</Button>
                                                    </form>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    )}
                                    {/* Completed Reminders */}
                                    {reminders.filter(r => r.is_done).length > 0 && (
                                        <div className="mb-6">
                                            <details>
                                                <summary className="text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-pointer mb-2">✅ Done ({reminders.filter(r => r.is_done).length})</summary>
                                                <div className="space-y-2">
                                                    {reminders.filter(r => r.is_done).map((r) => (
                                                        <div key={r.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm opacity-40">
                                                            <div className="min-w-0"><p className="truncate line-through text-slate-400">{r.title}</p><p className="text-xs text-slate-400">{formatDate(r.due_date)}</p></div>
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => handleToggleReminder(r.id, r.is_done)}><CheckCircle2 className="h-4 w-4 text-green-500" /></Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                            <Separator className="my-5" />
                                        </div>
                                    )}
                                    {/* Activity Timeline */}
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Activity Timeline</h3>
                                    {activities.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-center">
                                            <Bell className="h-10 w-10 text-slate-300 mb-3" />
                                            <p className="text-sm font-medium text-slate-500">No activity yet</p>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" />
                                            <div className="space-y-4">
                                                {activities.map((a) => (
                                                    <div key={a.id} className="flex items-start gap-4 pl-1">
                                                        <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200">
                                                            {a.type === "call" && <PhoneCall className="h-3.5 w-3.5 text-cyan-500" />}
                                                            {a.type === "email" && <Send className="h-3.5 w-3.5 text-green-500" />}
                                                            {a.type === "meeting" && <Calendar className="h-3.5 w-3.5 text-purple-500" />}
                                                            {a.type === "note" && <MessageSquare className="h-3.5 w-3.5 text-orange-500" />}
                                                            {a.type === "status_change" && <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />}
                                                            {a.type === "outcome_logged" && <ClipboardList className="h-3.5 w-3.5 text-indigo-500" />}
                                                        </div>
                                                        <div className="pt-1">
                                                            <p className="text-sm text-slate-700">{a.description}</p>
                                                            <p className="text-xs text-slate-400 mt-0.5">{formatDate(a.created_at)}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
            {/* ─── Send Email Dialog ─── */}
            <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Send Email</DialogTitle>
                    </DialogHeader>
                    {emailSent ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900">Email Sent!</h3>
                            <p className="text-slate-500 mt-2">Your email has been sent successfully.</p>
                            <Button className="mt-6" onClick={() => setEmailOpen(false)}>
                                Close
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {emailError && (
                                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                                    {emailError}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>Template</Label>
                                <Select
                                    value={selectedTemplate}
                                    onValueChange={(val) => {
                                        setSelectedTemplate(val);
                                        const tmpl = emailTemplates.find((t) => t.id === val);
                                        if (tmpl) {
                                            let subj = tmpl.subject;
                                            let body = tmpl.body;
                                            // Replace placeholders
                                            const replacements: Record<string, string> = {
                                                "{{first_name}}": contact?.first_name || "",
                                                "{{last_name}}": contact?.last_name || "",
                                                "{{company}}": contact?.company_name || "",
                                                "{{email}}": contact?.email || "",
                                            };
                                            Object.entries(replacements).forEach(([key, val]) => {
                                                subj = subj.replaceAll(key, val);
                                                body = body.replaceAll(key, val);
                                            });
                                            setEmailSubject(subj);
                                            setEmailBody(body);
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a template..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {emailTemplates.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Subject</Label>
                                <Input
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    placeholder="Email subject..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Message</Label>
                                <Textarea
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    placeholder="Type your message..."
                                    className="min-h-[200px]"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="ghost" onClick={() => setEmailOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={async () => {
                                        if (!contact?.email) return;
                                        setEmailSending(true);
                                        setEmailError("");
                                        try {
                                            const res = await fetch("/api/send-email", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                    to: contact.email,
                                                    subject: emailSubject,
                                                    body: emailBody,
                                                    fromName: agentName,
                                                }),
                                            });
                                            const data = await res.json();
                                            if (!res.ok) throw new Error(data.error || "Failed to send");

                                            // Log activity
                                            await supabase.from("activities").insert({
                                                contact_id: contact.id,
                                                type: "email",
                                                description: `Sent email: ${emailSubject}`,
                                                created_by: (await supabase.auth.getUser()).data.user?.id,
                                            });

                                            setEmailSent(true);
                                            fetchAll(); // Refresh activities
                                        } catch (err: any) {
                                            setEmailError(err.message);
                                        } finally {
                                            setEmailSending(false);
                                        }
                                    }}
                                    disabled={emailSending || !emailSubject || !emailBody}
                                >
                                    {emailSending ? (
                                        <>Sending...</>
                                    ) : (
                                        <>
                                            <Send className="mr-2 h-4 w-4" /> Send Email
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ─── Script Viewer Dialog ─── */}
            <Dialog open={scriptOpen} onOpenChange={setScriptOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Call Script</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Select
                            value={activeScriptId}
                            onValueChange={(val) => {
                                setActiveScriptId(val);
                                if (!callScripts.length) {
                                    supabase.from("call_scripts").select("*").order("created_at", { ascending: false }).then(({ data }: { data: any[] | null }) => {
                                        setCallScripts((data as any[]) || []);
                                    });
                                }
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a script..." />
                            </SelectTrigger>
                            <SelectContent>
                                {callScripts.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.name}
                                    </SelectItem>
                                ))}
                                {callScripts.length === 0 && (
                                    <SelectItem value="none" disabled>No scripts found</SelectItem>
                                )}
                            </SelectContent>
                        </Select>

                        {(() => {
                            const script = callScripts.find(s => s.id === activeScriptId);
                            if (!script) return <div className="py-8 text-center text-slate-400">Select a script to view</div>;

                            let body = script.body;
                            const replacements: Record<string, string> = {
                                "{{first_name}}": contact?.first_name || "[First Name]",
                                "{{last_name}}": contact?.last_name || "[Last Name]",
                                "{{company}}": contact?.company_name || "[Company]",
                                "{{email}}": contact?.email || "[Email]",
                            };
                            Object.entries(replacements).forEach(([key, val]) => {
                                body = body.replaceAll(key, `<span class="bg-yellow-100 px-1 rounded font-medium text-yellow-800">${val}</span>`);
                            });

                            return (
                                <div
                                    className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{ __html: body }}
                                />
                            );
                        })()}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3">
            <span className="text-slate-400 mt-0.5">{icon}</span>
            <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label}</p>
                <p className="text-sm text-slate-700">{value}</p>
            </div>
        </div>
    );
}
