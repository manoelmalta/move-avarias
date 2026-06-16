import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { getPublicOccurrenceLabelData, buildPublicOccurrenceUrl } from "@/lib/occurrences/public-label";
import { OccurrenceLabelPdf } from "@/components/occurrences/occurrence-label-pdf";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const occurrence = await getPublicOccurrenceLabelData(token);

  if (!occurrence) {
    return NextResponse.json({ error: "Ocorrência não encontrada." }, { status: 404 });
  }

  const host = req.headers.get("host") ?? "localhost:3000";
  const publicUrl = buildPublicOccurrenceUrl(token, host);

  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    margin: 1,
    width: 300,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const buffer = await renderToBuffer(
    OccurrenceLabelPdf({ occurrence, qrDataUrl, publicUrl })
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Etiqueta-${occurrence.occurrenceCode}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
