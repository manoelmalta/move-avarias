"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    BarcodeDetector?: {
      new(options?: { formats?: string[] }): {
        detect(source: HTMLVideoElement): Promise<{ rawValue: string; format: string }[]>;
      };
    };
  }
}

export interface CameraCodeScannerProps {
  /** Called with raw decoded text when a code is successfully read. */
  onDetected: (text: string) => void;
  /** Tailwind classes applied to the root container (controls size/position). */
  className?: string;
}

type ViewState = "requesting" | "scanning" | "error";

/**
 * Self-contained camera scanner component.
 *
 * Mount to start the camera; unmount to release it. Internal "Tentar novamente"
 * button handles camera errors without remounting. Calls `onDetected` once with
 * the decoded text, then releases the camera itself — the parent does not need
 * to unmount to stop scanning.
 *
 * Two decode paths:
 *   Path A — native BarcodeDetector (Chrome Android / Chrome desktop)
 *   Path B — @zxing/browser BrowserMultiFormatReader (iOS Safari, Firefox, others)
 *
 * Critical implementation notes:
 * - The useEffect depends on `retryCount`, NOT on `viewState`. This prevents the
 *   cleanup from firing when setState("scanning") is called inside init(), which
 *   would cancel the in-progress camera setup (the root cause of iOS black screen).
 * - Camera acquisition uses a two-step getUserMedia: exact `facingMode:"environment"`
 *   first, falling back to unconstrained `{ video: true }` for desktop / devices
 *   that reject the constraint.
 * - The `loadeddata` event is awaited before starting the decode loop; skipping it
 *   on iOS causes @zxing to fail silently.
 */
export function CameraCodeScanner({ onDetected, className }: CameraCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<{ stop: () => void } | null>(null);
  const rafRef = useRef<number | null>(null);

  const [viewState, setViewState] = useState<ViewState>("requesting");
  const [errorMsg, setErrorMsg] = useState("");
  // Incrementing this is the ONLY way to restart the effect (retry).
  const [retryCount, setRetryCount] = useState(0);

  const stopAll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (zxingReaderRef.current) {
      try { zxingReaderRef.current.stop(); } catch { /* ignore */ }
      zxingReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Effect keys on `retryCount` — not on `viewState` — so internal state
  // transitions (requesting → scanning) never trigger the cleanup.
  // State resets (→ "requesting") happen in handleRetry before incrementing retryCount,
  // not inside the effect body, to satisfy the react-hooks/set-state-in-effect lint rule.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. Acquire camera stream — prefer rear-facing camera
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (err) {
          if (cancelled) return;
          const domErr = err as DOMException;
          let msg = "Não foi possível acessar a câmera.";
          if (domErr.name === "NotAllowedError" || domErr.name === "PermissionDeniedError") {
            msg = "Permissão de câmera negada. Verifique as configurações do navegador.";
          } else if (domErr.name === "NotFoundError" || domErr.name === "DevicesNotFoundError") {
            msg = "Câmera não encontrada neste dispositivo.";
          } else if (domErr.name === "NotReadableError") {
            msg = "A câmera está sendo usada por outro aplicativo.";
          }
          setErrorMsg(msg);
          setViewState("error");
          return;
        }
      }

      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      // 2. Attach to video element and wait until it has enough data
      const video = videoRef.current;
      if (!video) { stopAll(); return; }

      video.srcObject = stream;

      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) { resolve(); return; }
        const handler = () => { video.removeEventListener("loadeddata", handler); resolve(); };
        video.addEventListener("loadeddata", handler);
      });

      if (cancelled) return;
      setViewState("scanning");

      // 3. Decode
      const hasNative =
        typeof window !== "undefined" && typeof window.BarcodeDetector !== "undefined";

      if (hasNative) {
        // Path A: native BarcodeDetector — rAF poll loop
        const detector = new window.BarcodeDetector!({
          formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code"],
        });

        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0 && !cancelled) {
              cancelled = true;
              stopAll();
              onDetected(results[0].rawValue);
              return;
            }
          } catch { /* frame not ready — retry next tick */ }
          rafRef.current = requestAnimationFrame(() => { void scan(); });
        };

        void scan();
      } else {
        // Path B: @zxing/browser (iOS Safari, Firefox, others)
        try {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (cancelled || !videoRef.current) return;

          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromVideoElement(videoRef.current, (result) => {
            if (cancelled || !result) return;
            cancelled = true;
            controls.stop();
            stopAll();
            onDetected(result.getText());
          });

          if (cancelled) { controls.stop(); return; }
          zxingReaderRef.current = { stop: () => controls.stop() };
        } catch {
          if (!cancelled) {
            setErrorMsg("Não foi possível inicializar o leitor de código.");
            setViewState("error");
          }
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [retryCount, stopAll, onDetected]);

  // Ensure camera is released on unmount regardless of scan state
  useEffect(() => () => { stopAll(); }, [stopAll]);

  const handleRetry = useCallback(() => {
    setViewState("requesting");
    setErrorMsg("");
    setRetryCount((c) => c + 1);
  }, []);

  return (
    <div className={cn("relative bg-black overflow-hidden", className)}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {viewState === "requesting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <p className="text-sm text-white/80">Solicitando acesso à câmera…</p>
        </div>
      )}

      {viewState === "scanning" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 w-64 h-44">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-md" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-md" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-md" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-md" />
            <div className="absolute inset-x-4 h-0.5 bg-green-400/80 animate-pulse top-1/2 -translate-y-1/2" />
          </div>
          <p className="relative z-10 mt-5 text-white/80 text-sm text-center px-8">
            Mantenha o código dentro da área destacada
          </p>
        </div>
      )}

      {viewState === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 px-6 gap-4">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <p className="text-white/90 text-sm text-center">{errorMsg}</p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
