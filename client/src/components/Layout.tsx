import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: JSX.Element;
}

const iconClass = 'w-6 h-6';

const icons = {
  inputHarian: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 9h18M9 14l2 2 4-4" />
    </svg>
  ),
  uploadBon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
      <path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3" />
    </svg>
  ),
  tagihan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </svg>
  ),
  laporan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" />
      <rect x="12" y="8" width="3" height="10" />
      <rect x="17" y="4" width="3" height="14" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6" />
    </svg>
  ),
};

const cashierLinks: NavItem[] = [
  { to: '/input-harian', label: 'Harian', icon: icons.inputHarian },
  { to: '/upload-bon', label: 'Bon', icon: icons.uploadBon },
  { to: '/tagihan', label: 'Tagihan', icon: icons.tagihan },
  { to: '/barang-kosong', label: 'Kosong', icon: icons.tagihan },
];

const adminLinks: NavItem[] = [
  { to: '/laporan', label: 'Laporan', icon: icons.laporan },
  { to: '/tagihan', label: 'Tagihan', icon: icons.tagihan },
  { to: '/input-harian', label: 'Harian', icon: icons.inputHarian },
  { to: '/upload-bon', label: 'Bon', icon: icons.uploadBon },
  { to: '/users', label: 'Setting', icon: icons.users },
  { to: '/notifikasi', label: 'Notif', icon: icons.bell },
];

interface NotificationItem {
  id: string;
  judul: string;
  pesan: string;
  dibacaAt: string | null;
  createdAt: string;
  tujuan: string;
}

function decodeVapidKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user?.role === 'ADMIN' ? adminLinks : cashierLinks;
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  );
  const [pushRegistered, setPushRegistered] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const notificationInitialized = useRef(false);

  async function loadNotifications() {
    try {
      const { data } = await api.get<NotificationItem[]>('/notifications');
      const previous = localStorage.getItem('last-notification-id');
      if (notificationInitialized.current && data.length > 0 && data[0].id !== previous && notificationPermission === 'granted' && typeof Notification !== 'undefined') {
        const newest = previous ? data.find((item) => item.id === data[0].id) : null;
        if (newest) new Notification(newest.judul, { body: newest.pesan, icon: '/icons/icon-192.png', tag: newest.id });
      }
      if (data[0]) localStorage.setItem('last-notification-id', data[0].id);
      setNotifications(data);
    } catch {
      setNotifications([]);
    }
  }

  useEffect(() => {
    loadNotifications();
    notificationInitialized.current = true;
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [notificationPermission]);

  async function enableDeviceNotifications() {
    setNotificationError('');
    if (typeof Notification === 'undefined') {
      setNotificationError('Browser ini tidak mendukung notifikasi perangkat.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission !== 'granted') setNotificationError('Izin notifikasi belum diberikan.');
    if (permission !== 'granted') return;

    try {
      const { data } = await api.get<{ publicKey: string | null }>('/notifications/vapid-public-key');
      if (!data.publicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setNotificationError('Web Push belum dikonfigurasi di server.');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(data.publicKey),
      });
      await api.post('/notifications/subscribe', subscription.toJSON());
      setPushRegistered(true);
    } catch {
      setNotificationError('Gagal mendaftarkan perangkat untuk notifikasi push.');
    }
  }

  async function openNotification(id: string) {
    const target = notifications.find((item) => item.id === id)?.tujuan || '/notifikasi';
    await api.patch(`/notifications/${id}/read`);
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, dibacaAt: new Date().toISOString() } : item)));
    setShowNotifications(false);
    navigate(target);
  }

  const unreadCount = notifications.filter((item) => !item.dibacaAt).length;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-brand text-white px-4 py-3 flex items-center justify-between shadow">
        <div>
          <p className="font-semibold leading-tight">Toko Amelia Jaya</p>
          <p className="text-xs opacity-90 leading-tight">{user?.name} · {user?.role === 'ADMIN' ? 'Administrator' : 'Kasir'}</p>
        </div>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            title="Notifikasi"
            aria-label="Notifikasi"
            onClick={() => setShowNotifications((value) => !value)}
            className="relative p-2 rounded-md hover:bg-white/20"
          >
            {icons.bell}
            {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          {showNotifications && (
            <div className="absolute right-10 top-11 z-30 w-72 max-w-[calc(100vw-2rem)] bg-white text-gray-800 rounded-lg shadow-lg border p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <p className="font-semibold text-sm">Notifikasi</p>
                {user?.role === 'ADMIN' && <button type="button" className="text-xs text-brand" onClick={() => navigate('/notifikasi')}>Lihat semua</button>}
              </div>
              {notificationPermission !== 'granted' || !pushRegistered ? (
                <button type="button" onClick={enableDeviceNotifications} className="w-full text-left text-xs text-brand bg-green-50 rounded-md px-2 py-2 mb-1">
                  {notificationPermission === 'granted' ? 'Daftarkan Notifikasi Push' : 'Aktifkan Notifikasi Perangkat'}
                </button>
              ) : null}
              {notificationError && <p className="text-xs text-red-600 px-2 pb-1">{notificationError}</p>}
              <div className="max-h-64 overflow-y-auto">
                {notifications.slice(0, 5).map((item) => (
                  <button key={item.id} type="button" onClick={() => openNotification(item.id)} className={`w-full text-left p-2 rounded-md ${item.dibacaAt ? '' : 'bg-amber-50'}`}>
                    <p className="text-sm font-medium truncate">{item.judul}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{item.pesan}</p>
                  </button>
                ))}
                {notifications.length === 0 && <p className="text-xs text-gray-400 px-2 py-3">Belum ada notifikasi.</p>}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            title="Keluar"
            aria-label="Keluar"
            className="p-2 rounded-md bg-white/20 hover:bg-white/30"
          >
            {icons.logout}
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 pb-24 max-w-2xl w-full mx-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-1.5 max-w-2xl mx-auto w-full shadow-[0_-2px_6px_rgba(0,0,0,0.06)]">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 rounded-md ${isActive ? 'text-brand' : 'text-gray-400'}`
            }
          >
            {link.icon}
            <span className="text-[10px] leading-none">{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
