import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import BayarTagihanDialog, { type TagihanItem } from '../components/BayarTagihanDialog';
import EditTagihanDialog from '../components/EditTagihanDialog';
import UbahSumberBayarDialog from '../components/UbahSumberBayarDialog';
import { formatTanggal } from '../utils/date';

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function FakturPreviewDialog({ item, onClose }: { item: TagihanItem; onClose: () => void }) {
  const imageUrl = `/api/bon/${item.id}/image`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-lg p-3 space-y-2 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <p className="text-sm font-medium text-gray-800">{item.supplier || 'Foto faktur'}</p>
          <button type="button" onClick={onClose} className="text-gray-500 text-sm px-2 py-1">
            Tutup ✕
          </button>
        </div>
        <img src={imageUrl} alt="Foto faktur" className="w-full rounded-md" />
      </div>
    </div>
  );
}

interface BonItem extends TagihanItem {
  tipe: 'CASH' | 'CREDIT' | 'TITIP';
  paidAt: string | null;
}

type FilterMode = 'BELUM_LUNAS' | 'LUNAS' | 'CASH';

const FILTER_OPTIONS: Array<{ key: FilterMode; label: string }> = [
  { key: 'BELUM_LUNAS', label: 'Belum Dibayar' },
  { key: 'LUNAS', label: 'Sudah Dibayar' },
  { key: 'CASH', label: 'Bon Tunai' },
];

