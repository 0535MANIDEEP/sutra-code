import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { v4 as uuidv4 } from 'uuid';

// Environment variables
const REGION = process.env.AWS_REGION || 'ap-south-1';
const STUDENT_PROFILES_TABLE = process.env.STUDENT_PROFILES_TABLE!;
const STRUGGLE_LOGS_TABLE = process.env.STRUGGLE_LOGS_TABLE!;
const LEARNER_SESSIONS_TABLE = process.env.LEARNER_SESSIONS_TABLE!;
const SCAFFOLD_CACHE_TABLE = process.env.SCAFFOLD_CACHE_TABLE || 'ScaffoldCache';
const CULTURAL_ANALOGY_LAMBDA_NAME = process.env.CULTURAL_ANALOGY_LAMBDA_NAME || 'SutraCode-CulturalAnalogyGenerator';

// Initialize AWS clients
const bedrockClient = new BedrockRuntimeClient({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const lambdaClient = new LambdaClient({ region: REGION });

// Claude 3 Haiku model ID for scaffold generation
const CLAUDE_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0';

// Interfaces
interface ScaffoldRequest {
  concept: string;
  studentLevel: number;
  previousAttempts: AttemptHistory[];
  language: 'python' | 'javascript' | 'java' | 'cpp';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  studentId: string;
  sessionId?: string;
}

interface ScaffoldResponse {
  scaffoldId: string;
  template: string;
  blanks: BlankDefinition[];
  hints: string[];
  validationRules: ValidationRule[];
  completionCriteria: CompletionCriteria;
  culturalAnalogy?: string;
  progressTracking: ProgressTracking;
}

interface BlankDefinition {
  id: string;
  position: number;
  type: 'variable' | 'logic' | 'function' | 'data_structure' | 'algorithm';
  expectedPattern: string;
  hint: string;
  difficulty: number; // 1-10 scale
  conceptualWeight: number; // How important this blank is for understanding
}

interface ValidationRule {
  blankId: string;
  validationType: 'syntax' | 'logic' | 'performance' | 'style';
  rule: string;
  errorMessage: string;
}

interface CompletionCriteria {
  minimumBlanksCompleted: number;
  requiredConceptualAccuracy: number; // 0-1 scale
  timeLimit?: number; // Optional time limit in minutes
  allowedHints: number;
}

interface ProgressTracking {
  scaffoldLevel: 1 | 2 | 3; // High, Medium, Low support
  competencyScore: number; // 1-10 scale
  strugglingAreas: string[];
  nextRecommendation: string;
  portfolioData: PortfolioData;
}

interface PortfolioData {
  conceptMastery: string;
  timeSpent: number;
  hintsUsed: number;
  completionRate: number;
  learningJourney: string[];
}

interface AttemptHistory {
  scaffoldId: string;
  completionRate: number;
  timeSpent: number;
  hintsUsed: number;
  errors: string[];
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
  competencyHistory: CompetencyRecord[];
}

interface CompetencyRecord {
  concept: string;
  level: number;
  timestamp: number;
  scaffoldCompletions: number;
}

interface CachedScaffold {
  scaffoldId: string;
  concept: string;
  language: string;
  difficulty: string;
  level: number;
  template: string;
  blanks: BlankDefinition[];
  effectiveness: number;
  usageCount: number;
  createdAt: number;
}

// Scaffolding levels configuration
const SCAFFOLDING_LEVELS = {
  1: { // High Support
    name: 'High Support',
    description: 'Only key logic blanks, full structure provided',
    blankPercentage: 0.2, // 20% of code as blanks
    structureProvided: 0.9, // 90% structure provided
    hintAvailability: 'high',
  },
  2: { // Medium Support
    name: 'Medium Support', 
    description: 'Function signatures and core logic blanks',
    blankPercentage: 0.4, // 40% of code as blanks
    structureProvided: 0.6, // 60% structure provided
    hintAvailability: 'medium',
  },
  3: { // Low Support
    name: 'Low Support',
    description: 'Minimal structure with major implementation gaps',
    blankPercentage: 0.7, // 70% of code as blanks
    structureProvided: 0.3, // 30% structure provided
    hintAvailability: 'low',
  },
};

// Programming language templates
const LANGUAGE_TEMPLATES = {
  python: {
    function: 'def ___FUNCTION_NAME___(___PARAMETERS___):\n    ___FUNCTION_BODY___',
    loop: 'for ___ITERATOR___ in ___ITERABLE___:\n    ___LOOP_BODY___',
    conditional: 'if ___CONDITION___:\n    ___IF_BODY___',
    variable: '___VARIABLE_NAME___ = ___VALUE___',
    class: 'class ___CLASS_NAME___:\n    def __init__(self, ___INIT_PARAMS___):\n        ___INIT_BODY___',
  },
  javascript: {
    function: 'function ___FUNCTION_NAME___(___PARAMETERS___) {\n    ___FUNCTION_BODY___\n}',
    loop: 'for (let ___ITERATOR___ = 0; ___ITERATOR___ < ___LIMIT___; ___ITERATOR___++) {\n    ___LOOP_BODY___\n}',
    conditional: 'if (___CONDITION___) {\n    ___IF_BODY___\n}',
    variable: 'let ___VARIABLE_NAME___ = ___VALUE___;',
    class: 'class ___CLASS_NAME___ {\n    constructor(___CONSTRUCTOR_PARAMS___) {\n        ___CONSTRUCTOR_BODY___\n    }\n}',
  },
  java: {
    function: 'public ___RETURN_TYPE___ ___FUNCTION_NAME___(___PARAMETERS___) {\n    ___FUNCTION_BODY___\n}',
    loop: 'for (int ___ITERATOR___ = 0; ___ITERATOR___ < ___LIMIT___; ___ITERATOR___++) {\n    ___LOOP_BODY___\n}',
    conditional: 'if (___CONDITION___) {\n    ___IF_BODY___\n}',
    variable: '___TYPE___ ___VARIABLE_NAME___ = ___VALUE___;',
    class: 'public class ___CLASS_NAME___ {\n    public ___CLASS_NAME___(___CONSTRUCTOR_PARAMS___) {\n        ___CONSTRUCTOR_BODY___\n    }\n}',
  },
  cpp: {
    function: '___RETURN_TYPE___ ___FUNCTION_NAME___(___PARAMETERS___) {\n    ___FUNCTION_BODY___\n}',
    loop: 'for (int ___ITERATOR___ = 0; ___ITERATOR___ < ___LIMIT___; ___ITERATOR___++) {\n    ___LOOP_BODY___\n}',
    conditional: 'if (___CONDITION___) {\n    ___IF_BODY___\n}',
    variable: '___TYPE___ ___VARIABLE_NAME___ = ___VALUE___;',
    class: 'class ___CLASS_NAME___ {\npublic:\n    ___CLASS_NAME___(___CONSTRUCTOR_PARAMS___) {\n        ___CONSTRUCTOR_BODY___\n    }\n};',
  },
};

// Blank placement strategies
const BLANK_PLACEMENT_STRATEGIES = {
  variable: {
    description: 'Remove variable names but keep types',
    patterns: ['___VARIABLE_NAME___', '___VALUE___', '___TYPE___'],
    difficulty: 2,
  },
  logic: {
    description: 'Remove conditional expressions and loop conditions',
    patterns: ['___CONDITION___', '___ITERATOR___', '___LIMIT___'],
    difficulty: 5,
  },
  function: {
    description: 'Remove function bodies but keep signatures',
    patterns: ['___FUNCTION_BODY___', '___PARAMETERS___', '___RETURN_TYPE___'],
    difficulty: 7,
  },
  data_structure: {
    description: 'Remove initialization but keep declarations',
    patterns: ['___INITIALIZATION___', '___DATA_STRUCTURE___'],
    difficulty: 6,
  },
  algorithm: {
    description: 'Remove core algorithmic steps but keep structure',
    patterns: ['___ALGORITHM_STEP___', '___COMPARISON___', '___SWAP___'],
    difficulty: 9,
  },
};

/**
 * Main Lambda handler for Faded Scaffolds Generator
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Faded Scaffolds Generator - Processing request:', {
    path: event.path,
    method: event.httpMethod,
    body: event.body ? JSON.parse(event.body) : null,
  });

  try {
    // Handle different HTTP methods and paths
    switch (event.httpMethod) {
      case 'POST':
        if (event.path.includes('/generate')) {
          return await handleGenerateScaffold(event);
        } else if (event.path.includes('/validate')) {
          return await handleValidateScaffold(event);
        }
        break;
      case 'GET':
        if (event.pathParameters?.scaffoldId) {
          return await handleGetScaffold(event);
        }
        break;
      case 'PUT':
        if (event.path.includes('/progress')) {
          return await handleUpdateProgress(event);
        }
        break;
      default:
        return createErrorResponse(405, 'Method not allowed');
    }

    return createErrorResponse(404, 'Endpoint not found');
  } catch (error) {
    console.error('Faded Scaffolds Generator error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
};

/**
 * Handle POST /v1/scaffolds/generate
 * Generate new faded scaffold for programming concept
 */
async function handleGenerateScaffold(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return createErrorResponse(400, 'Request body is required');
  }

  const request: ScaffoldRequest = JSON.parse(event.body);

  // Validate required fields
  if (!request.concept || !request.studentLevel || !request.language || !request.studentId) {
    return createErrorResponse(400, 'concept, studentLevel, language, and studentId are required');
  }

  // Validate student level
  if (request.studentLevel < 1 || request.studentLevel > 10) {
    return createErrorResponse(400, 'studentLevel must be between 1 and 10');
  }

  // Validate programming language
  if (!['python', 'javascript', 'java', 'cpp'].includes(request.language)) {
    return createErrorResponse(400, 'language must be python, javascript, java, or cpp');
  }

  try {
    // Get student profile for competency-based adaptation
    const studentProfile = await getStudentProfile(request.studentId);
    if (!studentProfile) {
      return createErrorResponse(404, 'Student profile not found');
    }

    // Determine scaffolding level based on competency
    const scaffoldLevel = determineScaffoldLevel(request.studentLevel, request.previousAttempts, studentProfile);

    // Check cache first for performance
    const cachedScaffold = await getCachedScaffold(
      request.concept,
      request.language,
      request.difficulty || 'intermediate',
      scaffoldLevel
    );

    let scaffoldResponse: ScaffoldResponse;

    if (cachedScaffold && cachedScaffold.effectiveness > 0.7) {
      // Use cached scaffold if effectiveness is good
      scaffoldResponse = await buildScaffoldResponseFromCache(cachedScaffold, request, studentProfile);
    } else {
      // Generate new scaffold
      scaffoldResponse = await generateNewScaffold(request, scaffoldLevel, studentProfile);
      
      // Cache the new scaffold
      await cacheScaffold(scaffoldResponse, request.concept, request.language, scaffoldLevel);
    }

    // Track scaffold generation for analytics
    await trackScaffoldGeneration(request.studentId, scaffoldResponse);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(scaffoldResponse),
    };

  } catch (error) {
    console.error('Error generating scaffold:', error);
    return createErrorResponse(500, 'Failed to generate scaffold');
  }
}

