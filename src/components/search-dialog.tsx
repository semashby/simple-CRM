"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Command } from "cmdk";
import { Search, User, Building2, X } from "lucide-react";

interface SearchResult {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    email: string | null;
    phone: string | null;
    status: string;
}

export function SearchDialog() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    // Cmd+K to open
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((o) => !o);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    // Search contacts
    const search = useCallback(
        async (q: string) => {
            if (q.length < 2) {
                setResults([]);
                return;
            }
            setLoading(true);
            const { data } = await supabase
                .from("contacts")
                .select("id, first_name, last_name, company_name, email, phone, status")
                .or(
                    `first_name.ilike.%${q}%,last_name.ilike.%${q}%,company_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
                )
                .limit(12);
            setResults((data as SearchResult[]) || []);
            setLoading(false);
        },
        [supabase]
    );

    useEffect(() => {
        const timer = setTimeout(() => search(query), 200);
        return () => clearTimeout(timer);
    }, [query, search]);

    const handleSelect = (id: string) => {
        setOpen(false);
        setQuery("");
        setResults([]);
        router.push(`/contacts/${id}`);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setOpen(false)}
            />

            {/* Search Panel */}
            <div className="relative mx-auto mt-[15vh] w-full max-w-lg">
                <Command
                    className="rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
                    shouldFilter={false}
                >
                    {/* Input */}
                    <div className="flex items-center border-b border-slate-100 px-4">
                        <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                        <input
                            autoFocus
                            placeholder="Search contacts…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                        />
                        <button
                            onClick={() => setOpen(false)}
                            className="ml-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Results */}
                    <Command.List className="max-h-72 overflow-y-auto p-2">
                        {query.length < 2 && (
                            <div className="px-4 py-8 text-center text-sm text-slate-400">
                                Type at least 2 characters to search…
                            </div>
                        )}

                        {query.length >= 2 && loading && (
                            <div className="px-4 py-8 text-center text-sm text-slate-400">
                                Searching…
                            </div>
                        )}

                        {query.length >= 2 && !loading && results.length === 0 && (
                            <Command.Empty className="px-4 py-8 text-center text-sm text-slate-400">
                                No results found.
                            </Command.Empty>
                        )}

                        {results.map((contact) => (
                            <Command.Item
                                key={contact.id}
                                value={contact.id}
                                onSelect={() => handleSelect(contact.id)}
                                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50 data-[selected=true]:bg-slate-100 transition-colors"
                            >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 text-xs font-bold text-white">
                                    {(contact.first_name || "?")[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <User className="h-3 w-3 text-slate-400 shrink-0" />
                                        <span className="font-medium text-slate-800 truncate">
                                            {contact.first_name} {contact.last_name}
                                        </span>
                                    </div>
                                    {contact.company_name && (
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Building2 className="h-3 w-3 text-slate-300 shrink-0" />
                                            <span className="text-xs text-slate-400 truncate">
                                                {contact.company_name}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <span className="text-[10px] text-slate-400 uppercase shrink-0">
                                    {contact.status}
                                </span>
                            </Command.Item>
                        ))}
                    </Command.List>

                    {/* Footer hint */}
                    <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 flex items-center gap-4">
                        <span>
                            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">↑↓</kbd> Navigate
                        </span>
                        <span>
                            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">↵</kbd> Open
                        </span>
                        <span>
                            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">Esc</kbd> Close
                        </span>
                    </div>
                </Command>
            </div>
        </div>
    );
}
