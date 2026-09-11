import { useState } from 'react';
import { api } from '../api/client';
import type { TagihanItem } from './BayarTagihanDialog';
import { formatNominal, parseNominal, toInputDate } from '../utils/date';

interface Props {
  item: TagihanItem & { paidAt?: string | null };
  onClose: () => void;
  onSaved: () => void;
}

// Dialog edit data bon/tagihan: tanggal, jumlah, supplier, jatuh tempo.
// Jatuh tempo hanya ditampilkan untuk nota kredit (bukan bon tunai).
export default function EditTagihanDialog({ item, onClose, onSaved }: Props) {
  const isKredit = item.tipe === 'CREDIT';
  const [tanggal, setTanggal] = useState(toInputDate(item.tanggal));
  const [jumlah, setJumlah] = useState(formatNominal(item.jumlah ?? ''));
  const [supplier, setSupplier] = useState(item.supplier ?? '');
  const [jatuhTempo, setJatuhTempo] = useState(toInputDate(item.jatuhTempo));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const paidAmount = item.paidAmount ?? 0;

  async function handleSubmit() {
    setError('');
    const jumlahNum = parseNominal(jumlah);
    if (!jumlahNum || jumlahNum <= 0) {
      setError('Jumlah harus lebih dari 0.');
      return;
    }
    if (jumlahNum < paidAmount) {
      setError(`Jumlah tidak boleh lebih kecil dari yang sudah terbayar (${paidAmount}).`);
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/bon/${item.id}`, {
        tanggal,
        jumlah: jumlahNum,
        supplier,
        ...(isKredit ? { jatuhTempo: jatuhTempo || null } : {}),
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Gagal menyimpan perubahan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-3" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-md p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="font-semibold text-gray-800">Edit Tagihan / Bon</h3>
          {paidAmount > 0 && (
            <p className="text-xs text-amber-600">
              Sudah terbayar: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(paidAmount)} — jumlah tidak boleh lebih kecil dari ini.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm mb-1 text-gray-700">Tanggal Nota</label>
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

        {isKredit && (
          <div>
            <label className="block text-sm mb-1 text-gray-700">Jatuh Tempo</label>
            <input
              type="date"
              className="w-full border rounded-md px-3 py-2"
              value={jatuhTempo}
              onChange={(e) => setJatuhTempo(e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 bg-gray-100 rounded-md py-2 text-sm">
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-brand text-white rounded-md py-2 text-sm font-medium disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  );
}
