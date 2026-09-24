import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';

interface NotificationItem {
  id: string;
  judul: string;
  pesan: string;
  dibacaAt: string | null;
  createdAt: string;
  tujuan: string;
}

interface UserItem {
  id: string;
  name: string;
  username: string;
  role: 'ADMIN' | 'CASHIER';
}

function formatTanggal(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function Notifikasi() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [judul, setJudul] = useState('');
  const [pesan, setPesan] = useState('');
  const [tujuan, setTujuan] = useState('/laporan');
  const [penerima, setPenerima] = useState('SEMUA');
  const [userId, setUserId] = useState('');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const { data } = await api.get<NotificationItem[]>('/notifications');
    setItems(data);
  }

  useEffect(() => {
    load();
    api.get<UserItem[]>('/users').then((res) => setUsers(res.data));
  }, []);

  async function send(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      const { data } = await api.post<{ count: number }>('/notifications', { judul, pesan, tujuan, penerima, userId: penerima === 'USER' ? userId : undefined });
      setJudul('');
      setPesan('');
      setMessage(`Notifikasi terkirim ke ${data.count} pengguna aktif.`);
      load();
    } catch (e: unknown) {
      const apiMessage = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(apiMessage || 'Gagal mengirim notifikasi.');
    }
  }

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-800">Kirim Notifikasi</h2>
          <p className="text-xs text-gray-500 mt-1">Pesan dikirim ke semua pengguna aktif.</p>
        </div>
        <form onSubmit={send} className="space-y-3">
          <input
            className="w-full border rounded-md px-3 py-2"
            placeholder="Judul notifikasi"
            value={judul}
            onChange={(event) => setJudul(event.target.value)}
            maxLength={120}
            required
          />
          <textarea
            className="w-full border rounded-md px-3 py-2 min-h-28 resize-y"
            placeholder="Isi notifikasi"
            value={pesan}
            onChange={(event) => setPesan(event.target.value)}
            maxLength={2000}
            required
          />
          <select className="w-full border rounded-md px-3 py-2 bg-white" value={penerima} onChange={(event) => setPenerima(event.target.value)}>
            <option value="SEMUA">Semua pengguna aktif</option>
            <option value="ADMIN">Semua admin</option>
            <option value="CASHIER">Semua kasir</option>
            <option value="USER">User tertentu</option>
          </select>
          {penerima === 'USER' && (
            <select className="w-full border rounded-md px-3 py-2 bg-white" value={userId} onChange={(event) => setUserId(event.target.value)} required>
              <option value="">Pilih user</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role === 'ADMIN' ? 'Admin' : 'Kasir'})</option>)}
            </select>
          )}
          <select className="w-full border rounded-md px-3 py-2 bg-white" value={tujuan} onChange={(event) => setTujuan(event.target.value)}>
            <option value="/laporan">Laporan</option>
            <option value="/input-harian">Input Harian</option>
            <option value="/tagihan">Tagihan</option>
            <option value="/barang-kosong">Barang Kosong</option>
            <option value="/notifikasi">Notifikasi</option>
          </select>
          <button type="submit" className="w-full bg-brand text-white rounded-md py-2 font-medium">
            Kirim ke Semua Pengguna
          </button>
        </form>
        {message && <p className="text-sm text-green-600">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h3 className="font-semibold text-gray-800">Notifikasi Terbaru</h3>
        {items.map((item) => (
          <article key={item.id} className={`border rounded-md p-3 ${item.dibacaAt ? 'bg-white' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex justify-between gap-3">
              <h4 className="font-medium text-gray-800">{item.judul}</h4>
              <time className="text-[11px] text-gray-400 whitespace-nowrap">{formatTanggal(item.createdAt)}</time>
            </div>
            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{item.pesan}</p>
            <p className="text-xs text-brand mt-1">Tujuan: {item.tujuan}</p>
          </article>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400">Belum ada notifikasi.</p>}
      </section>
    </div>
  );
}