/**
 * Handle POST /v1/scaffolds/validate
 * Validate completed scaffold submission
 */
async function handleValidateScaffold(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return createErrorResponse(400, 'Request body is required');
  }

  const { scaffoldId, studentId, completedCode, blanksCompleted } = JSON.parse(event.body);

  if (!scaffoldId || !studentId || !completedCode) {
    return createErrorResponse(400, 'scaffoldId, studentId, and completedCode are required');
  }

  try {
    // Get scaffold details
    const scaffold = await getScaffoldById(scaffoldId);
    if (!scaffold) {
      return createErrorResponse(404, 'Scaffold not found');
    }

    // Validate the completed code
    const validationResult = await validateCompletedScaffold(scaffold, completedCode, blanksCompleted);

    // Update student progress
    await updateStudentProgress(studentId, scaffoldId, validationResult);

    // Generate portfolio data
    const portfolioData = await generatePortfolioData(studentId, scaffoldId, validationResult);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        valid: validationResult.isValid,
        score: validationResult.score,
        feedback: validationResult.feedback,
        errors: validationResult.errors,
        completionRate: validationResult.completionRate,
        portfolioData,
        nextRecommendation: validationResult.nextRecommendation,
      }),
    };

  } catch (error) {
    console.error('Error validating scaffold:', error);
    return createErrorResponse(500, 'Failed to validate scaffold');
  }
}

