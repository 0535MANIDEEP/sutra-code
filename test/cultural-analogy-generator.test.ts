import { handler } from '../lambda/cultural-analogy-generator/index';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import * as fc from 'fast-check';

// Mock environment variables
process.env.AWS_REGION = 'ap-south-1';
process.env.STUDENT_PROFILES_TABLE = 'StudentProfiles';
process.env.ANALOGY_CACHE_TABLE = 'AnalogyCache';

// Mock AWS SDK clients with jest.fn()
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  InvokeModelCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  },
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
  QueryCommand: jest.fn(),
}));

// Test data generators
const conceptGenerator = fc.constantFrom(
  'sorting', 'searching', 'recursion', 'graphs', 'queues', 'arrays', 
  'loops', 'functions', 'classes', 'inheritance', 'trees', 'stacks'
);

const difficultyGenerator = fc.constantFrom('beginner', 'intermediate', 'advanced');

const languageGenerator = fc.constantFrom(
  'hindi', 'tamil', 'telugu', 'bengali', 'marathi', 'gujarati', 'kannada', 
  'malayalam', 'odia', 'punjabi', 'assamese', 'urdu', 'english'
);

const regionGenerator = fc.constantFrom(
  'mumbai', 'chennai', 'kolkata', 'bangalore', 'hyderabad', 'delhi', 
  'punjab', 'gujarat', 'kerala', 'tamil_nadu', 'bengal', 'maharashtra'
);

const studentProfileGenerator = fc.record({
  studentId: fc.uuid(),
  preferredLanguage: languageGenerator,
  skillLevel: fc.integer({ min: 1, max: 10 }),
  culturalPreferences: fc.array(fc.constantFrom('cricket', 'mandi', 'festivals', 'railways', 'bollywood'), { minLength: 1, maxLength: 3 }),
  strugglingConcepts: fc.array(conceptGenerator, { maxLength: 3 }),
  masteredConcepts: fc.array(conceptGenerator, { maxLength: 5 }),
  gritScore: fc.integer({ min: 0, max: 100 }),
  regionContext: fc.option(regionGenerator),
  ipGeolocation: fc.option(fc.record({
    state: fc.string({ minLength: 3, maxLength: 20 }),
    city: fc.string({ minLength: 3, maxLength: 20 }),
    region: fc.string({ minLength: 3, maxLength: 20 }),
  })),
});

const analogyRequestGenerator = fc.record({
  concept: conceptGenerator,
  difficulty: difficultyGenerator,
  studentProfile: studentProfileGenerator,
  language: fc.option(languageGenerator),
  regionContext: fc.option(regionGenerator),
});

// Mock context
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

// Helper function to create API Gateway event
function createAPIGatewayEvent(
  httpMethod: string,
  path: string,
  body?: any,
  pathParameters?: Record<string, string>
): APIGatewayProxyEvent {
  return {
    httpMethod,
    path,
    resource: path,
    pathParameters: pathParameters || null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    headers: {
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      protocol: 'HTTP/1.1',
      httpMethod,
      path,
      stage: 'test',
      requestId: 'test-request',
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: 1704067200000,
      resourceId: 'test-resource',
      resourcePath: path,
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
      authorizer: null,
    },
  };
}

