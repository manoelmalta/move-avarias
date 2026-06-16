import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { PublicOccurrenceLabelData } from "@/lib/occurrences/public-label";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#000000",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  label: {
    borderWidth: 2,
    borderColor: "#000000",
  },
  headerBand: {
    backgroundColor: "#111111",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerText: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    textAlign: "center",
    letterSpacing: 1,
  },
  topRow: {
    flexDirection: "row",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#CCCCCC",
  },
  codeCol: {
    flex: 1,
    paddingRight: 14,
  },
  occurrenceCode: {
    fontFamily: "Courier-Bold",
    fontSize: 22,
    letterSpacing: 1,
  },
  metaList: {
    marginTop: 8,
  },
  metaLine: {
    fontSize: 9,
    color: "#333333",
    marginBottom: 2,
  },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
    color: "#000000",
  },
  qrCol: {
    alignItems: "center",
  },
  qrImage: {
    width: 110,
    height: 110,
    borderWidth: 1,
    borderColor: "#DDDDDD",
  },
  qrCaption: {
    fontSize: 7,
    color: "#666666",
    marginTop: 4,
  },
  textBlock: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#CCCCCC",
  },
  blockLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#666666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  blockValue: {
    fontSize: 10,
    color: "#000000",
    lineHeight: 1.3,
  },
  itemsBlock: {
    padding: 12,
  },
  itemsTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#666666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  emptyItems: {
    fontSize: 9,
    color: "#999999",
  },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
    paddingBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#DDDDDD",
    paddingVertical: 4,
  },
  colIdx: { width: 24, fontSize: 8, color: "#999999" },
  colProduct: { flex: 1, fontSize: 8.5, paddingRight: 6 },
  colQty: { width: 60, fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  colDamage: { width: 110, fontSize: 8.5 },
  thText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#555555",
    textTransform: "uppercase",
  },
  productCode: {
    fontFamily: "Courier",
    color: "#777777",
    fontSize: 8,
  },
  footer: {
    backgroundColor: "#EFEFEF",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#CCCCCC",
  },
  footerText: {
    fontSize: 7,
    color: "#888888",
    textAlign: "center",
  },
});

interface Props {
  occurrence: PublicOccurrenceLabelData;
  qrDataUrl: string;
  publicUrl: string;
}

export function OccurrenceLabelPdf({ occurrence, qrDataUrl, publicUrl }: Props) {
  return (
    <Document title={`Etiqueta ${occurrence.occurrenceCode}`} author="MOVE AVARIAS">
      <Page size="A4" style={S.page}>
        <View style={S.label}>
          <View style={S.headerBand}>
            <Text style={S.headerText}>MOVE AVARIAS — ETIQUETA DE IDENTIFICAÇÃO</Text>
          </View>

          <View style={S.topRow} wrap={false}>
            <View style={S.codeCol}>
              <Text style={S.occurrenceCode}>{occurrence.occurrenceCode}</Text>
              <View style={S.metaList}>
                <Text style={S.metaLine}>
                  <Text style={S.metaLabel}>Data de abertura: </Text>
                  {formatDate(occurrence.createdAt)}
                </Text>
                <Text style={S.metaLine}>
                  <Text style={S.metaLabel}>Origem: </Text>
                  {occurrence.origin.name}
                </Text>
                <Text style={S.metaLine}>
                  <Text style={S.metaLabel}>Status: </Text>
                  {occurrence.status.name}
                </Text>
              </View>
            </View>
            <View style={S.qrCol}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML img and has no alt prop */}
              <Image style={S.qrImage} src={qrDataUrl} />
              <Text style={S.qrCaption}>Escaneie para consulta</Text>
            </View>
          </View>

          <View style={S.textBlock} wrap={false}>
            <Text style={S.blockLabel}>Descrição</Text>
            <Text style={S.blockValue}>{occurrence.description}</Text>
          </View>

          {occurrence.notes && (
            <View style={S.textBlock} wrap={false}>
              <Text style={S.blockLabel}>Observação</Text>
              <Text style={S.blockValue}>{occurrence.notes}</Text>
            </View>
          )}

          <View style={S.itemsBlock}>
            <Text style={S.itemsTitle}>Itens ({occurrence.items.length})</Text>
            {occurrence.items.length === 0 ? (
              <Text style={S.emptyItems}>Nenhum item registrado.</Text>
            ) : (
              <View>
                <View style={S.tableHead}>
                  <Text style={[S.colIdx, S.thText]}>#</Text>
                  <Text style={[S.colProduct, S.thText]}>Produto</Text>
                  <Text style={[S.colQty, S.thText]}>Qtd.</Text>
                  <Text style={[S.colDamage, S.thText]}>Tipo de Avaria</Text>
                </View>
                {occurrence.items.map((item, idx) => (
                  <View key={idx} style={S.tableRow} wrap={false}>
                    <Text style={S.colIdx}>{idx + 1}</Text>
                    <Text style={S.colProduct}>
                      <Text style={S.productCode}>{item.product.internalCode} </Text>
                      {item.product.description}
                    </Text>
                    <Text style={S.colQty}>{item.quantity}</Text>
                    <Text style={S.colDamage}>{item.damageType.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={S.footer}>
            <Text style={S.footerText}>{publicUrl}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
