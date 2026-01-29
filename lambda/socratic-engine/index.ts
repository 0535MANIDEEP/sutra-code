import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { v4 as uuidv4 } from 'uuid';

// Environment variables
const REGION = process.env.AWS_REGION || 'ap-south-1';
const LEARNER_SESSIONS_TABLE = process.env.LEARNER_SESSIONS_TABLE!;
const FRICTION_EVENTS_TABLE = process.env.FRICTION_EVENTS_TABLE!;
const STUDENT_PROFILES_TABLE = process.env.STUDENT_PROFILES_TABLE!;
const CULTURAL_ANALOGY_LAMBDA_NAME = process.env.CULTURAL_ANALOGY_LAMBDA_NAME || 'SutraCode-CulturalAnalogyGenerator';

// Initialize AWS clients
const bedrockClient = new BedrockRuntimeClient({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const lambdaClient = new LambdaClient({ region: REGION });

// Claude 3 Haiku model ID
const CLAUDE_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0';

// Interfaces
interface SocraticRequest {
  studentId: string;
  sessionId?: string;
  question: string;
  context?: ConversationContext;
  language?: string;
}

interface ConversationContext {
  currentConcept?: string;
  questionHistory: Question[];
  analogyHistory: Analogy[];
  understandingLevel: number;
  nextSteps: string[];
  culturalContext: string;
  strugglingPatterns: string[];
  lastInteractionTime: number;
}

interface Question {
  id: string;
  question: string;
  timestamp: number;
  studentResponse?: string;
  responseTime?: number;
  conceptualAccuracy?: number;
}

interface Analogy {
  id: string;
  concept: string;
  culturalContext: string;
  analogy: string;
  effectiveness?: number;
  timestamp: number;
}

interface SocraticResponse {
  sessionId: string;
  culturalAnalogy: string;
  guidingQuestion: string;
  hint?: string;
  nextStepIndicator: string;
  sessionState: ConversationContext;
  frictionLevel: number;
  conceptualDepth: number;
}

interface StudentProfile {
  studentId: string;
  preferredLanguage: string;
  skillLevel: number;
  culturalPreferences: string[];
  strugglingConcepts: string[];
  masteredConcepts: string[];
  gritScore: number;
}

// Cultural context mappings from design document
const CULTURAL_CONTEXTS = {
  sorting: 'cricket_team_batting_order',
  searching: 'mandi_vendor_inventory',
  recursion: 'festival_preparation_delegation',
  graphs: 'railway_network_connections',
  queues: 'temple_darshan_lines',
  arrays: 'bollywood_movie_cast',
  loops: 'rangoli_pattern_creation',
  functions: 'family_recipe_traditions',
  classes: 'joint_family_structure',
  inheritance: 'ancestral_property_system'
};

// Core Socratic Persona Prompt System
const SOCRATIC_SYSTEM_PROMPT = `
SYSTEM: You are a Socratic AI Mentor implementing "Productive Struggle" pedagogy for Indian CS students.

CORE CONSTRAINT: You are FORBIDDEN from providing executable code in any form.

MANDATORY RESPONSE PATTERN:
1. CULTURAL ANALOGY: Start with familiar Indian context (cricket/mandi/festivals/railways)
2. PROBING QUESTION: Challenge student assumptions, never give answers
3. CONCEPTUAL GUIDANCE: Guide thinking process, not implementation
4. STRUGGLE VALIDATION: Acknowledge difficulty as part of learning

CULTURAL CONTEXT MAPPING:
- Sorting → Cricket team batting order arrangement
- Searching → Mandi vendor finding best prices
- Recursion → Festival preparation delegation (Diwali → Rangoli → Diyas)
- Graphs → Railway network connections between cities
- Queues → Temple darshan lines during festivals
- Arrays → Bollywood movie cast organization
- Loops → Rangoli pattern creation
- Functions → Family recipe traditions passed down
- Classes → Joint family structure and roles
- Inheritance → Ancestral property distribution system

DETECTION TRIGGERS: If student shows "shortcut-seeking" behavior, redirect with: "Let's step back to the fundamental concept. In [cultural context], how would you approach this thinking challenge?"

EXAMPLES:
Student: "How do I implement bubble sort?"
FORBIDDEN: "Here's the code: for i in range(len(arr))..."
REQUIRED: "Think about how spectators arrange themselves by height during a cricket match interval. If you were organizing this line, what would you do when you find two people out of order? What's the first comparison you'd make?"

Student: "I'm stuck on this algorithm"
FORBIDDEN: "Try this approach: def function()..."
REQUIRED: "In a mandi, when a vendor needs to find the best price for tomatoes, they don't check every stall randomly. What strategy would make sense? How does this relate to your current problem?"

RESPONSE FORMAT:
{
  "culturalAnalogy": "Detailed Indian cultural context explanation",
  "guidingQuestion": "Open-ended question that challenges assumptions",
  "conceptualHint": "Optional hint only if genuine struggle detected",
  "nextStepGuidance": "Direction without revealing solution",
  "frictionLevel": 1-10, // How much productive struggle to apply
  "conceptualDepth": 1-5 // Complexity level of explanation
}
`;

/**
 * Main Lambda handler for Socratic Engine
 * Implements core Socratic questioning with cultural analogies
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Socratic Engine - Processing request:', {
    path: event.path,
    method: event.httpMethod,
    body: event.body ? JSON.parse(event.body) : null,
  });

  try {
    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'Request body is required');
    }

    const request: SocraticRequest = JSON.parse(event.body);

    // Validate required fields
    if (!request.studentId || !request.question) {
      return createErrorResponse(400, 'studentId and question are required');
    }

    // Get or create session
    const sessionId = request.sessionId || uuidv4();
    
    // Get student profile for personalization
    const studentProfile = await getStudentProfile(request.studentId);
    if (!studentProfile) {
      return createErrorResponse(404, 'Student profile not found');
    }

    // Get conversation context
    const context = await getConversationContext(sessionId, request.studentId);

    // Detect solution-seeking behavior
    const isSolutionSeeking = detectSolutionSeekingBehavior(request.question);
    
    // Log friction event if solution-seeking detected
    if (isSolutionSeeking) {
      await logFrictionEvent(request.studentId, sessionId, 'solution_seeking', {
        question: request.question,
        timestamp: Date.now(),
      });
    }

    // Generate Socratic response using Bedrock
    const socraticResponse = await generateSocraticResponse(
      request.question,
      context,
      studentProfile,
      isSolutionSeeking
    );

    // Update conversation context
    const updatedContext = await updateConversationContext(
      sessionId,
      request.studentId,
      request.question,
      socraticResponse,
      context
    );

    // Prepare response
    const response: SocraticResponse = {
      sessionId,
      culturalAnalogy: socraticResponse.culturalAnalogy,
      guidingQuestion: socraticResponse.guidingQuestion,
      hint: socraticResponse.conceptualHint,
      nextStepIndicator: socraticResponse.nextStepGuidance,
      sessionState: updatedContext,
      frictionLevel: socraticResponse.frictionLevel,
      conceptualDepth: socraticResponse.conceptualDepth,
    };

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
    console.error('Socratic Engine error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
};

/**
 * Generate Socratic response using Claude 3 Haiku and Cultural Analogy Generator
 */
async function generateSocraticResponse(
  question: string,
  context: ConversationContext,
  studentProfile: StudentProfile,
  isSolutionSeeking: boolean
): Promise<any> {
  try {
    // Detect programming concept from question
    const concept = detectProgrammingConcept(question);
    
    // Get cultural analogy from the Cultural Analogy Generator
    let culturalAnalogy = '';
    try {
      const analogyResponse = await getCulturalAnalogy(concept, studentProfile);
      culturalAnalogy = analogyResponse.analogy;
    } catch (error) {
      console.warn('Failed to get cultural analogy, using fallback:', error);
      culturalAnalogy = getFallbackAnalogy(concept);
    }

    // Try Bedrock first, with fallback to local generation
    try {
      return await generateBedrockResponse(question, context, studentProfile, isSolutionSeeking, concept, culturalAnalogy);
    } catch (bedrockError) {
      console.warn('Bedrock unavailable, using local fallback generation:', bedrockError);
      
      // Send alert about Bedrock failure
      await sendServiceAlert('Bedrock API Failure', bedrockError, 'MEDIUM');
      
      // Use local fallback generation
      return generateLocalFallbackResponse(question, context, studentProfile, isSolutionSeeking, concept, culturalAnalogy);
    }

  } catch (error) {
    console.error('Error generating Socratic response:', error);
    
    // Ultimate fallback response
    return getUltimateFallbackResponse(question, context, studentProfile);
  }
}

/**
 * Generate response using Bedrock (primary method)
 */
async function generateBedrockResponse(
  question: string,
  context: ConversationContext,
  studentProfile: StudentProfile,
  isSolutionSeeking: boolean,
  concept: string,
  culturalAnalogy: string
): Promise<any> {
  // Build context-aware prompt with the cultural analogy
  const userPrompt = `
STUDENT QUESTION: "${question}"

STUDENT CONTEXT:
- Skill Level: ${studentProfile.skillLevel}/10
- Preferred Language: ${studentProfile.preferredLanguage}
- Cultural Preferences: ${studentProfile.culturalPreferences.join(', ')}
- Struggling Concepts: ${studentProfile.strugglingConcepts.join(', ')}
- Mastered Concepts: ${studentProfile.masteredConcepts.join(', ')}
- Current Grit Score: ${studentProfile.gritScore}/100

CONVERSATION HISTORY:
- Previous Questions: ${context.questionHistory.length}
- Understanding Level: ${context.understandingLevel}/10
- Current Concept: ${context.currentConcept || 'Not determined'}
- Cultural Context Used: ${context.culturalContext}

DETECTED CONCEPT: ${concept}
CULTURAL ANALOGY: ${culturalAnalogy}
SOLUTION SEEKING DETECTED: ${isSolutionSeeking}

Generate a Socratic response that:
1. Uses the provided cultural analogy: "${culturalAnalogy}"
2. Asks a probing question that challenges assumptions
3. ${isSolutionSeeking ? 'Redirects from solution-seeking to conceptual understanding' : 'Guides deeper thinking'}
4. Provides appropriate friction level (1-10) based on student's skill level
5. Never provides executable code or direct solutions

Respond in JSON format as specified in the system prompt.
`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1000,
    system: SOCRATIC_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature: 0.7,
    top_p: 0.9,
  };

  const command = new InvokeModelCommand({
    modelId: CLAUDE_MODEL_ID,
    body: JSON.stringify(payload),
    contentType: 'application/json',
    accept: 'application/json',
  });

  // Add timeout and retry logic
  const response = await Promise.race([
    bedrockClient.send(command),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Bedrock request timeout')), 15000)
    )
  ]) as any;

  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  // Parse Claude's response
  const content = responseBody.content[0].text;
  
  // Extract JSON from response (Claude sometimes wraps JSON in markdown)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid response format from Claude');
  }

  const socraticResponse = JSON.parse(jsonMatch[0]);
  
  // Validate response structure
  if (!socraticResponse.culturalAnalogy || !socraticResponse.guidingQuestion) {
    throw new Error('Incomplete Socratic response from Claude');
  }

  // Override with the generated cultural analogy if it's better
  if (culturalAnalogy && culturalAnalogy.length > socraticResponse.culturalAnalogy.length) {
    socraticResponse.culturalAnalogy = culturalAnalogy;
  }

  return socraticResponse;
}