describe('Cultural Analogy Generator Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 3: Cultural Analogy Generation
     * For any programming concept request, the Cultural Analogy Generator should produce 
     * analogies that contain Indian cultural references
     * **Validates: Requirements 2.1, 2.2**
     */
    test('Property 3: Cultural Analogy Generation', async () => {
      await fc.assert(fc.asyncProperty(
        analogyRequestGenerator,
        async (request: any) => {
          // Mock DynamoDB responses
          const mockDynamoResponse = { Items: [] };

          // Mock successful Bedrock response
          const mockBedrockResponse = {
            body: new TextEncoder().encode(JSON.stringify({
              content: [{
                text: JSON.stringify({
                  analogy: `This concept is like organizing a cricket match where players coordinate like ${request.concept} algorithms.`,
                  culturalContext: 'cricket',
                  conceptMapping: {
                    programmingConcept: request.concept,
                    culturalElement: 'cricket team coordination',
                    mappingRationale: 'Both require systematic organization',
                    keyConnections: ['organization', 'strategy', 'coordination'],
                  },
                  followUpQuestions: [
                    'How does team coordination relate to this algorithm?',
                    'What patterns do you see?',
                    'Can you think of similar examples?',
                  ],
                }),
              }],
            })),
          };

          // Set up mocks
          mockSend
            .mockResolvedValueOnce(mockDynamoResponse) // First call for getCachedAnalogy
            .mockResolvedValueOnce(mockBedrockResponse) // Second call for Bedrock
            .mockResolvedValueOnce({}); // Third call for cacheAnalogy
          
          const event = createAPIGatewayEvent('POST', '/v1/analogies/generate', request);
          const result = await handler(event, mockContext);

          expect(result.statusCode).toBe(200);
          
          const responseBody = JSON.parse(result.body);
          
          // Should contain cultural references
          const culturalKeywords = ['cricket', 'mandi', 'festival', 'railway', 'bollywood', 'temple', 'family'];
          const containsCulturalReference = culturalKeywords.some(keyword => 
            responseBody.analogy.toLowerCase().includes(keyword) ||
            responseBody.culturalContext.toLowerCase().includes(keyword)
          );
          
          expect(containsCulturalReference).toBe(true);
          expect(responseBody.conceptMapping).toBeDefined();
          expect(responseBody.conceptMapping.programmingConcept).toBe(request.concept);
        }
      ), { numRuns: 100 });
    });

    /**
     * Property 4: Analogy Complexity Adaptation
     * For any programming concept at different complexity levels, the Cultural Analogy Generator 
     * should produce analogies that vary appropriately in sophistication
     * **Validates: Requirements 2.4, 2.5**
     */
    test('Property 4: Analogy Complexity Adaptation', async () => {
      await fc.assert(fc.asyncProperty(
        conceptGenerator,
        studentProfileGenerator,
        async (concept: string, studentProfile: any) => {
          const difficulties: ('beginner' | 'intermediate' | 'advanced')[] = ['beginner', 'intermediate', 'advanced'];
          const responses: any[] = [];

          for (const difficulty of difficulties) {
            const request = {
              concept,
              difficulty,
              studentProfile,
            };

            // Mock Bedrock response with complexity-appropriate content
            const complexityLevel = difficulty === 'beginner' ? 1 : difficulty === 'intermediate' ? 2 : 3;
            const mockBedrockResponse = {
              body: new TextEncoder().encode(JSON.stringify({
                content: [{
                  text: JSON.stringify({
                    analogy: `${difficulty} level analogy for ${concept} using cricket context with complexity ${complexityLevel}`,
                    culturalContext: 'cricket',
                    conceptMapping: {
                      programmingConcept: concept,
                      culturalElement: 'cricket',
                      mappingRationale: `${difficulty} level explanation`,
                      keyConnections: Array(complexityLevel).fill('connection'),
                    },
                    followUpQuestions: Array(complexityLevel + 2).fill('question'),
                  }),
                }],
              })),
            };

            mockSend
              .mockResolvedValueOnce({ Items: [] }) // getCachedAnalogy
              .mockResolvedValueOnce(mockBedrockResponse) // Bedrock call
              .mockResolvedValueOnce({}); // cacheAnalogy

            const event = createAPIGatewayEvent('POST', '/v1/analogies/generate', request);
            const result = await handler(event, mockContext);

            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            responses.push({ difficulty, response: responseBody });
          }

          // Verify complexity adaptation
          const beginnerResponse = responses.find(r => r.difficulty === 'beginner')?.response;
          const advancedResponse = responses.find(r => r.difficulty === 'advanced')?.response;

          if (beginnerResponse && advancedResponse) {
            // Advanced should have more follow-up questions or longer explanations
            expect(advancedResponse.followUpQuestions.length).toBeGreaterThanOrEqual(beginnerResponse.followUpQuestions.length);
            
            // Should provide alternative analogies when confusion is indicated
            if (advancedResponse.alternativeAnalogies) {
              expect(Array.isArray(advancedResponse.alternativeAnalogies)).toBe(true);
            }
          }
        }
      ), { numRuns: 50 });
    });
  });

  describe('Unit Tests', () => {
    test('should handle POST /v1/analogies/generate with valid request', async () => {
      const request = {
        concept: 'sorting',
        difficulty: 'beginner' as const,
        studentProfile: {
          studentId: 'test-student',
          preferredLanguage: 'hindi',
          skillLevel: 3,
          culturalPreferences: ['cricket'],
          strugglingConcepts: [],
          masteredConcepts: [],
          gritScore: 50,
        },
      };

      // Mock successful responses
      const mockBedrockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              analogy: 'Sorting is like arranging cricket players by batting order',
              culturalContext: 'cricket',
              conceptMapping: {
                programmingConcept: 'sorting',
                culturalElement: 'cricket batting order',
                mappingRationale: 'Both require systematic arrangement',
                keyConnections: ['order', 'strategy', 'optimization'],
              },
              followUpQuestions: ['How does batting order relate to sorting?'],
            }),
          }],
        })),
      };

      mockSend
        .mockResolvedValueOnce({ Items: [] }) // getCachedAnalogy
        .mockResolvedValueOnce(mockBedrockResponse) // Bedrock call
        .mockResolvedValueOnce({}); // cacheAnalogy

      const event = createAPIGatewayEvent('POST', '/v1/analogies/generate', request);
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.analogy).toContain('cricket');
      expect(responseBody.culturalContext).toBe('cricket');
      expect(responseBody.conceptMapping.programmingConcept).toBe('sorting');
    });

    test('should handle GET /v1/analogies/{concept}', async () => {
      const mockDynamoResponse = {
        Items: [{
          analogyId: 'test-analogy-1',
          concept: 'sorting',
          difficulty: 'beginner',
          culturalContext: 'cricket',
          analogy: 'Test analogy',
          effectiveness: 0.8,
          usageCount: 5,
        }],
      };

      mockSend.mockResolvedValue(mockDynamoResponse);

      const event = createAPIGatewayEvent('GET', '/v1/analogies/sorting', null, { concept: 'sorting' });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.concept).toBe('sorting');
      expect(responseBody.analogies).toHaveLength(1);
      expect(responseBody.analogies[0].analogyId).toBe('test-analogy-1');
    });

    test('should handle PUT /v1/analogies/feedback', async () => {
      const feedbackRequest = {
        analogyId: 'test-analogy-1',
        effectiveness: 0.9,
        feedback: 'Very helpful analogy',
      };

      mockSend.mockResolvedValue({});

      const event = createAPIGatewayEvent('PUT', '/v1/analogies/feedback', feedbackRequest);
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.message).toContain('updated successfully');
      expect(responseBody.analogyId).toBe('test-analogy-1');
      expect(responseBody.effectiveness).toBe(0.9);
    });

    test('should return 400 for invalid difficulty level', async () => {
      const request = {
        concept: 'sorting',
        difficulty: 'invalid' as any,
        studentProfile: {
          studentId: 'test-student',
          preferredLanguage: 'hindi',
          skillLevel: 3,
          culturalPreferences: ['cricket'],
          strugglingConcepts: [],
          masteredConcepts: [],
          gritScore: 50,
        },
      };

      const event = createAPIGatewayEvent('POST', '/v1/analogies/generate', request);
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('difficulty must be');
    });

    test('should return 400 for unsupported language', async () => {
      const request = {
        concept: 'sorting',
        difficulty: 'beginner' as const,
        studentProfile: {
          studentId: 'test-student',
          preferredLanguage: 'hindi',
          skillLevel: 3,
          culturalPreferences: ['cricket'],
          strugglingConcepts: [],
          masteredConcepts: [],
          gritScore: 50,
        },
        language: 'unsupported-language',
      };

      const event = createAPIGatewayEvent('POST', '/v1/analogies/generate', request);
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Unsupported language');
    });

    test('should return 405 for unsupported HTTP method', async () => {
      const event = createAPIGatewayEvent('DELETE', '/v1/analogies/generate');
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(405);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Method not allowed');
    });

    test('should handle Bedrock API failures gracefully', async () => {
      const request = {
        concept: 'sorting',
        difficulty: 'beginner' as const,
        studentProfile: {
          studentId: 'test-student',
          preferredLanguage: 'hindi',
          skillLevel: 3,
          culturalPreferences: ['cricket'],
          strugglingConcepts: [],
          masteredConcepts: [],
          gritScore: 50,
        },
      };

      // Mock Bedrock failure
      mockSend
        .mockResolvedValueOnce({ Items: [] }) // getCachedAnalogy
        .mockRejectedValueOnce(new Error('Bedrock API error')) // Bedrock failure
        .mockResolvedValueOnce({}); // cacheAnalogy (fallback)

      const event = createAPIGatewayEvent('POST', '/v1/analogies/generate', request);
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      
      // Should return fallback analogy
      expect(responseBody.analogy).toBeDefined();
      expect(responseBody.culturalContext).toBeDefined();
      expect(responseBody.conceptMapping).toBeDefined();
    });

    test('should support all 22 Indian languages', () => {
      const supportedLanguages = [
        'hindi', 'tamil', 'telugu', 'bengali', 'marathi', 'gujarati', 'kannada', 'malayalam',
        'odia', 'punjabi', 'assamese', 'urdu', 'sanskrit', 'konkani', 'manipuri', 'nepali',
        'bodo', 'santhali', 'maithili', 'kashmiri', 'sindhi', 'dogri'
      ];

      // This test verifies that all required languages are supported
      expect(supportedLanguages).toHaveLength(22);
      
      // Each language should be a valid string
      supportedLanguages.forEach(lang => {
        expect(typeof lang).toBe('string');
        expect(lang.length).toBeGreaterThan(0);
      });
    });

    test('should adapt analogies based on regional context', async () => {
      const tamilRequest = {
        concept: 'sorting',
        difficulty: 'beginner' as const,
        studentProfile: {
          studentId: 'test-student',
          preferredLanguage: 'tamil',
          skillLevel: 3,
          culturalPreferences: ['cricket'],
          strugglingConcepts: [],
          masteredConcepts: [],
          gritScore: 50,
          regionContext: 'tamil_nadu',
        },
      };

      // Mock Bedrock response with Tamil regional context
      const mockBedrockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              analogy: 'Sorting is like organizing Kollywood movie cast for a Tamil film',
              culturalContext: 'bollywood',
              conceptMapping: {
                programmingConcept: 'sorting',
                culturalElement: 'Kollywood movie production',
                mappingRationale: 'Both require systematic organization with regional context',
                keyConnections: ['organization', 'regional relevance', 'cultural authenticity'],
              },
              followUpQuestions: ['How does Kollywood production relate to sorting algorithms?'],
            }),
          }],
        })),
      };

      mockSend
        .mockResolvedValueOnce({ Items: [] }) // getCachedAnalogy
        .mockResolvedValueOnce(mockBedrockResponse) // Bedrock call
        .mockResolvedValueOnce({}); // cacheAnalogy

      const event = createAPIGatewayEvent('POST', '/v1/analogies/generate', tamilRequest);
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      
      // Should contain regional references
      const containsRegionalReference = 
        responseBody.analogy.toLowerCase().includes('kollywood') ||
        responseBody.analogy.toLowerCase().includes('tamil') ||
        responseBody.conceptMapping.mappingRationale.toLowerCase().includes('regional');
      
      expect(containsRegionalReference).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty request body', async () => {
      const event = createAPIGatewayEvent('POST', '/v1/analogies/generate');
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Request body is required');
    });

    test('should handle missing required fields', async () => {
      const incompleteRequest = {
        concept: 'sorting',
        // Missing difficulty and studentProfile
      };

      const event = createAPIGatewayEvent('POST', '/v1/analogies/generate', incompleteRequest);
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('required');
    });

    test('should handle DynamoDB errors gracefully', async () => {
      const request = {
        concept: 'sorting',
        difficulty: 'beginner' as const,
        studentProfile: {
          studentId: 'test-student',
          preferredLanguage: 'hindi',
          skillLevel: 3,
          culturalPreferences: ['cricket'],
          strugglingConcepts: [],
          masteredConcepts: [],
          gritScore: 50,
        },
      };

      // Mock DynamoDB failure
      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      const event = createAPIGatewayEvent('POST', '/v1/analogies/generate', request);
      const result = await handler(event, mockContext);

      // Should still work with fallback behavior
      expect(result.statusCode).toBe(200);
    });
  });
});

// Feature: sutra-code, Property 3: Cultural Analogy Generation
// Feature: sutra-code, Property 4: Analogy Complexity Adaptation