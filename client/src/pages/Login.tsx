import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/input-harian');
    } catch {
      setError('Username atau password salah');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleSubmit} className="bg-white shadow rounded-xl p-6 w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-lg font-bold text-brand">Toko Amelia Jaya</h1>
          <p className="text-sm text-gray-500">Aplikasi Pembukuan</p>
        </div>

        <div>
          <label className="block text-sm mb-1 text-gray-700">Username</label>
          <input
            className="w-full border rounded-md px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-gray-700">Password</label>
          <input
            type="password"
            className="w-full border rounded-md px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand text-white rounded-md py-2 font-medium disabled:opacity-60"
        >
          {loading ? 'Masuk...' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}
