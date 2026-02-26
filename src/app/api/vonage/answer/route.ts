import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/vonage";

/**
 * GET /api/vonage/answer
 * Vonage answer webhook — called when an outbound call is initiated.
 * Returns an NCCO (Nexmo Call Control Object) that:
 * 1. Records the entire conversation
 * 2. Connects the call to the destination phone number
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;

    // Vonage sends these as query params for the answer webhook
    const to = searchParams.get("to");
    const from = searchParams.get("from");
    const customData = searchParams.get("custom_data");

    // Parse custom data if provided (we send contactId, projectId from the client)
    let fromNumber = from || process.env.NEXT_PUBLIC_VONAGE_DEFAULT_NUMBER || "";
    let transcriptionLanguage = "nl-NL";

    // If custom_data contains a JSON with fromNumber / transcriptionLanguage, use that
    if (customData) {
        try {
            const data = JSON.parse(customData);
            if (data.fromNumber) {
                fromNumber = data.fromNumber;
            }
            if (data.transcriptionLanguage) {
                transcriptionLanguage = data.transcriptionLanguage;
            }
        } catch {
            // ignore parse errors
        }
    }

    const baseUrl = getBaseUrl();

    // Build the NCCO
    const ncco = [];

    // 1. Record the call with transcription
    ncco.push({
        action: "record",
        eventUrl: [`${baseUrl}/api/vonage/recording`],
        transcription: {
            eventUrl: [`${baseUrl}/api/vonage/transcription`],
            language: transcriptionLanguage,
        },
        split: "conversation",
        channels: 2,
        beepStart: false,
    });

    // 2. Connect to the phone number
    if (to) {
        ncco.push({
            action: "connect",
            from: fromNumber,
            endpoint: [
                {
                    type: "phone",
                    number: to.replace(/[^+\d]/g, ""), // strip non-numeric except +
                },
            ],
        });
    }

    return NextResponse.json(ncco);
}

// Also handle POST in case Vonage sends POST
export async function POST(req: NextRequest) {
    // For POST, params might be in the body
    const body = await req.json().catch(() => ({}));
    const searchParams = req.nextUrl.searchParams;

    const to = body.to || searchParams.get("to");
    const from = body.from || searchParams.get("from");
    const customData = body.custom_data || searchParams.get("custom_data");

    let fromNumber = from || process.env.NEXT_PUBLIC_VONAGE_DEFAULT_NUMBER || "";
    let transcriptionLanguage = "nl-NL";

    if (customData) {
        try {
            const data = typeof customData === "string" ? JSON.parse(customData) : customData;
            if (data.fromNumber) fromNumber = data.fromNumber;
            if (data.transcriptionLanguage) transcriptionLanguage = data.transcriptionLanguage;
        } catch {
            // ignore
        }
    }

    const baseUrl = getBaseUrl();

    const ncco = [];

    ncco.push({
        action: "record",
        eventUrl: [`${baseUrl}/api/vonage/recording`],
        transcription: {
            eventUrl: [`${baseUrl}/api/vonage/transcription`],
            language: transcriptionLanguage,
        },
        split: "conversation",
        channels: 2,
        beepStart: false,
    });

    if (to) {
        ncco.push({
            action: "connect",
            from: fromNumber,
            endpoint: [
                {
                    type: "phone",
                    number: to.replace(/[^+\d]/g, ""),
                },
            ],
        });
    }

    return NextResponse.json(ncco);
}
