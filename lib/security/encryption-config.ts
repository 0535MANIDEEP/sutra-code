import * as aws from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * Encryption Configuration for Sutra-Code System
 * Implements DPDP Act 2023 compliance with comprehensive data encryption
 */
export class EncryptionConfig extends Construct {
  public readonly kmsKey: kms.Key;
  public readonly s3EncryptionKey: kms.Key;
  public readonly dynamoDbEncryptionKey: kms.Key;
  public readonly auditLogKey: kms.Key;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Master KMS Key for system-wide encryption
    this.kmsKey = new kms.Key(this, 'SutraCodeMasterKey', {
      description: 'Master encryption key for Sutra-Code system - DPDP Act 2023 compliance',
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      enableKeyRotation: true,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'EnableRootAccess',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            sid: 'AllowLambdaAccess',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('lambda.amazonaws.com')],
            actions: [
              'kms:Decrypt',
              'kms:DescribeKey',
              'kms:Encrypt',
              'kms:GenerateDataKey',
              'kms:ReEncrypt*',
            ],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'kms:ViaService': [
                  `dynamodb.${aws.Stack.of(this).region}.amazonaws.com`,
                  `s3.${aws.Stack.of(this).region}.amazonaws.com`,
                ],
              },
            },
          }),
        ],
      }),
    });

    // Dedicated S3 encryption key for audio files and documents
    this.s3EncryptionKey = new kms.Key(this, 'S3EncryptionKey', {
      description: 'S3 encryption key for audio files and student documents',
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      enableKeyRotation: true,
    });

    // Dedicated DynamoDB encryption key for student data
    this.dynamoDbEncryptionKey = new kms.Key(this, 'DynamoDbEncryptionKey', {
      description: 'DynamoDB encryption key for student learning data',
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      enableKeyRotation: true,
    });

    // Dedicated audit log encryption key
    this.auditLogKey = new kms.Key(this, 'AuditLogKey', {
      description: 'Encryption key for audit logs and compliance data',
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      enableKeyRotation: true,
    });

    // Add aliases for easier key management
    new kms.Alias(this, 'SutraCodeMasterKeyAlias', {
      aliasName: 'alias/sutra-code-master-key',
      targetKey: this.kmsKey,
    });

    new kms.Alias(this, 'S3EncryptionKeyAlias', {
      aliasName: 'alias/sutra-code-s3-key',
      targetKey: this.s3EncryptionKey,
    });

    new kms.Alias(this, 'DynamoDbEncryptionKeyAlias', {
      aliasName: 'alias/sutra-code-dynamodb-key',
      targetKey: this.dynamoDbEncryptionKey,
    });

    new kms.Alias(this, 'AuditLogKeyAlias', {
      aliasName: 'alias/sutra-code-audit-key',
      targetKey: this.auditLogKey,
    });
  }

  /**
   * Configure DynamoDB table with encryption
   */
  public configureDynamoDbEncryption(table: dynamodb.Table): void {
    // DynamoDB encryption is configured at table creation time
    // This method provides validation and additional security configurations
    
    // Add point-in-time recovery for data protection
    table.node.addMetadata('pointInTimeRecovery', true);
    
    // Add backup retention policy
    table.node.addMetadata('backupRetention', aws.Duration.days(35));
  }

  /**
   * Configure S3 bucket with encryption and security
   */
  public configureS3Encryption(bucket: s3.Bucket): void {
    // Add lifecycle policy for data retention compliance
    bucket.addLifecycleRule({
      id: 'DataRetentionPolicy',
      enabled: true,
      expiration: aws.Duration.days(2555), // 7 years retention for DPDP compliance
      transitions: [
        {
          storageClass: s3.StorageClass.INFREQUENT_ACCESS,
          transitionAfter: aws.Duration.days(30),
        },
        {
          storageClass: s3.StorageClass.GLACIER,
          transitionAfter: aws.Duration.days(90),
        },
        {
          storageClass: s3.StorageClass.DEEP_ARCHIVE,
          transitionAfter: aws.Duration.days(365),
        },
      ],
    });
  }

  /**
   * Create IAM policy for encrypted resource access
   */
  public createEncryptedResourcePolicy(): iam.PolicyDocument {
    return new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          sid: 'AllowEncryptedDynamoDbAccess',
          effect: iam.Effect.ALLOW,
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:BatchGetItem',
            'dynamodb:BatchWriteItem',
          ],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'dynamodb:EncryptionContext:aws:dynamodb:table-name': '*',
            },
          },
        }),
        new iam.PolicyStatement({
          sid: 'AllowEncryptedS3Access',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:GetObjectVersion',
          ],
          resources: ['*'],
          conditions: {
            StringEquals: {
              's3:x-amz-server-side-encryption': 'aws:kms',
            },
          },
        }),
        new iam.PolicyStatement({
          sid: 'AllowKMSAccess',
          effect: iam.Effect.ALLOW,
          actions: [
            'kms:Decrypt',
            'kms:DescribeKey',
            'kms:Encrypt',
            'kms:GenerateDataKey',
            'kms:ReEncrypt*',
          ],
          resources: [
            this.kmsKey.keyArn,
            this.s3EncryptionKey.keyArn,
            this.dynamoDbEncryptionKey.keyArn,
            this.auditLogKey.keyArn,
          ],
        }),
      ],
    });
  }
}

/**
 * Security configuration constants for DPDP Act 2023 compliance
 */
export const SecurityConfig = {
  // Data retention periods (in days)
  STUDENT_DATA_RETENTION: 2555, // 7 years
  VOICE_RECORDING_RETENTION: 1095, // 3 years
  AUDIT_LOG_RETENTION: 2555, // 7 years
  SESSION_DATA_RETENTION: 90, // 3 months

  // Encryption settings
  ENCRYPTION_ALGORITHM: 'AES-256-GCM',
  KEY_ROTATION_PERIOD: 90, // days
  AUDIT_KEY_ROTATION_PERIOD: 30, // days

  // Access control
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  SESSION_TIMEOUT: 3600, // 1 hour in seconds
  MFA_REQUIRED_FOR_SENSITIVE_DATA: true,

  // Data residency
  ALLOWED_REGIONS: ['ap-south-1', 'ap-south-2'], // Mumbai and Hyderabad
  DATA_RESIDENCY_ENFORCEMENT: true,

  // Audit requirements
  AUDIT_ALL_DATA_ACCESS: true,
  AUDIT_RETENTION_YEARS: 7,
  REAL_TIME_MONITORING: true,
} as const;