import { NextResponse } from "next/server";

/**
 * GET /api/vonage/fallback
 * Vonage fallback webhook — called when the primary webhooks fail.
 * Just acknowledges receipt to prevent Vonage errors.
 */
export async function GET() {
    console.log("[Vonage Fallback] GET received");
    return NextResponse.json({ status: "ok" });
}

export async function POST() {
    console.log("[Vonage Fallback] POST received");
    return NextResponse.json({ received: true });
}
