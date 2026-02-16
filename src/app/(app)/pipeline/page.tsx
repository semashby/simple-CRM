"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import type { Contact, ContactStatus } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/types";

const PIPELINE_ORDER: ContactStatus[] = [
    "new",
    "contacted",
    "meeting_scheduled",
    "proposal_sent",
    "negotiation",
    "client",
    "lost",
];

export default function PipelinePage() {
    const supabase = createClient();
    const router = useRouter();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [dragging, setDragging] = useState<string | null>(null);

    const fetchContacts = useCallback(async () => {
        const { data } = await supabase
            .from("contacts")
            .select("*")
            .order("updated_at", { ascending: false });
        setContacts(data || []);
    }, []);

    useEffect(() => {
        fetchContacts();
    }, [fetchContacts]);

    const getContactsByStatus = (status: ContactStatus) =>
        contacts.filter((c) => c.status === status);

    const handleDragStart = (e: React.DragEvent, contactId: string) => {
        e.dataTransfer.setData("contactId", contactId);
        setDragging(contactId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, newStatus: ContactStatus) => {
        e.preventDefault();
        const contactId = e.dataTransfer.getData("contactId");
        setDragging(null);

        const contact = contacts.find((c) => c.id === contactId);
        if (!contact || contact.status === newStatus) return;

        // Optimistic update
        setContacts((prev) =>
            prev.map((c) => (c.id === contactId ? { ...c, status: newStatus } : c))
        );

        const { data: userData } = await supabase.auth.getUser();

        await supabase.from("contacts").update({ status: newStatus }).eq("id", contactId);
        await supabase.from("activities").insert({
            contact_id: contactId,
            type: "status_change",
            description: `Status changed from ${STATUS_CONFIG[contact.status]?.label} to ${STATUS_CONFIG[newStatus]?.label}`,
            created_by: userData.user?.id,
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">Pipeline</h1>
                <p className="text-sm text-slate-500">
                    Drag contacts between stages to update their status
                </p>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4">
                {PIPELINE_ORDER.map((status) => {
                    const config = STATUS_CONFIG[status];
                    const items = getContactsByStatus(status);

                    return (
                        <div
                            key={status}
                            className="flex min-w-[240px] flex-col rounded-lg border border-slate-200 bg-white"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, status)}
                        >
                            {/* Column Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 p-3">
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className={config.color}>
                                        {config.label}
                                    </Badge>
                                </div>
                                <span className="text-xs font-medium text-slate-400">
                                    {items.length}
                                </span>
                            </div>

                            {/* Cards */}
                            <div className="flex-1 space-y-2 p-2 min-h-[200px]">
                                {items.map((contact) => (
                                    <div
                                        key={contact.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, contact.id)}
                                        onClick={() => router.push(`/contacts/${contact.id}`)}
                                        className={`cursor-grab rounded-lg border border-slate-100 bg-white p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing ${dragging === contact.id ? "opacity-50" : ""
                                            }`}
                                    >
                                        <p className="text-sm font-medium text-slate-900">
                                            {contact.first_name} {contact.last_name}
                                        </p>
                                        {contact.company_name && (
                                            <p className="text-xs text-slate-500 mt-1">
                                                {contact.company_name}
                                            </p>
                                        )}
                                        {contact.email && (
                                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                                                {contact.email}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
