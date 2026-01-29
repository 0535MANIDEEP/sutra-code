import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

// Environment variables
const REGION = process.env.AWS_REGION || 'ap-south-1';
const STUDENT_PROFILES_TABLE = process.env.STUDENT_PROFILES_TABLE!;
const ANALOGY_CACHE_TABLE = process.env.ANALOGY_CACHE_TABLE || 'AnalogyCache';

// Initialize AWS clients
const bedrockClient = new BedrockRuntimeClient({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Claude 3 Sonnet model ID for complex analogies
const CLAUDE_SONNET_MODEL_ID = 'anthropic.claude-3-sonnet-20240229-v1:0';

// Interfaces
interface AnalogyRequest {
  concept: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  studentProfile: StudentProfile;
  language?: string;
  regionContext?: string;
}

interface AnalogyResponse {
  analogy: string;
  culturalContext: string;
  conceptMapping: ConceptMapping;
  followUpQuestions: string[];
  effectiveness?: number;
  alternativeAnalogies?: string[];
}

interface ConceptMapping {
  programmingConcept: string;
  culturalElement: string;
  mappingRationale: string;
  keyConnections: string[];
}

interface StudentProfile {
  studentId: string;
  preferredLanguage: string;
  skillLevel: number;
  culturalPreferences: string[];
  strugglingConcepts: string[];
  masteredConcepts: string[];
  gritScore: number;
  regionContext?: string;
  ipGeolocation?: {
    state: string;
    city: string;
    region: string;
  };
}

interface CachedAnalogy {
  analogyId: string;
  concept: string;
  difficulty: string;
  culturalContext: string;
  analogy: string;
  effectiveness: number;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

// Cultural context mappings with regional variations
const CULTURAL_CONTEXTS = {
  cricket: {
    contexts: ['batting order', 'team strategy', 'scoring', 'wickets', 'field positions', 'bowling variations'],
    regions: {
      mumbai: ['IPL Mumbai Indians', 'Wankhede Stadium', 'Sachin Tendulkar'],
      chennai: ['CSK', 'MA Chidambaram Stadium', 'MS Dhoni'],
      kolkata: ['KKR', 'Eden Gardens', 'Sourav Ganguly'],
      bangalore: ['RCB', 'Chinnaswamy Stadium', 'Virat Kohli'],
      hyderabad: ['SRH', 'Rajiv Gandhi Stadium', 'VVS Laxman'],
      delhi: ['Delhi Capitals', 'Arun Jaitley Stadium', 'Virender Sehwag'],
    },
  },
  mandi: {
    contexts: ['vendor stalls', 'price negotiation', 'inventory', 'seasonal goods', 'wholesale markets', 'supply chains'],
    regions: {
      punjab: ['wheat mandi', 'Apni Mandi', 'grain storage'],
      maharashtra: ['onion markets', 'Lasalgaon mandi', 'cotton trading'],
      kerala: ['spice markets', 'cardamom auctions', 'coconut trading'],
      gujarat: ['diamond cutting', 'textile markets', 'chemical trading'],
      rajasthan: ['camel fairs', 'handicraft markets', 'gem trading'],
      tamil_nadu: ['rice markets', 'silk weaving', 'temple town commerce'],
    },
  },
  festivals: {
    contexts: ['preparation', 'coordination', 'traditions', 'celebrations', 'community involvement', 'resource management'],
    regions: {
      bengal: ['Durga Puja', 'pandal organization', 'cultural programs'],
      maharashtra: ['Ganesh Chaturthi', 'mandal coordination', 'visarjan procession'],
      kerala: ['Onam', 'pookalam competition', 'sadhya preparation'],
      punjab: ['Baisakhi', 'gurdwara langar', 'harvest celebration'],
      tamil_nadu: ['Pongal', 'kolam designs', 'temple festivals'],
      gujarat: ['Navratri', 'garba organization', 'dandiya raas'],
    },
  },
  railways: {
    contexts: ['scheduling', 'routes', 'stations', 'connections', 'ticketing', 'logistics'],
    regions: {
      mumbai: ['local trains', 'Western/Central lines', 'peak hour management'],
      delhi: ['metro system', 'interconnected lines', 'smart card integration'],
      kolkata: ['tram system', 'metro connectivity', 'Howrah junction'],
      chennai: ['suburban trains', 'MRTS system', 'Central station'],
      bangalore: ['Namma Metro', 'IT corridor connectivity', 'traffic integration'],
      hyderabad: ['metro rail', 'HITEC City connection', 'airport link'],
    },
  },
  bollywood: {
    contexts: ['movie production', 'casting', 'storytelling', 'box office', 'distribution', 'marketing'],
    regions: {
      mumbai: ['Film City', 'Bollywood industry', 'producer networks'],
      chennai: ['Kollywood', 'Tamil cinema', 'Rajinikanth films'],
      hyderabad: ['Tollywood', 'Telugu cinema', 'Ramoji Film City'],
      bengal: ['Tollygunge', 'Bengali cinema', 'Satyajit Ray legacy'],
      kerala: ['Mollywood', 'Malayalam cinema', 'art house films'],
      punjabi: ['Punjabi cinema', 'music videos', 'diaspora themes'],
    },
  },
};

// Programming concept to cultural context mapping
const PROGRAMMING_CONCEPTS = {
  sorting: 'cricket',
  searching: 'mandi',
  recursion: 'festivals',
  graphs: 'railways',
  queues: 'bollywood',
  arrays: 'cricket',
  loops: 'festivals',
  functions: 'mandi',
  classes: 'railways',
  inheritance: 'bollywood',
  trees: 'festivals',
  stacks: 'mandi',
  hash_tables: 'cricket',
  dynamic_programming: 'railways',
  greedy_algorithms: 'mandi',
};

// Language support for 22 Indian languages
const SUPPORTED_LANGUAGES = [
  'hindi', 'tamil', 'telugu', 'bengali', 'marathi', 'gujarati', 'kannada', 'malayalam',
  'odia', 'punjabi', 'assamese', 'urdu', 'sanskrit', 'konkani', 'manipuri', 'nepali',
  'bodo', 'santhali', 'maithili', 'kashmiri', 'sindhi', 'dogri'
];

/**
 * Main Lambda handler for Cultural Analogy Generator
 * Requirements: 2.1, 2.2, 2.4, 2.5
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Cultural Analogy Generator - Processing request:', {
    path: event.path,
    method: event.httpMethod,
    body: event.body ? JSON.parse(event.body) : null,
  });

  try {
    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'POST':
        return await handleGenerateAnalogy(event);
      case 'GET':
        return await handleGetAnalogy(event);
      case 'PUT':
        return await handleUpdateEffectiveness(event);
      default:
        return createErrorResponse(405, 'Method not allowed');
    }
  } catch (error) {
    console.error('Cultural Analogy Generator error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
};

/**
 * Handle POST /v1/analogies/generate
 * Generate new cultural analogy for programming concept
 */
async function handleGenerateAnalogy(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return createErrorResponse(400, 'Request body is required');
  }

  const request: AnalogyRequest = JSON.parse(event.body);

  // Validate required fields
  if (!request.concept || !request.difficulty || !request.studentProfile) {
    return createErrorResponse(400, 'concept, difficulty, and studentProfile are required');
  }

  // Validate difficulty level
  if (!['beginner', 'intermediate', 'advanced'].includes(request.difficulty)) {
    return createErrorResponse(400, 'difficulty must be beginner, intermediate, or advanced');
  }

  // Validate language if provided
  if (request.language && !SUPPORTED_LANGUAGES.includes(request.language.toLowerCase())) {
    return createErrorResponse(400, `Unsupported language. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`);
  }

  try {
    // Check cache first for performance
    const cachedAnalogy = await getCachedAnalogy(request.concept, request.difficulty, request.studentProfile.regionContext);
    
    if (cachedAnalogy && cachedAnalogy.effectiveness > 0.8) {
      // Use cached analogy if effectiveness is high
      const response: AnalogyResponse = {
        analogy: cachedAnalogy.analogy,
        culturalContext: cachedAnalogy.culturalContext,
        conceptMapping: {
          programmingConcept: request.concept,
          culturalElement: cachedAnalogy.culturalContext,
          mappingRationale: 'Cached high-effectiveness analogy',
          keyConnections: [],
        },
        followUpQuestions: await generateFollowUpQuestions(request.concept, cachedAnalogy.analogy),
        effectiveness: cachedAnalogy.effectiveness,
      };

      // Update usage count
      await updateAnalogyUsage(cachedAnalogy.analogyId);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(response),
      };
    }

    // Generate new analogy using Bedrock
    const analogyResponse = await generateCulturalAnalogy(request);

    // Cache the new analogy
    await cacheAnalogy(request.concept, request.difficulty, analogyResponse, request.studentProfile.regionContext);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(analogyResponse),
    };

  } catch (error) {
    console.error('Error generating analogy:', error);
    return createErrorResponse(500, 'Failed to generate analogy');
  }
}

