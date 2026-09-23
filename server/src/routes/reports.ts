import { Router } from 'express';
import dayjs from 'dayjs';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

export const reportsRouter = Router();
reportsRouter.use(requireAuth, requireRole('ADMIN'));

// Laporan/neraca: rekap omset vs pengeluaran per hari + total laba/rugi
// dalam rentang tanggal tertentu. Khusus admin/pemilik.
reportsRouter.get('/summary', async (req, res) => {
  const from = req.query.from ? dayjs(req.query.from as string).startOf('day') : dayjs().startOf('month');
  const to = req.query.to ? dayjs(req.query.to as string).endOf('day') : dayjs().endOf('day');

  const [closings, expenses] = await Promise.all([
    prisma.dailyClosing.findMany({
      where: { tanggal: { gte: from.toDate(), lte: to.toDate() } },
    }),
    prisma.expense.findMany({
      where: { tanggal: { gte: from.toDate(), lte: to.toDate() } },
    }),
  ]);

  const byDate = new Map<string, { tanggal: string; omsetPenjualan: number; pengeluaranLaci: number; pengeluaranLain: number }>();

  for (const c of closings) {
    const key = dayjs(c.tanggal).format('YYYY-MM-DD');
    const entry = byDate.get(key) ?? { tanggal: key, omsetPenjualan: 0, pengeluaranLaci: 0, pengeluaranLain: 0 };
    entry.omsetPenjualan += c.omset;
    byDate.set(key, entry);
  }
  for (const e of expenses) {
    const key = dayjs(e.tanggal).format('YYYY-MM-DD');
    const entry = byDate.get(key) ?? { tanggal: key, omsetPenjualan: 0, pengeluaranLaci: 0, pengeluaranLain: 0 };
    // Pengeluaran dari laci = uang omset yang diputar untuk belanja. Ia tetap
    // dicatat sebagai pengeluaran, tapi juga masuk kembali ke omset/pemasukan
    // tanggal itu (karena sumbernya adalah kas hasil penjualan).
    const dariLaci = e.dariLaci ?? 0;
    const dariLain = e.jumlah - dariLaci;
    entry.pengeluaranLaci += dariLaci;
    entry.pengeluaranLain += dariLain;
    byDate.set(key, entry);
  }

  const rows = [...byDate.values()]
    .map((r) => {
      const omset = r.omsetPenjualan + r.pengeluaranLaci; // omset + perputaran laci
      const pengeluaran = r.pengeluaranLaci + r.pengeluaranLain;
      // Laba/rugi: omset penjualan dikurangi pengeluaran yang bukan dari laci,
      // karena pengeluaran laci tidak mengurangi kas toko secara keseluruhan.
      const labaRugi = r.omsetPenjualan - r.pengeluaranLain;
      return { tanggal: r.tanggal, omset, pengeluaran, labaRugi };
    })
    .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));

  const totalOmset = rows.reduce((s, r) => s + r.omset, 0);
  const totalPengeluaran = rows.reduce((s, r) => s + r.pengeluaran, 0);
  const totalLabaRugi = rows.reduce((s, r) => s + r.labaRugi, 0);
  const categoryTotals = [...expenses.reduce((totals, expense) => {
    totals.set(expense.kategori, (totals.get(expense.kategori) ?? 0) + expense.jumlah);
    return totals;
  }, new Map<string, number>())]
    .map(([name, jumlah]) => ({ name, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah);

  res.json({
    from: from.format('YYYY-MM-DD'),
    to: to.format('YYYY-MM-DD'),
    totalOmset,
    totalPengeluaran,
    labaRugi: totalLabaRugi,
    categoryTotals,
    rows,
  });
});

// Ringkasan tagihan (utang) ke supplier dari nota kredit yang belum lunas.
reportsRouter.get('/tagihan', async (_req, res) => {
  const belumLunas = await prisma.bon.findMany({
    where: { tipe: 'CREDIT', status: 'BELUM_LUNAS' },
    orderBy: { jatuhTempo: 'asc' },
  });
  const totalTagihan = belumLunas.reduce((s, b) => s + (b.jumlah ?? 0), 0);
  res.json({ totalTagihan, count: belumLunas.length, items: belumLunas });
});

