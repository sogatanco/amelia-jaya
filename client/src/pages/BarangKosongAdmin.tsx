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

function dateKey(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date(value));
}

export default function BarangKosongAdmin() {
  const [reports, setReports] = useState<Report[]>([]);

  async function load() {
    const { data } = await api.get<Report[]>('/barang-kosong');
    setReports(data);
  }

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const groups = new Map<string, Report[]>();
    for (const report of reports) {
      const key = dateKey(report.createdAt);
      groups.set(key, [...(groups.get(key) ?? []), report]);
    }
    return [...groups.entries()];
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
      {grouped.map(([date, items]) => (
        <section key={date} className="bg-white rounded-xl shadow p-4 space-y-2">
          <h3 className="font-semibold text-gray-800">{date}</h3>
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 border-b last:border-0 py-2">
              <button
                type="button"
                onClick={() => toggle(item)}
                title={item.dibeliAt ? 'Batalkan checklist' : 'Tandai sudah dibelanjakan'}
                className={`mt-0.5 h-6 w-6 shrink-0 rounded border text-sm ${item.dibeliAt ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 text-transparent'}`}
              >
                ✓
              </button>
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${item.dibeliAt ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.namaBarang}</p>
                <p className="text-xs text-gray-500">Dicatat oleh: {item.createdBy.name}{item.catatan ? ` · ${item.catatan}` : ''}</p>
                {item.dibeliAt && <p className="text-xs text-green-600">Dibelanjakan oleh: {item.dibeliOleh?.name || 'Admin'}</p>}
              </div>
            </div>
          ))}
        </section>
      ))}
      {grouped.length === 0 && <p className="text-sm text-gray-400">Belum ada laporan barang kosong.</p>}
    </div>
  );
}