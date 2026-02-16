"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    Kanban,
    Upload,
    LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/contacts", label: "Contacts", icon: Users },
    { href: "/pipeline", label: "Pipeline", icon: Kanban },
    { href: "/import", label: "Import CSV", icon: Upload },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
    };

    return (
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
            {/* Logo / Brand */}
            <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
                    <span className="text-sm font-bold text-white">C</span>
                </div>
                <span className="text-lg font-semibold text-slate-900">CRM</span>
            </div>

            {/* Nav */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navItems.map((item) => {
                    const isActive =
                        item.href === "/"
                            ? pathname === "/"
                            : pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive
                                    ? "bg-slate-100 text-slate-900"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                }`}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom */}
            <div className="border-t border-slate-200 p-3">
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                    <LogOut className="h-5 w-5" />
                    Log Out
                </button>
            </div>
        </aside>
    );
}
