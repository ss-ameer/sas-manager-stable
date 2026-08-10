import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  MicOff,
  Phone,
  MessageSquare,
  Mail,
  Users,
  MapPin,
  Calendar,
  Send,
  Check,
  Sparkles,
  Clock,
  ShieldAlert,
  Building2,
  FileText,
  Loader2,
  Copy,
  ExternalLink,
  KeyRound,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { safeAddDoc, safeUpdateDoc } from '../firebase';
import { CallLogEntry, CallStatus } from '../types';
import GeminiKeyModal from './GeminiKeyModal';

export interface QuickActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string;
  companyName?: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  enquiryId?: string;
  initialChannel?: ActivityChannel;
  initialStatus?: CallStatus;
  activeWorkspaceId: string;
  currentSalespersonId: string;
  currentUserInitials: string;
  currentUserUid?: string;
  currentUserName?: string;
  user?: any;
  onSaveSuccess: () => void;
}

type ActivityChannel = 'Call' | 'WhatsApp' | 'Email' | 'Meeting' | 'Site Visit';

interface PresetChip {
  id: string;
  label: string;
  channel?: ActivityChannel;
  outcome: string;
  notes: string;
  followUpDays: number | null; // null means clear follow-up
}

const PRESET_CHIPS: PresetChip[] = [
  {
    id: 'quote_req',
    label: 'Interested / Send Quote',
    channel: 'Call',
    outcome: 'Interested - Quote Requested',
    notes: 'Customer expressed strong interest and requested a formal quotation.',
    followUpDays: 2
  },
  {
    id: 'voicemail',
    label: 'Left Voicemail',
    channel: 'Call',
    outcome: 'Left Voicemail',
    notes: 'Attempted call, left a voicemail requesting a callback.',
    followUpDays: 1
  },
  {
    id: 'callback',
    label: 'Call Back Later',
    channel: 'Call',
    outcome: 'Call Back Later',
    notes: 'Customer is currently busy and requested a callback later.',
    followUpDays: 3
  },
  {
    id: 'meeting_sched',
    label: 'Meeting Scheduled',
    channel: 'Meeting',
    outcome: 'Meeting Scheduled',
    notes: 'Scheduled a meeting to review project requirements and specifications.',
    followUpDays: 5
  },
  {
    id: 'site_visit',
    label: 'Site Visit Done',
    channel: 'Site Visit',
    outcome: 'Site Visit Completed',
    notes: 'Visited customer site, conducted survey, and collected technical parameters.',
    followUpDays: 2
  },
  {
    id: 'not_interested',
    label: 'Not Interested',
    channel: 'Call',
    outcome: 'Not Interested',
    notes: 'Customer stated they do not require our services at this time.',
    followUpDays: null
  }
];