export default function Tagihan() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [filter, setFilter] = useState<FilterMode>('BELUM_LUNAS');
  const [items, setItems] = useState<BonItem[]>([]);
  const [selected, setSelected] = useState<BonItem | null>(null);
  const [preview, setPreview] = useState<BonItem | null>(null);
  const [editing, setEditing] = useState<BonItem | null>(null);
  const [deleting, setDeleting] = useState<BonItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [ubahSumber, setUbahSumber] = useState<BonItem | null>(null);
  const [batalLunas, setBatalLunas] = useState<BonItem | null>(null);
  const [batalBusy, setBatalBusy] = useState(false);

  async function load(mode: FilterMode = filter) {
    const params =
      mode === 'CASH'
        ? { tipe: 'CASH' }
        : mode === 'LUNAS'
          ? { tipe: 'CREDIT', status: 'LUNAS' }
        : { status: mode };
    const { data } = await api.get('/bon', { params });
    setItems(data);
  }

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const totalSisa = items.reduce((s, i) => s + ((i.jumlah ?? 0) - (i.paidAmount ?? 0)), 0);
  const totalJumlah = items.reduce((s, i) => s + (i.jumlah ?? 0), 0);

  const judul =
    filter === 'BELUM_LUNAS'
      ? 'Daftar Tagihan & Barang Titip Belum Lunas'
      : filter === 'LUNAS'
        ? 'Tagihan Kredit Sudah Dibayar / Lunas'
        : 'Bon Tunai (bukan tagihan)';

  const nilaiHeader = filter === 'BELUM_LUNAS' ? totalSisa : totalJumlah;
  const warnaHeader = filter === 'BELUM_LUNAS' ? 'text-red-600' : 'text-green-600';

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/bon/${deleting.id}`);
      setDeleting(null);
      load();
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleBatalLunas() {
    if (!batalLunas) return;
    setBatalBusy(true);
    try {
      await api.post(`/bon/${batalLunas.id}/batal-lunas`);
      setBatalLunas(null);
      setFilter('BELUM_LUNAS');
      load('BELUM_LUNAS');
    } finally {
      setBatalBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">{judul}</h2>
        <p className={`text-2xl font-bold ${warnaHeader}`}>{formatRupiah(nilaiHeader)}</p>

        <div className="flex gap-1.5 bg-gray-100 rounded-lg p-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFilter(opt.key)}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium ${
                filter === opt.key ? 'bg-white shadow text-gray-800' : 'text-gray-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <ul className="space-y-2">
        {items.map((i) => {
          const sisa = (i.jumlah ?? 0) - (i.paidAmount ?? 0);
          return (
            <li key={i.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
              <button type="button" className="text-left flex-1" onClick={() => setPreview(i)}>
                <p className="font-medium">
                  {i.supplier || 'Tanpa nama supplier'}
                  {i.tipe === 'TITIP' && <span className="ml-2 text-xs text-blue-600 font-normal">Barang Titip</span>}
                  {filter === 'LUNAS' && (
                    <span className="ml-2 text-xs text-green-600 font-normal">✓ Lunas</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  Tanggal nota: {formatTanggal(i.tanggal)}
                  {i.jatuhTempo && ` · Jatuh tempo: ${formatTanggal(i.jatuhTempo)}`}
                  {filter === 'LUNAS' && i.paidAt && ` · Dibayar: ${formatTanggal(i.paidAt)}`}
                </p>
                <p className="text-sm font-semibold">
                  {formatRupiah(i.jumlah ?? 0)}
                  {i.tipe === 'TITIP' && (
                    <span className="text-xs text-gray-500 font-normal"> · nilai akhir yang dibayar</span>
                  )}
                  {filter === 'BELUM_LUNAS' && (i.paidAmount ?? 0) > 0 && (
                    <span className="text-xs text-gray-500 font-normal">
                      {' '}
                      · terbayar {formatRupiah(i.paidAmount ?? 0)} · sisa {formatRupiah(sisa)}
                    </span>
                  )}
                </p>
                <p className="text-xs text-blue-600 mt-0.5">Ketuk untuk melihat foto faktur</p>
              </button>
              <div className="flex flex-col gap-1.5 ml-3">
                {filter === 'BELUM_LUNAS' && (
                  <button onClick={() => setSelected(i)} className="text-sm bg-brand text-white px-3 py-1.5 rounded-md">
                    Bayar
                  </button>
                )}
                {filter === 'LUNAS' && (
                  <>
                    <button
                      onClick={() => setUbahSumber(i)}
                      className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md"
                    >
                      Ubah Sumber Dana
                    </button>
                    <button
                      onClick={() => setBatalLunas(i)}
                      className="text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-md"
                    >
                      Kembalikan ke Belum Bayar
                    </button>
                  </>
                )}
                {isAdmin && (
                  <>
                    <button
                      onClick={() => setEditing(i)}
                      className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleting(i)}
                      className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-md"
                    >
                      Hapus
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
        {items.length === 0 && (
          <p className="text-sm text-gray-400">
            {filter === 'BELUM_LUNAS'
              ? 'Tidak ada tagihan tertunda.'
              : filter === 'LUNAS'
                ? 'Belum ada tagihan yang dibayar.'
                : 'Belum ada bon tunai.'}
          </p>
        )}
      </ul>

      {selected && <BayarTagihanDialog item={selected} onClose={() => setSelected(null)} onPaid={() => load()} />}
      {preview && <FakturPreviewDialog item={preview} onClose={() => setPreview(null)} />}
      {isAdmin && editing && <EditTagihanDialog item={editing} onClose={() => setEditing(null)} onSaved={() => load()} />}
      {ubahSumber && <UbahSumberBayarDialog item={ubahSumber} onClose={() => setUbahSumber(null)} onSaved={() => load()} />}
      {batalLunas && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-3" onClick={() => setBatalLunas(null)}>
          <div
            className="bg-white rounded-xl shadow-lg w-full max-w-sm p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-semibold text-gray-800">Kembalikan ke Belum Bayar?</h3>
              <p className="text-sm text-gray-600 mt-1">
                {batalLunas.supplier || 'Tanpa nama supplier'} · {formatRupiah(batalLunas.jumlah ?? 0)}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Status akan kembali ke "Belum Dibayar" dan catatan pembayarannya dihapus dari pengeluaran.
                Anda bisa membayar ulang nanti dengan sumber dana yang benar.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setBatalLunas(null)} className="flex-1 bg-gray-100 rounded-md py-2 text-sm">
                Batal
              </button>
              <button
                type="button"
                onClick={handleBatalLunas}
                disabled={batalBusy}
                className="flex-1 bg-amber-600 text-white rounded-md py-2 text-sm font-medium disabled:opacity-60"
              >
                {batalBusy ? 'Memproses...' : 'Ya, Kembalikan'}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleting && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-3" onClick={() => setDeleting(null)}>
          <div
            className="bg-white rounded-xl shadow-lg w-full max-w-sm p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-semibold text-gray-800">Hapus Bon/Tagihan?</h3>
              <p className="text-sm text-gray-600 mt-1">
                {deleting.supplier || 'Tanpa nama supplier'} · {formatRupiah(deleting.jumlah ?? 0)}
              </p>
              <p className="text-xs text-red-600 mt-1">
                Data akan dihapus permanen. Pengeluaran terkait (jika ada) juga ikut dihapus agar laporan konsisten.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDeleting(null)} className="flex-1 bg-gray-100 rounded-md py-2 text-sm">
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteBusy}
                className="flex-1 bg-red-600 text-white rounded-md py-2 text-sm font-medium disabled:opacity-60"
              >
                {deleteBusy ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
