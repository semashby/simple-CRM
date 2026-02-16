"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
    Calendar,
    Send,
    CheckCircle2,
    ClipboardList,
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

export default function ContactDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const supabase = createClient();

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
        }
        setNotes(notesRes.data || []);
        setActivities(actRes.data || []);
        setReminders(remRes.data || []);
        setCallLogs(callLogRes.data || []);
    }, [id]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const handleStatusChange = async (newStatus: string) => {
        if (!contact) return;
        const oldStatus = contact.status;
        const { data: userData } = await supabase.auth.getUser();

        await supabase.from("contacts").update({ status: newStatus }).eq("id", id);
        await supabase.from("activities").insert({
            contact_id: id,
            type: "status_change",
            description: `Status changed from ${STATUS_CONFIG[oldStatus]?.label} to ${STATUS_CONFIG[newStatus as ContactStatus]?.label}`,
            created_by: userData.user?.id,
        });
        fetchAll();
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

            // 1. Insert call log
            const callLogData: Record<string, unknown> = {
                contact_id: id,
                outcome: selectedOutcome,
                notes: outcomeNotes || null,
                created_by: userId,
            };

            // Add outcome-specific fields
            if (selectedOutcome === "callback" || selectedOutcome === "callback_priority") {
                callLogData.callback_date = callbackDate ? new Date(callbackDate).toISOString() : null;
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

            // 2. Update contact status based on outcome
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

            // 3. Log activity
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

            // 4. Create reminder for callbacks
            if (selectedOutcome === "callback" || selectedOutcome === "callback_priority") {
                if (callbackDate) {
                    await supabase.from("reminders").insert({
                        contact_id: id,
                        title: `${selectedOutcome === "callback_priority" ? "🔥 PRIORITY: " : ""}Callback ${contact?.first_name} ${contact?.last_name}`,
                        due_date: new Date(callbackDate).toISOString(),
                        assigned_to: userId,
                        is_priority: selectedOutcome === "callback_priority",
                    });
                }
            }

            // 5. Create reminder for meetings
            if (selectedOutcome === "meeting_booked" && meetingDate) {
                await supabase.from("reminders").insert({
                    contact_id: id,
                    title: `📅 Meeting with ${contact?.first_name} ${contact?.last_name}`,
                    due_date: new Date(meetingDate).toISOString(),
                    assigned_to: userId,
                });
            }

            // Close dialog and refresh
            setOutcomeOpen(false);
            resetOutcomeForm();
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

    return (
        <div className="space-y-6">
            {/* Back Button + Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.push("/contacts")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
            </div>

            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">
                        {contact.first_name} {contact.last_name}
                    </h1>
                    <p className="text-slate-500">{contact.function || "No title"} {contact.company_name ? `at ${contact.company_name}` : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Status Selector */}
                    <Select value={contact.status} onValueChange={handleStatusChange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                                <SelectItem key={key} value={key}>
                                    {val.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Quick Actions */}
                    <Button variant="outline" size="sm" onClick={() => logActivity("call", "Logged a phone call")}>
                        <PhoneCall className="mr-1 h-4 w-4" /> Call
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => logActivity("email", "Logged an email")}>
                        <Send className="mr-1 h-4 w-4" /> Email
                    </Button>

                    {/* Log Outcome Button */}
                    <Dialog open={outcomeOpen} onOpenChange={(open) => {
                        setOutcomeOpen(open);
                        if (!open) resetOutcomeForm();
                    }}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700">
                                <ClipboardList className="mr-1 h-4 w-4" /> Log Outcome
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Log Call Outcome</DialogTitle>
                            </DialogHeader>

                            {/* Step 1: Select Outcome */}
                            {!selectedOutcome ? (
                                <div className="grid grid-cols-1 gap-2 py-2">
                                    {(Object.entries(OUTCOME_CONFIG) as [CallOutcome, typeof OUTCOME_CONFIG[CallOutcome]][]).map(
                                        ([key, config]) => (
                                            <button
                                                key={key}
                                                onClick={() => setSelectedOutcome(key)}
                                                className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all hover:scale-[1.02] hover:shadow-md ${config.color}`}
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
                                /* Step 2: Outcome-specific form */
                                <div className="space-y-4 py-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setSelectedOutcome(null)}
                                            className="text-sm text-slate-500 hover:text-slate-700"
                                        >
                                            ← Back
                                        </button>
                                        <Badge className={OUTCOME_CONFIG[selectedOutcome].color}>
                                            {OUTCOME_CONFIG[selectedOutcome].icon} {OUTCOME_CONFIG[selectedOutcome].label}
                                        </Badge>
                                    </div>

                                    {/* Callback fields */}
                                    {(selectedOutcome === "callback" || selectedOutcome === "callback_priority") && (
                                        <div className="space-y-2">
                                            <Label>Callback Date & Time</Label>
                                            <Input
                                                type="datetime-local"
                                                value={callbackDate}
                                                onChange={(e) => setCallbackDate(e.target.value)}
                                                required
                                            />
                                            {selectedOutcome === "callback_priority" && (
                                                <p className="text-xs text-orange-600">
                                                    🔥 This will create a priority reminder that surfaces first
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Invalid fields */}
                                    {selectedOutcome === "invalid" && (
                                        <div className="space-y-2">
                                            <Label>Reason</Label>
                                            <Select value={invalidReason} onValueChange={(v) => setInvalidReason(v as InvalidReason)}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(Object.entries(INVALID_REASONS) as [InvalidReason, string][]).map(
                                                        ([key, label]) => (
                                                            <SelectItem key={key} value={key}>
                                                                {label}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {/* Meeting fields */}
                                    {selectedOutcome === "meeting_booked" && (
                                        <div className="space-y-2">
                                            <Label>Meeting Date & Time</Label>
                                            <Input
                                                type="datetime-local"
                                                value={meetingDate}
                                                onChange={(e) => setMeetingDate(e.target.value)}
                                                required
                                            />
                                        </div>
                                    )}

                                    {/* Sale fields */}
                                    {selectedOutcome === "sale_made" && (
                                        <div className="space-y-3">
                                            <div className="space-y-2">
                                                <Label>Package Sold</Label>
                                                <Select value={packageSold} onValueChange={setPackageSold}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select package..." />
                                                    </SelectTrigger>
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
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="e.g. 99.00"
                                                    value={saleValue}
                                                    onChange={(e) => setSaleValue(e.target.value)}
                                                />
                                                {packageSold && !saleValue && (
                                                    <button
                                                        type="button"
                                                        className="text-xs text-blue-600 hover:underline"
                                                        onClick={() => {
                                                            const pkg = PACKAGES.find((p) => p.name === packageSold);
                                                            if (pkg) setSaleValue(pkg.price.toString());
                                                        }}
                                                    >
                                                        Auto-fill: €{PACKAGES.find((p) => p.name === packageSold)?.price}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Notes (all outcomes) */}
                                    <div className="space-y-2">
                                        <Label>Notes (optional)</Label>
                                        <Textarea
                                            placeholder="Add any additional notes..."
                                            value={outcomeNotes}
                                            onChange={(e) => setOutcomeNotes(e.target.value)}
                                            rows={3}
                                        />
                                    </div>

                                    {/* Submit */}
                                    <Button
                                        onClick={handleSubmitOutcome}
                                        disabled={outcomeSaving}
                                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                                    >
                                        {outcomeSaving ? "Saving..." : "Save Outcome"}
                                    </Button>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* LEFT: Contact Info */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base">Contact Info</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
                                {editing ? "Cancel" : "Edit"}
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {editing ? (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-xs">First Name</Label>
                                            <Input value={editForm.first_name || ""} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Last Name</Label>
                                            <Input value={editForm.last_name || ""} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
                                        </div>
                                    </div>
                                    <div><Label className="text-xs">Email</Label><Input value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
                                    <div><Label className="text-xs">Phone</Label><Input value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
                                    <div><Label className="text-xs">Company</Label><Input value={editForm.company_name || ""} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} /></div>
                                    <div><Label className="text-xs">Function</Label><Input value={editForm.function || ""} onChange={(e) => setEditForm({ ...editForm, function: e.target.value })} /></div>
                                    <div><Label className="text-xs">Location</Label><Input value={editForm.location || ""} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} /></div>
                                    <Button onClick={handleSaveEdit} className="w-full">Save</Button>
                                </div>
                            ) : (
                                <>
                                    {contact.email && <InfoRow icon={<Mail className="h-4 w-4" />} value={contact.email} />}
                                    {contact.phone && <InfoRow icon={<Phone className="h-4 w-4" />} value={contact.phone} />}
                                    {contact.company_name && <InfoRow icon={<Building2 className="h-4 w-4" />} value={contact.company_name} />}
                                    {contact.location && <InfoRow icon={<MapPin className="h-4 w-4" />} value={contact.location} />}
                                    {contact.linkedin_url && (
                                        <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-blue-600 hover:underline">
                                            <Linkedin className="h-4 w-4" /> LinkedIn Profile
                                        </a>
                                    )}
                                    {contact.website && (
                                        <a href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-blue-600 hover:underline">
                                            <Globe className="h-4 w-4" /> {contact.website}
                                        </a>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Reminders */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Bell className="h-4 w-4" /> Reminders
                            </CardTitle>
                            <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm"><Plus className="h-4 w-4" /></Button>
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
                        <CardContent>
                            {reminders.length === 0 ? (
                                <p className="text-sm text-slate-400">No reminders</p>
                            ) : (
                                <div className="space-y-2">
                                    {/* Sort: priority first, then by date */}
                                    {[...reminders]
                                        .sort((a, b) => {
                                            if (a.is_priority && !b.is_priority) return -1;
                                            if (!a.is_priority && b.is_priority) return 1;
                                            return 0;
                                        })
                                        .map((r) => (
                                            <div key={r.id} className={`flex items-center justify-between rounded-lg border p-3 ${r.is_done ? "opacity-50" : ""} ${r.is_priority && !r.is_done ? "border-orange-300 bg-orange-50" : ""}`}>
                                                <div>
                                                    <p className={`text-sm ${r.is_done ? "line-through" : "font-medium"}`}>
                                                        {r.is_priority && !r.is_done && <span className="mr-1">🔥</span>}
                                                        {r.title}
                                                    </p>
                                                    <p className="text-xs text-slate-500">{formatDate(r.due_date)}</p>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => handleToggleReminder(r.id, r.is_done)}>
                                                    <CheckCircle2 className={`h-4 w-4 ${r.is_done ? "text-green-500" : "text-slate-300"}`} />
                                                </Button>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* MIDDLE: Notes + Call Log History */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" /> Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleAddNote} className="mb-4 flex gap-2">
                                <Textarea
                                    placeholder="Write a note..."
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    rows={2}
                                    className="flex-1"
                                />
                                <Button type="submit" size="sm" className="self-end">
                                    Add
                                </Button>
                            </form>
                            <Separator className="mb-4" />
                            {notes.length === 0 ? (
                                <p className="text-sm text-slate-400">No notes yet</p>
                            ) : (
                                <div className="space-y-4">
                                    {notes.map((n) => (
                                        <div key={n.id} className="rounded-lg bg-slate-50 p-3">
                                            <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                                            <p className="mt-2 text-xs text-slate-400">{formatDate(n.created_at)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Call Log History */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <ClipboardList className="h-4 w-4" /> Call Log History
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {callLogs.length === 0 ? (
                                <p className="text-sm text-slate-400">No call logs yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {callLogs.map((log) => (
                                        <div
                                            key={log.id}
                                            className={`rounded-lg border-2 p-3 ${OUTCOME_CONFIG[log.outcome]?.color || "border-slate-200"}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span>{OUTCOME_CONFIG[log.outcome]?.icon}</span>
                                                    <span className="font-medium text-sm">
                                                        {OUTCOME_CONFIG[log.outcome]?.label}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-slate-500">
                                                    {formatDate(log.created_at)}
                                                </span>
                                            </div>
                                            {/* Outcome details */}
                                            <div className="mt-2 space-y-1 text-xs">
                                                {log.callback_date && (
                                                    <p>📞 Callback: {formatDate(log.callback_date)}</p>
                                                )}
                                                {log.invalid_reason && (
                                                    <p>Reason: {INVALID_REASONS[log.invalid_reason as keyof typeof INVALID_REASONS] || log.invalid_reason}</p>
                                                )}
                                                {log.meeting_date && (
                                                    <p>📅 Meeting: {formatDate(log.meeting_date)}</p>
                                                )}
                                                {log.package_sold && (
                                                    <p>📦 Package: {log.package_sold}</p>
                                                )}
                                                {log.sale_value && (
                                                    <p>💰 Value: €{Number(log.sale_value).toFixed(2)}</p>
                                                )}
                                                {log.notes && (
                                                    <p className="mt-1 text-slate-600 italic">&quot;{log.notes}&quot;</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT: Activity Log */}
                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Activity Log</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {activities.length === 0 ? (
                                <p className="text-sm text-slate-400">No activity yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {activities.map((a) => (
                                        <div key={a.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
                                            <div className="mt-0.5">
                                                {a.type === "call" && <PhoneCall className="h-4 w-4 text-blue-500" />}
                                                {a.type === "email" && <Send className="h-4 w-4 text-green-500" />}
                                                {a.type === "meeting" && <Calendar className="h-4 w-4 text-purple-500" />}
                                                {a.type === "note" && <MessageSquare className="h-4 w-4 text-orange-500" />}
                                                {a.type === "status_change" && <CheckCircle2 className="h-4 w-4 text-slate-500" />}
                                                {a.type === "outcome_logged" && <ClipboardList className="h-4 w-4 text-indigo-500" />}
                                            </div>
                                            <div>
                                                <p className="text-sm">{a.description}</p>
                                                <p className="text-xs text-slate-400">{formatDate(a.created_at)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function InfoRow({ icon, value }: { icon: React.ReactNode; value: string }) {
    return (
        <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="text-slate-400">{icon}</span>
            {value}
        </div>
    );
}
