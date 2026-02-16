"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProjectSelector } from "@/components/project-selector";
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
import { Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Contact, ContactStatus } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const PAGE_SIZE = 20;

export default function ContactsPage() {
    const supabase = createClient();
    const router = useRouter();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [projectId, setProjectId] = useState("all");
    const [addOpen, setAddOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // New contact form
    const [newContact, setNewContact] = useState({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        company_name: "",
        function: "",
    });

    const fetchContacts = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from("contacts")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (projectId !== "all") query = query.eq("project_id", projectId);
        if (statusFilter !== "all") query = query.eq("status", statusFilter);
        if (search) {
            query = query.or(
                `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`
            );
        }

        const { data, count } = await query;
        setContacts(data || []);
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

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Contacts</h1>
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
                <ProjectSelector value={projectId} onChange={(v) => { setProjectId(v); setPage(0); }} />
            </div>

            {/* Table */}
            <div className="rounded-lg border border-slate-200 bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Location</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : contacts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                                    No contacts found
                                </TableCell>
                            </TableRow>
                        ) : (
                            contacts.map((contact) => (
                                <TableRow
                                    key={contact.id}
                                    className="cursor-pointer hover:bg-slate-50"
                                    onClick={() => router.push(`/contacts/${contact.id}`)}
                                >
                                    <TableCell className="font-medium">
                                        {contact.first_name} {contact.last_name}
                                    </TableCell>
                                    <TableCell className="text-slate-600">
                                        {contact.company_name || "—"}
                                    </TableCell>
                                    <TableCell className="text-slate-500">
                                        {contact.email || "—"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="secondary"
                                            className={STATUS_CONFIG[contact.status]?.color}
                                        >
                                            {STATUS_CONFIG[contact.status]?.label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-slate-500">
                                        {contact.location || "—"}
                                    </TableCell>
                                </TableRow>
                            ))
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
        </div>
    );
}
