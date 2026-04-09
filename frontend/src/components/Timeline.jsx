import { format, parseISO } from 'date-fns';
import {
  ChatBubbleLeftIcon, PhoneIcon, DocumentIcon, EnvelopeIcon,
  ArrowPathIcon, BellIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline';

const EVENT_CONFIG = {
  note:           { icon: ChatBubbleLeftIcon, color: 'text-blue-600 bg-blue-50',   label: 'Note' },
  call:           { icon: PhoneIcon,          color: 'text-green-600 bg-green-50', label: 'Call' },
  document:       { icon: DocumentIcon,       color: 'text-purple-600 bg-purple-50', label: 'Document' },
  email:          { icon: EnvelopeIcon,       color: 'text-orange-600 bg-orange-50', label: 'Email' },
  status_change:  { icon: ArrowPathIcon,      color: 'text-gray-600 bg-gray-100',  label: 'Status' },
  reminder_set:   { icon: BellIcon,           color: 'text-yellow-600 bg-yellow-50', label: 'Reminder' },
  reminder_done:  { icon: CheckCircleIcon,    color: 'text-teal-600 bg-teal-50',   label: 'Done' },
};

function fmt(iso) {
  try {
    return format(parseISO(iso), 'd MMM yyyy, HH:mm');
  } catch {
    return iso;
  }
}

function CallMeta({ meta }) {
  if (!meta) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
      {meta.caller_name && <span>Caller: <strong>{meta.caller_name}</strong></span>}
      {meta.caller_number && <span>Number: {meta.caller_number}</span>}
      {meta.duration_minutes && <span>Duration: {meta.duration_minutes} min</span>}
      {meta.outcome && <span>Outcome: <strong>{meta.outcome}</strong></span>}
      {meta.follow_up_required && (
        <span className="text-orange-600 font-medium">Follow-up required</span>
      )}
    </div>
  );
}

function EmailMeta({ meta }) {
  if (!meta) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
      {meta.from && <span>From: <strong>{meta.from}</strong></span>}
      {meta.subject && <span>Subject: {meta.subject}</span>}
      {meta.date_sent && <span>Sent: {fmt(meta.date_sent)}</span>}
      {meta.source === 'alias' && <span className="text-blue-600">via email alias</span>}
    </div>
  );
}

function DocumentMeta({ meta }) {
  if (!meta) return null;
  return (
    <div className="mt-1 flex gap-3 text-xs text-gray-500">
      {meta.doc_type && <span className="capitalize">{meta.doc_type}</span>}
      {meta.size && <span>{(meta.size / 1024).toFixed(1)} KB</span>}
    </div>
  );
}

export default function Timeline({ events }) {
  if (!events?.length) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">No events yet. Use the actions above to start building your case file.</p>
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {events.map((ev, idx) => {
        const cfg = EVENT_CONFIG[ev.event_type] || { icon: ChatBubbleLeftIcon, color: 'text-gray-600 bg-gray-100', label: ev.event_type };
        const Icon = cfg.icon;
        const isLast = idx === events.length - 1;

        return (
          <li key={ev.id} className="flex gap-4">
            {/* Icon + line */}
            <div className="flex flex-col items-center">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${cfg.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              {!isLast && <div className="flex-1 w-px bg-gray-200 my-1" />}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-6 ${isLast ? 'pb-2' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cfg.label}</span>
                  </div>
                  {ev.body && (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{ev.body}</p>
                  )}
                  {ev.event_type === 'call' && <CallMeta meta={ev.metadata} />}
                  {ev.event_type === 'email' && <EmailMeta meta={ev.metadata} />}
                  {ev.event_type === 'document' && <DocumentMeta meta={ev.metadata} />}
                </div>
                <time className="text-xs text-gray-400 whitespace-nowrap shrink-0 pt-0.5">{fmt(ev.created_at)}</time>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
