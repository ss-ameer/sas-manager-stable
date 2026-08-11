import React, { useState, useEffect } from 'react';
import { UserProfile, Workspace, WorkspaceProfile } from '../types';
import { safeUpdateDoc, safeSetDoc } from '../firebase';
import { UserCheck, Shield, Phone, Briefcase, Tag, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WorkspaceMemberCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  activeWorkspace: Workspace;
  onProfileUpdated: (updatedUser: UserProfile) => void;
  triggerToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function WorkspaceMemberCheckInModal({
  isOpen,
  onClose,
  currentUser,
  activeWorkspace,
  onProfileUpdated,
  triggerToast
}: WorkspaceMemberCheckInModalProps) {
  const existingProfile: WorkspaceProfile | undefined = currentUser.workspace_profiles?.[activeWorkspace.id];

  const defaultInitials = currentUser.initials || 
    (currentUser.full_name ? currentUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : '') || 
    currentUser.username?.substring(0, 2).toUpperCase() || 'REP';

  const [initials, setInitials] = useState(existingProfile?.initials || defaultInitials);
  const [jobTitle, setJobTitle] = useState(existingProfile?.job_title || '');
  const [phone, setPhone] = useState(existingProfile?.phone || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existingProfile) {
      setInitials(existingProfile.initials || defaultInitials);
      setJobTitle(existingProfile.job_title || '');
      setPhone(existingProfile.phone || '');
    } else {
      setInitials(defaultInitials);
      setJobTitle('');
      setPhone('');
    }
  }, [activeWorkspace.id, currentUser]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initials.trim()) {
      if (triggerToast) triggerToast('Please enter your Rep Initials', 'error');
      return;
    }

    setSaving(true);
    try {
      const updatedProfiles = {
        ...(currentUser.workspace_profiles || {}),
        [activeWorkspace.id]: {
          initials: initials.trim().toUpperCase(),
          job_title: jobTitle.trim(),
          phone: phone.trim()
        }
      };

      const updatedUser: UserProfile = {
        ...currentUser,
        workspace_profiles: updatedProfiles
      };

      await safeUpdateDoc('users', currentUser.uid, {
        workspace_profiles: updatedProfiles
      });

      onProfileUpdated(updatedUser);
      if (triggerToast) triggerToast('Workspace profile checked in successfully!', 'success');
      onClose();
    } catch (err: any) {
      console.error('Error checking in workspace profile:', err);
      if (triggerToast) triggerToast(`Check-in failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Workspace Member Check-In
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirm your identity details for <span className="text-blue-400 font-semibold">{activeWorkspace.name}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="p-6 space-y-5">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 text-xs text-blue-300 leading-relaxed">
              👋 Welcome! Every workspace context maintains individual representative details so team members know who logged quotes and activity touchpoints.
            </div>

            {/* Rep Initials */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-400" />
                <span>Rep Initials (2-3 Chars) <span className="text-rose-400">*</span></span>
              </label>
              <input
                type="text"
                required
                maxLength={4}
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
                placeholder="e.g. JD"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-blue-500 uppercase"
              />
              <p className="text-[11px] text-slate-400 mt-1">Used on quote references, proposal tags, and activity feeds.</p>
            </div>

            {/* Job Title */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                <span>Job Title / Designation</span>
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Sales Account Manager"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Direct Phone / Extension */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-400" />
                <span>Direct Phone / Mobile</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +971 50 123 4567"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Checking In...' : 'Confirm & Save Check-In'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
