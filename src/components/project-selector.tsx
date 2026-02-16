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
}

export function ProjectSelector({ value, onChange }: ProjectSelectorProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const supabase = createClient();

    useEffect(() => {
        const fetchProjects = async () => {
            const { data } = await supabase
                .from("projects")
                .select("*")
                .order("created_at", { ascending: false });
            if (data) setProjects(data);
        };
        fetchProjects();
    }, []);

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                        {project.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
