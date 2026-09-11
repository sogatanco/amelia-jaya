import { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type Periode = 'harian' | 'mingguan' | 'bulanan';

interface ChartPoint {
  key: string;
  label: string;
  omset: number;
  pengeluaran: number;
  labaRugi: number;
}

function formatRupiahSingkat(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' jt';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + ' rb';
  return String(n);
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

interface Props {
  from: string;
  to: string;
}

// Grafik omset vs pengeluaran dengan pilihan periode harian/mingguan/bulanan.
export default function LaporanChart({ from, to }: Props) {
  const [periode, setPeriode] = useState<Periode>('harian');
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get('/reports/chart', { params: { from, to, periode } })
      .then((res) => setData(res.data.data))
      .finally(() => setLoading(false));
  }, [from, to, periode]);

  return (
    <section className="bg-white rounded-xl shadow p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Grafik Omset vs Pengeluaran</h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['harian', 'mingguan', 'bulanan'] as Periode[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriode(p)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                periode === p ? 'bg-white shadow text-gray-800' : 'text-gray-500'
              }`}
            >
              {p === 'harian' ? 'Harian' : p === 'mingguan' ? 'Mingguan' : 'Bulanan'}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400 py-8 text-center">Memuat grafik...</p>}

      {!loading && data.length > 0 && (
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatRupiahSingkat} tick={{ fontSize: 11 }} width={48} />
              <Tooltip
                formatter={(value) => [
                  formatRupiah(Number(value ?? 0)),
                  '',
                ]}
                labelFormatter={(label) => String(label)}
              />
              <Legend
                formatter={(value: string) =>
                  value === 'omset' ? 'Omset' : value === 'pengeluaran' ? 'Pengeluaran' : 'Laba/Rugi'
                }
              />
              <Bar dataKey="omset" fill="#16a34a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="pengeluaran" fill="#dc2626" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
