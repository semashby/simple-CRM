"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectSelector } from "@/components/project-selector";
import { useAccessibleProjects } from "@/hooks/use-accessible-projects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Users,
    UserPlus,
    Bell,
    TrendingUp,
    Clock,
    PhoneCall,
    Calendar,
    DollarSign,
    Flame,
    ArrowRight,
    CheckCircle2,
} from "lucide-react";
import type { Contact, Reminder, Activity } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/types";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const supabase = createClient();
    const router = useRouter();
    const [projectId, setProjectId] = useState("all");
    const { accessibleProjectIds, loading: accessLoading } = useAccessibleProjects();

    // Default agents to first accessible project instead of "all"
    useEffect(() => {
        if (!accessLoading && accessibleProjectIds !== null && accessibleProjectIds.length > 0) {
            setProjectId(accessibleProjectIds[0]);
        }
    }, [accessLoading, accessibleProjectIds]);

    // Core counts
    const [totalContacts, setTotalContacts] = useState(0);
    const [newThisWeek, setNewThisWeek] = useState(0);
    const [pipelineCount, setPipelineCount] = useState(0);

    // New KPIs
    const [callsToday, setCallsToday] = useState(0);
    const [callsThisWeek, setCallsThisWeek] = useState(0);
    const [callbacksOverdue, setCallbacksOverdue] = useState(0);
    const [callbacksDueToday, setCallbacksDueToday] = useState(0);
    const [meetingsThisWeek, setMeetingsThisWeek] = useState(0);
    const [salesThisMonth, setSalesThisMonth] = useState(0);
    const [revenueThisMonth, setRevenueThisMonth] = useState(0);

    // Funnel data
    const [funnelData, setFunnelData] = useState<{ status: string; label: string; count: number; color: string }[]>([]);

    // Lists
    const [reminders, setReminders] = useState<(Reminder & { contact?: Contact })[]>([]);
    const [recentActivity, setRecentActivity] = useState<(Activity & { contact?: Contact })[]>([]);
    const [userRole, setUserRole] = useState<string>("agent");

    useEffect(() => {
        fetchDashboardData();
    }, [projectId]);

    const fetchDashboardData = async () => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // --- Total contacts ---
        let contactQuery = supabase.from("contacts").select("*", { count: "exact" });
        if (projectId !== "all") contactQuery = contactQuery.eq("project_id", projectId);
        const { count: total } = await contactQuery;
        setTotalContacts(total || 0);

        // --- New this week ---
        let newQuery = supabase.from("contacts").select("*", { count: "exact" }).gte("created_at", weekAgo.toISOString());
        if (projectId !== "all") newQuery = newQuery.eq("project_id", projectId);
        const { count: newCount } = await newQuery;
        setNewThisWeek(newCount || 0);

        // --- In pipeline ---
        let pipeQuery = supabase.from("contacts").select("*", { count: "exact" }).not("status", "in", '("new","client","lost")');
        if (projectId !== "all") pipeQuery = pipeQuery.eq("project_id", projectId);
        const { count: pipeCount } = await pipeQuery;
        setPipelineCount(pipeCount || 0);

        // --- Calls today ---
        const { count: callsTodayCount } = await supabase
            .from("call_logs")
            .select("*", { count: "exact" })
            .gte("created_at", todayStart.toISOString())
            .lt("created_at", todayEnd.toISOString());
        setCallsToday(callsTodayCount || 0);

        // --- Calls this week ---
        const { count: callsWeekCount } = await supabase
            .from("call_logs")
            .select("*", { count: "exact" })
            .gte("created_at", weekAgo.toISOString());
        setCallsThisWeek(callsWeekCount || 0);

        // --- Callbacks overdue ---
        const { count: overdueCount } = await supabase
            .from("reminders")
            .select("*", { count: "exact" })
            .eq("is_done", false)
            .lt("due_date", todayStart.toISOString());
        setCallbacksOverdue(overdueCount || 0);

        // --- Callbacks due today ---
        const { count: dueTodayCount } = await supabase
            .from("reminders")
            .select("*", { count: "exact" })
            .eq("is_done", false)
            .gte("due_date", todayStart.toISOString())
            .lt("due_date", todayEnd.toISOString());
        setCallbacksDueToday(dueTodayCount || 0);

        // --- Meetings booked this week ---
        const { count: meetingsCount } = await supabase
            .from("call_logs")
            .select("*", { count: "exact" })
            .eq("outcome", "meeting_booked")
            .gte("created_at", weekAgo.toISOString());
        setMeetingsThisWeek(meetingsCount || 0);

        // --- Sales this month ---
        const { data: salesData } = await supabase
            .from("call_logs")
            .select("sale_value")
            .eq("outcome", "sale_made")
            .gte("created_at", monthStart.toISOString());
        setSalesThisMonth(salesData?.length || 0);
        const totalRevenue = (salesData || []).reduce((sum: number, s: { sale_value: number | null }) => sum + (s.sale_value || 0), 0);
        setRevenueThisMonth(totalRevenue);

        // --- Conversion funnel ---
        const funnelStatuses = [
            { status: "new", label: "New Leads", color: "bg-slate-100 text-slate-700" },
            { status: "contacted", label: "Contacted", color: "bg-cyan-100 text-blue-700" },
            { status: "meeting_scheduled", label: "Meetings", color: "bg-purple-100 text-purple-700" },
            { status: "client", label: "Clients", color: "bg-green-100 text-green-700" },
            { status: "lost", label: "Lost", color: "bg-red-100 text-red-700" },
        ];

        const funnelResults = await Promise.all(
            funnelStatuses.map(async (f) => {
                let q = supabase.from("contacts").select("*", { count: "exact" }).eq("status", f.status);
                if (projectId !== "all") q = q.eq("project_id", projectId);
                const { count } = await q;
                return { ...f, count: count || 0 };
            })
        );
        setFunnelData(funnelResults);

        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", userData.user.id)
                .single();
            if (profile?.role) setUserRole(profile.role);
        }

        // --- Reminders (show all pending) ---
        const { data: reminderData } = await supabase
            .from("reminders")
            .select("*, contact:contacts(*)")
            .eq("is_done", false)
            .order("is_priority", { ascending: false })
            .order("due_date", { ascending: true })
            .limit(8);
        setReminders((reminderData as never[]) || []);

        // --- Recent activity ---
        const { data: activityData } = await supabase
            .from("activities")
            .select("*, contact:contacts(*)")
            .order("created_at", { ascending: false })
            .limit(8);
        setRecentActivity((activityData as never[]) || []);
    };

    const handleToggleReminder = async (reminderId: string, isDone: boolean) => {
        await supabase.from("reminders").update({ is_done: !isDone }).eq("id", reminderId);
        fetchDashboardData();
    };

    const formatDate = (date: string) => {
        const d = new Date(date);
        const now = new Date();
        const diff = d.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

        if (days < 0) return `${Math.abs(days)}d overdue`;
        if (days === 0) return "Today";
        if (days === 1) return "Tomorrow";
        return `In ${days} days`;
    };

    const formatTimeAgo = (date: string) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    const maxFunnel = Math.max(...funnelData.map((f) => f.count), 1);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
                    <p className="text-sm text-slate-500">
                        Overview of your leads and performance
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <ProjectSelector value={projectId} onChange={setProjectId} accessibleProjectIds={accessibleProjectIds} />
                    <Button onClick={() => router.push("/call-queue")} className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600">
                        <PhoneCall className="mr-2 h-4 w-4" /> Call Queue
                    </Button>
                </div>
            </div>

            {/* ─── Row 1: Core Stats ─── */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">
                            Total Contacts
                        </CardTitle>
                        <Users className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalContacts}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">
                            New This Week
                        </CardTitle>
                        <UserPlus className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-cyan-600">{newThisWeek}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">
                            In Pipeline
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-teal-600">{pipelineCount}</div>
                    </CardContent>
                </Card>

                <Card className={callbacksOverdue > 0 ? "border-red-200 bg-red-50/30" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">
                            Callbacks Overdue
                        </CardTitle>
                        <Bell className={`h-4 w-4 ${callbacksOverdue > 0 ? "text-red-500" : "text-slate-400"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-bold ${callbacksOverdue > 0 ? "text-red-600" : ""}`}>{callbacksOverdue}</div>
                        {callbacksDueToday > 0 && (
                            <p className="text-xs text-orange-600 mt-1">{callbacksDueToday} due today</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ─── Row 2: Performance KPIs ─── */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Calls Today</CardTitle>
                        <PhoneCall className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{callsToday}</div>
                        <p className="text-xs text-slate-500 mt-1">{callsThisWeek} this week</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-gradient-to-br from-purple-50 to-violet-50/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Meetings Booked</CardTitle>
                        <Calendar className="h-4 w-4 text-purple-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-teal-600">{meetingsThisWeek}</div>
                        <p className="text-xs text-slate-500 mt-1">this week</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-gradient-to-br from-green-50 to-emerald-50/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Sales This Month</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{salesThisMonth}</div>
                        <p className="text-xs text-slate-500 mt-1">deals closed</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-gradient-to-br from-emerald-50 to-teal-50/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Revenue This Month</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-emerald-600">€{revenueThisMonth.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Row 3: Funnel + Reminders + Activity ─── */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Conversion Funnel */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <TrendingUp className="h-4 w-4" />
                            Conversion Funnel
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {funnelData.map((f) => (
                                <div key={f.status}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-slate-600">{f.label}</span>
                                        <span className="text-sm font-semibold">{f.count}</span>
                                    </div>
                                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${f.status === "new" ? "bg-slate-400" :
                                                f.status === "contacted" ? "bg-cyan-500" :
                                                    f.status === "meeting_scheduled" ? "bg-purple-500" :
                                                        f.status === "client" ? "bg-green-500" :
                                                            "bg-red-400"
                                                }`}
                                            style={{ width: `${Math.max((f.count / maxFunnel) * 100, 2)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Upcoming Reminders with Mark Done */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Clock className="h-4 w-4" />
                            Pending Reminders
                        </CardTitle>
                        {(userRole === "admin" || userRole === "super_admin") && (
                            <Button variant="ghost" size="sm" onClick={() => router.push("/calendar")} className="text-xs h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                View Calendar <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        {reminders.length === 0 ? (
                            <p className="text-sm text-slate-400">No pending reminders 🎉</p>
                        ) : (
                            <div className="space-y-2">
                                {reminders.map((r) => (
                                    <div
                                        key={r.id}
                                        className={`flex items-center justify-between rounded-lg border p-2.5 text-sm cursor-pointer transition-colors hover:bg-slate-50 ${r.is_priority ? "border-orange-300 bg-orange-50/60" : "border-slate-100"
                                            }`}
                                        onClick={() => {
                                            const contactData = r.contact as unknown as Contact;
                                            if (contactData?.id) router.push(`/contacts/${contactData.id}`);
                                        }}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-medium text-slate-700">
                                                {r.is_priority && "🔥 "}{r.title}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {(r.contact as unknown as Contact)?.first_name}{" "}
                                                {(r.contact as unknown as Contact)?.last_name}
                                                {" · "}
                                                <span className={new Date(r.due_date) < new Date() ? "text-red-500 font-medium" : ""}>
                                                    {formatDate(r.due_date)}
                                                </span>
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleReminder(r.id, r.is_done);
                                            }}
                                        >
                                            <CheckCircle2 className="h-4 w-4 text-slate-300 hover:text-green-500 transition-colors" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {recentActivity.length === 0 ? (
                            <p className="text-sm text-slate-400">No recent activity</p>
                        ) : (
                            <div className="space-y-2">
                                {recentActivity.map((a) => (
                                    <div
                                        key={a.id}
                                        className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5 text-sm cursor-pointer hover:bg-slate-50 transition-colors"
                                        onClick={() => {
                                            const contactData = a.contact as unknown as Contact;
                                            if (contactData?.id) router.push(`/contacts/${contactData.id}`);
                                        }}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{a.description}</p>
                                            <p className="text-xs text-slate-500">
                                                {(a.contact as unknown as Contact)?.first_name}{" "}
                                                {(a.contact as unknown as Contact)?.last_name}
                                            </p>
                                        </div>
                                        <span className="text-xs text-slate-400 shrink-0 ml-2">
                                            {formatTimeAgo(a.created_at)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
