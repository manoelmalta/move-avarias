"use client";

import type { IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Search, Loader2, QrCode } from "lucide-react";

type ScanState = "idle" | "starting" | "scanning" | "resolving" | "error";

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

function getCameraErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Permissão da câmera negada. Libere o acesso à câmera no navegador ou use a busca por código.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Não foi possível acessar a câmera. Use a busca por código.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Câmera em uso por outro aplicativo. Feche-o e tente novamente.";
  }
  return "Não foi possível iniciar a câmera. Tente novamente ou digite o código da ocorrência.";
}

export function OccurrenceScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  // streamRef holds the raw MediaStream so we can stop all tracks on cleanup,
  // which is required on iOS to fully release the camera indicator.
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);

  const [state, setState] = useState<ScanState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");

  const stopCamera = useCallback(() => {
    // Stop @zxing decode loop
    controlsRef.current?.stop();
    controlsRef.current = null;
    // Stop every track to release the camera on iOS (otherwise the recording
    // indicator stays active even after the user navigates away)
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    scanningRef.current = false;
    setState("idle");
  }, []);

  const handleQRText = useCallback(
    async (text: string) => {
      const match = text.match(/\/public\/occurrence\/([^/?#\s]+)/);
      if (!match) {
        setErrorMsg("QR Code não reconhecido como ocorrência do MOVE AVARIAS.");
        setState("error");
        stopCamera();
        return;
      }
      setState("resolving");
      const result = await resolveOccurrence({ publicToken: match[1] });
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
    // Always clean up any existing session before starting a new one
    stopCamera();
    scanningRef.current = false;
    setState("starting");
    setErrorMsg("");

    // ── Step 1: acquire the MediaStream directly ───────────────────────────
    // Using getUserMedia gives us:
    //   a) typed error names for friendly messages (NotAllowedError, etc.)
    //   b) a handle to stop all tracks on cleanup (critical on iOS)
    //   c) facingMode: { ideal } falls back to any camera if back cam unavailable
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
    } catch (err) {
      setErrorMsg(getCameraErrorMessage(err));
      setState("error");
      return;
    }

    streamRef.current = stream;

    // ── Step 2: wire the stream to the video element ───────────────────────
    // We assign srcObject and call play() ourselves before handing it to @zxing.
    // This ensures autoPlay / muted / playsInline are honoured by Safari
    // before the library touches the element.
    const video = videoRef.current;
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // play() rejection is non-fatal — @zxing will call play() again internally
    }

    setState("scanning");

    // ── Step 3: start the decode loop ─────────────────────────────────────
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();

      controlsRef.current = await reader.decodeFromStream(
        stream,
        video,
        (result, err) => {
          if (result && !scanningRef.current) {
            scanningRef.current = true;
            controlsRef.current?.stop();
            handleQRText(result.getText());
          }
          // The callback fires on every frame; NotFoundException means "no QR
          // visible yet" — suppress it. Only flag genuinely unexpected errors.
          if (
            err &&
            err.name !== "NotFoundException" &&
            err.name !== "ChecksumException" &&
            err.name !== "FormatException" &&
            !scanningRef.current
          ) {
            setErrorMsg("Câmera com erro. Tente novamente.");
            setState("error");
            stopCamera();
          }
        }
      );
    } catch (err) {
      setErrorMsg(getCameraErrorMessage(err));
      setState("error");
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [handleQRText, stopCamera]);

  // Release camera and media tracks on unmount
  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const isVideoVisible = state === "starting" || state === "scanning";

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
            CSS hidden/visible toggled by state — never conditionally rendered. */}
        <div className={isVideoVisible ? "relative bg-black aspect-square" : "hidden"}>
          {/* autoPlay: required by Safari; muted + playsInline: prevent
              fullscreen takeover on iOS */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
          {state === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white/70" />
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
              onClick={startCamera}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              <Camera className="h-4 w-4" />
              Iniciar câmera
            </button>
          )}

          {(state === "starting" || state === "scanning") && (
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
                onClick={startCamera}
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
