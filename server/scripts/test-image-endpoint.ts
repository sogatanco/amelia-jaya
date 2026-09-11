import fs from 'fs';
import { prisma } from '../src/lib/prisma';

async function main() {
  // Login lewat API agar diuji persis alur yang dipakai browser.
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'amelia123' }),
  });

  if (!loginRes.ok) {
    console.log('LOGIN GAGAL:', loginRes.status, await loginRes.text());
    return;
  }

  const { token } = (await loginRes.json()) as { token: string };
  console.log('LOGIN OK, panjang token:', token.length);

  const bon = await prisma.bon.findFirst({
    where: { tipe: 'CREDIT' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, imagePath: true },
  });
  if (!bon) {
    console.log('Tidak ada bon kredit');
    return;
  }
  console.log('Bon:', bon.id, '| imagePath di DB:', bon.imagePath);

  const absPath = `uploads/${bon.imagePath.split(/[\\/]/).pop()}`;
  console.log('File ada di disk:', fs.existsSync(absPath) ? 'YA' : 'TIDAK');

  const withToken = await fetch(`http://localhost:4000/api/bon/${bon.id}/image?token=${encodeURIComponent(token)}`);
  console.log('Dengan token query ->', withToken.status, withToken.headers.get('content-type'));

  const noToken = await fetch(`http://localhost:4000/api/bon/${bon.id}/image`);
  console.log('Tanpa token ->', noToken.status);

  const badToken = await fetch(`http://localhost:4000/api/bon/${bon.id}/image?token=salah`);
  console.log('Token salah ->', badToken.status);

  await prisma.$disconnect();
}

main();
