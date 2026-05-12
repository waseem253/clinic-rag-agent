"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

export type VapiState = "idle" | "connecting" | "live" | "error";

export function useVapi(publicKey: string, assistantId: string) {
  const [state, setState] = useState<VapiState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const vapiRef = useRef<Vapi | null>(null);

  useEffect(() => {
    const v = new Vapi(publicKey);
    vapiRef.current = v;

    v.on("call-start", () => { setState("live"); setError(null); });
    v.on("call-end",   () => { setState("idle"); setIsUserSpeaking(false); setIsAgentSpeaking(false); setVolume(0); });
    v.on("speech-start", () => setIsAgentSpeaking(true));
    v.on("speech-end",   () => setIsAgentSpeaking(false));
    v.on("volume-level", (v: number) => setVolume(v));
    v.on("message", (m: any) => {
      // Vapi message events: transcripts, tool calls, etc. — useful for debugging
      if (m?.type === "transcript" && m.role === "user") {
        setIsUserSpeaking(true);
        setTimeout(() => setIsUserSpeaking(false), 800);
      }
    });
    v.on("error", (e: any) => {
      console.error("Vapi error", e);
      setError(typeof e === "string" ? e : (e?.message ?? "Voice error"));
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    });

    return () => { try { v.stop(); } catch {} };
  }, [publicKey]);

  const start = useCallback(async () => {
    if (!vapiRef.current) return;
    setState("connecting");
    setError(null);
    try {
      await vapiRef.current.start(assistantId);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to start");
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }, [assistantId]);

  const stop = useCallback(() => {
    try { vapiRef.current?.stop(); } catch {}
    setState("idle");
  }, []);

  return { state, error, volume, isAgentSpeaking, isUserSpeaking, start, stop };
}
