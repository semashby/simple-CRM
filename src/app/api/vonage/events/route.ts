import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service-level Supabase client for webhook handlers (no user auth context)
function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, key);
}

/**
 * POST /api/vonage/events
 * Vonage event webhook — receives call status updates.
 * Updates the vonage_calls record with status, duration, and timestamps.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        console.log("[Vonage Event]", JSON.stringify(body));

        const { uuid, status, duration, timestamp, direction } = body;

        if (!uuid) {
            return NextResponse.json({ received: true });
        }

        const supabase = getSupabaseAdmin();

        // Map Vonage status to our status
        const statusMap: Record<string, string> = {
            started: "initiated",
            ringing: "ringing",
            answered: "answered",
            completed: "completed",
            failed: "failed",
            rejected: "rejected",
            busy: "busy",
            cancelled: "cancelled",
            timeout: "timeout",
            unanswered: "failed",
        };

        const mappedStatus = statusMap[status] || status;

        // Build the update payload
        const updateData: Record<string, unknown> = {
            status: mappedStatus,
        };

        if (duration) {
            updateData.duration = parseInt(duration, 10);
        }

        if (status === "answered" || status === "started") {
            updateData.started_at = timestamp || new Date().toISOString();
        }

        if (status === "completed" || status === "failed" || status === "rejected" || status === "busy" || status === "cancelled" || status === "timeout" || status === "unanswered") {
            updateData.ended_at = timestamp || new Date().toISOString();
        }

        // Update based on vonage_uuid
        const { error } = await supabase
            .from("vonage_calls")
            .update(updateData)
            .eq("vonage_uuid", uuid);

        if (error) {
            console.error("[Vonage Event] DB update error:", error);
        }

        return NextResponse.json({ received: true });
    } catch (err) {
        console.error("[Vonage Event] Error:", err);
        return NextResponse.json({ received: true });
    }
}

// Vonage may also send GET requests for events
export async function GET() {
    return NextResponse.json({ status: "ok" });
}
