import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../api/client';
import Modal from './Modal';

export default function AddCallNote({ caseId, onClose }) {
  const [form, setForm] = useState({
    caller_name: '', caller_number: '', duration_minutes: '', outcome: '',
    follow_up_required: false, notes: '',
  });
  const qc = useQueryClient();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => api.post(`/events/${caseId}/call`, {
      ...form,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', caseId] });
      qc.invalidateQueries({ queryKey: ['cases'] });
      toast.success('Call note added');
      onClose();
    },
    onError: () => toast.error('Failed to add call note'),
  });

  return (
    <Modal title="Add Call Note" onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Caller name</label>
            <input className="input" placeholder="e.g. Sarah — Claims Dept" value={form.caller_name}
              onChange={e => set('caller_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Phone number</label>
            <input className="input" placeholder="e.g. 0800 123 456" value={form.caller_number}
              onChange={e => set('caller_number', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Duration (minutes)</label>
            <input className="input" type="number" min="1" placeholder="e.g. 15" value={form.duration_minutes}
              onChange={e => set('duration_minutes', e.target.value)} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded border-gray-300 text-blue-600 h-4 w-4"
                checked={form.follow_up_required}
                onChange={e => set('follow_up_required', e.target.checked)} />
              <span className="text-sm font-medium text-gray-700">Follow-up required</span>
            </label>
          </div>
        </div>
        <div>
          <label className="label">Outcome <span className="text-red-500">*</span></label>
          <input className="input" placeholder="e.g. Claim acknowledged, awaiting decision letter"
            value={form.outcome} onChange={e => set('outcome', e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Additional notes</label>
          <textarea className="input min-h-[100px] resize-y" placeholder="Any extra context..."
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary"
            disabled={!form.outcome.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Saving...' : 'Add Call Note'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
