import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  TruckIcon, ShoppingBagIcon, ShieldCheckIcon,
  HomeModernIcon, BanknotesIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline';
import api from '../api/client';

const CASE_TYPES = [
  { value: 'road_traffic',     label: 'Road Traffic Accident',  icon: TruckIcon,         desc: 'Personal injury, vehicle damage, insurance claims after an accident' },
  { value: 'consumer',         label: 'Consumer Rights',        icon: ShoppingBagIcon,   desc: 'Faulty goods, poor service, refund disputes' },
  { value: 'insurance',        label: 'Insurance Claim',        icon: ShieldCheckIcon,   desc: 'Home, travel, health, or vehicle insurance disputes' },
  { value: 'landlord_tenant',  label: 'Landlord / Tenant',      icon: HomeModernIcon,    desc: 'Deposits, repairs, eviction, tenancy agreement issues' },
  { value: 'financial',        label: 'Financial Complaint',    icon: BanknotesIcon,     desc: 'Bank, credit card, energy supplier, or lender disputes' },
  { value: 'generic',          label: 'Other / Custom',         icon: DocumentTextIcon,  desc: 'Any other dispute that doesn\'t fit the categories above' },
];

const PRIORITIES = [
  { value: 'urgent',   label: 'Urgent',   desc: 'Time-sensitive, deadline imminent' },
  { value: 'standard', label: 'Standard', desc: 'Normal progress' },
  { value: 'low',      label: 'Low',      desc: 'No immediate deadline' },
];

export default function CaseNew() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    type: '', title: '', description: '', priority: 'standard', jurisdiction: 'uk',
    opposing_party_name: '', opposing_party_address: '', opposing_party_phone: '',
    opposing_party_email: '', opposing_party_ref: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => api.post('/cases', form),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(`Case ${data.reference} created`);
      navigate(`/cases/${data.id}`);
    },
    onError: err => toast.error(err.response?.data?.error || 'Failed to create case'),
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Case</h1>
        <p className="text-sm text-gray-500 mt-1">Step {step} of 3</p>
        {/* Progress bar */}
        <div className="mt-3 flex gap-1">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800">What type of case is this?</h2>
          <div className="grid gap-3">
            {CASE_TYPES.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => { set('type', t.value); setStep(2); }}
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all hover:border-blue-400 hover:bg-blue-50 ${
                    form.type === t.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <Icon className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{t.label}</p>
                    <p className="text-sm text-gray-500">{t.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <h2 className="font-semibold text-gray-800">Case details</h2>
          <div>
            <label className="label">Case title <span className="text-red-500">*</span></label>
            <input className="input" placeholder="e.g. Faulty laptop from Currys — refund refused"
              value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[100px] resize-y"
              placeholder="Brief summary of the dispute..."
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label} — {p.desc}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Jurisdiction</label>
              <select className="input" value={form.jurisdiction} onChange={e => set('jurisdiction', e.target.value)}>
                <option value="uk">United Kingdom</option>
                <option value="us">United States</option>
                <option value="eu">European Union</option>
                <option value="au">Australia</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button className="btn-primary flex-1 justify-center"
              disabled={!form.title.trim()}
              onClick={() => setStep(3)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="font-semibold text-gray-800">Opposing party</h2>
            <p className="text-sm text-gray-500">The company or person you're disputing with. All optional.</p>
          </div>
          <div>
            <label className="label">Name</label>
            <input className="input" placeholder="e.g. Currys plc / DHL Express" value={form.opposing_party_name}
              onChange={e => set('opposing_party_name', e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Their reference number</label>
              <input className="input" placeholder="e.g. CL-2024-98765" value={form.opposing_party_ref}
                onChange={e => set('opposing_party_ref', e.target.value)} />
            </div>
            <div>
              <label className="label">Their phone</label>
              <input className="input" placeholder="e.g. 0800 000 000" value={form.opposing_party_phone}
                onChange={e => set('opposing_party_phone', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Their email</label>
            <input className="input" type="email" placeholder="complaints@company.com" value={form.opposing_party_email}
              onChange={e => set('opposing_party_email', e.target.value)} />
          </div>
          <div>
            <label className="label">Their address</label>
            <textarea className="input resize-none" rows={2} placeholder="Registered address..."
              value={form.opposing_party_address} onChange={e => set('opposing_party_address', e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setStep(2)}>Back</button>
            <button className="btn-primary flex-1 justify-center"
              disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Creating...' : 'Create Case'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
