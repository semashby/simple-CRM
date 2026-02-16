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
} from "lucide-react";
import type { Contact, Note, Activity, Reminder, ContactStatus } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/types";

export default function ContactDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const supabase = createClient();

    const [contact, setContact] = useState<Contact | null>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [newNote, setNewNote] = useState("");
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Contact>>({});

    // Reminder form
    const [reminderOpen, setReminderOpen] = useState(false);
    const [reminderTitle, setReminderTitle] = useState("");
    const [reminderDate, setReminderDate] = useState("");

    const fetchAll = useCallback(async () => {
        const [contactRes, notesRes, actRes, remRes] = await Promise.all([
            supabase.from("contacts").select("*").eq("id", id).single(),
            supabase.from("notes").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
            supabase.from("activities").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
            supabase.from("reminders").select("*").eq("contact_id", id).order("due_date", { ascending: true }),
        ]);

        if (contactRes.data) {
            setContact(contactRes.data);
            setEditForm(contactRes.data);
        }
        setNotes(notesRes.data || []);
        setActivities(actRes.data || []);
        setReminders(remRes.data || []);
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
                    <Button variant="outline" size="sm" onClick={() => logActivity("meeting", "Logged a meeting")}>
                        <Calendar className="mr-1 h-4 w-4" /> Meeting
                    </Button>
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
                                    {reminders.map((r) => (
                                        <div key={r.id} className={`flex items-center justify-between rounded-lg border p-3 ${r.is_done ? "opacity-50" : ""}`}>
                                            <div>
                                                <p className={`text-sm ${r.is_done ? "line-through" : "font-medium"}`}>{r.title}</p>
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

                {/* MIDDLE: Notes */}
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
