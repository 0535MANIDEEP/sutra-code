import { DynamoDBStreamEvent, DynamoDBStreamHandler, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

// Environment variables
const REGION = process.env.AWS_REGION || 'ap-south-1';
const STRUGGLE_LOGS_TABLE = process.env.STRUGGLE_LOGS_TABLE || 'SutraCode-StruggleLogs';
const STUDENT_PROFILES_TABLE = process.env.STUDENT_PROFILES_TABLE || 'SutraCode-StudentProfiles';
const ANALYTICS_TABLE = process.env.ANALYTICS_TABLE || 'SutraCode-Analytics';

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Interfaces for Struggle Log tracking
interface StruggleEvent {
  eventId: string;
  studentId: string;
  sessionId: string;
  timestamp: number;
  eventType: 'code_deletion' | 'syntax_error' | 'logic_error' | 'correction' | 'help_request' | 'breakthrough' | 'context_switch' | 'pause' | 'typing_pattern';
  eventData: {
    // Code-related events
    codeContent?: string;
    deletedLines?: number;
    addedLines?: number;
    errorMessage?: string;
    errorType?: 'syntax' | 'runtime' | 'logic' | 'compilation';
    
    // Help-related events
    helpType?: 'socratic_question' | 'cultural_analogy' | 'hint_request' | 'external_search';
    helpContext?: string;
    helpEffectiveness?: number; // 0-1 scale
    
    // Time tracking
    timeSpentOnProblem?: number; // milliseconds
    timeToResolution?: number; // milliseconds
    
    // Behavioral patterns
    keystrokePattern?: KeystrokePattern;
    focusPattern?: FocusPattern;
    
    // Breakthrough indicators
    breakthroughType?: 'conceptual_leap' | 'analogy_connection' | 'pattern_recognition' | 'debugging_success';
    confidenceLevel?: number; // 0-1 scale
  };
  conceptContext?: string;
  culturalAnalogyUsed?: string;
  gritScoreImpact?: number; // -10 to +10
}

interface KeystrokePattern {
  typingVelocity: number[]; // WPM over time windows
  backspaceFrequency: number; // Deletions per minute
  pausePatterns: number[]; // Pause durations in milliseconds
  burstTyping: boolean; // Indicates rapid typing followed by long pauses
}

interface FocusPattern {
  sustainedAttentionPeriods: number[]; // Minutes of continuous focus
  distractionEvents: ContextSwitch[];
  deepWorkSessions: number; // Sessions > 20 minutes
  multitaskingIndicators: number; // Tab switches, window changes
}

interface ContextSwitch {
  timestamp: number;
  fromContext: string;
  toContext: string;
  duration: number; // milliseconds away
  returnedToOriginal: boolean;
}

interface GritScoreComponents {
  persistence: number; // 0-100
  resilience: number; // 0-100
  curiosity: number; // 0-100
  growth: number; // 0-100
  authenticity: number; // 0-100
  overallScore: number; // Weighted average
}

interface LearningAnalytics {
  studentId: string;
  sessionId: string;
  timestamp: number;
  
  // Time-based metrics
  totalLearningTime: number; // milliseconds
  activeCodeTime: number; // Time actually coding
  problemSolvingTime: number; // Time on specific problems
  helpSeekingTime: number; // Time spent getting help
  
  // Struggle patterns
  errorRecoverySpeed: number; // Average time to fix errors (ms)
  persistenceScore: number; // Time spent before giving up
  independentDebugging: number; // Ratio of self-solved vs helped
  
  // Learning velocity
  conceptsExplored: string[];
  breakthroughMoments: number;
  analogyEffectiveness: { [analogy: string]: number };
  
  // Behavioral insights
  focusQuality: number; // 0-1 scale
  struggleAuthenticity: number; // 0-1 scale (vs copy-paste detection)
  learningResilience: number; // Recovery from setbacks
  
  // Grit score breakdown
  gritComponents: GritScoreComponents;
}

/**
 * Main Lambda handler for DynamoDB Streams processing
 * Processes struggle events and generates real-time analytics
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export const handler = async (
  event: DynamoDBStreamEvent,
  context: Context
): Promise<void> => {
  console.log('Struggle Log Processor - Processing stream events:', {
    eventCount: event.Records.length,
    requestId: context.awsRequestId,
  });

  try {
    // Process each DynamoDB stream record
    for (const record of event.Records) {
      if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
        await processStruggleEvent(record);
      }
    }

    console.log('Successfully processed all struggle events');

  } catch (error) {
    console.error('Error processing struggle events:', error);
    throw error; // Re-throw to trigger Lambda retry
  }
};

/**
 * Process individual struggle event from DynamoDB stream
 */
async function processStruggleEvent(record: any): Promise<void> {
  try {
    // Extract struggle event data from DynamoDB record
    const eventData = record.dynamodb.NewImage;
    if (!eventData) {
      console.warn('No event data found in record');
      return;
    }

    const struggleEvent: StruggleEvent = {
      eventId: eventData.eventId?.S || uuidv4(),
      studentId: eventData.studentId?.S || '',
      sessionId: eventData.sessionId?.S || '',
      timestamp: parseInt(eventData.timestamp?.N || '0'),
      eventType: eventData.eventType?.S as any || 'typing_pattern',
      eventData: eventData.eventData ? JSON.parse(eventData.eventData.S || '{}') : {},
      conceptContext: eventData.conceptContext?.S,
      culturalAnalogyUsed: eventData.culturalAnalogyUsed?.S,
      gritScoreImpact: parseFloat(eventData.gritScoreImpact?.N || '0'),
    };

    console.log('Processing struggle event:', {
      eventId: struggleEvent.eventId,
      studentId: struggleEvent.studentId,
      eventType: struggleEvent.eventType,
    });

    // Process different types of struggle events
    switch (struggleEvent.eventType) {
      case 'code_deletion':
        await processCodeDeletionEvent(struggleEvent);
        break;
      case 'syntax_error':
      case 'logic_error':
        await processErrorEvent(struggleEvent);
        break;
      case 'correction':
        await processCorrectionEvent(struggleEvent);
        break;
      case 'help_request':
        await processHelpRequestEvent(struggleEvent);
        break;
      case 'breakthrough':
        await processBreakthroughEvent(struggleEvent);
        break;
      case 'context_switch':
        await processContextSwitchEvent(struggleEvent);
        break;
      case 'typing_pattern':
        await processTypingPatternEvent(struggleEvent);
        break;
      default:
        console.log('Unknown event type:', struggleEvent.eventType);
    }

    // Update real-time analytics
    await updateRealTimeAnalytics(struggleEvent);

    // Update grit score if there's an impact
    if (struggleEvent.gritScoreImpact && struggleEvent.gritScoreImpact !== 0) {
      await updateGritScore(struggleEvent.studentId, struggleEvent.gritScoreImpact);
    }

  } catch (error) {
    console.error('Error processing individual struggle event:', error);
    throw error;
  }
}

/**
 * Process code deletion events - indicates thinking/revision patterns
 * Requirement 5.1: Event tracking for code deletions
 */
async function processCodeDeletionEvent(event: StruggleEvent): Promise<void> {
  const deletedLines = event.eventData.deletedLines || 0;
  const timeSpent = event.eventData.timeSpentOnProblem || 0;

  // Store detailed deletion event
  await docClient.send(new PutCommand({
    TableName: STRUGGLE_LOGS_TABLE,
    Item: {
      logId: uuidv4(),
      studentId: event.studentId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      eventType: 'code_deletion_analysis',
      analysisData: {
        deletedLines,
        timeSpent,
        deletionRatio: deletedLines / Math.max(1, timeSpent / 60000), // deletions per minute
        thinkingPattern: deletedLines > 5 ? 'major_revision' : 'minor_adjustment',
        persistenceIndicator: timeSpent > 300000 ? 'high' : 'moderate', // > 5 minutes
      },
      conceptContext: event.conceptContext,
      gritImpact: Math.min(2, deletedLines * 0.1), // Small positive impact for revision
    },
  }));

  console.log('Processed code deletion event:', {
    studentId: event.studentId,
    deletedLines,
    timeSpent,
  });
}

/**
 * Process error events - tracks error types and recovery patterns
 * Requirement 5.2: Error tracking and correction patterns
 */
async function processErrorEvent(event: StruggleEvent): Promise<void> {
  const errorType = event.eventData.errorType || 'unknown';
  const errorMessage = event.eventData.errorMessage || '';

  // Classify error complexity
  const errorComplexity = classifyErrorComplexity(errorMessage, errorType);

  await docClient.send(new PutCommand({
    TableName: STRUGGLE_LOGS_TABLE,
    Item: {
      logId: uuidv4(),
      studentId: event.studentId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      eventType: 'error_analysis',
      analysisData: {
        errorType,
        errorComplexity,
        errorMessage: errorMessage.substring(0, 500), // Truncate for storage
        requiresHelp: errorComplexity === 'complex',
        learningOpportunity: true,
      },
      conceptContext: event.conceptContext,
      gritImpact: -1, // Small negative impact for errors (normal part of learning)
    },
  }));

  console.log('Processed error event:', {
    studentId: event.studentId,
    errorType,
    errorComplexity,
  });
}

/**
 * Process correction events - indicates learning and problem-solving
 * Requirement 5.2: Correction tracking
 */
async function processCorrectionEvent(event: StruggleEvent): Promise<void> {
  const timeToResolution = event.eventData.timeToResolution || 0;
  const helpUsed = event.eventData.helpType ? true : false;

  // Calculate correction quality score
  const correctionQuality = calculateCorrectionQuality(timeToResolution, helpUsed);

  await docClient.send(new PutCommand({
    TableName: STRUGGLE_LOGS_TABLE,
    Item: {
      logId: uuidv4(),
      studentId: event.studentId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      eventType: 'correction_analysis',
      analysisData: {
        timeToResolution,
        helpUsed,
        correctionQuality,
        independentSolving: !helpUsed,
        resilienceIndicator: timeToResolution > 600000 ? 'high' : 'moderate', // > 10 minutes
      },
      conceptContext: event.conceptContext,
      gritImpact: correctionQuality * 3, // Positive impact based on quality
    },
  }));

  console.log('Processed correction event:', {
    studentId: event.studentId,
    timeToResolution,
    correctionQuality,
  });
}

/**
 * Process help request events - tracks help-seeking behavior
 * Requirement 5.4: Help request logging with context
 */
async function processHelpRequestEvent(event: StruggleEvent): Promise<void> {
  const helpType = event.eventData.helpType || 'unknown';
  const helpContext = event.eventData.helpContext || '';
  const helpEffectiveness = event.eventData.helpEffectiveness || 0;

  // Classify help request quality
  const helpQuality = classifyHelpRequestQuality(helpContext, helpType);

  await docClient.send(new PutCommand({
    TableName: STRUGGLE_LOGS_TABLE,
    Item: {
      logId: uuidv4(),
      studentId: event.studentId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      eventType: 'help_request_analysis',
      analysisData: {
        helpType,
        helpQuality,
        helpEffectiveness,
        contextualRelevance: helpContext.length > 10 ? 'high' : 'low',
        learningIntent: helpQuality === 'productive' ? 'genuine' : 'shortcut',
      },
      conceptContext: event.conceptContext,
      culturalAnalogyUsed: event.culturalAnalogyUsed,
      gritImpact: helpQuality === 'productive' ? 1 : -0.5,
    },
  }));

  console.log('Processed help request event:', {
    studentId: event.studentId,
    helpType,
    helpQuality,
  });
}

/**
 * Process breakthrough events - indicates learning moments
 * Requirement 5.5: Analytics generation for learning progression
 */
async function processBreakthroughEvent(event: StruggleEvent): Promise<void> {
  const breakthroughType = event.eventData.breakthroughType || 'unknown';
  const confidenceLevel = event.eventData.confidenceLevel || 0.5;

  await docClient.send(new PutCommand({
    TableName: STRUGGLE_LOGS_TABLE,
    Item: {
      logId: uuidv4(),
      studentId: event.studentId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      eventType: 'breakthrough_analysis',
      analysisData: {
        breakthroughType,
        confidenceLevel,
        learningMoment: true,
        conceptualGrowth: breakthroughType === 'conceptual_leap' ? 'high' : 'moderate',
        analogyConnection: event.culturalAnalogyUsed ? true : false,
      },
      conceptContext: event.conceptContext,
      culturalAnalogyUsed: event.culturalAnalogyUsed,
      gritImpact: 5, // Significant positive impact for breakthroughs
    },
  }));

  console.log('Processed breakthrough event:', {
    studentId: event.studentId,
    breakthroughType,
    confidenceLevel,
  });
}

/**
 * Process context switch events - tracks focus and attention patterns
 * Requirement 5.3: Time tracking for different problem-solving aspects
 */
async function processContextSwitchEvent(event: StruggleEvent): Promise<void> {
  const focusPattern = event.eventData.focusPattern;
  if (!focusPattern) return;

  const distractionLevel = calculateDistractionLevel(focusPattern);

  await docClient.send(new PutCommand({
    TableName: STRUGGLE_LOGS_TABLE,
    Item: {
      logId: uuidv4(),
      studentId: event.studentId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      eventType: 'focus_analysis',
      analysisData: {
        distractionLevel,
        sustainedFocusPeriods: focusPattern.sustainedAttentionPeriods,
        deepWorkSessions: focusPattern.deepWorkSessions,
        multitaskingScore: focusPattern.multitaskingIndicators,
        focusQuality: 1 - (distractionLevel / 10), // Inverse relationship
      },
      conceptContext: event.conceptContext,
      gritImpact: focusPattern.deepWorkSessions > 0 ? 1 : -0.5,
    },
  }));

  console.log('Processed context switch event:', {
    studentId: event.studentId,
    distractionLevel,
    deepWorkSessions: focusPattern.deepWorkSessions,
  });
}

/**
 * Process typing pattern events - analyzes coding behavior
 * Requirement 5.1: Behavioral pattern analysis
 */
async function processTypingPatternEvent(event: StruggleEvent): Promise<void> {
  const keystrokePattern = event.eventData.keystrokePattern;
  if (!keystrokePattern) return;

  const typingAnalysis = analyzeTypingPattern(keystrokePattern);

  await docClient.send(new PutCommand({
    TableName: STRUGGLE_LOGS_TABLE,
    Item: {
      logId: uuidv4(),
      studentId: event.studentId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      eventType: 'typing_analysis',
      analysisData: {
        averageTypingSpeed: typingAnalysis.averageSpeed,
        thinkingPauses: typingAnalysis.thinkingPauses,
        confidenceLevel: typingAnalysis.confidenceLevel,
        revisionFrequency: keystrokePattern.backspaceFrequency,
        codingRhythm: typingAnalysis.rhythm,
      },
      conceptContext: event.conceptContext,
      gritImpact: typingAnalysis.confidenceLevel > 0.7 ? 0.5 : 0,
    },
  }));

  console.log('Processed typing pattern event:', {
    studentId: event.studentId,
    averageSpeed: typingAnalysis.averageSpeed,
    confidenceLevel: typingAnalysis.confidenceLevel,
  });
}

/**
 * Update real-time analytics for dashboard display
 * Requirement 5.5: Real-time analytics generation
 */
async function updateRealTimeAnalytics(event: StruggleEvent): Promise<void> {
  const analyticsKey = `${event.studentId}#${event.sessionId}`;

  try {
    // Get current analytics
    const currentAnalytics = await docClient.send(new GetCommand({
      TableName: ANALYTICS_TABLE,
      Key: { analyticsId: analyticsKey },
    }));

    const analytics: LearningAnalytics = currentAnalytics.Item as LearningAnalytics || {
      studentId: event.studentId,
      sessionId: event.sessionId,
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
    };

    // Update analytics based on event type
    updateAnalyticsForEvent(analytics, event);

    // Save updated analytics
    await docClient.send(new PutCommand({
      TableName: ANALYTICS_TABLE,
      Item: {
        analyticsId: analyticsKey,
        ...analytics,
        lastUpdated: Date.now(),
      },
    }));

    console.log('Updated real-time analytics for student:', event.studentId);

  } catch (error) {
    console.error('Error updating real-time analytics:', error);
    // Don't throw - analytics update shouldn't fail the main process
  }
}

/**
 * Update grit score based on struggle events
 * Requirement 5.5: Grit score calculation and tracking
 */
async function updateGritScore(studentId: string, gritImpact: number): Promise<void> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: STUDENT_PROFILES_TABLE,
      Key: { studentId },
      UpdateExpression: 'ADD gritScore :impact SET lastGritUpdate = :timestamp',
      ExpressionAttributeValues: {
        ':impact': gritImpact,
        ':timestamp': Date.now(),
      },
    }));

    console.log('Updated grit score for student:', {
      studentId,
      gritImpact,
    });

  } catch (error) {
    console.error('Error updating grit score:', error);
    // Don't throw - grit score update shouldn't fail the main process
  }
}

