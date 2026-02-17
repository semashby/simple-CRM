"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Users,
    Shield,
    Building2,
    Clock,
    Flame,
    UserPlus,
    Trash2,
    Crown,
    ShieldCheck,
    User,
} from "lucide-react";
import type { Profile, Project, Contact, Reminder } from "@/lib/types";
import { useRouter } from "next/navigation";

const ROLE_LEVEL: Record<string, number> = {
    agent: 1,
    admin: 2,
    super_admin: 3,
};

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: typeof Shield }> = {
    agent: { label: "Agent", color: "bg-slate-100 text-slate-700", icon: User },
    admin: { label: "Admin", color: "bg-cyan-100 text-cyan-700", icon: ShieldCheck },
    super_admin: { label: "Super Admin", color: "bg-amber-100 text-amber-700", icon: Crown },
};

interface TeamMemberStats {
    profile: Profile;
    contactCount: number;
    callsTotal: number;
    callsThisWeek: number;
    meetingsBooked: number;
    salesMade: number;
    revenue: number;
    pendingReminders: number;
    overdueReminders: number;
}

interface ProjectAssignment {
    project: Project;
    contactCount: number;
    assignedUsers: { userId: string; count: number }[];
}

export default function AdminPage() {
    const supabase = createClient();
    const router = useRouter();

    const [currentUserRole, setCurrentUserRole] = useState<string>("agent");
    const [currentUserId, setCurrentUserId] = useState<string>("");
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);
    const [projectAssignments, setProjectAssignments] = useState<ProjectAssignment[]>([]);
    const [upcomingCallbacks, setUpcomingCallbacks] = useState<(Reminder & { contact?: Contact; profile?: Profile })[]>([]);
    const [loading, setLoading] = useState(true);
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<string>("");
    const [selectedUser, setSelectedUser] = useState<string>("");
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const isSuperAdmin = currentUserRole === "super_admin";

    const fetchData = useCallback(async () => {
        setLoading(true);
        const now = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Get current user
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
            setCurrentUserId(userData.user.id);
            const { data: myProfile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", userData.user.id)
                .single();
            if (myProfile?.role) setCurrentUserRole(myProfile.role);
        }

        // Fetch profiles
        const { data: profilesData } = await supabase
            .from("profiles")
            .select("*")
            .order("full_name");
        const allProfiles = (profilesData as Profile[]) || [];
        setProfiles(allProfiles);

        // Fetch projects
        const { data: projectsData } = await supabase
            .from("projects")
            .select("*")
            .order("name");
        const allProjects = (projectsData as Project[]) || [];
        setProjects(allProjects);

        // Per-user stats
        const stats: TeamMemberStats[] = await Promise.all(
            allProfiles.map(async (profile) => {
                const { count: contactCount } = await supabase
                    .from("contacts")
                    .select("*", { count: "exact" })
                    .eq("assigned_to", profile.id);

                const { count: callsTotal } = await supabase
                    .from("call_logs")
                    .select("*", { count: "exact" })
                    .eq("created_by", profile.id);

                const { count: callsThisWeek } = await supabase
                    .from("call_logs")
                    .select("*", { count: "exact" })
                    .eq("created_by", profile.id)
                    .gte("created_at", weekAgo.toISOString());

                const { count: meetingsBooked } = await supabase
                    .from("call_logs")
                    .select("*", { count: "exact" })
                    .eq("created_by", profile.id)
                    .eq("outcome", "meeting_booked");

                const { data: salesData } = await supabase
                    .from("call_logs")
                    .select("sale_value")
                    .eq("created_by", profile.id)
                    .eq("outcome", "sale_made")
                    .gte("created_at", monthStart.toISOString());
                const salesMade = salesData?.length || 0;
                const revenue = (salesData || []).reduce(
                    (sum: number, s: { sale_value: number | null }) => sum + (s.sale_value || 0),
                    0
                );

                const { count: pendingReminders } = await supabase
                    .from("reminders")
                    .select("*", { count: "exact" })
                    .eq("assigned_to", profile.id)
                    .eq("is_done", false);

                const { count: overdueReminders } = await supabase
                    .from("reminders")
                    .select("*", { count: "exact" })
                    .eq("assigned_to", profile.id)
                    .eq("is_done", false)
                    .lt("due_date", now.toISOString());

                return {
                    profile,
                    contactCount: contactCount || 0,
                    callsTotal: callsTotal || 0,
                    callsThisWeek: callsThisWeek || 0,
                    meetingsBooked: meetingsBooked || 0,
                    salesMade,
                    revenue,
                    pendingReminders: pendingReminders || 0,
                    overdueReminders: overdueReminders || 0,
                };
            })
        );
        setTeamStats(stats);

        // Project assignments
        const assignments: ProjectAssignment[] = await Promise.all(
            allProjects.map(async (project) => {
                const { data: contacts, count } = await supabase
                    .from("contacts")
                    .select("assigned_to", { count: "exact" })
                    .eq("project_id", project.id);

                const userCounts = new Map<string, number>();
                (contacts || []).forEach((c: { assigned_to: string | null }) => {
                    if (c.assigned_to) {
                        userCounts.set(c.assigned_to, (userCounts.get(c.assigned_to) || 0) + 1);
                    }
                });

                return {
                    project,
                    contactCount: count || 0,
                    assignedUsers: Array.from(userCounts.entries()).map(([userId, cnt]) => ({
                        userId,
                        count: cnt,
                    })),
                };
            })
        );
        setProjectAssignments(assignments);

        // Upcoming callbacks across team
        const { data: reminders } = await supabase
            .from("reminders")
            .select("*, contact:contacts(*)")
            .eq("is_done", false)
            .order("is_priority", { ascending: false })
            .order("due_date", { ascending: true })
            .limit(15);

        const enrichedReminders = (reminders || []).map((r: Reminder & { contact?: unknown }) => {
            const assignedProfile = allProfiles.find((p) => p.id === r.assigned_to);
            return { ...r, profile: assignedProfile };
        });
        setUpcomingCallbacks(enrichedReminders as never[]);

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ─── Actions ───
    const handleBulkAssign = async () => {
        if (!selectedProject || !selectedUser) return;
        await supabase
            .from("contacts")
            .update({ assigned_to: selectedUser })
            .eq("project_id", selectedProject)
            .is("assigned_to", null);
        setAssignDialogOpen(false);
        setSelectedProject("");
        setSelectedUser("");
        fetchData();
    };

    const handleAssignAllInProject = async (projectId: string, userId: string) => {
        await supabase
            .from("contacts")
            .update({ assigned_to: userId })
            .eq("project_id", projectId);
        fetchData();
    };

    const handleChangeRole = async (userId: string, newRole: string) => {
        if (userId === currentUserId) return; // Can't change own role
        await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
        fetchData();
    };

    const handleDeleteUser = async (userId: string) => {
        if (userId === currentUserId) return;
        // Unassign their contacts, then delete profile
        await supabase.from("contacts").update({ assigned_to: null }).eq("assigned_to", userId);
        await supabase.from("reminders").update({ assigned_to: null }).eq("assigned_to", userId);
        await supabase.from("profiles").delete().eq("id", userId);
        setDeleteConfirm(null);
        fetchData();
    };

    const handleDeleteProject = async (projectId: string) => {
        // Unlink contacts from project, then delete
        await supabase.from("contacts").update({ project_id: null }).eq("project_id", projectId);
        await supabase.from("projects").delete().eq("id", projectId);
        fetchData();
    };

    const getProfileName = (userId: string) => {
        const p = profiles.find((pr) => pr.id === userId);
        return p?.full_name || p?.email || "Unknown";
    };

    const formatDate = (date: string) => {
        const d = new Date(date);
        const now = new Date();
        const diff = d.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (days < 0) return { text: `${Math.abs(days)}d overdue`, isOverdue: true };
        if (days === 0) return { text: "Today", isOverdue: false };
        if (days === 1) return { text: "Tomorrow", isOverdue: false };
        return { text: `In ${days}d`, isOverdue: false };
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                    <Shield className="h-6 w-6 text-slate-600" /> Admin
                </h1>
                <Card>
                    <CardContent className="py-12 text-center text-slate-400">Loading team data...</CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                        <Shield className="h-6 w-6 text-slate-600" />
                        Admin
                    </h1>
                    <p className="text-sm text-slate-500">
                        Team management, project assignments, and performance overview
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge className={ROLE_CONFIG[currentUserRole]?.color || "bg-slate-100"}>
                        {ROLE_CONFIG[currentUserRole]?.label || currentUserRole}
                    </Badge>
                    <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600">
                                <UserPlus className="mr-2 h-4 w-4" /> Assign to Project
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Bulk Assign Contacts</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-slate-500 mb-4">
                                Assign all <b>unassigned</b> contacts in a project to a team member.
                            </p>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Project</label>
                                    <Select value={selectedProject} onValueChange={setSelectedProject}>
                                        <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
                                        <SelectContent>
                                            {projects.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Assign To</label>
                                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                                        <SelectTrigger><SelectValue placeholder="Select team member..." /></SelectTrigger>
                                        <SelectContent>
                                            {profiles.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handleBulkAssign} className="w-full" disabled={!selectedProject || !selectedUser}>
                                    Assign Unassigned Contacts
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* ─── User Management (Super Admin Only) ─── */}
            {isSuperAdmin && (
                <Card className="border-amber-200 bg-amber-50/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Crown className="h-4 w-4 text-amber-600" />
                            User Management
                            <Badge className="bg-amber-100 text-amber-700 text-[10px] ml-2">Super Admin Only</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Current Role</TableHead>
                                    <TableHead>Change Role</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {profiles.map((profile) => {
                                    const roleConfig = ROLE_CONFIG[profile.role] || ROLE_CONFIG.agent;
                                    const RoleIcon = roleConfig.icon;
                                    const isMe = profile.id === currentUserId;
                                    return (
                                        <TableRow key={profile.id} className={isMe ? "bg-cyan-50/50" : ""}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 text-xs font-bold text-white">
                                                        {(profile.full_name || profile.email || "?")[0].toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-sm">
                                                        {profile.full_name || "No name"}
                                                        {isMe && <span className="text-xs text-slate-400 ml-1">(you)</span>}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-500">{profile.email}</TableCell>
                                            <TableCell>
                                                <Badge className={`${roleConfig.color} text-xs`}>
                                                    <RoleIcon className="h-3 w-3 mr-1" />
                                                    {roleConfig.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {isMe ? (
                                                    <span className="text-xs text-slate-400">—</span>
                                                ) : (
                                                    <Select
                                                        value={profile.role}
                                                        onValueChange={(newRole) => handleChangeRole(profile.id, newRole)}
                                                    >
                                                        <SelectTrigger className="h-8 w-[140px] text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="agent" className="text-xs">Agent</SelectItem>
                                                            <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                                                            <SelectItem value="super_admin" className="text-xs">Super Admin</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {isMe ? (
                                                    <span className="text-xs text-slate-400">—</span>
                                                ) : deleteConfirm === profile.id ? (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            className="h-7 text-xs"
                                                            onClick={() => handleDeleteUser(profile.id)}
                                                        >
                                                            Confirm
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-xs"
                                                            onClick={() => setDeleteConfirm(null)}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => setDeleteConfirm(profile.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* ─── Team Performance Table ─── */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="h-4 w-4" />
                        Team Performance
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {teamStats.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-slate-400 mb-2">No team members found</p>
                            <p className="text-xs text-slate-400">
                                Run the <code className="bg-slate-100 px-1.5 py-0.5 rounded">migration_profiles.sql</code> in Supabase SQL Editor first
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Team Member</TableHead>
                                    <TableHead className="text-center">Contacts</TableHead>
                                    <TableHead className="text-center">Calls (Week)</TableHead>
                                    <TableHead className="text-center">Calls (Total)</TableHead>
                                    <TableHead className="text-center">Meetings</TableHead>
                                    <TableHead className="text-center">Sales</TableHead>
                                    <TableHead className="text-center">Revenue</TableHead>
                                    <TableHead className="text-center">Callbacks</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {teamStats.map((member) => {
                                    const roleConfig = ROLE_CONFIG[member.profile.role] || ROLE_CONFIG.agent;
                                    return (
                                        <TableRow key={member.profile.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 text-xs font-bold text-white">
                                                        {(member.profile.full_name || member.profile.email || "?")[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{member.profile.full_name || member.profile.email}</p>
                                                        <p className="text-xs text-slate-400">{member.profile.email}</p>
                                                    </div>
                                                    <Badge className={`${roleConfig.color} text-[10px]`}>
                                                        {roleConfig.label}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-medium">{member.contactCount}</TableCell>
                                            <TableCell className="text-center">
                                                <span className="font-bold text-cyan-600">{member.callsThisWeek}</span>
                                            </TableCell>
                                            <TableCell className="text-center text-slate-500">{member.callsTotal}</TableCell>
                                            <TableCell className="text-center">
                                                <span className={member.meetingsBooked > 0 ? "font-bold text-teal-600" : "text-slate-400"}>
                                                    {member.meetingsBooked}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={member.salesMade > 0 ? "font-bold text-green-600" : "text-slate-400"}>
                                                    {member.salesMade}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={member.revenue > 0 ? "font-bold text-emerald-600" : "text-slate-400"}>
                                                    €{member.revenue.toLocaleString()}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className="text-sm">{member.pendingReminders}</span>
                                                    {member.overdueReminders > 0 && (
                                                        <Badge variant="destructive" className="text-[10px] px-1.5">
                                                            {member.overdueReminders} overdue
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* ─── Bottom Row: Projects + Upcoming Callbacks ─── */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Project Assignments */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Building2 className="h-4 w-4" />
                            Project Assignments
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {projectAssignments.length === 0 ? (
                            <p className="text-sm text-slate-400">No projects found</p>
                        ) : (
                            <div className="space-y-4">
                                {projectAssignments.map((pa) => (
                                    <div key={pa.project.id} className="rounded-lg border border-slate-100 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <p className="font-semibold text-sm">{pa.project.name}</p>
                                                <p className="text-xs text-slate-400">{pa.contactCount} contacts</p>
                                            </div>
                                            {isSuperAdmin && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDeleteProject(pa.project.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                                </Button>
                                            )}
                                        </div>
                                        {pa.assignedUsers.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {pa.assignedUsers.map((au) => (
                                                    <Badge key={au.userId} variant="secondary" className="text-xs">
                                                        {getProfileName(au.userId)} ({au.count})
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">No contacts assigned yet</p>
                                        )}
                                        {profiles.length > 0 && (
                                            <div className="mt-3 flex items-center gap-2">
                                                <Select onValueChange={(userId) => handleAssignAllInProject(pa.project.id, userId)}>
                                                    <SelectTrigger className="h-7 text-xs w-[180px]">
                                                        <SelectValue placeholder="Assign all to..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {profiles.map((p) => (
                                                            <SelectItem key={p.id} value={p.id} className="text-xs">
                                                                {p.full_name || p.email}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Upcoming Callbacks Across Team */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Clock className="h-4 w-4" />
                            Team Callbacks
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {upcomingCallbacks.length === 0 ? (
                            <p className="text-sm text-slate-400">No pending callbacks 🎉</p>
                        ) : (
                            <div className="space-y-2">
                                {upcomingCallbacks.map((r) => {
                                    const contact = r.contact as unknown as Contact;
                                    const due = formatDate(r.due_date);
                                    return (
                                        <div
                                            key={r.id}
                                            className={`flex items-center justify-between rounded-lg border p-3 text-sm cursor-pointer hover:bg-slate-50 transition-colors ${r.is_priority ? "border-orange-300 bg-orange-50/60" : "border-slate-100"
                                                }`}
                                            onClick={() => {
                                                if (contact?.id) router.push(`/contacts/${contact.id}`);
                                            }}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    {r.is_priority && <Flame className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                                                    <p className="font-medium text-slate-700 truncate">
                                                        {contact?.first_name} {contact?.last_name}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-slate-400 truncate mt-0.5">{r.title}</p>
                                                {r.profile && (
                                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                                        Assigned to: <b>{r.profile.full_name || r.profile.email}</b>
                                                    </p>
                                                )}
                                            </div>
                                            <span className={`text-xs shrink-0 ml-2 ${due.isOverdue ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                                                {due.text}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
