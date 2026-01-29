// Core types for Sutra-Code frontend
export interface AuthUser {
  userId: string;
  email: string;
  phoneNumber?: string;
  userRole: 'student' | 'recruiter';
  preferredLanguage: string;
  gritScore: number;
  skillLevel: number;
  accessToken: string;
  idToken: string;
  refreshToken: string;
  sessionTimeout: number;
  mfaEnabled: boolean;
}

export interface ChatMessage {
  id: string;
  type: 'student' | 'mentor';
  content: string;
  timestamp: number;
  culturalAnalogy?: string;
  followUpQuestions?: string[];
  sessionId: string;
  isTyping?: boolean;
}

export interface SocraticResponse {
  sessionId: string;
  culturalAnalogy: string;
  guidingQuestion: string;
  hint?: string;
  nextStepIndicator: string;
  sessionState: ConversationContext;
  frictionLevel: number;
  conceptualDepth: number;
}

export interface ConversationContext {
  currentConcept?: string;
  questionHistory: Question[];
  analogyHistory: Analogy[];
  understandingLevel: number;
  nextSteps: string[];
  culturalContext: string;
  strugglingPatterns: string[];
  lastInteractionTime: number;
}

export interface Question {
  id: string;
  question: string;
  timestamp: number;
  studentResponse?: string;
  responseTime?: number;
  conceptualAccuracy?: number;
}

export interface Analogy {
  id: string;
  concept: string;
  culturalContext: string;
  analogy: string;
  effectiveness?: number;
  timestamp: number;
}

export interface StudentProfile {
  studentId: string;
  preferredLanguage: string;
  skillLevel: number;
  culturalPreferences: string[];
  strugglingConcepts: string[];
  masteredConcepts: string[];
  gritScore: number;
  regionContext?: string;
  ipGeolocation?: {
    state: string;
    city: string;
    region: string;
  };
}

export interface ChatSession {
  sessionId: string;
  studentId: string;
  startTime: number;
  lastActivity: number;
  messageCount: number;
  currentConcept?: string;
  isActive: boolean;
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export interface CulturalAnalogy {
  analogyId: string;
  concept: string;
  culturalContext: string;
  analogy: string;
  conceptMapping: ConceptMapping;
  followUpQuestions: string[];
  effectiveness?: number;
  alternativeAnalogies?: string[];
}

export interface ConceptMapping {
  programmingConcept: string;
  culturalElement: string;
  mappingRationale: string;
  keyConnections: string[];
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'message' | 'typing' | 'session_update' | 'error' | 'chat_message' | 'join_session' | 'leave_session' | 'ping' | 'pong';
  data: any;
  timestamp: number;
}

// Voice recording types
export interface VoiceRecording {
  id: string;
  audioBlob: Blob;
  duration: number;
  timestamp: number;
  transcription?: string;
  language: string;
}

// Progress tracking
export interface LearningProgress {
  conceptsExplored: string[];
  analogiesUsed: string[];
  questionsAsked: number;
  sessionDuration: number;
  gritScoreChange: number;
  strugglingAreas: string[];
  breakthroughMoments: number;
}

// UI State types
export interface UIState {
  isSidebarOpen: boolean;
  currentView: 'chat' | 'profile' | 'progress' | 'settings';
  theme: 'light' | 'dark';
  language: string;
  isTyping: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
}

// Form types
export interface SignUpForm {
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  givenName: string;
  familyName: string;
  userRole: 'student' | 'recruiter';
  institutionName?: string;
  preferredLanguage: string;
  dataConsentGiven: boolean;
  aadhaarOptional: boolean;
}

export interface SignInForm {
  email: string;
  password: string;
  mfaCode?: string;
  rememberMe: boolean;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}

// Chat input types
export interface ChatInputState {
  message: string;
  isRecording: boolean;
  recordingDuration: number;
  attachments: File[];
}

// Notification types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}