// Helper functions for analysis

function classifyErrorComplexity(errorMessage: string, errorType: string): 'simple' | 'moderate' | 'complex' {
  if (errorType === 'syntax') return 'simple';
  if (errorMessage.includes('undefined') || errorMessage.includes('null')) return 'moderate';
  if (errorMessage.length > 100) return 'complex';
  return 'moderate';
}

function calculateCorrectionQuality(timeToResolution: number, helpUsed: boolean): number {
  let quality = 0.5; // Base quality
  
  // Time factor (faster is better, but not too fast)
  if (timeToResolution < 60000) quality += 0.2; // < 1 minute
  else if (timeToResolution < 300000) quality += 0.3; // < 5 minutes
  else if (timeToResolution < 900000) quality += 0.1; // < 15 minutes
  
  // Independence factor
  if (!helpUsed) quality += 0.2;
  
  return Math.min(1.0, quality);
}

function classifyHelpRequestQuality(helpContext: string, helpType: string): 'productive' | 'shortcut' {
  if (helpType === 'external_search') return 'shortcut';
  if (helpContext.length < 10) return 'shortcut';
  if (helpType === 'socratic_question' || helpType === 'cultural_analogy') return 'productive';
  return 'productive';
}

function calculateDistractionLevel(focusPattern: FocusPattern): number {
  const distractions = focusPattern.distractionEvents.length;
  const multitasking = focusPattern.multitaskingIndicators;
  return Math.min(10, distractions + multitasking);
}

