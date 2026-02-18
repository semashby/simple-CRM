"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, FileText, Mail, Trash2, Copy, Pencil } from "lucide-react";

interface CallScript {
    id: string;
    name: string;
    body: string;
    created_by: string;
    created_at: string;
}

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
    created_by: string;
    created_at: string;
}

export default function TemplatesPage() {
    const supabase = createClient();
    const [scripts, setScripts] = useState<CallScript[]>([]);
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    // Script form
    const [scriptOpen, setScriptOpen] = useState(false);
    const [editingScript, setEditingScript] = useState<CallScript | null>(null);
    const [scriptName, setScriptName] = useState("");
    const [scriptBody, setScriptBody] = useState("");

    // Email template form
    const [emailOpen, setEmailOpen] = useState(false);
    const [editingEmail, setEditingEmail] = useState<EmailTemplate | null>(null);
    const [emailName, setEmailName] = useState("");
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");

    const fetchAll = async () => {
        setLoading(true);
        const [{ data: s }, { data: e }] = await Promise.all([
            supabase.from("call_scripts").select("*").order("created_at", { ascending: false }),
            supabase.from("email_templates").select("*").order("created_at", { ascending: false }),
        ]);
        setScripts((s as CallScript[]) || []);
        setEmailTemplates((e as EmailTemplate[]) || []);
        setLoading(false);
    };

    useEffect(() => { fetchAll(); }, []);

    // ─── Script CRUD ───
    const openScriptEditor = (script?: CallScript) => {
        if (script) {
            setEditingScript(script);
            setScriptName(script.name);
            setScriptBody(script.body);
        } else {
            setEditingScript(null);
            setScriptName("");
            setScriptBody("");
        }
        setScriptOpen(true);
    };

    const handleSaveScript = async (e: React.FormEvent) => {
        e.preventDefault();
        const { data: userData } = await supabase.auth.getUser();
        if (editingScript) {
            await supabase.from("call_scripts").update({ name: scriptName, body: scriptBody, updated_at: new Date().toISOString() }).eq("id", editingScript.id);
        } else {
            await supabase.from("call_scripts").insert({ name: scriptName, body: scriptBody, created_by: userData.user?.id });
        }
        setScriptOpen(false);
        fetchAll();
    };

    const handleDeleteScript = async (id: string) => {
        await supabase.from("call_scripts").delete().eq("id", id);
        fetchAll();
    };

    // ─── Email Template CRUD ───
    const openEmailEditor = (tmpl?: EmailTemplate) => {
        if (tmpl) {
            setEditingEmail(tmpl);
            setEmailName(tmpl.name);
            setEmailSubject(tmpl.subject);
            setEmailBody(tmpl.body);
        } else {
            setEditingEmail(null);
            setEmailName("");
            setEmailSubject("");
            setEmailBody("");
        }
        setEmailOpen(true);
    };

    const handleSaveEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        const { data: userData } = await supabase.auth.getUser();
        if (editingEmail) {
            await supabase.from("email_templates").update({ name: emailName, subject: emailSubject, body: emailBody, updated_at: new Date().toISOString() }).eq("id", editingEmail.id);
        } else {
            await supabase.from("email_templates").insert({ name: emailName, subject: emailSubject, body: emailBody, created_by: userData.user?.id });
        }
        setEmailOpen(false);
        fetchAll();
    };

    const handleDeleteEmail = async (id: string) => {
        await supabase.from("email_templates").delete().eq("id", id);
        fetchAll();
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const placeholderHint = "Available placeholders: {{first_name}}, {{last_name}}, {{company}}, {{email}}";

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">Templates</h1>
                <p className="text-sm text-slate-500">
                    Call scripts and email templates for your team
                </p>
            </div>

            <Tabs defaultValue="scripts" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="scripts" className="gap-1.5">
                        <FileText className="h-4 w-4" />
                        Call Scripts
                    </TabsTrigger>
                    <TabsTrigger value="emails" className="gap-1.5">
                        <Mail className="h-4 w-4" />
                        Email Templates
                    </TabsTrigger>
                </TabsList>

                {/* ─── CALL SCRIPTS TAB ─── */}
                <TabsContent value="scripts" className="space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={() => openScriptEditor()}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Script
                        </Button>
                    </div>

                    {loading ? (
                        <p className="py-10 text-center text-slate-400">Loading...</p>
                    ) : scripts.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <FileText className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                                <p className="text-sm text-slate-500">No call scripts yet. Create one to help guide your team&apos;s calls.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {scripts.map((script) => (
                                <Card key={script.id} className="group">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <CardTitle className="text-base">{script.name}</CardTitle>
                                                <CardDescription className="text-xs">
                                                    {new Date(script.created_at).toLocaleDateString()}
                                                </CardDescription>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openScriptEditor(script)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDeleteScript(script.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <pre className="whitespace-pre-wrap text-xs text-slate-600 line-clamp-6 font-sans">{script.body}</pre>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="mt-3 text-xs"
                                            onClick={() => copyToClipboard(script.body)}
                                        >
                                            <Copy className="mr-1 h-3 w-3" />
                                            Copy Script
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* ─── EMAIL TEMPLATES TAB ─── */}
                <TabsContent value="emails" className="space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={() => openEmailEditor()}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Template
                        </Button>
                    </div>

                    {loading ? (
                        <p className="py-10 text-center text-slate-400">Loading...</p>
                    ) : emailTemplates.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <Mail className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                                <p className="text-sm text-slate-500">No email templates yet. Create one to streamline follow-ups.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {emailTemplates.map((tmpl) => (
                                <Card key={tmpl.id} className="group">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <CardTitle className="text-base">{tmpl.name}</CardTitle>
                                                <CardDescription className="text-xs">
                                                    Subject: {tmpl.subject}
                                                </CardDescription>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEmailEditor(tmpl)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDeleteEmail(tmpl.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <pre className="whitespace-pre-wrap text-xs text-slate-600 line-clamp-5 font-sans">{tmpl.body}</pre>
                                        <div className="flex gap-2 mt-3">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-xs"
                                                onClick={() => copyToClipboard(`Subject: ${tmpl.subject}\n\n${tmpl.body}`)}
                                            >
                                                <Copy className="mr-1 h-3 w-3" />
                                                Copy
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* ─── Script Editor Dialog ─── */}
            <Dialog open={scriptOpen} onOpenChange={setScriptOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingScript ? "Edit" : "New"} Call Script</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveScript} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Script Name</Label>
                            <Input
                                placeholder="e.g. Cold Call Opener"
                                value={scriptName}
                                onChange={(e) => setScriptName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Script Body</Label>
                            <textarea
                                placeholder={`Hi {{first_name}}, this is [Your Name] from [Company]...\n\n${placeholderHint}`}
                                value={scriptBody}
                                onChange={(e) => setScriptBody(e.target.value)}
                                className="flex min-h-[200px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                                required
                            />
                        </div>
                        <p className="text-[10px] text-slate-400">{placeholderHint}</p>
                        <Button type="submit" className="w-full">
                            {editingScript ? "Update" : "Create"} Script
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Email Template Editor Dialog ─── */}
            <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingEmail ? "Edit" : "New"} Email Template</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveEmail} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Template Name</Label>
                            <Input
                                placeholder="e.g. Follow-Up After Call"
                                value={emailName}
                                onChange={(e) => setEmailName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Subject Line</Label>
                            <Input
                                placeholder="e.g. Great speaking with you, {{first_name}}"
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Email Body</Label>
                            <textarea
                                placeholder={`Hi {{first_name}},\n\nIt was great speaking with you today...\n\n${placeholderHint}`}
                                value={emailBody}
                                onChange={(e) => setEmailBody(e.target.value)}
                                className="flex min-h-[200px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                                required
                            />
                        </div>
                        <p className="text-[10px] text-slate-400">{placeholderHint}</p>
                        <Button type="submit" className="w-full">
                            {editingEmail ? "Update" : "Create"} Template
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
