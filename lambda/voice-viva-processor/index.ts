import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import axios from 'axios';
import FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid';

// Environment variables
const REGION = process.env.AWS_REGION || 'ap-south-1';
const LEARNER_SESSIONS_TABLE = process.env.LEARNER_SESSIONS_TABLE!;
const STUDENT_PROFILES_TABLE = process.env.STUDENT_PROFILES_TABLE!;
const STRUGGLE_LOGS_TABLE = process.env.STRUGGLE_LOGS_TABLE!;
const AUDIO_STORAGE_BUCKET = process.env.AUDIO_STORAGE_BUCKET!;
const SOCRATIC_ENGINE_LAMBDA_NAME = process.env.SOCRATIC_ENGINE_LAMBDA_NAME || 'SutraCode-SocraticEngine';
const BHASHINI_API_KEY = process.env.BHASHINI_API_KEY!;
const BHASHINI_BASE_URL = process.env.BHASHINI_BASE_URL || 'https://dhruva-api.bhashini.gov.in/services';

// Initialize AWS clients
const bedrockClient = new BedrockRuntimeClient({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: REGION });
const lambdaClient = new LambdaClient({ region: REGION });

// Claude 3 Haiku model ID for voice viva question generation
const CLAUDE_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0';

// Interfaces
interface VoiceVivaRequest {
  studentId: string;
  sessionId?: string;
  action: 'start' | 'process_audio' | 'get_question' | 'submit_response' | 'get_results';
  audioData?: string; // Base64 encoded audio
  audioFormat?: 'wav' | 'mp3' | 'webm';
  language?: string;
  concept?: string;
  scaffoldCompletion?: number;
  previousAttempts?: VoiceVivaAttempt[];
}

interface VoiceVivaResponse {
  sessionId: string;
  vivaId: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  currentQuestion?: VoiceVivaQuestion;
  questionNumber?: number;
  totalQuestions?: number;
  audioUrl?: string; // Pre-signed URL for TTS audio
  transcription?: string;
  score?: number;
  feedback?: string;
  nextAction?: string;
  timeRemaining?: number;
  canProceed?: boolean;
  error?: string;
}

interface VoiceVivaQuestion {
  questionId: string;
  questionText: string;
  questionType: 'conceptual' | 'analogy_clarification' | 'error_handling' | 'optimization' | 'implementation';
  expectedKeywords: string[];
  timeLimit: number; // seconds
  culturalContext?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  maxScore: number;
}

interface VoiceVivaSession {
  vivaId: string;
  studentId: string;
  sessionId: string;
  concept: string;
  language: string;
  status: 'active' | 'completed' | 'expired';
  questions: VoiceVivaQuestion[];
  responses: VoiceVivaResponse[];
  currentQuestionIndex: number;
  startTime: number;
  endTime?: number;
  totalScore: number;
  maxScore: number;
  passingThreshold: number;
  scaffoldCompletion: number;
  culturalAnalogies: string[];
  bhashiniSessionId?: string;
}

interface VoiceVivaAttempt {
  attemptId: string;
  questionId: string;
  audioS3Key: string;
  transcription: string;
  bhashiniConfidence: number;
  responseTime: number;
  score: number;
  feedback: string;
  timestamp: number;
}

interface StudentProfile {
  studentId: string;
  preferredLanguage: string;
  skillLevel: number;
  culturalPreferences: string[];
  strugglingConcepts: string[];
  masteredConcepts: string[];
  gritScore: number;
  voiceVivaHistory: VoiceVivaAttempt[];
}

interface BhashiniSTTRequest {
  config: {
    language: {
      sourceLanguage: string;
    };
    serviceId: string;
    audioFormat: string;
    samplingRate: number;
  };
  audio: {
    audioContent: string; // Base64 encoded
  };
}

interface BhashiniTTSRequest {
  config: {
    language: {
      sourceLanguage: string;
    };
    serviceId: string;
    gender: 'male' | 'female';
    audioFormat: string;
  };
  input: {
    source: string;
  };
}

// Supported languages mapping for Bhashini API
const BHASHINI_LANGUAGE_CODES = {
  'hindi': 'hi',
  'tamil': 'ta',
  'telugu': 'te',
  'bengali': 'bn',
  'marathi': 'mr',
  'gujarati': 'gu',
  'kannada': 'kn',
  'malayalam': 'ml',
  'odia': 'or',
  'punjabi': 'pa',
  'assamese': 'as',
  'urdu': 'ur',
  'english': 'en',
};

