// Daftar kategori pengeluaran standar Toko Amelia Jaya.
// Dipakai di form pengeluaran harian dan form konfirmasi upload bon.
export interface KategoriPengeluaran {
  label: string;
  contoh: string;
}

export const KATEGORI_PENGELUARAN: KategoriPengeluaran[] = [
  { label: 'Belanja Rokok', contoh: 'Pembelian rokok untuk stok toko' },
  { label: 'Belanja Barang Lainnya', contoh: 'Mie, minuman, sembako, snack, sabun' },
  { label: 'Bayar Tagihan Rokok', contoh: 'Pelunasan nota kredit rokok dari supplier' },
  { label: 'Bayar Tagihan Barang Lainnya', contoh: 'Pelunasan nota kredit barang selain rokok' },
  { label: 'Bayar Barang Titip', contoh: 'Pelunasan barang titip/konsinyasi ke supplier' },
  { label: 'Pribadi', contoh: 'Pemakaian pribadi' },
  { label: 'Simpanan', contoh: 'Uang yang dipisahkan sebagai simpanan' },
  { label: 'Top Up Saldo', contoh: 'Top up saldo atau dompet digital' },
  { label: 'Operasional Toko', contoh: 'Plastik, nota, alat tulis, kantong belanja' },
  { label: 'Listrik & Air', contoh: 'Listrik toko, air, token' },
  { label: 'Internet & Komunikasi', contoh: 'WiFi, pulsa, paket data' },
  { label: 'Gaji & Upah', contoh: 'Gaji penjaga, upah harian, lembur' },
  { label: 'Belanja Bensin', contoh: 'Pembelian bensin untuk kebutuhan toko' },
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
