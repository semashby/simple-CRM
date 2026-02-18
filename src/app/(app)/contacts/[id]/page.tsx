"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
} from "@/lib/types";
import {
    STATUS_CONFIG,
    OUTCOME_CONFIG,
    PACKAGES,
    INVALID_REASONS,
} from "@/lib/types";

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
    const [newNote, setNewNote] = useState("");
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

    const fetchAll = useCallback(async () => {
        const [contactRes, notesRes, actRes, remRes, callLogRes] = await Promise.all([
            supabase.from("contacts").select("*").eq("id", id).single(),
            supabase.from("notes").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
            supabase.from("activities").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
            supabase.from("reminders").select("*").eq("contact_id", id).order("due_date", { ascending: true }),
            supabase.from("call_logs").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
        ]);

        if (contactRes.data) {
            setContact(contactRes.data);
            setEditForm(contactRes.data);

            // Fetch sibling contacts in same project for next-contact nav
            if (contactRes.data.project_id) {
                const { data: siblings } = await supabase
                    .from("contacts")
                    .select("id")
                    .eq("project_id", contactRes.data.project_id)
                    .order("created_at", { ascending: true });
                setProjectContacts(siblings || []);
            }
        }
        setNotes(notesRes.data || []);
        setActivities(actRes.data || []);
        setReminders(remRes.data || []);
        setCallLogs(callLogRes.data || []);
    }, [id]);

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
                    assigned_to: userId,
                });
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
                                            <div className="space-y-2">
                                                <Label>Meeting Date & Time</Label>
                                                <Input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} required />
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

                    {/* Reminders Card */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Bell className="h-3.5 w-3.5" /> Reminders
                            </CardTitle>
                            <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Plus className="h-4 w-4" /></Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>Add Reminder</DialogTitle></DialogHeader>
                                    <form onSubmit={handleAddReminder} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Title</Label>
                                            <Input value={reminderTitle} onChange={(e) => setReminderTitle(e.target.value)} placeholder="e.g. Follow up on proposal" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Due Date</Label>
                                            <Input type="datetime-local" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} required />
                                        </div>
                                        <Button type="submit" className="w-full">Add Reminder</Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {reminders.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No reminders</p>
                            ) : (
                                <div className="space-y-2">
                                    {[...reminders]
                                        .sort((a, b) => {
                                            if (a.is_priority && !b.is_priority) return -1;
                                            if (!a.is_priority && b.is_priority) return 1;
                                            return 0;
                                        })
                                        .map((r) => (
                                            <div key={r.id} className={`flex items-center justify-between rounded-lg border p-2.5 text-sm ${r.is_done ? "opacity-40" : ""} ${r.is_priority && !r.is_done ? "border-orange-300 bg-orange-50" : ""}`}>
                                                <div className="min-w-0">
                                                    <p className={`truncate ${r.is_done ? "line-through text-slate-400" : "font-medium text-slate-700"}`}>
                                                        {r.is_priority && !r.is_done && "🔥 "}{r.title}
                                                    </p>
                                                    <p className="text-xs text-slate-400">{formatDate(r.due_date)}</p>
                                                </div>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => handleToggleReminder(r.id, r.is_done)}>
                                                    <CheckCircle2 className={`h-4 w-4 ${r.is_done ? "text-green-500" : "text-slate-300"}`} />
                                                </Button>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ─── MAIN CONTENT (Tabs) ─── */}
                <div>
                    <Tabs defaultValue="call_logs" className="w-full">
                        <TabsList className="w-full justify-start">
                            <TabsTrigger value="call_logs" className="gap-1.5">
                                <ClipboardList className="h-4 w-4" /> Call Logs
                                {callLogs.length > 0 && <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold">{callLogs.length}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="notes" className="gap-1.5">
                                <MessageSquare className="h-4 w-4" /> Notes
                                {notes.length > 0 && <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold">{notes.length}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="activity" className="gap-1.5">
                                <Bell className="h-4 w-4" /> Activity
                            </TabsTrigger>
                        </TabsList>

                        {/* ─── Call Logs Tab ─── */}
                        <TabsContent value="call_logs">
                            <Card>
                                <CardContent className="pt-6">
                                    {callLogs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <ClipboardList className="h-10 w-10 text-slate-300 mb-3" />
                                            <p className="text-sm font-medium text-slate-500">No call logs yet</p>
                                            <p className="text-xs text-slate-400 mt-1">Click &quot;Log Outcome&quot; after calling this contact</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {callLogs.map((log) => (
                                                <div key={log.id} className={`rounded-lg border-l-4 bg-white p-4 shadow-sm ${log.outcome === "sale_made" ? "border-l-green-500" :
                                                    log.outcome === "meeting_booked" ? "border-l-purple-500" :
                                                        log.outcome === "callback_priority" ? "border-l-orange-500" :
                                                            log.outcome === "callback" ? "border-l-yellow-500" :
                                                                "border-l-red-400"
                                                    }`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">{OUTCOME_CONFIG[log.outcome]?.icon}</span>
                                                            <span className="font-semibold text-sm text-slate-800">{OUTCOME_CONFIG[log.outcome]?.label}</span>
                                                        </div>
                                                        <span className="text-xs text-slate-400">{formatDate(log.created_at)}</span>
                                                    </div>
                                                    <div className="space-y-1 text-sm text-slate-600">
                                                        {log.callback_date && <p>📞 Callback scheduled: <span className="font-medium">{formatDate(log.callback_date)}</span></p>}
                                                        {log.invalid_reason && <p>Reason: <span className="font-medium">{INVALID_REASONS[log.invalid_reason as keyof typeof INVALID_REASONS] || log.invalid_reason}</span></p>}
                                                        {log.meeting_date && <p>📅 Meeting: <span className="font-medium">{formatDate(log.meeting_date)}</span></p>}
                                                        {log.package_sold && <p>📦 Package: <span className="font-medium">{log.package_sold}</span></p>}
                                                        {log.sale_value && <p>💰 Value: <span className="font-medium text-green-700">€{Number(log.sale_value).toFixed(2)}</span></p>}
                                                        {log.notes && <p className="italic text-slate-500 mt-1">&quot;{log.notes}&quot;</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ─── Notes Tab ─── */}
                        <TabsContent value="notes">
                            <Card>
                                <CardContent className="pt-6">
                                    <form onSubmit={handleAddNote} className="mb-5">
                                        <div className="flex gap-2">
                                            <Textarea
                                                placeholder="Write a note..."
                                                value={newNote}
                                                onChange={(e) => setNewNote(e.target.value)}
                                                rows={2}
                                                className="flex-1 text-sm"
                                            />
                                            <Button type="submit" size="sm" className="self-end">Add</Button>
                                        </div>
                                    </form>
                                    <Separator className="mb-5" />
                                    {notes.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <MessageSquare className="h-10 w-10 text-slate-300 mb-3" />
                                            <p className="text-sm font-medium text-slate-500">No notes yet</p>
                                            <p className="text-xs text-slate-400 mt-1">Add a note above</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {notes.map((n) => (
                                                <div key={n.id} className="rounded-lg bg-slate-50 p-4">
                                                    <p className="text-sm whitespace-pre-wrap text-slate-700">{n.content}</p>
                                                    <p className="mt-2 text-xs text-slate-400">{formatDate(n.created_at)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ─── Activity Tab ─── */}
                        <TabsContent value="activity">
                            <Card>
                                <CardContent className="pt-6">
                                    {activities.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <Bell className="h-10 w-10 text-slate-300 mb-3" />
                                            <p className="text-sm font-medium text-slate-500">No activity yet</p>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            {/* Timeline line */}
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
