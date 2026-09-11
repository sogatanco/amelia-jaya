import 'dotenv/config';
import jwt from 'jsonwebtoken';

async function main() {
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'amelia123' }),
  });
  const { token } = (await loginRes.json()) as { token: string };

  console.log('Secret dari env (10 karakter pertama):', (process.env.JWT_SECRET ?? '').slice(0, 10));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string);
    console.log('Verifikasi LOKAL sukses:', JSON.stringify(payload));
  } catch (err) {
    console.log('Verifikasi LOKAL gagal:', err instanceof Error ? err.message : err);
  }

  // Cek bagian token tanpa verifikasi
  const decoded = jwt.decode(token, { complete: true });
  console.log('Header token:', JSON.stringify(decoded?.header));
}

main();