// Voice Viva question templates based on concept and difficulty
const VIVA_QUESTION_TEMPLATES = {
  conceptual: {
    beginner: [
      "Can you explain what {concept} means in simple terms?",
      "How would you describe {concept} to a friend who has never programmed?",
      "What is the main purpose of using {concept} in programming?",
    ],
    intermediate: [
      "What are the key advantages and disadvantages of {concept}?",
      "How does {concept} compare to other similar approaches?",
      "In what situations would you choose {concept} over alternatives?",
    ],
    advanced: [
      "What are the time and space complexity considerations for {concept}?",
      "How would you optimize {concept} for large-scale applications?",
      "What are some common pitfalls when implementing {concept}?",
    ],
  },
  analogy_clarification: {
    beginner: [
      "How does the {cultural_analogy} relate to {concept}?",
      "Can you explain the connection between {cultural_analogy} and {concept}?",
      "What similarities do you see between {cultural_analogy} and {concept}?",
    ],
    intermediate: [
      "Where does the {cultural_analogy} analogy break down for {concept}?",
      "How would you extend the {cultural_analogy} analogy to explain advanced {concept} features?",
      "What other cultural examples could illustrate {concept}?",
    ],
    advanced: [
      "How would you use the {cultural_analogy} analogy to explain {concept} optimization?",
      "What aspects of {concept} are not captured by the {cultural_analogy} analogy?",
      "How would you adapt the {cultural_analogy} analogy for different regional contexts?",
    ],
  },
  error_handling: [
    "What would happen if the input to your {concept} implementation was invalid?",
    "How would you handle edge cases in your {concept} solution?",
    "What error checking would you add to make your {concept} implementation robust?",
  ],
  optimization: [
    "How could you make your {concept} implementation more efficient?",
    "What would you do if your {concept} solution was too slow for large inputs?",
    "How would you reduce memory usage in your {concept} implementation?",
  ],
  implementation: [
    "Walk me through your thought process for implementing {concept}.",
    "What was the most challenging part of implementing {concept}?",
    "How did you decide on your approach for {concept}?",
  ],
};

/**
 * Main Lambda handler for Voice Viva Processor
 * Implements multilingual voice examination with Bhashini integration
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Voice Viva Processor - Processing request:', {
    path: event.path,
    method: event.httpMethod,
    body: event.body ? JSON.parse(event.body) : null,
  });

  try {
    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'POST':
        return await handleVoiceVivaAction(event);
      case 'GET':
        return await handleGetVivaStatus(event);
      case 'PUT':
        return await handleUpdateVivaSession(event);
      default:
        return createErrorResponse(405, 'Method not allowed');
    }
  } catch (error) {
    console.error('Voice Viva Processor error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
};

/**
 * Handle POST requests for Voice Viva actions
 */
async function handleVoiceVivaAction(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return createErrorResponse(400, 'Request body is required');
  }

  const request: VoiceVivaRequest = JSON.parse(event.body);

  // Validate required fields
  if (!request.studentId || !request.action) {
    return createErrorResponse(400, 'studentId and action are required');
  }

  try {
    let response: VoiceVivaResponse;

    switch (request.action) {
      case 'start':
        response = await startVoiceViva(request);
        break;
      case 'process_audio':
        response = await processAudioResponse(request);
        break;
      case 'get_question':
        response = await getCurrentQuestion(request);
        break;
      case 'submit_response':
        response = await submitTextResponse(request);
        break;
      case 'get_results':
        response = await getVivaResults(request);
        break;
      default:
        return createErrorResponse(400, `Invalid action: ${request.action}`);
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
    console.error(`Error handling action ${request.action}:`, error);
    return createErrorResponse(500, `Failed to process ${request.action}`);
  }
}

/**
 * Start a new Voice Viva session
 * Requirements: 4.1, 4.4
 */
