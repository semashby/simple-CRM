"use client";

import { useEffect, useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";

interface ProjectSelectorProps {
    value: string;
    onChange: (value: string) => void;
    /** If provided, only show these project IDs. null = show all (admin). */
    accessibleProjectIds?: string[] | null;
}

export function ProjectSelector({ value, onChange, accessibleProjectIds }: ProjectSelectorProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const supabase = createClient();

    useEffect(() => {
        const fetchProjects = async () => {
            let query = supabase
                .from("projects")
                .select("*")
                .neq("status", "archived")
                .order("created_at", { ascending: false });

            // If agent has specific project access, filter to only those
            if (accessibleProjectIds !== undefined && accessibleProjectIds !== null) {
                if (accessibleProjectIds.length === 0) {
                    setProjects([]);
                    return;
                }
                query = query.in("id", accessibleProjectIds);
            }

            const { data } = await query;
            if (data) setProjects(data);
        };
        fetchProjects();
    }, [accessibleProjectIds]);

    const isRestricted = accessibleProjectIds !== undefined && accessibleProjectIds !== null;

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {!isRestricted && <SelectItem value="unassigned">Unassigned</SelectItem>}
                {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                        {project.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
