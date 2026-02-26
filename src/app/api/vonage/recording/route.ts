import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, key);
}

/**
 * POST /api/vonage/recording
 * Vonage recording webhook — receives the recording URL after a call ends.
 * Updates the vonage_calls record with the recording URL.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        console.log("[Vonage Recording]", JSON.stringify(body));

        const { recording_url, conversation_uuid, recording_uuid } = body;

        if (!recording_url) {
            return NextResponse.json({ received: true });
        }

        const supabase = getSupabaseAdmin();

        // Try to match by conversation UUID first, then by recording UUID
        const uuid = conversation_uuid || recording_uuid;
        if (uuid) {
            const { error } = await supabase
                .from("vonage_calls")
                .update({ recording_url })
                .eq("vonage_uuid", uuid);

            if (error) {
                console.error("[Vonage Recording] DB update error:", error);
            }
        }

        return NextResponse.json({ received: true });
    } catch (err) {
        console.error("[Vonage Recording] Error:", err);
        return NextResponse.json({ received: true });
    }
}

export async function GET() {
    return NextResponse.json({ status: "ok" });
}