function analyzeTypingPattern(keystrokePattern: KeystrokePattern): {
  averageSpeed: number;
  thinkingPauses: number;
  confidenceLevel: number;
  rhythm: 'steady' | 'burst' | 'hesitant';
} {
  const averageSpeed = keystrokePattern.typingVelocity.reduce((a, b) => a + b, 0) / keystrokePattern.typingVelocity.length;
  const thinkingPauses = keystrokePattern.pausePatterns.filter(pause => pause > 2000).length;
  const confidenceLevel = Math.max(0, 1 - (keystrokePattern.backspaceFrequency / 100));
  
  let rhythm: 'steady' | 'burst' | 'hesitant' = 'steady';
  if (keystrokePattern.burstTyping) rhythm = 'burst';
  else if (thinkingPauses > 5) rhythm = 'hesitant';
  
  return {
    averageSpeed,
    thinkingPauses,
    confidenceLevel,
    rhythm,
  };
}

function updateAnalyticsForEvent(analytics: LearningAnalytics, event: StruggleEvent): void {
  // Update based on event type
  switch (event.eventType) {
    case 'breakthrough':
      analytics.breakthroughMoments++;
      analytics.gritComponents.growth = Math.min(100, analytics.gritComponents.growth + 2);
      break;
    case 'help_request':
      analytics.helpSeekingTime += event.eventData.timeSpentOnProblem || 0;
      analytics.gritComponents.curiosity = Math.min(100, analytics.gritComponents.curiosity + 1);
      break;
    case 'correction':
      const timeToResolution = event.eventData.timeToResolution || 0;
      analytics.errorRecoverySpeed = (analytics.errorRecoverySpeed + timeToResolution) / 2;
      analytics.gritComponents.resilience = Math.min(100, analytics.gritComponents.resilience + 1);
      break;
    case 'context_switch':
      analytics.focusQuality = Math.max(0, analytics.focusQuality - 0.1);
      break;
  }

  // Update concept tracking
  if (event.conceptContext && !analytics.conceptsExplored.includes(event.conceptContext)) {
    analytics.conceptsExplored.push(event.conceptContext);
  }

  // Update cultural analogy effectiveness
  if (event.culturalAnalogyUsed) {
    const effectiveness = event.eventData.helpEffectiveness || 0.5;
    analytics.analogyEffectiveness[event.culturalAnalogyUsed] = effectiveness;
  }

  // Recalculate overall grit score
  const components = analytics.gritComponents;
  components.overallScore = Math.round(
    (components.persistence * 0.4) +
    (components.resilience * 0.25) +
    (components.curiosity * 0.2) +
    (components.growth * 0.1) +
    (components.authenticity * 0.05)
  );
}