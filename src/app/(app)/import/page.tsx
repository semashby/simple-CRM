"use client";
export const dynamic = "force-dynamic";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
    Upload,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    Plus,
} from "lucide-react";
import type { Project } from "@/lib/types";
import { useEffect } from "react";

// Column mapping for auto-detection
const KNOWN_MAPPINGS: Record<string, string> = {
    name: "first_name",
    full_name: "first_name",
    "first name": "first_name",
    "last name": "last_name",
    email: "email",
    phone: "phone",
    phone_1: "phone",
    function: "function",
    title: "function",
    "job title": "function",
    current_company_position: "function",
    company: "company_name",
    company_name: "company_name",
    current_company: "company_name",
    branch: "branch",
    industry: "branch",
    current_company_industry: "branch",
    linkedin: "linkedin_url",
    linkedin_url: "linkedin_url",
    profile_url: "linkedin_url",
    "linkedin url": "linkedin_url",
    website: "website",
    website_1: "website",
    location: "location",
    location_name: "location",
};

const CRM_FIELDS = [
    { value: "skip", label: "Skip" },
    { value: "first_name", label: "First Name" },
    { value: "last_name", label: "Last Name" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone" },
    { value: "function", label: "Function" },
    { value: "company_name", label: "Company" },
    { value: "branch", label: "Branch" },
    { value: "linkedin_url", label: "LinkedIn URL" },
    { value: "website", label: "Website" },
    { value: "location", label: "Location" },
];

type Step = "select-project" | "upload" | "map" | "importing" | "done";

export default function ImportPage() {
    const supabase = createClient();
    const fileRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>("select-project");
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState("");
    const [newProjectName, setNewProjectName] = useState("");
    const [newProjectDesc, setNewProjectDesc] = useState("");
    const [creatingProject, setCreatingProject] = useState(false);

    // CSV Data
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<string[][]>([]);
    const [mapping, setMapping] = useState<Record<number, string>>({});
    const [fileName, setFileName] = useState("");

    // Import result
    const [importCount, setImportCount] = useState(0);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        const fetchProjects = async () => {
            const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
            if (data) setProjects(data);
        };
        fetchProjects();
    }, []);

    const handleCreateProject = async () => {
        if (!newProjectName) return;
        const { data: userData } = await supabase.auth.getUser();
        const { data } = await supabase
            .from("projects")
            .insert({ name: newProjectName, description: newProjectDesc, created_by: userData.user?.id })
            .select()
            .single();

        if (data) {
            setProjects([data, ...projects]);
            setSelectedProject(data.id);
            setCreatingProject(false);
            setNewProjectName("");
            setNewProjectDesc("");
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const delimiter = text.split("\n")[0].includes(";") ? ";" : ",";
            const lines = text.split("\n").filter((l) => l.trim());

            const csvHeaders = lines[0].split(delimiter).map((h) => h.trim().replace(/"/g, ""));
            const csvRows = lines.slice(1).map((line) =>
                line.split(delimiter).map((cell) => cell.trim().replace(/"/g, ""))
            );

            setHeaders(csvHeaders);
            setRows(csvRows);

            // Auto-map columns
            const autoMapping: Record<number, string> = {};
            csvHeaders.forEach((header, idx) => {
                const normalized = header.toLowerCase().trim();
                if (KNOWN_MAPPINGS[normalized]) {
                    autoMapping[idx] = KNOWN_MAPPINGS[normalized];
                } else {
                    autoMapping[idx] = "skip";
                }
            });
            setMapping(autoMapping);
            setStep("map");
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        setImporting(true);
        setStep("importing");

        const { data: userData } = await supabase.auth.getUser();
        const batchSize = 50;
        let total = 0;

        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const contacts = batch
                .map((row) => {
                    const contact: Record<string, string | null> = {
                        first_name: "",
                        last_name: "",
                        project_id: selectedProject || null,
                        source: "CSV Import",
                        created_by: userData.user?.id || null,
                    };

                    Object.entries(mapping).forEach(([idx, field]) => {
                        if (field !== "skip") {
                            const value = row[parseInt(idx)] || "";
                            // Handle full_name → split into first/last
                            if (field === "first_name" && headers[parseInt(idx)].toLowerCase().includes("name") && !headers[parseInt(idx)].toLowerCase().includes("first")) {
                                const parts = value.split(" ");
                                contact.first_name = parts[0] || "";
                                contact.last_name = parts.slice(1).join(" ") || "";
                            } else {
                                contact[field] = value;
                            }
                        }
                    });

                    return contact;
                })
                .filter((c) => c.first_name);

            if (contacts.length > 0) {
                await supabase.from("contacts").insert(contacts);
                total += contacts.length;
            }
        }

        setImportCount(total);
        setImporting(false);
        setStep("done");
    };

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">Import CSV</h1>
                <p className="text-sm text-slate-500">
                    Upload a lead list and map columns to your CRM fields
                </p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-2 text-sm">
                {["Select Project", "Upload", "Map Columns", "Import"].map((label, i) => {
                    const stepIndex = ["select-project", "upload", "map", "done"].indexOf(step);
                    const isActive = i <= (step === "importing" ? 3 : stepIndex);
                    return (
                        <div key={label} className="flex items-center gap-2">
                            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"}`}>
                                {i + 1}
                            </div>
                            <span className={isActive ? "text-slate-900" : "text-slate-400"}>{label}</span>
                            {i < 3 && <div className="mx-2 h-px w-8 bg-slate-200" />}
                        </div>
                    );
                })}
            </div>

            {/* STEP 1: Select Project */}
            {step === "select-project" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Select or Create a Project</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!creatingProject ? (
                            <>
                                <Select value={selectedProject} onValueChange={setSelectedProject}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a project..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projects.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex gap-2">
                                    <Button onClick={() => setStep("upload")} disabled={!selectedProject}>
                                        Continue
                                    </Button>
                                    <Button variant="outline" onClick={() => setCreatingProject(true)}>
                                        <Plus className="mr-2 h-4 w-4" /> New Project
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label>Project Name *</Label>
                                    <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="e.g. Marketing Agencies Q1" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Textarea value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} placeholder="Optional notes about this lead list" rows={2} />
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={handleCreateProject} disabled={!newProjectName}>Create & Continue</Button>
                                    <Button variant="outline" onClick={() => setCreatingProject(false)}>Cancel</Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* STEP 2: Upload */}
            {step === "upload" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Upload CSV File</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-slate-200 p-12 text-center transition-colors hover:border-slate-400"
                        >
                            <Upload className="h-8 w-8 text-slate-400" />
                            <p className="text-sm font-medium text-slate-600">
                                Click to upload or drag and drop
                            </p>
                            <p className="text-xs text-slate-400">CSV files only</p>
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </CardContent>
                </Card>
            )}

            {/* STEP 3: Map Columns */}
            {step === "map" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4" />
                            Map Columns — {fileName}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-slate-500">
                            {rows.length} rows detected. Map your CSV columns to CRM fields:
                        </p>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>CSV Column</TableHead>
                                    <TableHead>Sample Data</TableHead>
                                    <TableHead>Map To</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {headers.map((header, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-medium">{header}</TableCell>
                                        <TableCell className="text-slate-500 text-xs max-w-[200px] truncate">
                                            {rows[0]?.[idx] || "—"}
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={mapping[idx] || "skip"}
                                                onValueChange={(v) => setMapping({ ...mapping, [idx]: v })}
                                            >
                                                <SelectTrigger className="w-[160px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {CRM_FIELDS.map((f) => (
                                                        <SelectItem key={f.value} value={f.value}>
                                                            {f.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <Button onClick={handleImport} className="w-full">
                            Import {rows.length} Contacts
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* STEP 4: Importing */}
            {step === "importing" && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-4 py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
                        <p className="text-sm font-medium">Importing contacts...</p>
                    </CardContent>
                </Card>
            )}

            {/* STEP 5: Done */}
            {step === "done" && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-4 py-12">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                        <p className="text-lg font-semibold">Import Complete!</p>
                        <p className="text-sm text-slate-500">
                            Successfully imported {importCount} contacts
                        </p>
                        <div className="flex gap-2">
                            <Button onClick={() => { setStep("select-project"); setHeaders([]); setRows([]); }}>
                                Import Another
                            </Button>
                            <Button variant="outline" onClick={() => window.location.href = "/contacts"}>
                                View Contacts
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
