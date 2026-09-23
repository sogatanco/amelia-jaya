import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { api } from '../api/client';
import LaporanChart from '../components/LaporanChart';
import { formatTanggal } from '../utils/date';

interface Row {
  tanggal: string;
  tunai?: number;
  qris?: number;
  pengeluaranLaci?: number;
  total?: number;
  omset: number;
  pengeluaran: number;
  labaRugi: number;
}

interface Summary {
  totalOmset: number;
  totalPengeluaran: number;
  labaRugi: number;
  categoryTotals?: CategoryTotal[];
  rows: Row[];
}

interface CategoryTotal {
  name: string;
  jumlah: number;
}

interface ClosingItem {
  id: string;
  tanggal: string;
  omset: number;
  sumber: 'KASIR' | 'QRIS';
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
  const value = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
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

  const categoryTotals = summary?.categoryTotals?.length
    ? summary.categoryTotals
    : Object.entries(
        expenses.reduce<Record<string, number>>((totals, item) => {
          totals[item.kategori] = (totals[item.kategori] ?? 0) + item.jumlah;
          return totals;
        }, {}),
      )
        .map(([name, jumlah]) => ({ name, jumlah }))
        .sort((a, b) => b.jumlah - a.jumlah);

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

  const closingTotalsByDate = closings.reduce<Record<string, { tunai: number; qris: number }>>((totals, item) => {
    const current = totals[item.tanggal] ?? { tunai: 0, qris: 0 };
    if (item.sumber === 'QRIS') current.qris += Number(item.omset) || 0;
    else current.tunai += Number(item.omset) || 0;
    totals[item.tanggal] = current;
    return totals;
  }, {});
  const laciByDate = expenses.reduce<Record<string, number>>((totals, item) => {
    const tanggal = dayjs(item.tanggal).format('YYYY-MM-DD');
    const dariLaci = Number(item.dariLaci) || (item.sumberDana === 'LACI' ? Number(item.jumlah) || 0 : 0);
    totals[tanggal] = (totals[tanggal] ?? 0) + dariLaci;
    return totals;
  }, {});

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

      {summary && <LaporanChart from={from} to={to} kategori={categoryTotals} />}

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
                  <th className="py-2 pr-4 text-right">Tunai</th>
                  <th className="py-2 pr-4 text-right">QRIS</th>
                  <th className="py-2 pr-4 text-right">Pengeluaran dari Laci</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((item) => {
                  const closingTotals = closingTotalsByDate[item.tanggal] ?? { tunai: 0, qris: 0 };
                  const tunai = Number.isFinite(item.tunai) ? item.tunai! : closingTotals.tunai;
                  const qris = Number.isFinite(item.qris) ? item.qris! : closingTotals.qris;
                  const pengeluaranLaci = Number.isFinite(item.pengeluaranLaci)
                    ? item.pengeluaranLaci!
                    : laciByDate[item.tanggal] ?? 0;
                  const total = Number.isFinite(item.total) ? item.total! : tunai + qris + pengeluaranLaci;
                  return (
                    <tr key={item.tanggal} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4 whitespace-nowrap">{formatTanggal(item.tanggal)}</td>
                      <td className="py-2 pr-4 text-right whitespace-nowrap">{formatRupiah(tunai)}</td>
                      <td className="py-2 pr-4 text-right whitespace-nowrap">{formatRupiah(qris)}</td>
                      <td className="py-2 pr-4 text-right whitespace-nowrap">{formatRupiah(pengeluaranLaci)}</td>
                      <td className="py-2 text-right whitespace-nowrap font-medium">{formatRupiah(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {summary.rows.length === 0 && <p className="text-sm text-gray-400 py-2">Belum ada data omset pada periode ini.</p>}
        </section>
      )}

      {summary && (
        <section className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Total Pengeluaran Berdasarkan Kategori</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b">
                  <th className="py-2 pr-4">Kategori</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {categoryTotals.map((item) => (
                  <tr key={item.name} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4">{item.name}</td>
                    <td className="py-2 text-right whitespace-nowrap">{formatRupiah(item.jumlah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t mt-2 pt-2 flex justify-between font-semibold text-sm">
            <span>Total keseluruhan</span>
            <span>{formatRupiah(categoryTotals.reduce((total, item) => total + item.jumlah, 0))}</span>
          </div>
          {categoryTotals.length === 0 && <p className="text-sm text-gray-400 py-2">Belum ada pengeluaran pada periode ini.</p>}
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
