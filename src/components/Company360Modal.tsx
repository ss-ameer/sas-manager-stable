import React, { useState } from 'react';
import { Company, Contact, Enquiry, CallLogEntry, UserProfile, Workspace, getContactPhones, getContactEmails, getCompanyPhones, getCompanyEmails, DropdownOption } from '../types';
import { getReferenceId } from '../utils/refId';
import ContactModal from './ContactModal';
import {
  Building2,
  Users2,
  PhoneCall,
  FileText,
  X,
  Phone,
  Mail,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Tag,
  MessageSquare
} from 'lucide-react';
import { safeDeleteDoc } from '../firebase';
import { recordAuditLog } from '../utils/auditLogger';

interface Company360ModalProps {
  companyId: string | null;
  companies: Company[];
  contacts: Contact[];
  enquiries: Enquiry[];
  callLogs: CallLogEntry[];
  user: UserProfile;
  activeWorkspace?: Workspace;
  companyRelationships?: DropdownOption[];
  companyTemperatures?: DropdownOption[];
  setContacts?: React.Dispatch<React.SetStateAction<Contact[]>>;
  onClose: () => void;
  onOpenEnquiry?: (enquiryId: string) => void;
  onLogCallForCompany?: (company: Company) => void;
  onCreateEnquiryForCompany?: (company: Company) => void;
  onEditCompany?: (company: Company) => void;
  onOpenActivityDrawer?: (context: {
    companyId?: string;
    companyName?: string;
    contactId?: string;
    enquiryId?: string;
    channel?: any;
  }) => void;
}

