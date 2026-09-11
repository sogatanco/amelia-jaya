import { prisma } from '../src/lib/prisma';

async function main() {
  const rows = await prisma.bon.findMany({
    select: { id: true, tipe: true, status: true, imagePath: true, supplier: true, jumlah: true },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });
  console.log(JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
}

main();