/**
 * Generate response using local fallback logic when Bedrock is unavailable
 */
async function generateLocalFallbackResponse(
  question: string,
  context: ConversationContext,
  studentProfile: StudentProfile,
  isSolutionSeeking: boolean,
  concept: string,
  culturalAnalogy: string
): Promise<any> {
  // Use rule-based Socratic question generation
  const questionTemplates = getSocraticQuestionTemplates(concept, studentProfile.skillLevel);
  const selectedTemplate = questionTemplates[Math.floor(Math.random() * questionTemplates.length)];
  
  // Determine friction level based on student profile and context
  const frictionLevel = calculateFrictionLevel(studentProfile, context, isSolutionSeeking);
  
  // Generate conceptual depth based on skill level
  const conceptualDepth = Math.min(5, Math.max(1, Math.floor(studentProfile.skillLevel / 2) + 1));
  
  return {
    culturalAnalogy: culturalAnalogy || getFallbackAnalogy(concept),
    guidingQuestion: selectedTemplate.replace('{concept}', concept).replace('{analogy}', culturalAnalogy),
    conceptualHint: isSolutionSeeking ? 
      "Let's focus on understanding the 'why' before the 'how'." : 
      "Think about the fundamental principles at work here.",
    nextStepGuidance: getNextStepGuidance(concept, context.understandingLevel),
    frictionLevel,
    conceptualDepth,
    fallbackMode: true // Indicate this was generated locally
  };
}

