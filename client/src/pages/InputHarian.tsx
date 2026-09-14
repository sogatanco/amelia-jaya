import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { KATEGORI_PENGELUARAN } from '../constants/kategoriPengeluaran';
import BayarTagihanDialog, { type TagihanItem } from '../components/BayarTagihanDialog';
import SumberDanaPicker, { type RincianSumber } from '../components/SumberDanaPicker';
import { formatNominal, formatTanggal, parseNominal } from '../utils/date';

interface DateItem {
  tanggal: string;
  sudahDiinput: boolean;
  omset: number | null;
}

interface ClosingEntry {
  tanggal: string;
  omset: number;
  sumber: 'KASIR' | 'QRIS';
  catatan?: string | null;
}

interface Expense {
  id: string;
  tanggal: string;
  kategori: string;
  jumlah: number;
  keterangan?: string | null;
  sumber: 'MANUAL' | 'BON';
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function InputHarian() {
  const [dates, setDates] = useState<DateItem[]>([]);
  const [tanggal, setTanggal] = useState('');
  const [omset, setOmset] = useState('');
  const [sumberPemasukan, setSumberPemasukan] = useState<'KASIR' | 'QRIS'>('KASIR');
  const [closingEntries, setClosingEntries] = useState<ClosingEntry[]>([]);
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [kategori, setKategori] = useState('');
  const [kategoriCustom, setKategoriCustom] = useState('');
  const [jumlahPengeluaran, setJumlahPengeluaran] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [tagihanList, setTagihanList] = useState<TagihanItem[]>([]);
  const [tagihanDipilih, setTagihanDipilih] = useState<TagihanItem | null>(null);
  const [sumberRincian, setSumberRincian] = useState<RincianSumber>({
    sumberDana: 'LACI',
    dariLaci: 0,
    dariCashflow: 0,
    dariBank: 0,
  });

  useEffect(() => {
    api.get('/closings/dates').then((res) => {
      setDates(res.data);
      if (!tanggal && res.data.length) setTanggal(res.data[0].tanggal);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tanggal) return;
    api
      .get('/closings', { params: { from: tanggal, to: tanggal } })
      .then((res) => {
        setClosingEntries(res.data);
        const found = res.data.find((item: ClosingEntry) => item.sumber === sumberPemasukan);
        setOmset(found?.omset != null ? formatNominal(found.omset) : '');
      });
    loadExpenses(tanggal);
  }, [tanggal, sumberPemasukan]);

  function loadExpenses(t: string) {
    api.get('/expenses', { params: { from: t, to: t } }).then((res) => setExpenses(res.data));
  }

  async function handleSaveOmset() {
    setSaving(true);
    setMessage('');
    try {
      await api.post('/closings', { tanggal, omset: parseNominal(omset), sumber: sumberPemasukan, catatan });
      setMessage(`Omset ${sumberPemasukan === 'QRIS' ? 'QRIS' : 'kasir/tunai'} berhasil disimpan.`);
      const res = await api.get('/closings/dates');
      setDates(res.data);
      const entries = await api.get('/closings', { params: { from: tanggal, to: tanggal } });
      setClosingEntries(entries.data);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (kategori === 'Bayar Tagihan Rokok' || kategori === 'Bayar Tagihan Barang Lainnya' || kategori === 'Bayar Barang Titip') {
      api
        .get('/bon', { params: { tipe: kategori === 'Bayar Barang Titip' ? 'TITIP' : 'CREDIT', status: 'BELUM_LUNAS' } })
        .then((res) => setTagihanList(res.data));
    }
  }, [kategori]);

  async function handleAddExpense() {
    const kategoriFinal = kategori === 'Lain-lain' && kategoriCustom.trim() ? kategoriCustom.trim() : kategori;
    if (!kategoriFinal || !jumlahPengeluaran) return;
    const jumlah = parseNominal(jumlahPengeluaran);
    const rincian =
      sumberRincian.sumberDana === 'CAMPUR'
        ? sumberRincian
        : {
            sumberDana: sumberRincian.sumberDana,
            dariLaci: sumberRincian.sumberDana === 'LACI' ? jumlah : 0,
            dariCashflow: sumberRincian.sumberDana === 'CASHFLOW' ? jumlah : 0,
            dariBank: sumberRincian.sumberDana === 'BANK' ? jumlah : 0,
          };
    await api.post('/expenses', {
      tanggal,
      kategori: kategoriFinal,
      jumlah,
      keterangan,
      sumberDana: rincian.sumberDana,
      dariLaci: rincian.dariLaci,
      dariCashflow: rincian.dariCashflow,
      dariBank: rincian.dariBank,
    });
    setKategori('');
    setKategoriCustom('');
    setJumlahPengeluaran('');
    setKeterangan('');
    loadExpenses(tanggal);
  }

  async function refreshTagihan() {
    const res = await api.get('/bon', { params: { tipe: 'CREDIT', status: 'BELUM_LUNAS' } });
    setTagihanList(res.data);
  }

  function handleTagihanPaid() {
    refreshTagihan();
    loadExpenses(tanggal);
  }

  async function handleDeleteExpense(id: string) {
    await api.delete(`/expenses/${id}`);
    loadExpenses(tanggal);
  }

  const totalPengeluaran = expenses.reduce((s, e) => s + e.jumlah, 0);

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">Tutup Buku / Omset Harian</h2>
        <p className="text-xs text-gray-500">
          Pilih tanggal transaksi (bisa tanggal kemarin/lusa jika belum sempat diinput).
        </p>

        <div>
          <label className="block text-sm mb-1 text-gray-700">Tanggal</label>
          <select
            className="w-full border rounded-md px-3 py-2"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
          >
            {dates.map((d) => (
              <option key={d.tanggal} value={d.tanggal}>
                {d.tanggal} {d.sudahDiinput ? '✓ sudah diinput' : '— belum diinput'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1 text-gray-700">Sumber Pemasukan</label>
          <select
            className="w-full border rounded-md px-3 py-2"
            value={sumberPemasukan}
            onChange={(e) => setSumberPemasukan(e.target.value as 'KASIR' | 'QRIS')}
          >
            <option value="KASIR">Kasir / Tunai</option>
            <option value="QRIS">QRIS</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Tanggal yang sama dapat diisi berkali-kali untuk sumber pemasukan yang berbeda.
          </p>
        </div>

        <div>
          <label className="block text-sm mb-1 text-gray-700">Omset (Rp)</label>
          <input
            type="text"
            inputMode="numeric"
            className="w-full border rounded-md px-3 py-2"
            value={omset}
            onChange={(e) => setOmset(formatNominal(e.target.value))}
          />
        </div>

        {closingEntries.length > 0 && (
          <div className="text-xs text-gray-500 border rounded-md p-2 bg-gray-50">
            {closingEntries.map((entry) => (
              <p key={entry.sumber}>
                {entry.sumber === 'QRIS' ? 'QRIS' : 'Kasir / Tunai'}: {formatRupiah(entry.omset)}
              </p>
            ))}
            <p className="font-medium text-gray-700">
              Total tanggal ini: {formatRupiah(closingEntries.reduce((total, entry) => total + entry.omset, 0))}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm mb-1 text-gray-700">Catatan (opsional)</label>
          <input
            className="w-full border rounded-md px-3 py-2"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
        </div>

        <button
          onClick={handleSaveOmset}
          disabled={saving || !omset}
          className="w-full bg-brand text-white rounded-md py-2 font-medium disabled:opacity-60"
        >
          {saving ? 'Menyimpan...' : 'Simpan Omset'}
        </button>

        {message && <p className="text-sm text-green-600">{message}</p>}
      </section>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">Pengeluaran Tanggal {formatTanggal(tanggal)}</h2>

        <div className="grid grid-cols-2 gap-2">
          <select
            className="border rounded-md px-3 py-2 col-span-2 bg-white"
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
              className="border rounded-md px-3 py-2 col-span-2"
              value={kategoriCustom}
              onChange={(e) => setKategoriCustom(e.target.value)}
            />
          )}
          {(kategori === 'Bayar Tagihan Rokok' || kategori === 'Bayar Tagihan Barang Lainnya' || kategori === 'Bayar Barang Titip') && (
            <div className="col-span-2 border rounded-md p-2 space-y-1 bg-gray-50">
              <p className="text-xs text-gray-500 font-medium">
                Pilih {kategori === 'Bayar Barang Titip' ? 'bon barang titip yang mau diselesaikan' : 'tagihan yang mau dibayar'}:
              </p>
              {tagihanList.length === 0 && (
                <p className="text-xs text-gray-400 py-1">Tidak ada tagihan yang belum lunas.</p>
              )}
              {tagihanList.map((t) => {
                const sisa = (t.jumlah ?? 0) - (t.paidAmount ?? 0);
                return (
                  <div key={t.id} className="flex justify-between items-center bg-white rounded-md px-2 py-1.5">
                    <div>
                      <p className="text-sm font-medium">{t.supplier || 'Tanpa nama supplier'}</p>
                      <p className="text-xs text-gray-500">
                        {kategori === 'Bayar Barang Titip' ? 'Belum dibayar' : 'Sisa'}: {formatRupiah(sisa)}
                        {t.jatuhTempo && ` · tempo ${formatTanggal(t.jatuhTempo)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTagihanDipilih(t)}
                      className="text-xs bg-brand text-white px-2.5 py-1 rounded-md"
                    >
                      Bayar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <input
            type="text"
            inputMode="numeric"
            placeholder="Jumlah (Rp)"
            className="border rounded-md px-3 py-2"
            value={jumlahPengeluaran}
            onChange={(e) => setJumlahPengeluaran(formatNominal(e.target.value))}
          />
          <input
            placeholder="Keterangan"
            className="border rounded-md px-3 py-2"
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
          />
          <div className="col-span-2">
            <SumberDanaPicker total={parseNominal(jumlahPengeluaran)} onChange={setSumberRincian} />
          </div>
        </div>
        <button onClick={handleAddExpense} className="w-full bg-gray-800 text-white rounded-md py-2 text-sm">
          + Tambah Pengeluaran
        </button>

        <ul className="divide-y">
          {expenses.map((e) => (
            <li key={e.id} className="py-2 flex justify-between items-center text-sm">
              <div>
                <p className="font-medium">{e.kategori} {e.sumber === 'BON' && <span className="text-xs text-blue-600">(dari bon)</span>}</p>
                {e.keterangan && <p className="text-gray-500 text-xs">{e.keterangan}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span>{formatRupiah(e.jumlah)}</span>
                <button onClick={() => handleDeleteExpense(e.id)} className="text-red-500 text-xs">
                  Hapus
                </button>
              </div>
            </li>
          ))}
          {expenses.length === 0 && <p className="text-sm text-gray-400 py-2">Belum ada pengeluaran.</p>}
        </ul>

        <div className="text-right font-semibold text-sm border-t pt-2">
          Total: {formatRupiah(totalPengeluaran)}
        </div>
      </section>

      {tagihanDipilih && (
        <BayarTagihanDialog
          item={tagihanDipilih}
          onClose={() => setTagihanDipilih(null)}
          onPaid={handleTagihanPaid}
        />
      )}
    </div>
  );
}
