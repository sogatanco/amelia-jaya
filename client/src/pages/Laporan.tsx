import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { api } from '../api/client';
import LaporanChart from '../components/LaporanChart';
import { formatTanggal } from '../utils/date';

interface Row {
  tanggal: string;
  omset: number;
  pengeluaran: number;
  labaRugi: number;
}

interface Summary {
  totalOmset: number;
  totalPengeluaran: number;
  labaRugi: number;
  rows: Row[];
}

interface ClosingItem {
  id: string;
  tanggal: string;
  omset: number;
  sumber: 'KASIR' | 'QRIS';
  catatan?: string | null;
}

interface ExpenseItem {
  id: string;
  tanggal: string;
  kategori: string;
  jumlah: number;
  keterangan?: string | null;
  sumberDana: string;
  dariLaci: number;
  dariCashflow: number;
  dariBank: number;
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function formatSumberDana(item: ExpenseItem) {
  const rincian = ([
    ['Laci', item.dariLaci],
    ['Cashflow', item.dariCashflow],
    ['Bank', item.dariBank],
  ] as Array<[string, number]>).filter(([, nominal]) => nominal > 0);
  return rincian.length > 0 ? rincian.map(([label, nominal]) => `${label}: ${formatRupiah(nominal)}`).join(' · ') : item.sumberDana;
}

export default function Laporan() {
  const [from, setFrom] = useState(dayjs().format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [totalTagihan, setTotalTagihan] = useState(0);
  const [closings, setClosings] = useState<ClosingItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);

  async function load() {
    const [summaryRes, tagihanRes, closingsRes, expensesRes] = await Promise.all([
      api.get('/reports/summary', { params: { from, to } }),
      api.get('/reports/tagihan'),
      api.get('/closings', { params: { from, to } }),
      api.get('/expenses', { params: { from, to } }),
    ]);
    setSummary(summaryRes.data);
    setTotalTagihan(tagihanRes.data.totalTagihan);
    setClosings(closingsRes.data);
    setExpenses(expensesRes.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">Laporan / Neraca Penjualan</h2>
        <p className="text-xs text-gray-500">
          Pengeluaran dari <span className="font-medium">Laci Kasir</span> masuk kembali ke omset/pemasukan tanggal itu
          (perputaran kas toko), sehingga tidak mengurangi laba/rugi. Pengeluaran dari Cashflow/Bank tetap mengurangi laba/rugi.
        </p>
        <div className="flex gap-2">
          <input type="date" className="border rounded-md px-2 py-1.5 flex-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="border rounded-md px-2 py-1.5 flex-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button onClick={load} className="w-full bg-gray-800 text-white rounded-md py-2 text-sm">
          Tampilkan
        </button>
      </section>

      {summary && (
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500">Total Omset</p>
            <p className="font-bold text-green-600">{formatRupiah(summary.totalOmset)}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500">Total Pengeluaran</p>
            <p className="font-bold text-red-600">{formatRupiah(summary.totalPengeluaran)}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500">Laba / Rugi</p>
            <p className={`font-bold ${summary.labaRugi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatRupiah(summary.labaRugi)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500">Total Tagihan Belum Lunas</p>
            <p className="font-bold text-orange-600">{formatRupiah(totalTagihan)}</p>
          </div>
        </section>
      )}

      {summary && <LaporanChart from={from} to={to} />}

      {summary && (
        <section className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Rincian Harian</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b">
                  <th className="py-2 pr-4">Tanggal</th>
                  <th className="py-2 pr-4 text-right">Omset</th>
                  <th className="py-2 pr-4 text-right">Pengeluaran</th>
                  <th className="py-2 text-right">Laba/Rugi</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((r) => (
                  <tr key={r.tanggal} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatTanggal(r.tanggal)}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">{formatRupiah(r.omset)}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">{formatRupiah(r.pengeluaran)}</td>
                    <td className={`py-2 text-right whitespace-nowrap ${r.labaRugi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatRupiah(r.labaRugi)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {summary && (
        <section className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Daftar Omset</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b">
                  <th className="py-2 pr-4">Tanggal</th>
                  <th className="py-2 pr-4">Sumber</th>
                  <th className="py-2 pr-4 text-right">Omset</th>
                  <th className="py-2">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {closings.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatTanggal(item.tanggal)}</td>
                    <td className="py-2 pr-4">{item.sumber === 'QRIS' ? 'QRIS' : 'Kasir / Tunai'}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">{formatRupiah(item.omset)}</td>
                    <td className="py-2 text-gray-500">{item.catatan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {closings.length === 0 && <p className="text-sm text-gray-400 py-2">Belum ada data omset pada periode ini.</p>}
        </section>
      )}

      {summary && (
        <section className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Daftar Pengeluaran</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b">
                  <th className="py-2 pr-4">Tanggal</th>
                  <th className="py-2 pr-4">Kategori</th>
                  <th className="py-2 pr-4 text-right">Jumlah</th>
                  <th className="py-2 pr-4">Sumber</th>
                  <th className="py-2">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatTanggal(item.tanggal)}</td>
                    <td className="py-2 pr-4">{item.kategori}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">{formatRupiah(item.jumlah)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{formatSumberDana(item)}</td>
                    <td className="py-2 text-gray-500">{item.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {expenses.length === 0 && <p className="text-sm text-gray-400 py-2">Belum ada pengeluaran pada periode ini.</p>}
        </section>
      )}
    </div>
  );
}