/**
 * Handle GET /v1/analogies/{concept}
 * Get cached analogies for a concept
 */
async function handleGetAnalogy(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const concept = event.pathParameters?.concept;
  
  if (!concept) {
    return createErrorResponse(400, 'Concept parameter is required');
  }

  try {
    const analogies = await getCachedAnalogiesByConcept(concept);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        concept,
        analogies: analogies.map(a => ({
          analogyId: a.analogyId,
          analogy: a.analogy,
          culturalContext: a.culturalContext,
          difficulty: a.difficulty,
          effectiveness: a.effectiveness,
          usageCount: a.usageCount,
        })),
      }),
    };

  } catch (error) {
    console.error('Error getting analogies:', error);
    return createErrorResponse(500, 'Failed to get analogies');
  }
}

/**
 * Handle PUT /v1/analogies/feedback
 * Update analogy effectiveness based on student feedback
 */
async function handleUpdateEffectiveness(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return createErrorResponse(400, 'Request body is required');
  }

  const { analogyId, effectiveness, feedback } = JSON.parse(event.body);

  if (!analogyId || effectiveness === undefined) {
    return createErrorResponse(400, 'analogyId and effectiveness are required');
  }

  if (effectiveness < 0 || effectiveness > 1) {
    return createErrorResponse(400, 'effectiveness must be between 0 and 1');
  }

  try {
    await updateAnalogyEffectiveness(analogyId, effectiveness, feedback);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Analogy effectiveness updated successfully',
        analogyId,
        effectiveness,
      }),
    };

  } catch (error) {
    console.error('Error updating effectiveness:', error);
    return createErrorResponse(500, 'Failed to update effectiveness');
  }
}

