import { useQuery } from '@tanstack/react-query';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import api from '../api/client';

export default function RightsPanel({ jurisdiction, caseType }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['rights', jurisdiction, caseType],
    queryFn: () => api.get(`/rights/${jurisdiction}/${caseType}`).then(r => r.data),
    staleTime: Infinity,
  });

  if (isLoading) return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
      Loading guidance...
    </div>
  );

  if (isError) return (
    <div className="text-sm text-gray-400 py-4">No rights content available for this case type.</div>
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900 text-sm">Your Rights & Guidance</h3>
        {data.fallback && (
          <span className="text-xs text-gray-400">(generic)</span>
        )}
      </div>
      <div
        className="prose-rights"
        dangerouslySetInnerHTML={{ __html: data.html }}
      />
    </div>
  );
}
