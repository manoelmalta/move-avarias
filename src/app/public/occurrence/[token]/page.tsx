import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { OccurrencePublicView } from "@/components/occurrences/occurrence-public-view";
import { getPublicOccurrenceLabelData, buildPublicOccurrenceUrl } from "@/lib/occurrences/public-label";
import QRCode from "qrcode";

export default async function PublicOccurrencePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const occurrence = await getPublicOccurrenceLabelData(token);

  if (!occurrence) notFound();

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const publicUrl = buildPublicOccurrenceUrl(token, host);

  const qrSvg = await QRCode.toString(publicUrl, {
    type: "svg",
    margin: 1,
    width: 160,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return <OccurrencePublicView occurrence={occurrence} qrSvg={qrSvg} publicUrl={publicUrl} />;
}
