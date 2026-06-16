"use client";

import { useRef, useState, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal, DialogOverlay, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, X } from "lucide-react";
import { CameraCodeScanner } from "@/components/barcode/camera-code-scanner";

export interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}

export function BarcodeScannerDialog({ open, onOpenChange, onDetected }: BarcodeScannerDialogProps) {
  const [detected, setDetected] = useState(false);
  const pendingRef = useRef("");

  const handleDetected = useCallback((text: string) => {
    pendingRef.current = text;
    setDetected(true);
    navigator.vibrate?.(100);
    setTimeout(() => {
      onDetected(pendingRef.current);
      onOpenChange(false);
      setDetected(false);
    }, 400);
  }, [onDetected, onOpenChange]);

  const handleClose = useCallback(() => {
    setDetected(false);
    onOpenChange(false);
  }, [onOpenChange]);

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
          {/* Header: title + X close button */}
          <div className="px-4 pt-4 pb-3 shrink-0 border-b bg-card flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">
              Ler código de barras
            </DialogTitle>
            <DialogPrimitive.Close
              className="rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none transition-opacity"
              disabled={detected}
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          {/* Camera viewport — CameraCodeScanner mounts when open, unmounts on close/detected */}
          <div className="flex-1 relative min-h-0">
            {open && !detected && (
              <CameraCodeScanner
                onDetected={handleDetected}
                className="h-full"
              />
            )}
            {detected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3">
                <CheckCircle2 className="h-14 w-14 text-green-400" />
                <p className="text-white text-lg font-semibold">Código detectado!</p>
              </div>
            )}
          </div>

          {/* Instruction row */}
          <p className="shrink-0 text-center text-xs text-muted-foreground px-4 py-2 border-t bg-card">
            Aponte a câmera para o EAN, DUN ou código interno
          </p>

          {/* Cancel / close button */}
          <div className="shrink-0 px-4 py-3 border-t bg-card">
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={handleClose}
              disabled={detected}
            >
              Cancelar leitura
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
