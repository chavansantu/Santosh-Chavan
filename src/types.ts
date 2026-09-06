export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface EntryLocation {
  latitude: number;
  longitude: number;
  placeName?: string;
  formattedAddress?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood?: string;
  tags?: string[];
  summary?: string;
  theme?: string;
  keyTakeaways?: string[];
  location?: EntryLocation;
  createdAt: number;
  updatedAt: number;
}

export interface SystemMetrics {
  totalEntriesCount: number;
  activeUsersCount: number;
  moodDistribution: Record<string, number>;
  modelUsageBreakdown: Record<string, number>;
  locationEntriesCount: number;
  configuredAdminsCount?: number;
  adminEmails?: string[];
  recentAuditLogs: AdminAuditLog[];
  lastCalculated: string;
}

export interface AdminAuditLog {
  id: string;
  timestamp: string;
  adminEmail: string;
  action: string;
  status: 'SUCCESS' | 'DENIED' | 'FLAGGED';
  details: string;
}

export interface AdminConfig {
  adminEmails: string[];
  googleMaps: {
    configured: boolean;
    provider: string;
    maskedKey: string | null;
  };
  notificationWebhook: {
    configured: boolean;
    url: string;
  };
}

export interface NotificationPayload {
  event: string;
  timestamp: string;
  userHash: string;
  mood: string;
  theme?: string;
  tags?: string[];
  summarySnippet: string;
  locationSummary?: string;
}


export interface InteractionMessage {
  id: string;
  userId: string;
  entryId?: string;
  role: 'user' | 'model';
  content: string;
  mode?: 'reflection' | 'summary' | 'brainstorm' | 'chat';
  modelUsed?: string;
  createdAt: number;
}

export interface EntryAnalysis {
  summary: string;
  theme: string;
  keyTakeaways: string[];
  followUpQuestions: string[];
  modelUsed?: string;
}

export interface SaveErrorState {
  hasError: boolean;
  message: string;
  failedPayload?: any;
  retryAction?: () => Promise<void>;
}
