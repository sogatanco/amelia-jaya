import { useEffect, useState } from 'react';
import { formatNominal, parseNominal } from '../utils/date';

export type SumberDana = 'LACI' | 'CASHFLOW' | 'BANK' | 'CAMPUR';

export interface RincianSumber {
  sumberDana: SumberDana;
  dariLaci: number;
  dariCashflow: number;
  dariBank: number;
}

export const SUMBER_LABEL: Record<SumberDana, string> = {
  LACI: 'Laci Kasir',
  CASHFLOW: 'Cashflow',
  BANK: 'Bank (Saldo)',
  CAMPUR: 'Campur',
};

interface Props {
  total: number;
  onChange: (rincian: RincianSumber) => void;
}

// Pemilih sumber dana pengeluaran: laci kasir / cashflow / bank, atau campur
// dengan nominal per sumber diisi manual (totalnya harus sama dengan total).
export default function SumberDanaPicker({ total, onChange }: Props) {
  const [sumber, setSumber] = useState<SumberDana>('LACI');
  const [laci, setLaci] = useState('');
  const [cashflow, setCashflow] = useState('');
  const [bank, setBank] = useState('');

  useEffect(() => {
    if (sumber === 'CAMPUR') {
      onChange({
        sumberDana: 'CAMPUR',
        dariLaci: parseNominal(laci),
        dariCashflow: parseNominal(cashflow),
        dariBank: parseNominal(bank),
      });
    } else {
      onChange({
        sumberDana: sumber,
        dariLaci: sumber === 'LACI' ? total : 0,
        dariCashflow: sumber === 'CASHFLOW' ? total : 0,
        dariBank: sumber === 'BANK' ? total : 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumber, laci, cashflow, bank, total]);

  const totalCampur = parseNominal(laci) + parseNominal(cashflow) + parseNominal(bank);
  const selisih = total - totalCampur;

  return (
    <div className="space-y-2">
      <label className="block text-sm text-gray-700">Sumber Dana</label>
      <div className="grid grid-cols-4 gap-1.5">
        {(Object.keys(SUMBER_LABEL) as SumberDana[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSumber(s)}
            className={`py-2 rounded-md text-xs font-medium ${sumber === s ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            {SUMBER_LABEL[s]}
          </button>
        ))}
      </div>

      {sumber === 'CAMPUR' && (
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
          {selisih !== 0 && (
            <p className={`text-xs ${selisih > 0 ? 'text-amber-600' : 'text-red-600'}`}>
              {selisih > 0
                ? `Kurang ${new Intl.NumberFormat('id-ID').format(selisih)} dari total`
                : `Lebih ${new Intl.NumberFormat('id-ID').format(-selisih)} dari total`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
