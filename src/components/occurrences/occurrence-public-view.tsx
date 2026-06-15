"use client";

import { Printer } from "lucide-react";

interface PublicItem {
  quantity: number;
  product: { description: string; internalCode: string };
  damageType: { name: string };
}

interface PublicOccurrence {
  occurrenceCode: string;
  description: string;
  notes: string | null;
  createdAt: Date;
  origin: { name: string };
  status: { name: string };
  items: PublicItem[];
}

interface Props {
  occurrence: PublicOccurrence;
  qrSvg: string;
  publicUrl: string;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function OccurrencePublicView({ occurrence, qrSvg, publicUrl }: Props) {
  const occ = occurrence;

  return (
    <>
      {/* ── Screen-only header ─────────────────────────────────────────── */}
      <div className="print:hidden bg-gray-900 text-white py-3 px-6 flex items-center justify-between">
        <span className="font-semibold text-sm tracking-wide">MOVE AVARIAS — Consulta pública de ocorrência</span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-white text-gray-900 text-sm font-medium px-4 py-1.5 rounded hover:bg-gray-100 transition-colors"
        >
          <Printer className="h-4 w-4" />
          Imprimir Etiqueta
        </button>
      </div>

      {/* ── Label (screen + print) ─────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto my-6 print:my-0 print:max-w-none px-4 print:px-0">
        <div
          className="border-2 border-black print:border print:border-black rounded print:rounded-none"
          style={{ fontFamily: "Arial, sans-serif" }}
        >
          {/* Header band */}
          <div className="bg-gray-900 text-white text-center py-2 px-4 print:py-1.5">
            <p className="text-xs font-bold tracking-widest uppercase">
              MOVE AVARIAS — ETIQUETA DE IDENTIFICAÇÃO
            </p>
          </div>

          {/* Code + QR row — stacks on mobile, side-by-side on sm+ and print */}
          <div className="flex flex-col sm:flex-row print:flex-row items-center sm:items-start print:items-start gap-4 p-4 print:p-3 border-b border-gray-300 break-inside-avoid">
            <div className="flex-1 min-w-0 w-full sm:w-auto text-center sm:text-left print:text-left">
              <p className="text-3xl print:text-2xl font-black font-mono tracking-wider text-black leading-tight">
                {occ.occurrenceCode}
              </p>
              <div className="mt-2 space-y-0.5 text-xs text-gray-700">
                <p><span className="font-semibold">Data de abertura:</span> {formatDate(occ.createdAt)}</p>
                <p><span className="font-semibold">Origem:</span> {occ.origin.name}</p>
                <p><span className="font-semibold">Status:</span> {occ.status.name}</p>
              </div>
            </div>

            {/* QR Code — fixed-size container forces SVG to scale via CSS */}
            <div className="shrink-0 flex flex-col items-center gap-1.5">
              <div
                className="qr-container w-36 h-36 print:w-28 print:h-28 bg-white border border-gray-200 rounded-sm overflow-hidden p-2"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="text-[9px] text-gray-500 text-center leading-tight">
                Escaneie para consulta
              </p>
            </div>
          </div>

          {/* Description + Notes */}
          <div className="px-4 py-3 print:px-3 print:py-2 border-b border-gray-300 space-y-2">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Descrição</p>
              <p className="text-sm text-black leading-snug">{occ.description}</p>
            </div>
            {occ.notes && (
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Observação</p>
                <p className="text-sm text-black leading-snug">{occ.notes}</p>
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="px-4 py-3 print:px-3 print:py-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">
              Itens ({occ.items.length})
            </p>
            {occ.items.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nenhum item registrado.</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-400">
                    <th className="text-left py-1 pr-2 font-semibold text-gray-700 w-8">#</th>
                    <th className="text-left py-1 pr-2 font-semibold text-gray-700">Produto</th>
                    <th className="text-left py-1 pr-2 font-semibold text-gray-700 whitespace-nowrap">Qtd.</th>
                    <th className="text-left py-1 font-semibold text-gray-700">Tipo de Avaria</th>
                  </tr>
                </thead>
                <tbody>
                  {occ.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-200 last:border-0">
                      <td className="py-1 pr-2 text-gray-400">{idx + 1}</td>
                      <td className="py-1 pr-2 leading-tight">
                        <span className="font-mono text-gray-500 mr-1">{item.product.internalCode}</span>
                        {item.product.description}
                      </td>
                      <td className="py-1 pr-2 font-medium">{item.quantity}</td>
                      <td className="py-1">{item.damageType.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-100 px-4 py-2 print:py-1.5 border-t border-gray-300">
            <p className="text-[9px] text-gray-400 text-center break-all leading-tight">
              {publicUrl}
            </p>
          </div>
        </div>

        {/* Screen-only notice */}
        <div className="print:hidden mt-4 text-center text-xs text-gray-400">
          Esta página é somente leitura. Nenhuma edição é possível por este acesso.
        </div>
      </div>

      {/* Global styles: print layout + SVG scaling fix */}
      <style>{`
        @media print {
          @page { margin: 10mm; size: A4; }
          body { background: white !important; }
        }
        /* Force the inline QR SVG (which ships with fixed width/height attrs)
           to fill its container. The viewBox ensures correct scaling. */
        .qr-container svg {
          width: 100%;
          height: 100%;
          display: block;
        }
      `}</style>
    </>
  );
}
