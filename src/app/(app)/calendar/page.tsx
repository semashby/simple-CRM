"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarConnectModal } from "@/components/calendar-connect-dialog";
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Flame,
    PhoneCall,
    Clock,
    RefreshCw,
    Settings,
    Users
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Contact, Reminder, CalendarConnection, CalendarEvent } from "@/lib/types";
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    addMonths,
    subMonths,
    isSameMonth,
    isSameDay,
    isToday,
    isBefore,
    parseISO,
} from "date-fns";

interface CalendarReminder extends Reminder {
    contact?: Contact;
}

interface TeamMember {
    id: string;
    full_name: string;
    email: string;
}

export default function CalendarPage() {
    const supabase = createClient();
    const router = useRouter();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

    // Data states
    const [reminders, setReminders] = useState<CalendarReminder[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [connection, setConnection] = useState<CalendarConnection | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

    // UI states
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // User selection
    const [currentUserId, setCurrentUserId] = useState<string>("");
    const [viewingUserId, setViewingUserId] = useState<string>("me");

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", user.id)
                    .single();

                if (profile?.role !== "admin" && profile?.role !== "super_admin") {
                    router.push("/");
                    return;
                }

                setCurrentUserId(user.id);
                fetchTeamMembers();
                fetchConnectionStatus(user.id);
            }
        };
        init();
    }, []);

    // Fetch data when month or viewing user changes
    useEffect(() => {
        if (currentUserId) {
            const targetUserId = viewingUserId === "me" ? currentUserId : viewingUserId;
            fetchCalendarData(targetUserId);
        }
    }, [currentMonth, viewingUserId, currentUserId]);

    const fetchTeamMembers = async () => {
        const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
        setTeamMembers(data || []);
    };

    const fetchConnectionStatus = async (userId: string) => {
        const { data } = await supabase
            .from("calendar_connections")
            .select("*")
            .eq("user_id", userId)
            .eq("provider", "calcom")
            .eq("is_active", true)
            .single();

        setConnection(data || null);
    };

    const fetchCalendarData = async (userId: string) => {
        setLoading(true);
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

        // 1. Fetch CRM Reminders for this user
        const { data: remindersData } = await supabase
            .from("reminders")
            .select("*, contact:contacts(*)")
            .eq("assigned_to", userId)
            .eq("is_done", false)
            .gte("due_date", calStart.toISOString())
            .lte("due_date", calEnd.toISOString())
            .order("due_date", { ascending: true });

        setReminders((remindersData as CalendarReminder[]) || []);

        // 2. Fetch Synced External Events for this user
        const { data: eventsData } = await supabase
            .from("calendar_events")
            .select("*")
            .eq("user_id", userId)
            .gte("start_time", calStart.toISOString())
            .lte("start_time", calEnd.toISOString())
            .order("start_time", { ascending: true });

        setEvents((eventsData as CalendarEvent[]) || []);

        setLoading(false);
    };

    const handleSync = async () => {
        if (!connection) {
            setIsSettingsOpen(true);
            return;
        }

        setSyncing(true);
        try {
            await fetch("/api/calendar/sync", { method: "POST" });
            const targetUserId = viewingUserId === "me" ? currentUserId : viewingUserId;
            await fetchCalendarData(targetUserId);
        } catch (err) {
            console.error("Sync failed", err);
        } finally {
            setSyncing(false);
        }
    };

    // Build calendar grid
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const weeks: Date[][] = [];
    let day = calStart;
    while (day <= calEnd) {
        const week: Date[] = [];
        for (let i = 0; i < 7; i++) {
            week.push(day);
            day = addDays(day, 1);
        }
        weeks.push(week);
    }

    // Group items by date
    const remindersByDate = new Map<string, CalendarReminder[]>();
    reminders.forEach((r) => {
        const key = format(new Date(r.due_date), "yyyy-MM-dd");
        if (!remindersByDate.has(key)) remindersByDate.set(key, []);
        remindersByDate.get(key)!.push(r);
    });

    const eventsByDate = new Map<string, CalendarEvent[]>();
    events.forEach((e) => {
        const key = format(new Date(e.start_time), "yyyy-MM-dd");
        if (!eventsByDate.has(key)) eventsByDate.set(key, []);
        eventsByDate.get(key)!.push(e);
    });

    const selectedDateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
    const selectedReminders = selectedDateKey ? remindersByDate.get(selectedDateKey) || [] : [];
    const selectedEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) || [] : [];

    // Sort selected items chronologically
    const allSelectedItems = [
        ...selectedReminders.map(r => ({ type: 'reminder' as const, time: new Date(r.due_date).getTime(), data: r })),
        ...selectedEvents.map(e => ({ type: 'event' as const, time: new Date(e.start_time).getTime(), data: e }))
    ].sort((a, b) => a.time - b.time);

    const isViewingOther = viewingUserId !== "me" && viewingUserId !== currentUserId;

    return (
        <div className="space-y-6">
            <CalendarConnectModal
                open={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                connection={connection}
                onStatusChange={() => {
                    fetchConnectionStatus(currentUserId);
                    fetchCalendarData(currentUserId);
                }}
            />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                        <CalendarIcon className="h-6 w-6 text-slate-600" />
                        {isViewingOther ? "Team Calendar" : "My Calendar"}
                    </h1>
                    <p className="text-sm text-slate-500">
                        View callbacks, meetings, and external calendar events.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* User Selector */}
                    <Select value={viewingUserId} onValueChange={setViewingUserId}>
                        <SelectTrigger className="w-[180px] bg-white">
                            <Users className="w-4 h-4 mr-2 text-slate-500" />
                            <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="me">My Calendar</SelectItem>
                            {teamMembers.filter(m => m.id !== currentUserId).length > 0 && (
                                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">Team Members</div>
                            )}
                            {teamMembers.filter(m => m.id !== currentUserId).map(member => (
                                <SelectItem key={member.id} value={member.id}>
                                    {member.full_name || member.email}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {!isViewingOther && (
                        <>
                            <Button
                                variant={connection ? "outline" : "default"}
                                onClick={() => setIsSettingsOpen(true)}
                                className={!connection ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
                            >
                                <Settings className="h-4 w-4 mr-2" />
                                {connection ? "Settings" : "Connect Calendar"}
                            </Button>

                            {connection && (
                                <Button variant="outline" onClick={handleSync} disabled={syncing}>
                                    <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                                    {syncing ? "Syncing..." : "Sync"}
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Nav Row */}
            <div className="flex items-center justify-between bg-white p-2 rounded-lg border">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-semibold text-slate-800 min-w-[140px] text-center">
                        {format(currentMonth, "MMMM yyyy")}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setCurrentMonth(new Date());
                        setSelectedDate(new Date());
                    }}
                >
                    Today
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                {/* Calendar Grid */}
                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="py-32 flex flex-col items-center justify-center text-slate-400">
                                <RefreshCw className="w-8 h-8 animate-spin mb-4 text-slate-300" />
                                Loading calendar...
                            </div>
                        ) : (
                            <div>
                                {/* Day headers */}
                                <div className="grid grid-cols-7 border-b border-slate-100">
                                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                                        <div key={d} className="py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            {d}
                                        </div>
                                    ))}
                                </div>

                                {/* Weeks */}
                                {weeks.map((week, wi) => (
                                    <div key={wi} className="grid grid-cols-7">
                                        {week.map((d) => {
                                            const dateKey = format(d, "yyyy-MM-dd");
                                            const dayReminders = remindersByDate.get(dateKey) || [];
                                            const dayEvents = eventsByDate.get(dateKey) || [];

                                            const inMonth = isSameMonth(d, currentMonth);
                                            const today = isToday(d);
                                            const selected = selectedDate && isSameDay(d, selectedDate);

                                            const hasOverdue = dayReminders.some(
                                                (r) => isBefore(new Date(r.due_date), new Date()) && !r.is_done
                                            );
                                            const hasPriority = dayReminders.some((r) => r.is_priority);

                                            return (
                                                <div
                                                    key={dateKey}
                                                    onClick={() => setSelectedDate(d)}
                                                    className={`min-h-[100px] border-b border-r border-slate-50 p-2 cursor-pointer transition-all
                                                        ${!inMonth ? "bg-slate-50/50" : "hover:bg-slate-50"}
                                                        ${selected ? "bg-cyan-50/50 ring-1 ring-inset ring-cyan-400" : ""}
                                                    `}
                                                >
                                                    <div className="flex items-start justify-between mb-1.5">
                                                        <span
                                                            className={`text-xs font-medium inline-flex items-center justify-center h-6 w-6 rounded-full
                                                                ${today ? "bg-cyan-500 text-white shadow-sm" : ""}
                                                                ${!inMonth ? "text-slate-400" : "text-slate-700"}
                                                            `}
                                                        >
                                                            {format(d, "d")}
                                                        </span>
                                                        {(dayReminders.length > 0 || dayEvents.length > 0) && (
                                                            <span className="text-[10px] font-medium text-slate-400 bg-white border px-1.5 rounded-full">
                                                                {dayReminders.length + dayEvents.length}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col gap-1 mt-2">
                                                        {/* Preview up to 3 events/reminders */}
                                                        {dayReminders.slice(0, 2).map((r) => (
                                                            <div key={r.id} className="text-[10px] truncate px-1 rounded bg-orange-50 text-orange-700 border border-orange-100 flex items-center gap-1">
                                                                <div className={`w-1 h-1 rounded-full ${r.is_priority ? "bg-orange-500" : "bg-orange-300"}`} />
                                                                {r.title}
                                                            </div>
                                                        ))}
                                                        {dayEvents.slice(0, 2).map((e) => (
                                                            <div key={e.id} className="text-[10px] truncate px-1 rounded bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                                                                <div className="w-1 h-1 rounded-full bg-blue-400" />
                                                                {isViewingOther && e.status === 'busy' ? 'Busy' : e.title}
                                                            </div>
                                                        ))}

                                                        {(dayReminders.length + dayEvents.length > 4) && (
                                                            <div className="text-[10px] text-slate-400 font-medium pl-1">
                                                                +{dayReminders.length + dayEvents.length - 4} more
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Day Detail Sidebar */}
                <Card className="h-fit sticky top-6">
                    <CardHeader className="bg-slate-50 border-b pb-4">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Clock className="h-5 w-5 text-slate-500" />
                            {selectedDate ? format(selectedDate, "EEEE, MMMM d") : "Select a day"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 max-h-[600px] overflow-y-auto">
                        {!selectedDate ? (
                            <p className="text-sm text-slate-400 text-center py-8">Select a day to view agenda</p>
                        ) : allSelectedItems.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                    <CalendarIcon className="w-5 h-5 text-slate-300" />
                                </div>
                                <p className="text-sm font-medium text-slate-900">No agenda items</p>
                                <p className="text-xs text-slate-500 mt-1">Free day! ✨</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {allSelectedItems.map((item, idx) => {
                                    if (item.type === 'reminder') {
                                        const r = item.data as CalendarReminder;
                                        const contact = r.contact;
                                        const overdue = isBefore(new Date(r.due_date), new Date());
                                        return (
                                            <div
                                                key={`rem-${r.id}`}
                                                onClick={() => !isViewingOther && contact?.id && router.push(`/contacts/${contact.id}`)}
                                                className={`rounded-xl border p-3.5 text-sm transition-all shadow-sm
                                                    ${!isViewingOther ? "cursor-pointer hover:shadow-md" : ""}
                                                    ${r.is_priority
                                                        ? "border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50"
                                                        : overdue
                                                            ? "border-red-200 bg-gradient-to-br from-red-50 to-red-100/50"
                                                            : "bg-white"
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                                        {r.is_priority ? <Flame className="h-4 w-4 text-orange-500" /> : <PhoneCall className="h-4 w-4 text-cyan-500" />}
                                                        Callback
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-500 bg-white/60 px-2 py-0.5 rounded-md border border-slate-100">
                                                        {format(new Date(r.due_date), "h:mm a")}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-900 font-medium mb-1">
                                                    {contact?.first_name} {contact?.last_name}
                                                </p>
                                                <p className="text-xs text-slate-500 line-clamp-2">{r.title}</p>
                                            </div>
                                        );
                                    } else {
                                        const e = item.data as CalendarEvent;
                                        const isMultiDay = e.is_all_day && isSameDay(new Date(e.start_time), new Date(e.end_time)) === false;

                                        return (
                                            <div
                                                key={`ev-${e.id}`}
                                                className={`rounded-xl border p-3.5 text-sm shadow-sm
                                                    ${isViewingOther && e.status === 'busy'
                                                        ? "bg-slate-100 border-slate-200 text-slate-500"
                                                        : "bg-gradient-to-br from-blue-50 to-blue-100/30 border-blue-100"}
                                                `}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className={`flex items-center gap-1.5 font-semibold ${isViewingOther && e.status === 'busy' ? "text-slate-600" : "text-blue-800"}`}>
                                                        <CalendarIcon className={`h-4 w-4 ${isViewingOther && e.status === 'busy' ? "text-slate-400" : "text-blue-500"}`} />
                                                        {isViewingOther && e.status === 'busy' ? (
                                                            'Busy'
                                                        ) : (
                                                            e.title
                                                        )}
                                                    </div>

                                                    {(!isViewingOther || e.status !== 'busy') && e.status === 'tentative' && (
                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">Tentative</Badge>
                                                    )}
                                                </div>

                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                        {e.is_all_day ? (
                                                            "All Day"
                                                        ) : (
                                                            `${format(new Date(e.start_time), "h:mm a")} - ${format(new Date(e.end_time), "h:mm a")}`
                                                        )}
                                                    </div>

                                                    {(!isViewingOther || e.status !== 'busy') && e.location && (
                                                        <div className="text-xs text-slate-500 mt-1 line-clamp-1 border-t border-blue-100 pt-2">
                                                            <span className="font-medium mr-1">Location:</span>
                                                            {e.location}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
