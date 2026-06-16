"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Share2, Download, Loader2 } from "lucide-react";

type PendingAction = "share" | "download" | null;

interface Props {
  occurrenceCode: string;
  publicToken: string;
}

async function fetchLabelPdf(publicToken: string): Promise<Blob> {
  const res = await fetch(`/api/public/occurrence/${publicToken}/label-pdf`);
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "Etiqueta não encontrada para esta ocorrência."
        : "Não foi possível gerar o PDF da etiqueta. Tente novamente."
    );
  }
  return res.blob();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function OccurrenceLabelActions({ occurrenceCode, publicToken }: Props) {
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const filename = `Etiqueta-${occurrenceCode}.pdf`;

  const handlePrint = () => {
    window.open(`/public/occurrence/${publicToken}`, "_blank");
  };

  const handleDownload = async () => {
    if (pending) return;
    setError(null);
    setInfo(null);
    setPending("download");
    try {
      const blob = await fetchLabelPdf(publicToken);
      downloadBlob(blob, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado ao baixar o PDF.");
    } finally {
      setPending(null);
    }
  };

  const handleShare = async () => {
    if (pending) return;
    setError(null);
    setInfo(null);
    setPending("share");
    try {
      const blob = await fetchLabelPdf(publicToken);
      const file = new File([blob], filename, { type: "application/pdf" });

      const canShareFiles =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFiles) {
        try {
          await navigator.share({
            files: [file],
            title: `Etiqueta ${occurrenceCode}`,
            text: `Etiqueta da ocorrência ${occurrenceCode}`,
          });
        } catch (shareError) {
          if (shareError instanceof Error && shareError.name === "AbortError") return;
          throw shareError;
        }
      } else {
        downloadBlob(blob, filename);
        setInfo("Compartilhamento direto não disponível neste navegador. O PDF foi baixado para envio manual.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado ao compartilhar o PDF.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        <Button variant="default" size="sm" onClick={handleShare} disabled={pending !== null}>
          {pending === "share" ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4 mr-1" />
          )}
          {pending === "share" ? "Gerando PDF..." : "Compartilhar PDF"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={pending !== null}>
          {pending === "download" ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1" />
          )}
          {pending === "download" ? "Gerando PDF..." : "Baixar PDF"}
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1" />
          Imprimir Etiqueta
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {info && <p className="text-xs text-muted-foreground">{info}</p>}
    </div>
  );
}
