import { useRef, useState } from 'react';
import { api } from '../api/client';
import { KATEGORI_PENGELUARAN } from '../constants/kategoriPengeluaran';
import SumberDanaPicker, { type RincianSumber } from '../components/SumberDanaPicker';
import { formatNominal, parseNominal, toInputDate } from '../utils/date';

interface BonResult {
  id: string;
  tanggal: string;
  tipe: 'CASH' | 'CREDIT' | 'TITIP';
  jumlah: number | null;
  supplier: string | null;
  ocrConfidence: number | null;
  status: string;
  jatuhTempo: string | null;
}

export default function UploadBon() {
  const [tipe, setTipe] = useState<'CASH' | 'CREDIT' | 'TITIP'>('CASH');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [bon, setBon] = useState<BonResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tanggal, setTanggal] = useState('');
  const [jumlah, setJumlah] = useState('');
  const [supplier, setSupplier] = useState('');
  const [kategori, setKategori] = useState('');
  const [kategoriCustom, setKategoriCustom] = useState('');
  const [jatuhTempo, setJatuhTempo] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [sumberRincian, setSumberRincian] = useState<RincianSumber>({
    sumberDana: 'LACI',
    dariLaci: 0,
    dariCashflow: 0,
    dariBank: 0,
  });

  function pilihTipeBon(value: 'CASH' | 'CREDIT' | 'TITIP') {
    setTipe(value);
    if (value !== 'CASH') {
      setKategori('');
      setKategoriCustom('');
    }
  }

  async function handleUpload(selectedFile?: File) {
    const targetFile = selectedFile ?? file;
    if (!targetFile) return;
    setUploading(true);
    setUploadError('');
    setDone(false);
    try {
      const form = new FormData();
      form.append('file', targetFile);
      form.append('tipe', tipe);
      const { data } = await api.post<BonResult>('/bon/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBon(data);
      setTanggal(toInputDate(data.tanggal));
      setJumlah(data.jumlah != null ? formatNominal(data.jumlah) : '');
      setSupplier(data.supplier ?? '');
      setJatuhTempo(toInputDate(data.jatuhTempo));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setUploadError(msg || 'Gagal membaca nota. Coba foto ulang dengan pencahayaan yang lebih baik.');
    } finally {
      setUploading(false);
    }
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setBon(null);
    setDone(false);
    setUploadError('');
    if (picked) {
      handleUpload(picked);
    }
    // Reset supaya memilih file yang sama bisa memicu onChange lagi
    e.target.value = '';
  }

  async function handleConfirm() {
    if (!bon) return;
    setConfirming(true);
    try {
      const kategoriFinal = kategori === 'Lain-lain' && kategoriCustom.trim() ? kategoriCustom.trim() : kategori;
      const jumlahNum = parseNominal(jumlah);
      const rincian =
        sumberRincian.sumberDana === 'CAMPUR'
          ? sumberRincian
          : {
              sumberDana: sumberRincian.sumberDana,
              dariLaci: sumberRincian.sumberDana === 'LACI' ? jumlahNum : 0,
              dariCashflow: sumberRincian.sumberDana === 'CASHFLOW' ? jumlahNum : 0,
              dariBank: sumberRincian.sumberDana === 'BANK' ? jumlahNum : 0,
            };
      await api.patch(`/bon/${bon.id}/confirm`, {
        tanggal,
        jumlah: jumlahNum,
        supplier,
        kategori: kategoriFinal,
        jatuhTempo: tipe === 'CREDIT' ? jatuhTempo || undefined : undefined,
        sumberDana: rincian.sumberDana,
        dariLaci: rincian.dariLaci,
        dariCashflow: rincian.dariCashflow,
        dariBank: rincian.dariBank,
      });
      setDone(true);
      setBon(null);
      setFile(null);
      setKategori('');
      setKategoriCustom('');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">Upload Bon / Nota</h2>
        <p className="text-xs text-gray-500">
          Foto nota akan dibaca otomatis (OCR) untuk mengambil nominal & tanggal, tanpa perlu ketik manual.
          Nota tunai langsung masuk pengeluaran harian, nota kredit masuk daftar tagihan.
          Bon barang titip masuk daftar barang titip dan dibayar sesuai barang yang terjual.
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => pilihTipeBon('CASH')}
            className={`flex-1 py-2 rounded-md text-sm font-medium ${tipe === 'CASH' ? 'bg-brand text-white' : 'bg-gray-100'}`}
          >
            Tunai (Cash)
          </button>
          <button
            onClick={() => pilihTipeBon('CREDIT')}
            className={`flex-1 py-2 rounded-md text-sm font-medium ${tipe === 'CREDIT' ? 'bg-brand text-white' : 'bg-gray-100'}`}
          >
            Kredit (Utang)
          </button>
          <button
            onClick={() => pilihTipeBon('TITIP')}
            className={`flex-1 py-2 rounded-md text-sm font-medium ${tipe === 'TITIP' ? 'bg-brand text-white' : 'bg-gray-100'}`}
          >
            Barang Titip
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFilePicked}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full bg-gray-800 text-white rounded-md py-3 font-medium disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          {uploading ? 'Membaca nota...' : 'Foto / Pilih Bon'}
        </button>

        {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
        {done && <p className="text-sm text-green-600">Bon berhasil disimpan.</p>}
      </section>

      {bon && (
        <section className="bg-white rounded-xl shadow p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">Konfirmasi Hasil Baca Otomatis</h3>
          <p className="text-xs text-gray-500">
            Cek hasil OCR di bawah ini, koreksi jika ada yang salah baca, lalu simpan.
          </p>

          <div>
            <label className="block text-sm mb-1 text-gray-700">Tanggal</label>
            <input
              type="date"
              className="w-full border rounded-md px-3 py-2"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-700">Jumlah (Rp)</label>
            <input
              type="text"
              inputMode="numeric"
              className="w-full border rounded-md px-3 py-2"
              value={jumlah}
              onChange={(e) => setJumlah(formatNominal(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-700">Nama Supplier/Toko</label>
            <input
              className="w-full border rounded-md px-3 py-2"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>
          {tipe === 'CASH' && (
            <div>
              <label className="block text-sm mb-1 text-gray-700">Kategori Pengeluaran</label>
              <select
                className="w-full border rounded-md px-3 py-2 bg-white"
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
              >
                <option value="">Pilih kategori pengeluaran...</option>
                {KATEGORI_PENGELUARAN.map((k) => (
                  <option key={k.label} value={k.label}>
                    {k.label} — {k.contoh}
                  </option>
                ))}
              </select>
              {kategori === 'Lain-lain' && (
                <input
                  placeholder="Tulis kategori lainnya"
                  className="w-full border rounded-md px-3 py-2 mt-2"
                  value={kategoriCustom}
                  onChange={(e) => setKategoriCustom(e.target.value)}
                />
              )}
            </div>
          )}
          {tipe === 'CREDIT' && (
            <div>
              <label className="block text-sm mb-1 text-gray-700">Jatuh Tempo (opsional)</label>
              <input
                type="date"
                className="w-full border rounded-md px-3 py-2"
                value={jatuhTempo}
                onChange={(e) => setJatuhTempo(e.target.value)}
              />
            </div>
          )}

          {tipe === 'CASH' && (
            <SumberDanaPicker total={parseNominal(jumlah)} onChange={setSumberRincian} />
          )}

          <button
            onClick={handleConfirm}
            disabled={confirming || !jumlah}
            className="w-full bg-brand text-white rounded-md py-2 font-medium disabled:opacity-60"
          >
            {confirming ? 'Menyimpan...' : 'Simpan'}
          </button>
        </section>
      )}
    </div>
  );
}
