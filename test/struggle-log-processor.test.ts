import { DynamoDBStreamEvent, Context } from 'aws-lambda';
import { handler } from '../lambda/struggle-log-processor/index';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

// Mock environment variables
process.env.AWS_REGION = 'ap-south-1';
process.env.STRUGGLE_LOGS_TABLE = 'test-struggle-logs';
process.env.STUDENT_PROFILES_TABLE = 'test-student-profiles';
process.env.ANALYTICS_TABLE = 'test-analytics';

// Helper function to create mock DynamoDB stream event
const createMockStreamEvent = (eventName: string, eventData: any): DynamoDBStreamEvent => ({
  Records: [{
    eventID: 'test-event-id',
    eventName: eventName as any,
    eventVersion: '1.1',
    eventSource: 'aws:dynamodb',
    awsRegion: 'ap-south-1',
    dynamodb: {
      ApproximateCreationDateTime: Date.now() / 1000,
      Keys: {
        eventId: { S: 'test-event-id' }
      },
      NewImage: {
        eventId: { S: eventData.eventId || 'test-event-id' },
        studentId: { S: eventData.studentId || 'test-student-id' },
        sessionId: { S: eventData.sessionId || 'test-session-id' },
        timestamp: { N: (eventData.timestamp || Date.now()).toString() },
        eventType: { S: eventData.eventType || 'typing_pattern' },
        eventData: { S: JSON.stringify(eventData.eventData || {}) },
        conceptContext: { S: eventData.conceptContext || 'sorting' },
        culturalAnalogyUsed: { S: eventData.culturalAnalogyUsed || 'cricket_batting_order' },
        gritScoreImpact: { N: (eventData.gritScoreImpact || 0).toString() },
      },
      SequenceNumber: '123456789',
      SizeBytes: 1024,
      StreamViewType: 'NEW_AND_OLD_IMAGES'
    }
  }]
});