async function startVoiceViva(request: VoiceVivaRequest): Promise<VoiceVivaResponse> {
  try {
    // Get student profile for personalization
    const studentProfile = await getStudentProfile(request.studentId);
    if (!studentProfile) {
      throw new Error('Student profile not found');
    }

    // Validate prerequisites (scaffold completion ≥ 80%)
    if (request.scaffoldCompletion !== undefined && request.scaffoldCompletion < 80) {
      return {
        sessionId: request.sessionId || '',
        vivaId: '',
        status: 'failed',
        error: 'Voice Viva requires at least 80% scaffold completion',
        canProceed: false,
      };
    }

    // Generate Voice Viva session
    const vivaId = uuidv4();
    const sessionId = request.sessionId || uuidv4();
    const concept = request.concept || 'general';
    const language = request.language || studentProfile.preferredLanguage || 'english';

    // Generate questions for the viva
    const questions = await generateVivaQuestions(concept, studentProfile, language);

    // Create viva session
    const vivaSession: VoiceVivaSession = {
      vivaId,
      studentId: request.studentId,
      sessionId,
      concept,
      language,
      status: 'active',
      questions,
      responses: [],
      currentQuestionIndex: 0,
      startTime: Date.now(),
      totalScore: 0,
      maxScore: questions.reduce((sum, q) => sum + q.maxScore, 0),
      passingThreshold: 70, // 70% required to pass
      scaffoldCompletion: request.scaffoldCompletion || 0,
      culturalAnalogies: [],
    };

    // Save viva session to DynamoDB
    await saveVivaSession(vivaSession);

    // Log viva start event
    await logStruggleEvent(request.studentId, sessionId, 'voice_viva_started', {
      vivaId,
      concept,
      language,
      scaffoldCompletion: request.scaffoldCompletion,
    });

    // Generate TTS audio for first question
    const firstQuestion = questions[0];
    const audioUrl = await generateQuestionAudio(firstQuestion, language, vivaId);

    return {
      sessionId,
      vivaId,
      status: 'started',
      currentQuestion: firstQuestion,
      questionNumber: 1,
      totalQuestions: questions.length,
      audioUrl,
      timeRemaining: firstQuestion.timeLimit,
      canProceed: true,
      nextAction: 'Record your response to the question',
    };

  } catch (error) {
    console.error('Error starting Voice Viva:', error);
    throw error;
  }
}

/**
 * Process audio response from student
 * Requirements: 4.2, 4.3
 */
async function processAudioResponse(request: VoiceVivaRequest): Promise<VoiceVivaResponse> {
  try {
    if (!request.audioData || !request.sessionId) {
      throw new Error('audioData and sessionId are required for audio processing');
    }

    // Get viva session
    const vivaSession = await getVivaSession(request.sessionId);
    if (!vivaSession || vivaSession.status !== 'active') {
      throw new Error('Invalid or inactive viva session');
    }

    const currentQuestion = vivaSession.questions[vivaSession.currentQuestionIndex];
    if (!currentQuestion) {
      throw new Error('No current question found');
    }

    // Store audio in S3
    const audioS3Key = await storeAudioInS3(
      request.audioData,
      request.audioFormat || 'wav',
      vivaSession.vivaId,
      currentQuestion.questionId
    );

    // Transcribe audio using Bhashini STT
    const transcription = await transcribeAudio(
      request.audioData,
      vivaSession.language,
      request.audioFormat || 'wav'
    );

    // Evaluate response using Bedrock
    const evaluation = await evaluateVoiceResponse(
      transcription.text,
      currentQuestion,
      vivaSession.concept,
      transcription.confidence
    );

    // Create attempt record
    const attempt: VoiceVivaAttempt = {
      attemptId: uuidv4(),
      questionId: currentQuestion.questionId,
      audioS3Key,
      transcription: transcription.text,
      bhashiniConfidence: transcription.confidence,
      responseTime: Date.now() - vivaSession.startTime,
      score: evaluation.score,
      feedback: evaluation.feedback,
      timestamp: Date.now(),
    };

    // Update viva session
    vivaSession.responses.push(attempt);
    vivaSession.totalScore += evaluation.score;
    vivaSession.currentQuestionIndex++;

    // Check if viva is complete
    if (vivaSession.currentQuestionIndex >= vivaSession.questions.length) {
      vivaSession.status = 'completed';
      vivaSession.endTime = Date.now();

      // Calculate final score percentage
      const finalScorePercentage = (vivaSession.totalScore / vivaSession.maxScore) * 100;
      const passed = finalScorePercentage >= vivaSession.passingThreshold;

      // Log completion event
      await logStruggleEvent(request.studentId, request.sessionId, 'voice_viva_completed', {
        vivaId: vivaSession.vivaId,
        finalScore: finalScorePercentage,
        passed,
        totalQuestions: vivaSession.questions.length,
        duration: vivaSession.endTime - vivaSession.startTime,
      });

      // Update viva session
      await saveVivaSession(vivaSession);

      return {
        sessionId: request.sessionId,
        vivaId: vivaSession.vivaId,
        status: 'completed',
        score: finalScorePercentage,
        feedback: `Voice Viva completed. Score: ${finalScorePercentage.toFixed(1)}%. ${passed ? 'Passed!' : 'Did not meet 70% threshold.'}`,
        canProceed: passed,
        nextAction: passed ? 'You can now proceed to code submission' : 'Please retry after 24 hours',
      };
    }

    // Move to next question
    const nextQuestion = vivaSession.questions[vivaSession.currentQuestionIndex];
    const audioUrl = await generateQuestionAudio(nextQuestion, vivaSession.language, vivaSession.vivaId);

    // Update viva session
    await saveVivaSession(vivaSession);

    return {
      sessionId: request.sessionId,
      vivaId: vivaSession.vivaId,
      status: 'in_progress',
      currentQuestion: nextQuestion,
      questionNumber: vivaSession.currentQuestionIndex + 1,
      totalQuestions: vivaSession.questions.length,
      audioUrl,
      transcription: transcription.text,
      score: evaluation.score,
      feedback: evaluation.feedback,
      timeRemaining: nextQuestion.timeLimit,
      canProceed: true,
      nextAction: 'Record your response to the next question',
    };

  } catch (error) {
    console.error('Error processing audio response:', error);
    throw error;
  }
}

