import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';

interface Report { id: string; namaBarang: string; catatan: string | null; createdAt: string; createdBy: { name: string }; dibeliAt: string | null; dibeliOleh: { name: string } | null }

export default function BarangKosong() {
  const [namaBarang, setNamaBarang] = useState('');
  const [catatan, setCatatan] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [message, setMessage] = useState('');

  async function load() { const { data } = await api.get<Report[]>('/barang-kosong'); setReports(data); }
  useEffect(() => { load(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.post('/barang-kosong', { namaBarang, catatan });
    setNamaBarang(''); setCatatan(''); setMessage('Barang kosong berhasil dilaporkan ke admin.'); load();
  }

  return <div className="space-y-4">
    <section className="bg-white rounded-xl shadow p-4 space-y-3">
      <h2 className="font-semibold text-gray-800">Input Barang Kosong</h2>
      <form onSubmit={submit} className="space-y-3">
        <textarea className="w-full border rounded-md px-3 py-2 min-h-32" placeholder="Tulis satu nama barang per baris" value={namaBarang} onChange={(event) => setNamaBarang(event.target.value)} required />
        <textarea className="w-full border rounded-md px-3 py-2" placeholder="Catatan (opsional)" value={catatan} onChange={(event) => setCatatan(event.target.value)} />
        <button className="w-full bg-brand text-white rounded-md py-2 font-medium">Simpan Barang Kosong</button>
      </form>
      {message && <p className="text-sm text-green-600">{message}</p>}
    </section>
    <section className="bg-white rounded-xl shadow p-4 space-y-2">
      <h3 className="font-semibold text-gray-800">Riwayat Barang Kosong</h3>
      {reports.map((report) => <div key={report.id} className="border-b last:border-0 py-2"><p className="font-medium">{report.namaBarang}</p><p className="text-xs text-gray-500">{report.catatan || 'Tanpa catatan'} · {report.createdBy.name}</p></div>)}
      {reports.length === 0 && <p className="text-sm text-gray-400">Belum ada laporan barang kosong.</p>}
    </section>
  </div>;
}