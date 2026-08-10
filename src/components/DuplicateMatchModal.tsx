import React from 'react';
import ResolutionManagerModal from './ResolutionManagerModal';

interface DuplicateMatchModalProps {
  isOpen: boolean;
  type: 'company' | 'contact';
  candidateName: string;
  existingRecordName: string;
  matchReason: string;
  similarityScore: number;
  existingDetails?: {
    email?: string;
    phone?: string;
    country?: string;
    city?: string;
    address?: string;
    companyName?: string;
    website?: string;
  };
  newDetails?: {
    email?: string;
    phone?: string;
    country?: string;
    city?: string;
    address?: string;
    companyName?: string;
    website?: string;
  };
  onMerge: () => void;
  onKeepNew?: () => void;
  onIgnore: () => void;
  onCancel: () => void;
}

export default function DuplicateMatchModal(props: DuplicateMatchModalProps) {
  return <ResolutionManagerModal {...props} />;
}

