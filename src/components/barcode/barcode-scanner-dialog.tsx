"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal, DialogOverlay, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

// ── BarcodeDetector type declaration (not yet in TypeScript's standard lib) ──

declare global {
  interface Window {
    BarcodeDetector?: {
      new(options?: { formats?: string[] }): {
        detect(source: HTMLVideoElement): Promise<{ rawValue: string; format: string }[]>;
      };
    };
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

type ScanState = "idle" | "requesting" | "scanning" | "detected" | "error";

export interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function BarcodeScannerDialog({ open, onOpenChange, onDetected }: BarcodeScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<{ stop: () => void } | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectedRef = useRef(false);

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // ── Stop all active resources ──────────────────────────────────────────────

  const stopAll = useCallback(() => {
    // Cancel rAF loop (native path)
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Stop @zxing reader (fallback path)
    if (zxingReaderRef.current) {
      try { zxingReaderRef.current.stop(); } catch { /* ignore */ }
      zxingReaderRef.current = null;
    }
    // Stop camera stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // Detach video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // ── User-initiated close ───────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    stopAll();
    detectedRef.current = false;
    setScanState("idle");
    setErrorMsg("");
    onOpenChange(false);
  }, [stopAll, onOpenChange]);

  // ── Camera + scan lifecycle ────────────────────────────────────────────────

  useEffect(() => {
    if (!open) {
      // Cleanup whenever dialog is closed externally — state reset happens in cleanup fn below
      stopAll();
      detectedRef.current = false;
      return;
    }

    let cancelled = false;
    detectedRef.current = false;

    async function init() {
      setScanState("requesting");
      // ── 1. Acquire camera stream — prefer rear camera ──────────────────────
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        // Fallback: try without facingMode constraint (desktop / some devices)
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
          setScanState("error");
          return;
        }
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      // ── 2. Attach stream to video element ──────────────────────────────────
      const video = videoRef.current;
      if (!video) { stopAll(); return; }

      video.srcObject = stream;

      // Wait for video to have enough data for decoding
      await new Promise<void>((resolve) => {
        if (!video) { resolve(); return; }
        if (video.readyState >= 2) { resolve(); return; }
        const handler = () => {
          video.removeEventListener("loadeddata", handler);
          resolve();
        };
        video.addEventListener("loadeddata", handler);
      });

      if (cancelled) return;
      setScanState("scanning");

      // ── 3. Decode strategy ─────────────────────────────────────────────────

      const hasNative =
        typeof window !== "undefined" && typeof window.BarcodeDetector !== "undefined";

      if (hasNative) {
        // Path A: BarcodeDetector native (Chrome Android, Chrome desktop)
        const detector = new window.BarcodeDetector!({
          formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code"],
        });

        const scan = async () => {
          if (cancelled || detectedRef.current || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0 && !detectedRef.current && !cancelled) {
              detectedRef.current = true;
              setScanState("detected");
              navigator.vibrate?.(100);
              stopAll();
              await new Promise((r) => setTimeout(r, 400));
              if (!cancelled) {
                onDetected(results[0].rawValue);
                onOpenChange(false);
              }
              setScanState("idle");
              return;
            }
          } catch { /* frame not ready — retry next tick */ }
          rafRef.current = requestAnimationFrame(() => { void scan(); });
        };

        void scan();
      } else {
        // Path B: @zxing/browser dynamic import (iOS Safari, Firefox, others)
        try {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (cancelled || !videoRef.current) return;

          const reader = new BrowserMultiFormatReader();

          // decodeFromVideoElement resolves with IScannerControls once scanning starts.
          // We await it to get the controls object for external stop (e.g. dialog close).
          const controls = await reader.decodeFromVideoElement(videoRef.current, (result) => {
            if (cancelled || detectedRef.current || !result) return;
            detectedRef.current = true;
            setScanState("detected");
            navigator.vibrate?.(100);
            stopAll();
            setTimeout(() => {
              if (!cancelled) {
                onDetected(result.getText());
                onOpenChange(false);
              }
              setScanState("idle");
            }, 400);
          });

          if (cancelled) { controls.stop(); return; }
          zxingReaderRef.current = { stop: () => controls.stop() };
        } catch {
          if (!cancelled) {
            setErrorMsg("Não foi possível inicializar o leitor de código de barras.");
            setScanState("error");
          }
        }
      }
    }

    void init();

    // Cleanup on dialog close or component unmount
    return () => {
      cancelled = true;
      stopAll();
      detectedRef.current = false;
      setScanState("idle");
      setErrorMsg("");
    };
  }, [open, stopAll, onDetected, onOpenChange]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogPortal>
        <DialogOverlay />
        {/*
          Custom DialogPrimitive.Content — bypasses the built-in X button so we
          can control the full-screen camera layout without visual conflicts.
        */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={[
            // Mobile: full screen
            "fixed left-0 top-0 z-50 flex flex-col",
            "w-screen h-screen",
            "rounded-none overflow-hidden",
            // Desktop: centered dialog
            "sm:left-[50%] sm:top-[50%]",
            "sm:translate-x-[-50%] sm:translate-y-[-50%]",
            "sm:w-full sm:max-w-md",
            "sm:h-auto sm:max-h-[85vh]",
            "sm:rounded-lg",
            // Animations (match existing dialog.tsx)
            "duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          ].join(" ")}
        >
          {/* Accessible title (visually shown in header) */}
          <div className="px-4 pt-4 pb-3 shrink-0 border-b bg-card flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">
              Ler código de barras
            </DialogTitle>
          </div>

          {/* Camera viewport */}
          <div className="flex-1 relative bg-black min-h-0">
            {/* The video element — always mounted so the ref is stable */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Requesting permission overlay */}
            {scanState === "requesting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
                <p className="text-sm text-white/80">Solicitando acesso à câmera…</p>
              </div>
            )}

            {/* Scanning overlay with aiming frame */}
            {scanState === "scanning" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {/* Dark surround */}
                <div className="absolute inset-0 bg-black/50" />
                {/* Aim frame */}
                <div className="relative z-10 w-64 h-44">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-md" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-md" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-md" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-md" />
                  {/* Scan line */}
                  <div className="absolute inset-x-4 h-0.5 bg-green-400/80 animate-pulse top-1/2 -translate-y-1/2" />
                </div>
                <p className="relative z-10 mt-5 text-white/80 text-sm text-center px-8">
                  Mantenha o código dentro da área destacada
                </p>
              </div>
            )}

            {/* Detected overlay */}
            {scanState === "detected" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3">
                <CheckCircle2 className="h-14 w-14 text-green-400" />
                <p className="text-white text-lg font-semibold">Código detectado!</p>
              </div>
            )}

            {/* Error overlay */}
            {scanState === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 px-6 gap-4">
                <AlertTriangle className="h-10 w-10 text-amber-400" />
                <p className="text-white/90 text-sm text-center">{errorMsg}</p>
              </div>
            )}
          </div>

          {/* Instruction row — visible during scanning */}
          {scanState === "scanning" && (
            <p className="shrink-0 text-center text-xs text-muted-foreground px-4 py-2 border-t bg-card">
              Aponte a câmera para o EAN, DUN ou código interno
            </p>
          )}

          {/* Cancel / close button */}
          <div className="shrink-0 px-4 py-3 border-t bg-card">
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={handleClose}
              disabled={scanState === "detected"}
            >
              Cancelar
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
