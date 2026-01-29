import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { CloudWatchLogsClient, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

/**
 * Consent Manager Lambda Function
 * Implements DPDP Act 2023 compliant consent management system
 * Handles granular consent for data sharing with recruiters
 */

interface ConsentRecord {
  studentId: string;
  consentId: string;
  consentType: 'data_sharing' | 'voice_recording' | 'learning_analytics' | 'portfolio_access';
  purpose: string;
  dataCategories: string[];
  recipientType: 'recruiter' | 'institution' | 'research';
  recipientId?: string;
  consentGiven: boolean;
  consentTimestamp: number;
  expiryTimestamp?: number;
  withdrawalTimestamp?: number;
  ipAddress: string;
  userAgent: string;
  consentVersion: string;
  dataRetentionPeriod: number; // in days
  encryptedConsent?: string;
}

interface ConsentRequest {
  studentId: string;
  consentType: string;
  purpose: string;
  dataCategories: string[];
  recipientType: string;
  recipientId?: string;
  retentionPeriod?: number;
}

interface ConsentWithdrawal {
  studentId: string;
  consentId: string;
  reason?: string;
}

interface ConsentVerification {
  studentId: string;
  recipientId: string;
  dataCategory: string;
  purpose: string;
}

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const kmsClient = new KMSClient({ region: process.env.AWS_REGION });
const logsClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION });

const CONSENT_TABLE = process.env.CONSENT_TABLE || 'ConsentRecords';
const AUDIT_TABLE = process.env.AUDIT_TABLE || 'ConsentAuditLog';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';
const CONSENT_VERSION = '1.0.0';

/**
 * Audit logging for DPDP Act 2023 compliance
 */
async function auditLog(
  action: string,
  studentId: string,
  details: any,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  const auditRecord = {
    auditId: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    action,
    studentId,
    details: JSON.stringify(details),
    ipAddress,
    userAgent,
    compliance: 'DPDP_ACT_2023',
  };

  try {
    await docClient.send(new PutCommand({
      TableName: AUDIT_TABLE,
      Item: auditRecord,
    }));

    // Also log to CloudWatch for real-time monitoring
    await logsClient.send(new PutLogEventsCommand({
      logGroupName: '/aws/lambda/consent-manager',
      logStreamName: `consent-audit-${new Date().toISOString().split('T')[0]}`,
      logEvents: [{
        timestamp: Date.now(),
        message: JSON.stringify(auditRecord),
      }],
    }));
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit failure shouldn't break consent operations
  }
}

/**
 * Encrypt sensitive consent data
 */
async function encryptConsentData(data: string): Promise<string> {
  try {
    const command = new EncryptCommand({
      KeyId: KMS_KEY_ID,
      Plaintext: Buffer.from(data, 'utf-8'),
      EncryptionContext: {
        purpose: 'consent-data-encryption',
        compliance: 'DPDP-ACT-2023',
      },
    });

    const result = await kmsClient.send(command);
    return Buffer.from(result.CiphertextBlob!).toString('base64');
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt consent data');
  }
}

/**
 * Decrypt sensitive consent data
 */
async function decryptConsentData(encryptedData: string): Promise<string> {
  try {
    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedData, 'base64'),
      EncryptionContext: {
        purpose: 'consent-data-encryption',
        compliance: 'DPDP-ACT-2023',
      },
    });

    const result = await kmsClient.send(command);
    return Buffer.from(result.Plaintext!).toString('utf-8');
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt consent data');
  }
}

/**
 * Grant consent for data sharing
 */
