import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../api/client';
import Modal from './Modal';

export default function AddReminder({ caseId, onClose }) {
  const tomorrow = format(new Date(Date.now() + 86_400_000), "yyyy-MM-dd'T'HH:mm");
  const [form, setForm] = useState({ title: '', description: '', due_at: tomorrow });
  const qc = useQueryClient();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => api.post(`/reminders/${caseId}`, {
      ...form,
      due_at: new Date(form.due_at).toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', caseId] });
      qc.invalidateQueries({ queryKey: ['reminders', caseId] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Reminder set');
      onClose();
    },
    onError: () => toast.error('Failed to set reminder'),
  });

  return (
    <Modal title="Add Reminder" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Title <span className="text-red-500">*</span></label>
          <input className="input" placeholder="e.g. 30-day rejection window expires"
            value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Due date & time <span className="text-red-500">*</span></label>
          <input className="input" type="datetime-local"
            value={form.due_at} onChange={e => set('due_at', e.target.value)} />
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <textarea className="input min-h-[80px] resize-y"
            placeholder="Any extra context for this reminder..."
            value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary"
            disabled={!form.title.trim() || !form.due_at || mutation.isPending}
            onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Saving...' : 'Set Reminder'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
