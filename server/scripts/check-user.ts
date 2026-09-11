import { prisma } from '../src/lib/prisma';

async function main() {
  const user = await prisma.user.findFirst({ select: { username: true, role: true, active: true } });
  console.log(JSON.stringify(user));
  await prisma.$disconnect();
}

main();