/**
 * Handle GET /v1/scaffolds/{scaffoldId}
 * Get scaffold details by ID
 */
async function handleGetScaffold(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const scaffoldId = event.pathParameters?.scaffoldId;
  
  if (!scaffoldId) {
    return createErrorResponse(400, 'scaffoldId parameter is required');
  }

  try {
    const scaffold = await getScaffoldById(scaffoldId);
    
    if (!scaffold) {
      return createErrorResponse(404, 'Scaffold not found');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(scaffold),
    };

  } catch (error) {
    console.error('Error getting scaffold:', error);
    return createErrorResponse(500, 'Failed to get scaffold');
  }
}

/**
 * Handle PUT /v1/scaffolds/progress
 * Update scaffold completion progress
 */
async function handleUpdateProgress(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return createErrorResponse(400, 'Request body is required');
  }

  const { studentId, scaffoldId, blankId, attemptedValue, timeSpent } = JSON.parse(event.body);

  if (!studentId || !scaffoldId || !blankId) {
    return createErrorResponse(400, 'studentId, scaffoldId, and blankId are required');
  }

  try {
    // Log the progress event for struggle tracking
    await logProgressEvent(studentId, scaffoldId, blankId, attemptedValue, timeSpent);

    // Generate hint if student is struggling
    const hint = await generateContextualHint(scaffoldId, blankId, attemptedValue, timeSpent);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Progress updated successfully',
        hint: hint || null,
        encouragement: generateEncouragement(timeSpent),
      }),
    };

  } catch (error) {
    console.error('Error updating progress:', error);
    return createErrorResponse(500, 'Failed to update progress');
  }
}

/**
 * Determine appropriate scaffolding level based on student competency
 */
function determineScaffoldLevel(
  studentLevel: number,
  previousAttempts: AttemptHistory[],
  studentProfile: StudentProfile
): 1 | 2 | 3 {
  // Base level on student skill level
  let level: 1 | 2 | 3;
  
  if (studentLevel <= 3) {
    level = 1; // High support for beginners
  } else if (studentLevel <= 7) {
    level = 2; // Medium support for intermediate
  } else {
    level = 3; // Low support for advanced
  }

  // Adjust based on previous attempts
  if (previousAttempts.length > 0) {
    const avgCompletionRate = previousAttempts.reduce((sum, attempt) => sum + attempt.completionRate, 0) / previousAttempts.length;
    const avgHintsUsed = previousAttempts.reduce((sum, attempt) => sum + attempt.hintsUsed, 0) / previousAttempts.length;

    // If student is struggling (low completion rate, high hints usage), increase support
    if (avgCompletionRate < 0.6 || avgHintsUsed > 5) {
      level = Math.max(1, level - 1) as 1 | 2 | 3;
    }
    
    // If student is excelling (high completion rate, low hints usage), reduce support
    if (avgCompletionRate > 0.9 && avgHintsUsed < 2) {
      level = Math.min(3, level + 1) as 1 | 2 | 3;
    }
  }

  // Consider grit score - higher grit can handle more challenge
  if (studentProfile.gritScore > 80) {
    level = Math.min(3, level + 1) as 1 | 2 | 3;
  } else if (studentProfile.gritScore < 40) {
    level = Math.max(1, level - 1) as 1 | 2 | 3;
  }

  return level;
}

/**
 * Generate new scaffold using Bedrock and cultural analogies
 */
