export interface Language {
  code: string;
  name: string;
  nativeName: string;
  bhashiniCode: string;
  region: string;
  flag: string;
  rtl: boolean;
  culturalContexts: string[];
}

export const SUPPORTED_LANGUAGES: Language[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    bhashiniCode: 'en',
    region: 'pan-india',
    flag: '',
    rtl: false,
    culturalContexts: ['cricket', 'bollywood', 'it_industry', 'business']
  }
];

export class LanguageService {
  private currentLanguage: Language;

  constructor() {
    this.currentLanguage = SUPPORTED_LANGUAGES[0];
  }

  getCurrentLanguage(): Language {
    return this.currentLanguage;
  }

  async setLanguage(languageCode: string): Promise<boolean> {
    const language = SUPPORTED_LANGUAGES.find(lang => lang.code === languageCode);
    if (!language) {
      return false;
    }
    this.currentLanguage = language;
    return true;
  }

  getSupportedLanguages(): Language[] {
    return SUPPORTED_LANGUAGES;
  }

  getCulturalContexts(): string[] {
    return this.currentLanguage.culturalContexts;
  }

  getPreferredCulturalContext(): string {
    return this.currentLanguage.culturalContexts[0];
  }

  isRTL(): boolean {
    return this.currentLanguage.rtl;
  }

  getLocalizedText(key: string): string {
    return key;
  }

  async detectLanguage(text: string): Promise<any> {
    return { detectedLanguage: 'en', confidence: 0.8 };
  }

  async translateText(request: any): Promise<any> {
    return { translatedText: request.text, confidence: 0.9 };
  }
}

export const languageService = new LanguageService();