/**
 * Get current question for the viva session
 */
async function getCurrentQuestion(request: VoiceVivaRequest): Promise<VoiceVivaResponse> {
  try {
    if (!request.sessionId) {
      throw new Error('sessionId is required');
    }

    const vivaSession = await getVivaSession(request.sessionId);
    if (!vivaSession) {
      throw new Error('Viva session not found');
    }

    if (vivaSession.status === 'completed') {
      const finalScorePercentage = (vivaSession.totalScore / vivaSession.maxScore) * 100;
      return {
        sessionId: request.sessionId,
        vivaId: vivaSession.vivaId,
        status: 'completed',
        score: finalScorePercentage,
        canProceed: finalScorePercentage >= vivaSession.passingThreshold,
      };
    }

    const currentQuestion = vivaSession.questions[vivaSession.currentQuestionIndex];
    if (!currentQuestion) {
      throw new Error('No current question found');
    }

    // Generate TTS audio for current question
    const audioUrl = await generateQuestionAudio(currentQuestion, vivaSession.language, vivaSession.vivaId);

    return {
      sessionId: request.sessionId,
      vivaId: vivaSession.vivaId,
      status: vivaSession.status,
      currentQuestion,
      questionNumber: vivaSession.currentQuestionIndex + 1,
      totalQuestions: vivaSession.questions.length,
      audioUrl,
      timeRemaining: currentQuestion.timeLimit,
      canProceed: true,
    };

  } catch (error) {
    console.error('Error getting current question:', error);
    throw error;
  }
}

/**
 * Submit text response (fallback when audio fails)
 */
async function submitTextResponse(request: VoiceVivaRequest): Promise<VoiceVivaResponse> {
  // Implementation similar to processAudioResponse but for text input
  // This is a fallback mechanism when audio processing fails
  throw new Error('Text response submission not yet implemented');
}

/**
 * Get final viva results
 */
async function getVivaResults(request: VoiceVivaRequest): Promise<VoiceVivaResponse> {
  try {
    if (!request.sessionId) {
      throw new Error('sessionId is required');
    }

    const vivaSession = await getVivaSession(request.sessionId);
    if (!vivaSession) {
      throw new Error('Viva session not found');
    }

    const finalScorePercentage = (vivaSession.totalScore / vivaSession.maxScore) * 100;
    const passed = finalScorePercentage >= vivaSession.passingThreshold;

    return {
      sessionId: request.sessionId,
      vivaId: vivaSession.vivaId,
      status: vivaSession.status,
      score: finalScorePercentage,
      feedback: `Final Score: ${finalScorePercentage.toFixed(1)}%. ${passed ? 'Congratulations! You passed the Voice Viva.' : 'You did not meet the 70% threshold. Please retry after 24 hours.'}`,
      canProceed: passed,
      nextAction: passed ? 'Proceed to code submission' : 'Study more and retry tomorrow',
    };

  } catch (error) {
    console.error('Error getting viva results:', error);
    throw error;
  }
}

/**
 * Generate Voice Viva questions based on concept and student profile
 */