async function generateNewScaffold(
  request: ScaffoldRequest,
  scaffoldLevel: 1 | 2 | 3,
  studentProfile: StudentProfile
): Promise<ScaffoldResponse> {
  try {
    // Get cultural analogy for the concept
    const culturalAnalogy = await getCulturalAnalogy(request.concept, studentProfile);

    // Generate scaffold using Claude 3 Haiku
    const scaffoldData = await generateScaffoldWithBedrock(request, scaffoldLevel, culturalAnalogy);

    // Create blank definitions based on scaffold level
    const blanks = generateBlankDefinitions(scaffoldData.template, scaffoldLevel, request.language);

    // Generate hints without revealing solutions
    const hints = await generateHintsWithoutSolutions(request.concept, blanks, culturalAnalogy);

    // Create validation rules
    const validationRules = generateValidationRules(blanks, request.language);

    // Set completion criteria based on level
    const completionCriteria = generateCompletionCriteria(scaffoldLevel, blanks.length);

    // Generate progress tracking data
    const progressTracking = generateProgressTracking(scaffoldLevel, request.studentLevel, studentProfile);

    const scaffoldResponse: ScaffoldResponse = {
      scaffoldId: uuidv4(),
      template: scaffoldData.template,
      blanks,
      hints,
      validationRules,
      completionCriteria,
      culturalAnalogy: culturalAnalogy.analogy,
      progressTracking,
    };

    return scaffoldResponse;

  } catch (error) {
    console.error('Error generating new scaffold:', error);
    
    // Fallback scaffold generation
    return generateFallbackScaffold(request, scaffoldLevel);
  }
}

/**
 * Generate scaffold template using Claude 3 Haiku
 */
