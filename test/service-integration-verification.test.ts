import { handler } from '../lambda/service-integration-verifier/index';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-bedrock-runtime');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-sns');
jest.mock('@aws-sdk/client-cloudwatch');
jest.mock('axios');

describe('Service Integration Verification', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
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
    
    // Set up environment variables
    process.env.AWS_REGION = 'ap-south-1';
    process.env.ALERT_TOPIC_ARN = 'arn:aws:sns:ap-south-1:123456789012:test-topic';
    process.env.AUDIO_STORAGE_BUCKET = 'test-audio-bucket';
    process.env.BHASHINI_BASE_URL = 'https://test-bhashini.com';
    process.env.BHASHINI_API_KEY = 'test-key';
  });

  describe('Health Check Endpoint', () => {
    it('should perform basic health check successfully', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/v1/health/check',
        pathParameters: { action: 'health-check' },
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        body: null,
        isBase64Encoded: false,
        requestContext: {} as any,
        resource: '',
        stageVariables: null,
      };

      // Mock successful AWS service responses
      const mockBedrockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          completion: 'OK'
        }))
      };

      const mockDynamoResponse = {
        Table: {
          TableStatus: 'ACTIVE',
          ItemCount: 100,
          TableSizeBytes: 1024
        }
      };

      // Mock the AWS SDK calls
      const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
      const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
      const { S3Client } = require('@aws-sdk/client-s3');
      const axios = require('axios');

      BedrockRuntimeClient.prototype.send = jest.fn().mockResolvedValue(mockBedrockResponse);
      DynamoDBClient.prototype.send = jest.fn().mockResolvedValue(mockDynamoResponse);
      S3Client.prototype.send = jest.fn().mockResolvedValue({});
      axios.get = jest.fn().mockResolvedValue({ status: 200, data: { status: 'ok' } });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.overallStatus).toBeDefined();
      expect(body.services).toBeInstanceOf(Array);
      expect(body.timestamp).toBeDefined();
      expect(body.recommendations).toBeInstanceOf(Array);
    });

    it('should handle service failures gracefully', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/v1/health/check',
        pathParameters: { action: 'health-check' },
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        body: null,
        isBase64Encoded: false,
        requestContext: {} as any,
        resource: '',
        stageVariables: null,
      };

      // Mock service failures
      const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
      const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
      const axios = require('axios');

      BedrockRuntimeClient.prototype.send = jest.fn().mockRejectedValue(new Error('Bedrock unavailable'));
      DynamoDBClient.prototype.send = jest.fn().mockRejectedValue(new Error('DynamoDB unavailable'));
      axios.get = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(503); // Service Unavailable
      
      const body = JSON.parse(result.body);
      expect(body.overallStatus).toBe('unhealthy');
      expect(body.services.some((s: any) => s.status === 'unhealthy')).toBe(true);
    });
  });

  describe('Detailed Check Endpoint', () => {
    it('should perform detailed performance tests', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/v1/health/detailed',
        pathParameters: { action: 'detailed-check' },
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        body: null,
        isBase64Encoded: false,
        requestContext: {} as any,
        resource: '',
        stageVariables: null,
      };

      // Mock successful responses with timing
      const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
      const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

      BedrockRuntimeClient.prototype.send = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          body: new TextEncoder().encode(JSON.stringify({
            content: [{ text: 'Test response with cultural analogy' }]
          }))
        }), 100))
      );

      DynamoDBClient.prototype.send = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          Table: { TableStatus: 'ACTIVE' }
        }), 50))
      );

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.basicHealthCheck).toBeDefined();
      expect(body.performanceTests).toBeDefined();
      expect(body.integrationTests).toBeDefined();
    });
  });

  describe('Recovery Test Endpoint', () => {
    it('should test graceful degradation mechanisms', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/v1/health/recovery',
        pathParameters: { action: 'recovery-test' },
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        body: null,
        isBase64Encoded: false,
        requestContext: {} as any,
        resource: '',
        stageVariables: null,
      };

      // Mock error and recovery scenarios
      const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
      
      let callCount = 0;
      BedrockRuntimeClient.prototype.send = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call fails (invalid model)
          return Promise.reject(new Error('Invalid model ID'));
        } else {
          // Second call succeeds (recovery)
          return Promise.resolve({
            body: new TextEncoder().encode(JSON.stringify({
              content: [{ text: 'Recovery successful' }]
            }))
          });
        }
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.recoveryTests).toBeDefined();
      expect(body.summary).toBeDefined();
      expect(body.summary.overallRecoveryHealth).toBeDefined();
    });
  });

  describe('Scheduled Health Check', () => {
    it('should handle EventBridge scheduled events', async () => {
      const event = {
        source: 'scheduled-health-check',
        action: 'health-check'
      };

      // Mock successful AWS service responses
      const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
      const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
      const { S3Client } = require('@aws-sdk/client-s3');

      BedrockRuntimeClient.prototype.send = jest.fn().mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({ completion: 'OK' }))
      });
      DynamoDBClient.prototype.send = jest.fn().mockResolvedValue({
        Table: { TableStatus: 'ACTIVE' }
      });
      S3Client.prototype.send = jest.fn().mockResolvedValue({});

      const result = await handler(event as any, mockContext);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.overallStatus).toBe('healthy');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid action gracefully', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/v1/health/invalid',
        pathParameters: { action: 'invalid-action' },
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        body: null,
        isBase64Encoded: false,
        requestContext: {} as any,
        resource: '',
        stageVariables: null,
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Invalid action specified');
    });

    it('should handle unexpected errors', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/v1/health/check',
        pathParameters: { action: 'health-check' },
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        body: null,
        isBase64Encoded: false,
        requestContext: {} as any,
        resource: '',
        stageVariables: null,
      };

      // Mock a critical failure
      const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
      BedrockRuntimeClient.prototype.send = jest.fn().mockImplementation(() => {
        throw new Error('Critical system failure');
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Service integration verification failed');
    });
  });

  describe('Service Recommendations', () => {
    it('should generate appropriate recommendations for degraded services', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/v1/health/check',
        pathParameters: { action: 'health-check' },
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        body: null,
        isBase64Encoded: false,
        requestContext: {} as any,
        resource: '',
        stageVariables: null,
      };

      // Mock slow responses to trigger degraded status
      const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
      const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

      BedrockRuntimeClient.prototype.send = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          body: new TextEncoder().encode(JSON.stringify({ completion: 'OK' }))
        }), 6000)) // 6 seconds - should trigger degraded status
      );

      DynamoDBClient.prototype.send = jest.fn().mockResolvedValue({
        Table: { TableStatus: 'ACTIVE' }
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(206); // Partial Content for degraded
      
      const body = JSON.parse(result.body);
      expect(body.overallStatus).toBe('degraded');
      expect(body.recommendations).toContain(
        expect.stringMatching(/WARNING.*degraded performance/)
      );
    });
  });
});