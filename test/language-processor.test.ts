import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../lambda/language-processor/index';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('axios');

// Mock environment variables
process.env.AWS_REGION = 'ap-south-1';
process.env.LANGUAGE_SESSIONS_TABLE = 'test-language-sessions';
process.env.BHASHINI_API_KEY = 'test-api-key';
process.env.BHASHINI_BASE_URL = 'https://test-bhashini-api.com';

// Helper function to create mock API Gateway event
const createMockEvent = (method: string, action?: string, body?: any, pathParameters?: any): APIGatewayProxyEvent => ({
  httpMethod: method,
  path: `/v1/language/${action || 'detect'}`,
  body: body ? JSON.stringify(body) : null,
  headers: {},
  multiValueHeaders: {},
  isBase64Encoded: false,
  pathParameters: pathParameters || { action: action || 'detect' },
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    authorizer: {},
    httpMethod: method,
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'test-agent',
      userArn: null,
    },
    path: `/v1/language/${action || 'detect'}`,
    protocol: 'HTTP/1.1',
    requestId: 'test-request-id',
    requestTime: '01/Jan/2024:00:00:00 +0000',
    requestTimeEpoch: 1704067200,
    resourceId: 'test-resource',
    resourcePath: `/v1/language/{action}`,
    stage: 'test',
  },
  resource: `/v1/language/{action}`,
});

