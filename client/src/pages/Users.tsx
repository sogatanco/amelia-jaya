import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { api } from '../api/client';
import { toInputDate } from '../utils/date';

interface UserItem {
  id: string;
  name: string;
  username: string;
  role: 'ADMIN' | 'CASHIER';
  active: boolean;
}

interface ClosingExport {
  tanggal: string;
  omset: number;
  sumber: string;
  catatan?: string | null;
}

interface ExpenseExport {
  tanggal: string;
  kategori: string;
  jumlah: number;
  keterangan?: string | null;
  sumberDana: string;
}

interface BonExport {
  tanggal: string;
  tipe: string;
  jumlah: number | null;
  paidAmount: number;
  supplier?: string | null;
  status: string;
}

interface ExportData {
  closings: ClosingExport[];
  expenses: ExpenseExport[];
  bons: BonExport[];
}

type ClearTarget = 'PENJUALAN' | 'BON' | 'SEMUA';
type ExportPeriod = 'TANGGAL' | 'MINGGUAN' | 'BULANAN';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function exportHtml(data: ExportData, periodLabel: string) {
  const closingRows = data.closings
    .map((item) => `<tr><td>${escapeHtml(item.tanggal)}</td><td>${escapeHtml(item.sumber)}</td><td>${item.omset}</td><td>${escapeHtml(item.catatan)}</td></tr>`)
    .join('');
  const expenseRows = data.expenses
    .map((item) => `<tr><td>${escapeHtml(item.tanggal)}</td><td>${escapeHtml(item.kategori)}</td><td>${item.jumlah}</td><td>${escapeHtml(item.sumberDana)}</td><td>${escapeHtml(item.keterangan)}</td></tr>`)
    .join('');
  const bonRows = data.bons
    .map((item) => `<tr><td>${escapeHtml(item.tanggal)}</td><td>${escapeHtml(item.tipe)}</td><td>${escapeHtml(item.supplier)}</td><td>${item.jumlah ?? 0}</td><td>${item.paidAmount}</td><td>${escapeHtml(item.status)}</td></tr>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Export Pembukuan Amelia Jaya</title><style>
    body{font-family:Arial,sans-serif;color:#222}h1{font-size:20px}h2{font-size:16px;margin-top:24px}
    table{border-collapse:collapse;width:100%;margin-bottom:18px}th,td{border:1px solid #bbb;padding:6px;text-align:left;font-size:12px}th{background:#e8eef2}
    @media print{h1{font-size:18px}h2{break-before:page}}
  </style></head><body><h1>Export Pembukuan Toko Amelia Jaya</h1><p>Periode: ${escapeHtml(periodLabel)}</p>
    <h2>Penjualan Harian</h2><table><thead><tr><th>Tanggal</th><th>Sumber</th><th>Omset</th><th>Catatan</th></tr></thead><tbody>${closingRows}</tbody></table>
    <h2>Pengeluaran</h2><table><thead><tr><th>Tanggal</th><th>Kategori</th><th>Jumlah</th><th>Sumber Dana</th><th>Keterangan</th></tr></thead><tbody>${expenseRows}</tbody></table>
    <h2>Bon dan Tagihan</h2><table><thead><tr><th>Tanggal</th><th>Tipe</th><th>Supplier</th><th>Jumlah</th><th>Terbayar</th><th>Status</th></tr></thead><tbody>${bonRows}</tbody></table>
  </body></html>`;
}

export default function Users() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'CASHIER'>('CASHIER');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>('TANGGAL');
  const [exportDate, setExportDate] = useState(dayjs().format('YYYY-MM-DD'));

  function getExportRange() {
    const selected = dayjs(exportDate);
    if (exportPeriod === 'BULANAN') {
      const start = selected.startOf('month');
      return { from: start.format('YYYY-MM-DD'), to: start.endOf('month').format('YYYY-MM-DD'), label: start.format('MMMM YYYY') };
    }
    if (exportPeriod === 'MINGGUAN') {
      const offset = selected.day() === 0 ? 6 : selected.day() - 1;
      const start = selected.subtract(offset, 'day');
      return { from: start.format('YYYY-MM-DD'), to: start.add(6, 'day').format('YYYY-MM-DD'), label: `${start.format('DD MMM YYYY')} - ${start.add(6, 'day').format('DD MMM YYYY')}` };
    }
    return { from: exportDate, to: exportDate, label: selected.format('DD MMMM YYYY') };
  }

  async function load() {
    const { data } = await api.get('/users');
    setUsers(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    setError('');
    try {
      await api.post('/users', { name, username, password, role });
      setName('');
      setUsername('');
      setPassword('');
      setRole('CASHIER');
      load();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal membuat user');
    }
  }

  async function toggleActive(u: UserItem) {
    await api.patch(`/users/${u.id}/active`, { active: !u.active });
    load();
  }

  async function getExportData(): Promise<{ data: ExportData; label: string }> {
    const [closings, expenses, bons] = await Promise.all([
      api.get('/closings'),
      api.get('/expenses'),
      api.get('/bon'),
    ]);
    const range = getExportRange();
    const inRange = (tanggal: string) => {
      const date = toInputDate(tanggal);
      return date >= range.from && date <= range.to;
    };
    return {
      data: {
        closings: closings.data.filter((item: ClosingExport) => inRange(item.tanggal)),
        expenses: expenses.data.filter((item: ExpenseExport) => inRange(item.tanggal)),
        bons: bons.data.filter((item: BonExport) => inRange(item.tanggal)),
      },
      label: range.label,
    };
  }

  async function exportExcel() {
    setError('');
    try {
      const result = await getExportData();
      const blob = new Blob([exportHtml(result.data, result.label)], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pembukuan-amelia-jaya-${exportPeriod.toLowerCase()}-${exportDate}.xls`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Gagal menyiapkan export Excel.');
    }
  }

  async function exportPdf() {
    setError('');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Popup export PDF diblokir browser. Izinkan popup lalu coba lagi.');
      return;
    }
    try {
      const result = await getExportData();
      printWindow.document.write(exportHtml(result.data, result.label));
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch {
      printWindow.close();
      setError('Gagal menyiapkan export PDF.');
    }
  }

  async function clearData(target: ClearTarget) {
    const labels: Record<ClearTarget, string> = {
      PENJUALAN: 'data penjualan harian',
      BON: 'semua bon, tagihan, dan pengeluaran yang berasal dari bon',
      SEMUA: 'semua data penjualan, pengeluaran, dan bon',
    };
    if (!window.confirm(`Yakin ingin menghapus ${labels[target]}? Tindakan ini tidak dapat dibatalkan.`)) return;

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.delete('/users/data', { data: { target } });
      setMessage(`Data dibersihkan: ${data.penjualan} penjualan, ${data.bon} bon, ${data.pengeluaran} pengeluaran.`);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal membersihkan data.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-800">Pengaturan</h2>
          <p className="text-xs text-gray-500 mt-1">Kelola user, backup data, dan pembersihan data operasional.</p>
        </div>
        <div className="border rounded-md p-3 space-y-2 bg-gray-50">
          <label className="block text-sm font-medium text-gray-700">Periode Export</label>
          <select
            className="w-full border rounded-md px-3 py-2 bg-white"
            value={exportPeriod}
            onChange={(e) => setExportPeriod(e.target.value as ExportPeriod)}
          >
            <option value="TANGGAL">Tanggal</option>
            <option value="MINGGUAN">Mingguan</option>
            <option value="BULANAN">Bulanan</option>
          </select>
          <input
            type={exportPeriod === 'BULANAN' ? 'month' : 'date'}
            className="w-full border rounded-md px-3 py-2 bg-white"
            value={exportPeriod === 'BULANAN' ? exportDate.slice(0, 7) : exportDate}
            onChange={(e) => setExportDate(exportPeriod === 'BULANAN' ? `${e.target.value}-01` : e.target.value)}
          />
          <p className="text-xs text-gray-500">
            {exportPeriod === 'MINGGUAN' ? 'Pilih satu tanggal; export mencakup Senin sampai Minggu pada minggu tersebut.' : exportPeriod === 'BULANAN' ? 'Pilih bulan yang ingin diexport.' : 'Pilih tanggal transaksi yang ingin diexport.'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={exportExcel} className="bg-green-700 text-white rounded-md py-2 text-sm font-medium">
            Export Excel
          </button>
          <button onClick={exportPdf} className="bg-gray-800 text-white rounded-md py-2 text-sm font-medium">
            Export PDF
          </button>
        </div>
        <div className="border-t pt-3 space-y-2">
          <p className="text-sm font-medium text-red-700">Bersihkan Data</p>
          <p className="text-xs text-gray-500">Data yang dihapus tidak dapat dikembalikan. Akun user tetap aman.</p>
          <div className="grid grid-cols-1 gap-2">
            <button onClick={() => clearData('PENJUALAN')} disabled={busy} className="border border-red-200 text-red-700 rounded-md py-2 text-sm disabled:opacity-50">
              Bersihkan Data Penjualan
            </button>
            <button onClick={() => clearData('BON')} disabled={busy} className="border border-red-200 text-red-700 rounded-md py-2 text-sm disabled:opacity-50">
              Bersihkan Data Bon
            </button>
            <button onClick={() => clearData('SEMUA')} disabled={busy} className="bg-red-700 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50">
              Bersihkan Semua Data Operasional
            </button>
          </div>
        </div>
        {message && <p className="text-sm text-green-600">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">Management User</h2>
        <input className="w-full border rounded-md px-3 py-2" placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full border rounded-md px-3 py-2" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input type="password" className="w-full border rounded-md px-3 py-2" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <select className="w-full border rounded-md px-3 py-2" value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'CASHIER')}>
          <option value="CASHIER">Kasir/Karyawan</option>
          <option value="ADMIN">Administrator</option>
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={handleCreate} className="w-full bg-brand text-white rounded-md py-2 font-medium">
          Simpan
        </button>
      </section>

      <section className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-2">Daftar User</h3>
        <ul className="divide-y">
          {users.map((u) => (
            <li key={u.id} className="py-2 flex justify-between items-center text-sm">
              <div>
                <p className="font-medium">{u.name} <span className="text-xs text-gray-400">({u.username})</span></p>
                <p className="text-xs text-gray-500">{u.role === 'ADMIN' ? 'Administrator' : 'Kasir'}</p>
              </div>
              <button
                onClick={() => toggleActive(u)}
                className={`text-xs px-2 py-1 rounded-md ${u.active ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}
              >
                {u.active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