async function grantConsent(
  request: ConsentRequest,
  ipAddress: string,
  userAgent: string
): Promise<ConsentRecord> {
  const consentId = `consent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = Date.now();
  
  // Default retention period based on DPDP Act 2023
  const retentionPeriod = request.retentionPeriod || 2555; // 7 years default
  const expiryTimestamp = timestamp + (retentionPeriod * 24 * 60 * 60 * 1000);

  const consentRecord: ConsentRecord = {
    studentId: request.studentId,
    consentId,
    consentType: request.consentType as any,
    purpose: request.purpose,
    dataCategories: request.dataCategories,
    recipientType: request.recipientType as any,
    recipientId: request.recipientId,
    consentGiven: true,
    consentTimestamp: timestamp,
    expiryTimestamp,
    ipAddress,
    userAgent,
    consentVersion: CONSENT_VERSION,
    dataRetentionPeriod: retentionPeriod,
  };

  // Encrypt sensitive consent details
  const sensitiveData = JSON.stringify({
    purpose: request.purpose,
    dataCategories: request.dataCategories,
    recipientId: request.recipientId,
  });
  consentRecord.encryptedConsent = await encryptConsentData(sensitiveData);

  // Store consent record
  await docClient.send(new PutCommand({
    TableName: CONSENT_TABLE,
    Item: consentRecord,
  }));

  // Audit log
  await auditLog(
    'CONSENT_GRANTED',
    request.studentId,
    {
      consentId,
      consentType: request.consentType,
      recipientType: request.recipientType,
      recipientId: request.recipientId,
      dataCategories: request.dataCategories,
    },
    ipAddress,
    userAgent
  );

  return consentRecord;
}

/**
 * Withdraw consent
 */
async function withdrawConsent(
  withdrawal: ConsentWithdrawal,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  const timestamp = Date.now();

  // Update consent record to mark as withdrawn
  await docClient.send(new UpdateCommand({
    TableName: CONSENT_TABLE,
    Key: {
      studentId: withdrawal.studentId,
      consentId: withdrawal.consentId,
    },
    UpdateExpression: 'SET consentGiven = :false, withdrawalTimestamp = :timestamp',
    ExpressionAttributeValues: {
      ':false': false,
      ':timestamp': timestamp,
    },
  }));

  // Audit log
  await auditLog(
    'CONSENT_WITHDRAWN',
    withdrawal.studentId,
    {
      consentId: withdrawal.consentId,
      reason: withdrawal.reason,
    },
    ipAddress,
    userAgent
  );
}

/**
 * Verify consent for data access
 */
async function verifyConsent(verification: ConsentVerification): Promise<boolean> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: CONSENT_TABLE,
      KeyConditionExpression: 'studentId = :studentId',
      FilterExpression: 'consentGiven = :true AND recipientId = :recipientId AND contains(dataCategories, :dataCategory)',
      ExpressionAttributeValues: {
        ':studentId': verification.studentId,
        ':true': true,
        ':recipientId': verification.recipientId,
        ':dataCategory': verification.dataCategory,
      },
    }));

    if (!result.Items || result.Items.length === 0) {
      return false;
    }

    // Check if consent is still valid (not expired)
    const currentTime = Date.now();
    const validConsents = result.Items.filter(item => {
      const consent = item as ConsentRecord;
      return !consent.expiryTimestamp || consent.expiryTimestamp > currentTime;
    });

    return validConsents.length > 0;
  } catch (error) {
    console.error('Consent verification failed:', error);
    return false; // Fail secure - deny access if verification fails
  }
}

/**
 * Get all consents for a student
 */
async function getStudentConsents(studentId: string): Promise<ConsentRecord[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: CONSENT_TABLE,
      KeyConditionExpression: 'studentId = :studentId',
      ExpressionAttributeValues: {
        ':studentId': studentId,
      },
    }));

    return (result.Items || []) as ConsentRecord[];
  } catch (error) {
    console.error('Failed to retrieve consents:', error);
    throw new Error('Failed to retrieve consent records');
  }
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

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: '',
      };
    }

    switch (`${method} ${path}`) {
      case 'POST /consent/grant':
        const consentRecord = await grantConsent(body as ConsentRequest, ipAddress, userAgent);
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({
            success: true,
            consentId: consentRecord.consentId,
            message: 'Consent granted successfully',
          }),
        };

      case 'POST /consent/withdraw':
        await withdrawConsent(body as ConsentWithdrawal, ipAddress, userAgent);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Consent withdrawn successfully',
          }),
        };

      case 'POST /consent/verify':
        const isValid = await verifyConsent(body as ConsentVerification);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            consentValid: isValid,
          }),
        };

      case 'GET /consent/student':
        const studentId = event.queryStringParameters?.studentId;
        if (!studentId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Student ID is required',
            }),
          };
        }

        const consents = await getStudentConsents(studentId);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            consents,
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
    console.error('Consent manager error:', error);
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