async function generateScaffoldWithBedrock(
  request: ScaffoldRequest,
  scaffoldLevel: 1 | 2 | 3,
  culturalAnalogy: any
): Promise<{ template: string; explanation: string }> {
  const levelConfig = SCAFFOLDING_LEVELS[scaffoldLevel];
  const languageTemplates = LANGUAGE_TEMPLATES[request.language];

  const systemPrompt = `
You are a Faded Scaffolds Generator for Indian CS students learning through cultural analogies.

CORE REQUIREMENTS:
1. Generate ${request.language} code templates with strategic blanks
2. Use ${levelConfig.name} (${levelConfig.description})
3. Create ${Math.round(levelConfig.blankPercentage * 100)}% blanks, provide ${Math.round(levelConfig.structureProvided * 100)}% structure
4. Integrate cultural analogy: "${culturalAnalogy.analogy}"
5. Never reveal complete solutions - only provide scaffolding

BLANK PLACEMENT STRATEGY:
- Variables: Remove variable names but keep types (difficulty: 2/10)
- Logic: Remove conditional expressions and loop conditions (difficulty: 5/10)
- Functions: Remove function bodies but keep signatures (difficulty: 7/10)
- Data Structures: Remove initialization but keep declarations (difficulty: 6/10)
- Algorithms: Remove core algorithmic steps but keep structure (difficulty: 9/10)

SCAFFOLDING LEVEL ${scaffoldLevel} RULES:
- Blank Percentage: ${Math.round(levelConfig.blankPercentage * 100)}%
- Structure Provided: ${Math.round(levelConfig.structureProvided * 100)}%
- Hint Availability: ${levelConfig.hintAvailability}

LANGUAGE TEMPLATES FOR ${request.language.toUpperCase()}:
${Object.entries(languageTemplates).map(([key, template]) => `${key}: ${template}`).join('\n')}

CULTURAL INTEGRATION:
Use the analogy "${culturalAnalogy.analogy}" in comments to explain the code structure.
Add comments that connect programming concepts to the cultural context.

Response format: JSON with template and explanation fields.
`;

  const userPrompt = `
CONCEPT: ${request.concept}
DIFFICULTY: ${request.difficulty || 'intermediate'}
STUDENT LEVEL: ${request.studentLevel}/10
LANGUAGE: ${request.language}
SCAFFOLDING LEVEL: ${scaffoldLevel} (${levelConfig.name})

CULTURAL ANALOGY: ${culturalAnalogy.analogy}

Generate a faded scaffold that:
1. Implements ${request.concept} in ${request.language}
2. Uses ${levelConfig.name} with ${Math.round(levelConfig.blankPercentage * 100)}% blanks
3. Integrates the cultural analogy in comments
4. Provides appropriate structure for level ${scaffoldLevel}
5. Uses blank patterns like ___VARIABLE_NAME___, ___CONDITION___, etc.

Example blank patterns:
- ___VARIABLE_NAME___ for variable names
- ___CONDITION___ for if/while conditions
- ___FUNCTION_BODY___ for function implementations
- ___LOOP_BODY___ for loop contents
- ___ALGORITHM_STEP___ for key algorithmic steps

Respond in JSON format:
{
  "template": "Complete code template with blanks",
  "explanation": "How this scaffold relates to the cultural analogy"
}
`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2000,
    system: systemPrompt,
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

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  // Parse Claude's response
  const content = responseBody.content[0].text;
  
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid response format from Claude');
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Generate blank definitions from template
 */
function generateBlankDefinitions(
  template: string,
  scaffoldLevel: 1 | 2 | 3,
  language: string
): BlankDefinition[] {
  const blanks: BlankDefinition[] = [];
  const blankPattern = /___([A-Z_]+)___/g;
  let match;
  let position = 0;

  while ((match = blankPattern.exec(template)) !== null) {
    const blankName = match[1];
    const blankType = determineBlankType(blankName);
    const strategy = BLANK_PLACEMENT_STRATEGIES[blankType];

    blanks.push({
      id: uuidv4(),
      position: position++,
      type: blankType,
      expectedPattern: generateExpectedPattern(blankName, language),
      hint: generateBlankHint(blankName, blankType),
      difficulty: adjustDifficultyForLevel(strategy.difficulty, scaffoldLevel),
      conceptualWeight: calculateConceptualWeight(blankType),
    });
  }

  return blanks;
}

/**
 * Determine blank type from blank name
 */
function determineBlankType(blankName: string): 'variable' | 'logic' | 'function' | 'data_structure' | 'algorithm' {
  if (blankName.includes('VARIABLE') || blankName.includes('VALUE') || blankName.includes('TYPE')) {
    return 'variable';
  } else if (blankName.includes('CONDITION') || blankName.includes('ITERATOR') || blankName.includes('LIMIT')) {
    return 'logic';
  } else if (blankName.includes('FUNCTION') || blankName.includes('METHOD') || blankName.includes('RETURN')) {
    return 'function';
  } else if (blankName.includes('ARRAY') || blankName.includes('LIST') || blankName.includes('STRUCTURE')) {
    return 'data_structure';
  } else {
    return 'algorithm';
  }
}

/**
 * Generate expected pattern for blank validation
 */
function generateExpectedPattern(blankName: string, language: string): string {
  const patterns: Record<string, Record<string, string>> = {
    python: {
      'VARIABLE_NAME': '[a-zA-Z_][a-zA-Z0-9_]*',
      'FUNCTION_NAME': '[a-zA-Z_][a-zA-Z0-9_]*',
      'CONDITION': '.+',
      'VALUE': '.+',
      'ITERATOR': '[a-zA-Z_][a-zA-Z0-9_]*',
    },
    javascript: {
      'VARIABLE_NAME': '[a-zA-Z_$][a-zA-Z0-9_$]*',
      'FUNCTION_NAME': '[a-zA-Z_$][a-zA-Z0-9_$]*',
      'CONDITION': '.+',
      'VALUE': '.+',
      'ITERATOR': '[a-zA-Z_$][a-zA-Z0-9_$]*',
    },
    java: {
      'VARIABLE_NAME': '[a-zA-Z_][a-zA-Z0-9_]*',
      'FUNCTION_NAME': '[a-zA-Z_][a-zA-Z0-9_]*',
      'TYPE': '[A-Z][a-zA-Z0-9]*',
      'CONDITION': '.+',
      'VALUE': '.+',
    },
    cpp: {
      'VARIABLE_NAME': '[a-zA-Z_][a-zA-Z0-9_]*',
      'FUNCTION_NAME': '[a-zA-Z_][a-zA-Z0-9_]*',
      'TYPE': '[a-zA-Z_][a-zA-Z0-9_]*',
      'CONDITION': '.+',
      'VALUE': '.+',
    },
  };

  return patterns[language]?.[blankName] || '.+';
}

/**
 * Generate hint for blank without revealing solution
 */
function generateBlankHint(blankName: string, blankType: string): string {
  const hints: Record<string, Record<string, string>> = {
    variable: {
      'VARIABLE_NAME': 'Think about what this variable represents. Use a descriptive name.',
      'VALUE': 'What value should be assigned here based on the logic?',
      'TYPE': 'What data type is appropriate for this variable?',
    },
    logic: {
      'CONDITION': 'What condition needs to be checked here? Think about the loop or if statement purpose.',
      'ITERATOR': 'What variable will track the loop progress?',
      'LIMIT': 'What is the stopping condition for this loop?',
    },
    function: {
      'FUNCTION_NAME': 'Choose a name that describes what this function does.',
      'FUNCTION_BODY': 'What steps need to be implemented inside this function?',
      'PARAMETERS': 'What inputs does this function need?',
      'RETURN_TYPE': 'What type of value should this function return?',
    },
    data_structure: {
      'ARRAY': 'What data structure is needed here?',
      'INITIALIZATION': 'How should this data structure be initialized?',
    },
    algorithm: {
      'ALGORITHM_STEP': 'What is the key algorithmic step here?',
      'COMPARISON': 'What comparison is needed for this algorithm?',
      'SWAP': 'How should elements be exchanged?',
    },
  };

  return hints[blankType]?.[blankName] || 'Think about what belongs here based on the context.';
}

/**
 * Adjust difficulty based on scaffolding level
 */
function adjustDifficultyForLevel(baseDifficulty: number, scaffoldLevel: 1 | 2 | 3): number {
  const adjustments = {
    1: -2, // Easier for high support
    2: 0,  // No change for medium support
    3: +2, // Harder for low support
  };

  return Math.max(1, Math.min(10, baseDifficulty + adjustments[scaffoldLevel]));
}

/**
 * Calculate conceptual weight of blank
 */
function calculateConceptualWeight(blankType: string): number {
  const weights = {
    variable: 0.2,
    logic: 0.6,
    function: 0.8,
    data_structure: 0.7,
    algorithm: 1.0,
  };

  return weights[blankType as keyof typeof weights] || 0.5;
}

/**
 * Generate hints without revealing solutions
 */
async function generateHintsWithoutSolutions(
  concept: string,
  blanks: BlankDefinition[],
  culturalAnalogy: any
): Promise<string[]> {
  const hints: string[] = [];

  // Generate conceptual hints using cultural analogy
  hints.push(`Think about how ${culturalAnalogy.culturalContext} relates to ${concept}. ${culturalAnalogy.analogy}`);

  // Add strategic hints for key blanks
  const keyBlanks = blanks.filter(blank => blank.conceptualWeight > 0.7);
  
  for (const blank of keyBlanks.slice(0, 3)) { // Limit to 3 key hints
    hints.push(`For the ${blank.type} blank: ${blank.hint}`);
  }

  // Add encouragement hint
  hints.push('Remember, struggling is part of learning. Take your time to think through each step.');

  return hints;
}

/**
 * Generate validation rules for blanks
 */
function generateValidationRules(blanks: BlankDefinition[], language: string): ValidationRule[] {
  const rules: ValidationRule[] = [];

  for (const blank of blanks) {
    // Syntax validation
    rules.push({
      blankId: blank.id,
      validationType: 'syntax',
      rule: blank.expectedPattern,
      errorMessage: `Invalid syntax for ${blank.type}. ${blank.hint}`,
    });

    // Logic validation for high-weight blanks
    if (blank.conceptualWeight > 0.6) {
      rules.push({
        blankId: blank.id,
        validationType: 'logic',
        rule: 'contextual_logic_check',
        errorMessage: `The logic doesn't seem right. Think about the purpose of this ${blank.type}.`,
      });
    }
  }

  return rules;
}

/**
 * Generate completion criteria based on scaffolding level
 */
function generateCompletionCriteria(scaffoldLevel: 1 | 2 | 3, totalBlanks: number): CompletionCriteria {
  const levelConfig = SCAFFOLDING_LEVELS[scaffoldLevel];
  
  return {
    minimumBlanksCompleted: Math.ceil(totalBlanks * 0.8), // 80% completion required
    requiredConceptualAccuracy: scaffoldLevel === 1 ? 0.6 : scaffoldLevel === 2 ? 0.7 : 0.8,
    allowedHints: levelConfig.hintAvailability === 'high' ? 10 : levelConfig.hintAvailability === 'medium' ? 5 : 2,
  };
}

/**
 * Generate progress tracking data
 */
function generateProgressTracking(
  scaffoldLevel: 1 | 2 | 3,
  studentLevel: number,
  studentProfile: StudentProfile
): ProgressTracking {
  return {
    scaffoldLevel,
    competencyScore: studentLevel,
    strugglingAreas: studentProfile.strugglingConcepts,
    nextRecommendation: generateNextRecommendation(scaffoldLevel, studentLevel),
    portfolioData: {
      conceptMastery: 'In Progress',
      timeSpent: 0,
      hintsUsed: 0,
      completionRate: 0,
      learningJourney: [`Started ${SCAFFOLDING_LEVELS[scaffoldLevel].name} scaffold`],
    },
  };
}

/**
 * Generate next recommendation based on current level
 */
function generateNextRecommendation(scaffoldLevel: 1 | 2 | 3, studentLevel: number): string {
  if (scaffoldLevel === 1 && studentLevel > 5) {
    return 'Consider trying Medium Support scaffolds to challenge yourself more.';
  } else if (scaffoldLevel === 3 && studentLevel < 7) {
    return 'If this feels too challenging, try Medium Support scaffolds first.';
  } else {
    return 'Continue practicing with similar scaffolds to build confidence.';
  }
}

/**
 * Get cultural analogy from Cultural Analogy Generator
 */
async function getCulturalAnalogy(concept: string, studentProfile: StudentProfile): Promise<any> {
  try {
    const difficulty = studentProfile.skillLevel <= 3 ? 'beginner' : 
                     studentProfile.skillLevel <= 7 ? 'intermediate' : 'advanced';

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
        headers: { 'Content-Type': 'application/json' },
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
    console.error('Error getting cultural analogy:', error);
    
    // Fallback analogy
    return {
      analogy: `Think of ${concept} like organizing a community event where each step has a specific purpose and order.`,
      culturalContext: 'general',
      conceptMapping: {
        programmingConcept: concept,
        culturalElement: 'community organization',
        mappingRationale: 'Both require systematic planning and execution',
        keyConnections: ['organization', 'systematic approach', 'step-by-step process'],
      },
    };
  }
}

/**
 * Generate fallback scaffold when Bedrock fails
 */
function generateFallbackScaffold(request: ScaffoldRequest, scaffoldLevel: 1 | 2 | 3): ScaffoldResponse {
  const languageTemplates = LANGUAGE_TEMPLATES[request.language];
  
  // Simple fallback template based on concept
  let template = '';
  
  if (request.concept === 'sorting') {
    template = request.language === 'python' ? 
      `# Sorting algorithm implementation
def sort_array(___ARRAY_NAME___):
    # Cultural analogy: Like arranging cricket players by batting order
    for ___OUTER_ITERATOR___ in range(len(___ARRAY_NAME___)):
        for ___INNER_ITERATOR___ in range(len(___ARRAY_NAME___) - 1):
            if ___COMPARISON_CONDITION___:
                # Swap elements
                ___SWAP_OPERATION___
    return ___ARRAY_NAME___` :
      `// Sorting algorithm implementation
function sortArray(___ARRAY_NAME___) {
    // Cultural analogy: Like arranging cricket players by batting order
    for (let ___OUTER_ITERATOR___ = 0; ___OUTER_ITERATOR___ < ___ARRAY_NAME___.length; ___OUTER_ITERATOR___++) {
        for (let ___INNER_ITERATOR___ = 0; ___INNER_ITERATOR___ < ___ARRAY_NAME___.length - 1; ___INNER_ITERATOR___++) {
            if (___COMPARISON_CONDITION___) {
                // Swap elements
                ___SWAP_OPERATION___
            }
        }
    }
    return ___ARRAY_NAME___;
}`;
  } else {
    template = languageTemplates.function.replace('___FUNCTION_NAME___', request.concept + '_implementation');
  }

  const blanks = generateBlankDefinitions(template, scaffoldLevel, request.language);

  return {
    scaffoldId: uuidv4(),
    template,
    blanks,
    hints: [
      `This ${request.concept} implementation is like organizing a systematic process.`,
      'Think about each step and what it accomplishes.',
      'Take your time to understand the structure before filling in the blanks.',
    ],
    validationRules: generateValidationRules(blanks, request.language),
    completionCriteria: generateCompletionCriteria(scaffoldLevel, blanks.length),
    culturalAnalogy: `Think of ${request.concept} like organizing a community event where each step has a specific purpose.`,
    progressTracking: {
      scaffoldLevel,
      competencyScore: request.studentLevel,
      strugglingAreas: [],
      nextRecommendation: 'Complete this scaffold to build understanding of the concept.',
      portfolioData: {
        conceptMastery: 'In Progress',
        timeSpent: 0,
        hintsUsed: 0,
        completionRate: 0,
        learningJourney: ['Started fallback scaffold'],
      },
    },
  };
}

// Additional helper functions would continue here...
// Due to length constraints, I'll continue with the remaining functions in the next part

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
 * Get cached scaffold from DynamoDB
 */
async function getCachedScaffold(
  concept: string,
  language: string,
  difficulty: string,
  level: number
): Promise<CachedScaffold | null> {
  try {
    const command = new QueryCommand({
      TableName: SCAFFOLD_CACHE_TABLE,
      IndexName: 'ConceptLanguageIndex',
      KeyConditionExpression: 'concept = :concept AND language = :language',
      FilterExpression: 'difficulty = :difficulty AND #level = :level',
      ExpressionAttributeNames: {
        '#level': 'level',
      },
      ExpressionAttributeValues: {
        ':concept': concept,
        ':language': language,
        ':difficulty': difficulty,
        ':level': level,
      },
      ScanIndexForward: false,
      Limit: 1,
    });

    const result = await docClient.send(command);
    return result.Items?.[0] as CachedScaffold || null;
  } catch (error) {
    console.error('Error getting cached scaffold:', error);
    return null;
  }
}

/**
 * Cache scaffold in DynamoDB
 */
async function cacheScaffold(
  scaffold: ScaffoldResponse,
  concept: string,
  language: string,
  level: number
): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: SCAFFOLD_CACHE_TABLE,
      Item: {
        scaffoldId: scaffold.scaffoldId,
        concept,
        language,
        difficulty: 'intermediate', // Default difficulty
        level,
        template: scaffold.template,
        blanks: scaffold.blanks,
        effectiveness: 0.5, // Default effectiveness
        usageCount: 1,
        createdAt: Date.now(),
        ttl: Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000), // 7 days TTL
      },
    });

    await docClient.send(command);
  } catch (error) {
    console.error('Error caching scaffold:', error);
  }
}

