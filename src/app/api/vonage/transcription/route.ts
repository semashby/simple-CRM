import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, key);
}

/**
 * POST /api/vonage/transcription
 * Vonage transcription webhook — receives the transcription text after processing.
 * Updates the vonage_calls record with the transcription.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        console.log("[Vonage Transcription]", JSON.stringify(body));

        const { transcription, conversation_uuid } = body;

        if (!conversation_uuid) {
            return NextResponse.json({ received: true });
        }

        // Extract text from transcription object/array
        let transcriptionText = "";
        if (typeof transcription === "string") {
            transcriptionText = transcription;
        } else if (transcription?.results) {
            // Vonage sends results as an array of transcript segments
            transcriptionText = transcription.results
                .map((r: { text: string }) => r.text)
                .join(" ");
        } else if (Array.isArray(transcription)) {
            transcriptionText = transcription
                .map((t: { text?: string; transcript?: string }) => t.text || t.transcript || "")
                .join(" ");
        }

        if (transcriptionText) {
            const supabase = getSupabaseAdmin();
            const { error } = await supabase
                .from("vonage_calls")
                .update({ transcription: transcriptionText })
                .eq("vonage_uuid", conversation_uuid);

            if (error) {
                console.error("[Vonage Transcription] DB update error:", error);
            }
        }

        return NextResponse.json({ received: true });
    } catch (err) {
        console.error("[Vonage Transcription] Error:", err);
        return NextResponse.json({ received: true });
    }
}

export async function GET() {
    return NextResponse.json({ status: "ok" });
}
