import React, { useState } from 'react';
import { CallLogEntry, Company, Contact, Enquiry, UserProfile, Workspace, getCompanyPhones, CallStatus } from '../types';
import LeadConversionModal from './LeadConversionModal';
import { getReferenceId } from '../utils/refId';
import { canEditOrDeleteRecord, isRecordOwner } from '../utils/permissions';
import { safeUpdateDoc, safeSetDoc } from '../firebase';
import { CallLogRepository } from '../services/repositories/CallLogRepository';
import { SYSTEM_CALL_OUTCOMES, SYSTEM_CALL_STATUSES } from '../utils/defaults';
import {
  PhoneCall,
  Building2,
  User,
  Calendar,
  Clock,
  MapPin,
  FileText,
  X,
  Edit2,
  Trash2,
  PlusCircle,
  ExternalLink,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Tag,
  MessageSquare,
  Sparkles,
  Copy,
  Users,
  Check,
  Save
} from 'lucide-react';

interface CallLogDetailModalProps {
  entry: CallLogEntry | null;
  currentUser?: UserProfile | null;
  activeWorkspace?: Workspace;
  triggerToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onLeadConverted?: (updatedEntry: CallLogEntry, newCompany: Company, newContact: Contact) => void;
  onClose: () => void;
  onEdit: (entry: CallLogEntry) => void;
  onDelete: (id: string) => void;
  onOpenCompany360: (companyId: string) => void;
  onOpenEnquiry?: (enquiryId: string) => void;
  onCreateEnquiryFromCall?: (entry: CallLogEntry) => void;
  onLogFollowup?: (entry: CallLogEntry) => void;
  companies: Company[];
  contacts: Contact[];
  enquiries: Enquiry[];
  callLogs?: CallLogEntry[];
}