async function generateVivaQuestions(
  concept: string,
  studentProfile: StudentProfile,
  language: string
): Promise<VoiceVivaQuestion[]> {
  try {
    // Determine difficulty based on student skill level
    let difficulty: 'beginner' | 'intermediate' | 'advanced';
    if (studentProfile.skillLevel <= 3) {
      difficulty = 'beginner';
    } else if (studentProfile.skillLevel <= 7) {
      difficulty = 'intermediate';
    } else {
      difficulty = 'advanced';
    }

    // Get cultural analogies for the concept
    const culturalAnalogies = await getCulturalAnalogiesForConcept(concept, studentProfile);

    const questions: VoiceVivaQuestion[] = [];

    // Question 1: Conceptual Understanding (2 questions)
    const conceptualTemplates = VIVA_QUESTION_TEMPLATES.conceptual[difficulty];
    for (let i = 0; i < 2; i++) {
      const template = conceptualTemplates[i % conceptualTemplates.length];
      questions.push({
        questionId: uuidv4(),
        questionText: template.replace('{concept}', concept),
        questionType: 'conceptual',
        expectedKeywords: getExpectedKeywords(concept, 'conceptual'),
        timeLimit: 30,
        difficulty,
        maxScore: 20,
      });
    }

    // Question 2: Cultural Analogy Clarification (1 question)
    if (culturalAnalogies.length > 0) {
      const analogyTemplate = VIVA_QUESTION_TEMPLATES.analogy_clarification[difficulty][0];
      questions.push({
        questionId: uuidv4(),
        questionText: analogyTemplate
          .replace('{cultural_analogy}', culturalAnalogies[0])
          .replace('{concept}', concept),
        questionType: 'analogy_clarification',
        expectedKeywords: getExpectedKeywords(concept, 'analogy'),
        timeLimit: 30,
        culturalContext: culturalAnalogies[0],
        difficulty,
        maxScore: 20,
      });
    }

    // Question 3: Error Handling (1 question)
    const errorTemplate = VIVA_QUESTION_TEMPLATES.error_handling[0];
    questions.push({
      questionId: uuidv4(),
      questionText: errorTemplate.replace('{concept}', concept),
      questionType: 'error_handling',
      expectedKeywords: getExpectedKeywords(concept, 'error_handling'),
      timeLimit: 30,
      difficulty,
      maxScore: 20,
    });

    // Question 4: Optimization (1 question)
    const optimizationTemplate = VIVA_QUESTION_TEMPLATES.optimization[0];
    questions.push({
      questionId: uuidv4(),
      questionText: optimizationTemplate.replace('{concept}', concept),
      questionType: 'optimization',
      expectedKeywords: getExpectedKeywords(concept, 'optimization'),
      timeLimit: 30,
      difficulty,
      maxScore: 20,
    });

    return questions;

  } catch (error) {
    console.error('Error generating viva questions:', error);
    throw error;
  }
}

/**
 * Get expected keywords for evaluation
 */
function getExpectedKeywords(concept: string, questionType: string): string[] {
  const keywordMap: Record<string, Record<string, string[]>> = {
    sorting: {
      conceptual: ['arrange', 'order', 'compare', 'swap', 'algorithm'],
      analogy: ['cricket', 'batting', 'order', 'strategy', 'position'],
      error_handling: ['empty', 'null', 'invalid', 'check', 'validate'],
      optimization: ['time', 'space', 'complexity', 'efficient', 'performance'],
    },
    searching: {
      conceptual: ['find', 'locate', 'search', 'match', 'compare'],
      analogy: ['mandi', 'vendor', 'price', 'systematic', 'strategy'],
      error_handling: ['not found', 'empty', 'bounds', 'check'],
      optimization: ['binary', 'linear', 'time', 'complexity', 'efficient'],
    },
    // Add more concepts as needed
  };

  return keywordMap[concept]?.[questionType] || ['algorithm', 'programming', 'logic'];
}

/**
 * Get cultural analogies for a concept from the Cultural Analogy Generator
 */
