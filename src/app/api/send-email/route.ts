import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
    try {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "RESEND_API_KEY is not configured. Add it to .env.local" },
                { status: 500 }
            );
        }

        const resend = new Resend(apiKey);
        const { to, subject, body, fromName, fromEmail } = await req.json();

        if (!to || !subject || !body) {
            return NextResponse.json(
                { error: "Missing required fields: to, subject, body" },
                { status: 400 }
            );
        }

        // Use the agent's name as the sender name.
        // fromEmail can be the verified domain email, e.g. "noreply@yourdomain.com"
        const senderEmail = fromEmail || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
        const senderName = fromName || "CRM";

        const { data, error } = await resend.emails.send({
            from: `${senderName} <${senderEmail}>`,
            to: [to],
            subject,
            text: body,
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, id: data?.id });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}