/**
 * Ultimate fallback when all other methods fail
 */
function getUltimateFallbackResponse(
  question: string,
  context: ConversationContext,
  studentProfile: StudentProfile
): any {
  return {
    culturalAnalogy: "Like a wise teacher who guides students to discover answers themselves, let's explore this together step by step.",
    guidingQuestion: "What do you think is the most important aspect of this problem that we should understand first?",
    conceptualHint: "Break down the problem into smaller, manageable parts.",
    nextStepGuidance: "Start with the fundamentals and build your understanding gradually.",
    frictionLevel: 5,
    conceptualDepth: 3,
    fallbackMode: true,
    ultimateFallback: true
  };
}

/**
 * Get Socratic question templates for different concepts
 */
function getSocraticQuestionTemplates(concept: string, skillLevel: number): string[] {
  const templates = {
    sorting: [
      "If you were organizing a cricket team by batting average, what would be your first step?",
      "In a mandi, how would vendors arrange their goods for easy customer access?",
      "What makes one arrangement better than another in terms of efficiency?"
    ],
    searching: [
      "When looking for the best price in a mandi, what strategy would save you the most time?",
      "How does a librarian help you find a specific book quickly?",
      "What information would help you eliminate half the options at once?"
    ],
    recursion: [
      "How does a family recipe get passed down through generations?",
      "When organizing a festival, how do you delegate tasks that have sub-tasks?",
      "What happens when a problem contains a smaller version of itself?"
    ],
    loops: [
      "When creating a rangoli pattern, what steps do you repeat?",
      "How does a potter create multiple identical pots?",
      "What would happen if you had to stop the repetition at the right moment?"
    ],
    arrays: [
      "How does a movie director organize the cast list?",
      "In a classroom, how are students arranged for easy attendance?",
      "What advantages does having a fixed order provide?"
    ]
  };
  
  const conceptTemplates = templates[concept as keyof typeof templates] || [
    "What do you think is the core challenge in this {concept} problem?",
    "How would you explain {concept} to someone who has never heard of it?",
    "What real-world situation does this {concept} remind you of?"
  ];
  
  // Adjust complexity based on skill level
  if (skillLevel <= 3) {
    return conceptTemplates.slice(0, 1); // Simpler questions for beginners
  } else if (skillLevel <= 7) {
    return conceptTemplates.slice(0, 2); // Moderate questions
  } else {
    return conceptTemplates; // All questions for advanced students
  }
}

