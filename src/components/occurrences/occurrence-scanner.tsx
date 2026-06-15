"use client";

import type { IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Search, Loader2, QrCode } from "lucide-react";

type ScanState = "idle" | "scanning" | "resolving" | "error";

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
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanningRef = useRef(false);

  const [state, setState] = useState<ScanState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    scanningRef.current = false;
    setState("idle");
  }, []);

  const handleQRText = useCallback(
    async (text: string) => {
      // Accept full URL or relative path: /public/occurrence/TOKEN
      const match = text.match(/\/public\/occurrence\/([^/?#\s]+)/);
      if (!match) {
        setErrorMsg("QR Code não reconhecido como ocorrência do MOVE AVARIAS.");
        setState("error");
        stopCamera();
        return;
      }
      const publicToken = match[1];
      setState("resolving");
      const result = await resolveOccurrence({ publicToken });
      if ("error" in result) {
        setErrorMsg(result.error);
        setState("error");
      } else {
        router.push(`/occurrences/${result.id}`);
      }
    },
    [router, stopCamera]
  );

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setState("scanning");
    setErrorMsg("");

    try {
      // Dynamic import keeps @zxing/browser out of the SSR bundle
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();

      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current,
        (result, err) => {
          // The callback fires continuously; guard against double-processing
          if (result && !scanningRef.current) {
            scanningRef.current = true;
            controlsRef.current?.stop();
            handleQRText(result.getText());
          }
          // Suppress NotFoundException / ChecksumException (no QR in frame yet)
          if (
            err &&
            err.name !== "NotFoundException" &&
            err.name !== "ChecksumException" &&
            err.name !== "FormatException"
          ) {
            setErrorMsg("Câmera com erro. Tente novamente.");
            setState("error");
            controlsRef.current?.stop();
          }
        }
      );
    } catch {
      setErrorMsg(
        "Não foi possível acessar a câmera. Use a busca manual abaixo."
      );
      setState("error");
    }
  }, [handleQRText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

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
        {/* Video feed — kept in DOM so the ref is stable across state changes */}
        <div className={state === "scanning" ? "relative bg-black aspect-square" : "hidden"}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
          {/* Targeting overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-52 h-52 border-2 border-white/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
          <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/80">
            Aponte para o QR Code da etiqueta
          </p>
        </div>

        <div className="p-4 space-y-3">
          {state === "idle" && (
            <button
              onClick={startCamera}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              <Camera className="h-4 w-4" />
              Iniciar câmera
            </button>
          )}

          {state === "scanning" && (
            <button
              onClick={stopCamera}
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
                onClick={() => { setState("idle"); setErrorMsg(""); }}
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
