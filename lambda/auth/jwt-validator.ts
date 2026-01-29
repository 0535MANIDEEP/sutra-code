import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Environment variables
const USER_POOL_ID = process.env.USER_POOL_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;
const STUDENT_PROFILES_TABLE = process.env.STUDENT_PROFILES_TABLE!;
const REGION = process.env.AWS_REGION || 'ap-south-1';

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Initialize JWT verifier
const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'access',
  clientId: CLIENT_ID,
});

interface AuthContext {
  isAuthenticated: boolean;
  userId?: string;
  userRole?: string;
  email?: string;
  phoneNumber?: string;
  preferredLanguage?: string;
  gritScore?: number;
  skillLevel?: number;
  sessionTimeout?: number;
  mfaEnabled?: boolean;
  lastActivity?: number;
}

interface StudentProfile {
  studentId: string;
  email: string;
  phoneNumber?: string;
  givenName: string;
  familyName: string;
  userRole: 'student' | 'recruiter';
  institutionName?: string;
  preferredLanguage: string;
  dataConsentGiven: string;
  aadhaarOptional: boolean;
  gritScore: number;
  skillLevel: number;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
  mfaEnabled: boolean;
  accountLocked: boolean;
  failedLoginAttempts: number;
  sessionTimeoutMinutes: number; // 480 for students, 240 for recruiters
}

/**
 * JWT Token Validation Middleware
 * Validates Cognito JWT tokens and enforces security policies
 * Requirements: 10.2, 10.3 - Authentication and session management
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('JWT Validator - Processing request:', {
    path: event.path,
    method: event.httpMethod,
    headers: Object.keys(event.headers),
  });

  try {
    // Extract Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    
    if (!authHeader) {
      return createUnauthorizedResponse('Missing Authorization header');
    }

    // Extract Bearer token
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/);
    if (!tokenMatch) {
      return createUnauthorizedResponse('Invalid Authorization header format');
    }

    const token = tokenMatch[1];

    // Verify JWT token
    let payload;
    try {
      payload = await verifier.verify(token);
      console.log('JWT verification successful:', {
        sub: payload.sub,
        token_use: payload.token_use,
        exp: payload.exp,
      });
    } catch (error) {
      console.error('JWT verification failed:', error);
      return createUnauthorizedResponse('Invalid or expired token');
    }

    // Extract user information from token
    const userId = payload.sub;
    const email = payload.email;
    const phoneNumber = payload.phone_number;

    // Get user profile from DynamoDB
    const userProfile = await getUserProfile(userId);
    
    if (!userProfile) {
      // Create profile if it doesn't exist (first login)
      const newProfile = await createUserProfile(payload);
      if (!newProfile) {
        return createUnauthorizedResponse('Failed to create user profile');
      }
    }

    // Check account status
    if (userProfile && userProfile.accountLocked) {
      return createUnauthorizedResponse('Account is locked due to security violations');
    }

    // Check session timeout
    const sessionTimeout = userProfile?.sessionTimeoutMinutes || 480; // Default 8 hours
    const lastActivity = userProfile?.lastLoginAt || 0;
    const currentTime = Date.now();
    const sessionExpired = (currentTime - lastActivity) > (sessionTimeout * 60 * 1000);

    if (sessionExpired && userProfile?.lastLoginAt) {
      return createUnauthorizedResponse('Session expired');
    }

    // Update last activity
    if (userProfile) {
      await updateLastActivity(userId);
    }

    // Create auth context
    const authContext: AuthContext = {
      isAuthenticated: true,
      userId: userId,
      userRole: userProfile?.userRole || 'student',
      email: email as string,
      phoneNumber: phoneNumber as string,
      preferredLanguage: userProfile?.preferredLanguage || 'en',
      gritScore: userProfile?.gritScore || 0,
      skillLevel: userProfile?.skillLevel || 1,
      sessionTimeout: sessionTimeout,
      mfaEnabled: userProfile?.mfaEnabled || false,
      lastActivity: currentTime,
    };

    // Return successful authentication response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      },
      body: JSON.stringify({
        message: 'Authentication successful',
        authContext: authContext,
        tokenInfo: {
          sub: payload.sub,
          iss: payload.iss,
          exp: payload.exp,
          iat: payload.iat,
          token_use: payload.token_use,
        },
      }),
    };

  } catch (error) {
    console.error('JWT validation error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error during authentication',
        message: 'Please try again later',
      }),
    };
  }
};

/**
 * Get user profile from DynamoDB
 */
