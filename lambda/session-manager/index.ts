import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { CognitoIdentityProviderClient, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

/**
 * Secure Session Manager Lambda Function
 * Implements DPDP Act 2023 compliant session management
 * Handles secure authentication flows with proper session management
 */

interface SessionData {
  sessionId: string;
  userId: string;
  userType: 'student' | 'recruiter' | 'admin';
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
  ipAddress: string;
  userAgent: string;
  mfaVerified: boolean;
  permissions: string[];
  encryptedData?: string;
  refreshToken?: string;
  deviceFingerprint?: string;
}

interface AuthenticationRequest {
  accessToken: string;
  refreshToken?: string;
  deviceFingerprint?: string;
}

interface SessionValidation {
  sessionId: string;
  requiredPermissions?: string[];
}

interface MFAChallenge {
  sessionId: string;
  challengeType: 'SMS' | 'EMAIL' | 'TOTP';
  challengeCode: string;
}

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const kmsClient = new KMSClient({ region: process.env.AWS_REGION });
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'UserSessions';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT || '3600'); // 1 hour
const MAX_SESSIONS_PER_USER = parseInt(process.env.MAX_SESSIONS_PER_USER || '5');

/**
 * Generate secure session ID
 */
function generateSessionId(): string {
  return `session-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Generate device fingerprint from request headers
 */
function generateDeviceFingerprint(userAgent: string, acceptLanguage: string, acceptEncoding: string): string {
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${userAgent}|${acceptLanguage}|${acceptEncoding}`)
    .digest('hex');
  return fingerprint.substring(0, 32);
}

/**
 * Encrypt sensitive session data
 */
async function encryptSessionData(data: any): Promise<string> {
  try {
    const command = new EncryptCommand({
      KeyId: KMS_KEY_ID,
      Plaintext: Buffer.from(JSON.stringify(data), 'utf-8'),
      EncryptionContext: {
        purpose: 'session-data-encryption',
        compliance: 'DPDP-ACT-2023',
      },
    });

    const result = await kmsClient.send(command);
    return Buffer.from(result.CiphertextBlob!).toString('base64');
  } catch (error) {
    console.error('Session data encryption failed:', error);
    throw new Error('Failed to encrypt session data');
  }
}

/**
 * Decrypt sensitive session data
 */
async function decryptSessionData(encryptedData: string): Promise<any> {
  try {
    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedData, 'base64'),
      EncryptionContext: {
        purpose: 'session-data-encryption',
        compliance: 'DPDP-ACT-2023',
      },
    });

    const result = await kmsClient.send(command);
    return JSON.parse(Buffer.from(result.Plaintext!).toString('utf-8'));
  } catch (error) {
    console.error('Session data decryption failed:', error);
    throw new Error('Failed to decrypt session data');
  }
}

/**
 * Validate Cognito access token and extract user information
 */
async function validateCognitoToken(accessToken: string): Promise<any> {
  try {
    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    const result = await cognitoClient.send(command);
    
    // Extract user attributes
    const attributes: { [key: string]: string } = {};
    result.UserAttributes?.forEach(attr => {
      if (attr.Name && attr.Value) {
        attributes[attr.Name] = attr.Value;
      }
    });

    return {
      userId: result.Username,
      email: attributes['email'],
      userType: attributes['custom:user_type'] || 'student',
      mfaEnabled: result.MFAOptions && result.MFAOptions.length > 0,
      attributes,
    };
  } catch (error) {
    console.error('Cognito token validation failed:', error);
    throw new Error('Invalid access token');
  }
}

/**
 * Determine user permissions based on user type and attributes
 */
function determinePermissions(userType: string, attributes: any): string[] {
  const basePermissions = ['read_own_data', 'update_own_profile'];
  
  switch (userType) {
    case 'student':
      return [
        ...basePermissions,
        'access_learning_content',
        'submit_assignments',
        'view_own_progress',
        'manage_own_consent',
      ];
    
    case 'recruiter':
      return [
        ...basePermissions,
        'view_student_portfolios',
        'search_students',
        'access_analytics',
        'export_data',
      ];
    
    case 'admin':
      return [
        ...basePermissions,
        'manage_users',
        'view_all_data',
        'system_configuration',
        'audit_access',
      ];
    
    default:
      return basePermissions;
  }
}

/**
 * Create new session
 */
async function createSession(
  authRequest: AuthenticationRequest,
  ipAddress: string,
  userAgent: string,
  acceptLanguage: string,
  acceptEncoding: string
): Promise<SessionData> {
  // Validate Cognito token
  const userInfo = await validateCognitoToken(authRequest.accessToken);
  
  const sessionId = generateSessionId();
  const currentTime = Date.now();
  const expiresAt = currentTime + (SESSION_TIMEOUT * 1000);
  const deviceFingerprint = generateDeviceFingerprint(userAgent, acceptLanguage, acceptEncoding);
  
  // Determine permissions
  const permissions = determinePermissions(userInfo.userType, userInfo.attributes);
  
  // Create session data
  const sessionData: SessionData = {
    sessionId,
    userId: userInfo.userId,
    userType: userInfo.userType,
    createdAt: currentTime,
    lastAccessedAt: currentTime,
    expiresAt,
    ipAddress,
    userAgent,
    mfaVerified: !userInfo.mfaEnabled, // If MFA not enabled, consider it verified
    permissions,
    deviceFingerprint,
  };

  // Encrypt sensitive data
  const sensitiveData = {
    email: userInfo.email,
    attributes: userInfo.attributes,
    refreshToken: authRequest.refreshToken,
  };
  sessionData.encryptedData = await encryptSessionData(sensitiveData);

  // Store session
  await docClient.send(new PutCommand({
    TableName: SESSIONS_TABLE,
    Item: sessionData,
    ConditionExpression: 'attribute_not_exists(sessionId)', // Prevent overwrites
  }));

  return sessionData;
}

