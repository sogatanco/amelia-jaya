import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { readBonImage } from '../utils/ocr';

export const bonRouter = Router();

// Middleware auth dipasang di bawah: route gambar di akhir file menangani
// tokennya sendiri (header ATAU query string), karena elemen <img> tidak bisa
// mengirim header Authorization.

const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `bon-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpe?g|png|webp|heic|heif)$/.test(file.mimetype)) {
      return cb(new Error('File harus berupa foto (jpg/png/webp)'));
    }
    cb(null, true);
  },
});

const uploadSchema = z.object({
  tipe: z.enum(['CASH', 'CREDIT', 'TITIP']),
});

// Foto nota bisa diakses publik tanpa login supaya mudah dilihat dari
// aplikasi (elemen <img> tidak bisa mengirim header Authorization).
// Didefinisikan SEBELUM middleware auth agar tidak ikut terblokir.
bonRouter.get('/:id/image', async (req, res) => {
  const bon = await prisma.bon.findUnique({ where: { id: req.params.id } });
  if (!bon) return res.status(404).end();
  res.sendFile(path.resolve(process.cwd(), bon.imagePath));
});

// Semua route operasional bon wajib login. Dipasang setelah route gambar;
// route gambar di atas tidak ikut middleware ini.
bonRouter.use(requireAuth);

// Upload foto nota/bon. Sistem otomatis membaca isi nota lewat OCR
// (jumlah, tanggal, nama supplier) sehingga tidak perlu ketik manual;
// hasil OCR tetap bisa dikoreksi lewat endpoint /confirm sebelum disimpan final.
bonRouter.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File foto nota wajib diupload' });
  }
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Tipe nota (CASH/CREDIT/TITIP) wajib diisi' });
  }

  const ocr = await readBonImage(req.file.path);

  const bon = await prisma.bon.create({
    data: {
      tanggal: ocr.tanggal ?? new Date(),
      tipe: parsed.data.tipe,
      jumlah: ocr.jumlah,
      supplier: ocr.supplier,
      imagePath: path.relative(process.cwd(), req.file.path),
      ocrText: ocr.text,
      ocrConfidence: ocr.confidence,
      status: 'DIPROSES',
      jatuhTempo: parsed.data.tipe === 'CREDIT' ? ocr.jatuhTempo ?? dayjs(ocr.tanggal ?? new Date()).add(14, 'day').toDate() : null,
      createdById: req.user!.id,
    },
  });

  res.status(201).json(bon);
});

const confirmSchema = z
  .object({
    tanggal: z.string().min(1),
    jumlah: z.number().positive(),
    supplier: z.string().optional(),
    kategori: z.string().optional(),
    jatuhTempo: z.string().optional(),
    sumberDana: z.enum(['LACI', 'CASHFLOW', 'BANK', 'CAMPUR']).default('LACI'),
    dariLaci: z.number().nonnegative().optional(),
    dariCashflow: z.number().nonnegative().optional(),
    dariBank: z.number().nonnegative().optional(),
  })
  .refine((d) => d.sumberDana !== 'CAMPUR' || ((d.dariLaci ?? 0) + (d.dariCashflow ?? 0) + (d.dariBank ?? 0)) === d.jumlah, {
    message: 'Untuk sumber campuran, total rincian (laci + cashflow + bank) harus sama dengan jumlah',
  });

// Konfirmasi hasil baca OCR (bisa dikoreksi user) lalu diproses:
// CASH -> otomatis buat pengeluaran harian, CREDIT -> jadi tagihan.
bonRouter.patch('/:id/confirm', async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Data tidak valid', errors: parsed.error.flatten() });
  }
  const { tanggal, jumlah, supplier, kategori, jatuhTempo, sumberDana, dariLaci, dariCashflow, dariBank } = parsed.data;
  const tanggalDate = dayjs(tanggal).startOf('day').toDate();
  const fallbackDueDate = dayjs(tanggalDate).add(14, 'day').toDate();

  const bon = await prisma.bon.findUnique({ where: { id: req.params.id } });
  if (!bon) return res.status(404).json({ message: 'Bon tidak ditemukan' });

  if (bon.tipe === 'CASH') {
    const rincian =
      sumberDana === 'CAMPUR'
        ? { dariLaci: dariLaci ?? 0, dariCashflow: dariCashflow ?? 0, dariBank: dariBank ?? 0 }
        : sumberDana === 'LACI'
          ? { dariLaci: jumlah, dariCashflow: 0, dariBank: 0 }
          : sumberDana === 'CASHFLOW'
            ? { dariLaci: 0, dariCashflow: jumlah, dariBank: 0 }
            : { dariLaci: 0, dariCashflow: 0, dariBank: jumlah };

    const updated = await prisma.$transaction(async (tx) => {
      const updatedBon = await tx.bon.update({
        where: { id: bon.id },
        data: { tanggal: tanggalDate, jumlah, supplier, status: 'LUNAS' },
      });
      await tx.expense.create({
        data: {
          tanggal: tanggalDate,
          kategori: kategori || 'Belanja/Bon Tunai',
          jumlah,
          keterangan: supplier ? `Nota dari ${supplier}` : undefined,
          sumber: 'BON',
          sumberDana,
          ...rincian,
          bonId: bon.id,
          createdById: req.user!.id,
        },
      });
      return updatedBon;
    });
    return res.json(updated);
  }

  const updated = await prisma.bon.update({
    where: { id: bon.id },
    data: {
      tanggal: tanggalDate,
      jumlah,
      supplier,
      status: 'BELUM_LUNAS',
      jatuhTempo: bon.tipe === 'CREDIT' ? (jatuhTempo ? dayjs(jatuhTempo).toDate() : fallbackDueDate) : null,
    },
  });
  res.json(updated);
});

bonRouter.get('/', async (req, res) => {
  const { tipe, status } = req.query as { tipe?: 'CASH' | 'CREDIT' | 'TITIP'; status?: string };
  const bons = await prisma.bon.findMany({
    where: {
      ...(tipe ? { tipe } : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { name: true } } },
  });
  res.json(bons);
});

const editSchema = z.object({
  tanggal: z.string().min(1).optional(),
  jumlah: z.number().positive().optional(),
  supplier: z.string().optional(),
  jatuhTempo: z.string().nullable().optional(),
});

// Edit data bon (tanggal, jumlah, supplier, jatuh tempo).
// Jika jumlah berubah pada tagihan yang sudah pernah dibayar sebagian,
// statusnya disesuaikan ulang berdasarkan paidAmount yang ada.
bonRouter.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Data tidak valid', errors: parsed.error.flatten() });
  }

  const bon = await prisma.bon.findUnique({ where: { id: req.params.id } });
  if (!bon) return res.status(404).json({ message: 'Bon tidak ditemukan' });

  const { tanggal, jumlah, supplier, jatuhTempo } = parsed.data;

  // Jika jumlah diubah, pastikan tidak lebih kecil dari yang sudah terbayar
  if (jumlah !== undefined && jumlah < (bon.paidAmount ?? 0)) {
    return res.status(400).json({
      message: `Jumlah tidak boleh lebih kecil dari yang sudah terbayar (${bon.paidAmount})`,
    });
  }

  const data: Record<string, unknown> = {};
  if (tanggal) data.tanggal = dayjs(tanggal).startOf('day').toDate();
  if (jumlah !== undefined) data.jumlah = jumlah;
  if (supplier !== undefined) data.supplier = supplier;
  if (jatuhTempo !== undefined) data.jatuhTempo = jatuhTempo ? dayjs(jatuhTempo).toDate() : null;

  // Sesuaikan status jika jumlah berubah pada nota kredit/barang titip
  if ((bon.tipe === 'CREDIT' || bon.tipe === 'TITIP') && jumlah !== undefined) {
    const paid = bon.paidAmount ?? 0;
    if (paid >= jumlah) {
      data.status = 'LUNAS';
      data.paidAt = bon.paidAt ?? new Date();
    } else if (bon.status === 'LUNAS') {
      // Jika sebelumnya lunas tapi jumlah dinaikkan, kembali jadi belum lunas
      data.status = 'BELUM_LUNAS';
      data.paidAt = null;
    }
  }

  const updated = await prisma.bon.update({ where: { id: bon.id }, data });
  res.json(updated);
});

// Hapus bon. Jika bon ini sudah menghasilkan pengeluaran (bon tunai terkonfirmasi
// atau pembayaran tagihan), expense terkait ikut dihapus agar laporan konsisten.
bonRouter.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const bon = await prisma.bon.findUnique({ where: { id: req.params.id }, include: { expense: true } });
  if (!bon) return res.status(404).json({ message: 'Bon tidak ditemukan' });

  await prisma.$transaction(async (tx) => {
    // Hapus semua expense yang terhubung ke bon ini (bon tunai terkonfirmasi
    // maupun pembayaran tagihan). Data lama yang belum punya bonId dihapus
    // lewat pencocokan keterangan sebagai fallback.
    await tx.expense.deleteMany({
      where: {
        OR: [
          { bonId: bon.id },
          ...(bon.tipe === 'CREDIT'
            ? [{ sumber: 'BON', kategori: 'Bayar Tagihan', keterangan: { contains: bon.supplier ?? '' } }]
            : []),
        ],
      },
    });
    await tx.bon.delete({ where: { id: bon.id } });
  });

  // Hapus file foto dari disk (tidak fatal kalau gagal)
  try {
    const filePath = path.resolve(process.cwd(), bon.imagePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // abaikan error hapus file
  }

  res.status(204).end();
});

// Tandai tagihan (nota kredit) sudah dibayar/lunas.
bonRouter.patch('/:id/lunas', async (req, res) => {
  const bon = await prisma.bon.update({
    where: { id: req.params.id },
    data: { status: 'LUNAS', paidAt: new Date() },
  });
  res.json(bon);
});

const paySchema = z
  .object({
    metode: z.enum(['LACI', 'CASHFLOW', 'BANK', 'CAMPUR']),
    jumlah: z.number().positive().optional(),
    dariLaci: z.number().nonnegative().optional(),
    dariCashflow: z.number().nonnegative().optional(),
    dariBank: z.number().nonnegative().optional(),
    tanggal: z.string().optional(),
  })
  .refine(
    (d) => d.metode !== 'CAMPUR' || ((d.dariLaci ?? 0) + (d.dariCashflow ?? 0) + (d.dariBank ?? 0)) > 0,
    { message: 'Untuk metode CAMPUR, isi minimal satu sumber dana dengan nominal lebih dari 0' },
  );

const SUMBER_LABEL: Record<string, string> = {
  LACI: 'tunai/laci',
  CASHFLOW: 'cashflow',
  BANK: 'transfer/bank',
};

const KATEGORI_BAYAR: Record<string, string> = {
  CREDIT: 'Bayar Tagihan',
  TITIP: 'Bayar Barang Titip',
};

// Bayar tagihan/barang titip: bisa penuh, sebagian, atau campuran antar sumber
// dana (laci kasir / cashflow / bank). Setiap pembayaran otomatis tercatat
// sebagai pengeluaran kategori "Bayar Tagihan" atau "Bayar Barang Titip".
bonRouter.post('/:id/pay', async (req, res) => {
  const parsed = paySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Data pembayaran tidak valid', errors: parsed.error.flatten() });
  }
  const { metode, jumlah, dariLaci, dariCashflow, dariBank, tanggal } = parsed.data;

  const bon = await prisma.bon.findUnique({ where: { id: req.params.id } });
  if (!bon) return res.status(404).json({ message: 'Bon tidak ditemukan' });
  if (bon.tipe !== 'CREDIT' && bon.tipe !== 'TITIP') {
    return res.status(400).json({ message: 'Hanya nota kredit atau barang titip yang bisa dibayar' });
  }
  if (bon.status === 'LUNAS') return res.status(400).json({ message: 'Sudah lunas' });

  const sisa = (bon.jumlah ?? 0) - (bon.paidAmount ?? 0);
  if (sisa <= 0) return res.status(400).json({ message: 'Tidak ada sisa yang perlu dibayar' });

  const bayar = metode === 'CAMPUR' ? (dariLaci ?? 0) + (dariCashflow ?? 0) + (dariBank ?? 0) : (jumlah ?? sisa);
  if (bayar <= 0) return res.status(400).json({ message: 'Jumlah pembayaran harus lebih dari 0' });
  if (bayar > sisa) {
    return res.status(400).json({ message: `Pembayaran melebihi sisa (${sisa})` });
  }

  const tanggalBayar = dayjs(tanggal ?? new Date()).startOf('day').toDate();
  const paidAmountBaru = (bon.paidAmount ?? 0) + bayar;
  const lunas = paidAmountBaru >= (bon.jumlah ?? 0);
  const supplierLabel = bon.supplier || 'supplier';
  const kategoriBayar = KATEGORI_BAYAR[bon.tipe] ?? 'Bayar Tagihan';
  const labelJenis = bon.tipe === 'TITIP' ? 'barang titip' : 'tagihan';

  const updated = await prisma.$transaction(async (tx) => {
    // Untuk CAMPUR, buat satu baris expense per sumber yang nominalnya > 0.
    // Untuk sumber tunggal, satu baris expense dengan seluruh nominal.
    const bagian: Array<{ sumber: 'LACI' | 'CASHFLOW' | 'BANK'; nominal: number }> =
      metode === 'CAMPUR'
        ? [
            { sumber: 'LACI' as const, nominal: dariLaci ?? 0 },
            { sumber: 'CASHFLOW' as const, nominal: dariCashflow ?? 0 },
            { sumber: 'BANK' as const, nominal: dariBank ?? 0 },
          ].filter((b) => b.nominal > 0)
        : [{ sumber: metode as 'LACI' | 'CASHFLOW' | 'BANK', nominal: bayar }];

    for (const b of bagian) {
      await tx.expense.create({
        data: {
          tanggal: tanggalBayar,
          kategori: kategoriBayar,
          jumlah: b.nominal,
          keterangan: `Bayar ${labelJenis} ${supplierLabel} (${SUMBER_LABEL[b.sumber]})`,
          sumber: 'BON',
          sumberDana: b.sumber,
          dariLaci: b.sumber === 'LACI' ? b.nominal : 0,
          dariCashflow: b.sumber === 'CASHFLOW' ? b.nominal : 0,
          dariBank: b.sumber === 'BANK' ? b.nominal : 0,
          bonId: bon.id,
          createdById: req.user!.id,
        },
      });
    }

    return tx.bon.update({
      where: { id: bon.id },
      data: {
        paidAmount: paidAmountBaru,
        caraBayar: metode,
        status: lunas ? 'LUNAS' : 'BELUM_LUNAS',
        paidAt: lunas ? new Date() : null,
      },
    });
  });

  res.json(updated);
});

// Selesaikan barang titip: catat jumlah akhir yang benar-benar terjual/dibayar
// (bisa LEBIH KECIL dari jumlah titip awal, karena ada barang retur/tidak laku).
// Selisihnya ditulis-hapus (write-off) dengan menurunkan nilai bon, bukan
// dianggap sisa utang yang masih harus dibayar.
const selesaikanTitipSchema = z
  .object({
    jumlahAkhir: z.number().positive(),
    metode: z.enum(['LACI', 'CASHFLOW', 'BANK', 'CAMPUR']),
    dariLaci: z.number().nonnegative().optional(),
    dariCashflow: z.number().nonnegative().optional(),
    dariBank: z.number().nonnegative().optional(),
    tanggal: z.string().optional(),
  })
  .refine(
    (d) => d.metode !== 'CAMPUR' || ((d.dariLaci ?? 0) + (d.dariCashflow ?? 0) + (d.dariBank ?? 0)) >= 0,
    { message: 'Rincian sumber dana tidak valid' },
  );

bonRouter.post('/:id/selesaikan-titip', async (req, res) => {
  const parsed = selesaikanTitipSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Data tidak valid', errors: parsed.error.flatten() });
  }
  const { jumlahAkhir, metode, dariLaci, dariCashflow, dariBank, tanggal } = parsed.data;

  const bon = await prisma.bon.findUnique({ where: { id: req.params.id } });
  if (!bon) return res.status(404).json({ message: 'Bon tidak ditemukan' });
  if (bon.tipe !== 'TITIP') return res.status(400).json({ message: 'Hanya untuk bon barang titip' });
  if (bon.status === 'LUNAS') return res.status(400).json({ message: 'Barang titip ini sudah selesai' });

  const paid = bon.paidAmount ?? 0;
  if (jumlahAkhir < paid) {
    return res.status(400).json({
      message: `Jumlah akhir tidak boleh lebih kecil dari yang sudah dibayar (${paid})`,
    });
  }
  if (jumlahAkhir > (bon.jumlah ?? 0)) {
    return res.status(400).json({
      message: `Jumlah akhir tidak boleh melebihi nilai awal bon (${bon.jumlah ?? 0})`,
    });
  }

  const tambahan = jumlahAkhir - paid;
  if (metode === 'CAMPUR') {
    const total = (dariLaci ?? 0) + (dariCashflow ?? 0) + (dariBank ?? 0);
    if (total !== tambahan) {
      return res.status(400).json({
        message: `Total rincian campur (${total}) harus sama dengan sisa yang dibayar sekarang (${tambahan})`,
      });
    }
  }

  const tanggalBayar = dayjs(tanggal ?? new Date()).startOf('day').toDate();
  const supplierLabel = bon.supplier || 'supplier';

  const updated = await prisma.$transaction(async (tx) => {
    if (tambahan > 0) {
      const bagian: Array<{ sumber: 'LACI' | 'CASHFLOW' | 'BANK'; nominal: number }> =
        metode === 'CAMPUR'
          ? [
              { sumber: 'LACI' as const, nominal: dariLaci ?? 0 },
              { sumber: 'CASHFLOW' as const, nominal: dariCashflow ?? 0 },
              { sumber: 'BANK' as const, nominal: dariBank ?? 0 },
            ].filter((b) => b.nominal > 0)
          : [{ sumber: metode as 'LACI' | 'CASHFLOW' | 'BANK', nominal: tambahan }];

      for (const b of bagian) {
        await tx.expense.create({
          data: {
            tanggal: tanggalBayar,
            kategori: 'Bayar Barang Titip',
            jumlah: b.nominal,
            keterangan: `Bayar barang titip ${supplierLabel} (${SUMBER_LABEL[b.sumber]})`,
            sumber: 'BON',
            sumberDana: b.sumber,
            dariLaci: b.sumber === 'LACI' ? b.nominal : 0,
            dariCashflow: b.sumber === 'CASHFLOW' ? b.nominal : 0,
            dariBank: b.sumber === 'BANK' ? b.nominal : 0,
            bonId: bon.id,
            createdById: req.user!.id,
          },
        });
      }
    }

    return tx.bon.update({
      where: { id: bon.id },
      data: {
        jumlah: jumlahAkhir,
        paidAmount: jumlahAkhir,
        caraBayar: metode,
        status: 'LUNAS',
        paidAt: new Date(),
      },
    });
  });

  res.json(updated);
});

// Ubah sumber dana pembayaran tagihan yang sudah tercatat.
// Menghapus expense pembayaran lama dan membuat yang baru dengan sumber dana baru,
// dengan nominal yang sama, sehingga laporan per sumber dana tetap akurat.
const ubahSumberSchema = z.object({
  metode: z.enum(['LACI', 'CASHFLOW', 'BANK', 'CAMPUR']),
  dariLaci: z.number().nonnegative().optional(),
  dariCashflow: z.number().nonnegative().optional(),
  dariBank: z.number().nonnegative().optional(),
});

bonRouter.post('/:id/ubah-sumber-bayar', async (req, res) => {
  const parsed = ubahSumberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Data tidak valid', errors: parsed.error.flatten() });
  }
  const { metode, dariLaci, dariCashflow, dariBank } = parsed.data;

  const bon = await prisma.bon.findUnique({ where: { id: req.params.id } });
  if (!bon) return res.status(404).json({ message: 'Bon tidak ditemukan' });
  if (bon.tipe !== 'CREDIT' && bon.tipe !== 'TITIP') {
    return res.status(400).json({ message: 'Hanya untuk nota kredit atau barang titip' });
  }

  const paid = bon.paidAmount ?? 0;
  if (paid <= 0) return res.status(400).json({ message: 'Belum ada pembayaran untuk diubah' });

  // Tentukan rincian sumber dana baru dengan total = nominal yang sudah dibayar
  let rincian: Array<{ sumber: 'LACI' | 'CASHFLOW' | 'BANK'; nominal: number }>;
  if (metode === 'CAMPUR') {
    const total = (dariLaci ?? 0) + (dariCashflow ?? 0) + (dariBank ?? 0);
    if (total !== paid) {
      return res.status(400).json({ message: `Total rincian campur (${total}) harus sama dengan yang sudah dibayar (${paid})` });
    }
    const campuran: Array<{ sumber: 'LACI' | 'CASHFLOW' | 'BANK'; nominal: number }> = [
      { sumber: 'LACI', nominal: dariLaci ?? 0 },
      { sumber: 'CASHFLOW', nominal: dariCashflow ?? 0 },
      { sumber: 'BANK', nominal: dariBank ?? 0 },
    ];
    rincian = campuran.filter((r) => r.nominal > 0);
  } else {
    rincian = [{ sumber: metode, nominal: paid }];
  }

  const supplierLabel = bon.supplier || 'supplier';
  const kategoriBayar = KATEGORI_BAYAR[bon.tipe] ?? 'Bayar Tagihan';
  const labelJenis = bon.tipe === 'TITIP' ? 'barang titip' : 'tagihan';

  const updated = await prisma.$transaction(async (tx) => {
    // Hapus expense pembayaran lama untuk bon ini
    await tx.expense.deleteMany({
      where: { bonId: bon.id, kategori: kategoriBayar },
    });

    // Buat expense baru dengan sumber dana baru
    const tanggalBayar = bon.paidAt ?? new Date();
    for (const r of rincian) {
      await tx.expense.create({
        data: {
          tanggal: dayjs(tanggalBayar).startOf('day').toDate(),
          kategori: kategoriBayar,
          jumlah: r.nominal,
          keterangan: `Bayar ${labelJenis} ${supplierLabel} (${SUMBER_LABEL[r.sumber]})`,
          sumber: 'BON',
          sumberDana: r.sumber,
          dariLaci: r.sumber === 'LACI' ? r.nominal : 0,
          dariCashflow: r.sumber === 'CASHFLOW' ? r.nominal : 0,
          dariBank: r.sumber === 'BANK' ? r.nominal : 0,
          bonId: bon.id,
          createdById: req.user!.id,
        },
      });
    }

    return tx.bon.update({
      where: { id: bon.id },
      data: { caraBayar: metode },
    });
  });

  res.json(updated);
});

// Kembalikan tagihan/barang titip yang sudah lunas ke status belum bayar.
// Menghapus catatan pembayaran (expense terkait) dan mengosongkan paidAmount.
bonRouter.post('/:id/batal-lunas', async (req, res) => {
  const bon = await prisma.bon.findUnique({ where: { id: req.params.id } });
  if (!bon) return res.status(404).json({ message: 'Bon tidak ditemukan' });
  if (bon.tipe !== 'CREDIT' && bon.tipe !== 'TITIP') {
    return res.status(400).json({ message: 'Hanya untuk nota kredit atau barang titip' });
  }
  if (bon.status !== 'LUNAS' && (bon.paidAmount ?? 0) === 0) {
    return res.status(400).json({ message: 'Memang belum dibayar' });
  }

  const kategoriBayar = KATEGORI_BAYAR[bon.tipe] ?? 'Bayar Tagihan';

  const updated = await prisma.$transaction(async (tx) => {
    await tx.expense.deleteMany({
      where: { bonId: bon.id, kategori: kategoriBayar },
    });
    return tx.bon.update({
      where: { id: bon.id },
      data: { status: 'BELUM_LUNAS', paidAmount: 0, paidAt: null, caraBayar: null },
    });
  });

  res.json(updated);
});
