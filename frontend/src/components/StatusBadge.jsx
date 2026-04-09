const STYLES = {
  open:       'bg-blue-100 text-blue-800',
  active:     'bg-green-100 text-green-800',
  escalated:  'bg-orange-100 text-orange-800',
  resolved:   'bg-teal-100 text-teal-800',
  closed:     'bg-gray-100 text-gray-600',
};

const LABELS = {
  open: 'Open', active: 'Active', escalated: 'Escalated', resolved: 'Resolved', closed: 'Closed',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status] || 'bg-gray-100 text-gray-600'}`}>
      {LABELS[status] || status}
    </span>
  );
}
