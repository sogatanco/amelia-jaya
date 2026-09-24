import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { authRouter } from './routes/auth';
import { closingsRouter } from './routes/closings';
import { expensesRouter } from './routes/expenses';
import { bonRouter } from './routes/bon';
import { reportsRouter } from './routes/reports';
import { usersRouter } from './routes/users';
import { notificationsRouter } from './routes/notifications';
import { outOfStockRouter } from './routes/outOfStock';
import { remindCashiersToCheckOutOfStock } from './utils/notifications';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/closings', closingsRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/bon', bonRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/users', usersRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/barang-kosong', outOfStockRouter);

// Foto nota diakses lewat route /api/bon/:id/image (butuh auth), tapi tetap
// serve folder upload untuk kebutuhan lain/statik jika diperlukan.
app.use('/uploads', express.static(path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads')));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Terjadi kesalahan pada server' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Server pembukuan Toko Amelia Jaya berjalan di port ${port}`);
  remindCashiersToCheckOutOfStock().catch((error) => console.error('Gagal membuat pengingat barang kosong', error));
  setInterval(() => {
    remindCashiersToCheckOutOfStock().catch((error) => console.error('Gagal membuat pengingat barang kosong', error));
  }, 60 * 60 * 1000);
});
