"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Flame,
    PhoneCall,
    Clock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Contact, Reminder } from "@/lib/types";
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
} from "date-fns";

interface CalendarReminder extends Reminder {
    contact?: Contact;
}

export default function CalendarPage() {
    const supabase = createClient();
    const router = useRouter();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [reminders, setReminders] = useState<CalendarReminder[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchReminders = useCallback(async () => {
        setLoading(true);
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

        const { data } = await supabase
            .from("reminders")
            .select("*, contact:contacts(*)")
            .eq("is_done", false)
            .gte("due_date", calStart.toISOString())
            .lte("due_date", calEnd.toISOString())
            .order("due_date", { ascending: true });

        setReminders((data as CalendarReminder[]) || []);
        setLoading(false);
    }, [currentMonth]);

    useEffect(() => {
        fetchReminders();
    }, [fetchReminders]);

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

    // Group reminders by date
    const remindersByDate = new Map<string, CalendarReminder[]>();
    reminders.forEach((r) => {
        const key = format(new Date(r.due_date), "yyyy-MM-dd");
        if (!remindersByDate.has(key)) remindersByDate.set(key, []);
        remindersByDate.get(key)!.push(r);
    });

    const selectedReminders = selectedDate
        ? remindersByDate.get(format(selectedDate, "yyyy-MM-dd")) || []
        : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                        <CalendarIcon className="h-6 w-6 text-slate-600" />
                        Calendar
                    </h1>
                    <p className="text-sm text-slate-500">
                        View all callbacks and reminders
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-semibold text-slate-800 min-w-[140px] text-center">
                        {format(currentMonth, "MMMM yyyy")}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
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
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                {/* Calendar Grid */}
                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="py-20 text-center text-slate-400">Loading calendar...</div>
                        ) : (
                            <div>
                                {/* Day headers */}
                                <div className="grid grid-cols-7 border-b border-slate-100">
                                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                                        <div key={d} className="py-2 text-center text-xs font-medium text-slate-500">
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
                                                    className={`min-h-[80px] border-b border-r border-slate-50 p-1.5 cursor-pointer transition-colors
                                                        ${!inMonth ? "bg-slate-50/60" : "hover:bg-slate-50"}
                                                        ${selected ? "bg-cyan-50 ring-1 ring-cyan-300" : ""}
                                                    `}
                                                >
                                                    <div className={`flex items-center justify-between mb-1`}>
                                                        <span
                                                            className={`text-xs font-medium inline-flex items-center justify-center h-6 w-6 rounded-full
                                                                ${today ? "bg-cyan-500 text-white" : ""}
                                                                ${!inMonth ? "text-slate-300" : "text-slate-600"}
                                                            `}
                                                        >
                                                            {format(d, "d")}
                                                        </span>
                                                        {dayReminders.length > 0 && (
                                                            <span className="text-[10px] text-slate-400">
                                                                {dayReminders.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Dots for reminders */}
                                                    <div className="flex flex-wrap gap-0.5">
                                                        {dayReminders.slice(0, 4).map((r) => (
                                                            <div
                                                                key={r.id}
                                                                className={`h-1.5 w-1.5 rounded-full ${r.is_priority
                                                                        ? "bg-orange-400"
                                                                        : hasOverdue
                                                                            ? "bg-red-400"
                                                                            : "bg-cyan-400"
                                                                    }`}
                                                            />
                                                        ))}
                                                        {dayReminders.length > 4 && (
                                                            <span className="text-[8px] text-slate-400">
                                                                +{dayReminders.length - 4}
                                                            </span>
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
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Clock className="h-4 w-4" />
                            {selectedDate ? format(selectedDate, "EEEE, MMMM d") : "Select a day"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!selectedDate ? (
                            <p className="text-sm text-slate-400">Click on a day to see callbacks</p>
                        ) : selectedReminders.length === 0 ? (
                            <p className="text-sm text-slate-400">No callbacks for this day ✨</p>
                        ) : (
                            <div className="space-y-2">
                                {selectedReminders.map((r) => {
                                    const contact = r.contact as unknown as Contact;
                                    const overdue = isBefore(new Date(r.due_date), new Date());
                                    return (
                                        <div
                                            key={r.id}
                                            onClick={() => contact?.id && router.push(`/contacts/${contact.id}`)}
                                            className={`rounded-lg border p-3 text-sm cursor-pointer hover:bg-slate-50 transition-colors ${r.is_priority
                                                    ? "border-orange-300 bg-orange-50/60"
                                                    : overdue
                                                        ? "border-red-200 bg-red-50/40"
                                                        : "border-slate-100"
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                {r.is_priority && <Flame className="h-3.5 w-3.5 text-orange-500" />}
                                                {overdue && !r.is_priority && <PhoneCall className="h-3.5 w-3.5 text-red-500" />}
                                                <span className="font-medium text-slate-700">
                                                    {contact?.first_name} {contact?.last_name}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mb-1">{r.title}</p>
                                            {contact?.company_name && (
                                                <p className="text-[10px] text-slate-400">{contact.company_name}</p>
                                            )}
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-[10px] text-slate-400">
                                                    {format(new Date(r.due_date), "h:mm a")}
                                                </span>
                                                {overdue && (
                                                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                                                        Overdue
                                                    </Badge>
                                                )}
                                                {r.is_priority && (
                                                    <Badge className="bg-orange-100 text-orange-700 text-[9px] px-1.5 py-0">
                                                        Priority
                                                    </Badge>
                                                )}
                                            </div>
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