/**
 * Generate cultural analogy using Claude 3 Sonnet
 */
async function generateCulturalAnalogy(request: AnalogyRequest): Promise<AnalogyResponse> {
  try {
    // Determine cultural context based on concept
    const primaryContext = PROGRAMMING_CONCEPTS[request.concept as keyof typeof PROGRAMMING_CONCEPTS] || 'general';
    const culturalData = CULTURAL_CONTEXTS[primaryContext as keyof typeof CULTURAL_CONTEXTS];
    
    // Get regional context
    const regionContext = request.studentProfile.regionContext || 
                         request.studentProfile.ipGeolocation?.state?.toLowerCase() || 
                         'general';
    
    const regionalData = culturalData?.regions?.[regionContext as keyof typeof culturalData.regions] || 
                        culturalData?.contexts || [];

    // Build context-aware prompt
    const systemPrompt = `
You are a Cultural Analogy Generator for Indian CS students. Your task is to create culturally relevant analogies that map programming concepts to familiar Indian contexts.

CORE REQUIREMENTS:
1. Use authentic Indian cultural references (cricket, mandi, festivals, railways, Bollywood)
2. Ensure accuracy of both cultural reference and programming concept
3. Adapt complexity based on student skill level
4. Provide alternative analogies when needed
5. Support regional customization

CULTURAL CONTEXT GUIDELINES:
- Cricket: Team coordination, strategy, scoring systems, field positions
- Mandi: Price discovery, inventory management, vendor networks, negotiations
- Festivals: Preparation workflows, resource coordination, tradition inheritance
- Railways: Network topology, scheduling, route optimization, connections
- Bollywood: Production pipelines, casting decisions, distribution networks

REGIONAL CUSTOMIZATION:
- Tamil students: Kollywood references, temple architecture, classical music
- Bengali students: Durga Puja organization, fish markets, literary traditions
- Punjabi students: Wheat farming, gurdwara management, harvest festivals
- Gujarati students: Diamond cutting, business networks, textile industry
- Marathi students: Ganesh festival, cooperative societies, historical forts

COMPLEXITY ADAPTATION:
- Beginner (1-3): Simple, direct analogies with basic cultural elements
- Intermediate (4-7): Multi-layered analogies with cultural nuances
- Advanced (8-10): Complex analogies with deep cultural insights and multiple connections

LANGUAGE SUPPORT: Generate analogies that can be easily translated to any of the 22 Indian languages while preserving cultural authenticity.

Response format: JSON with analogy, culturalContext, conceptMapping, and followUpQuestions.
`;

    const userPrompt = `
PROGRAMMING CONCEPT: ${request.concept}
DIFFICULTY LEVEL: ${request.difficulty}
STUDENT SKILL LEVEL: ${request.studentProfile.skillLevel}/10
PREFERRED LANGUAGE: ${request.studentProfile.preferredLanguage}
CULTURAL PREFERENCES: ${request.studentProfile.culturalPreferences.join(', ')}
STRUGGLING CONCEPTS: ${request.studentProfile.strugglingConcepts.join(', ')}
REGIONAL CONTEXT: ${regionContext}
REGIONAL DATA: ${JSON.stringify(regionalData)}

Generate a culturally relevant analogy that:
1. Maps ${request.concept} to appropriate Indian cultural context
2. Uses ${regionContext} regional references when possible
3. Matches ${request.difficulty} complexity level
4. Provides clear conceptual connections
5. Includes 3-5 follow-up questions for deeper understanding

Ensure the analogy is:
- Culturally authentic and respectful
- Technically accurate for the programming concept
- Appropriate for skill level ${request.studentProfile.skillLevel}/10
- Engaging and memorable
- Suitable for translation to ${request.studentProfile.preferredLanguage}

Respond in JSON format:
{
  "analogy": "Detailed cultural analogy explanation",
  "culturalContext": "Primary cultural domain used",
  "conceptMapping": {
    "programmingConcept": "${request.concept}",
    "culturalElement": "Specific cultural element mapped",
    "mappingRationale": "Why this mapping works",
    "keyConnections": ["connection1", "connection2", "connection3"]
  },
  "followUpQuestions": ["question1", "question2", "question3"],
  "alternativeAnalogies": ["brief alternative 1", "brief alternative 2"]
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
      temperature: 0.8, // Higher creativity for analogies
      top_p: 0.9,
    };

    const command = new InvokeModelCommand({
      modelId: CLAUDE_SONNET_MODEL_ID,
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

    const analogyResponse = JSON.parse(jsonMatch[0]);
    
    // Validate response structure
    if (!analogyResponse.analogy || !analogyResponse.culturalContext) {
      throw new Error('Incomplete analogy response from Claude');
    }

    return analogyResponse;

  } catch (error) {
    console.error('Error generating cultural analogy:', error);
    
    // Fallback analogy based on concept
    return generateFallbackAnalogy(request.concept, request.difficulty);
  }
}

/**
 * Generate fallback analogy when Bedrock fails
 */
function generateFallbackAnalogy(concept: string, difficulty: string): AnalogyResponse {
  const fallbackAnalogies = {
    sorting: {
      analogy: "Think of sorting like organizing a cricket team's batting order. Just as a captain arranges players based on their strengths - openers who can face fast bowling, middle-order batsmen for stability, and finishers for the death overs - sorting algorithms arrange data elements in a specific order based on their values.",
      culturalContext: "cricket",
    },
    searching: {
      analogy: "Searching in programming is like finding the best price for vegetables in a mandi. A smart buyer doesn't check every single vendor randomly. Instead, they might start from one end, compare prices systematically, or ask other buyers for recommendations to quickly find the best deal.",
      culturalContext: "mandi",
    },
    recursion: {
      analogy: "Recursion is like the preparation for Diwali in a joint family. The grandmother delegates tasks to her daughters, who then delegate to their daughters, and so on. Each person does their part and passes the remaining work down the family hierarchy until everything is complete.",
      culturalContext: "festivals",
    },
  };

  const fallback = fallbackAnalogies[concept as keyof typeof fallbackAnalogies] || {
    analogy: "This programming concept is like organizing a community event where each person has a specific role and responsibility, working together to achieve a common goal.",
    culturalContext: "general",
  };

  return {
    analogy: fallback.analogy,
    culturalContext: fallback.culturalContext,
    conceptMapping: {
      programmingConcept: concept,
      culturalElement: fallback.culturalContext,
      mappingRationale: "Fallback analogy for system reliability",
      keyConnections: ["organization", "systematic approach", "goal achievement"],
    },
    followUpQuestions: [
      "How does this cultural example relate to your programming challenge?",
      "What patterns do you see between the cultural process and the algorithm?",
      "Can you think of other similar examples from your own experience?",
    ],
  };
}

/**
 * Generate follow-up questions for deeper understanding
 */
async function generateFollowUpQuestions(concept: string, analogy: string): Promise<string[]> {
  // Simple rule-based follow-up questions
  const baseQuestions = [
    `How does the ${concept} concept connect to the cultural example in the analogy?`,
    "What specific steps in the cultural process mirror the algorithm's steps?",
    "Can you identify the key decision points in both the cultural and programming contexts?",
    "What would happen if we changed the approach in both scenarios?",
    "How would you explain this connection to a friend using your own words?",
  ];

  return baseQuestions.slice(0, 3); // Return first 3 questions
}

/**
 * Get cached analogy from DynamoDB
 */
async function getCachedAnalogy(concept: string, difficulty: string, regionContext?: string): Promise<CachedAnalogy | null> {
  try {
    const command = new QueryCommand({
      TableName: ANALOGY_CACHE_TABLE,
      IndexName: 'ConceptDifficultyIndex',
      KeyConditionExpression: 'concept = :concept AND difficulty = :difficulty',
      ExpressionAttributeValues: {
        ':concept': concept,
        ':difficulty': difficulty,
      },
      ScanIndexForward: false, // Get most recent first
      Limit: 1,
    });

    const result = await docClient.send(command);
    return result.Items?.[0] as CachedAnalogy || null;
  } catch (error) {
    console.error('Error getting cached analogy:', error);
    return null;
  }
}

/**
 * Get all cached analogies for a concept
 */
async function getCachedAnalogiesByConcept(concept: string): Promise<CachedAnalogy[]> {
  try {
    const command = new QueryCommand({
      TableName: ANALOGY_CACHE_TABLE,
      IndexName: 'ConceptIndex',
      KeyConditionExpression: 'concept = :concept',
      ExpressionAttributeValues: {
        ':concept': concept,
      },
      ScanIndexForward: false, // Most recent first
    });

    const result = await docClient.send(command);
    return result.Items as CachedAnalogy[] || [];
  } catch (error) {
    console.error('Error getting cached analogies:', error);
    return [];
  }
}

/**
 * Cache analogy in DynamoDB
 */
async function cacheAnalogy(
  concept: string,
  difficulty: string,
  analogyResponse: AnalogyResponse,
  regionContext?: string
): Promise<void> {
  try {
    const analogyId = uuidv4();
    const currentTime = Date.now();

    const command = new PutCommand({
      TableName: ANALOGY_CACHE_TABLE,
      Item: {
        analogyId,
        concept,
        difficulty,
        culturalContext: analogyResponse.culturalContext,
        analogy: analogyResponse.analogy,
        conceptMapping: analogyResponse.conceptMapping,
        followUpQuestions: analogyResponse.followUpQuestions,
        regionContext: regionContext || 'general',
        effectiveness: 0.5, // Default effectiveness
        usageCount: 1,
        createdAt: currentTime,
        updatedAt: currentTime,
        ttl: Math.floor((currentTime + 30 * 24 * 60 * 60 * 1000) / 1000), // 30 days TTL
      },
    });

    await docClient.send(command);
  } catch (error) {
    console.error('Error caching analogy:', error);
  }
}

/**
 * Update analogy usage count
 */
async function updateAnalogyUsage(analogyId: string): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: ANALOGY_CACHE_TABLE,
      Item: {
        analogyId,
        usageCount: { $add: 1 },
        updatedAt: Date.now(),
      },
    });

    await docClient.send(command);
  } catch (error) {
    console.error('Error updating analogy usage:', error);
  }
}

/**
 * Update analogy effectiveness based on feedback
 */
async function updateAnalogyEffectiveness(analogyId: string, effectiveness: number, feedback?: string): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: ANALOGY_CACHE_TABLE,
      Item: {
        analogyId,
        effectiveness,
        feedback,
        updatedAt: Date.now(),
      },
    });

    await docClient.send(command);
  } catch (error) {
    console.error('Error updating analogy effectiveness:', error);
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