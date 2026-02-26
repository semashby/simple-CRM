import { NextRequest, NextResponse } from "next/server";
import { generateVonageJWT } from "@/lib/vonage";

/**
 * POST /api/vonage/token
 * Generates a JWT token for the Vonage Client SDK.
 * The browser uses this to authenticate and make WebRTC calls.
 */
export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json(
                { error: "userId is required" },
                { status: 400 }
            );
        }

        const token = generateVonageJWT(userId);

        return NextResponse.json({ token });
    } catch (err: unknown) {
        console.error("Vonage token error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to generate token" },
            { status: 500 }
        );
    }
}
