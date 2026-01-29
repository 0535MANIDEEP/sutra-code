import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { LanguageOption } from '../types';
import { STORAGE_KEYS } from '../constants';
import { useAuth } from './AuthContext';
import { languageService, Language, SUPPORTED_LANGUAGES } from '../services/languageService';

interface LanguageContextType {
  currentLanguage: Language;
  supportedLanguages: Language[];
  changeLanguage: (languageCode: string) => Promise<boolean>;
  isRTL: boolean;
  getLocalizedText: (key: string) => string;
  detectLanguage: (text: string) => Promise<any>;
  translateText: (text: string, targetLanguage: string) => Promise<any>;
  getCulturalContexts: () => string[];
  getPreferredCulturalContext: () => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

// Basic localization strings (in a real app, these would come from translation files)
const LOCALIZATION_STRINGS: Record<string, Record<string, string>> = {
  en: {
    welcome: 'Welcome to Sutra-Code',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    signOut: 'Sign Out',
    chat: 'Chat',
    profile: 'Profile',
    settings: 'Settings',
    progress: 'Progress',
    loading: 'Loading...',
    error: 'An error occurred',
    retry: 'Retry',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    send: 'Send',
    typing: 'Typing...',
    connecting: 'Connecting...',
    connected: 'Connected',
    disconnected: 'Disconnected',
    voiceRecording: 'Recording...',
    voiceProcessing: 'Processing voice...',
    culturalAnalogy: 'Cultural Analogy',
    gritScore: 'Grit Score',
    skillLevel: 'Skill Level',
    preferredLanguage: 'Preferred Language',
    selectLanguage: 'Select Language',
  },
  hi: {
    welcome: 'सूत्र-कोड में आपका स्वागत है',
    signIn: 'साइन इन करें',
    signUp: 'साइन अप करें',
    signOut: 'साइन आउट करें',
    chat: 'चैट',
    profile: 'प्रोफाइल',
    settings: 'सेटिंग्स',
    progress: 'प्रगति',
    loading: 'लोड हो रहा है...',
    error: 'एक त्रुटि हुई',
    retry: 'पुनः प्रयास करें',
    cancel: 'रद्द करें',
    save: 'सेव करें',
    delete: 'डिलीट करें',
    edit: 'संपादित करें',
    send: 'भेजें',
    typing: 'टाइप कर रहे हैं...',
    connecting: 'कनेक्ट हो रहा है...',
    connected: 'कनेक्टेड',
    disconnected: 'डिस्कनेक्टेड',
    voiceRecording: 'रिकॉर्डिंग...',
    voiceProcessing: 'आवाज़ प्रोसेसिंग...',
    culturalAnalogy: 'सांस्कृतिक उदाहरण',
    gritScore: 'दृढ़ता स्कोर',
    skillLevel: 'कौशल स्तर',
    preferredLanguage: 'पसंदीदा भाषा',
    selectLanguage: 'भाषा चुनें',
  },
  ta: {
    welcome: 'சூத்ர-கோடுக்கு வரவேற்கிறோம்',
    signIn: 'உள்நுழைக',
    signUp: 'பதிவு செய்க',
    signOut: 'வெளியேறு',
    chat: 'அரட்டை',
    profile: 'சுயவிவரம்',
    settings: 'அமைப்புகள்',
    progress: 'முன்னேற்றம்',
    loading: 'ஏற்றுகிறது...',
    error: 'பிழை ஏற்பட்டது',
    retry: 'மீண்டும் முயற்சிக்கவும்',
    cancel: 'ரத்து செய்',
    save: 'சேமி',
    delete: 'நீக்கு',
    edit: 'திருத்து',
    send: 'அனுப்பு',
    typing: 'தட்டச்சு செய்கிறது...',
    connecting: 'இணைக்கிறது...',
    connected: 'இணைக்கப்பட்டது',
    disconnected: 'துண்டிக்கப்பட்டது',
    voiceRecording: 'பதிவு செய்கிறது...',
    voiceProcessing: 'குரல் செயலாக்கம்...',
    culturalAnalogy: 'கலாச்சார உதாரணம்',
    gritScore: 'உறுதி மதிப்பெண்',
    skillLevel: 'திறன் நிலை',
    preferredLanguage: 'விருப்பமான மொழி',
    selectLanguage: 'மொழியைத் தேர்ந்தெடுக்கவும்',
  },
  // Add more languages as needed
};

// RTL languages
const RTL_LANGUAGES = ['ur', 'ar'];

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState<Language>(SUPPORTED_LANGUAGES[0]);

  useEffect(() => {
    // Initialize language from user preference, localStorage, or browser
    const initializeLanguage = async () => {
      let languageCode = 'en';

      // Priority 1: User preference from profile
      if (user?.preferredLanguage) {
        languageCode = user.preferredLanguage;
      }
      // Priority 2: Saved preference in localStorage
      else {
        const savedLanguage = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
        if (savedLanguage) {
          languageCode = savedLanguage;
        }
        // Priority 3: Browser language
        else {
          const browserLanguage = navigator.language.split('-')[0];
          const supportedLanguage = SUPPORTED_LANGUAGES.find((lang: Language) => lang.code === browserLanguage);
          if (supportedLanguage) {
            languageCode = browserLanguage;
          }
        }
      }

      // Set language using the language service
      const success = await languageService.setLanguage(languageCode);
      if (success) {
        setCurrentLanguage(languageService.getCurrentLanguage());
        
        // Update document attributes
        document.documentElement.lang = languageCode;
        document.documentElement.dir = languageService.isRTL() ? 'rtl' : 'ltr';
      }
    };

    initializeLanguage();
  }, [user]);

  const changeLanguage = async (languageCode: string): Promise<boolean> => {
    const success = await languageService.setLanguage(languageCode);
    if (success) {
      setCurrentLanguage(languageService.getCurrentLanguage());
      
      // Update document attributes
      document.documentElement.lang = languageCode;
      document.documentElement.dir = languageService.isRTL() ? 'rtl' : 'ltr';
      
      // TODO: Update user profile with new language preference
      // This would typically involve an API call to update the user's profile
      
      return true;
    }
    return false;
  };

  const getLocalizedText = (key: string): string => {
    return languageService.getLocalizedText(key);
  };

  const detectLanguage = async (text: string) => {
    return await languageService.detectLanguage(text);
  };

  const translateText = async (text: string, targetLanguage: string) => {
    return await languageService.translateText({
      text,
      sourceLanguage: currentLanguage.code,
      targetLanguage,
      context: 'general',
    });
  };

  const getCulturalContexts = (): string[] => {
    return languageService.getCulturalContexts();
  };

  const getPreferredCulturalContext = (): string => {
    return languageService.getPreferredCulturalContext();
  };

  const value: LanguageContextType = {
    currentLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    changeLanguage,
    isRTL: languageService.isRTL(),
    getLocalizedText,
    detectLanguage,
    translateText,
    getCulturalContexts,
    getPreferredCulturalContext,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};