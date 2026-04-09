import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import api from '../../api/client';
import Modal from './Modal';

const DOC_TYPES = [
  { value: 'evidence', label: 'Evidence' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'medical', label: 'Medical' },
  { value: 'legal', label: 'Legal' },
  { value: 'other', label: 'Other' },
];

export default function AddDocument({ caseId, onClose }) {
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState('other');
  const [description, setDescription] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', docType);
      fd.append('description', description);
      return api.post(`/documents/${caseId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', caseId] });
      qc.invalidateQueries({ queryKey: ['documents', caseId] });
      qc.invalidateQueries({ queryKey: ['cases'] });
      toast.success('Document uploaded');
      onClose();
    },
    onError: err => toast.error(err.response?.data?.error || 'Upload failed'),
  });

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  function formatBytes(b) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <Modal title="Add Document" onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current.click()}
        >
          <ArrowUpTrayIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          {file ? (
            <div>
              <p className="font-medium text-gray-900 text-sm">{file.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatBytes(file.size)}</p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600">Drop a file here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">PDF, images, Word docs — max 50 MB</p>
            </div>
          )}
          <input ref={fileRef} type="file" className="hidden"
            onChange={e => setFile(e.target.files[0])} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Document type</label>
            <select className="input" value={docType} onChange={e => setDocType(e.target.value)}>
              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <input className="input" placeholder="e.g. Hospital discharge letter"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!file || mutation.isPending}
            onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
