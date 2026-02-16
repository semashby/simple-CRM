"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    PhoneCall,
    Flame,
    Clock,
    ArrowRight,
    CheckCircle2,
    Building2,
    User,
    ClipboardList,
    Calendar,
} from "lucide-react";
import type { Contact, Reminder } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/types";
import { useRouter } from "next/navigation";
import { ProjectSelector } from "@/components/project-selector";

interface QueueContact {
    contact: Contact;
    reminder: Reminder;
    isPriority: boolean;
    isOverdue: boolean;
}

export default function CallQueuePage() {
    const supabase = createClient();
    const router = useRouter();
    const [projectId, setProjectId] = useState("all");
    const [queue, setQueue] = useState<QueueContact[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchQueue = useCallback(async () => {
        setLoading(true);
        const now = new Date();

        // Fetch all pending reminders with their contacts
        const { data: reminders } = await supabase
            .from("reminders")
            .select("*, contact:contacts(*)")
            .eq("is_done", false)
            .order("is_priority", { ascending: false })
            .order("due_date", { ascending: true });

        if (!reminders) {
            setQueue([]);
            setLoading(false);
            return;
        }

        // Build queue items
        const items: QueueContact[] = reminders
            .filter((r: Reminder & { contact?: unknown }) => {
                const contact = r.contact as unknown as Contact;
                if (!contact) return false;
                if (projectId !== "all" && contact.project_id !== projectId) return false;
                return true;
            })
            .map((r: Reminder & { contact?: unknown }) => {
                const contact = r.contact as unknown as Contact;
                const dueDate = new Date(r.due_date);
                return {
                    contact,
                    reminder: r,
                    isPriority: r.is_priority || false,
                    isOverdue: dueDate <= now,
                };
            });

        // Sort: overdue priority first, then overdue, then today's priority, then today, then upcoming
        items.sort((a, b) => {
            // Overdue first
            if (a.isOverdue && !b.isOverdue) return -1;
            if (!a.isOverdue && b.isOverdue) return 1;

            // Within same overdue status, priority first
            if (a.isPriority && !b.isPriority) return -1;
            if (!a.isPriority && b.isPriority) return 1;

            // Sort by due date
            return new Date(a.reminder.due_date).getTime() - new Date(b.reminder.due_date).getTime();
        });

        setQueue(items);
        setLoading(false);
    }, [projectId]);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    const handleMarkDone = async (reminderId: string) => {
        await supabase.from("reminders").update({ is_done: true }).eq("id", reminderId);
        fetchQueue();
    };

    const formatDueDate = (date: string) => {
        const d = new Date(date);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        const tomorrowEnd = new Date(todayEnd);
        tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

        if (d < todayStart) {
            const daysOverdue = Math.ceil((todayStart.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
            return { text: `${daysOverdue}d overdue`, className: "text-red-600 font-semibold" };
        }
        if (d < todayEnd) {
            return { text: "Due today", className: "text-orange-600 font-semibold" };
        }
        if (d < tomorrowEnd) {
            return { text: "Tomorrow", className: "text-yellow-600" };
        }
        return {
            text: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            className: "text-slate-500",
        };
    };

    const overdueCount = queue.filter((q) => q.isOverdue).length;
    const todayCount = queue.filter((q) => {
        const d = new Date(q.reminder.due_date);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        return d >= todayStart && d < todayEnd;
    }).length;
    const upcomingCount = queue.length - overdueCount - todayCount;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                        <PhoneCall className="h-6 w-6 text-blue-600" />
                        Call Queue
                    </h1>
                    <p className="text-sm text-slate-500">
                        {queue.length} contacts to call · {overdueCount > 0 && <span className="text-red-600 font-medium">{overdueCount} overdue</span>}
                        {overdueCount > 0 && todayCount > 0 && " · "}
                        {todayCount > 0 && <span className="text-orange-600 font-medium">{todayCount} due today</span>}
                        {(overdueCount > 0 || todayCount > 0) && upcomingCount > 0 && " · "}
                        {upcomingCount > 0 && <span className="text-slate-500">{upcomingCount} upcoming</span>}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <ProjectSelector value={projectId} onChange={setProjectId} />
                    {queue.length > 0 && (
                        <Button
                            onClick={() => router.push(`/contacts/${queue[0].contact.id}`)}
                            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-sm"
                        >
                            Start Calling <ArrowRight className="ml-1.5 h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className={overdueCount > 0 ? "border-red-200 bg-red-50/40" : ""}>
                    <CardContent className="flex items-center gap-3 pt-5">
                        <div className={`rounded-full p-2.5 ${overdueCount > 0 ? "bg-red-100" : "bg-slate-100"}`}>
                            <Clock className={`h-5 w-5 ${overdueCount > 0 ? "text-red-500" : "text-slate-400"}`} />
                        </div>
                        <div>
                            <p className={`text-2xl font-bold ${overdueCount > 0 ? "text-red-600" : ""}`}>{overdueCount}</p>
                            <p className="text-xs text-slate-500">Overdue</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 pt-5">
                        <div className="rounded-full bg-orange-100 p-2.5">
                            <Calendar className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-orange-600">{todayCount}</p>
                            <p className="text-xs text-slate-500">Due Today</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 pt-5">
                        <div className="rounded-full bg-blue-100 p-2.5">
                            <PhoneCall className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-blue-600">{upcomingCount}</p>
                            <p className="text-xs text-slate-500">Upcoming</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Queue List */}
            {loading ? (
                <Card>
                    <CardContent className="py-12 text-center text-slate-400">
                        Loading call queue...
                    </CardContent>
                </Card>
            ) : queue.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="rounded-full bg-green-100 p-4">
                                <CheckCircle2 className="h-8 w-8 text-green-500" />
                            </div>
                            <p className="text-lg font-medium text-slate-700">All caught up! 🎉</p>
                            <p className="text-sm text-slate-400">No pending callbacks. Great work!</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {queue.map((item, index) => {
                        const due = formatDueDate(item.reminder.due_date);
                        return (
                            <Card
                                key={item.reminder.id}
                                className={`cursor-pointer transition-all hover:shadow-md ${item.isPriority && item.isOverdue
                                    ? "border-red-300 bg-red-50/60"
                                    : item.isPriority
                                        ? "border-orange-300 bg-orange-50/60"
                                        : item.isOverdue
                                            ? "border-red-200 bg-red-50/30"
                                            : "hover:bg-slate-50"
                                    }`}
                            >
                                <CardContent className="py-4">
                                    <div className="flex items-center gap-4">
                                        {/* Position / Priority indicator */}
                                        <div className="flex flex-col items-center gap-1 w-8 shrink-0">
                                            {item.isPriority ? (
                                                <Flame className="h-5 w-5 text-orange-500" />
                                            ) : (
                                                <span className="text-sm font-bold text-slate-300">#{index + 1}</span>
                                            )}
                                        </div>

                                        {/* Avatar */}
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shrink-0 ${item.isPriority ? "bg-gradient-to-br from-orange-500 to-red-500" : "bg-gradient-to-br from-blue-500 to-purple-500"
                                            }`}>
                                            {(item.contact.first_name?.[0] || "").toUpperCase()}
                                            {(item.contact.last_name?.[0] || "").toUpperCase()}
                                        </div>

                                        {/* Contact info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-slate-800 truncate">
                                                    {item.contact.first_name} {item.contact.last_name}
                                                </p>
                                                <Badge variant="secondary" className={`text-[10px] ${STATUS_CONFIG[item.contact.status]?.color || ""}`}>
                                                    {STATUS_CONFIG[item.contact.status]?.label}
                                                </Badge>
                                                {item.isPriority && (
                                                    <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">
                                                        PRIORITY
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                                                {item.contact.company_name && (
                                                    <span className="flex items-center gap-1">
                                                        <Building2 className="h-3 w-3" /> {item.contact.company_name}
                                                    </span>
                                                )}
                                                {item.contact.phone && (
                                                    <span className="flex items-center gap-1">
                                                        <PhoneCall className="h-3 w-3" /> {item.contact.phone}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                                                {item.reminder.title}
                                            </p>
                                        </div>

                                        {/* Due date */}
                                        <div className="text-right shrink-0">
                                            <p className={`text-sm ${due.className}`}>{due.text}</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                title="Mark done"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleMarkDone(item.reminder.id);
                                                }}
                                            >
                                                <CheckCircle2 className="h-4 w-4 text-slate-300 hover:text-green-500 transition-colors" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="bg-blue-600 text-white hover:bg-blue-700 h-8 px-3"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/contacts/${item.contact.id}`);
                                                }}
                                            >
                                                <ClipboardList className="h-3.5 w-3.5 mr-1" /> Open
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
