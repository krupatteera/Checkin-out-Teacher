export interface SchoolConfig {
  id?: string;
  orgName: string;
  orgAffiliation: string;
  logoUrl?: string;
  lateTime: string; // e.g. "08:30"
  earlyTime: string; // e.g. "16:30"
  centerLat: number;
  centerLng: number;
  radius: number; // in meters, e.g. 150
}

export interface UserAccount {
  id: string; // doc ID or username
  username: string;
  password?: string;
  fullname: string;
  position: string;
  department: string;
  phone?: string;
  role: 'admin' | 'teacher';
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE';
  registeredMac?: string; // Stored device MAC fingerprint
  img?: string;
  createdAt?: string;
  faceBiometrics?: {
    analyzedAt: string;
    quality: string;
    confidence: number;
    descriptor: string;
    aiSummary: string;
  };
  approvedAt?: string;
  approvedBy?: string;
  rejectedReason?: string;
}

export type AttendanceAction = 'IN' | 'OUT' | 'LEAVE' | 'OFFICIAL';

export interface AttendanceRecord {
  id?: string;
  userId: string;
  employeeId: string;
  employeeName: string;
  action: AttendanceAction;
  date: string; // YYYY-MM-DD
  dateThai: string;
  time: string; // HH:mm
  lat?: number;
  lng?: number;
  distance?: number;
  isLate?: boolean;
  isEarly?: boolean;
  note?: string;
  macAddress?: string;
  faceSnapshot?: string;
  aiVerification?: {
    isMatch: boolean;
    confidenceScore: number;
    analysis: string;
  };
  timestamp: number;
}

export interface SystemLog {
  id?: string;
  time: string;
  user: string;
  action: string;
  details: string;
  timestamp: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}