/**
 * Calculate appropriate friction level
 */
function calculateFrictionLevel(
  studentProfile: StudentProfile,
  context: ConversationContext,
  isSolutionSeeking: boolean
): number {
  let frictionLevel = 5; // Base level
  
  // Adjust based on skill level
  frictionLevel += Math.floor((studentProfile.skillLevel - 5) / 2);
  
  // Increase friction if solution-seeking
  if (isSolutionSeeking) {
    frictionLevel += 2;
  }
  
  // Adjust based on understanding level
  if (context.understandingLevel < 3) {
    frictionLevel -= 1; // Less friction for struggling students
  } else if (context.understandingLevel > 7) {
    frictionLevel += 1; // More friction for advanced understanding
  }
  
  // Ensure friction level is within bounds
  return Math.max(1, Math.min(10, frictionLevel));
}

/**
 * Get next step guidance based on concept and understanding level
 */
function getNextStepGuidance(concept: string, understandingLevel: number): string {
  const guidance = {
    sorting: [
      "Think about comparing two elements at a time",
      "Consider how to systematically check all pairs",
      "Explore different comparison strategies"
    ],
    searching: [
      "Start with the middle element",
      "Think about eliminating half the possibilities",
      "Consider what information each comparison gives you"
    ],
    recursion: [
      "Identify the base case first",
      "Think about how the problem gets smaller",
      "Consider what happens when you solve a simpler version"
    ]
  };
  
  const conceptGuidance = guidance[concept as keyof typeof guidance] || [
    "Break the problem into smaller parts",
    "Think about the fundamental principles",
    "Consider different approaches to the same problem"
  ];
  
  const index = Math.min(conceptGuidance.length - 1, Math.floor(understandingLevel / 3));
  return conceptGuidance[index];
}

