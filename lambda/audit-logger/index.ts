import { DynamoDBStreamEvent, DynamoDBStreamHandler, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CloudWatchLogsClient, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { KMSClient, EncryptCommand } from '@aws-sdk/client-kms';

/**
 * Audit Logger Lambda Function
 * Implements comprehensive audit logging for DPDP Act 2023 compliance
 * Tracks all data access and modifications in the Sutra-Code system
 */

interface AuditEvent {
  auditId: string;
  timestamp: number;
  eventType: 'CREATE' | 'UPDATE' | 'DELETE' | 'ACCESS';
  tableName: string;
  recordId: string;
  studentId?: string;
  recruiterId?: string;
  dataCategory: string;
  action: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  compliance: 'DPDP_ACT_2023';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  encryptedData?: string;
}

interface SecurityAlert {
  alertId: string;
  timestamp: number;
  alertType: 'UNAUTHORIZED_ACCESS' | 'DATA_BREACH' | 'CONSENT_VIOLATION' | 'SUSPICIOUS_ACTIVITY';
  severity: 'HIGH' | 'CRITICAL';
  description: string;
  affectedStudentId?: string;
  sourceIp?: string;
  details: any;
}

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const logsClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION });
const snsClient = new SNSClient({ region: process.env.AWS_REGION });
const kmsClient = new KMSClient({ region: process.env.AWS_REGION });

const AUDIT_TABLE = process.env.AUDIT_TABLE || 'AuditLog';
const SECURITY_ALERTS_TABLE = process.env.SECURITY_ALERTS_TABLE || 'SecurityAlerts';
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN || '';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';

/**
 * Encrypt sensitive audit data
 */
async function encryptAuditData(data: any): Promise<string> {
  try {
    const command = new EncryptCommand({
      KeyId: KMS_KEY_ID,
      Plaintext: Buffer.from(JSON.stringify(data), 'utf-8'),
      EncryptionContext: {
        purpose: 'audit-data-encryption',
        compliance: 'DPDP-ACT-2023',
        timestamp: Date.now().toString(),
      },
    });

    const result = await kmsClient.send(command);
    return Buffer.from(result.CiphertextBlob!).toString('base64');
  } catch (error) {
    console.error('Audit data encryption failed:', error);
    throw new Error('Failed to encrypt audit data');
  }
}

/**
 * Determine data category based on table name and data content
 */
function determineDataCategory(tableName: string, data: any): string {
  const tableCategories: { [key: string]: string } = {
    'LearnerSessions': 'learning_data',
    'FrictionEvents': 'interaction_data',
    'StruggleLogs': 'performance_data',
    'StudentProfiles': 'personal_data',
    'VoiceRecordings': 'biometric_data',
    'ConsentRecords': 'consent_data',
    'PortfolioData': 'portfolio_data',
  };

  return tableCategories[tableName] || 'system_data';
}

/**
 * Determine event severity based on data type and operation
 */
function determineSeverity(eventType: string, dataCategory: string, tableName: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  // Critical: Personal data modifications, consent changes
  if (dataCategory === 'personal_data' || dataCategory === 'consent_data') {
    return 'CRITICAL';
  }

  // High: Biometric data, portfolio data
  if (dataCategory === 'biometric_data' || dataCategory === 'portfolio_data') {
    return 'HIGH';
  }

  // Medium: Learning and performance data
  if (dataCategory === 'learning_data' || dataCategory === 'performance_data') {
    return 'MEDIUM';
  }

  // Low: System data, interaction data
  return 'LOW';
}

/**
 * Create audit event from DynamoDB stream record
 */
async function createAuditEvent(record: any): Promise<AuditEvent> {
  const auditId = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = Date.now();
  const tableName = record.eventSourceARN.split('/')[1];
  const eventType = record.eventName as 'INSERT' | 'MODIFY' | 'REMOVE';
  
  // Map DynamoDB event types to audit event types
  const eventTypeMap: { [key: string]: 'CREATE' | 'UPDATE' | 'DELETE' | 'ACCESS' } = {
    'INSERT': 'CREATE',
    'MODIFY': 'UPDATE',
    'REMOVE': 'DELETE',
  };

  const dataCategory = determineDataCategory(tableName, record.dynamodb);
  const severity = determineSeverity(eventType, dataCategory, tableName);

  // Extract student ID from the record if available
  let studentId: string | undefined;
  let recordId = 'unknown';

  if (record.dynamodb.Keys) {
    recordId = JSON.stringify(record.dynamodb.Keys);
    
    // Try to extract studentId from various possible key structures
    if (record.dynamodb.Keys.studentId) {
      studentId = record.dynamodb.Keys.studentId.S;
    } else if (record.dynamodb.Keys.userId) {
      studentId = record.dynamodb.Keys.userId.S;
    } else if (record.dynamodb.NewImage?.studentId) {
      studentId = record.dynamodb.NewImage.studentId.S;
    }
  }

  const auditEvent: AuditEvent = {
    auditId,
    timestamp,
    eventType: eventTypeMap[eventType] || 'ACCESS',
    tableName,
    recordId,
    studentId,
    dataCategory,
    action: `${eventType}_${tableName}`,
    compliance: 'DPDP_ACT_2023',
    severity,
  };

  // Include old and new values for UPDATE events (encrypted)
  if (eventType === 'MODIFY') {
    const sensitiveData = {
      oldValues: record.dynamodb.OldImage,
      newValues: record.dynamodb.NewImage,
    };
    auditEvent.encryptedData = await encryptAuditData(sensitiveData);
  } else if (eventType === 'INSERT') {
    const sensitiveData = {
      newValues: record.dynamodb.NewImage,
    };
    auditEvent.encryptedData = await encryptAuditData(sensitiveData);
  } else if (eventType === 'REMOVE') {
    const sensitiveData = {
      oldValues: record.dynamodb.OldImage,
    };
    auditEvent.encryptedData = await encryptAuditData(sensitiveData);
  }

  return auditEvent;
}