/**
 * Build scaffold response from cached data
 */
async function buildScaffoldResponseFromCache(
  cachedScaffold: CachedScaffold,
  request: ScaffoldRequest,
  studentProfile: StudentProfile
): Promise<ScaffoldResponse> {
  // Get fresh cultural analogy
  const culturalAnalogy = await getCulturalAnalogy(request.concept, studentProfile);

  // Generate fresh hints
  const hints = await generateHintsWithoutSolutions(request.concept, cachedScaffold.blanks, culturalAnalogy);

  // Update usage count
  await updateScaffoldUsage(cachedScaffold.scaffoldId);

  return {
    scaffoldId: uuidv4(), // New ID for this instance
    template: cachedScaffold.template,
    blanks: cachedScaffold.blanks,
    hints,
    validationRules: generateValidationRules(cachedScaffold.blanks, request.language),
    completionCriteria: generateCompletionCriteria(cachedScaffold.level as 1 | 2 | 3, cachedScaffold.blanks.length),
    culturalAnalogy: culturalAnalogy.analogy,
    progressTracking: generateProgressTracking(cachedScaffold.level as 1 | 2 | 3, request.studentLevel, studentProfile),
  };
}

/**
 * Update scaffold usage count
 */
async function updateScaffoldUsage(scaffoldId: string): Promise<void> {
  try {
    const command = new UpdateCommand({
      TableName: SCAFFOLD_CACHE_TABLE,
      Key: { scaffoldId },
      UpdateExpression: 'ADD usageCount :inc SET updatedAt = :now',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':now': Date.now(),
      },
    });

    await docClient.send(command);
  } catch (error) {
    console.error('Error updating scaffold usage:', error);
  }
}

