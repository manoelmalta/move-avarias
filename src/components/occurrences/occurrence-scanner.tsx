"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Search, Loader2, QrCode } from "lucide-react";

type ScanState = "idle" | "requesting" | "scanning" | "resolving" | "error";

async function resolveOccurrence(
  params: { publicToken?: string; occurrenceCode?: string }
): Promise<{ id: string } | { error: string }> {
  try {
    const qs = new URLSearchParams();
    if (params.publicToken) qs.set("publicToken", params.publicToken);
    if (params.occurrenceCode) qs.set("occurrenceCode", params.occurrenceCode);
    const res = await fetch(`/api/occurrences/resolve?${qs}`);
    const data = await res.json() as { id?: string; error?: string };
    if (!res.ok) return { error: data.error ?? "Erro ao localizar ocorrência." };
    return { id: data.id! };
  } catch {
    return { error: "Erro de rede. Verifique sua conexão." };
  }
}

export function OccurrenceScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<{ stop: () => void } | null>(null);

  const [state, setState] = useState<ScanState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");

  // ── Stop all active resources — mirrors barcode-scanner-dialog.tsx pattern ──
  const stopAll = useCallback(() => {
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

  // ── Camera managed by a single useEffect keyed on `state` ─────────────────
  // Only starts when `state === "requesting"`. This matches the lifecycle used
  // in barcode-scanner-dialog.tsx and avoids the callback/ref complexity that
  // was causing iOS issues in the previous implementation.
  useEffect(() => {
    if (state !== "requesting") return;

    let cancelled = false;

    async function init() {
      // ── 1. Acquire camera stream — prefer rear camera, fallback to any ────
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
          let msg = "Não foi possível iniciar a câmera. Tente novamente ou digite o código da ocorrência.";
          if (domErr.name === "NotAllowedError" || domErr.name === "PermissionDeniedError") {
            msg = "Permissão da câmera negada. Libere o acesso à câmera no navegador ou use a busca por código.";
          } else if (domErr.name === "NotFoundError" || domErr.name === "DevicesNotFoundError") {
            msg = "Não foi possível acessar a câmera. Use a busca por código.";
          } else if (domErr.name === "NotReadableError") {
            msg = "Câmera em uso por outro aplicativo. Feche-o e tente novamente.";
          }
          setErrorMsg(msg);
          setState("error");
          return;
        }
      }

      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      // ── 2. Attach stream and wait for video to be ready ────────────────────
      const video = videoRef.current;
      if (!video) { stopAll(); return; }

      video.srcObject = stream;

      // Wait for enough data before starting the decode loop.
      // This step is critical on iOS — decoding before readyState >= 2
      // causes @zxing to fail silently or throw.
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) { resolve(); return; }
        const handler = () => { video.removeEventListener("loadeddata", handler); resolve(); };
        video.addEventListener("loadeddata", handler);
      });

      if (cancelled) return;
      setState("scanning");

      // ── 3. Start QR decode via BrowserMultiFormatReader.decodeFromVideoElement
      // Using decodeFromVideoElement (not decodeFromStream / decodeFromConstraints)
      // because it receives a video element that already has a stream attached and
      // is confirmed ready. This is the method proven to work on iOS Safari in
      // the barcode-scanner-dialog.tsx component.
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoElement(
          videoRef.current,
          async (result) => {
            if (cancelled || !result) return;
            // Guard: mark as handled before async work to prevent double-fire
            cancelled = true;
            controls.stop();

            const text = result.getText();
            const match = text.match(/\/public\/occurrence\/([^/?#\s]+)/);
            if (!match) {
              setErrorMsg("QR Code não reconhecido como ocorrência do MOVE AVARIAS.");
              stopAll();
              setState("error");
              return;
            }

            setState("resolving");
            stopAll();
            const resolved = await resolveOccurrence({ publicToken: match[1] });
            if ("error" in resolved) {
              setErrorMsg(resolved.error);
              setState("error");
            } else {
              router.push(`/occurrences/${resolved.id}`);
            }
          }
        );

        if (cancelled) { controls.stop(); return; }
        zxingReaderRef.current = { stop: () => controls.stop() };
      } catch {
        if (!cancelled) {
          setErrorMsg("Não foi possível inicializar o leitor. Tente novamente ou use a busca por código.");
          setState("error");
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [state, stopAll, router]);

  // Release camera on unmount regardless of state
  useEffect(() => {
    return () => { stopAll(); };
  }, [stopAll]);

  const handleStop = useCallback(() => {
    stopAll();
    setState("idle");
    setErrorMsg("");
  }, [stopAll]);

  const handleStart = useCallback(() => {
    stopAll();
    setErrorMsg("");
    setState("requesting");
  }, [stopAll]);

  const isVideoVisible = state === "requesting" || state === "scanning";

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    setManualLoading(true);
    setManualError("");
    const result = await resolveOccurrence({ occurrenceCode: code });
    setManualLoading(false);
    if ("error" in result) {
      setManualError(result.error);
    } else {
      router.push(`/occurrences/${result.id}`);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* ── Camera area ────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {/* Video element is always in the DOM so videoRef stays stable.
            Visibility toggled via CSS — never conditionally rendered. */}
        <div className={isVideoVisible ? "relative bg-black aspect-square" : "hidden"}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
          {state === "requesting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
              <p className="text-sm text-white/80">Solicitando acesso à câmera…</p>
            </div>
          )}
          {state === "scanning" && (
            <>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-52 h-52 border-2 border-white/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              </div>
              <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/80">
                Aponte para o QR Code da etiqueta
              </p>
            </>
          )}
        </div>

        <div className="p-4 space-y-3">
          {state === "idle" && (
            <button
              onClick={handleStart}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              <Camera className="h-4 w-4" />
              Iniciar câmera
            </button>
          )}

          {(state === "requesting" || state === "scanning") && (
            <button
              onClick={handleStop}
              className="w-full flex items-center justify-center gap-2 border border-input px-4 py-2.5 rounded-md text-sm hover:bg-muted transition-colors"
            >
              <CameraOff className="h-4 w-4" />
              Parar câmera
            </button>
          )}

          {state === "resolving" && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Localizando ocorrência...
            </div>
          )}

          {state === "error" && (
            <div className="space-y-3">
              <p className="text-sm text-destructive text-center">{errorMsg}</p>
              <button
                onClick={handleStart}
                className="w-full flex items-center justify-center gap-2 border border-input px-4 py-2.5 rounded-md text-sm hover:bg-muted transition-colors"
              >
                <Camera className="h-4 w-4" />
                Tentar câmera novamente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Manual code search ──────────────────────────────────────────── */}
      <div className="bg-card border rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          Busca por código
        </p>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => { setManualCode(e.target.value); setManualError(""); }}
            placeholder="AVR-2026-00001"
            className="flex-1 border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono"
            autoComplete="off"
            autoCapitalize="characters"
          />
          <button
            type="submit"
            disabled={manualLoading || !manualCode.trim()}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
          >
            {manualLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </button>
        </form>
        {manualError && (
          <p className="text-sm text-destructive">{manualError}</p>
        )}
      </div>

      {/* ── Tip ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground px-1">
        <QrCode className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          O QR Code está na etiqueta impressa da ocorrência. Você também pode digitar o código
          no formato <span className="font-mono">AVR-AAAA-NNNNN</span>.
        </span>
      </div>
    </div>
  );
}
