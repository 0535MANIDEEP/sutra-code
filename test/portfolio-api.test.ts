import { handler } from '../lambda/portfolio-api/index';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Mock AWS SDK clients
jest.mock('@aws-sdk/lib-dynamodb');

const mockDocClient = {
  send: jest.fn(),
};

// Mock the client
(DynamoDBDocumentClient.from as jest.Mock) = jest.fn().mockReturnValue(mockDocClient);

describe('Portfolio API Lambda', () => {
  let mockContext: Context;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContext = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'portfolio-api',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:ap-south-1:123456789012:function:portfolio-api',
      memoryLimitInMB: '512',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/portfolio-api',
      logStreamName: '2024/01/01/[$LATEST]test',
      getRemainingTimeInMillis: () => 30000,
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn(),
    };

    // Set environment variables
    process.env.AWS_REGION = 'ap-south-1';
    process.env.STUDENT_PROFILES_TABLE = 'SutraCode-StudentProfiles';
    process.env.ANALYTICS_TABLE = 'SutraCode-Analytics';
    process.env.VOICE_VIVA_TABLE = 'SutraCode-VoiceViva';
    process.env.STRUGGLE_LOGS_TABLE = 'SutraCode-StruggleLogs';
    process.env.GITHUB_SUBMISSIONS_TABLE = 'SutraCode-GitHubSubmissions';
    process.env.RECRUITER_ACCESS_TABLE = 'SutraCode-RecruiterAccess';
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 for missing authorization header', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/portfolios',
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
      };

      const result = await handler(event, mockContext);

      expect(result).toEqual({
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: expect.stringContaining('Unauthorized: Invalid recruiter credentials'),
      });
    });

    it('should return 401 for invalid recruiter credentials', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/portfolios',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
      };

      // Mock inactive recruiter
      mockDocClient.send.mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: false } });

      const result = await handler(event, mockContext);

      expect(result).toEqual({
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: expect.stringContaining('Unauthorized: Invalid recruiter credentials'),
      });
    });
  });

  describe('GET /portfolios', () => {
    it('should return paginated list of student portfolios', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/portfolios',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        queryStringParameters: {
          limit: '10',
          sortBy: 'gritScore',
          sortOrder: 'desc',
        },
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
      };

      // Mock active recruiter
      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } })
        .mockResolvedValueOnce({
          Items: [
            {
              studentId: 'student-1',
              name: 'Aarav Sharma',
              college: 'IIT Delhi',
              gritScore: 85,
              consentGiven: true,
              lastActive: Date.now(),
            },
            {
              studentId: 'student-2',
              name: 'Priya Patel',
              college: 'BITS Pilani',
              gritScore: 78,
              consentGiven: true,
              lastActive: Date.now() - 86400000,
            },
          ],
        })
        .mockResolvedValue({ Item: { totalLearningTime: 7200000, conceptsMastered: ['arrays', 'loops'] } });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.portfolios).toHaveLength(2);
      expect(responseBody.portfolios[0].personalInfo.name).toBe('Aarav Sharma');
      expect(responseBody.portfolios[0].gritScore.overallScore).toBe(85);
      expect(responseBody.pagination).toBeDefined();
      expect(responseBody.metadata.sortBy).toBe('gritScore');
    });

    it('should handle pagination with lastKey', async () => {
      const lastKey = encodeURIComponent(JSON.stringify({ studentId: 'student-10' }));
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/portfolios',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        queryStringParameters: {
          limit: '5',
          lastKey: lastKey,
        },
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } })
        .mockResolvedValueOnce({
          Items: [
            { studentId: 'student-11', name: 'Rahul Kumar', gritScore: 72, consentGiven: true },
          ],
          LastEvaluatedKey: { studentId: 'student-11' },
        })
        .mockResolvedValue({ Item: {} });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.pagination.hasMore).toBe(true);
      expect(responseBody.pagination.lastKey).toBeDefined();
    });
  });

  describe('GET /portfolios/{studentId}', () => {
    it('should return detailed portfolio for specific student', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/portfolios/student-123',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
      };

      // Mock comprehensive student data
      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } })
        .mockResolvedValueOnce({
          Item: {
            studentId: 'student-123',
            name: 'Aarav Sharma',
            email: 'aarav@example.com',
            college: 'IIT Delhi',
            location: 'Delhi',
            gritScore: 85,
            consentGiven: true,
            programmingLanguages: { JavaScript: 8, Python: 7, Java: 6 },
          },
        })
        .mockResolvedValueOnce({
          Items: [
            {
              analyticsId: 'student-123#latest',
              totalLearningTime: 10800000,
              conceptsMastered: ['arrays', 'loops', 'functions', 'objects'],
              learningVelocity: 75,
              persistence: 82,
              resilience: 78,
            },
          ],
        })
        .mockResolvedValueOnce({
          Items: [
            {
              vivaId: 'viva-1',
              conceptTested: 'Arrays and Loops',
              overallScore: 88,
              bhashiniConfidenceScore: 0.92,
              languageUsed: 'Hindi',
              communicationClarity: 85,
              timestamp: Date.now() - 86400000,
            },
          ],
        })
        .mockResolvedValueOnce({
          Items: [
            {
              eventType: 'error_analysis',
              resolutionTime: 300000,
              conceptContext: 'arrays',
              timestamp: Date.now() - 172800000,
            },
            {
              eventType: 'help_request_analysis',
              helpQuality: 'productive',
              timestamp: Date.now() - 259200000,
            },
          ],
        })
        .mockResolvedValueOnce({
          Items: [
            {
              submissionId: 'sub-1',
              repositoryUrl: 'https://github.com/aarav/project1',
              conceptContext: 'sorting-algorithms',
              submissionDate: Date.now() - 604800000,
              codeQuality: 85,
            },
          ],
        });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.portfolio).toBeDefined();
      expect(responseBody.portfolio.studentId).toBe('student-123');
      expect(responseBody.portfolio.personalInfo.name).toBe('Aarav Sharma');
      expect(responseBody.portfolio.gritScore.overallScore).toBe(85);
      expect(responseBody.portfolio.learningAnalytics.totalLearningTime).toBe(10800000);
      expect(responseBody.portfolio.voiceVivaPerformance).toHaveLength(1);
      expect(responseBody.portfolio.codeSubmissions).toHaveLength(1);
      expect(responseBody.visualizationData).toBeDefined();
      expect(responseBody.visualizationData.gritScoreRadar).toBeDefined();
    });

    it('should return 403 when student has not granted consent', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/portfolios/student-456',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } });

      const result = await handler(event, mockContext);

      expect(result).toEqual({
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: expect.stringContaining('Student has not granted access to their portfolio'),
      });
    });
  });

  describe('GET /search', () => {
    it('should search portfolios with filters', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/search',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          gritScoreRange: { min: 70, max: 90 },
          programmingLanguages: ['JavaScript', 'Python'],
          colleges: ['IIT Delhi', 'BITS Pilani'],
        }),
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: { limit: '20' },
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } })
        .mockResolvedValueOnce({
          Items: [
            {
              studentId: 'student-1',
              name: 'Aarav Sharma',
              college: 'IIT Delhi',
              gritScore: 85,
              programmingLanguages: { JavaScript: 8, Python: 7 },
              consentGiven: true,
            },
            {
              studentId: 'student-2',
              name: 'Priya Patel',
              college: 'BITS Pilani',
              gritScore: 78,
              programmingLanguages: { JavaScript: 7, Python: 8 },
              consentGiven: true,
            },
          ],
        })
        .mockResolvedValue({ Item: {} });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.results).toHaveLength(2);
      expect(responseBody.results[0].matchScore).toBeDefined();
      expect(responseBody.searchMetadata.totalMatches).toBe(2);
      expect(responseBody.suggestions).toBeDefined();
    });

    it('should handle empty search results', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/search',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          gritScoreRange: { min: 95, max: 100 },
        }),
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } })
        .mockResolvedValueOnce({ Items: [] });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.results).toHaveLength(0);
      expect(responseBody.searchMetadata.totalMatches).toBe(0);
    });
  });

  describe('GET /analytics', () => {
    it('should return comparative analytics across students', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/analytics',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        queryStringParameters: {
          type: 'comprehensive',
          timeframe: '30d',
        },
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } })
        .mockResolvedValueOnce({
          Items: Array.from({ length: 50 }, (_, i) => ({
            studentId: `student-${i}`,
            name: `Student ${i}`,
            college: i % 3 === 0 ? 'IIT Delhi' : i % 3 === 1 ? 'BITS Pilani' : 'NIT Trichy',
            gritScore: 60 + Math.random() * 40,
            consentGiven: true,
          })),
        });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.analytics).toBeDefined();
      expect(responseBody.analytics.totalStudentsAnalyzed).toBe(50);
      expect(responseBody.analytics.averageGritScore).toBeDefined();
      expect(responseBody.analytics.topPerformingColleges).toHaveLength(3);
      expect(responseBody.analytics.skillDistribution).toBeDefined();
      expect(responseBody.analytics.recommendationInsights).toBeDefined();
      expect(responseBody.metadata.statisticalSignificance).toBe('high');
      expect(responseBody.metadata.confidenceLevel).toBe('95%');
    });

    it('should handle different analysis types', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/analytics',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        queryStringParameters: {
          type: 'skills',
          timeframe: '7d',
        },
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } })
        .mockResolvedValueOnce({
          Items: Array.from({ length: 25 }, (_, i) => ({
            studentId: `student-${i}`,
            consentGiven: true,
          })),
        });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.metadata.analysisType).toBe('skills');
      expect(responseBody.metadata.timeframe).toBe('7d');
      expect(responseBody.metadata.statisticalSignificance).toBe('moderate');
    });
  });

  describe('GET /filters', () => {
    it('should return available filter options', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/filters',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } })
        .mockResolvedValueOnce({
          Items: [
            {
              studentId: 'student-1',
              college: 'IIT Delhi',
              graduationYear: 2024,
              location: 'Delhi',
              programmingLanguages: ['JavaScript', 'Python'],
              specializations: ['Machine Learning'],
              consentGiven: true,
            },
            {
              studentId: 'student-2',
              college: 'BITS Pilani',
              graduationYear: 2025,
              location: 'Rajasthan',
              programmingLanguages: ['Java', 'Python'],
              specializations: ['Web Development'],
              consentGiven: true,
            },
          ],
        });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.filterOptions).toBeDefined();
      expect(responseBody.filterOptions.programmingLanguages).toContain('JavaScript');
      expect(responseBody.filterOptions.programmingLanguages).toContain('Python');
      expect(responseBody.filterOptions.colleges).toContain('IIT Delhi');
      expect(responseBody.filterOptions.colleges).toContain('BITS Pilani');
      expect(responseBody.filterOptions.graduationYears).toContain(2024);
      expect(responseBody.filterOptions.graduationYears).toContain(2025);
      expect(responseBody.filterOptions.gritScoreRanges).toHaveLength(5);
      expect(responseBody.metadata.totalStudents).toBe(2);
    });
  });

  describe('POST /analytics/generate', () => {
    it('should generate custom analytics', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/analytics/generate',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          analysisType: 'skill_gap_analysis',
          filters: {
            colleges: ['IIT Delhi', 'BITS Pilani'],
            graduationYears: [2024, 2025],
          },
          metrics: ['gritScore', 'learningVelocity', 'industryReadiness'],
        }),
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.analytics).toBeDefined();
      expect(responseBody.requestMetadata.requestId).toBe('test-request-id');
      expect(responseBody.requestMetadata.recruiterId).toBe('test-recruiter');
    });
  });

  describe('POST /export', () => {
    it('should export portfolio data', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/export',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          format: 'csv',
          studentIds: ['student-1', 'student-2'],
          fields: ['name', 'college', 'gritScore', 'industryReadiness'],
        }),
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.analytics).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/portfolios',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } })
        .mockRejectedValueOnce(new Error('DynamoDB connection failed'));

      const result = await handler(event, mockContext);

      expect(result).toEqual({
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: expect.stringContaining('Failed to fetch student portfolios'),
      });
    });

    it('should return 404 for unknown endpoints', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/unknown-endpoint',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } });

      const result = await handler(event, mockContext);

      expect(result).toEqual({
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: expect.stringContaining('Endpoint not found'),
      });
    });

    it('should handle malformed request body', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/search',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: '{ invalid json }',
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } });

      const result = await handler(event, mockContext);

      expect(result).toEqual({
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: expect.stringContaining('Internal server error'),
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within 3 seconds for portfolio visualization', async () => {
      const startTime = Date.now();
      
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/portfolios/student-123',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
      };

      // Mock fast responses
      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } })
        .mockResolvedValueOnce({ Item: { studentId: 'student-123', consentGiven: true } })
        .mockResolvedValueOnce({ Items: [] })
        .mockResolvedValueOnce({ Items: [] })
        .mockResolvedValueOnce({ Items: [] })
        .mockResolvedValueOnce({ Items: [] });

      const result = await handler(event, mockContext);
      const responseTime = Date.now() - startTime;

      expect(result.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(3000); // Should respond within 3 seconds
    });

    it('should handle search queries within 1 second', async () => {
      const startTime = Date.now();
      
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/search',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          gritScoreRange: { min: 70, max: 90 },
        }),
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } })
        .mockResolvedValueOnce({ Items: [] });

      const result = await handler(event, mockContext);
      const responseTime = Date.now() - startTime;

      expect(result.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('Data Completeness Requirements', () => {
    it('should display portfolios with 15 required data points', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/portfolios/student-123',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
      };

      // Mock comprehensive data
      mockDocClient.send
        .mockResolvedValueOnce({ Item: { recruiterId: 'test-recruiter', isActive: true } })
        .mockResolvedValueOnce({
          Item: {
            studentId: 'student-123',
            name: 'Aarav Sharma',
            email: 'aarav@example.com',
            college: 'IIT Delhi',
            gritScore: 85,
            consentGiven: true,
            programmingLanguages: { JavaScript: 8, Python: 7 },
          },
        })
        .mockResolvedValueOnce({
          Items: [
            {
              totalLearningTime: 10800000,
              conceptsMastered: ['arrays', 'loops'],
              learningVelocity: 75,
              analogyEffectiveness: { cricket_analogy: 0.8 },
            },
          ],
        })
        .mockResolvedValueOnce({
          Items: [
            {
              vivaId: 'viva-1',
              overallScore: 88,
              bhashiniConfidenceScore: 0.92,
              questionAnswerPairs: [{ question: 'Q1', studentAnswer: 'A1', correctnessScore: 0.9 }],
            },
          ],
        })
        .mockResolvedValueOnce({
          Items: [
            { eventType: 'error_analysis', resolutionTime: 300000 },
          ],
        })
        .mockResolvedValueOnce({
          Items: [
            { submissionId: 'sub-1', codeQuality: 85, repositoryUrl: 'https://github.com/test' },
          ],
        });

      const result = await handler(event, mockContext);
      const responseBody = JSON.parse(result.body);
      const portfolio = responseBody.portfolio;

      // Verify 15 required data points are present
      const dataPoints = [
        portfolio.personalInfo.name,
        portfolio.personalInfo.college,
        portfolio.gritScore.overallScore,
        portfolio.learningAnalytics.totalLearningTime,
        portfolio.learningAnalytics.learningVelocity,
        portfolio.skillAssessment.programmingLanguages,
        portfolio.voiceVivaPerformance,
        portfolio.codeSubmissions,
        portfolio.strugglePatterns,
        portfolio.culturalAnalogies,
        portfolio.portfolioMetrics.industryReadiness,
        portfolio.portfolioMetrics.hiringProbability,
        portfolio.verificationData.portfolioHash,
        portfolio.academicInfo.projectsCompleted,
        portfolio.gritScore.detailedMetrics,
      ];

      const definedDataPoints = dataPoints.filter(point => point !== undefined && point !== null);
      expect(definedDataPoints.length).toBeGreaterThanOrEqual(15);
    });
  });
});