async function getUserProfile(userId: string): Promise<StudentProfile | null> {
  try {
    const command = new GetCommand({
      TableName: STUDENT_PROFILES_TABLE,
      Key: { studentId: userId },
    });

    const result = await docClient.send(command);
    return result.Item as StudentProfile || null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

/**
 * Create new user profile from JWT payload
 */
async function createUserProfile(payload: any): Promise<StudentProfile | null> {
  try {
    const currentTime = Date.now();
    const userRole = payload['custom:userRole'] || 'student';
    
    const profile: StudentProfile = {
      studentId: payload.sub,
      email: payload.email,
      phoneNumber: payload.phone_number,
      givenName: payload.given_name || '',
      familyName: payload.family_name || '',
      userRole: userRole,
      institutionName: payload['custom:institutionName'] || '',
      preferredLanguage: payload['custom:preferredLanguage'] || 'en',
      dataConsentGiven: payload['custom:dataConsentGiven'] || currentTime.toString(),
      aadhaarOptional: payload['custom:aadhaarOptional'] === 'true',
      gritScore: parseInt(payload['custom:gritScore']) || 0,
      skillLevel: parseInt(payload['custom:skillLevel']) || 1,
      createdAt: currentTime,
      updatedAt: currentTime,
      lastLoginAt: currentTime,
      mfaEnabled: false,
      accountLocked: false,
      failedLoginAttempts: 0,
      sessionTimeoutMinutes: userRole === 'recruiter' ? 240 : 480, // 4 hours for recruiters, 8 for students
    };

    const command = new PutCommand({
      TableName: STUDENT_PROFILES_TABLE,
      Item: profile,
    });

    await docClient.send(command);
    console.log('Created new user profile:', { userId: payload.sub, userRole });
    
    return profile;
  } catch (error) {
    console.error('Error creating user profile:', error);
    return null;
  }
}

/**
 * Update user's last activity timestamp
 */
async function updateLastActivity(userId: string): Promise<void> {
  try {
    const command = new UpdateCommand({
      TableName: STUDENT_PROFILES_TABLE,
      Key: { studentId: userId },
      UpdateExpression: 'SET lastLoginAt = :timestamp, updatedAt = :timestamp',
      ExpressionAttributeValues: {
        ':timestamp': Date.now(),
      },
    });

    await docClient.send(command);
  } catch (error) {
    console.error('Error updating last activity:', error);
  }
}

/**
 * Create unauthorized response
 */
function createUnauthorizedResponse(message: string): APIGatewayProxyResult {
  return {
    statusCode: 401,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'WWW-Authenticate': 'Bearer',
    },
    body: JSON.stringify({
      error: 'Unauthorized',
      message: message,
      timestamp: new Date().toISOString(),
    }),
  };
}

/**
 * Validate MFA token (for future implementation)
 */
async function validateMFAToken(userId: string, mfaToken: string): Promise<boolean> {
  // TODO: Implement MFA validation with SMS/TOTP
  // This would integrate with Cognito MFA or a third-party service
  return true;
}

/**
 * Check for suspicious activity patterns
 */
async function checkSuspiciousActivity(userId: string, event: APIGatewayProxyEvent): Promise<boolean> {
  // TODO: Implement suspicious activity detection
  // - Multiple failed login attempts
  // - Login from unusual locations
  // - Rapid API calls
  // - Pattern matching for bot behavior
  return false;
}

/**
 * Log authentication events for audit trail
 */
async function logAuthEvent(userId: string, event: string, details: any): Promise<void> {
  // TODO: Implement audit logging
  // This would log to CloudWatch or a dedicated audit table
  console.log('Auth Event:', {
    userId,
    event,
    details,
    timestamp: new Date().toISOString(),
  });
}