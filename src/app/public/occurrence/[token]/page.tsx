import { prisma } from "@/lib/db/client";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { OccurrencePublicView } from "@/components/occurrences/occurrence-public-view";
import QRCode from "qrcode";

async function getPublicOccurrence(token: string) {
  return prisma.damageOccurrence.findUnique({
    where: { publicToken: token },
    select: {
      occurrenceCode: true,
      description: true,
      notes: true,
      createdAt: true,
      origin: { select: { name: true } },
      status: { select: { name: true } },
      items: {
        select: {
          quantity: true,
          product: { select: { description: true, internalCode: true } },
          damageType: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export default async function PublicOccurrencePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const occurrence = await getPublicOccurrence(token);

  if (!occurrence) notFound();

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  const publicUrl = `${proto}://${host}/public/occurrence/${token}`;

  const qrSvg = await QRCode.toString(publicUrl, {
    type: "svg",
    margin: 1,
    width: 160,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return <OccurrencePublicView occurrence={occurrence} qrSvg={qrSvg} publicUrl={publicUrl} />;
}
