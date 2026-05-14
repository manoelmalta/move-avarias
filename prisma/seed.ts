import { PrismaClient } from "../src/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  console.log("Iniciando seed...");

  const client = await prisma.client.upsert({
    where: { slug: "cliente-demo" },
    update: {},
    create: { name: "Cliente Demonstração", slug: "cliente-demo" },
  });

  const users = await Promise.all([
    prisma.user.upsert({
      where: { clientId_email: { clientId: client.id, email: "admin@demo.com" } },
      update: {},
      create: { clientId: client.id, name: "Admin Demo", email: "admin@demo.com", role: "ADMIN" },
    }),
    prisma.user.upsert({
      where: { clientId_email: { clientId: client.id, email: "gestor@demo.com" } },
      update: {},
      create: { clientId: client.id, name: "Gestor Demo", email: "gestor@demo.com", role: "GESTOR" },
    }),
    prisma.user.upsert({
      where: { clientId_email: { clientId: client.id, email: "analista@demo.com" } },
      update: {},
      create: { clientId: client.id, name: "Analista Demo", email: "analista@demo.com", role: "ANALISTA" },
    }),
    prisma.user.upsert({
      where: { clientId_email: { clientId: client.id, email: "lider@demo.com" } },
      update: {},
      create: { clientId: client.id, name: "Líder Demo", email: "lider@demo.com", role: "LIDER" },
    }),
    prisma.user.upsert({
      where: { clientId_email: { clientId: client.id, email: "separador@demo.com" } },
      update: {},
      create: { clientId: client.id, name: "Separador Demo", email: "separador@demo.com", role: "SEPARADOR" },
    }),
  ]);

  const [adminUser, , analistaUser, , separadorUser] = users;

  const origins = await Promise.all(
    ["Entrega", "Separação", "Recebimento", "Movimentação"].map((name, i) =>
      prisma.parameterOrigin.upsert({
        where: { id: `origin-${i + 1}` },
        update: {},
        create: { id: `origin-${i + 1}`, clientId: client.id, name, sortOrder: i + 1 },
      })
    )
  );

  const damageTypeNames = [
    "Amassado",
    "Descongelamento",
    "Item Vencido",
    "Perda de Qualidade",
    "Rompimento de Embalagem",
    "Sujeira",
    "Umidade/Molhado",
    "Vazamento Líquido",
  ];
  const damageTypes = await Promise.all(
    damageTypeNames.map((name, i) =>
      prisma.parameterDamageType.upsert({
        where: { id: `dtype-${i + 1}` },
        update: {},
        create: { id: `dtype-${i + 1}`, clientId: client.id, name, sortOrder: i + 1 },
      })
    )
  );

  const statusData = [
    { id: "status-1", name: "1-Ocorrência Iniciada", funnelOrder: 1, isFinal: false },
    { id: "status-2", name: "2-Tratamento Iniciado", funnelOrder: 2, isFinal: false },
    { id: "status-3", name: "3-Definida Destinação", funnelOrder: 3, isFinal: false },
    { id: "status-4", name: "4-Destinação Finalizada", funnelOrder: 4, isFinal: false },
    { id: "status-5", name: "5-Processo Finalizado", funnelOrder: 5, isFinal: true },
  ];
  const statuses = await Promise.all(
    statusData.map((s) =>
      prisma.parameterStatus.upsert({
        where: { id: s.id },
        update: {},
        create: { ...s, clientId: client.id },
      })
    )
  );

  const destinationData = [
    {
      id: "dest-1",
      name: "Cozinha",
      description:
        "O item será direcionado para a cozinha da Negri, onde será utilizado no preparo das refeições. Deve ser realizado um pedido de venda com custo simbólico.",
      requiresStorageLocation: false,
      sortOrder: 1,
    },
    {
      id: "dest-2",
      name: "Descarte",
      description:
        "Item sem condições de uso nem comercialização. Deve ser feita a baixa, registro no sistema ERP e descarte adequado, seguindo regras de segurança do produto.",
      requiresStorageLocation: false,
      sortOrder: 2,
    },
    {
      id: "dest-3",
      name: "Destinado à Reposição",
      description:
        "Normalmente utilizado quando o item perde sua embalagem primária e fica no local apropriado para substituir algum item igual que sofreu uma avaria que não permita sua comercialização.",
      requiresStorageLocation: true,
      sortOrder: 3,
    },
    {
      id: "dest-4",
      name: "Lojas Nestor",
      description: "Direcionar para lojas/restaurantes Nestor.",
      requiresStorageLocation: false,
      sortOrder: 4,
    },
    {
      id: "dest-5",
      name: "Troca/Bonificação",
      description:
        "Quando o item será trocado ou bonificado pelo fornecedor. Deve ser emitida a NFD e enviado no próximo veículo de entrega.",
      requiresStorageLocation: false,
      sortOrder: 5,
    },
    {
      id: "dest-6",
      name: "Venda Promocional Funcionário",
      description:
        "Item disponibilizado com preço simbólico para venda a funcionários Negri.",
      requiresStorageLocation: false,
      sortOrder: 6,
    },
  ];
  const destinations = await Promise.all(
    destinationData.map((d) =>
      prisma.parameterDestination.upsert({
        where: { id: d.id },
        update: {},
        create: { ...d, clientId: client.id },
      })
    )
  );

  const productData = [
    { id: "prod-1", ean: "7891000000011", dun: "17891000000018", internalCode: "PROD001", description: "Produto Demonstrativo A" },
    { id: "prod-2", ean: "7891000000028", dun: "17891000000025", internalCode: "PROD002", description: "Produto Demonstrativo B" },
    { id: "prod-3", ean: "7891000000035", dun: "17891000000032", internalCode: "PROD003", description: "Produto Demonstrativo C" },
  ];

  const products: { id: string; internalCode: string; ean: string; dun: string | null }[] = [];
  for (const p of productData) {
    const existing = await prisma.product.findUnique({
      where: { clientId_ean: { clientId: client.id, ean: p.ean } },
    });
    if (!existing) {
      const created = await prisma.product.create({
        data: { ...p, clientId: client.id },
      });
      products.push(created);
    } else {
      products.push(existing);
    }
  }

  for (const [i, prod] of products.entries()) {
    const prices = [10.5, 25.9, 7.8];
    const existing = await prisma.productPrice.findFirst({ where: { productId: prod.id, clientId: client.id } });
    if (!existing) {
      await prisma.productPrice.create({
        data: {
          clientId: client.id,
          productId: prod.id,
          unitValue: prices[i]!,
          validFrom: new Date("2026-01-01"),
          sourceNote: "Preço inicial de demonstração",
        },
      });
    }
  }

  // Ocorrência 1 - Iniciada
  const occ1Exists = await prisma.damageOccurrence.findUnique({ where: { occurrenceCode: "AVR-2026-00001" } });
  const occ1 = occ1Exists ?? await prisma.damageOccurrence.create({
    data: {
      clientId: client.id,
      occurrenceCode: "AVR-2026-00001",
      openedByUserId: separadorUser!.id,
      originId: origins[0]!.id,
      statusId: statuses[0]!.id,
      description: "Produto recebido com embalagem amassada durante entrega.",
      createdAt: new Date("2026-01-10T09:00:00Z"),
    },
  });

  const item1Exists = await prisma.damageOccurrenceItem.findUnique({ where: { id: "item-1" } });
  if (!item1Exists) {
    await prisma.damageOccurrenceItem.create({
      data: {
        id: "item-1",
        clientId: client.id,
        occurrenceId: occ1.id,
        productId: products[0]!.id,
        barcodeInput: "7891000000011",
        quantity: 3,
        unitValue: 10.5,
        totalValue: 31.5,
        batch: "LOTE-2026-A",
        expirationDate: new Date("2026-12-31"),
        damageTypeId: damageTypes[0]!.id,
      },
    });
  }

  // Ocorrência 2 - Em Tratamento
  const occ2Exists = await prisma.damageOccurrence.findUnique({ where: { occurrenceCode: "AVR-2026-00002" } });
  const occ2 = occ2Exists ?? await prisma.damageOccurrence.create({
    data: {
      clientId: client.id,
      occurrenceCode: "AVR-2026-00002",
      openedByUserId: analistaUser!.id,
      originId: origins[1]!.id,
      statusId: statuses[1]!.id,
      description: "Item identificado com rompimento de embalagem durante a separação do pedido.",
      notes: "Verificar estoque do fornecedor para possível troca.",
      createdAt: new Date("2026-02-15T14:00:00Z"),
    },
  });

  const item2Exists = await prisma.damageOccurrenceItem.findUnique({ where: { id: "item-2" } });
  if (!item2Exists) {
    await prisma.damageOccurrenceItem.create({
      data: {
        id: "item-2",
        clientId: client.id,
        occurrenceId: occ2.id,
        productId: products[1]!.id,
        barcodeInput: "7891000000028",
        quantity: 2,
        unitValue: 25.9,
        totalValue: 51.8,
        batch: "LOTE-2026-B",
        expirationDate: new Date("2026-06-30"),
        damageTypeId: damageTypes[4]!.id,
      },
    });
  }

  // Ocorrência 3 - Finalizada
  const occ3Exists = await prisma.damageOccurrence.findUnique({ where: { occurrenceCode: "AVR-2026-00003" } });
  const occ3 = occ3Exists ?? await prisma.damageOccurrence.create({
    data: {
      clientId: client.id,
      occurrenceCode: "AVR-2026-00003",
      openedByUserId: analistaUser!.id,
      originId: origins[2]!.id,
      statusId: statuses[4]!.id,
      destinationId: destinations[1]!.id,
      description: "Item vencido identificado no recebimento. Produto fora do prazo de validade.",
      destinationObservation:
        "Item sem condições de uso nem comercialização. Deve ser feita a baixa, registro no sistema ERP e descarte adequado, seguindo regras de segurança do produto.",
      notes: "Fornecedor notificado. Processo encerrado.",
      completedAt: new Date("2026-03-20T16:30:00Z"),
      createdAt: new Date("2026-03-18T10:00:00Z"),
    },
  });

  const item3Exists = await prisma.damageOccurrenceItem.findUnique({ where: { id: "item-3" } });
  if (!item3Exists) {
    await prisma.damageOccurrenceItem.create({
      data: {
        id: "item-3",
        clientId: client.id,
        occurrenceId: occ3.id,
        productId: products[2]!.id,
        barcodeInput: "7891000000035",
        quantity: 5,
        unitValue: 7.8,
        totalValue: 39.0,
        batch: "LOTE-2026-C",
        expirationDate: new Date("2026-01-15"),
        damageTypeId: damageTypes[2]!.id,
      },
    });
  }

  const auditExists = await prisma.auditLog.findFirst({ where: { occurrenceId: occ3.id } });
  if (!auditExists) {
    await prisma.auditLog.create({
      data: {
        clientId: client.id,
        entityType: "DamageOccurrence",
        entityId: occ3.id,
        occurrenceId: occ3.id,
        userId: analistaUser!.id,
        action: "UPDATE",
        fieldName: "statusId",
        oldValue: "1-Ocorrência Iniciada",
        newValue: "5-Processo Finalizado",
      },
    });
  }

  console.log("Seed concluído com sucesso.");
  console.log(`Cliente: ${client.name} (${client.slug})`);
  console.log(`Usuários: ${users.map((u) => u.email).join(", ")}`);
  console.log(`Produtos: ${products.map((p) => p.internalCode).join(", ")}`);
  console.log("Ocorrências: AVR-2026-00001, AVR-2026-00002, AVR-2026-00003");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
