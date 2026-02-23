"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectSelector } from "@/components/project-selector";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Search, Plus, ChevronLeft, ChevronRight, Flame, PhoneCall, Trash2, UserPlus, ArrowRightLeft, X, AlertTriangle, FolderOpen, Users, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Contact, ContactStatus, Profile, Project } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const PAGE_SIZE = 20;

// Type for contact with callback metadata
interface ContactWithCallback extends Contact {
    _hasPriorityCallback?: boolean;
    _hasDueCallback?: boolean;
    _callbackDate?: string | null;
}

export default function ContactsPage() {
    const supabase = createClient();
    const router = useRouter();
    const [contacts, setContacts] = useState<ContactWithCallback[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [projectId, setProjectId] = useState("");
    const [addOpen, setAddOpen] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [unassignedCount, setUnassignedCount] = useState(0);
    const [projectStats, setProjectStats] = useState<Record<string, { total: number; newCount: number; callbacks: number; priority: number }>>({});
    const [loading, setLoading] = useState(true);

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [bulkAssignUser, setBulkAssignUser] = useState("");
    const [bulkStatus, setBulkStatus] = useState("");
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [userRole, setUserRole] = useState("agent");
    const [clearingUnassigned, setClearingUnassigned] = useState(false);
    const [clearUnassignedConfirm, setClearUnassignedConfirm] = useState(false);

    // New contact form
    const [newContact, setNewContact] = useState({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        company_name: "",
        function: "",
    });

    // Fetch profiles, projects, and check role
    useEffect(() => {
        const init = async () => {
            const { data: profilesData } = await supabase.from("profiles").select("*").order("full_name");
            if (profilesData) setProfiles(profilesData as Profile[]);

            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user) {
                const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
                if (profile?.role) setUserRole(profile.role);
            }

            // Fetch projects for landing screen
            const { data: projectsData } = await supabase
                .from("projects")
                .select("*")
                .neq("status", "archived")
                .order("created_at", { ascending: false });
            if (projectsData) setProjects(projectsData);

            // Count unassigned contacts
            const { count: unassigned } = await supabase
                .from("contacts")
                .select("*", { count: "exact", head: true })
                .is("project_id", null);
            setUnassignedCount(unassigned || 0);

            // Fetch per-project stats
            const projectIds = (projectsData || []).map((p: Project) => p.id);
            const allProjectIds = [...projectIds, "__all__", "__unassigned__"];

            const statsMap: Record<string, { total: number; newCount: number; callbacks: number; priority: number }> = {};

            await Promise.all(
                allProjectIds.map(async (pid: string) => {
                    // Total contacts
                    let totalQ = supabase.from("contacts").select("*", { count: "exact", head: true });
                    if (pid === "__unassigned__") totalQ = totalQ.is("project_id", null);
                    else if (pid !== "__all__") totalQ = totalQ.eq("project_id", pid);
                    const { count: total } = await totalQ;

                    // New/unprocessed contacts
                    let newQ = supabase.from("contacts").select("*", { count: "exact", head: true }).eq("status", "new");
                    if (pid === "__unassigned__") newQ = newQ.is("project_id", null);
                    else if (pid !== "__all__") newQ = newQ.eq("project_id", pid);
                    const { count: newCount } = await newQ;

                    // Callbacks (pending reminders)
                    let contactIdsQ = supabase.from("contacts").select("id");
                    if (pid === "__unassigned__") contactIdsQ = contactIdsQ.is("project_id", null);
                    else if (pid !== "__all__") contactIdsQ = contactIdsQ.eq("project_id", pid);
                    const { data: contactsForReminders } = await contactIdsQ;
                    const cIds = (contactsForReminders || []).map((c: { id: string }) => c.id);

                    let callbacks = 0;
                    let priority = 0;
                    if (cIds.length > 0) {
                        const { data: reminders } = await supabase
                            .from("reminders")
                            .select("is_priority")
                            .in("contact_id", cIds.slice(0, 500))
                            .eq("is_done", false);
                        callbacks = reminders?.length || 0;
                        priority = reminders?.filter((r: { is_priority: boolean }) => r.is_priority).length || 0;
                    }

                    statsMap[pid] = { total: total || 0, newCount: newCount || 0, callbacks, priority };
                })
            );

            setProjectStats(statsMap);
        };
        init();
    }, []);

    const fetchContacts = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        let query = supabase
            .from("contacts")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (projectId === "unassigned") {
            query = query.is("project_id", null);
        } else if (projectId !== "all") {
            query = query.eq("project_id", projectId);
        }
        if (statusFilter !== "all") query = query.eq("status", statusFilter);
        if (search) {
            query = query.or(
                `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`
            );
        }

        const { data, count } = await query;
        const contactsData = data || [];

        // Fetch pending reminders for callback metadata
        if (contactsData.length > 0) {
            const contactIds = contactsData.map((c: Contact) => c.id);
            const { data: reminders } = await supabase
                .from("reminders")
                .select("contact_id, is_priority, due_date, title")
                .in("contact_id", contactIds)
                .eq("is_done", false);

            const callbackMap = new Map<string, { hasPriority: boolean; hasDue: boolean; callbackDate: string | null }>();
            const now = new Date();

            for (const r of reminders || []) {
                const existing = callbackMap.get(r.contact_id) || { hasPriority: false, hasDue: false, callbackDate: null };
                if (r.is_priority) existing.hasPriority = true;
                if (new Date(r.due_date) <= now) existing.hasDue = true;
                if (!existing.callbackDate || new Date(r.due_date) < new Date(existing.callbackDate)) {
                    existing.callbackDate = r.due_date;
                }
                callbackMap.set(r.contact_id, existing);
            }

            const enriched: ContactWithCallback[] = contactsData.map((c: Contact) => {
                const cb = callbackMap.get(c.id);
                return {
                    ...c,
                    _hasPriorityCallback: cb?.hasPriority || false,
                    _hasDueCallback: cb?.hasDue || false,
                    _callbackDate: cb?.callbackDate || null,
                };
            });

            enriched.sort((a, b) => {
                if (a._hasPriorityCallback && !b._hasPriorityCallback) return -1;
                if (!a._hasPriorityCallback && b._hasPriorityCallback) return 1;
                if (a._hasDueCallback && !b._hasDueCallback) return -1;
                if (!a._hasDueCallback && b._hasDueCallback) return 1;
                if (a._callbackDate && !b._callbackDate) return -1;
                if (!a._callbackDate && b._callbackDate) return 1;
                if (a._callbackDate && b._callbackDate) {
                    return new Date(a._callbackDate).getTime() - new Date(b._callbackDate).getTime();
                }
                return 0;
            });

            setContacts(enriched);
        } else {
            setContacts(contactsData);
        }

        setTotalCount(count || 0);
        setLoading(false);
    }, [page, projectId, statusFilter, search]);

    useEffect(() => {
        fetchContacts();
    }, [fetchContacts]);

    const handleAddContact = async (e: React.FormEvent) => {
        e.preventDefault();
        const { data: userData } = await supabase.auth.getUser();

        await supabase.from("contacts").insert({
            ...newContact,
            project_id: projectId !== "all" ? projectId : null,
            created_by: userData.user?.id,
            source: "Manual",
        });

        setAddOpen(false);
        setNewContact({
            first_name: "",
            last_name: "",
            email: "",
            phone: "",
            company_name: "",
            function: "",
        });
        fetchContacts();
    };

    // ─── Bulk actions ───
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === contacts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(contacts.map((c) => c.id)));
        }
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
        setBulkAssignUser("");
        setBulkStatus("");
    };

    const handleBulkAssign = async () => {
        if (!bulkAssignUser || selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        await supabase.from("contacts").update({ assigned_to: bulkAssignUser }).in("id", ids);
        clearSelection();
        fetchContacts();
    };

    const handleBulkStatusChange = async () => {
        if (!bulkStatus || selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        await supabase.from("contacts").update({ status: bulkStatus }).in("id", ids);
        clearSelection();
        fetchContacts();
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        setBulkDeleting(true);
        const ids = Array.from(selectedIds);
        await supabase.from("reminders").delete().in("contact_id", ids);
        await supabase.from("activities").delete().in("contact_id", ids);
        await supabase.from("call_logs").delete().in("contact_id", ids);
        await supabase.from("contacts").delete().in("id", ids);
        clearSelection();
        setBulkDeleting(false);
        fetchContacts();
    };

    const handleClearAllUnassigned = async () => {
        if (!clearUnassignedConfirm) {
            setClearUnassignedConfirm(true);
            return;
        }
        setClearingUnassigned(true);
        try {
            // Get all unassigned contact IDs
            const { data: unassignedContacts } = await supabase
                .from("contacts")
                .select("id")
                .is("project_id", null);

            if (!unassignedContacts || unassignedContacts.length === 0) {
                setClearingUnassigned(false);
                setClearUnassignedConfirm(false);
                return;
            }

            const allIds = unassignedContacts.map((c: { id: string }) => c.id);

            // Delete in batches of 500
            for (let i = 0; i < allIds.length; i += 500) {
                const batch = allIds.slice(i, i + 500);
                await supabase.from("reminders").delete().in("contact_id", batch);
                await supabase.from("activities").delete().in("contact_id", batch);
                await supabase.from("call_logs").delete().in("contact_id", batch);
                await supabase.from("contacts").delete().in("id", batch);
            }

            fetchContacts();
        } catch (err) {
            console.error("Failed to clear unassigned contacts:", err);
        } finally {
            setClearingUnassigned(false);
            setClearUnassignedConfirm(false);
        }
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const isAdmin = userRole === "admin" || userRole === "super_admin";

    const formatCallbackDate = (d: string) => {
        const date = new Date(d);
        const now = new Date();
        const isOverdue = date <= now;
        const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return { label, isOverdue };
    };

    // ─── Project Selection Landing Screen ───
    if (!projectId) {
        const StatBadge = ({ label, value, color }: { label: string; value: number; color: string }) => (
            <div className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${color}`}>
                <span>{value}</span>
                <span className="opacity-70">{label}</span>
            </div>
        );

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Contacts</h1>
                    <p className="text-sm text-slate-500">Select a list to view contacts</p>
                </div>
                <div className="flex flex-col gap-3">
                    {/* All contacts card */}
                    <Card
                        className="cursor-pointer transition-all hover:shadow-md hover:border-cyan-300 border-2 border-transparent"
                        onClick={() => setProjectId("all")}
                    >
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 shrink-0">
                                <Users className="h-5 w-5 text-slate-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-900">All Contacts</p>
                                <p className="text-sm text-slate-500">View all contacts across lists</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {projectStats["__all__"] && (
                                    <>
                                        <StatBadge label="leads" value={projectStats["__all__"].total} color="bg-slate-100 text-slate-700" />
                                        <StatBadge label="new" value={projectStats["__all__"].newCount} color="bg-cyan-50 text-cyan-700" />
                                        <StatBadge label="callbacks" value={projectStats["__all__"].callbacks} color="bg-yellow-50 text-yellow-700" />
                                        {projectStats["__all__"].priority > 0 && (
                                            <StatBadge label="priority" value={projectStats["__all__"].priority} color="bg-orange-50 text-orange-700" />
                                        )}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Project cards */}
                    {projects.map((project) => {
                        const stats = projectStats[project.id];
                        return (
                            <Card
                                key={project.id}
                                className="cursor-pointer transition-all hover:shadow-md hover:border-cyan-300 border-2 border-transparent"
                                onClick={() => setProjectId(project.id)}
                            >
                                <CardContent className="flex items-center gap-4 p-5">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 shrink-0">
                                        <FolderOpen className="h-5 w-5 text-cyan-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-900">{project.name}</p>
                                        {project.description && (
                                            <p className="text-sm text-slate-500 line-clamp-1">{project.description}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {stats && (
                                            <>
                                                <StatBadge label="leads" value={stats.total} color="bg-slate-100 text-slate-700" />
                                                <StatBadge label="new" value={stats.newCount} color="bg-cyan-50 text-cyan-700" />
                                                <StatBadge label="callbacks" value={stats.callbacks} color="bg-yellow-50 text-yellow-700" />
                                                {stats.priority > 0 && (
                                                    <StatBadge label="priority" value={stats.priority} color="bg-orange-50 text-orange-700" />
                                                )}
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {/* Unassigned card */}
                    {unassignedCount > 0 && (
                        <Card
                            className="cursor-pointer transition-all hover:shadow-md hover:border-orange-300 border-2 border-transparent"
                            onClick={() => setProjectId("unassigned")}
                        >
                            <CardContent className="flex items-center gap-4 p-5">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 shrink-0">
                                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-900">Unassigned</p>
                                    <p className="text-sm text-orange-600">Contacts without a list</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {projectStats["__unassigned__"] && (
                                        <>
                                            <StatBadge label="leads" value={projectStats["__unassigned__"].total} color="bg-orange-50 text-orange-700" />
                                            <StatBadge label="new" value={projectStats["__unassigned__"].newCount} color="bg-cyan-50 text-cyan-700" />
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setProjectId("")} className="text-slate-500 hover:text-slate-900 -ml-2">
                            ← Lists
                        </Button>
                        <span className="text-slate-300">/</span>
                        <h1 className="text-2xl font-semibold text-slate-900">Contacts</h1>
                    </div>
                    <p className="text-sm text-slate-500">
                        {totalCount} total contacts
                    </p>
                </div>
                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Contact
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Contact</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddContact} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>First Name *</Label>
                                    <Input
                                        value={newContact.first_name}
                                        onChange={(e) =>
                                            setNewContact({ ...newContact, first_name: e.target.value })
                                        }
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Last Name</Label>
                                    <Input
                                        value={newContact.last_name}
                                        onChange={(e) =>
                                            setNewContact({ ...newContact, last_name: e.target.value })
                                        }
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    value={newContact.email}
                                    onChange={(e) =>
                                        setNewContact({ ...newContact, email: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input
                                    value={newContact.phone}
                                    onChange={(e) =>
                                        setNewContact({ ...newContact, phone: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Company</Label>
                                <Input
                                    value={newContact.company_name}
                                    onChange={(e) =>
                                        setNewContact({ ...newContact, company_name: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Function / Title</Label>
                                <Input
                                    value={newContact.function}
                                    onChange={(e) =>
                                        setNewContact({ ...newContact, function: e.target.value })
                                    }
                                />
                            </div>
                            <Button type="submit" className="w-full">
                                Add Contact
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder="Search contacts..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(0);
                        }}
                        className="pl-9"
                    />
                </div>
                <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                        setStatusFilter(v);
                        setPage(0);
                    }}
                >
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                            <SelectItem key={key} value={key}>
                                {val.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <ProjectSelector value={projectId} onChange={(v) => { setProjectId(v); setPage(0); setClearUnassignedConfirm(false); }} />

                {/* Clear All Unassigned */}
                {projectId === "unassigned" && isAdmin && (
                    <div className="flex items-center gap-2">
                        {clearUnassignedConfirm && !clearingUnassigned && (
                            <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                This will delete {totalCount} contacts permanently!
                            </span>
                        )}
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleClearAllUnassigned}
                            disabled={clearingUnassigned || totalCount === 0}
                        >
                            <Trash2 className="mr-1.5 h-4 w-4" />
                            {clearingUnassigned
                                ? "Clearing..."
                                : clearUnassignedConfirm
                                    ? "Confirm Delete All"
                                    : `Clear All Unassigned (${totalCount})`}
                        </Button>
                        {clearUnassignedConfirm && !clearingUnassigned && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setClearUnassignedConfirm(false)}
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="rounded-lg border border-slate-200 bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px]">
                                <Checkbox
                                    checked={contacts.length > 0 && selectedIds.size === contacts.length}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead className="w-[30px]"></TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Callback</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : contacts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                                    No contacts found
                                </TableCell>
                            </TableRow>
                        ) : (
                            contacts.map((contact) => {
                                const cb = contact._callbackDate ? formatCallbackDate(contact._callbackDate) : null;
                                const isSelected = selectedIds.has(contact.id);
                                return (
                                    <TableRow
                                        key={contact.id}
                                        className={`cursor-pointer hover:bg-slate-50 ${isSelected
                                            ? "bg-cyan-50/60 hover:bg-cyan-50"
                                            : contact._hasPriorityCallback
                                                ? "bg-orange-50/60 hover:bg-orange-50"
                                                : contact._hasDueCallback
                                                    ? "bg-yellow-50/40 hover:bg-yellow-50"
                                                    : ""
                                            }`}
                                    >
                                        <TableCell className="w-[40px]" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => toggleSelect(contact.id)}
                                            />
                                        </TableCell>
                                        {/* Priority indicator */}
                                        <TableCell
                                            className="w-[30px] pr-0"
                                            onClick={() => router.push(`/contacts/${contact.id}`)}
                                        >
                                            {contact._hasPriorityCallback ? (
                                                <Flame className="h-4 w-4 text-orange-500" />
                                            ) : contact._hasDueCallback ? (
                                                <PhoneCall className="h-4 w-4 text-yellow-600" />
                                            ) : null}
                                        </TableCell>
                                        <TableCell
                                            className="font-medium"
                                            onClick={() => router.push(`/contacts/${contact.id}`)}
                                        >
                                            {contact.first_name} {contact.last_name}
                                        </TableCell>
                                        <TableCell
                                            className="text-slate-600"
                                            onClick={() => router.push(`/contacts/${contact.id}`)}
                                        >
                                            {contact.company_name || "—"}
                                        </TableCell>
                                        <TableCell
                                            className="text-slate-500"
                                            onClick={() => router.push(`/contacts/${contact.id}`)}
                                        >
                                            {contact.phone || "—"}
                                        </TableCell>
                                        <TableCell onClick={() => router.push(`/contacts/${contact.id}`)}>
                                            <Badge
                                                variant="secondary"
                                                className={STATUS_CONFIG[contact.status]?.color}
                                            >
                                                {STATUS_CONFIG[contact.status]?.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell onClick={() => router.push(`/contacts/${contact.id}`)}>
                                            {cb ? (
                                                <span className={`inline-flex items-center gap-1 text-xs font-medium ${cb.isOverdue ? "text-red-600" : "text-slate-500"
                                                    }`}>
                                                    {cb.isOverdue ? "📞 Overdue" : `📅 ${cb.label}`}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                        Page {page + 1} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(Math.max(0, page - 1))}
                            disabled={page === 0}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                            disabled={page >= totalPages - 1}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* ─── Floating Bulk Actions Bar ─── */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-2xl">
                    <span className="text-sm font-medium text-slate-700">
                        {selectedIds.size} selected
                    </span>

                    <div className="h-5 w-px bg-slate-200" />

                    {/* Assign To */}
                    {isAdmin && (
                        <div className="flex items-center gap-1.5">
                            <UserPlus className="h-4 w-4 text-slate-500" />
                            <Select value={bulkAssignUser} onValueChange={(v) => { setBulkAssignUser(v); }}>
                                <SelectTrigger className="h-8 w-[150px] text-xs">
                                    <SelectValue placeholder="Assign to..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {profiles.map((p) => (
                                        <SelectItem key={p.id} value={p.id} className="text-xs">
                                            {p.full_name || p.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {bulkAssignUser && (
                                <Button size="sm" className="h-8 text-xs" onClick={handleBulkAssign}>
                                    Apply
                                </Button>
                            )}
                        </div>
                    )}

                    <div className="h-5 w-px bg-slate-200" />

                    {/* Change Status */}
                    <div className="flex items-center gap-1.5">
                        <ArrowRightLeft className="h-4 w-4 text-slate-500" />
                        <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v)}>
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                                <SelectValue placeholder="Set status..." />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                                    <SelectItem key={key} value={key} className="text-xs">
                                        {val.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {bulkStatus && (
                            <Button size="sm" className="h-8 text-xs" onClick={handleBulkStatusChange}>
                                Apply
                            </Button>
                        )}
                    </div>

                    {/* Delete (super_admin only) */}
                    {isAdmin && (
                        <>
                            <div className="h-5 w-px bg-slate-200" />
                            <Button
                                size="sm"
                                variant="destructive"
                                className="h-8 text-xs"
                                onClick={handleBulkDelete}
                                disabled={bulkDeleting}
                            >
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                {bulkDeleting ? "Deleting..." : "Delete"}
                            </Button>
                        </>
                    )}

                    <div className="h-5 w-px bg-slate-200" />

                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clearSelection}>
                        <X className="mr-1 h-3.5 w-3.5" /> Clear
                    </Button>
                </div>
            )}
        </div>
    );
}
