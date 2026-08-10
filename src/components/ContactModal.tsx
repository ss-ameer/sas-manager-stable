import React, { useState, useEffect } from 'react';
import { X, User, Building2, Phone, Mail, Plus, Trash2, ShieldAlert, Check, ArrowRightLeft, Sparkles } from 'lucide-react';
import { Company, Contact, LabeledPhone, LabeledEmail, LabeledHandle, PhoneCategory, UserProfile, getContactPhones, getContactEmails, getContactHandles, getCompanyPhones, getCompanyEmails } from '../types';
import { safeAddDoc, safeUpdateDoc, safeDeleteDoc } from '../firebase';
import { recordAuditLog } from '../utils/auditLogger';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact?: Contact | null; // null if creating
  companyId?: string; // Pre-selected company ID if creating from company view
  companies: Company[];
  activeWorkspaceId: string;
  user: UserProfile;
  setContacts?: React.Dispatch<React.SetStateAction<Contact[]>>;
  setCompanies?: React.Dispatch<React.SetStateAction<Company[]>>;
  onSaved?: (savedContact: Contact) => void;
}

const PHONE_LABEL_OPTIONS: PhoneCategory[] = [
  'Mobile',
  'Telephone',
  'Direct',
  'WhatsApp',
  'Work',
  'Fax',
  'Other'
];

