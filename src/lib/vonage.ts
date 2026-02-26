import * as jwt from "jsonwebtoken";
import * as fs from "fs";
import * as path from "path";

// Read the Vonage private key — supports both:
// 1. VONAGE_PRIVATE_KEY env var (inline key contents, for Vercel)
// 2. VONAGE_PRIVATE_KEY_PATH file path (for local dev)
let _privateKey: string | null = null;
function getPrivateKey(): string {
    if (_privateKey) return _privateKey;

    // Option 1: Key contents stored directly in env var (Vercel)
    if (process.env.VONAGE_PRIVATE_KEY) {
        // Handle escaped newlines from env var
        _privateKey = process.env.VONAGE_PRIVATE_KEY.replace(/\\n/g, "\n");
        return _privateKey;
    }

    // Option 2: Read from file (local dev)
    const keyPath = process.env.VONAGE_PRIVATE_KEY_PATH || "./private.key";
    const resolved = path.resolve(process.cwd(), keyPath);
    _privateKey = fs.readFileSync(resolved, "utf8");
    return _privateKey;
}

/**
 * Generate a JWT for the Vonage Client SDK.
 * This token allows the browser to authenticate with Vonage and make calls.
 */
export function generateVonageJWT(sub?: string): string {
    const applicationId = process.env.VONAGE_APPLICATION_ID;
    if (!applicationId) throw new Error("VONAGE_APPLICATION_ID not configured");

    const now = Math.floor(Date.now() / 1000);
    const payload: Record<string, unknown> = {
        application_id: applicationId,
        iat: now,
        exp: now + 86400, // 24 hours
        jti: `${now}-${Math.random().toString(36).slice(2)}`,
        // ACL for the Client SDK — allow all voice operations
        acl: {
            paths: {
                "/*/users/**": {},
                "/*/conversations/**": {},
                "/*/sessions/**": {},
                "/*/devices/**": {},
                "/*/image/**": {},
                "/*/media/**": {},
                "/*/applications/**": {},
                "/*/push/**": {},
                "/*/knocking/**": {},
                "/*/legs/**": {},
            },
        },
    };

    if (sub) {
        payload.sub = sub;
    }

    return jwt.sign(payload, getPrivateKey(), { algorithm: "RS256" });
}

/**
 * Get the base URL for webhooks.
 * In production uses VERCEL_URL or NEXT_PUBLIC_APP_URL.
 * Falls back to localhost for dev.
 */
export function getBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL;
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    return "http://localhost:3000";
}
