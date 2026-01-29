import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../lambda/voice-viva-processor/index';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-bedrock-runtime');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('@aws-sdk/client-lambda');
jest.mock('axios');

// Mock environment variables
process.env.AWS_REGION = 'ap-south-1';
process.env.LEARNER_SESSIONS_TABLE = 'test-learner-sessions';
process.env.STUDENT_PROFILES_TABLE = 'test-student-profiles';
process.env.STRUGGLE_LOGS_TABLE = 'test-struggle-logs';
process.env.AUDIO_STORAGE_BUCKET = 'test-audio-bucket';
process.env.SOCRATIC_ENGINE_LAMBDA_NAME = 'test-socratic-engine';
process.env.BHASHINI_API_KEY = 'test-api-key';
process.env.BHASHINI_BASE_URL = 'https://test-bhashini-api.com';

describe('Voice Viva Processor Lambda', () => {
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
    it('should handle POST requests', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/v1/voice-viva/action',
        body: JSON.stringify({
          studentId: 'test-student-123',
          action: 'start',
          concept: 'sorting',
          scaffoldCompletion: 85,
          language: 'english',
        }),
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {
          accountId: '123456789012',
          apiId: 'test-api',
          authorizer: {},
          httpMethod: 'POST',
          identity: {
            accessKey: null,
            accountId: null,
            apiKey: null,
            apiKeyId: null,
            caller: null,
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
          path: '/v1/voice-viva/action',
          protocol: 'HTTP/1.1',
          requestId: 'test-request-id',
          requestTime: '01/Jan/2024:00:00:00 +0000',
          requestTimeEpoch: 1704067200,
          resourceId: 'test-resource',
          resourcePath: '/v1/voice-viva/action',
          stage: 'test',
        },
        resource: '/v1/voice-viva/action',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBeDefined();
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    });

    it('should return 405 for unsupported HTTP methods', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'DELETE',
        path: '/v1/voice-viva/action',
        body: null,
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {
          accountId: '123456789012',
          apiId: 'test-api',
          authorizer: {},
          httpMethod: 'DELETE',
          identity: {
            accessKey: null,
            accountId: null,
            apiKey: null,
            apiKeyId: null,
            caller: null,
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
          path: '/v1/voice-viva/action',
          protocol: 'HTTP/1.1',
          requestId: 'test-request-id',
          requestTime: '01/Jan/2024:00:00:00 +0000',
          requestTimeEpoch: 1704067200,
          resourceId: 'test-resource',
          resourcePath: '/v1/voice-viva/action',
          stage: 'test',
        },
        resource: '/v1/voice-viva/action',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(405);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Method not allowed');
    });
  });

  describe('Request Validation', () => {
    it('should return 400 for missing request body', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/v1/voice-viva/action',
        body: null,
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {
          accountId: '123456789012',
          apiId: 'test-api',
          authorizer: {},
          httpMethod: 'POST',
          identity: {
            accessKey: null,
            accountId: null,
            apiKey: null,
            apiKeyId: null,
            caller: null,
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
          path: '/v1/voice-viva/action',
          protocol: 'HTTP/1.1',
          requestId: 'test-request-id',
          requestTime: '01/Jan/2024:00:00:00 +0000',
          requestTimeEpoch: 1704067200,
          resourceId: 'test-resource',
          resourcePath: '/v1/voice-viva/action',
          stage: 'test',
        },
        resource: '/v1/voice-viva/action',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Request body is required');
    });

    it('should return 400 for missing required fields', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/v1/voice-viva/action',
        body: JSON.stringify({
          // Missing studentId and action
          concept: 'sorting',
        }),
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {
          accountId: '123456789012',
          apiId: 'test-api',
          authorizer: {},
          httpMethod: 'POST',
          identity: {
            accessKey: null,
            accountId: null,
            apiKey: null,
            apiKeyId: null,
            caller: null,
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
          path: '/v1/voice-viva/action',
          protocol: 'HTTP/1.1',
          requestId: 'test-request-id',
          requestTime: '01/Jan/2024:00:00:00 +0000',
          requestTimeEpoch: 1704067200,
          resourceId: 'test-resource',
          resourcePath: '/v1/voice-viva/action',
          stage: 'test',
        },
        resource: '/v1/voice-viva/action',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('studentId and action are required');
    });

    it('should return 400 for invalid action', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/v1/voice-viva/action',
        body: JSON.stringify({
          studentId: 'test-student-123',
          action: 'invalid_action',
        }),
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {
          accountId: '123456789012',
          apiId: 'test-api',
          authorizer: {},
          httpMethod: 'POST',
          identity: {
            accessKey: null,
            accountId: null,
            apiKey: null,
            apiKeyId: null,
            caller: null,
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
          path: '/v1/voice-viva/action',
          protocol: 'HTTP/1.1',
          requestId: 'test-request-id',
          requestTime: '01/Jan/2024:00:00:00 +0000',
          requestTimeEpoch: 1704067200,
          resourceId: 'test-resource',
          resourcePath: '/v1/voice-viva/action',
          stage: 'test',
        },
        resource: '/v1/voice-viva/action',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Invalid action: invalid_action');
    });
  });

  describe('Voice Viva Actions', () => {
    it('should handle start action with valid scaffold completion', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/v1/voice-viva/action',
        body: JSON.stringify({
          studentId: 'test-student-123',
          action: 'start',
          concept: 'sorting',
          scaffoldCompletion: 85,
          language: 'english',
        }),
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {
          accountId: '123456789012',
          apiId: 'test-api',
          authorizer: {},
          httpMethod: 'POST',
          identity: {
            accessKey: null,
            accountId: null,
            apiKey: null,
            apiKeyId: null,
            caller: null,
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
          path: '/v1/voice-viva/action',
          protocol: 'HTTP/1.1',
          requestId: 'test-request-id',
          requestTime: '01/Jan/2024:00:00:00 +0000',
          requestTimeEpoch: 1704067200,
          resourceId: 'test-resource',
          resourcePath: '/v1/voice-viva/action',
          stage: 'test',
        },
        resource: '/v1/voice-viva/action',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBeDefined();
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
      
      // The actual implementation will depend on mocked AWS services
      // This test validates the basic structure and error handling
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors gracefully', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/v1/voice-viva/action',
        body: '{"invalid": "json"', // Invalid JSON to trigger error
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {
          accountId: '123456789012',
          apiId: 'test-api',
          authorizer: {},
          httpMethod: 'POST',
          identity: {
            accessKey: null,
            accountId: null,
            apiKey: null,
            apiKeyId: null,
            caller: null,
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
          path: '/v1/voice-viva/action',
          protocol: 'HTTP/1.1',
          requestId: 'test-request-id',
          requestTime: '01/Jan/2024:00:00:00 +0000',
          requestTimeEpoch: 1704067200,
          resourceId: 'test-resource',
          resourcePath: '/v1/voice-viva/action',
          stage: 'test',
        },
        resource: '/v1/voice-viva/action',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('Language Support', () => {
    it('should support multiple Indian languages', () => {
      // Test that the BHASHINI_LANGUAGE_CODES mapping includes required languages
      const { BHASHINI_LANGUAGE_CODES } = require('../lambda/voice-viva-processor/index');
      
      const requiredLanguages = [
        'hindi', 'tamil', 'telugu', 'bengali', 'marathi', 'gujarati',
        'kannada', 'malayalam', 'odia', 'punjabi', 'assamese', 'urdu', 'english'
      ];

      requiredLanguages.forEach(language => {
        expect(BHASHINI_LANGUAGE_CODES).toHaveProperty(language);
        expect(typeof BHASHINI_LANGUAGE_CODES[language]).toBe('string');
        expect(BHASHINI_LANGUAGE_CODES[language].length).toBeGreaterThan(0);
      });
    });
  });

  describe('Question Generation', () => {
    it('should have question templates for all required categories', () => {
      const { VIVA_QUESTION_TEMPLATES } = require('../lambda/voice-viva-processor/index');
      
      expect(VIVA_QUESTION_TEMPLATES).toHaveProperty('conceptual');
      expect(VIVA_QUESTION_TEMPLATES).toHaveProperty('analogy_clarification');
      expect(VIVA_QUESTION_TEMPLATES).toHaveProperty('error_handling');
      expect(VIVA_QUESTION_TEMPLATES).toHaveProperty('optimization');
      expect(VIVA_QUESTION_TEMPLATES).toHaveProperty('implementation');

      // Check that conceptual questions have all difficulty levels
      expect(VIVA_QUESTION_TEMPLATES.conceptual).toHaveProperty('beginner');
      expect(VIVA_QUESTION_TEMPLATES.conceptual).toHaveProperty('intermediate');
      expect(VIVA_QUESTION_TEMPLATES.conceptual).toHaveProperty('advanced');

      // Check that each difficulty level has questions
      expect(Array.isArray(VIVA_QUESTION_TEMPLATES.conceptual.beginner)).toBe(true);
      expect(VIVA_QUESTION_TEMPLATES.conceptual.beginner.length).toBeGreaterThan(0);
    });
  });
});

// Integration test helpers
export const createMockVoiceVivaRequest = (overrides: any = {}) => ({
  studentId: 'test-student-123',
  action: 'start',
  concept: 'sorting',
  scaffoldCompletion: 85,
  language: 'english',
  ...overrides,
});

export const createMockAPIGatewayEvent = (body: any, method: string = 'POST'): APIGatewayProxyEvent => ({
  httpMethod: method,
  path: '/v1/voice-viva/action',
  body: JSON.stringify(body),
  headers: {},
  multiValueHeaders: {},
  isBase64Encoded: false,
  pathParameters: null,
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
    path: '/v1/voice-viva/action',
    protocol: 'HTTP/1.1',
    requestId: 'test-request-id',
    requestTime: '01/Jan/2024:00:00:00 +0000',
    requestTimeEpoch: 1704067200,
    resourceId: 'test-resource',
    resourcePath: '/v1/voice-viva/action',
    stage: 'test',
  },
  resource: '/v1/voice-viva/action',
});