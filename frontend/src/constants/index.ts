import { LanguageOption } from '../types';

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_GATEWAY_URL || 'https://api.sutra-code.edu.in',
  REGION: process.env.REACT_APP_AWS_REGION || 'ap-south-1',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

// AWS Cognito Configuration
export const COGNITO_CONFIG = {
  USER_POOL_ID: process.env.REACT_APP_USER_POOL_ID || '',
  CLIENT_ID: process.env.REACT_APP_CLIENT_ID || '',
  IDENTITY_POOL_ID: process.env.REACT_APP_IDENTITY_POOL_ID || '',
  REGION: process.env.REACT_APP_AWS_REGION || 'ap-south-1',
};

// WebSocket Configuration
export const WEBSOCKET_CONFIG = {
  URL: process.env.REACT_APP_WEBSOCKET_URL || 'wss://ws.sutra-code.edu.in',
  RECONNECT_INTERVAL: 5000, // 5 seconds
  MAX_RECONNECT_ATTEMPTS: 10,
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
};

// Supported Indian Languages (22 languages as per requirements)
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇮🇳' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇮🇳' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', flag: '🇮🇳' },
  { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी', flag: '🇮🇳' },
  { code: 'mni', name: 'Manipuri', nativeName: 'মৈতৈলোন্', flag: '🇮🇳' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', flag: '🇮🇳' },
  { code: 'brx', name: 'Bodo', nativeName: 'बर\'', flag: '🇮🇳' },
  { code: 'sat', name: 'Santhali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', flag: '🇮🇳' },
  { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', flag: '🇮🇳' },
  { code: 'ks', name: 'Kashmiri', nativeName: 'कॉशुर', flag: '🇮🇳' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي', flag: '🇮🇳' },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी', flag: '🇮🇳' },
];

// Cultural Context Icons
export const CULTURAL_ICONS = {
  cricket: '🏏',
  mandi: '🏪',
  festivals: '🎉',
  railways: '🚂',
  bollywood: '🎬',
  temple: '🛕',
  family: '👨‍👩‍👧‍👦',
  food: '🍛',
  music: '🎵',
  dance: '💃',
};

// Programming Concepts
export const PROGRAMMING_CONCEPTS = [
  'sorting',
  'searching',
  'recursion',
  'graphs',
  'queues',
  'arrays',
  'loops',
  'functions',
  'classes',
  'inheritance',
  'trees',
  'stacks',
  'hash_tables',
  'dynamic_programming',
  'greedy_algorithms',
];

// Chat Configuration
export const CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: 1000,
  TYPING_INDICATOR_DELAY: 1000, // 1 second
  MESSAGE_BATCH_SIZE: 50,
  AUTO_SCROLL_THRESHOLD: 100, // pixels from bottom
  VOICE_RECORDING_MAX_DURATION: 300, // 5 minutes in seconds
  FILE_UPLOAD_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_FILE_TYPES: ['.txt', '.pdf', '.doc', '.docx', '.py', '.js', '.java', '.cpp'],
};

// UI Constants
export const UI_CONSTANTS = {
  SIDEBAR_WIDTH: 280,
  HEADER_HEIGHT: 64,
  MOBILE_BREAKPOINT: 768,
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 5000,
  DEBOUNCE_DELAY: 300,
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  AUTH_FAILED: 'Authentication failed. Please sign in again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  INVALID_INPUT: 'Please check your input and try again.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  VOICE_NOT_SUPPORTED: 'Voice recording is not supported in your browser.',
  MICROPHONE_ACCESS_DENIED: 'Microphone access denied. Please enable microphone permissions.',
  FILE_TOO_LARGE: 'File size exceeds the maximum limit of 10MB.',
  UNSUPPORTED_FILE_TYPE: 'File type not supported. Please upload a valid file.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  SIGN_IN_SUCCESS: 'Successfully signed in!',
  SIGN_UP_SUCCESS: 'Account created successfully! Please check your email for verification.',
  MESSAGE_SENT: 'Message sent successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  LANGUAGE_CHANGED: 'Language preference updated!',
  VOICE_RECORDED: 'Voice message recorded successfully!',
};

// Local Storage Keys
export const STORAGE_KEYS = {
  USER_DATA: 'sutra_code_user',
  TOKENS: 'sutra_code_tokens',
  CHAT_HISTORY: 'sutra_code_chat_history',
  PREFERENCES: 'sutra_code_preferences',
  THEME: 'sutra_code_theme',
  LANGUAGE: 'sutra_code_language',
};

// API Endpoints
export const API_ENDPOINTS = {
  // Authentication
  AUTH_VALIDATE: '/auth/validate',
  AUTH_REFRESH: '/auth/refresh',
  
  // Socratic Engine
  SOCRATIC_ASK: '/v1/socratic/ask',
  SOCRATIC_CONTEXT: '/v1/socratic/context',
  
  // Cultural Analogies
  ANALOGIES_GENERATE: '/v1/analogies/generate',
  ANALOGIES_FEEDBACK: '/v1/analogies/feedback',
  
  // User Profiles
  PROFILES: '/v1/profiles',
  
  // Health Check
  HEALTH: '/health',
};

// Grit Score Ranges
export const GRIT_SCORE_RANGES = {
  BEGINNER: { min: 0, max: 30, label: 'Building Foundation', color: 'text-red-500' },
  DEVELOPING: { min: 31, max: 60, label: 'Developing Resilience', color: 'text-yellow-500' },
  STRONG: { min: 61, max: 80, label: 'Strong Perseverance', color: 'text-blue-500' },
  EXCEPTIONAL: { min: 81, max: 100, label: 'Exceptional Grit', color: 'text-green-500' },
};

// Skill Level Descriptions
export const SKILL_LEVELS = {
  1: 'Complete Beginner',
  2: 'Basic Understanding',
  3: 'Novice',
  4: 'Developing',
  5: 'Intermediate',
  6: 'Competent',
  7: 'Proficient',
  8: 'Advanced',
  9: 'Expert',
  10: 'Master',
};

// Cultural Contexts for Different Regions
export const REGIONAL_CONTEXTS = {
  mumbai: ['bollywood', 'local_trains', 'street_food', 'business_hub'],
  delhi: ['metro_system', 'government', 'historical_monuments', 'political_center'],
  bangalore: ['it_industry', 'pub_culture', 'weather', 'startup_ecosystem'],
  chennai: ['kollywood', 'classical_music', 'temples', 'automobile_industry'],
  kolkata: ['literature', 'fish_markets', 'trams', 'cultural_heritage'],
  hyderabad: ['biryani', 'it_corridor', 'nizami_culture', 'pearls'],
  pune: ['education_hub', 'automotive', 'weather', 'cultural_programs'],
  ahmedabad: ['textile_industry', 'business_community', 'street_food', 'festivals'],
};

// Default User Preferences
export const DEFAULT_PREFERENCES = {
  language: 'en',
  theme: 'light',
  notifications: true,
  voiceEnabled: true,
  culturalContext: 'general',
  autoTranslate: false,
  fontSize: 'medium',
  animationsEnabled: true,
};