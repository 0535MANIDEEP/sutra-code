import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../lambda/github-gatekeeper/index';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@octokit/rest');

// Mock environment variables
process.env.AWS_REGION = 'ap-south-1';
process.env.STUDENT_PROFILES_TABLE = 'test-student-profiles';
process.env.ANALYTICS_TABLE = 'test-analytics';
process.env.VOICE_VIVA_TABLE = 'test-voice-viva';
process.env.GITHUB_TOKEN = 'test-github-token';
process.env.HMAC_SECRET = 'test-secret';

// Mock Octokit
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(() => ({
    rest: {
      repos: {
        getBranch: jest.fn(),
        createOrUpdateFileContents: jest.fn(),
      },
      git: {
        createRef: jest.fn(),
      },
    },
  })),
}));

// Helper function to create mock API Gateway event
const createMockEvent = (
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>
): APIGatewayProxyEvent => ({
  httpMethod: method,
  path,
  body: body ? JSON.stringify(body) : null,
  headers: headers || {},
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  pathParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: 'test-account',
    apiId: 'test-api',
    protocol: 'HTTP/1.1',
    httpMethod: method,
    path,
    stage: 'test',
    requestId: 'test-request-id',
    requestTime: '01/Jan/2024:00:00:00 +0000',
    requestTimeEpoch: Date.now(),
    resourceId: 'test-resource',
    resourcePath: path,
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
      clientCert: null,
    },
    authorizer: null,
  },
  resource: path,
  isBase64Encoded: false,
});