export default function ContactModal({
  isOpen,
  onClose,
  contact,
  companyId: initialCompanyId,
  companies,
  activeWorkspaceId,
  user,
  setContacts,
  setCompanies,
  onSaved
}: ContactModalProps) {
  const isEditing = !!contact?.id;

  const [companyId, setCompanyId] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [designation, setDesignation] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [isDnc, setIsDnc] = useState<boolean>(false);
  const [dncReason, setDncReason] = useState<string>('');

  const [phones, setPhones] = useState<LabeledPhone[]>([{ number: '', label: 'Mobile' }]);
  const [emails, setEmails] = useState<LabeledEmail[]>([{ email: '', label: 'Work' }]);
  const [handles, setHandles] = useState<LabeledHandle[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const selectedCompany = companies.find((c) => c.id === companyId);
  const availableCompanyPhones = selectedCompany ? getCompanyPhones(selectedCompany) : [];
  const availableCompanyEmails = selectedCompany ? getCompanyEmails(selectedCompany) : [];

  const claimCompanyPhone = async (phoneObj: LabeledPhone) => {
    if (!selectedCompany) return;
    setPhones((prev) => [...prev.filter((p) => p.number.trim() !== ''), phoneObj]);

    const currentCompPhones = getCompanyPhones(selectedCompany);
    const updatedPhones = currentCompPhones.filter(
      (p) => p.number.trim().toLowerCase() !== phoneObj.number.trim().toLowerCase()
    );

    const updatedCompany: Company = {
      ...selectedCompany,
      phones: updatedPhones,
      general_phone: updatedPhones[0]?.number || ''
    };

    try {
      await safeUpdateDoc('companies', selectedCompany.id, {
        phones: updatedPhones,
        general_phone: updatedPhones[0]?.number || '',
        last_modified_by_uid: user?.uid || '',
        last_modified_by_name: user?.full_name || user?.username || user?.email || 'Unknown User',
        updatedAt: new Date().toISOString()
      });
      if (setCompanies) {
        setCompanies((prev) => prev.map((c) => (c.id === selectedCompany.id ? updatedCompany : c)));
      }
    } catch (err) {
      console.error('Failed to reassign company phone:', err);
    }
  };

  const claimCompanyEmail = async (emailObj: LabeledEmail) => {
    if (!selectedCompany) return;
    setEmails((prev) => [...prev.filter((e) => e.email.trim() !== ''), emailObj]);

    const currentCompEmails = getCompanyEmails(selectedCompany);
    const updatedEmails = currentCompEmails.filter(
      (e) => e.email.trim().toLowerCase() !== emailObj.email.trim().toLowerCase()
    );

    const updatedCompany: Company = {
      ...selectedCompany,
      emails: updatedEmails,
      general_email: updatedEmails[0]?.email || ''
    };

    try {
      await safeUpdateDoc('companies', selectedCompany.id, {
        emails: updatedEmails,
        general_email: updatedEmails[0]?.email || '',
        last_modified_by_uid: user?.uid || '',
        last_modified_by_name: user?.full_name || user?.username || user?.email || 'Unknown User',
        updatedAt: new Date().toISOString()
      });
      if (setCompanies) {
        setCompanies((prev) => prev.map((c) => (c.id === selectedCompany.id ? updatedCompany : c)));
      }
    } catch (err) {
      console.error('Failed to reassign company email:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (contact) {
        setCompanyId(contact.company_id || initialCompanyId || '');
        setFullName(contact.full_name || '');
        setDesignation(contact.designation || '');
        setIsPrimary(!!contact.is_primary);
        setIsDnc(!!contact.is_dnc);
        setDncReason(contact.dnc_reason || '');

        // Populate phones
        const existingPhones = getContactPhones(contact);
        setPhones(existingPhones.length > 0 ? existingPhones : [{ number: '', label: 'Mobile' }]);

        // Populate emails
        const existingEmails = getContactEmails(contact);
        setEmails(existingEmails.length > 0 ? existingEmails : [{ email: '', label: 'Work' }]);

        // Populate handles
        const existingHandles = getContactHandles(contact);
        setHandles(existingHandles.length > 0 ? existingHandles : []);
      } else {
        setCompanyId(initialCompanyId || '');
        setFullName('');
        setDesignation('');
        setIsPrimary(false);
        setIsDnc(false);
        setDncReason('');
        setPhones([{ number: '', label: 'Mobile' }]);
        setEmails([{ email: '', label: 'Work' }]);
        setHandles([]);
      }
    }
  }, [isOpen, contact, initialCompanyId]);

  if (!isOpen) return null;

  const handleAddPhone = () => {
    setPhones((prev) => [...prev, { number: '', label: 'Mobile' }]);
  };

  const handleRemovePhone = (index: number) => {
    setPhones((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePhoneChange = (index: number, field: 'number' | 'label', val: string) => {
    setPhones((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleAddEmail = () => {
    setEmails((prev) => [...prev, { email: '', label: 'Work' }]);
  };

  const handleRemoveEmail = (index: number) => {
    setEmails((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEmailChange = (index: number, field: 'email' | 'label', val: string) => {
    setEmails((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleAddHandle = () => {
    setHandles((prev) => [...prev, { platform: 'WhatsApp', handle: '' }]);
  };

  const handleRemoveHandle = (index: number) => {
    setHandles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleHandleChange = (index: number, field: 'platform' | 'handle', val: string) => {
    setHandles((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert('Please enter contact full name.');
      return;
    }

    setIsSaving(true);

    const validPhones = phones.filter((p) => p.number.trim() !== '');
    const validEmails = emails.filter((e) => e.email.trim() !== '');
    const validHandles = handles.filter((h) => h.handle.trim() !== '');

    const primaryMobile = validPhones.find((p) => p.label === 'Mobile')?.number || validPhones[0]?.number || '';
    const primaryLandline = validPhones.find((p) => p.label === 'Telephone' || p.label === 'Direct')?.number || '';
    const primaryEmail = validEmails[0]?.email || '';

    const userUid = user?.uid || '';
    const userName = user?.full_name || user?.username || user?.email || 'Unknown User';

    const payload: Omit<Contact, 'id'> = {
      workspace_id: activeWorkspaceId,
      company_id: companyId || '',
      full_name: fullName.trim(),
      designation: designation.trim(),
      mobile: primaryMobile,
      landline: primaryLandline,
      email: primaryEmail,
      phones: validPhones,
      emails: validEmails,
      handles: validHandles,
      is_primary: isPrimary,
      is_dnc: isDnc,
      dnc_reason: isDnc ? dncReason.trim() : '',
      created_by_uid: contact?.created_by_uid || userUid,
      created_by_name: contact?.created_by_name || userName,
      last_modified_by_uid: userUid,
      last_modified_by_name: userName,
      createdAt: contact?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      if (isPrimary) {
        // Reset primary flag for other contacts under same company
        const batch = writeBatch(db);
        // Best effort local batch update
        // We will execute update in Firestore
      }

      let finalContactObj: Contact;

      if (isEditing && contact?.id) {
        await safeUpdateDoc('contacts', contact.id, payload);
        finalContactObj = { id: contact.id, ...payload };
        await recordAuditLog({
          document_id: contact.id,
          entity_type: 'contact',
          entity_title: payload.full_name,
          action: 'update',
          user,
          before: contact,
          after: finalContactObj,
          details: `Updated contact person: "${payload.full_name}"`
        });
      } else {
        const res = await safeAddDoc('contacts', payload);
        const newId = res?.id || ('cont_' + Date.now());
        finalContactObj = { id: newId, ...payload };
        await recordAuditLog({
          document_id: newId,
          entity_type: 'contact',
          entity_title: payload.full_name,
          action: 'create',
          user,
          after: finalContactObj,
          details: `Created new contact person: "${payload.full_name}"`
        });
      }

      if (setContacts) {
        setContacts((prev) => {
          let list = prev;
          if (isPrimary) {
            list = list.map((c) => (c.company_id === companyId ? { ...c, is_primary: false } : c));
          }
          if (isEditing) {
            return list.map((c) => (c.id === finalContactObj.id ? finalContactObj : c));
          } else {
            return [finalContactObj, ...list.filter((c) => c.id !== finalContactObj.id)];
          }
        });
      }

      if (onSaved) {
        onSaved(finalContactObj);
      }

      onClose();
    } catch (err: any) {
      alert('Failed to save contact: ' + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteContact = async () => {
    const targetId = contact?.id || (contact as any)?._id;
    if (!contact || !targetId) {
      return;
    }
    const targetName = fullName || contact.full_name || 'this contact';

    setIsSaving(true);
    try {
      if (setContacts) {
        setContacts((prev) => prev.filter((c) => c.id !== targetId));
      }

      await safeDeleteDoc('contacts', targetId);

      try {
        await recordAuditLog({
          document_id: targetId,
          entity_type: 'contact',
          entity_title: targetName,
          action: 'delete',
          user,
          before: contact,
          details: `Deleted contact person: "${targetName}"`
        });
      } catch (aErr) {
        console.warn('Audit logging error during contact deletion:', aErr);
      }

      if (onSaved) {
        onSaved({ ...contact, id: undefined });
      }

      onClose();
    } catch (err: any) {
      alert('Failed to delete contact: ' + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-sans">
                {isEditing ? 'Edit Contact Person' : 'Create New Contact Person'}
              </h2>
              <p className="text-xs text-slate-500 font-sans">
                {selectedCompany
                  ? `Linking personnel directly to ${selectedCompany.display_name}`
                  : 'Specify contact details'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 font-sans pr-1">
          {/* Company Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Associated Company
            </label>
            <div className="relative">
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="">(Unassigned / Independent Contact)</option>
                {companies.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.display_name} ({comp.city}, {comp.country})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Designation */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Designation / Role</label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Procurement Manager"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Phones Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">Phone Numbers</label>
              <button
                type="button"
                onClick={handleAddPhone}
                className="text-xs text-blue-600 font-bold hover:underline flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Phone</span>
              </button>
            </div>

            {/* Smart Reclaimable Company Phone Numbers */}
            {selectedCompany && availableCompanyPhones.length > 0 && (
              <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-xl text-xs space-y-1.5">
                <span className="font-semibold text-blue-900 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Unassigned Company Phone Numbers:</span>
                </span>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {availableCompanyPhones.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => claimCompanyPhone(p)}
                      className="px-2 py-1 bg-white border border-blue-200 hover:border-blue-400 text-blue-700 rounded-lg text-[11px] font-mono flex items-center space-x-1 shadow-2xs hover:bg-blue-50 transition"
                      title="Claim this phone number for this personnel"
                    >
                      <span>{p.number}</span>
                      <span className="text-[9px] text-blue-400 font-sans">({p.label})</span>
                      <ArrowRightLeft className="w-2.5 h-2.5 ml-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {phones.map((p, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <select
                  value={p.label}
                  onChange={(e) => handlePhoneChange(idx, 'label', e.target.value as PhoneCategory)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  {PHONE_LABEL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={p.number}
                  onChange={(e) => handlePhoneChange(idx, 'number', e.target.value)}
                  placeholder="e.g. +971 50 123 4567"
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
                />
                {phones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePhone(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Emails Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">Email Addresses</label>
              <button
                type="button"
                onClick={handleAddEmail}
                className="text-xs text-blue-600 font-bold hover:underline flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Email</span>
              </button>
            </div>

            {/* Smart Reclaimable Company Email Addresses */}
            {selectedCompany && availableCompanyEmails.length > 0 && (
              <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-xl text-xs space-y-1.5">
                <span className="font-semibold text-blue-900 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Unassigned Company Email Addresses:</span>
                </span>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {availableCompanyEmails.map((e, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => claimCompanyEmail(e)}
                      className="px-2 py-1 bg-white border border-blue-200 hover:border-blue-400 text-blue-700 rounded-lg text-[11px] font-mono flex items-center space-x-1 shadow-2xs hover:bg-blue-50 transition"
                      title="Claim this email address for this personnel"
                    >
                      <span>{e.email}</span>
                      <span className="text-[9px] text-blue-400 font-sans">({e.label})</span>
                      <ArrowRightLeft className="w-2.5 h-2.5 ml-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {emails.map((e, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={e.label}
                  onChange={(eVal) => handleEmailChange(idx, 'label', eVal.target.value)}
                  placeholder="Label (e.g. Work)"
                  className="w-28 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white"
                />
                <input
                  type="email"
                  value={e.email}
                  onChange={(eVal) => handleEmailChange(idx, 'email', eVal.target.value)}
                  placeholder="e.g. john@company.com"
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                />
                {emails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Messaging & Social Handles Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">Messaging & Social Handles</label>
              <button
                type="button"
                onClick={handleAddHandle}
                className="text-xs text-blue-600 font-bold hover:underline flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Handle</span>
              </button>
            </div>

            {handles.length === 0 && (
              <p className="text-[11px] text-slate-400 italic">No messaging handles added. Click "Add Handle" to add WhatsApp, Telegram, LinkedIn, etc.</p>
            )}

            {handles.map((h, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <select
                  value={h.platform}
                  onChange={(e) => handleHandleChange(idx, 'platform', e.target.value)}
                  className="w-32 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white font-medium"
                >
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Telegram">Telegram</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="WeChat">WeChat</option>
                  <option value="Skype">Skype</option>
                  <option value="Signal">Signal</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  type="text"
                  value={h.handle}
                  onChange={(e) => handleHandleChange(idx, 'handle', e.target.value)}
                  placeholder="e.g. +971501234567 or @username"
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveHandle(idx)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Additional Controls */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-xs font-bold text-slate-800">
                Set as Primary Contact Person for this company
              </span>
            </label>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDnc}
                  onChange={(e) => setIsDnc(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                />
                <span className="text-xs font-bold text-rose-700 flex items-center space-x-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Flag as Do Not Call (DNC)</span>
                </span>
              </label>

              {isDnc && (
                <input
                  type="text"
                  value={dncReason}
                  onChange={(e) => setDncReason(e.target.value)}
                  placeholder="Reason for DNC request..."
                  className="w-full px-3 py-1.5 text-xs border border-rose-200 bg-white rounded-lg text-rose-900 focus:ring-1 focus:ring-rose-500"
                />
              )}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDeleteContact}
                  disabled={isSaving}
                  className="px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Contact</span>
                </button>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : isEditing ? 'Update Contact' : 'Save Contact'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