/**
 * Store audit event in DynamoDB
 */
async function storeAuditEvent(auditEvent: AuditEvent): Promise<void> {
  try {
    await docClient.send(new PutCommand({
      TableName: AUDIT_TABLE,
      Item: auditEvent,
    }));
  } catch (error) {
    console.error('Failed to store audit event:', error);
    throw error;
  }
}

/**
 * Send audit event to CloudWatch Logs
 */
async function sendToCloudWatchLogs(auditEvent: AuditEvent): Promise<void> {
  try {
    const logGroupName = `/aws/lambda/audit-logger`;
    const logStreamName = `audit-${new Date().toISOString().split('T')[0]}`;

    await logsClient.send(new PutLogEventsCommand({
      logGroupName,
      logStreamName,
      logEvents: [{
        timestamp: auditEvent.timestamp,
        message: JSON.stringify({
          auditId: auditEvent.auditId,
          eventType: auditEvent.eventType,
          tableName: auditEvent.tableName,
          studentId: auditEvent.studentId,
          dataCategory: auditEvent.dataCategory,
          severity: auditEvent.severity,
          compliance: auditEvent.compliance,
        }),
      }],
    }));
  } catch (error) {
    console.error('Failed to send to CloudWatch Logs:', error);
    // Don't throw - CloudWatch logging failure shouldn't break audit storage
  }
}

/**
 * Detect and handle security anomalies
 */
async function detectSecurityAnomalies(auditEvent: AuditEvent): Promise<void> {
  const alerts: SecurityAlert[] = [];

  // Check for suspicious patterns
  if (auditEvent.severity === 'CRITICAL' && auditEvent.eventType === 'DELETE') {
    alerts.push({
      alertId: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      alertType: 'SUSPICIOUS_ACTIVITY',
      severity: 'HIGH',
      description: `Critical data deletion detected in ${auditEvent.tableName}`,
      affectedStudentId: auditEvent.studentId,
      details: {
        auditId: auditEvent.auditId,
        tableName: auditEvent.tableName,
        dataCategory: auditEvent.dataCategory,
      },
    });
  }

  // Check for consent violations (accessing data without valid consent)
  if (auditEvent.dataCategory === 'personal_data' && auditEvent.recruiterId && !auditEvent.studentId) {
    alerts.push({
      alertId: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      alertType: 'CONSENT_VIOLATION',
      severity: 'CRITICAL',
      description: 'Potential consent violation: Recruiter accessing data without student context',
      details: {
        auditId: auditEvent.auditId,
        recruiterId: auditEvent.recruiterId,
        tableName: auditEvent.tableName,
      },
    });
  }

  // Store and notify about alerts
  for (const alert of alerts) {
    try {
      // Store alert
      await docClient.send(new PutCommand({
        TableName: SECURITY_ALERTS_TABLE,
        Item: alert,
      }));

      // Send SNS notification for critical alerts
      if (alert.severity === 'CRITICAL' && ALERT_TOPIC_ARN) {
        await snsClient.send(new PublishCommand({
          TopicArn: ALERT_TOPIC_ARN,
          Subject: `CRITICAL Security Alert - ${alert.alertType}`,
          Message: JSON.stringify(alert, null, 2),
        }));
      }
    } catch (error) {
      console.error('Failed to handle security alert:', error);
    }
  }
}

/**
 * Main DynamoDB Stream handler
 */
export const handler: DynamoDBStreamHandler = async (
  event: DynamoDBStreamEvent,
  context: Context
): Promise<void> => {
  console.log(`Processing ${event.Records.length} DynamoDB stream records`);

  for (const record of event.Records) {
    try {
      // Create audit event
      const auditEvent = await createAuditEvent(record);

      // Store audit event
      await storeAuditEvent(auditEvent);

      // Send to CloudWatch Logs for real-time monitoring
      await sendToCloudWatchLogs(auditEvent);

      // Detect security anomalies
      await detectSecurityAnomalies(auditEvent);

      console.log(`Processed audit event: ${auditEvent.auditId}`);
    } catch (error) {
      console.error('Failed to process audit record:', error);
      // Continue processing other records even if one fails
    }
  }

  console.log('Audit logging completed');
};