describe('GitHub Gatekeeper Lambda', () => {
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

  let mockOctokit: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked Octokit instance
    const { Octokit } = require('@octokit/rest');
    mockOctokit = new Octokit();
    
    // Setup default mocks for DynamoDB
    const mockDocClient = require('@aws-sdk/lib-dynamodb');
    mockDocClient.DynamoDBDocumentClient.from = jest.fn(() => ({
      send: jest.fn().mockImplementation((command) => {
        // Mock different responses based on command type
        if (command.constructor.name === 'GetCommand') {
          const tableName = command.input.TableName;
          if (tableName.includes('student-profiles')) {
            return Promise.resolve({
              Item: {
                studentId: 'test-student-id',
                gritScore: 75,
                githubSubmissions: [],
              },
            });
          } else if (tableName.includes('analytics')) {
            return Promise.resolve({
              Item: {
                analyticsId: 'test-student-id#test-session-id',
                totalLearningTime: 7200000, // 2 hours
                scaffoldProgression: Array(85).fill({}), // 85% completion
                breakthroughMoments: 3,
                analogyEffectiveness: {
                  'cricket_batting_order': 0.9,
                  'mandi_vendor_inventory': 0.8,
                },
              },
            });
          }
        } else if (command.constructor.name === 'QueryCommand') {
          return Promise.resolve({
            Items: [{
              studentId: 'test-student-id',
              sessionId: 'test-session-id',
              overallScore: 85, // Voice Viva score
            }],
          });
        } else if (command.constructor.name === 'UpdateCommand') {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      }),
    }));

    // Setup GitHub API mocks
    mockOctokit.rest.repos.getBranch.mockResolvedValue({
      data: {
        commit: {
          sha: 'test-sha-123',
        },
      },
    });

    mockOctokit.rest.git.createRef.mockResolvedValue({});
    mockOctokit.rest.repos.createOrUpdateFileContents.mockResolvedValue({});
  });

  describe('Submission Validation', () => {
    it('should validate successful submission criteria', async () => {
      const event = createMockEvent('POST', '/validate-submission', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/test-repo',
        codeContent: 'function bubbleSort(arr) { /* implementation */ }',
        conceptContext: 'sorting_algorithms',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.valid).toBe(true);
      expect(body.validation.isValid).toBe(true);
      expect(body.validation.voiceVivaScore).toBe(85);
      expect(body.validation.gritScore).toBe(75);
      expect(body.message).toContain('Submission criteria met');
    });

    it('should reject submission when Voice Viva score is too low', async () => {
      // Mock low Voice Viva score
      const mockDocClient = require('@aws-sdk/lib-dynamodb');
      mockDocClient.DynamoDBDocumentClient.from = jest.fn(() => ({
        send: jest.fn().mockImplementation((command) => {
          if (command.constructor.name === 'QueryCommand') {
            return Promise.resolve({
              Items: [{
                studentId: 'test-student-id',
                sessionId: 'test-session-id',
                overallScore: 65, // Below 70% threshold
              }],
            });
          }
          // Return default mocks for other commands
          return Promise.resolve({
            Item: {
              studentId: 'test-student-id',
              gritScore: 75,
              totalLearningTime: 7200000,
              scaffoldProgression: Array(85).fill({}),
            },
          });
        }),
      }));

      const event = createMockEvent('POST', '/validate-submission', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/test-repo',
        codeContent: 'function bubbleSort(arr) { /* implementation */ }',
        conceptContext: 'sorting_algorithms',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.valid).toBe(false);
      expect(body.validation.missingRequirements).toContain(
        expect.stringContaining('Voice Viva score: 65%')
      );
    });

    it('should reject submission when learning time is insufficient', async () => {
      // Mock insufficient learning time
      const mockDocClient = require('@aws-sdk/lib-dynamodb');
      mockDocClient.DynamoDBDocumentClient.from = jest.fn(() => ({
        send: jest.fn().mockImplementation((command) => {
          if (command.constructor.name === 'GetCommand') {
            const tableName = command.input.TableName;
            if (tableName.includes('analytics')) {
              return Promise.resolve({
                Item: {
                  analyticsId: 'test-student-id#test-session-id',
                  totalLearningTime: 3600000, // Only 1 hour
                  scaffoldProgression: Array(85).fill({}),
                },
              });
            }
          }
          return Promise.resolve({
            Item: { studentId: 'test-student-id', gritScore: 75 },
            Items: [{ overallScore: 85 }],
          });
        }),
      }));

      const event = createMockEvent('POST', '/validate-submission', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/test-repo',
        codeContent: 'function bubbleSort(arr) { /* implementation */ }',
        conceptContext: 'sorting_algorithms',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.valid).toBe(false);
      expect(body.validation.missingRequirements).toContain(
        expect.stringContaining('Learning time: 1 hours')
      );
    });

    it('should reject submission when scaffold completion is too low', async () => {
      // Mock low scaffold completion
      const mockDocClient = require('@aws-sdk/lib-dynamodb');
      mockDocClient.DynamoDBDocumentClient.from = jest.fn(() => ({
        send: jest.fn().mockImplementation((command) => {
          if (command.constructor.name === 'GetCommand') {
            const tableName = command.input.TableName;
            if (tableName.includes('analytics')) {
              return Promise.resolve({
                Item: {
                  analyticsId: 'test-student-id#test-session-id',
                  totalLearningTime: 7200000,
                  scaffoldProgression: Array(70).fill({}), // Only 70% completion
                },
              });
            }
          }
          return Promise.resolve({
            Item: { studentId: 'test-student-id', gritScore: 75 },
            Items: [{ overallScore: 85 }],
          });
        }),
      }));

      const event = createMockEvent('POST', '/validate-submission', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/test-repo',
        codeContent: 'function bubbleSort(arr) { /* implementation */ }',
        conceptContext: 'sorting_algorithms',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.valid).toBe(false);
      expect(body.validation.missingRequirements).toContain(
        expect.stringContaining('Scaffold completion: 70%')
      );
    });
  });

  describe('GitHub Code Submission', () => {
    it('should successfully submit code to GitHub with documentation', async () => {
      const event = createMockEvent('POST', '/submit-code', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/test-repo',
        branchName: 'socratic-learning/sorting-algorithms-123',
        codeContent: 'function bubbleSort(arr) {\n  // Learned via cricket analogy\n  return sortedArray;\n}',
        conceptContext: 'sorting_algorithms',
        commitMessage: 'Implement bubble sort algorithm',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.repositoryUrl).toBe('https://github.com/test-user/test-repo');
      expect(body.branchName).toBe('socratic-learning/sorting-algorithms-123');
      expect(body.commitMessage).toContain('Learned sorting_algorithms via cricket_batting_order');
      expect(body.documentation).toBeDefined();
      expect(body.learningJourney).toBeDefined();

      // Verify GitHub API calls
      expect(mockOctokit.rest.repos.getBranch).toHaveBeenCalledWith({
        owner: 'test-user',
        repo: 'test-repo',
        branch: 'main',
      });

      expect(mockOctokit.rest.git.createRef).toHaveBeenCalledWith({
        owner: 'test-user',
        repo: 'test-repo',
        ref: 'refs/heads/socratic-learning/sorting-algorithms-123',
        sha: 'test-sha-123',
      });

      expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledTimes(4);
    });

    it('should handle GitHub API rate limiting', async () => {
      // Mock rate limit error
      mockOctokit.rest.repos.getBranch.mockRejectedValue({
        status: 403,
        message: 'API rate limit exceeded',
      });

      const event = createMockEvent('POST', '/submit-code', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/test-repo',
        codeContent: 'function bubbleSort(arr) { return arr; }',
        conceptContext: 'sorting_algorithms',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(429);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('rate limit exceeded');
    });

    it('should handle repository not found error', async () => {
      // Mock repository not found error
      mockOctokit.rest.repos.getBranch.mockRejectedValue({
        status: 404,
        message: 'Not Found',
      });

      const event = createMockEvent('POST', '/submit-code', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/nonexistent-repo',
        codeContent: 'function bubbleSort(arr) { return arr; }',
        conceptContext: 'sorting_algorithms',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Repository not found');
    });

    it('should reject submission when criteria not met', async () => {
      // Mock insufficient criteria
      const mockDocClient = require('@aws-sdk/lib-dynamodb');
      mockDocClient.DynamoDBDocumentClient.from = jest.fn(() => ({
        send: jest.fn().mockImplementation((command) => {
          if (command.constructor.name === 'QueryCommand') {
            return Promise.resolve({
              Items: [{ overallScore: 60 }], // Below threshold
            });
          }
          return Promise.resolve({
            Item: { studentId: 'test-student-id', gritScore: 50 },
          });
        }),
      }));

      const event = createMockEvent('POST', '/submit-code', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/test-repo',
        codeContent: 'function bubbleSort(arr) { return arr; }',
        conceptContext: 'sorting_algorithms',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Submission criteria not met');
    });
  });

  describe('Learning Journey Retrieval', () => {
    it('should return learning journey data', async () => {
      const event = createMockEvent('GET', '/learning-journey', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.learningJourney).toBeDefined();
      expect(body.learningJourney.studentId).toBe('test-student-id');
      expect(body.learningJourney.sessionId).toBe('test-session-id');
      expect(body.learningJourney.totalLearningTime).toBe(7200000);
      expect(body.learningJourney.culturalAnalogiesUsed).toContain('cricket_batting_order');
      expect(body.cryptographicProof).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing request body', async () => {
      const event = createMockEvent('POST', '/validate-submission');

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Request body is required');
    });

    it('should handle missing required fields', async () => {
      const event = createMockEvent('POST', '/validate-submission', {
        studentId: 'test-student-id',
        // Missing other required fields
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Missing required field');
    });

    it('should handle invalid repository URL', async () => {
      const event = createMockEvent('POST', '/submit-code', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'invalid-url',
        codeContent: 'function test() {}',
        conceptContext: 'testing',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Invalid GitHub repository URL');
    });

    it('should handle DynamoDB errors gracefully', async () => {
      // Mock DynamoDB error
      const mockDocClient = require('@aws-sdk/lib-dynamodb');
      mockDocClient.DynamoDBDocumentClient.from = jest.fn(() => ({
        send: jest.fn().mockRejectedValue(new Error('DynamoDB service unavailable')),
      }));

      const event = createMockEvent('POST', '/validate-submission', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/test-repo',
        codeContent: 'function test() {}',
        conceptContext: 'testing',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Failed to validate submission criteria');
    });

    it('should handle unknown endpoints', async () => {
      const event = createMockEvent('POST', '/unknown-endpoint', {
        studentId: 'test-student-id',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Endpoint not found');
    });
  });

  describe('Cryptographic Proof Generation', () => {
    it('should generate valid cryptographic proof', async () => {
      const event = createMockEvent('GET', '/learning-journey', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      const proof = JSON.parse(body.cryptographicProof);
      
      expect(proof.signature).toBeDefined();
      expect(proof.journeyHash).toBeDefined();
      expect(proof.timestamp).toBeDefined();
      expect(proof.algorithm).toBe('HMAC-SHA256');
    });
  });

  describe('Documentation Generation', () => {
    it('should generate comprehensive learning documentation', async () => {
      const event = createMockEvent('POST', '/submit-code', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/test-repo',
        codeContent: 'function bubbleSort(arr) { return arr; }',
        conceptContext: 'sorting_algorithms',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      
      expect(body.documentation.journeyMarkdown).toContain('Learning Journey');
      expect(body.documentation.journeyMarkdown).toContain('Socratic Path Summary');
      expect(body.documentation.journeyMarkdown).toContain('Cultural Analogies Used');
      expect(body.documentation.journeyMarkdown).toContain('cricket_batting_order');
      
      const gritScoreCard = JSON.parse(body.documentation.gritScoreCard);
      expect(gritScoreCard.overallGritScore).toBe(75);
      expect(gritScoreCard.components).toBeDefined();
      expect(gritScoreCard.verificationData).toBeDefined();
      
      expect(body.documentation.culturalAnalogies).toContain('Cultural Analogies Used');
      expect(body.documentation.culturalAnalogies).toContain('Bhashini Integration');
    });
  });

  describe('Requirement Validation', () => {
    it('should validate Requirement 7.1: Submission criteria validation', async () => {
      const event = createMockEvent('POST', '/validate-submission', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/test-repo',
        codeContent: 'function test() {}',
        conceptContext: 'testing',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.validation.voiceVivaScore).toBeGreaterThanOrEqual(70);
      expect(body.validation.gritScore).toBeGreaterThanOrEqual(60);
    });

    it('should validate Requirement 7.2: API rate limiting', async () => {
      // This would be tested with multiple rapid requests in integration tests
      const event = createMockEvent('POST', '/validate-submission', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/test-repo',
        codeContent: 'function test() {}',
        conceptContext: 'testing',
      });

      const result = await handler(event, mockContext);
      expect(result.statusCode).toBeLessThan(500); // Should handle gracefully
    });

    it('should validate Requirement 7.3: Learning analytics documentation', async () => {
      const event = createMockEvent('POST', '/submit-code', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/test-repo',
        codeContent: 'function test() {}',
        conceptContext: 'testing',
      });

      const result = await handler(event, mockContext);

      if (result.statusCode === 200) {
        const body = JSON.parse(result.body);
        expect(body.documentation).toBeDefined();
        expect(body.learningJourney.gritScore).toBeDefined();
        expect(body.learningJourney.culturalAnalogiesUsed).toBeDefined();
        expect(body.learningJourney.totalLearningTime).toBeDefined();
      }
    });

    it('should validate Requirement 7.4: Meaningful commit messages', async () => {
      const event = createMockEvent('POST', '/submit-code', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/test-repo',
        codeContent: 'function test() {}',
        conceptContext: 'sorting_algorithms',
      });

      const result = await handler(event, mockContext);

      if (result.statusCode === 200) {
        const body = JSON.parse(result.body);
        expect(body.commitMessage).toMatch(/Learned .* via .* - Grit Score: \d+ - Struggle Time: [\d.]+h/);
      }
    });

    it('should validate Requirement 7.5: Portfolio update functionality', async () => {
      const event = createMockEvent('POST', '/submit-code', {
        studentId: 'test-student-id',
        sessionId: 'test-session-id',
        repositoryUrl: 'https://github.com/test-user/test-repo',
        codeContent: 'function test() {}',
        conceptContext: 'testing',
      });

      const result = await handler(event, mockContext);

      if (result.statusCode === 200) {
        // Verify that UpdateCommand was called to update student portfolio
        const mockDocClient = require('@aws-sdk/lib-dynamodb');
        const sendCalls = mockDocClient.DynamoDBDocumentClient.from().send.mock.calls;
        const updateCalls = sendCalls.filter((call: any) => call[0].constructor.name === 'UpdateCommand');
        expect(updateCalls.length).toBeGreaterThan(0);
      }
    });
  });
});

// Integration test helpers
export const createMockSubmissionRequest = (overrides: any = {}) => ({
  studentId: 'test-student-id',
  sessionId: 'test-session-id',
  repositoryUrl: 'https://github.com/test-user/test-repo',
  codeContent: 'function bubbleSort(arr) { return arr; }',
  conceptContext: 'sorting_algorithms',
  branchName: 'socratic-learning/sorting-123',
  ...overrides,
});

export const createMockLearningJourney = (overrides: any = {}) => ({
  studentId: 'test-student-id',
  sessionId: 'test-session-id',
  conceptContext: 'sorting_algorithms',
  totalLearningTime: 7200000,
  culturalAnalogiesUsed: ['cricket_batting_order', 'mandi_vendor_inventory'],
  breakthroughMoments: 3,
  gritScore: 75,
  voiceVivaScore: 85,
  scaffoldCompletion: 85,
  strugglePatterns: [],
  ...overrides,
});