"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type DialerState = "idle" | "connecting" | "ringing" | "active" | "ended" | "error";

interface UseDialerOptions {
    contactId: string;
    projectId?: string | null;
    transcriptionLanguage?: string | null;
    onCallCreated?: (vonageCallId: string) => void;
    onCallEnded?: () => void;
}

interface UseDialerReturn {
    state: DialerState;
    elapsed: number;
    error: string | null;
    startCall: (phoneNumber: string, fromNumber?: string) => Promise<void>;
    hangup: () => void;
    sendDTMF: (digit: string) => void;
}

export function useDialer({
    contactId,
    projectId,
    transcriptionLanguage,
    onCallCreated,
    onCallEnded,
}: UseDialerOptions): UseDialerReturn {
    const [state, setState] = useState<DialerState>("idle");
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const clientRef = useRef<any>(null);
    const callRef = useRef<any>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);

    // Clear timer
    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Start elapsed timer
    const startTimer = useCallback(() => {
        clearTimer();
        startTimeRef.current = Date.now();
        timerRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
    }, [clearTimer]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearTimer();
            if (callRef.current) {
                try {
                    callRef.current.hangup();
                } catch {
                    // ignore
                }
            }
        };
    }, [clearTimer]);

    // Initialize Vonage Client SDK and make a call
    const startCall = useCallback(
        async (phoneNumber: string, fromNumber?: string) => {
            setError(null);
            setState("connecting");
            setElapsed(0);

            try {
                // 1. Get a JWT token from our API
                const tokenRes = await fetch("/api/vonage/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: contactId }),
                });

                if (!tokenRes.ok) {
                    const data = await tokenRes.json();
                    throw new Error(data.error || "Failed to get token");
                }

                const { token } = await tokenRes.json();

                // 2. Create a vonage_calls record in the database
                const { createClient } = await import("@/lib/supabase/client");
                const supabase = createClient();
                const { data: userData } = await supabase.auth.getUser();

                const { data: callRecord, error: dbError } = await supabase
                    .from("vonage_calls")
                    .insert({
                        contact_id: contactId,
                        project_id: projectId || null,
                        to_number: phoneNumber,
                        from_number: fromNumber || null,
                        status: "initiated",
                        created_by: userData.user?.id,
                        started_at: new Date().toISOString(),
                    })
                    .select("id")
                    .single();

                if (dbError) {
                    console.error("Failed to create call record:", dbError);
                }

                if (callRecord && onCallCreated) {
                    onCallCreated(callRecord.id);
                }

                // 3. Initialize the Vonage Client SDK
                // Dynamic import to avoid SSR issues
                const VonageClient = (await import("@vonage/client-sdk")).default;

                if (!clientRef.current) {
                    clientRef.current = new VonageClient();
                }

                await clientRef.current.createSession(token);

                // 4. Make the call using serverCall
                // The context is sent to our answer webhook as custom_data
                const call = await clientRef.current.serverCall({
                    to: phoneNumber.replace(/[^+\d]/g, ""),
                    custom_data: JSON.stringify({
                        contactId,
                        projectId,
                        fromNumber: fromNumber || "",
                        callRecordId: callRecord?.id || "",
                        transcriptionLanguage: transcriptionLanguage || "nl-NL",
                    }),
                });

                callRef.current = call;

                // 5. Listen for call status changes
                call.on("member:call:status", (event: any) => {
                    console.log("[Dialer] Call status:", event);
                    const status = event?.status || event;

                    if (status === "ringing") {
                        setState("ringing");
                    } else if (status === "answered") {
                        setState("active");
                        startTimer();
                    } else if (
                        status === "completed" ||
                        status === "failed" ||
                        status === "rejected" ||
                        status === "busy" ||
                        status === "cancelled" ||
                        status === "timeout" ||
                        status === "unanswered"
                    ) {
                        setState("ended");
                        clearTimer();
                        callRef.current = null;
                        if (onCallEnded) onCallEnded();
                    }
                });

                // Also listen for the legacy status event
                call.on("call:status:changed", (status: any) => {
                    console.log("[Dialer] Call status changed:", status);
                    if (status === "answered" || status?.status === "answered") {
                        setState("active");
                        startTimer();
                    } else if (
                        status === "completed" ||
                        status === "hangup" ||
                        status?.status === "completed"
                    ) {
                        setState("ended");
                        clearTimer();
                        callRef.current = null;
                        if (onCallEnded) onCallEnded();
                    }
                });

                setState("ringing");
            } catch (err: unknown) {
                console.error("[Dialer] Error:", err);
                setError(err instanceof Error ? err.message : "Call failed");
                setState("error");
                clearTimer();
            }
        },
        [contactId, projectId, transcriptionLanguage, onCallCreated, onCallEnded, startTimer, clearTimer]
    );

    // Hang up the current call
    const hangup = useCallback(() => {
        if (callRef.current) {
            try {
                callRef.current.hangup();
            } catch {
                // ignore
            }
            callRef.current = null;
        }
        setState("ended");
        clearTimer();
        if (onCallEnded) onCallEnded();
    }, [clearTimer, onCallEnded]);

    // Send a DTMF tone during an active call
    const sendDTMF = useCallback((digit: string) => {
        if (callRef.current && state === "active") {
            try {
                callRef.current.sendDTMF(digit);
            } catch (err) {
                console.error("[Dialer] DTMF error:", err);
            }
        }
    }, [state]);

    return {
        state,
        elapsed,
        error,
        startCall,
        hangup,
        sendDTMF,
    };
}