/**
 * Track scaffold generation for analytics
 */
async function trackScaffoldGeneration(studentId: string, scaffold: ScaffoldResponse): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: STRUGGLE_LOGS_TABLE,
      Item: {
        logId: uuidv4(),
        timestamp: Date.now(),
        studentId,
        eventType: 'scaffold_generated',
        eventData: {
          scaffoldId: scaffold.scaffoldId,
          scaffoldLevel: scaffold.progressTracking.scaffoldLevel,
          blanksCount: scaffold.blanks.length,
          competencyScore: scaffold.progressTracking.competencyScore,
        },
        ttl: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000), // 30 days TTL
      },
    });

    await docClient.send(command);
  } catch (error) {
    console.error('Error tracking scaffold generation:', error);
  }
}

/**
 * Get scaffold by ID
 */
async function getScaffoldById(scaffoldId: string): Promise<ScaffoldResponse | null> {
  try {
    const command = new GetCommand({
      TableName: SCAFFOLD_CACHE_TABLE,
      Key: { scaffoldId },
    });

    const result = await docClient.send(command);
    return result.Item as ScaffoldResponse || null;
  } catch (error) {
    console.error('Error getting scaffold by ID:', error);
    return null;
  }
}

/**
 * Validate completed scaffold
 */
async function validateCompletedScaffold(
  scaffold: any,
  completedCode: string,
  blanksCompleted: Record<string, string>
): Promise<any> {
  const validationResult = {
    isValid: true,
    score: 0,
    feedback: [] as string[],
    errors: [] as string[],
    completionRate: 0,
    nextRecommendation: '',
  };

  // Calculate completion rate
  const totalBlanks = scaffold.blanks.length;
  const completedBlanks = Object.keys(blanksCompleted).length;
  validationResult.completionRate = completedBlanks / totalBlanks;

  // Validate each completed blank
  let correctBlanks = 0;
  
  for (const blank of scaffold.blanks) {
    const userInput = blanksCompleted[blank.id];
    
    if (!userInput) {
      validationResult.errors.push(`Blank ${blank.position + 1} is not completed`);
      continue;
    }

    // Basic pattern validation
    const pattern = new RegExp(blank.expectedPattern);
    if (pattern.test(userInput)) {
      correctBlanks++;
      validationResult.feedback.push(`Good work on blank ${blank.position + 1}!`);
    } else {
      validationResult.errors.push(`Blank ${blank.position + 1}: ${blank.hint}`);
    }
  }

  // Calculate score
  validationResult.score = (correctBlanks / totalBlanks) * 100;

  // Determine if valid based on completion criteria
  validationResult.isValid = validationResult.completionRate >= 0.8 && validationResult.score >= 60;

  // Generate next recommendation
  if (validationResult.isValid) {
    validationResult.nextRecommendation = 'Great job! Ready for the next challenge.';
  } else if (validationResult.completionRate < 0.8) {
    validationResult.nextRecommendation = 'Try to complete more blanks before submitting.';
  } else {
    validationResult.nextRecommendation = 'Review the hints and try again.';
  }

  return validationResult;
}

