"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, PhoneOff, PhoneCall, Mic, MicOff } from "lucide-react";
import { useDialer, type DialerState } from "@/hooks/use-dialer";

interface DialerPanelProps {
    contactId: string;
    projectId?: string | null;
    initialPhone?: string | null;
    fromNumber?: string | null;
    transcriptionLanguage?: string | null;
    onCallCreated?: (vonageCallId: string) => void;
    onCallEnded?: () => void;
}

// DTMF numpad layout
const DTMF_KEYS = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
];

// Sub-labels for DTMF keys (like a phone)
const DTMF_LABELS: Record<string, string> = {
    "1": "",
    "2": "ABC",
    "3": "DEF",
    "4": "GHI",
    "5": "JKL",
    "6": "MNO",
    "7": "PQRS",
    "8": "TUV",
    "9": "WXYZ",
    "*": "",
    "0": "+",
    "#": "",
};

function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getStateLabel(state: DialerState): string {
    switch (state) {
        case "connecting":
            return "Connecting...";
        case "ringing":
            return "Ringing...";
        case "active":
            return "In Call";
        case "ended":
            return "Call Ended";
        case "error":
            return "Error";
        default:
            return "Ready";
    }
}

function getStateColor(state: DialerState): string {
    switch (state) {
        case "connecting":
        case "ringing":
            return "text-yellow-600";
        case "active":
            return "text-green-600";
        case "ended":
            return "text-slate-500";
        case "error":
            return "text-red-600";
        default:
            return "text-slate-400";
    }
}

export function DialerPanel({
    contactId,
    projectId,
    initialPhone,
    fromNumber,
    transcriptionLanguage,
    onCallCreated,
    onCallEnded,
}: DialerPanelProps) {
    const [phoneNumber, setPhoneNumber] = useState(initialPhone || "");
    const [showNumpad, setShowNumpad] = useState(false);
    const [dtmfInput, setDtmfInput] = useState("");

    const { state, elapsed, error, startCall, hangup, sendDTMF } = useDialer({
        contactId,
        projectId,
        transcriptionLanguage,
        onCallCreated,
        onCallEnded,
    });

    const isInCall = state === "connecting" || state === "ringing" || state === "active";

    const handleCall = () => {
        if (!phoneNumber.trim()) return;
        startCall(phoneNumber.trim(), fromNumber || undefined);
    };

    const handleHangup = () => {
        hangup();
        setShowNumpad(false);
        setDtmfInput("");
    };

    const handleDTMF = (digit: string) => {
        sendDTMF(digit);
        setDtmfInput((prev) => prev + digit);
        // Play a short beep feedback (optional)
        try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = digit === "*" ? 941 : digit === "#" ? 1209 : 697 + parseInt(digit) * 50;
            gain.gain.value = 0.1;
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } catch {
            // audio context not available
        }
    };

    const handleReset = () => {
        setDtmfInput("");
        setShowNumpad(false);
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <PhoneCall className="h-3.5 w-3.5" /> Dialer
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
                {/* Phone Number Input */}
                <div className="relative">
                    <Input
                        type="tel"
                        placeholder="+31 6 1234 5678"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={isInCall}
                        className="pr-10 text-sm font-mono"
                    />
                    {phoneNumber && !isInCall && (
                        <button
                            onClick={() => setPhoneNumber("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Call Status */}
                {state !== "idle" && (
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                            {/* Pulsing indicator */}
                            {isInCall && (
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${state === "active" ? "bg-green-400" : "bg-yellow-400"}`} />
                                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${state === "active" ? "bg-green-500" : "bg-yellow-500"}`} />
                                </span>
                            )}
                            <span className={`text-xs font-medium ${getStateColor(state)}`}>
                                {getStateLabel(state)}
                            </span>
                        </div>
                        {(state === "active" || state === "ended") && (
                            <span className="text-sm font-mono font-semibold text-slate-700">
                                {formatElapsed(elapsed)}
                            </span>
                        )}
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                        {error}
                    </div>
                )}

                {/* DTMF Input Display */}
                {showNumpad && dtmfInput && (
                    <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-1.5">
                        <span className="text-sm font-mono tracking-widest text-slate-700">
                            {dtmfInput}
                        </span>
                        <button
                            onClick={handleReset}
                            className="text-xs text-slate-400 hover:text-slate-600"
                        >
                            Clear
                        </button>
                    </div>
                )}

                {/* DTMF Numpad — shown during active call */}
                {showNumpad && state === "active" && (
                    <div className="grid grid-cols-3 gap-1.5">
                        {DTMF_KEYS.map((row) =>
                            row.map((key) => (
                                <button
                                    key={key}
                                    onClick={() => handleDTMF(key)}
                                    className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-2.5 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95 active:bg-slate-100"
                                >
                                    <span className="text-base font-semibold text-slate-800">
                                        {key}
                                    </span>
                                    {DTMF_LABELS[key] && (
                                        <span className="text-[9px] tracking-widest text-slate-400 mt-0.5">
                                            {DTMF_LABELS[key]}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                    {!isInCall ? (
                        <>
                            <Button
                                onClick={handleCall}
                                disabled={!phoneNumber.trim()}
                                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-sm"
                                size="sm"
                            >
                                <Phone className="mr-1.5 h-4 w-4" />
                                Call
                            </Button>
                            {state === "ended" && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setDtmfInput("");
                                        setShowNumpad(false);
                                    }}
                                    className="text-slate-500"
                                >
                                    Reset
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <Button
                                onClick={handleHangup}
                                className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 shadow-sm"
                                size="sm"
                            >
                                <PhoneOff className="mr-1.5 h-4 w-4" />
                                Hang Up
                            </Button>
                            {state === "active" && (
                                <Button
                                    variant={showNumpad ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setShowNumpad(!showNumpad)}
                                    className={showNumpad ? "bg-slate-800 text-white hover:bg-slate-700" : ""}
                                >
                                    #
                                </Button>
                            )}
                        </>
                    )}
                </div>

                {/* From Number Display */}
                {fromNumber && (
                    <p className="text-[10px] text-slate-400 text-center">
                        Calling from: {fromNumber}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