export default function CallLogDetailModal({
  entry,
  currentUser,
  activeWorkspace,
  triggerToast,
  onLeadConverted,
  onClose,
  onEdit,
  onDelete,
  onOpenCompany360,
  onOpenEnquiry,
  onCreateEnquiryFromCall,
  onLogFollowup,
  companies,
  contacts,
  enquiries,
  callLogs = []
}: CallLogDetailModalProps) {
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  // Inline Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editTargetType, setEditTargetType] = useState<'contact' | 'company_mainline'>('contact');
  const [editCompanyId, setEditCompanyId] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editContactId, setEditContactId] = useState('');
  const [editContactName, setEditContactName] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editStatus, setEditStatus] = useState<CallStatus>('Completed');
  const [editOutcome, setEditOutcome] = useState('');
  const [editPurpose, setEditPurpose] = useState('');
  const [editRequirementNotes, setEditRequirementNotes] = useState('');
  const [editNextFollowupDate, setEditNextFollowupDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!entry) return null;

  const linkedCompany = entry.company_id
    ? companies.find((c) => c.id === entry.company_id)
    : null;

  const linkedContact = entry.contact_id
    ? contacts.find((c) => c.id === entry.contact_id)
    : null;

  const linkedEnquiry = entry.enquiry_id
    ? enquiries.find((e) => e.id === entry.enquiry_id)
    : null;

  const startEditing = () => {
    setEditTargetType(entry.contact_id || entry.contact_name ? 'contact' : 'company_mainline');
    setEditCompanyId(entry.company_id || '');
    setEditCompanyName(entry.company_name || linkedCompany?.display_name || linkedCompany?.canonical_name || entry.unlinked_name || '');
    setEditContactId(entry.contact_id || '');
    setEditContactName(entry.contact_name || entry.unlinked_name || linkedContact?.full_name || '');
    setEditContactPhone(entry.contact_phone || entry.unlinked_contact_info || linkedContact?.mobile || linkedContact?.landline || '');
    setEditStatus(entry.status || 'Completed');
    setEditOutcome(entry.outcome || '');
    setEditPurpose(entry.purpose || 'Prospecting / Intro');
    setEditRequirementNotes(entry.requirement_notes || '');
    setEditNextFollowupDate(entry.next_followup_date || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const selectedComp = editCompanyId ? companies.find((c) => c.id === editCompanyId) : linkedCompany;
      const isCompanyMainline = editTargetType === 'company_mainline';

      const updatedEntry: CallLogEntry = {
        ...entry,
        company_id: editCompanyId || undefined,
        company_name: editCompanyName || selectedComp?.display_name || selectedComp?.canonical_name || '',
        contact_id: isCompanyMainline ? undefined : (editContactId || undefined),
        contact_name: isCompanyMainline ? '' : editContactName,
        contact_phone: editContactPhone,
        status: editStatus,
        outcome: editOutcome,
        purpose: editPurpose,
        requirement_notes: editRequirementNotes,
        next_followup_date: editNextFollowupDate || undefined,
        updatedAt: new Date().toISOString(),
        last_modified_by_name: currentUser?.full_name || 'System Operator'
      };

      if (entry.id) {
        await safeUpdateDoc('call_logs', entry.id, {
          company_id: updatedEntry.company_id || null,
          company_name: updatedEntry.company_name || null,
          contact_id: updatedEntry.contact_id || null,
          contact_name: updatedEntry.contact_name || null,
          contact_phone: updatedEntry.contact_phone || null,
          status: updatedEntry.status,
          outcome: updatedEntry.outcome || null,
          purpose: updatedEntry.purpose || null,
          requirement_notes: updatedEntry.requirement_notes || null,
          next_followup_date: updatedEntry.next_followup_date || null,
          updatedAt: updatedEntry.updatedAt,
          last_modified_by_name: updatedEntry.last_modified_by_name
        });
      }

      // Auto-Schedule Follow-Up Log if follow-up date was provided/updated
      if (editNextFollowupDate && editNextFollowupDate.trim() !== '') {
        const scheduledLogId = `act_${Date.now()}_fup_${Math.random().toString(36).substring(2, 7)}`;
        const scheduledEntry: CallLogEntry = {
          ...updatedEntry,
          id: scheduledLogId,
          date: editNextFollowupDate,
          status: 'Scheduled / Planned' as CallStatus,
          outcome: 'Follow-Up Scheduled',
          requirement_notes: '',
          next_followup_date: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await safeSetDoc('activity_logs', scheduledLogId, scheduledEntry);
        await safeSetDoc('call_logs', scheduledLogId, scheduledEntry);
        await CallLogRepository.save(scheduledEntry);
      }

      onEdit(updatedEntry);
      if (triggerToast) {
        triggerToast('Activity Log updated successfully', 'success');
      }
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update call log:', err);
      if (triggerToast) {
        triggerToast('Error saving activity log', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const getChannelBadge = (ch?: string) => {
    const channel = (ch || entry.channel || 'Call').toLowerCase();
    if (channel.includes('whatsapp') || channel === 'message') {
      return (
        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
          <span>WhatsApp</span>
        </span>
      );
    }
    if (channel.includes('email')) {
      return (
        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 shrink-0">
          <Mail className="w-3.5 h-3.5 text-purple-400" />
          <span>Email</span>
        </span>
      );
    }
    if (channel.includes('meeting')) {
      return (
        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0">
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <span>Meeting</span>
        </span>
      );
    }
    if (channel.includes('site') || channel.includes('visit')) {
      return (
        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 shrink-0">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          <span>Site Visit</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 shrink-0">
        <Phone className="w-3.5 h-3.5 text-blue-400" />
        <span>Call Log</span>
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'scheduled') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 shrink-0">
          <Clock className="w-3 h-3 text-blue-400" />
          <span>Scheduled</span>
        </span>
      );
    } else if (s === 'completed') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Completed</span>
        </span>
      );
    } else if (s === 'cancelled') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 shrink-0">
          <AlertCircle className="w-3 h-3 text-rose-400" />
          <span>Cancelled</span>
        </span>
      );
    } else {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>{status}</span>
        </span>
      );
    }
  };

  const getOutcomeBadge = (outcome?: string) => {
    if (!outcome) return null;
    const oc = outcome.toLowerCase();
    let colorClass = 'bg-slate-800 text-slate-200 border-slate-700';
    if (oc.includes('interested') || oc.includes('deal') || oc.includes('connected')) {
      colorClass = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80';
    } else if (oc.includes('quote') || oc.includes('proposal')) {
      colorClass = 'bg-blue-950/60 text-blue-300 border-blue-800/80';
    } else if (oc.includes('follow') || oc.includes('dropped')) {
      colorClass = 'bg-amber-950/60 text-amber-300 border-amber-800/80';
    } else if (oc.includes('dnc') || oc.includes('wrong') || oc.includes('dead') || oc.includes('invalid')) {
      colorClass = 'bg-rose-950/60 text-rose-300 border-rose-800/80';
    } else if (oc.includes('no answer') || oc.includes('busy') || oc.includes('unreachable') || oc.includes('disconnected')) {
      colorClass = 'bg-slate-800 text-slate-300 border-slate-700';
    }

    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${colorClass}`}>
        {outcome}
      </span>
    );
  };

  const formattedDate = entry.date
    ? new Date(entry.date).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : 'N/A';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in">
      <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-6 bg-slate-950 text-white border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  {isEditing ? 'Edit Activity Log' : 'Activity Log Profile'}
                </h2>
                <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-800 text-blue-300 border border-slate-700 flex items-center space-x-1 shrink-0">
                  <Tag className="w-2.5 h-2.5 text-blue-400" />
                  <span>REF: {getReferenceId('CL', entry, callLogs)}</span>
                </span>
                {!isEditing && getChannelBadge()}
                {!isEditing && getStatusBadge(entry.status)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Occurred on <strong className="text-slate-200">{formattedDate}</strong> &bull; Logged by <span className="font-semibold text-slate-200">{entry.logged_by || entry.created_by_name}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {isEditing ? (
          <div className="p-6 space-y-4 flex-1 overflow-y-auto">
            <div className="p-3 bg-blue-950/40 border border-blue-800/50 rounded-xl text-xs text-blue-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Modify log details below. Contact Person and Phone Number fields are completely un-restricted for direct typing and editing.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Target Company */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Target Company
                </label>
                <select
                  value={editCompanyId}
                  onChange={(e) => {
                    const compId = e.target.value;
                    setEditCompanyId(compId);
                    const comp = companies.find((c) => c.id === compId);
                    if (comp) {
                      setEditCompanyName(comp.display_name || comp.canonical_name || '');
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 font-semibold focus:border-blue-500 focus:outline-none mb-2"
                >
                  <option value="">-- Unlinked / Custom Company --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name || c.canonical_name} ({c.id})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  placeholder="Company Name / Lead Title..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Target Selection Toggle (Contact vs. Company Mainline) */}
              <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 my-1 col-span-full">
                <button
                  type="button"
                  onClick={() => setEditTargetType('contact')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    editTargetType === 'contact'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Log against Contact</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditTargetType('company_mainline');
                    setEditContactId('');
                    setEditContactName('');
                    const activeComp = editCompanyId ? companies.find((c) => c.id === editCompanyId) : linkedCompany;
                    if (activeComp) {
                      const compPhones = getCompanyPhones(activeComp);
                      if (compPhones.length > 0) {
                        setEditContactPhone(compPhones[0].number);
                      } else if (activeComp.general_phone) {
                        setEditContactPhone(activeComp.general_phone);
                      }
                    }
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    editTargetType === 'company_mainline'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Log against Company Mainline</span>
                </button>
              </div>

              {/* Contact Person */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  disabled={editTargetType === 'company_mainline'}
                  value={editTargetType === 'company_mainline' ? '' : editContactName}
                  onChange={(e) => setEditContactName(e.target.value)}
                  placeholder={editTargetType === 'company_mainline' ? 'Mainline selected (No individual contact)' : 'Type contact person name freely...'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {(() => {
                  const comp = editCompanyId ? companies.find((c) => c.id === editCompanyId) : linkedCompany;
                  const compContacts = comp ? contacts.filter((ct) => ct.company_id === comp.id) : [];
                  if (compContacts.length === 0) return null;
                  return (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-medium">Company Contacts:</span>
                      {compContacts.map((ct) => (
                        <button
                          key={ct.id}
                          type="button"
                          onClick={() => {
                            setEditContactId(ct.id || '');
                            setEditContactName(ct.full_name);
                            if (ct.mobile || ct.landline) {
                              setEditContactPhone(ct.mobile || ct.landline || '');
                            }
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                        >
                          {ct.full_name}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Phone Number Field & Company-Level Phone Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={editContactPhone}
                onChange={(e) => setEditContactPhone(e.target.value)}
                placeholder="Type phone number freely (e.g. +971 50 123 4567)..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono text-blue-300 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />

              {/* Direct Company Line Selector Pills */}
              {(() => {
                const activeComp = editCompanyId ? companies.find((c) => c.id === editCompanyId) : linkedCompany;
                const compPhones = getCompanyPhones(activeComp);
                if (compPhones.length === 0) return null;

                return (
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-300 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Select Company Phone Line:</span>
                      </span>
                      <span className="text-[10px] text-slate-400">Click to assign line</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {compPhones.map((ph, idx) => (
                        <button
                          key={`cp_edit_${idx}`}
                          type="button"
                          onClick={() => setEditContactPhone(ph.number)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-blue-200 font-mono border border-blue-800/80 transition cursor-pointer flex items-center gap-1.5 font-bold"
                          title={`Set phone number to ${ph.label || 'Company Line'}: ${ph.number}`}
                        >
                          <span className="text-slate-400 font-normal">{ph.label || 'Front Desk'}:</span>
                          <span>{ph.number}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Status, Outcome & Purpose */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as CallStatus)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 font-semibold focus:border-blue-500 focus:outline-none"
                >
                  <option value="Completed">Completed</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="No Answer">No Answer</option>
                  <option value="Busy">Busy</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Outcome / Result
                </label>
                <select
                  value={editOutcome}
                  onChange={(e) => setEditOutcome(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Select Outcome --</option>
                  {SYSTEM_CALL_OUTCOMES.map((oc) => (
                    <option key={oc} value={oc}>
                      {oc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Interaction Purpose
                </label>
                <input
                  type="text"
                  value={editPurpose}
                  onChange={(e) => setEditPurpose(e.target.value)}
                  placeholder="e.g. Prospecting / Intro..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Next Follow-Up Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span>Next Follow-Up Date</span>
                </label>
                {editNextFollowupDate && (
                  <button
                    type="button"
                    onClick={() => setEditNextFollowupDate('')}
                    className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    Clear Date
                  </button>
                )}
              </div>
              <input
                type="date"
                value={editNextFollowupDate}
                onChange={(e) => setEditNextFollowupDate(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="[color-scheme:dark] w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Requirement Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Requirement Notes &amp; Activity Log</span>
              </label>
              <textarea
                value={editRequirementNotes}
                onChange={(e) => setEditRequirementNotes(e.target.value)}
                rows={4}
                placeholder="Type detailed notes..."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-sans placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5 flex-1 overflow-y-auto">
            {/* Outcome & Purpose Banner */}
            {(entry.outcome || entry.purpose) && (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-2">
                  {entry.purpose && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Interaction Purpose
                      </span>
                      <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-950/80 text-blue-200 border border-blue-800/80">
                        {entry.purpose}
                      </span>
                    </div>
                  )}
                  {entry.outcome && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Logged Outcome / Result
                      </span>
                      <div>{getOutcomeBadge(entry.outcome)}</div>
                    </div>
                  )}
                </div>

                {entry.next_followup_date && (
                  <div className="sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                      Next Follow-Up Scheduled
                    </span>
                    <span className="text-xs font-bold text-slate-200 flex items-center sm:justify-end gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>{new Date(entry.next_followup_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Company & Contact Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Company Box */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-slate-700 transition shadow-xs group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Target Company</span>
                  </span>
                  {(() => {
                    const targetCompanyId = entry.company_id || linkedCompany?.id;
                    if (!targetCompanyId) return null;
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenCompany360) {
                            onClose();
                            onOpenCompany360(targetCompanyId);
                          }
                        }}
                        className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer hover:underline"
                        title="Open 360° Company Intelligence Dashboard"
                      >
                        <span>Company 360°</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    );
                  })()}
                </div>

                <div className="font-bold text-slate-100 text-sm">
                  {linkedCompany ? (
                    linkedCompany.display_name || linkedCompany.canonical_name
                  ) : entry.company_name ? (
                    entry.company_name
                  ) : entry.unlinked_name ? (
                    <span className="text-amber-300 font-bold">{entry.unlinked_name} <span className="text-xs font-normal text-amber-400/80">(Unsaved Lead)</span></span>
                  ) : (
                    'Unspecified Target / Lead'
                  )}
                </div>

                {!entry.company_id && (
                  <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-blue-950/80 via-indigo-950/80 to-slate-900 border border-blue-500/40 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                    <div>
                      <div className="text-xs font-bold text-blue-200 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Unsaved Lead Record</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Convert this lead into a permanent CRM Company & Contact</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConvertModal(true)}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-extrabold rounded-lg shadow-md flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <span>🚀 Convert to CRM Client</span>
                    </button>
                  </div>
                )}

                {linkedCompany && (
                  <div className="mt-2 text-xs text-slate-400 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>
                        {linkedCompany.city ? `${linkedCompany.city}, ` : ''}{linkedCompany.country}
                      </span>
                    </div>
                    {linkedCompany.general_phone && (
                      <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{linkedCompany.general_phone}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Contact Box */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-slate-700 transition shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Contact Person</span>
                </span>

                <div className="font-bold text-slate-100 text-sm">
                  {entry.contact_name || entry.unlinked_name || 'No Personnel Contact Assigned'}
                </div>

                <div className="mt-2 text-xs text-slate-300 space-y-1">
                  {(() => {
                    const phoneVal = entry.contact_phone || entry.unlinked_contact_info || linkedContact?.mobile || linkedContact?.landline;
                    const emailVal = linkedContact?.email;

                    return (
                      <>
                        {phoneVal ? (
                          <div className="flex items-center gap-1.5 font-mono text-blue-300 font-medium">
                            <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <a
                              href={`tel:${phoneVal}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline"
                            >
                              {phoneVal}
                            </a>
                          </div>
                        ) : (
                          <div className="text-slate-500 text-xs italic">No phone logged</div>
                        )}

                        {emailVal && (
                          <div className="flex items-center gap-1.5 text-slate-300 truncate">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <a
                              href={`mailto:${emailVal}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline truncate"
                            >
                              {emailVal}
                            </a>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Company Lines Selector in View Mode */}
                {(() => {
                  const companyPhones = getCompanyPhones(linkedCompany);
                  if (companyPhones.length === 0) return null;
                  return (
                    <div className="mt-3 pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] font-semibold text-slate-400 block mb-1">Company Direct Lines:</span>
                      <div className="flex flex-wrap gap-1">
                        {companyPhones.map((ph, idx) => (
                          <a
                            key={`v_cp_${idx}`}
                            href={`tel:${ph.number}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 hover:bg-blue-900 text-blue-300 font-mono border border-blue-800/60 transition flex items-center gap-1"
                            title={`Call ${ph.label || 'Company Line'}: ${ph.number}`}
                          >
                            <span className="text-slate-400 font-normal">{ph.label || 'Main'}:</span>
                            <span className="font-bold">{ph.number}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Geography & Linked Enquiry Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Geography / Region:</span>
                <span className="text-xs font-bold text-slate-200 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                  {entry.geography || 'Dubai, UAE'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Linked Proposal / Enquiry:</span>
                {entry.enquiry_quote_ref ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (entry.enquiry_id && onOpenEnquiry) {
                        onClose();
                        onOpenEnquiry(entry.enquiry_id);
                      }
                    }}
                    className="text-xs font-bold text-purple-300 hover:text-purple-200 hover:underline flex items-center gap-1 cursor-pointer font-mono"
                  >
                    <FileText className="w-3.5 h-3.5 text-purple-400" />
                    <span>{entry.enquiry_quote_ref}</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 italic">None linked</span>
                )}
              </div>
            </div>

            {/* Requirement Notes & Discussion Transcript */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Requirement Notes &amp; Activity Log</span>
              </label>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-sans whitespace-pre-wrap leading-relaxed min-h-[90px]">
                {entry.requirement_notes || (
                  <span className="text-slate-500 italic">No detailed notes logged for this interaction.</span>
                )}
              </div>
            </div>

            {/* AI Executive Summary Preview */}
            {entry.ai_summary && (
              <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/50 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>AI Executive Summary</span>
                </div>
                <p className="text-xs text-blue-100/90 leading-relaxed whitespace-pre-wrap">{entry.ai_summary}</p>
              </div>
            )}

            {/* WhatsApp Message Draft Preview */}
            {entry.whatsapp_draft && (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>WhatsApp Draft Preview</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(entry.whatsapp_draft!);
                      setCopiedDraft(true);
                      setTimeout(() => setCopiedDraft(false), 2000);
                    }}
                    className="text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1"
                  >
                    {copiedDraft ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-400" />
                        <span>Copy Draft</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="text-xs text-emerald-100/90 font-sans leading-relaxed whitespace-pre-wrap bg-slate-950/80 p-3 rounded-lg border border-emerald-900/50">
                  {entry.whatsapp_draft}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full Audit Metadata Footer */}
        <div className="px-6 py-2.5 bg-slate-950/90 border-t border-slate-800/80 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 text-slate-500" />
              <span>Logged by: <strong className="text-slate-200">{entry.logged_by || entry.created_by_name || 'System'}</strong></span>
            </span>
            {entry.sales_person && (
              <span className="text-slate-500">&bull; Rep: <strong className="text-slate-300">{entry.sales_person}</strong></span>
            )}
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400">
            {entry.createdAt && (
              <span>Created: {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            )}
            {entry.last_modified_by_name && (
              <span>Modified by: <strong className="text-slate-300">{entry.last_modified_by_name}</strong></span>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {isEditing ? (
            <div className="flex items-center justify-end space-x-2 ml-auto">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Activity Log'}</span>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                {!entry.company_id && (
                  <button
                    type="button"
                    onClick={() => setShowConvertModal(true)}
                    className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-md transition cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>🚀 Convert to CRM Client</span>
                  </button>
                )}

                {onCreateEnquiryFromCall && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onCreateEnquiryFromCall(entry);
                    }}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>+ Convert to Proposal</span>
                  </button>
                )}

                {onLogFollowup && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLogFollowup(entry);
                    }}
                    className="px-3.5 py-2 bg-blue-950/80 hover:bg-blue-900 text-blue-200 border border-blue-800/80 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span>Schedule Follow-Up</span>
                  </button>
                )}
              </div>

              {canEditOrDeleteRecord(currentUser, entry) && (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={startEditing}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Edit Log</span>
                  </button>

                  {entry.id && (
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(entry.id!);
                        onClose();
                      }}
                      className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-bold rounded-xl flex items-center space-x-1 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showConvertModal && activeWorkspace && (
        <LeadConversionModal
          isOpen={showConvertModal}
          onClose={() => setShowConvertModal(false)}
          entry={entry}
          activeWorkspace={activeWorkspace}
          currentUser={currentUser}
          triggerToast={triggerToast}
          onSuccess={(updatedEntry, newCompany, newContact) => {
            setShowConvertModal(false);
            if (onLeadConverted) {
              onLeadConverted(updatedEntry, newCompany, newContact);
            }
          }}
        />
      )}
    </div>
  );
}
