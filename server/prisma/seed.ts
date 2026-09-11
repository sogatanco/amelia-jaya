import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Seed akun admin default supaya bisa langsung login pertama kali.
// GANTI PASSWORD INI setelah login pertama, jangan dipakai di production apa adanya.
async function main() {
  const adminUsername = 'admin';
  const existing = await prisma.user.findUnique({ where: { username: adminUsername } });
  if (existing) {
    console.log('Akun admin sudah ada, seed dilewati.');
    return;
  }

  const passwordHash = await bcrypt.hash('amelia123', 10);
  await prisma.user.create({
    data: {
      name: 'Pemilik Toko',
      username: adminUsername,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log('Akun admin default dibuat -> username: admin, password: amelia123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
