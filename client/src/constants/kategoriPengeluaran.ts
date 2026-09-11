// Daftar kategori pengeluaran standar Toko Amelia Jaya.
// Dipakai di form pengeluaran harian dan form konfirmasi upload bon.
export interface KategoriPengeluaran {
  label: string;
  contoh: string;
}

export const KATEGORI_PENGELUARAN: KategoriPengeluaran[] = [
  { label: 'Belanja Barang Dagangan', contoh: 'Rokok, mie, minuman, sembako, snack, sabun' },
  { label: 'Bayar Tagihan', contoh: 'Pelunasan nota kredit dari supplier' },
  { label: 'Bayar Barang Titip', contoh: 'Pelunasan barang titip/konsinyasi ke supplier' },
  { label: 'Operasional Toko', contoh: 'Plastik, nota, alat tulis, kantong belanja' },
  { label: 'Listrik & Air', contoh: 'Listrik toko, air, token' },
  { label: 'Internet & Komunikasi', contoh: 'WiFi, pulsa, paket data' },
  { label: 'Gaji & Upah', contoh: 'Gaji penjaga, upah harian, lembur' },
  { label: 'Transportasi', contoh: 'Bensin, ongkos mengambil barang, parkir' },
  { label: 'Perawatan & Perbaikan', contoh: 'Kulkas, freezer, rak, lampu, komputer' },
  { label: 'Sewa', contoh: 'Sewa tempat, kios, gudang' },
  { label: 'Administrasi & Bank', contoh: 'Biaya transfer, admin bank, biaya QRIS' },
  { label: 'Promosi', contoh: 'Spanduk, banner, iklan' },
  { label: 'Pajak & Retribusi', contoh: 'Pajak, retribusi pasar, izin' },
  { label: 'Keuangan', contoh: 'Bunga pinjaman, cicilan usaha' },
  { label: 'Kerugian Barang', contoh: 'Barang rusak, kadaluarsa, hilang' },
  { label: 'Peralatan Toko', contoh: 'Rak, timbangan, kulkas, freezer, CCTV' },
  { label: 'Lain-lain', contoh: 'Pengeluaran yang tidak masuk kategori lain' },
];
