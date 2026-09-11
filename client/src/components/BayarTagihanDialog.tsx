import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatNominal, parseNominal } from '../utils/date';

export interface TagihanItem {
  id: string;
  tanggal: string;
  jumlah: number | null;
  supplier: string | null;
  jatuhTempo: string | null;
  status: string;
  paidAmount: number;
  tipe: 'CASH' | 'CREDIT' | 'TITIP';
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

type Mode = 'PENUH' | 'SEBAGIAN';
type Metode = 'LACI' | 'CASHFLOW' | 'BANK' | 'CAMPUR';

const METODE_LABEL: Record<Metode, string> = {
  LACI: 'Laci Kasir',
  CASHFLOW: 'Cashflow',
  BANK: 'Bank',
  CAMPUR: 'Campur',
};

interface Props {
  item: TagihanItem;
  onClose: () => void;
  onPaid: () => void;
}

// Dialog pembayaran tagihan: bayar penuh / sebagian, dari laci / cashflow / bank / campur.
export default function BayarTagihanDialog({ item, onClose, onPaid }: Props) {
  const sisa = (item.jumlah ?? 0) - (item.paidAmount ?? 0);
  const isTitip = item.tipe === 'TITIP';

  const [mode, setMode] = useState<Mode>('PENUH');
  const [metode, setMetode] = useState<Metode>('LACI');
  const [jumlahSebagian, setJumlahSebagian] = useState('');
  const [laciAmount, setLaciAmount] = useState('');
  const [cashflowAmount, setCashflowAmount] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setJumlahSebagian(formatNominal(isTitip ? item.jumlah ?? 0 : sisa));
  }, [isTitip, item.jumlah, sisa]);

  const totalCampur = parseNominal(laciAmount) + parseNominal(cashflowAmount) + parseNominal(bankAmount);
  const totalBayar =
    metode === 'CAMPUR'
      ? totalCampur
      : mode === 'PENUH'
        ? isTitip
          ? item.jumlah ?? 0
          : sisa
        : parseNominal(jumlahSebagian);

  async function handleSubmit() {
    setError('');
    if (totalBayar <= 0) {
      setError('Jumlah pembayaran harus lebih dari 0.');
      return;
    }
    const batasBayar = isTitip ? item.jumlah ?? 0 : sisa;
    if (totalBayar > batasBayar) {
      setError(`Pembayaran melebihi ${isTitip ? 'nilai awal barang titip' : 'sisa tagihan'} (${formatRupiah(batasBayar)}).`);
      return;
    }
    if (isTitip && totalBayar < (item.paidAmount ?? 0)) {
      setError(`Total terjual tidak boleh lebih kecil dari yang sudah dibayar (${formatRupiah(item.paidAmount ?? 0)}).`);
      return;
    }

    setSaving(true);
    try {
      if (isTitip) {
        await api.post(`/bon/${item.id}/selesaikan-titip`, {
          jumlahAkhir: totalBayar,
          metode,
          ...(metode === 'CAMPUR'
            ? {
                dariLaci: parseNominal(laciAmount),
                dariCashflow: parseNominal(cashflowAmount),
                dariBank: parseNominal(bankAmount),
              }
            : {}),
        });
      } else {
        await api.post(`/bon/${item.id}/pay`, {
          metode,
          ...(metode === 'CAMPUR'
            ? {
                dariLaci: parseNominal(laciAmount),
                dariCashflow: parseNominal(cashflowAmount),
                dariBank: parseNominal(bankAmount),
              }
            : { jumlah: totalBayar }),
        });
      }
      onPaid();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Gagal menyimpan pembayaran.');
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
          <h3 className="font-semibold text-gray-800">{isTitip ? 'Selesaikan Barang Titip' : 'Bayar Tagihan'}</h3>
          <p className="text-xs text-gray-500">
            {item.supplier || 'Tanpa nama supplier'} · {isTitip ? 'Nilai belum dibayar' : 'Sisa tagihan'}:{' '}
            <span className="font-semibold text-red-600">{formatRupiah(sisa)}</span>
          </p>
        </div>

        <div>
          <label className="block text-sm mb-1 text-gray-700">Jenis Pembayaran</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('PENUH')}
              className={`flex-1 py-2 rounded-md text-sm font-medium ${mode === 'PENUH' ? 'bg-brand text-white' : 'bg-gray-100'}`}
            >
              {isTitip ? 'Semua Terjual' : 'Bayar Penuh'}
            </button>
            <button
              type="button"
              onClick={() => setMode('SEBAGIAN')}
              className={`flex-1 py-2 rounded-md text-sm font-medium ${mode === 'SEBAGIAN' ? 'bg-brand text-white' : 'bg-gray-100'}`}
            >
              {isTitip ? 'Ada Retur/Tidak Laku' : 'Bayar Sebagian'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1 text-gray-700">Cara Bayar (Sumber Dana)</label>
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

        {mode === 'SEBAGIAN' && metode !== 'CAMPUR' && (
          <div>
            <label className="block text-sm mb-1 text-gray-700">{isTitip ? 'Total yang Terjual (Rp)' : 'Nominal Bayar (Rp)'}</label>
            <input
              type="text"
              inputMode="numeric"
              className="w-full border rounded-md px-3 py-2"
              value={jumlahSebagian}
              onChange={(e) => setJumlahSebagian(formatNominal(e.target.value))}
            />
          </div>
        )}

        {metode === 'CAMPUR' && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs mb-1 text-gray-700">Laci (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full border rounded-md px-2 py-2"
                value={laciAmount}
                onChange={(e) => setLaciAmount(formatNominal(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-700">Cashflow (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full border rounded-md px-2 py-2"
                value={cashflowAmount}
                onChange={(e) => setCashflowAmount(formatNominal(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-700">Bank (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full border rounded-md px-2 py-2"
                value={bankAmount}
                onChange={(e) => setBankAmount(formatNominal(e.target.value))}
              />
            </div>
          </div>
        )}

        <p className="text-sm text-gray-600 border-t pt-2">
          {isTitip ? 'Total wajib dibayar' : 'Total dibayar'}: <span className="font-semibold">{formatRupiah(totalBayar)}</span>
        </p>

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
            {saving ? 'Menyimpan...' : isTitip ? 'Simpan Penyelesaian' : 'Simpan Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  );
}