async function getCulturalAnalogiesForConcept(
  concept: string,
  studentProfile: StudentProfile
): Promise<string[]> {
  try {
    // Call Cultural Analogy Generator Lambda
    const payload = {
      concept,
      difficulty: studentProfile.skillLevel <= 3 ? 'beginner' : 
                 studentProfile.skillLevel <= 7 ? 'intermediate' : 'advanced',
      studentProfile,
      language: studentProfile.preferredLanguage,
    };

    const command = new InvokeCommand({
      FunctionName: 'SutraCode-CulturalAnalogyGenerator',
      Payload: JSON.stringify({
        httpMethod: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    });

    const response = await lambdaClient.send(command);
    
    if (!response.Payload) {
      return [];
    }

    const responsePayload = JSON.parse(new TextDecoder().decode(response.Payload));
    
    if (responsePayload.statusCode !== 200) {
      return [];
    }

    const analogyResponse = JSON.parse(responsePayload.body);
    return [analogyResponse.analogy];

  } catch (error) {
    console.error('Error getting cultural analogies:', error);
    return [];
  }
}

/**
 * Store audio data in S3 with encryption
 */
async function storeAudioInS3(
  audioData: string,
  format: string,
  vivaId: string,
  questionId: string
): Promise<string> {
  try {
    const audioBuffer = Buffer.from(audioData, 'base64');
    const s3Key = `voice-viva/${vivaId}/${questionId}.${format}`;

    const command = new PutObjectCommand({
      Bucket: AUDIO_STORAGE_BUCKET,
      Key: s3Key,
      Body: audioBuffer,
      ContentType: `audio/${format}`,
      ServerSideEncryption: 'AES256',
      Metadata: {
        vivaId,
        questionId,
        uploadTime: Date.now().toString(),
      },
    });

    await s3Client.send(command);
    return s3Key;

  } catch (error) {
    console.error('Error storing audio in S3:', error);
    throw error;
  }
}

/**
 * Transcribe audio using Bhashini STT API with graceful degradation
 * Requirements: 4.2
 */
async function transcribeAudio(
  audioData: string,
  language: string,
  format: string
): Promise<{ text: string; confidence: number }> {
  // Try Bhashini first, with fallback to local processing
  try {
    return await transcribeWithBhashini(audioData, language, format);
  } catch (bhashiniError) {
    console.warn('Bhashini STT unavailable, using fallback:', bhashiniError);
    
    // Send alert about Bhashini failure
    await sendServiceAlert('Bhashini STT API Failure', bhashiniError, 'MEDIUM');
    
    // Use fallback transcription method
    return await transcribeWithFallback(audioData, language, format);
  }
}

/**
 * Primary transcription method using Bhashini API
 */
async function transcribeWithBhashini(
  audioData: string,
  language: string,
  format: string
): Promise<{ text: string; confidence: number }> {
  const bhashiniLangCode = BHASHINI_LANGUAGE_CODES[language.toLowerCase()] || 'en';
  
  const sttRequest: BhashiniSTTRequest = {
    config: {
      language: {
        sourceLanguage: bhashiniLangCode,
      },
      serviceId: 'ai4bharat/conformer-hi-gpu--t4',
      audioFormat: format,
      samplingRate: 16000,
    },
    audio: {
      audioContent: audioData,
    },
  };

  // Add retry logic with exponential backoff
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await Promise.race([
        axios.post(
          `${BHASHINI_BASE_URL}/inference/pipeline`,
          sttRequest,
          {
            headers: {
              'Authorization': `Bearer ${BHASHINI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000 + (attempt * 2000), // Increasing timeout with retries
          }
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Bhashini STT timeout')), 15000)
        )
      ]) as any;

      if (response.data && response.data.pipelineResponse) {
        const transcription = response.data.pipelineResponse[0];
        return {
          text: transcription.output[0].source || '',
          confidence: transcription.config?.confidence || 0.8,
        };
      }

      throw new Error('Invalid response from Bhashini STT API');

    } catch (error) {
      lastError = error;
      console.warn(`Bhashini STT attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        // Exponential backoff: wait 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
      }
    }
  }
  
  throw lastError;
}

/**
 * Fallback transcription method when Bhashini is unavailable
 */
async function transcribeWithFallback(
  audioData: string,
  language: string,
  format: string
): Promise<{ text: string; confidence: number }> {
  // For now, return a placeholder that indicates manual transcription is needed
  // In a production system, this could integrate with AWS Transcribe or other services
  
  console.log('Using fallback transcription method');
  
  // Simulate basic audio processing
  const audioBuffer = Buffer.from(audioData, 'base64');
  const audioSizeKB = audioBuffer.length / 1024;
  
  // Estimate confidence based on audio quality indicators
  let estimatedConfidence = 0.6; // Base confidence for fallback
  
  if (audioSizeKB > 50) { // Larger audio files might have better quality
    estimatedConfidence += 0.1;
  }
  
  if (format === 'wav') { // WAV format typically has better quality
    estimatedConfidence += 0.1;
  }
  
  // Return a message indicating manual review is needed
  return {
    text: `[AUDIO_RECEIVED_${Date.now()}] Please review audio manually - Bhashini STT unavailable`,
    confidence: Math.min(0.8, estimatedConfidence),
  };
}

/**
 * Generate TTS audio for question using Bhashini API with graceful degradation
 * Requirements: 4.3
 */
async function generateQuestionAudio(
  question: VoiceVivaQuestion,
  language: string,
  vivaId: string
): Promise<string> {
  // Try Bhashini first, with fallback to text-only mode
  try {
    return await generateTTSWithBhashini(question, language, vivaId);
  } catch (bhashiniError) {
    console.warn('Bhashini TTS unavailable, using fallback:', bhashiniError);
    
    // Send alert about Bhashini failure
    await sendServiceAlert('Bhashini TTS API Failure', bhashiniError, 'LOW');
    
    // Return empty string - client will display text instead of audio
    return '';
  }
}

/**
 * Primary TTS method using Bhashini API
 */
async function generateTTSWithBhashini(
  question: VoiceVivaQuestion,
  language: string,
  vivaId: string
): Promise<string> {
  const bhashiniLangCode = BHASHINI_LANGUAGE_CODES[language.toLowerCase()] || 'en';
  
  const ttsRequest: BhashiniTTSRequest = {
    config: {
      language: {
        sourceLanguage: bhashiniLangCode,
      },
      serviceId: 'ai4bharat/indictts-v2-gpu--t4',
      gender: 'female',
      audioFormat: 'wav',
    },
    input: {
      source: question.questionText,
    },
  };

  // Add retry logic for TTS as well
  const maxRetries = 2; // Fewer retries for TTS since it's less critical
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await Promise.race([
        axios.post(
          `${BHASHINI_BASE_URL}/inference/pipeline`,
          ttsRequest,
          {
            headers: {
              'Authorization': `Bearer ${BHASHINI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 15000 + (attempt * 3000), // Increasing timeout
          }
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Bhashini TTS timeout')), 20000)
        )
      ]) as any;

      if (response.data && response.data.pipelineResponse) {
        const audioContent = response.data.pipelineResponse[0].audio[0].audioContent;
        
        // Store TTS audio in S3
        const audioBuffer = Buffer.from(audioContent, 'base64');
        const s3Key = `voice-viva-tts/${vivaId}/${question.questionId}.wav`;

        const putCommand = new PutObjectCommand({
          Bucket: AUDIO_STORAGE_BUCKET,
          Key: s3Key,
          Body: audioBuffer,
          ContentType: 'audio/wav',
          ServerSideEncryption: 'AES256',
        });

        await s3Client.send(putCommand);

        // Generate pre-signed URL for client access
        const getCommand = new GetObjectCommand({
          Bucket: AUDIO_STORAGE_BUCKET,
          Key: s3Key,
        });

        const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 }); // 1 hour
        return signedUrl;
      }

      throw new Error('Invalid response from Bhashini TTS API');

    } catch (error) {
      lastError = error;
      console.warn(`Bhashini TTS attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }
  }
  
  throw lastError;
}

/**
 * Send service alert for monitoring
 */
async function sendServiceAlert(subject: string, error: any, severity: string): Promise<void> {
  try {
    console.warn(`SERVICE ALERT [${severity}]: ${subject}`, {
      error: error instanceof Error ? error.message : error,
      timestamp: new Date().toISOString(),
      service: 'Voice Viva Processor'
    });
    
    // In a real implementation, this would send to SNS or CloudWatch
    // For now, we'll just log it for the service integration verifier to pick up
  } catch (alertError) {
    console.error('Failed to send service alert:', alertError);
  }
}

/**
 * Evaluate voice response using Claude 3 Haiku
 */
async function evaluateVoiceResponse(
  transcription: string,
  question: VoiceVivaQuestion,
  concept: string,
  confidence: number
): Promise<{ score: number; feedback: string }> {
  try {
    if (!transcription || transcription.trim().length === 0) {
      return {
        score: 0,
        feedback: 'No response detected. Please try speaking more clearly.',
      };
    }

    // Adjust score based on transcription confidence
    const confidenceMultiplier = Math.max(0.5, confidence);

    const evaluationPrompt = `
You are evaluating a student's voice response in a programming viva examination.

QUESTION: ${question.questionText}
QUESTION TYPE: ${question.questionType}
CONCEPT: ${concept}
EXPECTED KEYWORDS: ${question.expectedKeywords.join(', ')}
STUDENT RESPONSE: "${transcription}"
TRANSCRIPTION CONFIDENCE: ${confidence}

Evaluate the response on a scale of 0-${question.maxScore} based on:
1. Conceptual accuracy (40%)
2. Use of expected keywords (30%)
3. Clarity of explanation (20%)
4. Depth of understanding (10%)

Consider that this is a voice response, so minor grammatical errors due to speech-to-text should be overlooked.
Focus on the conceptual understanding demonstrated.

Provide:
1. A numerical score (0-${question.maxScore})
2. Brief constructive feedback (2-3 sentences)

Response format:
{
  "score": <number>,
  "feedback": "<feedback text>"
}
`;

    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: evaluationPrompt,
        },
      ],
      temperature: 0.3, // Lower temperature for consistent evaluation
      top_p: 0.9,
    };

    const command = new InvokeModelCommand({
      modelId: CLAUDE_MODEL_ID,
      body: JSON.stringify(payload),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    const content = responseBody.content[0].text;
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid evaluation response format');
    }

    const evaluation = JSON.parse(jsonMatch[0]);
    
    // Apply confidence multiplier to score
    const adjustedScore = Math.round(evaluation.score * confidenceMultiplier);
    
    return {
      score: Math.max(0, Math.min(adjustedScore, question.maxScore)),
      feedback: evaluation.feedback,
    };

  } catch (error) {
    console.error('Error evaluating voice response:', error);
    
    // Fallback evaluation based on keyword matching
    const keywordMatches = question.expectedKeywords.filter(keyword =>
      transcription.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    const keywordScore = (keywordMatches / question.expectedKeywords.length) * question.maxScore;
    const confidenceAdjustedScore = Math.round(keywordScore * Math.max(0.5, confidence));
    
    return {
      score: Math.max(0, Math.min(confidenceAdjustedScore, question.maxScore)),
      feedback: 'Response evaluated based on keyword matching. Consider providing more detailed explanations.',
    };
  }
}

/**
 * Get student profile from DynamoDB
 */
async function getStudentProfile(studentId: string): Promise<StudentProfile | null> {
  try {
    const command = new GetCommand({
      TableName: STUDENT_PROFILES_TABLE,
      Key: { studentId },
    });

    const result = await docClient.send(command);
    return result.Item as StudentProfile || null;
  } catch (error) {
    console.error('Error getting student profile:', error);
    return null;
  }
}

/**
 * Save Voice Viva session to DynamoDB
 */
async function saveVivaSession(vivaSession: VoiceVivaSession): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: LEARNER_SESSIONS_TABLE,
      Item: {
        sessionId: vivaSession.sessionId,
        timestamp: Date.now(),
        vivaId: vivaSession.vivaId,
        studentId: vivaSession.studentId,
        sessionType: 'voice_viva',
        vivaSession,
        ttl: Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000), // 7 days TTL
      },
    });

    await docClient.send(command);
  } catch (error) {
    console.error('Error saving viva session:', error);
    throw error;
  }
}

/**
 * Get Voice Viva session from DynamoDB
 */
async function getVivaSession(sessionId: string): Promise<VoiceVivaSession | null> {
  try {
    const command = new QueryCommand({
      TableName: LEARNER_SESSIONS_TABLE,
      KeyConditionExpression: 'sessionId = :sessionId',
      FilterExpression: 'sessionType = :sessionType',
      ExpressionAttributeValues: {
        ':sessionId': sessionId,
        ':sessionType': 'voice_viva',
      },
      ScanIndexForward: false, // Get most recent first
      Limit: 1,
    });

    const result = await docClient.send(command);
    
    if (result.Items && result.Items.length > 0) {
      return result.Items[0].vivaSession as VoiceVivaSession;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting viva session:', error);
    return null;
  }
}

/**
 * Log struggle event for analytics
 */
async function logStruggleEvent(
  studentId: string,
  sessionId: string,
  eventType: string,
  eventData: any
): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: STRUGGLE_LOGS_TABLE,
      Item: {
        logId: uuidv4(),
        timestamp: Date.now(),
        studentId,
        sessionId,
        eventType,
        eventData,
        ttl: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000), // 30 days TTL
      },
    });

    await docClient.send(command);
  } catch (error) {
    console.error('Error logging struggle event:', error);
  }
}

/**
 * Handle GET requests for viva status
 */
async function handleGetVivaStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const sessionId = event.pathParameters?.sessionId;
  
  if (!sessionId) {
    return createErrorResponse(400, 'Session ID parameter is required');
  }

  try {
    const vivaSession = await getVivaSession(sessionId);
    
    if (!vivaSession) {
      return createErrorResponse(404, 'Viva session not found');
    }

    const finalScorePercentage = vivaSession.maxScore > 0 ? 
      (vivaSession.totalScore / vivaSession.maxScore) * 100 : 0;

    const response: VoiceVivaResponse = {
      sessionId,
      vivaId: vivaSession.vivaId,
      status: vivaSession.status,
      questionNumber: vivaSession.currentQuestionIndex + 1,
      totalQuestions: vivaSession.questions.length,
      score: finalScorePercentage,
      canProceed: finalScorePercentage >= vivaSession.passingThreshold,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Error getting viva status:', error);
    return createErrorResponse(500, 'Failed to get viva status');
  }
}

/**
 * Handle PUT requests for updating viva session
 */
async function handleUpdateVivaSession(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Implementation for updating viva session (e.g., extending time, pausing)
  return createErrorResponse(501, 'Update viva session not yet implemented');
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