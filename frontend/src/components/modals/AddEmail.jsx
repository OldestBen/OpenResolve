import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../api/client';
import Modal from './Modal';

export default function AddEmail({ caseId, emailAlias, onClose }) {
  const [form, setForm] = useState({
    from: '', subject: '',
    date_sent: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    body: '',
  });
  const qc = useQueryClient();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => api.post(`/events/${caseId}/email`, {
      ...form,
      date_sent: new Date(form.date_sent).toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', caseId] });
      qc.invalidateQueries({ queryKey: ['cases'] });
      toast.success('Email logged');
      onClose();
    },
    onError: () => toast.error('Failed to log email'),
  });

  return (
    <Modal title="Log Email" onClose={onClose} size="lg">
      <div className="space-y-4">
        {emailAlias && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
            <strong>Email alias:</strong> <code className="bg-blue-100 rounded px-1">{emailAlias}</code>
            <br />
            <span className="text-blue-600 text-xs">Forward correspondence here to auto-log it, or paste below manually.</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">From</label>
            <input className="input" placeholder="sender@company.com" value={form.from}
              onChange={e => set('from', e.target.value)} />
          </div>
          <div>
            <label className="label">Date sent</label>
            <input className="input" type="datetime-local" value={form.date_sent}
              onChange={e => set('date_sent', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Subject</label>
          <input className="input" placeholder="e.g. Re: Your claim reference 12345"
            value={form.subject} onChange={e => set('subject', e.target.value)} />
        </div>
        <div>
          <label className="label">Email body <span className="text-red-500">*</span></label>
          <textarea className="input min-h-[200px] resize-y font-mono text-xs"
            placeholder="Paste the email content here..."
            value={form.body} onChange={e => set('body', e.target.value)} autoFocus />
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary"
            disabled={!form.body.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Saving...' : 'Log Email'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
