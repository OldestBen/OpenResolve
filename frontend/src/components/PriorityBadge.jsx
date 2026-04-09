const STYLES = {
  urgent:   'bg-red-100 text-red-800',
  standard: 'bg-gray-100 text-gray-700',
  low:      'bg-slate-100 text-slate-600',
};

export default function PriorityBadge({ priority }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STYLES[priority] || 'bg-gray-100 text-gray-700'}`}>
      {priority}
    </span>
  );
}