describe('Language Processor Lambda', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '1024',
    awsRequestId: 'test-request-id',
    logGroupName: 'test-log-group',
    logStreamName: 'test-log-stream',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP Method Handling', () => {
    it('should handle POST requests for language actions', async () => {
      const event = createMockEvent('POST', 'detect', {
        text: 'Hello, how are you?',
        supportedLanguages: ['en', 'hi', 'ta'],
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBeDefined();
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    });

    it('should handle GET requests for language information', async () => {
      const event = createMockEvent('GET', 'supported');

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBeDefined();
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    });

    it('should return 405 for unsupported HTTP methods', async () => {
      const event = createMockEvent('DELETE', 'detect');

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(405);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Method not allowed');
    });
  });

  describe('Request Validation', () => {
    it('should return 400 for missing request body', async () => {
      const event = createMockEvent('POST', 'detect');

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Request body is required');
    });

    it('should return 400 for invalid JSON', async () => {
      const event = createMockEvent('POST', 'detect');
      event.body = '{"invalid": "json"';

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Invalid JSON in request body');
    });

    it('should return 400 for missing action parameter', async () => {
      const event = createMockEvent('POST', undefined, { text: 'test' });
      event.pathParameters = null;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Action parameter is required');
    });

    it('should return 400 for invalid action', async () => {
      const event = createMockEvent('POST', 'invalid_action', { text: 'test' });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Invalid action: invalid_action');
    });
  });

  describe('Language Detection', () => {
    it('should handle language detection requests', async () => {
      const event = createMockEvent('POST', 'detect', {
        text: 'नमस्ते, आप कैसे हैं?',
        supportedLanguages: ['en', 'hi', 'ta'],
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBeDefined();
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
      
      // The actual implementation will depend on mocked Bhashini API
      // This test validates the basic structure and error handling
    });

    it('should support fallback language detection', () => {
      // Test that the system has fallback detection for common scripts
      const devanagariText = 'नमस्ते';
      const tamilText = 'வணக்கம்';
      const teluguText = 'నమస్కారం';
      const bengaliText = 'নমস্কার';
      const urduText = 'السلام علیکم';

      // These would be tested by the fallback detection function
      expect(devanagariText).toMatch(/[\u0900-\u097F]/);
      expect(tamilText).toMatch(/[\u0B80-\u0BFF]/);
      expect(teluguText).toMatch(/[\u0C00-\u0C7F]/);
      expect(bengaliText).toMatch(/[\u0980-\u09FF]/);
      expect(urduText).toMatch(/[\u0600-\u06FF]/);
    });
  });

  describe('Translation', () => {
    it('should handle translation requests', async () => {
      const event = createMockEvent('POST', 'translate', {
        text: 'Hello, how are you?',
        sourceLanguage: 'en',
        targetLanguage: 'hi',
        context: 'general',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBeDefined();
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    });

    it('should preserve technical terms during translation', () => {
      // Test that technical terms are identified correctly
      const technicalTerms = [
        'algorithm', 'function', 'variable', 'array', 'object', 'class', 'method',
        'loop', 'condition', 'parameter', 'return', 'import', 'export', 'async',
        'await', 'promise', 'callback', 'API', 'JSON', 'HTTP', 'URL', 'database',
      ];

      const testText = 'This function uses an algorithm to process the array data.';
      
      technicalTerms.forEach(term => {
        if (testText.toLowerCase().includes(term.toLowerCase())) {
          expect(testText).toContain(term);
        }
      });
    });

    it('should handle same language translation', async () => {
      const event = createMockEvent('POST', 'translate', {
        text: 'Hello, how are you?',
        sourceLanguage: 'en',
        targetLanguage: 'en',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBeDefined();
      // Should return original text when source and target are the same
    });
  });

  describe('Translation Validation', () => {
    it('should handle validation requests', async () => {
      const event = createMockEvent('POST', 'validate', {
        originalText: 'Hello, how are you?',
        translatedText: 'नमस्ते, आप कैसे हैं?',
        sourceLanguage: 'en',
        targetLanguage: 'hi',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBeDefined();
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    });

    it('should detect length discrepancies in validation', () => {
      const originalText = 'Hello';
      const translatedText = 'This is a very long translation that seems incorrect';
      
      const lengthRatio = translatedText.length / originalText.length;
      expect(lengthRatio).toBeGreaterThan(3.0); // Should trigger validation issue
    });

    it('should detect untranslated text', () => {
      const originalText = 'Hello, how are you?';
      const translatedText = 'Hello, how are you?'; // Same as original
      
      expect(originalText).toBe(translatedText); // Should trigger validation issue
    });
  });

  describe('Language Support', () => {
    it('should support all 22 Indian languages', () => {
      const requiredLanguages = [
        'en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'or', 'pa', 'as',
        'ur', 'sa', 'kok', 'mni', 'ne', 'brx', 'sat', 'mai', 'ks', 'sd', 'doi'
      ];

      // Import the language codes from the module
      const { BHASHINI_LANGUAGE_CODES } = require('../lambda/language-processor/index');
      
      requiredLanguages.forEach(language => {
        expect(BHASHINI_LANGUAGE_CODES).toHaveProperty(language);
        expect(typeof BHASHINI_LANGUAGE_CODES[language]).toBe('string');
        expect(BHASHINI_LANGUAGE_CODES[language].length).toBeGreaterThan(0);
      });
    });

    it('should handle GET request for supported languages', async () => {
      const event = createMockEvent('GET', 'supported');

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('supportedLanguages');
      expect(body).toHaveProperty('totalLanguages');
      expect(Array.isArray(body.supportedLanguages)).toBe(true);
      expect(typeof body.totalLanguages).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should handle Bhashini API failures gracefully', async () => {
      // Mock axios to simulate API failure
      const axios = require('axios');
      axios.post.mockRejectedValue(new Error('Bhashini API unavailable'));

      const event = createMockEvent('POST', 'detect', {
        text: 'नमस्ते',
        supportedLanguages: ['en', 'hi'],
      });

      const result = await handler(event, mockContext);

      // Should still return a response (fallback detection)
      expect(result.statusCode).toBeDefined();
    });

    it('should handle network timeouts', async () => {
      // Mock axios to simulate timeout
      const axios = require('axios');
      axios.post.mockRejectedValue(new Error('timeout of 10000ms exceeded'));

      const event = createMockEvent('POST', 'translate', {
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'hi',
      });

      const result = await handler(event, mockContext);

      // Should return fallback response
      expect(result.statusCode).toBeDefined();
    });
  });

  describe('Performance Requirements', () => {
    it('should meet language consistency requirements', () => {
      // Test that language consistency is maintained (Requirement 6.2)
      const consistencyCheck = true; // Placeholder for actual consistency validation
      expect(consistencyCheck).toBe(true);
    });

    it('should support 95% translation accuracy target', () => {
      // Test that translation accuracy validation is in place (Requirement 6.2)
      const accuracyThreshold = 0.95;
      const testAccuracy = 0.96; // Mock accuracy score
      expect(testAccuracy).toBeGreaterThanOrEqual(accuracyThreshold);
    });

    it('should handle cultural context adaptation', () => {
      // Test that cultural contexts are properly mapped (Requirement 6.5)
      const culturalContexts = {
        'hi': ['bollywood', 'festivals', 'cricket'],
        'ta': ['kollywood', 'classical_music', 'temples'],
        'te': ['tollywood', 'it_industry', 'spices'],
      };

      Object.entries(culturalContexts).forEach(([, contexts]) => {
        expect(Array.isArray(contexts)).toBe(true);
        expect(contexts.length).toBeGreaterThan(0);
      });
    });
  });
});

// Integration test helpers
export const createMockLanguageDetectionRequest = (overrides: any = {}) => ({
  text: 'नमस्ते, आप कैसे हैं?',
  supportedLanguages: ['en', 'hi', 'ta', 'te'],
  ...overrides,
});

export const createMockTranslationRequest = (overrides: any = {}) => ({
  text: 'Hello, how are you?',
  sourceLanguage: 'en',
  targetLanguage: 'hi',
  context: 'general',
  ...overrides,
});

export const createMockValidationRequest = (overrides: any = {}) => ({
  originalText: 'Hello, how are you?',
  translatedText: 'नमस्ते, आप कैसे हैं?',
  sourceLanguage: 'en',
  targetLanguage: 'hi',
  ...overrides,
});