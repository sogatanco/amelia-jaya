import { NavLink, Outlet, useNavigate } from 'react-router-dom';
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
};

const cashierLinks: NavItem[] = [
  { to: '/input-harian', label: 'Harian', icon: icons.inputHarian },
  { to: '/upload-bon', label: 'Bon', icon: icons.uploadBon },
  { to: '/tagihan', label: 'Tagihan', icon: icons.tagihan },
];

const adminLinks: NavItem[] = [
  { to: '/laporan', label: 'Laporan', icon: icons.laporan },
  { to: '/tagihan', label: 'Tagihan', icon: icons.tagihan },
  { to: '/input-harian', label: 'Harian', icon: icons.inputHarian },
  { to: '/upload-bon', label: 'Bon', icon: icons.uploadBon },
  { to: '/users', label: 'Setting', icon: icons.users },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user?.role === 'ADMIN' ? adminLinks : cashierLinks;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-brand text-white px-4 py-3 flex items-center justify-between shadow">
        <div>
          <p className="font-semibold leading-tight">Toko Amelia Jaya</p>
          <p className="text-xs opacity-90 leading-tight">{user?.name} · {user?.role === 'ADMIN' ? 'Administrator' : 'Kasir'}</p>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="text-sm bg-white/20 px-3 py-1.5 rounded-md"
        >
          Keluar
        </button>
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