// Data untuk grafik: omset & pengeluaran teragregasi per hari / minggu / bulan.
// Mengikuti aturan yang sama dengan summary: pengeluaran dari laci masuk ke omset.
reportsRouter.get('/chart', async (req, res) => {
  const periode = (req.query.periode as string) || 'harian';
  const from = req.query.from ? dayjs(req.query.from as string).startOf('day') : dayjs().subtract(30, 'day').startOf('day');
  const to = req.query.to ? dayjs(req.query.to as string).endOf('day') : dayjs().endOf('day');

  const [closings, expenses] = await Promise.all([
    prisma.dailyClosing.findMany({
      where: { tanggal: { gte: from.toDate(), lte: to.toDate() } },
    }),
    prisma.expense.findMany({
      where: { tanggal: { gte: from.toDate(), lte: to.toDate() } },
    }),
  ]);

  // Kunci agregasi sesuai periode yang dipilih
  function bucketKey(tanggal: Date): string {
    const d = dayjs(tanggal);
    if (periode === 'bulanan') return d.format('YYYY-MM');
    if (periode === 'mingguan') {
      const startOfWeek = d.startOf('week');
      return startOfWeek.format('YYYY-MM-DD');
    }
    return d.format('YYYY-MM-DD'); // harian
  }

  function bucketLabel(key: string): string {
    if (periode === 'bulanan') return dayjs(key + '-01').format('MMM YYYY');
    if (periode === 'mingguan') return 'Mg ' + dayjs(key).format('DD MMM');
    return dayjs(key).format('DD MMM'); // harian
  }

  const byBucket = new Map<string, { omsetPenjualan: number; pengeluaranLaci: number; pengeluaranLain: number }>();

  for (const c of closings) {
    const key = bucketKey(c.tanggal);
    const entry = byBucket.get(key) ?? { omsetPenjualan: 0, pengeluaranLaci: 0, pengeluaranLain: 0 };
    entry.omsetPenjualan += c.omset;
    byBucket.set(key, entry);
  }
  for (const e of expenses) {
    const key = bucketKey(e.tanggal);
    const entry = byBucket.get(key) ?? { omsetPenjualan: 0, pengeluaranLaci: 0, pengeluaranLain: 0 };
    const dariLaci = e.dariLaci ?? 0;
    entry.pengeluaranLaci += dariLaci;
    entry.pengeluaranLain += e.jumlah - dariLaci;
    byBucket.set(key, entry);
  }

  // Isi semua periode dalam rentang tanggal, walau tidak ada data (nilai 0),
  // supaya grafik tampil kontinu tanpa celah kosong.
  const allKeys: string[] = [];
  if (periode === 'bulanan') {
    let cursor = from.startOf('month');
    const end = to.startOf('month');
    while (cursor.isBefore(end) || cursor.isSame(end)) {
      allKeys.push(cursor.format('YYYY-MM'));
      cursor = cursor.add(1, 'month');
    }
  } else if (periode === 'mingguan') {
    let cursor = from.startOf('week');
    const end = to.startOf('week');
    while (cursor.isBefore(end) || cursor.isSame(end)) {
      allKeys.push(cursor.format('YYYY-MM-DD'));
      cursor = cursor.add(1, 'week');
    }
  } else {
    let cursor = from.startOf('day');
    const end = to.startOf('day');
    while (cursor.isBefore(end) || cursor.isSame(end)) {
      allKeys.push(cursor.format('YYYY-MM-DD'));
      cursor = cursor.add(1, 'day');
    }
  }

  const data = allKeys.map((key) => {
    const v = byBucket.get(key) ?? { omsetPenjualan: 0, pengeluaranLaci: 0, pengeluaranLain: 0 };
    return {
      key,
      label: bucketLabel(key),
      omset: v.omsetPenjualan + v.pengeluaranLaci,
      pengeluaran: v.pengeluaranLaci + v.pengeluaranLain,
      labaRugi: v.omsetPenjualan - v.pengeluaranLain,
    };
  });

  const byCategory = new Map<string, number>();
  for (const expense of expenses) {
    byCategory.set(expense.kategori, (byCategory.get(expense.kategori) ?? 0) + expense.jumlah);
  }
  const kategori = [...byCategory.entries()]
    .map(([name, jumlah]) => ({ name, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah);

  res.json({ periode, from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD'), data, kategori });
});
