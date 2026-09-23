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
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type Periode = 'harian' | 'mingguan' | 'bulanan';

interface ChartPoint {
  key: string;
  label: string;
  omset: number;
  pengeluaran: number;
  labaRugi: number;
}

interface CategoryPoint {
  name: string;
  jumlah: number;
}

const CATEGORY_COLORS = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777'];

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
  const [kategori, setKategori] = useState<CategoryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get('/reports/chart', { params: { from, to, periode } })
      .then((res) => {
        setData(res.data.data);
        setKategori(res.data.kategori ?? []);
      })
      .finally(() => setLoading(false));
  }, [from, to, periode]);

  return (
    <section className="bg-white rounded-xl shadow p-4 space-y-4">
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

      {!loading && kategori.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="font-semibold text-gray-800 mb-2">Pengeluaran Berdasarkan Kategori</h4>
          <div className="w-full h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={kategori} dataKey="jumlah" nameKey="name" cx="50%" cy="45%" outerRadius="34%" labelLine={false}>
                  {kategori.map((item, index) => (
                    <Cell key={item.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatRupiah(Number(value ?? 0))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-600">
            {kategori.map((item, index) => (
              <div key={item.name} className="flex min-w-0 items-start gap-2">
                <span
                  className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                />
                <span className="min-w-0 break-words">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && data.length === 0 && kategori.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">Belum ada data pada periode ini.</p>
      )}
    </section>
  );
}
