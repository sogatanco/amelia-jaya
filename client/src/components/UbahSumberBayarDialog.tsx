import { useState } from 'react';
import { api } from '../api/client';
import type { TagihanItem } from './BayarTagihanDialog';
import { formatNominal, parseNominal } from '../utils/date';

type Metode = 'LACI' | 'CASHFLOW' | 'BANK' | 'CAMPUR';

const METODE_LABEL: Record<Metode, string> = {
  LACI: 'Laci Kasir',
  CASHFLOW: 'Cashflow',
  BANK: 'Bank',
  CAMPUR: 'Campur',
};

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

interface Props {
  item: TagihanItem;
  onClose: () => void;
  onSaved: () => void;
}

// Dialog untuk mengubah sumber dana pembayaran tagihan yang sudah tercatat.
export default function UbahSumberBayarDialog({ item, onClose, onSaved }: Props) {
  const paid = item.paidAmount ?? 0;

  const [metode, setMetode] = useState<Metode>('LACI');
  const [laci, setLaci] = useState('');
  const [cashflow, setCashflow] = useState('');
  const [bank, setBank] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalCampur = parseNominal(laci) + parseNominal(cashflow) + parseNominal(bank);

  async function handleSubmit() {
    setError('');
    if (metode === 'CAMPUR' && totalCampur !== paid) {
      setError(`Total rincian campur (${formatRupiah(totalCampur)}) harus sama dengan yang sudah dibayar (${formatRupiah(paid)}).`);
      return;
    }

    setSaving(true);
    try {
      await api.post(`/bon/${item.id}/ubah-sumber-bayar`, {
        metode,
        ...(metode === 'CAMPUR'
          ? { dariLaci: parseNominal(laci), dariCashflow: parseNominal(cashflow), dariBank: parseNominal(bank) }
          : {}),
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Gagal mengubah sumber dana.');
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
          <h3 className="font-semibold text-gray-800">Ubah Sumber Dana Pembayaran</h3>
          <p className="text-xs text-gray-500">
            {item.supplier || 'Tanpa nama supplier'} · Sudah dibayar:{' '}
            <span className="font-semibold text-green-600">{formatRupiah(paid)}</span>
          </p>
        </div>

        <div>
          <label className="block text-sm mb-1 text-gray-700">Sumber Dana Baru</label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['LACI', 'CASHFLOW', 'BANK', 'CAMPUR'] as Metode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetode(m)}
                className={`py-2 rounded-md text-xs font-medium ${metode === m ? 'bg-brand text-white' : 'bg-gray-100'}`}
              >
                {METODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        {metode === 'CAMPUR' && (
          <div className="space-y-2 border rounded-md p-2 bg-gray-50">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-0.5">Laci</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                  value={laci}
                  onChange={(e) => setLaci(formatNominal(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-0.5">Cashflow</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                  value={cashflow}
                  onChange={(e) => setCashflow(formatNominal(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-0.5">Bank</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                  value={bank}
                  onChange={(e) => setBank(formatNominal(e.target.value))}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Total harus sama dengan yang sudah dibayar: {formatRupiah(paid)}
              {totalCampur !== paid && (
                <span className="text-amber-600"> · sekarang {formatRupiah(totalCampur)}</span>
              )}
            </p>
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
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
