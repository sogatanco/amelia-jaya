import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

interface Report {
  id: string;
  namaBarang: string;
  catatan: string | null;
  createdAt: string;
  createdBy: { name: string };
  dibeliAt: string | null;
  dibeliOleh: { name: string } | null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function BarangKosongAdmin() {
  const [reports, setReports] = useState<Report[]>([]);

  async function load() {
    const { data } = await api.get<Report[]>('/barang-kosong');
    setReports(data);
  }

  useEffect(() => { load(); }, []);

  const [notPurchased, purchased] = useMemo(() => {
    const pending = reports.filter((report) => !report.dibeliAt);
    const done = reports
      .filter((report) => report.dibeliAt)
      .sort((a, b) => new Date(b.dibeliAt!).getTime() - new Date(a.dibeliAt!).getTime());
    return [pending, done];
  }, [reports]);

  async function toggle(report: Report) {
    const { data } = await api.patch<Report>(`/barang-kosong/${report.id}/purchased`);
    setReports((current) => current.map((item) => (item.id === data.id ? data : item)));
  }

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold text-gray-800">Barang Kosong</h2>
        <p className="text-xs text-gray-500 mt-1">Centang sekali jika barang sudah dibelanjakan.</p>
      </section>
      <section className="bg-white rounded-xl shadow p-4 space-y-2">
        <h3 className="font-semibold text-gray-800">Belum Dibelanjakan</h3>
        {notPurchased.map((item) => (
          <div key={item.id} className="flex items-start gap-3 border-b last:border-0 py-2">
            <button
              type="button"
              onClick={() => toggle(item)}
              title="Tandai sudah dibelanjakan"
              className="mt-0.5 h-6 w-6 shrink-0 rounded border border-gray-300 text-transparent"
            >
              ✓
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-800">{item.namaBarang}</p>
              {item.catatan && <p className="text-xs text-gray-500">{item.catatan}</p>}
              <p className="text-xs text-gray-500">Dicatat {formatDate(item.createdAt)} oleh {item.createdBy.name}</p>
            </div>
          </div>
        ))}
        {notPurchased.length === 0 && <p className="text-sm text-gray-400">Tidak ada barang yang menunggu dibelanjakan.</p>}
      </section>
      <section className="bg-white rounded-xl shadow p-4 space-y-2">
        <h3 className="font-semibold text-gray-800">Sudah Dibelanjakan</h3>
        {purchased.map((item) => (
          <div key={item.id} className="flex items-start gap-3 border-b last:border-0 py-2">
            <button
              type="button"
              onClick={() => toggle(item)}
              title="Batalkan checklist"
              className="mt-0.5 h-6 w-6 shrink-0 rounded border bg-green-600 border-green-600 text-sm text-white"
            >
              ✓
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-800">{item.namaBarang}</p>
              {item.catatan && <p className="text-xs text-gray-500">{item.catatan}</p>}
              <p className="text-xs text-green-600">
                Dicentang {formatDateTime(item.dibeliAt!)} oleh {item.dibeliOleh?.name || 'Admin'}
              </p>
              <p className="text-xs text-gray-500">Diinput {formatDateTime(item.createdAt)} oleh {item.createdBy.name}</p>
            </div>
          </div>
        ))}
        {purchased.length === 0 && <p className="text-sm text-gray-400">Belum ada barang yang dibelanjakan.</p>}
      </section>
    </div>
  );
}