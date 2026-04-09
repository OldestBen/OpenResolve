import { useState } from 'react';
import { ScaleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      // Don't call navigate() here. AppRoutes already has:
      //   user ? <Navigate to="/" replace /> : <Login />
      // When setUser() fires inside login(), AppRoutes re-renders and
      // redirects automatically — no race against React's state flush.
    } catch {
      toast.error('Invalid username or password');
      setLoading(false); // only reset on failure; on success the component unmounts
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-blue-600 rounded-xl p-2">
            <ScaleIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">OpenResolve</h1>
            <p className="text-xs text-gray-500">Self-hosted case management</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary w-full justify-center mt-2" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
