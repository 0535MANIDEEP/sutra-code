import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import axios from 'axios';

// Environment variables
const BHASHINI_API_KEY = process.env.BHASHINI_API_KEY!;
const BHASHINI_BASE_URL = process.env.BHASHINI_BASE_URL || 'https://dhruva-api.bhashini.gov.in/services';

// Interfaces
interface LanguageDetectionRequest {
  text: string;
  supportedLanguages: string[];
}

interface LanguageDetectionResponse {
  detectedLanguage: string;
  confidence: number;
  alternativeLanguages: { language: string; confidence: number }[];
}

interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: 'technical' | 'cultural' | 'general';
}

interface TranslationResponse {
  translatedText: string;
  confidence: number;
  culturalAdaptations?: string[];
  technicalTerms?: { [key: string]: string };
}

interface ValidationRequest {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

interface ValidationResponse {
  accuracy: number;
  issues: string[];
}

interface BhashiniDetectionRequest {
  config: {
    serviceId: string;
    language: {
      sourceLanguage: string;
    };
  };
  input: {
    source: string;
  };
}

interface BhashiniTranslationRequest {
  config: {
    serviceId: string;
    language: {
      sourceLanguage: string;
      targetLanguage: string;
    };
  };
  input: {
    source: string;
  };
}

// Supported languages mapping for Bhashini API
export const BHASHINI_LANGUAGE_CODES = {
  'en': 'en',
  'hi': 'hi',
  'ta': 'ta',
  'te': 'te',
  'bn': 'bn',
  'mr': 'mr',
  'gu': 'gu',
  'kn': 'kn',
  'ml': 'ml',
  'or': 'or',
  'pa': 'pa',
  'as': 'as',
  'ur': 'ur',
  'sa': 'sa',
  'kok': 'kok',
  'mni': 'mni',
  'ne': 'ne',
  'brx': 'brx',
  'sat': 'sat',
  'mai': 'mai',
  'ks': 'ks',
  'sd': 'sd',
  'doi': 'doi',
};

// Technical terms that should remain in English
const TECHNICAL_TERMS = [
  'algorithm', 'function', 'variable', 'array', 'object', 'class', 'method',
  'loop', 'condition', 'parameter', 'return', 'import', 'export', 'async',
  'await', 'promise', 'callback', 'API', 'JSON', 'HTTP', 'URL', 'database',
  'server', 'client', 'frontend', 'backend', 'framework', 'library',
];

/**
 * Main Lambda handler for Language Processor
 * Implements multilingual support with Bhashini integration
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Language Processor - Processing request:', {
    path: event.path,
    method: event.httpMethod,
    body: event.body ? (() => {
      try {
        return JSON.parse(event.body);
      } catch {
        return 'Invalid JSON';
      }
    })() : null,
  });

  try {
    switch (event.httpMethod) {
      case 'POST':
        return await handleLanguageAction(event);
      case 'GET':
        return await handleGetLanguageInfo(event);
      default:
        return createErrorResponse(405, 'Method not allowed');
    }
  } catch (error) {
    console.error('Language Processor error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
};

/**
 * Handle POST requests for language actions
 */
async function handleLanguageAction(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return createErrorResponse(400, 'Request body is required');
  }

  let requestBody: any;
  try {
    requestBody = JSON.parse(event.body);
  } catch (error) {
    return createErrorResponse(400, 'Invalid JSON in request body');
  }

  const action = event.pathParameters?.action;
  if (!action) {
    return createErrorResponse(400, 'Action parameter is required');
  }

