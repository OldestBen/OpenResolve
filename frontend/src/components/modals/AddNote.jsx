import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../api/client';
import Modal from './Modal';

export default function AddNote({ caseId, onClose }) {
  const [body, setBody] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.post(`/events/${caseId}/note`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', caseId] });
      qc.invalidateQueries({ queryKey: ['cases'] });
      toast.success('Note added');
      onClose();
    },
    onError: () => toast.error('Failed to add note'),
  });

  return (
    <Modal title="Add Note" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Note</label>
          <textarea
            className="input min-h-[160px] resize-y"
            placeholder="Enter your note..."
            value={body}
            onChange={e => setBody(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!body.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving...' : 'Add Note'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
