"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface UseAccessibleProjectsReturn {
    /** null = no restriction (admin/super_admin), string[] = agent's allowed projects */
    accessibleProjectIds: string[] | null;
    role: string;
    userId: string;
    loading: boolean;
}

/**
 * Hook that returns accessible project IDs based on user role.
 * - Admins/Super Admins: returns null (no restriction, they see everything)
 * - Agents: returns the list of project IDs they're a member of (may be empty)
 */
export function useAccessibleProjects(): UseAccessibleProjectsReturn {
    const [accessibleProjectIds, setAccessibleProjectIds] = useState<string[] | null>(null);
    const [role, setRole] = useState("agent");
    const [userId, setUserId] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            const supabase = createClient();
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) {
                setLoading(false);
                return;
            }

            const uid = userData.user.id;
            setUserId(uid);

            // Get role
            const { data: profile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", uid)
                .single();

            const userRole = profile?.role || "agent";
            setRole(userRole);

            // Admins/Super Admins see everything
            if (userRole === "admin" || userRole === "super_admin") {
                setAccessibleProjectIds(null);
                setLoading(false);
                return;
            }

            // Agents: fetch their project memberships
            const { data: memberships } = await supabase
                .from("project_members")
                .select("project_id")
                .eq("user_id", uid);

            const projectIds = (memberships || []).map(
                (m: { project_id: string }) => m.project_id
            );
            setAccessibleProjectIds(projectIds);
            setLoading(false);
        };

        fetch();
    }, []);

    return { accessibleProjectIds, role, userId, loading };
}