export const QuickActivityDrawer: React.FC<QuickActivityDrawerProps> = ({
  isOpen,
  onClose,
  companyId,
  companyName,
  contactId,
  contactName,
  contactPhone,
  enquiryId,
  initialChannel,
  initialStatus,
  activeWorkspaceId,
  currentSalespersonId,
  currentUserInitials,
  currentUserUid,
  currentUserName,
  user,
  onSaveSuccess
}) => {
  const [channel, setChannel] = useState<ActivityChannel>(initialChannel || 'Call');
  const [outcome, setOutcome] = useState<string>('Connected');
  const [status, setStatus] = useState<CallStatus>(initialStatus || 'Completed');
  const [purpose, setPurpose] = useState<string>('Prospecting / Intro');
  const [notes, setNotes] = useState<string>('');
  const [followupDate, setFollowupDate] = useState<string>('');
  const [isDnc, setIsDnc] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeChipId, setActiveChipId] = useState<string | null>(null);

  // Sync channel & status whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      setChannel(initialChannel || 'Call');
      setStatus(initialStatus || 'Completed');
      setActiveChipId(null);
      setWhatsappDraft('');
      setAiError(null);
    }
  }, [isOpen, initialChannel, initialStatus]);

  // AI Assist State
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [isDraftingWhatsapp, setIsDraftingWhatsapp] = useState<boolean>(false);
  const [whatsappDraft, setWhatsappDraft] = useState<string>('');
  const [showGeminiKeyModal, setShowGeminiKeyModal] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState<boolean>(false);

  // Speech Recognition State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setNotes((prev) => {
            const cleanPrev = prev.trim();
            if (!cleanPrev) return transcript;
            // Append if transcript isn't already at the end
            if (cleanPrev.endsWith(transcript)) return cleanPrev;
            return `${cleanPrev} ${transcript}`;
          });
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const getUserApiKey = (): string => {
    return localStorage.getItem('omni_user_gemini_api_key') || '';
  };

  const handleAiCall = async (action: 'summarize_notes' | 'draft_whatsapp') => {
    if (!notes.trim()) {
      setAiError('Please enter or dictate activity notes first.');
      return;
    }

    setAiError(null);
    if (action === 'summarize_notes') {
      setIsSummarizing(true);
    } else {
      setIsDraftingWhatsapp(true);
    }

    try {
      const userApiKey = getUserApiKey();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (userApiKey) {
        headers['x-user-gemini-api-key'] = userApiKey;
      }

      const response = await fetch('/api/gemini/quick-assist', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action,
          notes,
          companyName,
          contactName,
          followupDate
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || data.isAuthError || data.isApiKeyMissing) {
          setAiError('Gemini API key is missing or invalid. Please configure your key.');
          setShowGeminiKeyModal(true);
        } else if (response.status === 429 || data.isQuotaError) {
          setAiError('Gemini API quota depleted. Please configure a personal API key.');
          setShowGeminiKeyModal(true);
        } else {
          setAiError(data.error || 'AI request failed. Please try again.');
        }
        return;
      }

      if (action === 'summarize_notes' && data.result) {
        setNotes(data.result);
      } else if (action === 'draft_whatsapp' && data.result) {
        setWhatsappDraft(data.result);
      }
    } catch (err: any) {
      console.error('Error during AI Assist fetch:', err);
      setAiError('Network error or server unavailable. Please try again.');
    } finally {
      setIsSummarizing(false);
      setIsDraftingWhatsapp(false);
    }
  };

  const handleCopyAndSendWhatsapp = () => {
    if (!whatsappDraft) return;
    navigator.clipboard.writeText(whatsappDraft);
    setCopiedWhatsapp(true);
    setTimeout(() => setCopiedWhatsapp(false), 2500);

    const targetPhone = (contactPhone || '').replace(/[^0-9]/g, '');
    const encodedText = encodeURIComponent(whatsappDraft);
    const targetUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;
    window.open(targetUrl, '_blank');
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Failed to start recognition:', err);
      }
    }
  };

  const getOffsetDateString = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const handleApplyPreset = (chip: PresetChip) => {
    setActiveChipId(chip.id);
    if (chip.channel) setChannel(chip.channel);
    setOutcome(chip.outcome);
    setNotes(chip.notes);

    if (chip.followUpDays !== null) {
      setFollowupDate(getOffsetDateString(chip.followUpDays));
    } else {
      setFollowupDate('');
    }
  };

  const handleReset = () => {
    setChannel('Call');
    setOutcome('Connected');
    setStatus('Completed');
    setPurpose('Prospecting / Intro');
    setNotes('');
    setFollowupDate('');
    setIsDnc(false);
    setActiveChipId(null);
    setWhatsappDraft('');
    setAiError(null);
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const interactionTypeMap: Record<ActivityChannel, 'call' | 'email' | 'message'> = {
        Call: 'call',
        WhatsApp: 'message',
        Email: 'email',
        Meeting: 'call',
        'Site Visit': 'call'
      };

      const isDncOptOut =
        isDnc ||
        status === ('dnc_opt_out' as any) ||
        outcome === 'dnc_opt_out' ||
        outcome.toLowerCase().includes('dnc') ||
        outcome.toLowerCase().includes('opt-out') ||
        outcome.toLowerCase().includes('opt_out');

      const userUid = currentUserUid || user?.uid || '';
      const userName = currentUserName || user?.full_name || user?.username || user?.email || currentUserInitials || 'System';

      const payload: Omit<CallLogEntry, 'id'> = {
        workspace_id: activeWorkspaceId || 'ws_default',
        date: nowIso,
        status: status || 'Completed',
        outcome: outcome || channel,
        requirement_notes: notes.trim(),
        next_followup_date: followupDate || undefined,
        company_id: companyId || undefined,
        company_name: companyName || undefined,
        contact_id: contactId || undefined,
        enquiry_id: enquiryId || undefined,
        logged_by: currentUserInitials || 'System',
        sales_person_id: currentSalespersonId || undefined,
        sales_person: currentUserInitials || undefined,
        handled_by_salesperson_id: currentSalespersonId || undefined,
        handled_by_team_member_name: currentUserInitials || undefined,
        interaction_type: interactionTypeMap[channel] || 'call',
        purpose: purpose,
        created_by_uid: userUid,
        created_by_name: userName,
        last_modified_by_uid: userUid,
        last_modified_by_name: userName,
        createdAt: nowIso,
        updatedAt: nowIso,
        ...(isDncOptOut ? { dnc: true, opt_out: true } : {})
      };

      await safeAddDoc('call_logs', payload);

      // Auto-DNC Suppression Trigger
      if (isDncOptOut) {
        if (contactId) {
          await safeUpdateDoc('contacts', contactId, {
            is_dnc: true,
            dnc_reason: 'Opt-Out from Activity Log',
            last_modified_by_uid: userUid,
            last_modified_by_name: userName,
            updatedAt: nowIso
          });
        }
        if (companyId) {
          await safeUpdateDoc('companies', companyId, {
            is_dnc: true,
            last_modified_by_uid: userUid,
            last_modified_by_name: userName,
            updatedAt: nowIso
          });
        }
      }

      onSaveSuccess();
      handleReset();
      onClose();
    } catch (error) {
      console.error('Error logging activity:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-slate-900/60 backdrop-blur-xs">
          {/* Backdrop click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative z-10 flex h-full w-full max-w-lg flex-col bg-slate-900 text-slate-100 shadow-2xl border-l border-slate-800"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/80">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-100">Log Quick Activity</h3>
                  <p className="text-xs text-slate-400">
                    {companyName ? `Target: ${companyName}` : 'Record customer interaction'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Context Badge if provided */}
              {(companyName || enquiryId) && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-800/60 p-3 border border-slate-700/50 text-xs text-slate-300">
                  {companyName && (
                    <span className="flex items-center gap-1.5 font-medium text-slate-200">
                      <Building2 className="h-3.5 w-3.5 text-blue-400" />
                      {companyName}
                    </span>
                  )}
                  {enquiryId && (
                    <span className="flex items-center gap-1.5 text-slate-400 border-l border-slate-700 pl-2">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      Enquiry ID: {enquiryId}
                    </span>
                  )}
                </div>
              )}

              {/* Channel Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Interaction Channel
                </label>
                <div className="grid grid-cols-5 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {[
                    { id: 'Call', label: 'Call', icon: Phone },
                    { id: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare },
                    { id: 'Email', label: 'Email', icon: Mail },
                    { id: 'Meeting', label: 'Meeting', icon: Users },
                    { id: 'Site Visit', label: 'Site Visit', icon: MapPin }
                  ].map((item) => {
                    const IconComponent = item.icon;
                    const isSelected = channel === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setChannel(item.id as ActivityChannel)}
                        className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        <IconComponent className="h-4 w-4" />
                        <span className="text-[11px] truncate w-full text-center">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Call Status / Disposition Toggle */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Call Status / Disposition
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {[
                    { id: 'Completed', label: 'Completed Log' },
                    { id: 'Scheduled', label: 'Schedule Follow-Up' },
                    { id: 'No Answer', label: 'No Answer' },
                    { id: 'Busy', label: 'Busy' }
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        const newStatus = st.id as CallStatus;
                        setStatus(newStatus);
                        if (newStatus === 'Scheduled' && !followupDate) {
                          setFollowupDate(getOffsetDateString(1));
                        }
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        status === st.id
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1-Tap Preset Chips */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Quick Presets
                  </label>
                  <span className="flex items-center gap-1 text-[11px] text-blue-400 font-medium">
                    <Sparkles className="h-3 w-3" /> 1-Tap Autofill
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_CHIPS.map((chip) => {
                    const isActive = activeChipId === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => handleApplyPreset(chip)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          isActive
                            ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 ring-1 ring-blue-500/30'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {isActive && <Check className="h-3 w-3 text-blue-400" />}
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Outcome & Purpose Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Outcome / Result
                  </label>
                  <input
                    type="text"
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    placeholder="e.g. Connected, Left Voicemail"
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Interaction Purpose
                  </label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Prospecting / Intro">Prospecting / Intro</option>
                    <option value="Quote Follow-Up">Quote Follow-Up</option>
                    <option value="Technical Specs">Technical Specs</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="Payment / Billing">Payment / Billing</option>
                    <option value="General Inquiry">General Inquiry</option>
                  </select>
                </div>
              </div>

              {/* Notes with Speech Dictation Button & AI Assist Action Bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Activity Notes
                  </label>
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        isListening
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                      }`}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="h-3.5 w-3.5 text-red-400" />
                          Listening... (Tap to Stop)
                        </>
                      ) : (
                        <>
                          <Mic className="h-3.5 w-3.5 text-blue-400" />
                          Dictate Voice
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter details of the discussion or use voice dictation..."
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                  {isListening && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md bg-red-950/80 px-2 py-0.5 text-[10px] text-red-300 border border-red-800/50">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                      Recording audio...
                    </div>
                  )}
                </div>

                {/* ✨ AI Assist Action Bar */}
                <div className="mt-2.5 rounded-xl border border-blue-900/40 bg-blue-950/20 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300">
                      <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                      <span>AI Assist Toolbar</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGeminiKeyModal(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-blue-300 transition-colors"
                      title="Configure Personal Gemini API Key"
                    >
                      <KeyRound className="h-3 w-3" />
                      {getUserApiKey() ? 'Key Active' : 'Set Gemini Key'}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Summarize Notes */}
                    <button
                      type="button"
                      onClick={() => handleAiCall('summarize_notes')}
                      disabled={isSummarizing || isDraftingWhatsapp || !notes.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/30 hover:border-blue-400 disabled:opacity-40 transition-all shadow-xs cursor-pointer"
                    >
                      {isSummarizing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                          <span>Summarizing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                          <span>✨ Summarize Notes</span>
                        </>
                      )}
                    </button>

                    {/* Draft WhatsApp Message */}
                    <button
                      type="button"
                      onClick={() => handleAiCall('draft_whatsapp')}
                      disabled={isSummarizing || isDraftingWhatsapp || !notes.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/30 hover:border-emerald-400 disabled:opacity-40 transition-all shadow-xs cursor-pointer"
                    >
                      {isDraftingWhatsapp ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                          <span>Drafting...</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                          <span>💬 Draft WhatsApp Message</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Inline Error / Safeguard Banner */}
                  {aiError && (
                    <div className="flex items-center justify-between text-xs text-rose-300 bg-rose-950/50 border border-rose-800/50 rounded-lg p-2 mt-1">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                        <span>{aiError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowGeminiKeyModal(true)}
                        className="text-[11px] underline text-blue-300 font-semibold hover:text-white shrink-0 ml-2"
                      >
                        Configure Key
                      </button>
                    </div>
                  )}
                </div>

                {/* Drafted WhatsApp Message Preview Box */}
                {whatsappDraft && (
                  <div className="mt-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3.5 space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                        <MessageSquare className="h-4 w-4 text-emerald-400" />
                        <span>Drafted WhatsApp Message</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWhatsappDraft('')}
                        className="text-slate-400 hover:text-slate-200 p-1 rounded-md transition-colors"
                        title="Dismiss draft"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <textarea
                      rows={3}
                      value={whatsappDraft}
                      onChange={(e) => setWhatsappDraft(e.target.value)}
                      className="w-full rounded-lg bg-slate-950/80 border border-emerald-800/50 px-3 py-2 text-xs text-emerald-100 focus:border-emerald-500 focus:outline-hidden resize-none font-sans"
                    />

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-emerald-400/80 font-medium">
                        Ready to dispatch to client
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(whatsappDraft);
                            setCopiedWhatsapp(true);
                            setTimeout(() => setCopiedWhatsapp(false), 2000);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                        >
                          {copiedWhatsapp ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5 text-slate-400" />
                              <span>Copy Text</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleCopyAndSendWhatsapp}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Copy & Send via WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Follow-up Date & Quick Shortcuts */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Next Follow-Up Date
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="date"
                      value={followupDate}
                      onChange={(e) => setFollowupDate(e.target.value)}
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  {followupDate && (
                    <button
                      type="button"
                      onClick={() => setFollowupDate('')}
                      className="rounded-lg p-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Quick Date Shortcuts */}
                <div className="flex items-center gap-1.5">
                  {[
                    { label: 'Tomorrow', days: 1 },
                    { label: '+3 Days', days: 3 },
                    { label: 'Next Week', days: 7 }
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setFollowupDate(getOffsetDateString(item.days))}
                      className="px-2.5 py-1 rounded-md bg-slate-800/60 hover:bg-slate-800 text-[11px] font-medium text-slate-400 hover:text-slate-200 border border-slate-700/50 transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* DNC / Opt-out Checkbox */}
              <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDnc}
                    onChange={(e) => setIsDnc(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-red-600 focus:ring-red-500/30 focus:ring-offset-slate-900"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Mark as Do Not Call / Opt-Out
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Tags contact to exclude them from future outreach and promotional campaigns.
                    </p>
                  </div>
                </label>
              </div>
            </form>

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-900/80">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Reset Form
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 focus:outline-hidden disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Save Activity
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      <GeminiKeyModal
        isOpen={showGeminiKeyModal}
        onClose={() => setShowGeminiKeyModal(false)}
      />
    </>
  );
};