/**
 * Update student progress
 */
async function updateStudentProgress(
  studentId: string,
  scaffoldId: string,
  validationResult: any
): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: STRUGGLE_LOGS_TABLE,
      Item: {
        logId: uuidv4(),
        timestamp: Date.now(),
        studentId,
        eventType: 'scaffold_completed',
        eventData: {
          scaffoldId,
          score: validationResult.score,
          completionRate: validationResult.completionRate,
          isValid: validationResult.isValid,
          errors: validationResult.errors,
        },
        ttl: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
      },
    });

    await docClient.send(command);
  } catch (error) {
    console.error('Error updating student progress:', error);
  }
}

/**
 * Generate portfolio data
 */
async function generatePortfolioData(
  studentId: string,
  scaffoldId: string,
  validationResult: any
): Promise<PortfolioData> {
  return {
    conceptMastery: validationResult.isValid ? 'Completed' : 'In Progress',
    timeSpent: 0, // Would be tracked from progress events
    hintsUsed: 0, // Would be tracked from progress events
    completionRate: validationResult.completionRate,
    learningJourney: [
      `Completed scaffold with ${Math.round(validationResult.score)}% accuracy`,
      `Completion rate: ${Math.round(validationResult.completionRate * 100)}%`,
    ],
  };
}

/**
 * Log progress event for struggle tracking
 */
async function logProgressEvent(
  studentId: string,
  scaffoldId: string,
  blankId: string,
  attemptedValue: string,
  timeSpent: number
): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: STRUGGLE_LOGS_TABLE,
      Item: {
        logId: uuidv4(),
        timestamp: Date.now(),
        studentId,
        eventType: 'scaffold_progress',
        eventData: {
          scaffoldId,
          blankId,
          attemptedValue,
          timeSpent,
        },
        ttl: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
      },
    });

    await docClient.send(command);
  } catch (error) {
    console.error('Error logging progress event:', error);
  }
}

/**
 * Generate contextual hint based on struggle
 */
async function generateContextualHint(
  scaffoldId: string,
  blankId: string,
  attemptedValue: string,
  timeSpent: number
): Promise<string | null> {
  // If student has been struggling for more than 5 minutes, provide a hint
  if (timeSpent > 300000) { // 5 minutes in milliseconds
    return 'Take a step back and think about the purpose of this code section. What is it trying to accomplish?';
  }

  // If attempted value is completely wrong, provide guidance
  if (attemptedValue && attemptedValue.length < 2) {
    return 'Try to think of a more descriptive name or value that fits the context.';
  }

  return null;
}

/**
 * Generate encouragement based on time spent
 */
function generateEncouragement(timeSpent: number): string {
  if (timeSpent > 600000) { // 10 minutes
    return 'You\'re putting in great effort! Remember, struggling with code is how we learn and grow.';
  } else if (timeSpent > 300000) { // 5 minutes
    return 'Good persistence! Take your time to think through each step.';
  } else {
    return 'You\'re making good progress! Keep thinking through the logic.';
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