  try {
    let response: any;

    switch (action) {
      case 'detect':
        response = await detectLanguage(requestBody as LanguageDetectionRequest);
        break;
      case 'translate':
        response = await translateText(requestBody as TranslationRequest);
        break;
      case 'validate':
        response = await validateTranslation(requestBody as ValidationRequest);
        break;
      default:
        return createErrorResponse(400, `Invalid action: ${action}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error(`Error handling action ${action}:`, error);
    return createErrorResponse(500, `Failed to process ${action}`);
  }
}

/**
 * Detect language using Bhashini API
 * Requirements: 6.3
 */
async function detectLanguage(request: LanguageDetectionRequest): Promise<LanguageDetectionResponse> {
  try {
    // Use Bhashini language detection service
    const detectionRequest: BhashiniDetectionRequest = {
      config: {
        serviceId: 'ai4bharat/indiclid-gpu--t4',
        language: {
          sourceLanguage: 'auto', // Auto-detect
        },
      },
      input: {
        source: request.text,
      },
    };

    const response = await axios.post(
      `${BHASHINI_BASE_URL}/inference/pipeline`,
      detectionRequest,
      {
        headers: {
          'Authorization': `Bearer ${BHASHINI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      }
    );

    if (response.data && response.data.pipelineResponse) {
      const detection = response.data.pipelineResponse[0];
      const detectedLang = detection.output[0].source || 'en';
      const confidence = detection.config?.confidence || 0.8;

      return {
        detectedLanguage: detectedLang,
        confidence,
        alternativeLanguages: [], // Bhashini doesn't provide alternatives
      };
    }

    throw new Error('Invalid response from Bhashini detection API');

  } catch (error) {
    console.error('Error detecting language with Bhashini:', error);
    
    // Fallback: simple character-based detection
    return fallbackLanguageDetection(request.text);
  }
}

/**
 * Translate text using Bhashini API
 * Requirements: 6.2 - Translation with 95% accuracy
 */
async function translateText(request: TranslationRequest): Promise<TranslationResponse> {
  try {
    const sourceCode = BHASHINI_LANGUAGE_CODES[request.sourceLanguage as keyof typeof BHASHINI_LANGUAGE_CODES] || 'en';
    const targetCode = BHASHINI_LANGUAGE_CODES[request.targetLanguage as keyof typeof BHASHINI_LANGUAGE_CODES] || 'en';

    // If source and target are the same, return original text
    if (sourceCode === targetCode) {
      return {
        translatedText: request.text,
        confidence: 1.0,
        culturalAdaptations: [],
        technicalTerms: {},
      };
    }

    // Preserve technical terms
    const { processedText, technicalTerms } = preserveTechnicalTerms(request.text);

    const translationRequest: BhashiniTranslationRequest = {
      config: {
        serviceId: 'ai4bharat/indictrans-v2-gpu--t4',
        language: {
          sourceLanguage: sourceCode,
          targetLanguage: targetCode,
        },
      },
      input: {
        source: processedText,
      },
    };

    const response = await axios.post(
      `${BHASHINI_BASE_URL}/inference/pipeline`,
      translationRequest,
      {
        headers: {
          'Authorization': `Bearer ${BHASHINI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000, // 15 second timeout
      }
    );

    if (response.data && response.data.pipelineResponse) {
      const translation = response.data.pipelineResponse[0];
      let translatedText = translation.output[0].target || request.text;
      
      // Restore technical terms
      translatedText = restoreTechnicalTerms(translatedText, technicalTerms);
      
      // Get cultural adaptations based on context
      const culturalAdaptations = await getCulturalAdaptations(
        request.text,
        translatedText,
        request.sourceLanguage,
        request.targetLanguage,
        request.context
      );

      return {
        translatedText,
        confidence: translation.config?.confidence || 0.9,
        culturalAdaptations,
        technicalTerms,
      };
    }

    throw new Error('Invalid response from Bhashini translation API');

  } catch (error) {
    console.error('Error translating text with Bhashini:', error);
    
    // Fallback: return original text with low confidence
    return {
      translatedText: request.text,
      confidence: 0.1,
      culturalAdaptations: [],
      technicalTerms: {},
    };
  }
}

/**
 * Validate translation accuracy
 * Requirements: 6.3
 */
async function validateTranslation(request: ValidationRequest): Promise<ValidationResponse> {
  try {
    // Basic validation checks
    const issues: string[] = [];
    let accuracy = 0.9; // Start with high accuracy

    // Length validation
    const lengthRatio = request.translatedText.length / request.originalText.length;
    if (lengthRatio < 0.3 || lengthRatio > 3.0) {
      issues.push('Significant length difference detected');
      accuracy -= 0.2;
    }

    // Check for untranslated text
    if (request.originalText === request.translatedText && 
        request.sourceLanguage !== request.targetLanguage) {
      issues.push('Text appears untranslated');
      accuracy -= 0.3;
    }

    // Check for preserved technical terms
    const technicalTermsInOriginal = TECHNICAL_TERMS.filter(term => 
      request.originalText.toLowerCase().includes(term.toLowerCase())
    );
    
    const technicalTermsInTranslation = TECHNICAL_TERMS.filter(term => 
      request.translatedText.toLowerCase().includes(term.toLowerCase())
    );

    if (technicalTermsInOriginal.length > technicalTermsInTranslation.length) {
      issues.push('Some technical terms may have been incorrectly translated');
      accuracy -= 0.1;
    }

    // Character encoding validation
    if (hasEncodingIssues(request.translatedText)) {
      issues.push('Character encoding issues detected');
      accuracy -= 0.1;
    }

    return {
      accuracy: Math.max(0, Math.min(1, accuracy)),
      issues,
    };

  } catch (error) {
    console.error('Error validating translation:', error);
    
    return {
      accuracy: 0.5,
      issues: ['Validation service temporarily unavailable'],
    };
  }
}

/**
 * Get cultural adaptations for translation
 */
async function getCulturalAdaptations(
  originalText: string,
  translatedText: string,
  sourceLanguage: string,
  targetLanguage: string,
  context?: string
): Promise<string[]> {
  const adaptations: string[] = [];

  // Cultural context mappings
  const culturalMappings: { [key: string]: { [key: string]: string } } = {
    'hi': {
      'cricket': 'क्रिकेट',
      'bollywood': 'बॉलीवुड',
      'festival': 'त्योहार',
      'mandi': 'मंडी',
    },
    'ta': {
      'cricket': 'கிரிக்கெட்',
      'kollywood': 'கொல்லிவுட்',
      'temple': 'கோயில்',
      'classical_music': 'கர்நாடக संगीत',
    },
    // Add more language-specific mappings
  };

  // Check if cultural terms need adaptation
  const targetMappings = culturalMappings[targetLanguage];
  if (targetMappings && context === 'cultural') {
    Object.entries(targetMappings).forEach(([english, native]) => {
      if (originalText.toLowerCase().includes(english)) {
        adaptations.push(`Consider using "${native}" instead of "${english}" for better cultural relevance`);
      }
    });
  }

  return adaptations;
}

/**
 * Preserve technical terms during translation
 */
function preserveTechnicalTerms(text: string): { processedText: string; technicalTerms: { [key: string]: string } } {
  const technicalTerms: { [key: string]: string } = {};
  let processedText = text;

  TECHNICAL_TERMS.forEach((term, index) => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = text.match(regex);
    
    if (matches) {
      matches.forEach((match) => {
        const placeholder = `__TECH_TERM_${index}__`;
        technicalTerms[placeholder] = match;
        processedText = processedText.replace(match, placeholder);
      });
    }
  });

  return { processedText, technicalTerms };
}

/**
 * Restore technical terms after translation
 */
function restoreTechnicalTerms(translatedText: string, technicalTerms: { [key: string]: string }): string {
  let restoredText = translatedText;

  Object.entries(technicalTerms).forEach(([placeholder, originalTerm]) => {
    restoredText = restoredText.replace(new RegExp(placeholder, 'g'), originalTerm);
  });

  return restoredText;
}

/**
 * Fallback language detection using character patterns
 */
function fallbackLanguageDetection(text: string): LanguageDetectionResponse {
  const patterns = {
    'hi': /[\u0900-\u097F]/,
    'ta': /[\u0B80-\u0BFF]/,
    'te': /[\u0C00-\u0C7F]/,
    'bn': /[\u0980-\u09FF]/,
    'gu': /[\u0A80-\u0AFF]/,
    'kn': /[\u0C80-\u0CFF]/,
    'ml': /[\u0D00-\u0D7F]/,
    'or': /[\u0B00-\u0B7F]/,
    'pa': /[\u0A00-\u0A7F]/,
    'ur': /[\u0600-\u06FF]/,
  };

  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      return {
        detectedLanguage: lang,
        confidence: 0.7,
        alternativeLanguages: [],
      };
    }
  }

  // Default to English
  return {
    detectedLanguage: 'en',
    confidence: 0.5,
    alternativeLanguages: [],
  };
}

/**
 * Check for character encoding issues
 */
function hasEncodingIssues(text: string): boolean {
  // Check for common encoding issue patterns
  const encodingIssuePatterns = [
    /�/, // Replacement character
    /\uFFFD/, // Unicode replacement character
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/, // Control characters
  ];

  return encodingIssuePatterns.some(pattern => pattern.test(text));
}

/**
 * Handle GET requests for language information
 */
async function handleGetLanguageInfo(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const action = event.pathParameters?.action;
  
  if (action === 'supported') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        supportedLanguages: Object.keys(BHASHINI_LANGUAGE_CODES),
        totalLanguages: Object.keys(BHASHINI_LANGUAGE_CODES).length,
      }),
    };
  }

  return createErrorResponse(400, 'Invalid action for GET request');
}

/**
 * Create error response
 */
function createErrorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      error: message,
      timestamp: new Date().toISOString(),
    }),
  };
}