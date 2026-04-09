import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO, isPast } from 'date-fns';
import {
  FolderOpenIcon, BellAlertIcon, PlusCircleIcon,
  ClockIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';

const TYPE_LABELS = {
  road_traffic: 'Road Traffic', consumer: 'Consumer Rights',
  insurance: 'Insurance', landlord_tenant: 'Landlord/Tenant',
  financial: 'Financial', generic: 'General',
};

const EVENT_LABELS = {
  note: 'Note added', call: 'Call logged', document: 'Document uploaded',
  email: 'Email logged', status_change: 'Status changed',
  reminder_set: 'Reminder set', reminder_done: 'Reminder completed',
};

function StatCard({ label, value, icon: Icon, colorClass }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/cases/stats').then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: cases } = useQuery({
    queryKey: ['cases'],
    queryFn: () => api.get('/cases').then(r => r.data),
  });

  const { data: overdue } = useQuery({
    queryKey: ['overdue'],
    queryFn: () => api.get('/reminders').then(r => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  const openCases = cases?.filter(c => !['resolved', 'closed'].includes(c.status)) || [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), 'EEEE d MMMM yyyy')}</p>
        </div>
        <Link to="/cases/new" className="btn-primary">
          <PlusCircleIcon className="w-4 h-4" />
          New Case
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Open cases" value={stats?.total ?? 0} icon={FolderOpenIcon} colorClass="bg-blue-100 text-blue-600" />
        <StatCard label="Overdue reminders" value={overdue?.length ?? 0} icon={BellAlertIcon}
          colorClass={overdue?.length ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'} />
        <StatCard label="Escalated" value={stats?.byStatus?.find(s => s.status === 'escalated')?.n ?? 0}
          icon={ClockIcon} colorClass="bg-orange-100 text-orange-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Open Cases */}
        <div className="lg:col-span-2 card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Open Cases</h2>
            <Link to="/cases" className="text-sm text-blue-600 hover:text-blue-700">View all</Link>
          </div>
          {openCases.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No open cases. <Link to="/cases/new" className="text-blue-600 hover:underline">Create one</Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {openCases.slice(0, 6).map(c => (
                <li key={c.id}>
                  <Link to={`/cases/${c.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm truncate">{c.title}</span>
                        <StatusBadge status={c.status} />
                        <PriorityBadge priority={c.priority} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.reference} · {TYPE_LABELS[c.type] || c.type}
                        {c.opposing_party_name && ` · ${c.opposing_party_name}`}
                      </p>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-gray-300 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          {/* Overdue Reminders */}
          {overdue?.length > 0 && (
            <div className="card">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <BellAlertIcon className="w-4 h-4 text-red-500" />
                <h2 className="font-semibold text-gray-900">Overdue Reminders</h2>
              </div>
              <ul className="divide-y divide-gray-50">
                {overdue.slice(0, 5).map(r => (
                  <li key={r.id}>
                    <Link to={`/cases/${r.case_id}`} className="block px-5 py-3 hover:bg-gray-50 transition-colors">
                      <p className="text-sm font-medium text-red-700 truncate">{r.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{r.case_reference} · Due {format(parseISO(r.due_at), 'd MMM')}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent Activity */}
          <div className="card">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Recent Activity</h2>
            </div>
            {!stats?.recentEvents?.length ? (
              <p className="px-5 py-4 text-sm text-gray-400">No recent activity.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {stats.recentEvents.slice(0, 6).map(ev => (
                  <li key={ev.id}>
                    <Link to={`/cases/${ev.case_id}`} className="block px-5 py-3 hover:bg-gray-50 transition-colors">
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {EVENT_LABELS[ev.event_type] || ev.event_type}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{ev.case_reference}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
