import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { MagnifyingGlassIcon, PlusCircleIcon, FunnelIcon } from '@heroicons/react/24/outline';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';

const TYPE_LABELS = {
  road_traffic: 'Road Traffic Accident', consumer: 'Consumer Rights',
  insurance: 'Insurance Claim', landlord_tenant: 'Landlord / Tenant',
  financial: 'Financial Complaint', generic: 'General',
};

const STATUSES = ['open', 'active', 'escalated', 'resolved', 'closed'];
const TYPES = Object.entries(TYPE_LABELS);

export default function CaseList() {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const params = {};
  if (statusFilter) params.status = statusFilter;
  if (typeFilter) params.type = typeFilter;
  if (q) params.q = q;

  const { data: cases, isLoading } = useQuery({
    queryKey: ['cases', params],
    queryFn: () => api.get('/cases', { params }).then(r => r.data),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">All Cases</h1>
        <Link to="/cases/new" className="btn-primary shrink-0">
          <PlusCircleIcon className="w-4 h-4" />
          New Case
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search cases..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          <select className="input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
          <select className="input w-auto" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : cases?.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 mb-4">No cases found.</p>
          <Link to="/cases/new" className="btn-primary inline-flex">
            <PlusCircleIcon className="w-4 h-4" />
            Create your first case
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Reference</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Type</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Priority</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cases.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/cases/${c.id}`} className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline">
                      {c.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/cases/${c.id}`} className="font-medium text-gray-900 hover:text-blue-700">
                      {c.title}
                    </Link>
                    {c.opposing_party_name && (
                      <p className="text-xs text-gray-400 mt-0.5">vs {c.opposing_party_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">{TYPE_LABELS[c.type] || c.type}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs">
                    {format(parseISO(c.updated_at), 'd MMM yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