/**
 * Send service alert for monitoring
 */
async function sendServiceAlert(subject: string, error: any, severity: string): Promise<void> {
  try {
    // This would integrate with the service integration verifier's alerting system
    console.warn(`SERVICE ALERT [${severity}]: ${subject}`, {
      error: error instanceof Error ? error.message : error,
      timestamp: new Date().toISOString(),
      service: 'Socratic Engine'
    });
    
    // In a real implementation, this would send to SNS or CloudWatch
    // For now, we'll just log it for the service integration verifier to pick up
  } catch (alertError) {
    console.error('Failed to send service alert:', alertError);
  }
}

/**
 * Get cultural analogy from the Cultural Analogy Generator Lambda
 */
async function getCulturalAnalogy(concept: string, studentProfile: StudentProfile): Promise<any> {
  try {
    // Determine difficulty level based on student skill level
    let difficulty: 'beginner' | 'intermediate' | 'advanced';
    if (studentProfile.skillLevel <= 3) {
      difficulty = 'beginner';
    } else if (studentProfile.skillLevel <= 7) {
      difficulty = 'intermediate';
    } else {
      difficulty = 'advanced';
    }

    const payload = {
      concept,
      difficulty,
      studentProfile,
      language: studentProfile.preferredLanguage,
    };

    const command = new InvokeCommand({
      FunctionName: CULTURAL_ANALOGY_LAMBDA_NAME,
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
      throw new Error('No payload received from Cultural Analogy Generator');
    }

    const responsePayload = JSON.parse(new TextDecoder().decode(response.Payload));
    
    if (responsePayload.statusCode !== 200) {
      throw new Error(`Cultural Analogy Generator returned error: ${responsePayload.statusCode}`);
    }

    return JSON.parse(responsePayload.body);

  } catch (error) {
    console.error('Error calling Cultural Analogy Generator:', error);
    throw error;
  }
}

/**
 * Get fallback analogy when Cultural Analogy Generator is unavailable
 */
function getFallbackAnalogy(concept: string): string {
  const fallbackAnalogies = {
    sorting: "Think of sorting like organizing a cricket team's batting order. Just as a captain arranges players based on their strengths, sorting algorithms arrange data elements in a specific order.",
    searching: "Searching in programming is like finding the best price for vegetables in a mandi. A smart buyer doesn't check every vendor randomly but uses a systematic approach.",
    recursion: "Recursion is like the preparation for Diwali in a joint family. The grandmother delegates tasks to her daughters, who then delegate to their daughters, until everything is complete.",
    graphs: "Graph algorithms are like planning railway routes between cities. Each station is a node, and the tracks are edges connecting different destinations.",
    queues: "Queues work like the line for darshan at a temple during festivals. First person in line gets darshan first - that's First In, First Out (FIFO).",
  };

  return fallbackAnalogies[concept as keyof typeof fallbackAnalogies] || 
         "This programming concept is like organizing a community event where each person has a specific role and responsibility.";
}

/**
 * Detect programming concept from student question
 */
function detectProgrammingConcept(question: string): string {
  const lowerQuestion = question.toLowerCase();
  
  const conceptKeywords = {
    sorting: ['sort', 'bubble', 'merge', 'quick', 'heap', 'arrange', 'order'],
    searching: ['search', 'find', 'binary', 'linear', 'lookup'],
    recursion: ['recursion', 'recursive', 'factorial', 'fibonacci', 'tree'],
    graphs: ['graph', 'node', 'edge', 'path', 'dijkstra', 'bfs', 'dfs'],
    queues: ['queue', 'enqueue', 'dequeue', 'fifo', 'priority'],
    arrays: ['array', 'list', 'index', 'element'],
    loops: ['loop', 'for', 'while', 'iterate', 'repeat'],
    functions: ['function', 'method', 'parameter', 'return'],
    classes: ['class', 'object', 'instance', 'constructor'],
    inheritance: ['inherit', 'extend', 'super', 'parent', 'child'],
  };

  for (const [concept, keywords] of Object.entries(conceptKeywords)) {
    if (keywords.some(keyword => lowerQuestion.includes(keyword))) {
      return concept;
    }
  }

  return 'general';
}

/**
 * Detect solution-seeking behavior patterns
 */
function detectSolutionSeekingBehavior(question: string): boolean {
  const solutionSeekingPatterns = [
    /how do i implement/i,
    /give me the code/i,
    /show me how to/i,
    /what's the solution/i,
    /can you write/i,
    /provide the algorithm/i,
    /step by step code/i,
    /complete implementation/i,
    /working example/i,
    /copy paste/i,
  ];

  return solutionSeekingPatterns.some(pattern => pattern.test(question));
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
 * Get conversation context from DynamoDB
 */
async function getConversationContext(sessionId: string, studentId: string): Promise<ConversationContext> {
  try {
    const command = new GetCommand({
      TableName: LEARNER_SESSIONS_TABLE,
      Key: { sessionId, timestamp: 0 }, // Use 0 as timestamp for session metadata
    });

    const result = await docClient.send(command);
    
    if (result.Item) {
      return result.Item.context as ConversationContext;
    }

    // Return default context for new sessions
    return {
      questionHistory: [],
      analogyHistory: [],
      understandingLevel: 1,
      nextSteps: [],
      culturalContext: 'general',
      strugglingPatterns: [],
      lastInteractionTime: Date.now(),
    };
  } catch (error) {
    console.error('Error getting conversation context:', error);
    return {
      questionHistory: [],
      analogyHistory: [],
      understandingLevel: 1,
      nextSteps: [],
      culturalContext: 'general',
      strugglingPatterns: [],
      lastInteractionTime: Date.now(),
    };
  }
}

/**
 * Update conversation context in DynamoDB
 */
async function updateConversationContext(
  sessionId: string,
  studentId: string,
  question: string,
  socraticResponse: any,
  previousContext: ConversationContext
): Promise<ConversationContext> {
  try {
    const currentTime = Date.now();
    
    // Create new question entry
    const newQuestion: Question = {
      id: uuidv4(),
      question,
      timestamp: currentTime,
    };

    // Create new analogy entry
    const newAnalogy: Analogy = {
      id: uuidv4(),
      concept: detectProgrammingConcept(question),
      culturalContext: socraticResponse.culturalAnalogy,
      analogy: socraticResponse.culturalAnalogy,
      timestamp: currentTime,
    };

    // Update context
    const updatedContext: ConversationContext = {
      ...previousContext,
      currentConcept: detectProgrammingConcept(question),
      questionHistory: [...previousContext.questionHistory, newQuestion].slice(-50), // Keep last 50 questions
      analogyHistory: [...previousContext.analogyHistory, newAnalogy].slice(-20), // Keep last 20 analogies
      understandingLevel: Math.min(previousContext.understandingLevel + 0.1, 10), // Gradual improvement
      nextSteps: [socraticResponse.nextStepGuidance],
      culturalContext: socraticResponse.culturalAnalogy,
      lastInteractionTime: currentTime,
    };

    // Save to DynamoDB
    const command = new PutCommand({
      TableName: LEARNER_SESSIONS_TABLE,
      Item: {
        sessionId,
        timestamp: 0, // Session metadata
        studentId,
        context: updatedContext,
        updatedAt: currentTime,
        ttl: Math.floor((currentTime + 24 * 60 * 60 * 1000) / 1000), // 24 hours TTL
      },
    });

    await docClient.send(command);

    // Also save individual interaction
    const interactionCommand = new PutCommand({
      TableName: LEARNER_SESSIONS_TABLE,
      Item: {
        sessionId,
        timestamp: currentTime,
        studentId,
        question,
        socraticResponse,
        frictionLevel: socraticResponse.frictionLevel,
        conceptualDepth: socraticResponse.conceptualDepth,
        ttl: Math.floor((currentTime + 7 * 24 * 60 * 60 * 1000) / 1000), // 7 days TTL
      },
    });

    await docClient.send(interactionCommand);

    return updatedContext;
  } catch (error) {
    console.error('Error updating conversation context:', error);
    return previousContext;
  }
}

/**
 * Log friction event when solution-seeking behavior is detected
 */
async function logFrictionEvent(
  studentId: string,
  sessionId: string,
  eventType: string,
  eventData: any
): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: FRICTION_EVENTS_TABLE,
      Item: {
        eventId: uuidv4(),
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
    console.error('Error logging friction event:', error);
  }
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