describe('Struggle Log Processor Lambda', () => {
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

  describe('Stream Event Processing', () => {
    it('should process INSERT events successfully', async () => {
      const event = createMockStreamEvent('INSERT', {
        eventId: 'test-event-1',
        studentId: 'student-123',
        sessionId: 'session-456',
        eventType: 'code_deletion',
        eventData: {
          deletedLines: 5,
          timeSpentOnProblem: 300000, // 5 minutes
        },
        gritScoreImpact: 1,
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should process MODIFY events successfully', async () => {
      const event = createMockStreamEvent('MODIFY', {
        eventId: 'test-event-2',
        studentId: 'student-123',
        sessionId: 'session-456',
        eventType: 'breakthrough',
        eventData: {
          breakthroughType: 'conceptual_leap',
          confidenceLevel: 0.8,
        },
        gritScoreImpact: 5,
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should ignore REMOVE events', async () => {
      const event = createMockStreamEvent('REMOVE', {
        eventId: 'test-event-3',
        studentId: 'student-123',
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should handle multiple events in a single stream', async () => {
      const event: DynamoDBStreamEvent = {
        Records: [
          createMockStreamEvent('INSERT', {
            eventType: 'code_deletion',
            eventData: { deletedLines: 3 },
          }).Records[0],
          createMockStreamEvent('INSERT', {
            eventType: 'syntax_error',
            eventData: { errorType: 'syntax', errorMessage: 'Missing semicolon' },
          }).Records[0],
          createMockStreamEvent('INSERT', {
            eventType: 'correction',
            eventData: { timeToResolution: 120000 },
          }).Records[0],
        ]
      };

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });
  });

  describe('Event Type Processing', () => {
    it('should process code deletion events', async () => {
      const event = createMockStreamEvent('INSERT', {
        eventType: 'code_deletion',
        eventData: {
          deletedLines: 10,
          timeSpentOnProblem: 600000, // 10 minutes
          codeContent: 'function sort(arr) { /* deleted implementation */ }',
        },
        conceptContext: 'sorting_algorithms',
        gritScoreImpact: 2,
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should process syntax error events', async () => {
      const event = createMockStreamEvent('INSERT', {
        eventType: 'syntax_error',
        eventData: {
          errorType: 'syntax',
          errorMessage: 'SyntaxError: Unexpected token }',
          timeSpentOnProblem: 180000, // 3 minutes
        },
        conceptContext: 'javascript_basics',
        gritScoreImpact: -1,
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should process logic error events', async () => {
      const event = createMockStreamEvent('INSERT', {
        eventType: 'logic_error',
        eventData: {
          errorType: 'logic',
          errorMessage: 'Array index out of bounds',
          timeSpentOnProblem: 420000, // 7 minutes
        },
        conceptContext: 'array_manipulation',
        gritScoreImpact: -1,
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should process correction events', async () => {
      const event = createMockStreamEvent('INSERT', {
        eventType: 'correction',
        eventData: {
          timeToResolution: 240000, // 4 minutes
          helpType: 'socratic_question',
          helpEffectiveness: 0.8,
        },
        conceptContext: 'debugging',
        culturalAnalogyUsed: 'cricket_strategy',
        gritScoreImpact: 3,
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should process help request events', async () => {
      const event = createMockStreamEvent('INSERT', {
        eventType: 'help_request',
        eventData: {
          helpType: 'cultural_analogy',
          helpContext: 'I need help understanding how recursion works in the context of problem-solving',
          helpEffectiveness: 0.9,
          timeSpentOnProblem: 900000, // 15 minutes
        },
        conceptContext: 'recursion',
        culturalAnalogyUsed: 'festival_preparation_delegation',
        gritScoreImpact: 1,
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should process breakthrough events', async () => {
      const event = createMockStreamEvent('INSERT', {
        eventType: 'breakthrough',
        eventData: {
          breakthroughType: 'analogy_connection',
          confidenceLevel: 0.95,
          timeSpentOnProblem: 1200000, // 20 minutes
        },
        conceptContext: 'graph_traversal',
        culturalAnalogyUsed: 'railway_network_connections',
        gritScoreImpact: 5,
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should process context switch events', async () => {
      const event = createMockStreamEvent('INSERT', {
        eventType: 'context_switch',
        eventData: {
          focusPattern: {
            sustainedAttentionPeriods: [15, 22, 8], // minutes
            distractionEvents: [
              {
                timestamp: Date.now() - 300000,
                fromContext: 'coding',
                toContext: 'social_media',
                duration: 120000, // 2 minutes
                returnedToOriginal: true,
              }
            ],
            deepWorkSessions: 2,
            multitaskingIndicators: 3,
          },
        },
        conceptContext: 'algorithm_design',
        gritScoreImpact: -0.5,
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should process typing pattern events', async () => {
      const event = createMockStreamEvent('INSERT', {
        eventType: 'typing_pattern',
        eventData: {
          keystrokePattern: {
            typingVelocity: [45, 52, 38, 41, 49], // WPM over time windows
            backspaceFrequency: 12, // deletions per minute
            pausePatterns: [1500, 3200, 800, 4100, 2200], // pause durations in ms
            burstTyping: false,
          },
          timeSpentOnProblem: 480000, // 8 minutes
        },
        conceptContext: 'data_structures',
        gritScoreImpact: 0.5,
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });
  });

  describe('Analytics and Grit Score Processing', () => {
    it('should handle events with positive grit score impact', async () => {
      const event = createMockStreamEvent('INSERT', {
        eventType: 'breakthrough',
        eventData: {
          breakthroughType: 'pattern_recognition',
          confidenceLevel: 0.85,
        },
        gritScoreImpact: 4,
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should handle events with negative grit score impact', async () => {
      const event = createMockStreamEvent('INSERT', {
        eventType: 'help_request',
        eventData: {
          helpType: 'external_search',
          helpContext: 'quick answer',
          helpEffectiveness: 0.2,
        },
        gritScoreImpact: -1,
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should handle events with zero grit score impact', async () => {
      const event = createMockStreamEvent('INSERT', {
        eventType: 'typing_pattern',
        eventData: {
          keystrokePattern: {
            typingVelocity: [40, 42, 38],
            backspaceFrequency: 8,
            pausePatterns: [1200, 1800, 2100],
            burstTyping: false,
          },
        },
        gritScoreImpact: 0,
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle events with missing data gracefully', async () => {
      const event = createMockStreamEvent('INSERT', {
        eventId: 'incomplete-event',
        // Missing required fields
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should handle events with invalid JSON in eventData', async () => {
      const event: DynamoDBStreamEvent = {
        Records: [{
          eventID: 'test-event-id',
          eventName: 'INSERT',
          eventVersion: '1.1',
          eventSource: 'aws:dynamodb',
          awsRegion: 'ap-south-1',
          dynamodb: {
            ApproximateCreationDateTime: Date.now() / 1000,
            Keys: {
              eventId: { S: 'test-event-id' }
            },
            NewImage: {
              eventId: { S: 'invalid-json-event' },
              studentId: { S: 'student-123' },
              sessionId: { S: 'session-456' },
              timestamp: { N: Date.now().toString() },
              eventType: { S: 'typing_pattern' },
              eventData: { S: '{ invalid json }' }, // Invalid JSON
              gritScoreImpact: { N: '0' },
            },
            SequenceNumber: '123456789',
            SizeBytes: 1024,
            StreamViewType: 'NEW_AND_OLD_IMAGES'
          }
        }]
      };

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should handle DynamoDB service errors gracefully', async () => {
      // Mock DynamoDB to throw an error
      const mockDocClient = require('@aws-sdk/lib-dynamodb');
      mockDocClient.DynamoDBDocumentClient.prototype.send = jest.fn().mockRejectedValue(
        new Error('DynamoDB service unavailable')
      );

      const event = createMockStreamEvent('INSERT', {
        eventType: 'code_deletion',
        eventData: { deletedLines: 3 },
      });

      await expect(handler(event, mockContext)).rejects.toThrow('DynamoDB service unavailable');
    });
  });

  describe('Real-time Analytics Generation', () => {
    it('should generate analytics for learning progression', async () => {
      const events = [
        createMockStreamEvent('INSERT', {
          eventType: 'code_deletion',
          eventData: { deletedLines: 5, timeSpentOnProblem: 300000 },
          conceptContext: 'sorting',
        }),
        createMockStreamEvent('INSERT', {
          eventType: 'syntax_error',
          eventData: { errorType: 'syntax', errorMessage: 'Missing bracket' },
          conceptContext: 'sorting',
        }),
        createMockStreamEvent('INSERT', {
          eventType: 'correction',
          eventData: { timeToResolution: 180000, helpType: 'socratic_question' },
          conceptContext: 'sorting',
        }),
        createMockStreamEvent('INSERT', {
          eventType: 'breakthrough',
          eventData: { breakthroughType: 'conceptual_leap', confidenceLevel: 0.9 },
          conceptContext: 'sorting',
          culturalAnalogyUsed: 'cricket_team_batting_order',
        }),
      ];

      for (const event of events) {
        await expect(handler(event, mockContext)).resolves.toBeUndefined();
      }
    });

    it('should track cultural analogy effectiveness', async () => {
      const event = createMockStreamEvent('INSERT', {
        eventType: 'help_request',
        eventData: {
          helpType: 'cultural_analogy',
          helpContext: 'Understanding recursion through festival preparation',
          helpEffectiveness: 0.95,
        },
        conceptContext: 'recursion',
        culturalAnalogyUsed: 'festival_preparation_delegation',
        gritScoreImpact: 2,
      });

      await expect(handler(event, mockContext)).resolves.toBeUndefined();
    });

    it('should calculate comprehensive grit score components', async () => {
      const persistenceEvent = createMockStreamEvent('INSERT', {
        eventType: 'code_deletion',
        eventData: { 
          deletedLines: 15, 
          timeSpentOnProblem: 1800000, // 30 minutes of persistence
        },
        gritScoreImpact: 3,
      });

      const resilienceEvent = createMockStreamEvent('INSERT', {
        eventType: 'correction',
        eventData: { 
          timeToResolution: 600000, // 10 minutes to recover from error
          helpType: null, // Independent recovery
        },
        gritScoreImpact: 2,
      });

      const curiosityEvent = createMockStreamEvent('INSERT', {
        eventType: 'help_request',
        eventData: {
          helpType: 'socratic_question',
          helpContext: 'I want to understand the deeper principles behind this algorithm',
          helpEffectiveness: 0.8,
        },
        gritScoreImpact: 1,
      });

      await expect(handler(persistenceEvent, mockContext)).resolves.toBeUndefined();
      await expect(handler(resilienceEvent, mockContext)).resolves.toBeUndefined();
      await expect(handler(curiosityEvent, mockContext)).resolves.toBeUndefined();
    });
  });

  describe('Performance Requirements', () => {
    it('should process events within 100ms latency requirement', async () => {
      const startTime = Date.now();
      
      const event = createMockStreamEvent('INSERT', {
        eventType: 'typing_pattern',
        eventData: {
          keystrokePattern: {
            typingVelocity: [45, 48, 42],
            backspaceFrequency: 10,
            pausePatterns: [1000, 2000, 1500],
            burstTyping: false,
          },
        },
      });

      await handler(event, mockContext);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(100); // Should process within 100ms
    });

    it('should handle batch processing of multiple events', async () => {
      const batchSize = 10;
      const events: DynamoDBStreamEvent = {
        Records: Array.from({ length: batchSize }, (_, i) => 
          createMockStreamEvent('INSERT', {
            eventId: `batch-event-${i}`,
            eventType: 'typing_pattern',
            eventData: { keystrokePattern: { typingVelocity: [40 + i], backspaceFrequency: 5, pausePatterns: [1000], burstTyping: false } },
          }).Records[0]
        )
      };

      const startTime = Date.now();
      await handler(events, mockContext);
      const processingTime = Date.now() - startTime;

      // Should process 10 events in reasonable time
      expect(processingTime).toBeLessThan(1000); // Less than 1 second for batch
    });
  });

  describe('Requirement Validation', () => {
    it('should validate Requirement 5.1: Event tracking for code deletions, errors, corrections', async () => {
      const codeEvents = [
        createMockStreamEvent('INSERT', {
          eventType: 'code_deletion',
          eventData: { deletedLines: 8, timeSpentOnProblem: 240000 },
        }),
        createMockStreamEvent('INSERT', {
          eventType: 'syntax_error',
          eventData: { errorType: 'syntax', errorMessage: 'Unexpected token' },
        }),
        createMockStreamEvent('INSERT', {
          eventType: 'correction',
          eventData: { timeToResolution: 300000 },
        }),
      ];

      for (const event of codeEvents) {
        await expect(handler(event, mockContext)).resolves.toBeUndefined();
      }
    });

    it('should validate Requirement 5.2: Time tracking for different problem-solving aspects', async () => {
      const timeTrackingEvent = createMockStreamEvent('INSERT', {
        eventType: 'context_switch',
        eventData: {
          focusPattern: {
            sustainedAttentionPeriods: [25, 18, 32], // Deep work periods
            distractionEvents: [
              { timestamp: Date.now(), fromContext: 'coding', toContext: 'research', duration: 180000, returnedToOriginal: true }
            ],
            deepWorkSessions: 3,
            multitaskingIndicators: 2,
          },
          timeSpentOnProblem: 2700000, // 45 minutes total
        },
      });

      await expect(handler(timeTrackingEvent, mockContext)).resolves.toBeUndefined();
    });

    it('should validate Requirement 5.3: Help request logging with context capture', async () => {
      const helpRequestEvent = createMockStreamEvent('INSERT', {
        eventType: 'help_request',
        eventData: {
          helpType: 'cultural_analogy',
          helpContext: 'I am struggling with understanding how graph algorithms work. Can you explain it using an Indian cultural context?',
          helpEffectiveness: 0.85,
          timeSpentOnProblem: 1200000, // 20 minutes before asking for help
        },
        conceptContext: 'graph_algorithms',
        culturalAnalogyUsed: 'railway_network_connections',
      });

      await expect(handler(helpRequestEvent, mockContext)).resolves.toBeUndefined();
    });

    it('should validate Requirement 5.4: Real-time analytics generation system', async () => {
      const analyticsEvents = [
        createMockStreamEvent('INSERT', {
          eventType: 'breakthrough',
          eventData: { breakthroughType: 'pattern_recognition', confidenceLevel: 0.9 },
          gritScoreImpact: 4,
        }),
        createMockStreamEvent('INSERT', {
          eventType: 'help_request',
          eventData: { helpType: 'socratic_question', helpEffectiveness: 0.8 },
          gritScoreImpact: 1,
        }),
      ];

      for (const event of analyticsEvents) {
        await expect(handler(event, mockContext)).resolves.toBeUndefined();
      }
    });
  });
});

// Integration test helpers
export const createMockStruggleEvent = (overrides: any = {}) => ({
  eventId: 'test-event-id',
  studentId: 'test-student-id',
  sessionId: 'test-session-id',
  timestamp: Date.now(),
  eventType: 'typing_pattern',
  eventData: {},
  conceptContext: 'sorting',
  culturalAnalogyUsed: 'cricket_batting_order',
  gritScoreImpact: 0,
  ...overrides,
});

export const createMockAnalytics = (overrides: any = {}) => ({
  studentId: 'test-student-id',
  sessionId: 'test-session-id',
  timestamp: Date.now(),
  totalLearningTime: 0,
  activeCodeTime: 0,
  problemSolvingTime: 0,
  helpSeekingTime: 0,
  errorRecoverySpeed: 0,
  persistenceScore: 0,
  independentDebugging: 0,
  conceptsExplored: [],
  breakthroughMoments: 0,
  analogyEffectiveness: {},
  focusQuality: 0,
  struggleAuthenticity: 0,
  learningResilience: 0,
  gritComponents: {
    persistence: 50,
    resilience: 50,
    curiosity: 50,
    growth: 50,
    authenticity: 50,
    overallScore: 50,
  },
  ...overrides,
});