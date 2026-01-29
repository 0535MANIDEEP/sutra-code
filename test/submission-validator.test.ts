import { handler } from '../lambda/submission-validator/index';
import { APIGatewayProxyEvent, Context, SQSEvent } from 'aws-lambda';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SQSClient } from '@aws-sdk/client-sqs';

// Mock AWS SDK clients
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-sqs');

const mockDocClient = {
  send: jest.fn(),
};

const mockSQSClient = {
  send: jest.fn(),
};

// Mock the clients
(DynamoDBDocumentClient.from as jest.Mock) = jest.fn().mockReturnValue(mockDocClient);
(SQSClient as jest.Mock) = jest.fn().mockImplementation(() => mockSQSClient);

describe('Submission Validator Lambda', () => {
  let mockContext: Context;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContext = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'submission-validator',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:ap-south-1:123456789012:function:submission-validator',
      memoryLimitInMB: '512',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/submission-validator',
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
    process.env.SUBMISSION_QUEUE_TABLE = 'SutraCode-SubmissionQueue';
    process.env.SUBMISSION_QUEUE_URL = 'https://sqs.ap-south-1.amazonaws.com/123456789012/submission-queue';
    process.env.HMAC_SECRET = 'test-secret';
  });

  describe('API Gateway Events', () => {
    describe('POST /validate-criteria', () => {
      it('should validate submission criteria successfully when all requirements are met', async () => {
        const event: APIGatewayProxyEvent = {
          httpMethod: 'POST',
          path: '/validate-criteria',
          body: JSON.stringify({
            studentId: 'student-123',
            sessionId: 'session-456',
            conceptContext: 'arrays-and-loops',
            codeContent: 'console.log("Hello World");',
            repositoryUrl: 'https://github.com/student/repo',
          }),
          headers: {},
          multiValueHeaders: {},
          isBase64Encoded: false,
          pathParameters: null,
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          stageVariables: null,
          requestContext: {} as any,
          resource: '',
        };

        // Mock successful data retrieval with passing criteria
        mockDocClient.send
          .mockResolvedValueOnce({ Item: { studentId: 'student-123', gritScore: 75 } }) // Student profile
          .mockResolvedValueOnce({ Item: { analyticsId: 'student-123#session-456', totalLearningTime: 7200000, scaffoldProgression: new Array(85).fill({}), breakthroughMoments: 3, analogyEffectiveness: { cricket_analogy: 0.8, mandi_analogy: 0.7 } } }) // Analytics
          .mockResolvedValueOnce({ Items: [{ studentId: 'student-123', sessionId: 'session-456', overallScore: 78 }] }) // Voice Viva
          .mockResolvedValueOnce({ Items: [{ eventType: 'help_request_analysis' }, { eventType: 'error_analysis' }] }); // Struggle logs

        const result = await handler(event, mockContext);

        expect(result).toEqual({
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: expect.stringContaining('"valid":true'),
        });

        const responseBody = JSON.parse((result as any).body);
        expect(responseBody.valid).toBe(true);
        expect(responseBody.criteria.voiceVivaScore).toBe(78);
        expect(responseBody.criteria.scaffoldCompletion).toBe(85);
        expect(responseBody.criteria.gritScore).toBe(75);
        expect(responseBody.message).toContain('All submission criteria met');
      });

      it('should reject submission when criteria are not met', async () => {
        const event: APIGatewayProxyEvent = {
          httpMethod: 'POST',
          path: '/validate-criteria',
          body: JSON.stringify({
            studentId: 'student-123',
            sessionId: 'session-456',
            conceptContext: 'arrays-and-loops',
            codeContent: 'console.log("Hello World");',
            repositoryUrl: 'https://github.com/student/repo',
          }),
          headers: {},
          multiValueHeaders: {},
          isBase64Encoded: false,
          pathParameters: null,
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          stageVariables: null,
          requestContext: {} as any,
          resource: '',
        };

        // Mock data retrieval with failing criteria
        mockDocClient.send
          .mockResolvedValueOnce({ Item: { studentId: 'student-123', gritScore: 45 } }) // Low grit score
          .mockResolvedValueOnce({ Item: { analyticsId: 'student-123#session-456', totalLearningTime: 3600000, scaffoldProgression: new Array(60).fill({}), breakthroughMoments: 1 } }) // Low completion
          .mockResolvedValueOnce({ Items: [{ studentId: 'student-123', sessionId: 'session-456', overallScore: 65 }] }) // Low Voice Viva score
          .mockResolvedValueOnce({ Items: [] }); // No struggle logs

        const result = await handler(event, mockContext);

        expect(result).toEqual({
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: expect.stringContaining('"valid":false'),
        });

        const responseBody = JSON.parse((result as any).body);
        expect(responseBody.valid).toBe(false);
        expect(responseBody.validation.missingRequirements).toHaveLength(4); // All criteria failing
        expect(responseBody.message).toContain('Submission criteria not met');
      });

      it('should return 400 for missing required fields', async () => {
        const event: APIGatewayProxyEvent = {
          httpMethod: 'POST',
          path: '/validate-criteria',
          body: JSON.stringify({
            studentId: 'student-123',
            // Missing sessionId, conceptContext, codeContent, repositoryUrl
          }),
          headers: {},
          multiValueHeaders: {},
          isBase64Encoded: false,
          pathParameters: null,
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          stageVariables: null,
          requestContext: {} as any,
          resource: '',
        };

        const result = await handler(event, mockContext);

        expect(result).toEqual({
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: expect.stringContaining('Missing required field'),
        });
      });
    });

    describe('POST /generate-documentation', () => {
      it('should generate comprehensive learning documentation', async () => {
        const event: APIGatewayProxyEvent = {
          httpMethod: 'POST',
          path: '/generate-documentation',
          body: JSON.stringify({
            studentId: 'student-123',
            sessionId: 'session-456',
            conceptContext: 'arrays-and-loops',
            codeContent: 'console.log("Hello World");',
            repositoryUrl: 'https://github.com/student/repo',
          }),
          headers: {},
          multiValueHeaders: {},
          isBase64Encoded: false,
          pathParameters: null,
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          stageVariables: null,
          requestContext: {} as any,
          resource: '',
        };

        // Mock comprehensive data for documentation generation
        mockDocClient.send
          .mockResolvedValueOnce({ Item: { studentId: 'student-123', gritScore: 75 } }) // Student profile
          .mockResolvedValueOnce({ Item: { 
            analyticsId: 'student-123#session-456', 
            totalLearningTime: 7200000, 
            scaffoldProgression: new Array(85).fill({}), 
            breakthroughMoments: 3,
            analogyEffectiveness: { cricket_analogy: 0.8, mandi_analogy: 0.7 },
            gritComponents: { persistence: 80, resilience: 70, curiosity: 85 }
          }}) // Analytics
          .mockResolvedValueOnce({ Items: [{ studentId: 'student-123', sessionId: 'session-456', overallScore: 78 }] }) // Voice Viva
          .mockResolvedValueOnce({ Items: [
            { eventType: 'help_request_analysis', analysisData: { helpQuality: 'productive', contextualRelevance: 'high' } },
            { eventType: 'error_analysis', analysisData: { errorType: 'syntax' } },
            { eventType: 'correction_analysis', analysisData: { helpUsed: false } },
            { eventType: 'code_deletion_analysis', analysisData: { timeSpent: 300000, deletedLines: 5 } },
            { eventType: 'focus_analysis', analysisData: { focusQuality: 0.8, deepWorkSessions: 3 } }
          ] }) // Struggle logs
          .mockResolvedValueOnce({ Item: { 
            analyticsId: 'student-123#session-456', 
            totalLearningTime: 7200000, 
            scaffoldProgression: new Array(85).fill({}), 
            breakthroughMoments: 3,
            analogyEffectiveness: { cricket_analogy: 0.8, mandi_analogy: 0.7 }
          }}) // Analytics (second call)
          .mockResolvedValueOnce({ Items: [
            { eventType: 'help_request_analysis', analysisData: { helpQuality: 'productive', contextualRelevance: 'high' } },
            { eventType: 'error_analysis', analysisData: { errorType: 'syntax' } },
            { eventType: 'correction_analysis', analysisData: { helpUsed: false } },
            { eventType: 'code_deletion_analysis', analysisData: { timeSpent: 300000, deletedLines: 5 } },
            { eventType: 'focus_analysis', analysisData: { focusQuality: 0.8, deepWorkSessions: 3 } }
          ] }); // Struggle logs (second call)

        const result = await handler(event, mockContext);

        expect(result).toEqual({
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: expect.stringContaining('"success":true'),
        });

        const responseBody = JSON.parse((result as any).body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.learningJourney).toBeDefined();
        expect(responseBody.documentation).toBeDefined();
        expect(responseBody.documentation.journeyMarkdown).toContain('Learning Journey: arrays-and-loops');
        expect(responseBody.documentation.gritScoreCard).toContain('student-123');
        expect(responseBody.documentation.struggleAnalysis).toContain('Struggle Analysis Report');
        expect(responseBody.documentation.culturalAnalogies).toContain('Cultural Analogies Documentation');
      });
    });

    describe('POST /queue-submission', () => {
      it('should queue submission for processing successfully', async () => {
        const event: APIGatewayProxyEvent = {
          httpMethod: 'POST',
          path: '/queue-submission',
          body: JSON.stringify({
            studentId: 'student-123',
            sessionId: 'session-456',
            conceptContext: 'arrays-and-loops',
            codeContent: 'console.log("Hello World");',
            repositoryUrl: 'https://github.com/student/repo',
          }),
          headers: {},
          multiValueHeaders: {},
          isBase64Encoded: false,
          pathParameters: null,
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          stageVariables: null,
          requestContext: {} as any,
          resource: '',
        };

        mockDocClient.send.mockResolvedValueOnce({}); // PutCommand success
        mockSQSClient.send.mockResolvedValueOnce({}); // SendMessageCommand success

        const result = await handler(event, mockContext);

        expect(result).toEqual({
          statusCode: 202,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: expect.stringContaining('"success":true'),
        });

        const responseBody = JSON.parse((result as any).body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.submissionId).toBeDefined();
        expect(responseBody.status).toBe('queued');
        expect(responseBody.estimatedProcessingTime).toBe('2-5 minutes');

        // Verify DynamoDB put was called
        expect(mockDocClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              TableName: 'SutraCode-SubmissionQueue',
              Item: expect.objectContaining({
                studentId: 'student-123',
                sessionId: 'session-456',
                status: 'pending',
                attempts: 0,
                maxAttempts: 3,
              }),
            }),
          })
        );

        // Verify SQS send was called
        expect(mockSQSClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              QueueUrl: 'https://sqs.ap-south-1.amazonaws.com/123456789012/submission-queue',
              DelaySeconds: 0,
            }),
          })
        );
      });
    });

    describe('GET /submission-status', () => {
      it('should return submission status for student and session', async () => {
        const event: APIGatewayProxyEvent = {
          httpMethod: 'GET',
          path: '/submission-status',
          body: JSON.stringify({
            studentId: 'student-123',
            sessionId: 'session-456',
          }),
          headers: {},
          multiValueHeaders: {},
          isBase64Encoded: false,
          pathParameters: null,
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          stageVariables: null,
          requestContext: {} as any,
          resource: '',
        };

        const mockSubmissions = [
          {
            submissionId: 'sub-1',
            studentId: 'student-123',
            sessionId: 'session-456',
            status: 'completed',
            createdAt: Date.now() - 3600000,
            completedAt: Date.now() - 3000000,
          },
          {
            submissionId: 'sub-2',
            studentId: 'student-123',
            sessionId: 'session-456',
            status: 'pending',
            createdAt: Date.now() - 1800000,
          },
        ];

        mockDocClient.send.mockResolvedValueOnce({ Items: mockSubmissions });

        const result = await handler(event, mockContext);

        expect(result).toEqual({
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: expect.stringContaining('"count":2'),
        });

        const responseBody = JSON.parse((result as any).body);
        expect(responseBody.submissions).toHaveLength(2);
        expect(responseBody.count).toBe(2);
        expect(responseBody.submissions[0].submissionId).toBe('sub-1');
      });
    });

    it('should return 404 for unknown endpoints', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/unknown-endpoint',
        body: JSON.stringify({
          studentId: 'student-123',
          sessionId: 'session-456',
          conceptContext: 'arrays-and-loops',
          codeContent: 'console.log("Hello World");',
          repositoryUrl: 'https://github.com/student/repo',
        }),
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

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

    it('should return 400 for missing request body', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/validate-criteria',
        body: null,
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result).toEqual({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: expect.stringContaining('Request body is required'),
      });
    });
  });

  describe('SQS Events', () => {
    it('should process SQS messages successfully', async () => {
      const sqsEvent: SQSEvent = {
        Records: [
          {
            messageId: 'msg-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              submissionId: 'sub-123',
              studentId: 'student-123',
              sessionId: 'session-456',
              submissionData: {
                studentId: 'student-123',
                sessionId: 'session-456',
                conceptContext: 'arrays-and-loops',
                codeContent: 'console.log("Hello World");',
                repositoryUrl: 'https://github.com/student/repo',
              },
              status: 'pending',
              attempts: 0,
              maxAttempts: 3,
              createdAt: Date.now(),
            }),
            attributes: {} as any,
            messageAttributes: {},
            md5OfBody: '',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:ap-south-1:123456789012:submission-queue',
            awsRegion: 'ap-south-1',
          },
        ],
      };

      // Mock successful processing
      mockDocClient.send
        .mockResolvedValueOnce({}) // Update status to processing
        .mockResolvedValueOnce({ Item: { studentId: 'student-123', gritScore: 75 } }) // Student profile
        .mockResolvedValueOnce({ Item: { analyticsId: 'student-123#session-456', totalLearningTime: 7200000, scaffoldProgression: new Array(85).fill({}), breakthroughMoments: 3 } }) // Analytics
        .mockResolvedValueOnce({ Items: [{ studentId: 'student-123', sessionId: 'session-456', overallScore: 78 }] }) // Voice Viva
        .mockResolvedValueOnce({ Items: [] }) // Struggle logs
        .mockResolvedValueOnce({ Item: { analyticsId: 'student-123#session-456', totalLearningTime: 7200000, scaffoldProgression: new Array(85).fill({}), breakthroughMoments: 3 } }) // Analytics (second call)
        .mockResolvedValueOnce({ Items: [] }) // Struggle logs (second call)
        .mockResolvedValueOnce({}); // Update status to completed

      mockSQSClient.send.mockResolvedValueOnce({}); // Delete message

      await handler(sqsEvent, mockContext);

      // Verify status updates were called
      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'SutraCode-SubmissionQueue',
            UpdateExpression: expect.stringContaining('SET #status = :status'),
          }),
        })
      );

      // Verify message deletion
      expect(mockSQSClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            QueueUrl: 'https://sqs.ap-south-1.amazonaws.com/123456789012/submission-queue',
            ReceiptHandle: 'receipt-1',
          }),
        })
      );
    });

    it('should handle failed submissions with retry logic', async () => {
      const sqsEvent: SQSEvent = {
        Records: [
          {
            messageId: 'msg-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              submissionId: 'sub-123',
              studentId: 'student-123',
              sessionId: 'session-456',
              submissionData: {
                studentId: 'student-123',
                sessionId: 'session-456',
                conceptContext: 'arrays-and-loops',
                codeContent: 'console.log("Hello World");',
                repositoryUrl: 'https://github.com/student/repo',
              },
              status: 'pending',
              attempts: 2, // Near max attempts
              maxAttempts: 3,
              createdAt: Date.now(),
            }),
            attributes: {} as any,
            messageAttributes: {},
            md5OfBody: '',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:ap-south-1:123456789012:submission-queue',
            awsRegion: 'ap-south-1',
          },
        ],
      };

      // Mock failed processing (criteria not met)
      mockDocClient.send
        .mockResolvedValueOnce({}) // Update status to processing
        .mockResolvedValueOnce({ Item: { studentId: 'student-123', gritScore: 45 } }) // Low grit score
        .mockResolvedValueOnce({ Item: { analyticsId: 'student-123#session-456', totalLearningTime: 3600000, scaffoldProgression: new Array(60).fill({}) } }) // Low completion
        .mockResolvedValueOnce({ Items: [{ studentId: 'student-123', sessionId: 'session-456', overallScore: 65 }] }) // Low Voice Viva
        .mockResolvedValueOnce({ Items: [] }) // No struggle logs
        .mockResolvedValueOnce({}); // Update status to failed

      mockSQSClient.send.mockResolvedValueOnce({}); // Delete message (max attempts reached)

      await handler(sqsEvent, mockContext);

      // Verify final status update to failed
      expect(mockDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'SutraCode-SubmissionQueue',
            UpdateExpression: expect.stringContaining('SET #status = :status'),
            ExpressionAttributeValues: expect.objectContaining({
              ':status': 'failed',
              ':attempts': 3,
            }),
          }),
        })
      );
    });
  });

  describe('Validation Logic', () => {
    it('should correctly evaluate submission criteria', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/validate-criteria',
        body: JSON.stringify({
          studentId: 'student-123',
          sessionId: 'session-456',
          conceptContext: 'arrays-and-loops',
          codeContent: 'console.log("Hello World");',
          repositoryUrl: 'https://github.com/student/repo',
        }),
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      // Test edge case: exactly meeting thresholds
      mockDocClient.send
        .mockResolvedValueOnce({ Item: { studentId: 'student-123', gritScore: 60 } }) // Exactly 60
        .mockResolvedValueOnce({ Item: { analyticsId: 'student-123#session-456', totalLearningTime: 7200000, scaffoldProgression: new Array(80).fill({}), breakthroughMoments: 2 } }) // Exactly 80% and 2 hours
        .mockResolvedValueOnce({ Items: [{ studentId: 'student-123', sessionId: 'session-456', overallScore: 70 }] }) // Exactly 70%
        .mockResolvedValueOnce({ Items: [] });

      const result = await handler(event, mockContext);
      const responseBody = JSON.parse((result as any).body);

      expect(responseBody.valid).toBe(true);
      expect(responseBody.criteria.voiceVivaScore).toBe(70);
      expect(responseBody.criteria.scaffoldCompletion).toBe(80);
      expect(responseBody.criteria.gritScore).toBe(60);
      expect(responseBody.validation.score).toBe(100); // All criteria met
    });

    it('should handle missing data gracefully', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/validate-criteria',
        body: JSON.stringify({
          studentId: 'student-123',
          sessionId: 'session-456',
          conceptContext: 'arrays-and-loops',
          codeContent: 'console.log("Hello World");',
          repositoryUrl: 'https://github.com/student/repo',
        }),
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      // Mock missing data (empty responses)
      mockDocClient.send
        .mockResolvedValueOnce({}) // No student profile
        .mockResolvedValueOnce({}) // No analytics
        .mockResolvedValueOnce({ Items: [] }) // No Voice Viva results
        .mockResolvedValueOnce({ Items: [] }); // No struggle logs

      const result = await handler(event, mockContext);
      const responseBody = JSON.parse((result as any).body);

      expect(responseBody.valid).toBe(false);
      expect(responseBody.criteria.voiceVivaScore).toBe(0);
      expect(responseBody.criteria.scaffoldCompletion).toBe(0);
      expect(responseBody.criteria.gritScore).toBe(0);
      expect(responseBody.validation.missingRequirements).toHaveLength(4);
    });
  });

  describe('Error Handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/validate-criteria',
        body: JSON.stringify({
          studentId: 'student-123',
          sessionId: 'session-456',
          conceptContext: 'arrays-and-loops',
          codeContent: 'console.log("Hello World");',
          repositoryUrl: 'https://github.com/student/repo',
        }),
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockDocClient.send.mockRejectedValueOnce(new Error('DynamoDB connection failed'));

      const result = await handler(event, mockContext);

      expect(result).toEqual({
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: expect.stringContaining('Failed to validate submission criteria'),
      });
    });

    it('should handle SQS errors gracefully', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/queue-submission',
        body: JSON.stringify({
          studentId: 'student-123',
          sessionId: 'session-456',
          conceptContext: 'arrays-and-loops',
          codeContent: 'console.log("Hello World");',
          repositoryUrl: 'https://github.com/student/repo',
        }),
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockDocClient.send.mockResolvedValueOnce({}); // DynamoDB success
      mockSQSClient.send.mockRejectedValueOnce(new Error('SQS send failed')); // SQS failure

      const result = await handler(event, mockContext);

      expect(result).toEqual({
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: expect.stringContaining('Failed to queue submission for processing'),
      });
    });

    it('should handle malformed JSON in request body', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/validate-criteria',
        body: '{ invalid json }',
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

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

  describe('Documentation Generation', () => {
    it('should generate proper markdown format for learning journey', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/generate-documentation',
        body: JSON.stringify({
          studentId: 'student-123',
          sessionId: 'session-456',
          conceptContext: 'arrays-and-loops',
          codeContent: 'console.log("Hello World");',
          repositoryUrl: 'https://github.com/student/repo',
        }),
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      // Mock rich data for documentation
      mockDocClient.send
        .mockResolvedValueOnce({ Item: { studentId: 'student-123', gritScore: 85 } })
        .mockResolvedValueOnce({ Item: { 
          analyticsId: 'student-123#session-456', 
          totalLearningTime: 10800000, // 3 hours
          scaffoldProgression: new Array(95).fill({}), 
          breakthroughMoments: 5,
          analogyEffectiveness: { 
            cricket_analogy: 0.9, 
            mandi_analogy: 0.8, 
            festival_analogy: 0.85 
          },
          gritComponents: { 
            persistence: 90, 
            resilience: 80, 
            curiosity: 95, 
            growth: 85, 
            authenticity: 88 
          }
        }})
        .mockResolvedValueOnce({ Items: [{ studentId: 'student-123', sessionId: 'session-456', overallScore: 88 }] })
        .mockResolvedValueOnce({ Items: [
          { eventType: 'help_request_analysis', analysisData: { helpQuality: 'productive', contextualRelevance: 'high', helpEffectiveness: 0.9 }, timestamp: Date.now() - 3600000 },
          { eventType: 'error_analysis', analysisData: { errorType: 'logic' }, timestamp: Date.now() - 3500000 },
          { eventType: 'correction_analysis', analysisData: { helpUsed: false }, timestamp: Date.now() - 3400000 },
          { eventType: 'code_deletion_analysis', analysisData: { timeSpent: 600000, deletedLines: 10 }, timestamp: Date.now() - 3000000 },
          { eventType: 'focus_analysis', analysisData: { focusQuality: 0.9, deepWorkSessions: 4, distractionLevel: 0.1, multitaskingScore: 0.2 }, timestamp: Date.now() - 2000000 }
        ] })
        .mockResolvedValueOnce({ Item: { 
          analyticsId: 'student-123#session-456', 
          totalLearningTime: 10800000,
          scaffoldProgression: new Array(95).fill({}), 
          breakthroughMoments: 5,
          analogyEffectiveness: { 
            cricket_analogy: 0.9, 
            mandi_analogy: 0.8, 
            festival_analogy: 0.85 
          }
        }})
        .mockResolvedValueOnce({ Items: [
          { eventType: 'help_request_analysis', analysisData: { helpQuality: 'productive', contextualRelevance: 'high', helpEffectiveness: 0.9 }, timestamp: Date.now() - 3600000 },
          { eventType: 'error_analysis', analysisData: { errorType: 'logic' }, timestamp: Date.now() - 3500000 },
          { eventType: 'correction_analysis', analysisData: { helpUsed: false }, timestamp: Date.now() - 3400000 },
          { eventType: 'code_deletion_analysis', analysisData: { timeSpent: 600000, deletedLines: 10 }, timestamp: Date.now() - 3000000 },
          { eventType: 'focus_analysis', analysisData: { focusQuality: 0.9, deepWorkSessions: 4, distractionLevel: 0.1, multitaskingScore: 0.2 }, timestamp: Date.now() - 2000000 }
        ] });

      const result = await handler(event, mockContext);
      const responseBody = JSON.parse((result as any).body);

      expect(responseBody.success).toBe(true);
      
      // Verify journey markdown structure
      const journeyMd = responseBody.documentation.journeyMarkdown;
      expect(journeyMd).toContain('# Learning Journey: arrays-and-loops');
      expect(journeyMd).toContain('**Student ID:** student-123');
      expect(journeyMd).toContain('**Total Learning Time:** 3 hours');
      expect(journeyMd).toContain('**Overall Grit Score:** 85/100');
      expect(journeyMd).toContain('**Cryptographic Hash:**');

      // Verify grit score card structure
      const gritCard = JSON.parse(responseBody.documentation.gritScoreCard);
      expect(gritCard.studentId).toBe('student-123');
      expect(gritCard.gritMetrics.overallScore).toBe(85);
      expect(gritCard.verificationData.cryptographicHash).toBeDefined();

      // Verify struggle analysis structure
      const struggleAnalysis = responseBody.documentation.struggleAnalysis;
      expect(struggleAnalysis).toContain('# Struggle Analysis Report - arrays-and-loops');
      expect(struggleAnalysis).toContain('## Error Recovery Patterns');
      expect(struggleAnalysis).toContain('## Persistence Indicators');
      expect(struggleAnalysis).toContain('## Help Seeking Behavior Analysis');
      expect(struggleAnalysis).toContain('## Focus Quality Metrics');

      // Verify cultural analogies structure
      const culturalAnalogies = responseBody.documentation.culturalAnalogies;
      expect(culturalAnalogies).toContain('# Cultural Analogies Documentation - arrays-and-loops');
      expect(culturalAnalogies).toContain('CRICKET_ANALOGY');
      expect(culturalAnalogies).toContain('MANDI_ANALOGY');
      expect(culturalAnalogies).toContain('FESTIVAL_ANALOGY');
      expect(culturalAnalogies).toContain('Bhashini Integration');
    });

    it('should include cryptographic verification in documentation', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/generate-documentation',
        body: JSON.stringify({
          studentId: 'student-123',
          sessionId: 'session-456',
          conceptContext: 'arrays-and-loops',
          codeContent: 'console.log("Hello World");',
          repositoryUrl: 'https://github.com/student/repo',
        }),
        headers: {},
        multiValueHeaders: {},
        isBase64Encoded: false,
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      // Mock minimal data for verification testing
      mockDocClient.send
        .mockResolvedValueOnce({ Item: { studentId: 'student-123', gritScore: 75 } })
        .mockResolvedValueOnce({ Item: { analyticsId: 'student-123#session-456', totalLearningTime: 7200000, scaffoldProgression: new Array(85).fill({}), breakthroughMoments: 3 } })
        .mockResolvedValueOnce({ Items: [{ studentId: 'student-123', sessionId: 'session-456', overallScore: 78 }] })
        .mockResolvedValueOnce({ Items: [] })
        .mockResolvedValueOnce({ Item: { analyticsId: 'student-123#session-456', totalLearningTime: 7200000, scaffoldProgression: new Array(85).fill({}), breakthroughMoments: 3 } })
        .mockResolvedValueOnce({ Items: [] });

      const result = await handler(event, mockContext);
      const responseBody = JSON.parse((result as any).body);

      // Verify verification proof structure
      const verificationProof = JSON.parse(responseBody.documentation.verificationProof);
      expect(verificationProof.verificationData).toBeDefined();
      expect(verificationProof.verificationData.cryptographicHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
      expect(verificationProof.verificationData.learningJourneySignature).toMatch(/^[a-f0-9]{64}$/); // HMAC-SHA256 hex
      expect(verificationProof.algorithm).toBe('HMAC-SHA256');
      expect(verificationProof.dataIntegrity).toBe('verified');
      expect(verificationProof.tamperEvidence).toBe('none_detected');

      // Verify learning journey includes verification data
      expect(responseBody.learningJourney.verificationData.cryptographicHash).toBeDefined();
      expect(responseBody.learningJourney.verificationData.timestampChain).toHaveLength(1);
      expect(responseBody.learningJourney.verificationData.bhashiniSessionIds).toContain('session-456');
    });
  });
});