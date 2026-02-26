"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import type { CalendarConnection } from "@/lib/types";

interface CalendarConnectModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    connection?: CalendarConnection | null;
    onStatusChange: () => void;
}

export function CalendarConnectModal({ open, onOpenChange, connection, onStatusChange }: CalendarConnectModalProps) {
    const [loading, setLoading] = useState(false);

    const handleConnectClick = () => {
        window.location.href = "/api/calendar/connect";
    };

    const handleDisconnect = async () => {
        if (!confirm("Are you sure you want to disconnect your calendar? All synced events will be removed from the CRM.")) return;

        setLoading(true);
        try {
            await fetch("/api/calendar/disconnect", { method: "POST" });
            onStatusChange();
            onOpenChange(false);
        } catch (err) {
            console.error("Failed to disconnect", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-slate-600" />
                        Calendar Settings
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4">
                    {!connection ? (
                        // Not connected state
                        <div className="text-center space-y-4">
                            <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                                <CalendarIcon className="w-6 h-6 text-blue-500" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900">Connect Your Calendar</h3>
                            <p className="text-sm text-slate-500">
                                Connect Google, Outlook, or Apple calendar using Cal.com to sync your availability and create meetings directly from the CRM.
                            </p>
                            <Button
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4"
                                onClick={handleConnectClick}
                            >
                                Continue with Cal.com
                            </Button>
                        </div>
                    ) : (
                        // Active and configured
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 p-4 border rounded-xl bg-slate-50">
                                <div className="bg-white p-2 text-green-600 rounded-lg shadow-sm border">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900">Account Connected</h4>
                                    <p className="text-xs text-green-600 font-medium flex items-center gap-1 mt-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        Connected & Syncing via Cal.com
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 border-t flex gap-3">
                                <Button variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDisconnect} disabled={loading}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Disconnect Calendar
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
