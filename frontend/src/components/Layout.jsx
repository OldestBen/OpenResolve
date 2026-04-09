import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  HomeIcon, FolderOpenIcon, PlusCircleIcon,
  ArrowRightOnRectangleIcon, ScaleIcon,
} from '@heroicons/react/24/outline';

function NavItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <Icon className="w-5 h-5 shrink-0" />
      {label}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-200">
          <ScaleIcon className="w-6 h-6 text-blue-600" />
          <span className="font-bold text-lg text-gray-900">OpenResolve</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          <NavItem to="/" end icon={HomeIcon} label="Dashboard" />
          <NavItem to="/cases" icon={FolderOpenIcon} label="All Cases" />
          <NavItem to="/cases/new" icon={PlusCircleIcon} label="New Case" />
        </nav>

        {/* User */}
        <div className="p-3 border-t border-gray-200">
          <div className="text-xs text-gray-500 px-3 mb-1 truncate">{user?.username}</div>
          <button onClick={handleLogout} className="btn-ghost w-full justify-start text-red-600 hover:bg-red-50">
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
