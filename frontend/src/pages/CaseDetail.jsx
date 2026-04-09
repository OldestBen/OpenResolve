import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isPast } from 'date-fns';
import toast from 'react-hot-toast';
import {
  ChatBubbleLeftIcon, PhoneIcon, DocumentIcon, EnvelopeIcon,
  BellIcon, ShieldCheckIcon, ArrowDownTrayIcon, PencilSquareIcon,
  CheckCircleIcon, TrashIcon, ArrowLeftIcon, EllipsisVerticalIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import Timeline from '../components/Timeline';
import RightsPanel from '../components/RightsPanel';
import AddNote from '../components/modals/AddNote';
import AddCallNote from '../components/modals/AddCallNote';
import AddDocument from '../components/modals/AddDocument';
import AddReminder from '../components/modals/AddReminder';
import AddEmail from '../components/modals/AddEmail';

const TYPE_LABELS = {
  road_traffic: 'Road Traffic Accident', consumer: 'Consumer Rights',
  insurance: 'Insurance Claim', landlord_tenant: 'Landlord / Tenant',
  financial: 'Financial Complaint', generic: 'General',
};

const STATUSES = ['open', 'active', 'escalated', 'resolved', 'closed'];

function ActionButton({ icon: Icon, label, onClick, variant = 'secondary' }) {
  return (
    <button onClick={onClick} className={`btn-${variant} text-xs`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="py-2 border-b border-gray-100 last:border-0">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 break-words">{value}</p>
    </div>
  );
}

function ReminderItem({ reminder, caseId }) {
  const qc = useQueryClient();
  const overdue = !reminder.completed && isPast(parseISO(reminder.due_at));

  const complete = useMutation({
    mutationFn: () => api.patch(`/reminders/${caseId}/${reminder.id}`, { completed: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders', caseId] });
      qc.invalidateQueries({ queryKey: ['events', caseId] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Reminder marked complete');
    },
  });

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
      reminder.completed ? 'bg-gray-50 border-gray-100 opacity-60' :
      overdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
    }`}>
      <button onClick={() => !reminder.completed && complete.mutate()}
        disabled={reminder.completed || complete.isPending}
        className={`mt-0.5 flex-shrink-0 rounded-full border-2 w-4 h-4 flex items-center justify-center transition-colors ${
          reminder.completed ? 'border-teal-400 bg-teal-100' :
          'border-gray-400 hover:border-blue-500 hover:bg-blue-50'
        }`}>
        {reminder.completed && <CheckCircleIcon className="w-3 h-3 text-teal-600" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${reminder.completed ? 'line-through text-gray-400' : overdue ? 'text-red-800' : 'text-gray-900'}`}>
          {reminder.title}
        </p>
        <p className={`text-xs mt-0.5 ${overdue && !reminder.completed ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
          {reminder.completed ? 'Completed' : (overdue ? 'Overdue — ' : 'Due ')}
          {format(parseISO(reminder.due_at), 'd MMM yyyy, HH:mm')}
        </p>
        {reminder.description && <p className="text-xs text-gray-500 mt-0.5">{reminder.description}</p>}
      </div>
    </div>
  );
}

function DocumentItem({ doc, caseId }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.delete(`/documents/${caseId}/${doc.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', caseId] });
      qc.invalidateQueries({ queryKey: ['events', caseId] });
      toast.success('Document deleted');
    },
  });

  const DOC_TYPE_COLORS = {
    evidence: 'bg-blue-100 text-blue-700', correspondence: 'bg-purple-100 text-purple-700',
    medical: 'bg-red-100 text-red-700', legal: 'bg-yellow-100 text-yellow-700',
    other: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
      <DocumentIcon className="w-8 h-8 text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${DOC_TYPE_COLORS[doc.doc_type] || DOC_TYPE_COLORS.other}`}>
            {doc.doc_type}
          </span>
          {doc.size && <span className="text-xs text-gray-400">{(doc.size / 1024).toFixed(0)} KB</span>}
          <span className="text-xs text-gray-400">{format(parseISO(doc.uploaded_at), 'd MMM yyyy')}</span>
        </div>
        {doc.description && <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>}
      </div>
      <div className="flex gap-1">
        <a href={`/api/documents/${caseId}/${doc.id}/download`}
          className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
          title="Download">
          <ArrowDownTrayIcon className="w-4 h-4" />
        </a>
        <button onClick={() => { if (confirm('Delete this document?')) remove.mutate(); }}
          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
          title="Delete">
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('timeline');
  const [editingStatus, setEditingStatus] = useState(false);

  const { data: c, isLoading } = useQuery({
    queryKey: ['case', id],
    queryFn: () => api.get(`/cases/${id}`).then(r => r.data),
  });

  const { data: events } = useQuery({
    queryKey: ['events', id],
    queryFn: () => api.get(`/events/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: documents } = useQuery({
    queryKey: ['documents', id],
    queryFn: () => api.get(`/documents/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: reminders } = useQuery({
    queryKey: ['reminders', id],
    queryFn: () => api.get(`/reminders/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: status => api.patch(`/cases/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case', id] });
      qc.invalidateQueries({ queryKey: ['events', id] });
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      setEditingStatus(false);
      toast.success('Status updated');
    },
  });

  const deleteCase = useMutation({
    mutationFn: () => api.delete(`/cases/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases'] });
      toast.success('Case deleted');
      navigate('/cases');
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  if (!c) return <div className="p-6 text-gray-500">Case not found.</div>;

  const overdueCount = reminders?.filter(r => !r.completed && isPast(parseISO(r.due_at))).length || 0;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start gap-4 mb-3">
            <Link to="/cases" className="btn-ghost p-1.5 mt-0.5 text-gray-400">
              <ArrowLeftIcon className="w-4 h-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 truncate">{c.title}</h1>
                <PriorityBadge priority={c.priority} />
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="font-mono text-xs text-gray-400">{c.reference}</span>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-500">{TYPE_LABELS[c.type] || c.type}</span>
                {c.opposing_party_name && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-500">vs {c.opposing_party_name}</span>
                  </>
                )}
                <span className="text-gray-300">·</span>
                {editingStatus ? (
                  <select className="input py-0.5 text-xs w-auto"
                    value={c.status}
                    onChange={e => updateStatus.mutate(e.target.value)}
                    onBlur={() => setEditingStatus(false)}
                    autoFocus>
                    {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                ) : (
                  <button onClick={() => setEditingStatus(true)} className="flex items-center gap-1 group">
                    <StatusBadge status={c.status} />
                    <ChevronDownIcon className="w-3 h-3 text-gray-300 group-hover:text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <ActionButton icon={ChatBubbleLeftIcon} label="Add Note" onClick={() => setModal('note')} />
            <ActionButton icon={PhoneIcon} label="Add Call" onClick={() => setModal('call')} />
            <ActionButton icon={DocumentIcon} label="Add Document" onClick={() => setModal('doc')} />
            <ActionButton icon={BellIcon} label="Add Reminder" onClick={() => setModal('reminder')} />
            <ActionButton icon={EnvelopeIcon} label="Log Email" onClick={() => setModal('email')} />
            <div className="flex-1" />
            <a href={`/api/export/${id}/pdf`}
              className="btn-secondary text-xs"
              target="_blank" rel="noreferrer">
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />
              PDF
            </a>
            <a href={`/api/export/${id}/zip`}
              className="btn-secondary text-xs"
              target="_blank" rel="noreferrer">
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />
              ZIP
            </a>
            <button onClick={() => { if (confirm(`Delete case ${c.reference}? This cannot be undone.`)) deleteCase.mutate(); }}
              className="btn-ghost text-xs text-red-500 hover:text-red-700 hover:bg-red-50">
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-6 flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <div className="flex gap-1 mb-5 border-b border-gray-200">
            {[
              { key: 'timeline', label: 'Timeline' },
              { key: 'documents', label: `Documents${documents?.length ? ` (${documents.length})` : ''}` },
              { key: 'reminders', label: `Reminders${overdueCount ? ` (${overdueCount} overdue)` : reminders?.length ? ` (${reminders.length})` : ''}` },
              { key: 'rights', label: 'Rights & Guidance' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.key
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'timeline' && <Timeline events={events} />}

          {tab === 'documents' && (
            <div className="space-y-3">
              <button className="btn-primary text-sm" onClick={() => setModal('doc')}>
                <DocumentIcon className="w-4 h-4" />
                Upload Document
              </button>
              {!documents?.length ? (
                <p className="text-gray-400 text-sm py-8 text-center">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => <DocumentItem key={doc.id} doc={doc} caseId={id} />)}
                </div>
              )}
            </div>
          )}

          {tab === 'reminders' && (
            <div className="space-y-3">
              <button className="btn-primary text-sm" onClick={() => setModal('reminder')}>
                <BellIcon className="w-4 h-4" />
                Add Reminder
              </button>
              {!reminders?.length ? (
                <p className="text-gray-400 text-sm py-8 text-center">No reminders set.</p>
              ) : (
                <div className="space-y-2">
                  {reminders.map(r => <ReminderItem key={r.id} reminder={r} caseId={id} />)}
                </div>
              )}
            </div>
          )}

          {tab === 'rights' && (
            <div className="card p-5">
              <RightsPanel jurisdiction={c.jurisdiction} caseType={c.type} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-64 shrink-0 hidden xl:block space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Case Info</h3>
            <InfoRow label="Reference" value={c.reference} />
            <InfoRow label="Opened" value={c.created_at ? format(parseISO(c.created_at), 'd MMM yyyy') : null} />
            <InfoRow label="Jurisdiction" value={c.jurisdiction?.toUpperCase()} />
            {c.description && <InfoRow label="Description" value={c.description} />}
            {c.email_alias && (
              <div className="py-2 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Email Alias</p>
                <p className="text-xs text-blue-700 font-mono break-all">{c.email_alias}</p>
              </div>
            )}
          </div>

          {(c.opposing_party_name || c.opposing_party_phone || c.opposing_party_email) && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Opposing Party</h3>
              <InfoRow label="Name" value={c.opposing_party_name} />
              <InfoRow label="Reference" value={c.opposing_party_ref} />
              <InfoRow label="Phone" value={c.opposing_party_phone} />
              <InfoRow label="Email" value={c.opposing_party_email} />
              <InfoRow label="Address" value={c.opposing_party_address} />
            </div>
          )}

          {overdueCount > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4">
              <p className="text-sm font-semibold text-red-800">{overdueCount} overdue reminder{overdueCount > 1 ? 's' : ''}</p>
              <button onClick={() => setTab('reminders')} className="text-xs text-red-600 hover:underline mt-1">
                View reminders
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Modals */}
      {modal === 'note'     && <AddNote     caseId={id} onClose={() => setModal(null)} />}
      {modal === 'call'     && <AddCallNote caseId={id} onClose={() => setModal(null)} />}
      {modal === 'doc'      && <AddDocument caseId={id} onClose={() => setModal(null)} />}
      {modal === 'reminder' && <AddReminder caseId={id} onClose={() => setModal(null)} />}
      {modal === 'email'    && <AddEmail    caseId={id} emailAlias={c.email_alias} onClose={() => setModal(null)} />}
    </div>
  );
}
