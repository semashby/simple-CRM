"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectSelector } from "@/components/project-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    UserPlus,
    Bell,
    TrendingUp,
    Clock,
} from "lucide-react";
import type { Contact, Reminder, Activity } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/types";

export default function DashboardPage() {
    const supabase = createClient();
    const [projectId, setProjectId] = useState("all");
    const [totalContacts, setTotalContacts] = useState(0);
    const [newThisWeek, setNewThisWeek] = useState(0);
    const [pipelineCount, setPipelineCount] = useState(0);
    const [reminders, setReminders] = useState<(Reminder & { contact?: Contact })[]>([]);
    const [recentActivity, setRecentActivity] = useState<(Activity & { contact?: Contact })[]>([]);

    useEffect(() => {
        fetchDashboardData();
    }, [projectId]);

    const fetchDashboardData = async () => {
        // Base query for contacts
        let contactQuery = supabase.from("contacts").select("*", { count: "exact" });
        if (projectId !== "all") contactQuery = contactQuery.eq("project_id", projectId);

        // Total contacts
        const { count: total } = await contactQuery;
        setTotalContacts(total || 0);

        // New this week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        let newQuery = supabase
            .from("contacts")
            .select("*", { count: "exact" })
            .gte("created_at", weekAgo.toISOString());
        if (projectId !== "all") newQuery = newQuery.eq("project_id", projectId);
        const { count: newCount } = await newQuery;
        setNewThisWeek(newCount || 0);

        // In pipeline (not 'new' and not 'client' and not 'lost')
        let pipeQuery = supabase
            .from("contacts")
            .select("*", { count: "exact" })
            .not("status", "in", '("new","client","lost")');
        if (projectId !== "all") pipeQuery = pipeQuery.eq("project_id", projectId);
        const { count: pipeCount } = await pipeQuery;
        setPipelineCount(pipeCount || 0);

        // Upcoming reminders (not done, ordered by due date)
        const { data: reminderData } = await supabase
            .from("reminders")
            .select("*, contact:contacts(*)")
            .eq("is_done", false)
            .order("due_date", { ascending: true })
            .limit(5);
        setReminders((reminderData as never[]) || []);

        // Recent activity
        const { data: activityData } = await supabase
            .from("activities")
            .select("*, contact:contacts(*)")
            .order("created_at", { ascending: false })
            .limit(8);
        setRecentActivity((activityData as never[]) || []);
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

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
                    <p className="text-sm text-slate-500">
                        Overview of your leads and activities
                    </p>
                </div>
                <ProjectSelector value={projectId} onChange={setProjectId} />
            </div>

            {/* Stats Cards */}
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
                        <div className="text-3xl font-bold text-blue-600">{newThisWeek}</div>
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
                        <div className="text-3xl font-bold text-purple-600">{pipelineCount}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">
                            Pending Reminders
                        </CardTitle>
                        <Bell className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-orange-500">{reminders.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Row */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Upcoming Reminders */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Clock className="h-4 w-4" />
                            Upcoming Reminders
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {reminders.length === 0 ? (
                            <p className="text-sm text-slate-400">No pending reminders</p>
                        ) : (
                            <div className="space-y-3">
                                {reminders.map((r) => (
                                    <div
                                        key={r.id}
                                        className="flex items-center justify-between rounded-lg border border-slate-100 p-3"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">{r.title}</p>
                                            <p className="text-xs text-slate-500">
                                                {(r.contact as unknown as Contact)?.first_name}{" "}
                                                {(r.contact as unknown as Contact)?.last_name}
                                            </p>
                                        </div>
                                        <Badge
                                            variant={
                                                new Date(r.due_date) < new Date()
                                                    ? "destructive"
                                                    : "secondary"
                                            }
                                        >
                                            {formatDate(r.due_date)}
                                        </Badge>
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
                            <div className="space-y-3">
                                {recentActivity.map((a) => (
                                    <div
                                        key={a.id}
                                        className="flex items-center justify-between rounded-lg border border-slate-100 p-3"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">{a.description}</p>
                                            <p className="text-xs text-slate-500">
                                                {(a.contact as unknown as Contact)?.first_name}{" "}
                                                {(a.contact as unknown as Contact)?.last_name}
                                            </p>
                                        </div>
                                        <span className="text-xs text-slate-400">
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