/**
 * Validate existing session
 */
async function validateSession(validation: SessionValidation): Promise<SessionData | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId: validation.sessionId },
    }));

    if (!result.Item) {
      return null;
    }

    const session = result.Item as SessionData;
    const currentTime = Date.now();

    // Check if session is expired
    if (session.expiresAt < currentTime) {
      // Clean up expired session
      await docClient.send(new DeleteCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId: validation.sessionId },
      }));
      return null;
    }

    // Check required permissions
    if (validation.requiredPermissions) {
      const hasAllPermissions = validation.requiredPermissions.every(
        permission => session.permissions.includes(permission)
      );
      if (!hasAllPermissions) {
        throw new Error('Insufficient permissions');
      }
    }

    // Update last accessed time
    await docClient.send(new UpdateCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId: validation.sessionId },
      UpdateExpression: 'SET lastAccessedAt = :timestamp',
      ExpressionAttributeValues: {
        ':timestamp': currentTime,
      },
    }));

    return session;
  } catch (error) {
    console.error('Session validation failed:', error);
    return null;
  }
}

/**
 * Refresh session (extend expiry)
 */
async function refreshSession(sessionId: string): Promise<SessionData | null> {
  try {
    const currentTime = Date.now();
    const newExpiresAt = currentTime + (SESSION_TIMEOUT * 1000);

    await docClient.send(new UpdateCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId },
      UpdateExpression: 'SET expiresAt = :expiresAt, lastAccessedAt = :timestamp',
      ExpressionAttributeValues: {
        ':expiresAt': newExpiresAt,
        ':timestamp': currentTime,
      },
      ConditionExpression: 'attribute_exists(sessionId) AND expiresAt > :currentTime',
      ExpressionAttributeValues: {
        ':expiresAt': newExpiresAt,
        ':timestamp': currentTime,
        ':currentTime': currentTime,
      },
    }));

    // Return updated session
    const result = await docClient.send(new GetCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId },
    }));

    return result.Item as SessionData || null;
  } catch (error) {
    console.error('Session refresh failed:', error);
    return null;
  }
}

/**
 * Terminate session
 */
async function terminateSession(sessionId: string): Promise<void> {
  try {
    await docClient.send(new DeleteCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId },
    }));
  } catch (error) {
    console.error('Session termination failed:', error);
    throw new Error('Failed to terminate session');
  }
}

/**
 * Generate JWT token for client-side session management
 */
function generateJWTToken(sessionData: SessionData): string {
  const payload = {
    sessionId: sessionData.sessionId,
    userId: sessionData.userId,
    userType: sessionData.userType,
    permissions: sessionData.permissions,
    expiresAt: sessionData.expiresAt,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: SESSION_TIMEOUT,
    issuer: 'sutra-code-system',
    audience: 'sutra-code-client',
  });
}

/**
 * Main Lambda handler
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  };

  try {
    const method = event.httpMethod;
    const path = event.path;
    const body = event.body ? JSON.parse(event.body) : {};
    const ipAddress = event.requestContext.identity.sourceIp || 'unknown';
    const userAgent = event.headers['User-Agent'] || 'unknown';
    const acceptLanguage = event.headers['Accept-Language'] || 'en-US';
    const acceptEncoding = event.headers['Accept-Encoding'] || 'gzip';

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: '',
      };
    }

    switch (`${method} ${path}`) {
      case 'POST /session/create':
        const sessionData = await createSession(
          body as AuthenticationRequest,
          ipAddress,
          userAgent,
          acceptLanguage,
          acceptEncoding
        );
        
        const jwtToken = generateJWTToken(sessionData);
        
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({
            success: true,
            sessionId: sessionData.sessionId,
            token: jwtToken,
            expiresAt: sessionData.expiresAt,
            userType: sessionData.userType,
            permissions: sessionData.permissions,
          }),
        };

      case 'POST /session/validate':
        const validSession = await validateSession(body as SessionValidation);
        
        if (!validSession) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Invalid or expired session',
            }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            session: {
              sessionId: validSession.sessionId,
              userId: validSession.userId,
              userType: validSession.userType,
              permissions: validSession.permissions,
              expiresAt: validSession.expiresAt,
              mfaVerified: validSession.mfaVerified,
            },
          }),
        };

      case 'POST /session/refresh':
        const refreshedSession = await refreshSession(body.sessionId);
        
        if (!refreshedSession) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Session not found or expired',
            }),
          };
        }

        const newJwtToken = generateJWTToken(refreshedSession);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            token: newJwtToken,
            expiresAt: refreshedSession.expiresAt,
          }),
        };

      case 'DELETE /session/terminate':
        await terminateSession(body.sessionId);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Session terminated successfully',
          }),
        };

      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Endpoint not found',
          }),
        };
    }
  } catch (error) {
    console.error('Session manager error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};