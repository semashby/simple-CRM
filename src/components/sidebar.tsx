"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
    LayoutDashboard,
    Users,
    Kanban,
    Upload,
    LogOut,
    PhoneCall,
    Shield,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";

interface NavItem {
    href: string;
    label: string;
    icon: LucideIcon;
    minRole: "agent" | "admin" | "super_admin";
}

const ROLE_LEVEL: Record<string, number> = {
    agent: 1,
    admin: 2,
    super_admin: 3,
};

const navItems: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, minRole: "agent" },
    { href: "/contacts", label: "Contacts", icon: Users, minRole: "agent" },
    { href: "/call-queue", label: "Call Queue", icon: PhoneCall, minRole: "agent" },
    { href: "/pipeline", label: "Pipeline", icon: Kanban, minRole: "agent" },
    { href: "/import", label: "Import CSV", icon: Upload, minRole: "super_admin" },
    { href: "/admin", label: "Admin", icon: Shield, minRole: "admin" },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [userRole, setUserRole] = useState<string>("agent");

    useEffect(() => {
        const fetchRole = async () => {
            const supabase = createClient();
            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", userData.user.id)
                    .single();
                if (profile?.role) {
                    setUserRole(profile.role);
                }
            }
        };
        fetchRole();
    }, []);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
    };

    const userLevel = ROLE_LEVEL[userRole] || 1;
    const visibleItems = navItems.filter(
        (item) => userLevel >= ROLE_LEVEL[item.minRole]
    );

    return (
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
            {/* Logo / Brand */}
            <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
                <div className="flex flex-col">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Powered by</span>
                    <img src="/Cookied.svg" alt="Cookied" className="h-5 w-auto" />
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {visibleItems.map((item) => {
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