export default function Company360Modal({
  companyId,
  companies,
  contacts,
  enquiries,
  callLogs,
  user,
  activeWorkspace,
  companyRelationships,
  companyTemperatures,
  setContacts,
  onClose,
  onOpenEnquiry,
  onLogCallForCompany,
  onCreateEnquiryForCompany,
  onEditCompany,
  onOpenActivityDrawer
}: Company360ModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'contacts' | 'call_logs' | 'enquiries'>('contacts');
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedContactToEdit, setSelectedContactToEdit] = useState<Contact | null>(null);

  const handleDeleteContact = async (c: Contact) => {
    const targetId = c?.id || (c as any)?._id;
    if (!c || !targetId) {
      return;
    }
    try {
      if (setContacts) {
        setContacts((prev) => prev.filter((item) => item.id !== targetId));
      }
      await safeDeleteDoc('contacts', targetId);
      try {
        await recordAuditLog({
          document_id: targetId,
          entity_type: 'contact',
          entity_title: c.full_name,
          action: 'delete',
          user,
          before: c,
          details: `Deleted contact person: "${c.full_name}"`
        });
      } catch (e) {}
    } catch (err: any) {
      alert('Failed to delete contact: ' + (err?.message || err));
    }
  };

  if (!companyId) return null;

  const company = companies.find((c) => c.id === companyId);
  if (!company) return null;

  const companyContacts = contacts.filter((c) => c.company_id === company.id);
  const companyCallLogs = callLogs.filter(
    (l) => l.company_id === company.id || (l.company_name && l.company_name.toLowerCase() === company.display_name.toLowerCase())
  );
  const companyEnquiries = enquiries.filter((e) => e.company_id === company.id);

  const handleOutboundInteraction = (
    e: React.MouseEvent,
    channel: 'Call' | 'WhatsApp' | 'Email',
    contact: Contact | null,
    externalUrl: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (externalUrl) {
      window.open(externalUrl, '_blank');
    }
    if (onOpenActivityDrawer) {
      onOpenActivityDrawer({
        companyId: company.id,
        companyName: company.display_name,
        contactId: contact?.id,
        channel
      });
    }
  };

  const relationshipVal = company.relationship || 'Prospect';
  const temperatureVal = company.temperature || 'Cold';

  const getTempBadgeClass = (temp: string) => {
    const t = temp.toLowerCase();
    if (t === 'hot') return 'bg-rose-500 text-white font-extrabold border-rose-400';
    if (t === 'warm') return 'bg-amber-500 text-slate-950 font-extrabold border-amber-400';
    if (t === 'cold') return 'bg-cyan-500 text-slate-950 font-extrabold border-cyan-400';
    return 'bg-slate-700 text-slate-200 border-slate-600';
  };

  const compPhones = getCompanyPhones(company);
  const compEmails = getCompanyEmails(company);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md flex-shrink-0 mt-1">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">{company.display_name}</h2>
                <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-slate-800 text-blue-300 border border-slate-700 flex items-center space-x-1">
                  <Tag className="w-3 h-3 text-blue-400" />
                  <span>REF: {getReferenceId('CMP', company, companies)}</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {company.legal_suffix}
                </span>

                {/* Relationship Badge */}
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-800 text-blue-200 border border-slate-700 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
                  <span>{relationshipVal}</span>
                </span>

                {/* Temperature Badge */}
                <span className={`px-2.5 py-0.5 rounded-md text-xs uppercase tracking-wider border flex items-center space-x-1 ${getTempBadgeClass(temperatureVal)}`}>
                  <span>{temperatureVal}</span>
                </span>

                {company.is_dnc && (
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-red-600 text-white flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>DO NOT CALL (DNC)</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-2">
                <span className="flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {company.city ? `${company.city}, ` : ''}
                    {company.country}
                  </span>
                </span>
              </div>

              {/* Labeled Phones & Emails Display */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-2 pt-2 border-t border-slate-800">
                {compPhones.map((ph, idx) => (
                  <span key={idx} className="flex items-center space-x-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-blue-400" />
                    <a
                      href={`tel:${ph.number}`}
                      onClick={(e) => handleOutboundInteraction(e, 'Call', null, `tel:${ph.number}`)}
                      className="hover:underline font-bold text-blue-300 cursor-pointer"
                    >
                      {ph.number}
                    </a>
                    <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded text-slate-400">
                      {ph.label || 'Telephone'}
                    </span>
                  </span>
                ))}
                {compEmails.map((em, idx) => (
                  <span key={idx} className="flex items-center space-x-1.5 font-sans">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <a
                      href={`mailto:${em.email}`}
                      onClick={(e) => handleOutboundInteraction(e, 'Email', null, `mailto:${em.email}`)}
                      className="hover:underline text-slate-200 cursor-pointer"
                    >
                      {em.email}
                    </a>
                    <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded text-slate-400">
                      {em.label || 'General'}
                    </span>
                  </span>
                ))}
              </div>

              {company.aliases && company.aliases.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Known Aliases:</span>
                  {company.aliases.map((alias, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                      {alias}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {(onOpenActivityDrawer || onLogCallForCompany) && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenActivityDrawer) {
                    onOpenActivityDrawer({
                      companyId: company.id,
                      companyName: company.display_name
                    });
                  } else if (onLogCallForCompany) {
                    onLogCallForCompany(company);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>⚡ Log Activity</span>
              </button>
            )}
            {onEditCompany && (
              <button
                onClick={() => {
                  onClose();
                  onEditCompany(company);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                title="Edit Company Profile"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveSubTab('contacts')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                activeSubTab === 'contacts'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
              }`}
            >
              <Users2 className="w-3.5 h-3.5" />
              <span>Contacts ({companyContacts.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('call_logs')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                activeSubTab === 'call_logs'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call Operations ({companyCallLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('enquiries')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                activeSubTab === 'enquiries'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Proposals & Enquiries ({companyEnquiries.length})</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {(onOpenActivityDrawer || onLogCallForCompany) && (
              <button
                onClick={() => {
                  onClose();
                  if (onOpenActivityDrawer) {
                    onOpenActivityDrawer({
                      companyId: company.id,
                      companyName: company.display_name
                    });
                  } else if (onLogCallForCompany) {
                    onLogCallForCompany(company);
                  }
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1 shadow-sm transition cursor-pointer"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>+ Log Call</span>
              </button>
            )}

            {onCreateEnquiryForCompany && (
              <button
                onClick={() => {
                  onClose();
                  onCreateEnquiryForCompany(company);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1 shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Proposal</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* TAB 1: CONTACTS */}
          {activeSubTab === 'contacts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Personnel Contacts ({companyContacts.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedContactToEdit(null);
                    setContactModalOpen(true);
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Contact Person</span>
                </button>
              </div>

              {companyContacts.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <Users2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No contacts registered for this company yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Click "+ Add Contact Person" above to create and link personnel.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {companyContacts.map((contact) => {
                    const cPhones = getContactPhones(contact);
                    const cEmails = getContactEmails(contact);
                    return (
                      <div
                        key={contact.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-blue-300 dark:hover:border-blue-500 transition shadow-sm relative group space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center space-x-1.5 flex-wrap gap-1">
                              <span>{contact.full_name}</span>
                              {contact.is_primary && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                                  Primary
                                </span>
                              )}
                              {contact.is_dnc && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">
                                  DNC
                                </span>
                              )}
                            </div>
                            {contact.designation && (
                              <p className="text-xs text-slate-500 font-medium mt-0.5">{contact.designation}</p>
                            )}
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedContactToEdit(contact);
                                setContactModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg transition flex items-center space-x-1 text-xs font-bold"
                              title="Edit Contact Person"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteContact(contact)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition flex items-center space-x-1 text-xs font-bold"
                              title="Delete Contact Person"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Phone numbers list */}
                        <div className="text-xs space-y-1 pt-1 border-t border-slate-100">
                          {cPhones.map((p, pIdx) => {
                            const cleanPhone = p.number.replace(/[^0-9]/g, '');
                            const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : '';
                            return (
                              <div key={pIdx} className="flex items-center justify-between text-blue-700 font-mono py-0.5">
                                <div className="flex items-center space-x-2">
                                  <Phone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                  <a
                                    href={`tel:${p.number}`}
                                    onClick={(ev) => handleOutboundInteraction(ev, 'Call', contact, `tel:${p.number}`)}
                                    className="hover:underline font-bold cursor-pointer"
                                  >
                                    {p.number}
                                  </a>
                                  <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-sans font-semibold border border-slate-200">
                                    {p.label}
                                  </span>
                                </div>
                                {cleanPhone && (
                                  <button
                                    type="button"
                                    onClick={(ev) => handleOutboundInteraction(ev, 'WhatsApp', contact, waUrl)}
                                    className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer font-sans"
                                    title="Send WhatsApp & Log Activity"
                                  >
                                    <MessageSquare className="w-3 h-3 text-emerald-600" />
                                    <span>WhatsApp</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}

                          {/* Emails list */}
                          {cEmails.map((e, eIdx) => (
                            <div key={eIdx} className="flex items-center space-x-2 text-slate-600 font-sans truncate py-0.5">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <a
                                href={`mailto:${e.email}`}
                                onClick={(ev) => handleOutboundInteraction(ev, 'Email', contact, `mailto:${e.email}`)}
                                className="hover:underline truncate text-slate-800 font-medium cursor-pointer"
                              >
                                {e.email}
                              </a>
                              {e.label && (
                                <span className="px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded text-[9px] font-semibold shrink-0 border border-slate-200">
                                  {e.label}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CALL LOGS */}
          {activeSubTab === 'call_logs' && (
            <div className="space-y-3">
              {companyCallLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <PhoneCall className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No call operations recorded for this company yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {companyCallLogs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-slate-50 transition">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-900">{log.date}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {log.status}
                          </span>
                          {log.outcome && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {log.outcome}
                            </span>
                          )}
                        </div>

                        <span className="text-xs text-slate-500 font-semibold">
                          Logged by: {log.logged_by}
                        </span>
                      </div>

                      {log.contact_name && (
                        <p className="text-xs text-slate-600 font-semibold mt-1">
                          Contact: {log.contact_name} {log.contact_phone ? `(${log.contact_phone})` : ''}
                        </p>
                      )}

                      {log.requirement_notes && (
                        <p className="text-xs text-slate-700 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {log.requirement_notes}
                        </p>
                      )}

                      {log.next_followup_date && (
                        <div className="mt-2 text-[11px] font-bold text-amber-700 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Follow-up scheduled for: {log.next_followup_date}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ENQUIRIES */}
          {activeSubTab === 'enquiries' && (
            <div className="space-y-3">
              {companyEnquiries.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No proposals or enquiries created for this company yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {companyEnquiries.map((enq) => (
                    <div
                      key={enq.id}
                      onClick={() => {
                        if (enq.id && onOpenEnquiry) {
                          onClose();
                          onOpenEnquiry(enq.id);
                        }
                      }}
                      className="p-4 hover:bg-slate-50 transition cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-blue-600 text-sm">{enq.quote_ref_no}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              enq.status === 'Order Received'
                                ? 'bg-emerald-100 text-emerald-800'
                                : enq.status === 'Lost' || enq.status === 'Dead'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {enq.status}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 mt-1">{enq.subject || 'Technical Enquiry'}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Date: {enq.enquiry_date} | Agent: {enq.sales_person}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900 block font-mono">
                          {enq.currency || 'AED'} {(enq.value_aed || 0).toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-blue-600 hover:underline flex items-center justify-end space-x-1 mt-1">
                          <span>View Detail</span>
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ContactModal
        isOpen={contactModalOpen}
        onClose={() => {
          setContactModalOpen(false);
          setSelectedContactToEdit(null);
        }}
        contact={selectedContactToEdit}
        companyId={company.id}
        companies={companies}
        activeWorkspaceId={activeWorkspace?.id || ''}
        user={user}
        setContacts={setContacts}
      />
    </div>
  );
}
