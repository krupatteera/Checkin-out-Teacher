import React from 'react';
import { SchoolConfig, UserAccount } from '../types';

interface FaceScannerModalProps {
  actionType: 'IN' | 'OUT';
  user: UserAccount;
  config: SchoolConfig;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: {
    lat: number;
    lng: number;
    distance: number;
    macAddress: string;
    faceSnapshot: string;
  }) => void;
}

// Deprecated: Camera face scanning removed as requested by user.
export const FaceScannerModal: React.FC<FaceScannerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return null;
};
