import React from 'react';
import { CallLogEntry, Company, Contact, Enquiry, UserProfile } from '../types';
import { getReferenceId } from '../utils/refId';
import { canEditOrDeleteRecord, isRecordOwner } from '../utils/permissions';
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
  Tag
} from 'lucide-react';

interface CallLogDetailModalProps {
  entry: CallLogEntry | null;
  currentUser?: UserProfile | null;
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

  // Badge Helper
  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'scheduled') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>Scheduled</span>
        </span>
      );
    } else if (s === 'completed') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
          <CheckCircle2 className="w-3 h-3" />
          <span>Completed</span>
        </span>
      );
    } else if (s === 'cancelled') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center space-x-1">
          <AlertCircle className="w-3 h-3" />
          <span>Cancelled</span>
        </span>
      );
    } else {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>{status}</span>
        </span>
      );
    }
  };

  const getOutcomeBadge = (outcome?: string) => {
    if (!outcome) return null;
    const oc = outcome.toLowerCase();
    let colorClass = 'bg-slate-100 text-slate-800 border-slate-300';
    if (oc.includes('interested') || oc.includes('deal')) {
      colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    } else if (oc.includes('quote') || oc.includes('proposal')) {
      colorClass = 'bg-blue-50 text-blue-800 border-blue-300';
    } else if (oc.includes('follow')) {
      colorClass = 'bg-amber-50 text-amber-800 border-amber-300';
    } else if (oc.includes('dnc') || oc.includes('wrong')) {
      colorClass = 'bg-rose-50 text-rose-800 border-rose-300';
    }

    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${colorClass}`}>
        {outcome}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight">Call Record Profile</h2>
                <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-800 text-blue-300 border border-slate-700 flex items-center space-x-1">
                  <Tag className="w-2.5 h-2.5 text-blue-400" />
                  <span>REF: {getReferenceId('CL', entry, callLogs)}</span>
                </span>
                {getStatusBadge(entry.status)}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Logged on {entry.date} by <span className="font-semibold text-slate-200">{entry.logged_by}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Outcome & Purpose Banner */}
          {(entry.outcome || entry.purpose) && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="space-y-1">
                {entry.purpose && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Call Purpose
                    </span>
                    <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 mt-0.5">
                      {entry.purpose}
                    </span>
                  </div>
                )}
                {entry.outcome && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Logged Call Outcome
                    </span>
                    <div className="mt-0.5">{getOutcomeBadge(entry.outcome)}</div>
                  </div>
                )}
              </div>
              {entry.next_followup_date && (
                <div className="text-right">
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                    Next Follow-Up Due
                  </span>
                  <span className="text-xs font-bold text-slate-800 flex items-center justify-end space-x-1 mt-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>{entry.next_followup_date}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Company & Contact Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Company Box */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition shadow-sm group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                  <Building2 className="w-3 h-3 text-slate-500" />
                  <span>Company Account</span>
                </span>
                {entry.company_id && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenCompany360(entry.company_id!);
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <span>360° Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="font-bold text-slate-900 text-sm">
                {entry.company_name || 'Unspecified Company'}
              </div>

              {linkedCompany && (
                <div className="mt-2 text-xs text-slate-500 space-y-1">
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {linkedCompany.city}, {linkedCompany.country}
                    </span>
                  </div>
                  {linkedCompany.general_phone && (
                    <div className="flex items-center space-x-1 text-slate-700">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{linkedCompany.general_phone}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Contact Box */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center space-x-1">
                <User className="w-3 h-3 text-slate-500" />
                <span>Contact Person</span>
              </span>

              <div className="font-bold text-slate-900 text-sm">
                {entry.contact_name || 'No Direct Contact Assigned'}
              </div>

              <div className="mt-2 text-xs text-slate-600 space-y-1">
                {(() => {
                  const isBasicRestricted = currentUser?.role !== 'Admin' && currentUser?.dataVisibilityTier === 'BASIC' && !isRecordOwner(currentUser, entry);
                  const phoneVal = entry.contact_phone || linkedContact?.mobile;
                  const emailVal = linkedContact?.email;

                  return (
                    <>
                      {phoneVal ? (
                        <div className="flex items-center space-x-1.5 font-mono text-blue-700 font-semibold">
                          <Phone className="w-3.5 h-3.5 text-blue-500" />
                          {isBasicRestricted ? (
                            <span className="text-slate-500">*** **** (Basic View)</span>
                          ) : (
                            <a href={`tel:${phoneVal}`} className="hover:underline">
                              {phoneVal}
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-xs italic">No phone logged</div>
                      )}

                      {emailVal && (
                        <div className="flex items-center space-x-1.5 text-slate-600 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {isBasicRestricted ? (
                            <span className="text-slate-500">***@***.*** (Basic View)</span>
                          ) : (
                            <a href={`mailto:${emailVal}`} className="hover:underline truncate">
                              {emailVal}
                            </a>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Geography & Linked Enquiry Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Geography / Region:</span>
              <span className="text-xs font-bold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                {entry.geography || 'Dubai, UAE'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Linked Proposal / Enquiry:</span>
              {entry.enquiry_quote_ref ? (
                <button
                  onClick={() => {
                    if (entry.enquiry_id && onOpenEnquiry) {
                      onClose();
                      onOpenEnquiry(entry.enquiry_id);
                    }
                  }}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center space-x-1"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span>{entry.enquiry_quote_ref}</span>
                </button>
              ) : (
                <span className="text-xs text-slate-400 italic">None linked</span>
              )}
            </div>
          </div>

          {/* Requirement Notes & Call Transcript */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Requirement Notes & Discussion Transcript</span>
            </label>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-sans whitespace-pre-wrap leading-relaxed min-h-[90px]">
              {(!currentUser || currentUser.role === 'Admin' || isRecordOwner(currentUser, entry) || currentUser.dataVisibilityTier !== 'BASIC') ? (
                entry.requirement_notes || (
                  <span className="text-slate-400 italic">No notes or transcript logged for this call.</span>
                )
              ) : (
                <span className="text-purple-700 font-medium italic bg-purple-50 p-2 rounded-lg block">
                  🔒 Restricted — Requirement notes and call transcripts are hidden under your assigned Basic View Tier.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            {onCreateEnquiryFromCall && (
              <button
                onClick={() => {
                  onClose();
                  onCreateEnquiryFromCall(entry);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Convert to Proposal</span>
              </button>
            )}

            {onLogFollowup && (
              <button
                onClick={() => {
                  onClose();
                  onLogFollowup(entry);
                }}
                className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 rounded-xl flex items-center space-x-1.5 transition"
              >
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Schedule Follow-Up</span>
              </button>
            )}
          </div>

          {canEditOrDeleteRecord(currentUser, entry) && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  onClose();
                  onEdit(entry);
                }}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Log</span>
              </button>

              {entry.id && (
                <button
                  onClick={() => {
                    onDelete(entry.id!);
                    onClose();
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl flex items-center space-x-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
