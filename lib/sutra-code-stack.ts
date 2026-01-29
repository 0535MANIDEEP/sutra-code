import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { EncryptionConfig } from './security/encryption-config';

export class SutraCodeStack extends cdk.Stack {
  public learnerSessionsTable: dynamodb.Table;
  public frictionEventsTable: dynamodb.Table;
  public struggleLogsTable: dynamodb.Table;
  public studentProfilesTable: dynamodb.Table;
  public audioStorageBucket: s3.Bucket;
  public kmsKey: kms.Key;
  public api: apigateway.RestApi;
  public userPool: cognito.UserPool;
  public userPoolClient: cognito.UserPoolClient;
  public identityPool: cognito.CfnIdentityPool;
  public authenticatedRole: iam.Role;
  public unauthenticatedRole: iam.Role;
  public lambdaExecutionRole: iam.Role;
  public jwtValidatorLambda: lambda.Function;
  public socraticEngineLambda: lambda.Function;
  public culturalAnalogyLambda: lambda.Function;
  public fadedScaffoldsLambda: lambda.Function;
  public voiceVivaProcessorLambda: lambda.Function;
  public analogyCacheTable: dynamodb.Table;
  public scaffoldCacheTable: dynamodb.Table;
  public v1Resource: apigateway.Resource;
  
  // Security components
  public encryptionConfig: EncryptionConfig;
  public consentManagerLambda: lambda.Function;
  public auditLoggerLambda: lambda.Function;
  public sessionManagerLambda: lambda.Function;
  public serviceIntegrationVerifierLambda: lambda.Function;
  public consentRecordsTable: dynamodb.Table;
  public auditLogTable: dynamodb.Table;
  public securityAlertsTable: dynamodb.Table;
  public userSessionsTable: dynamodb.Table;
  public securityAlertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Initialize encryption configuration for DPDP Act 2023 compliance
    this.encryptionConfig = new EncryptionConfig(this, 'EncryptionConfig');
    this.kmsKey = this.encryptionConfig.kmsKey;

    // Create security infrastructure
    this.createSecurityInfrastructure();

    // Create IAM roles for Lambda functions and users
    this.createIAMRoles();

    // Create Cognito User Pools for authentication
    this.createCognitoUserPools();

    // Create DynamoDB tables with encryption
    this.createDynamoDBTables();

    // Create S3 bucket for audio storage
    this.createS3AudioBucket();

    // Create API Gateway with CORS and rate limiting
    this.createAPIGateway();

    // Create Lambda functions
    this.createLambdaFunctions();

    // Create security Lambda functions
    this.createSecurityLambdaFunctions();

    // Create service integration verifier Lambda function
    this.createServiceIntegrationVerifier();

    // Output important resource ARNs
    this.createOutputs();
  }

  private createSecurityInfrastructure(): void {
    // Create SNS topic for security alerts
    this.securityAlertTopic = new sns.Topic(this, 'SecurityAlertTopic', {
      topicName: 'SutraCode-SecurityAlerts',
      displayName: 'Sutra-Code Security Alerts',
    });

    // Create CloudWatch Log Groups for security logging
    new logs.LogGroup(this, 'ConsentManagerLogGroup', {
      logGroupName: '/aws/lambda/consent-manager',
      retention: logs.RetentionDays.SEVEN_YEARS, // DPDP Act 2023 compliance
      encryptionKey: this.encryptionConfig.auditLogKey,
    });

    new logs.LogGroup(this, 'AuditLoggerLogGroup', {
      logGroupName: '/aws/lambda/audit-logger',
      retention: logs.RetentionDays.SEVEN_YEARS,
      encryptionKey: this.encryptionConfig.auditLogKey,
    });

    new logs.LogGroup(this, 'SessionManagerLogGroup', {
      logGroupName: '/aws/lambda/session-manager',
      retention: logs.RetentionDays.SEVEN_YEARS,
      encryptionKey: this.encryptionConfig.auditLogKey,
    });
  }

  private createIAMRoles(): void {
    // Lambda execution role with least privilege access
    this.lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: 'SutraCode-LambdaExecutionRole',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for Sutra-Code Lambda functions with least privilege access',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
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
              resources: [
                // Will be populated after table creation
                `arn:aws:dynamodb:${this.region}:${this.account}:table/LearnerSessions*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/FrictionEvents*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/StruggleLogs*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/StudentProfiles*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/AnalogyCache*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/ScaffoldCache*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/ConsentRecords*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/AuditLog*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/SecurityAlerts*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/UserSessions*`,
              ],
            }),
          ],
        }),
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:GetObjectVersion',
              ],
              resources: [
                `arn:aws:s3:::sutra-code-audio-${this.account}-${this.region}/*`,
              ],
            }),
          ],
        }),
        KMSAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'kms:Decrypt',
                'kms:Encrypt',
                'kms:GenerateDataKey',
                'kms:DescribeKey',
              ],
              resources: [
                this.encryptionConfig.kmsKey.keyArn,
                this.encryptionConfig.s3EncryptionKey.keyArn,
                this.encryptionConfig.dynamoDbEncryptionKey.keyArn,
                this.encryptionConfig.auditLogKey.keyArn,
              ],
            }),
          ],
        }),
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
              ],
              resources: [
                `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
                `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
              ],
            }),
          ],
        }),
        BhashiniAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'execute-api:Invoke',
              ],
              resources: [
                'arn:aws:execute-api:*:*:*/*/POST/v1/translate',
                'arn:aws:execute-api:*:*:*/*/POST/v1/tts',
                'arn:aws:execute-api:*:*:*/*/POST/v1/asr',
              ],
            }),
          ],
        }),
        SNSAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'sns:Publish',
              ],
              resources: [
                `arn:aws:sns:${this.region}:${this.account}:SutraCode-SecurityAlerts`,
              ],
            }),
          ],
        }),
      },
    });

    // Authenticated user role for students and recruiters
    this.authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      roleName: 'SutraCode-AuthenticatedRole',
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': '', // Will be set after identity pool creation
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: 'Role for authenticated users (students and recruiters)',
      inlinePolicies: {
        APIGatewayAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['execute-api:Invoke'],
              resources: [`arn:aws:execute-api:${this.region}:${this.account}:*/*/GET/*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['execute-api:Invoke'],
              resources: [`arn:aws:execute-api:${this.region}:${this.account}:*/*/POST/*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['execute-api:Invoke'],
              resources: [`arn:aws:execute-api:${this.region}:${this.account}:*/*/PUT/*`],
            }),
          ],
        }),
        S3AudioAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:PutObject',
                's3:GetObject',
              ],
              resources: [
                `arn:aws:s3:::sutra-code-audio-${this.account}-${this.region}/\${cognito-identity.amazonaws.com:sub}/*`,
              ],
            }),
          ],
        }),
      },
    });

    // Unauthenticated role (minimal permissions)
    this.unauthenticatedRole = new iam.Role(this, 'UnauthenticatedRole', {
      roleName: 'SutraCode-UnauthenticatedRole',
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': '', // Will be set after identity pool creation
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: 'Role for unauthenticated users (very limited access)',
      inlinePolicies: {
        LimitedAPIAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['execute-api:Invoke'],
              resources: [
                `arn:aws:execute-api:${this.region}:${this.account}:*/*/GET/v1/health`,
                `arn:aws:execute-api:${this.region}:${this.account}:*/*/POST/v1/auth/signup`,
                `arn:aws:execute-api:${this.region}:${this.account}:*/*/POST/v1/auth/signin`,
              ],
            }),
          ],
        }),
      },
    });
  }

  private createCognitoUserPools(): void {
    // Create User Pool with DPDP Act 2023 compliance and MFA
    this.userPool = new cognito.UserPool(this, 'SutraCodeUserPool', {
      userPoolName: 'SutraCode-UserPool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        phone: true, // Support for Indian mobile numbers
        username: false, // Disable username to simplify UX
      },
      autoVerify: {
        email: true,
        phone: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        phoneNumber: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
        preferredUsername: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        // Custom attributes for DPDP Act 2023 compliance
        userRole: new cognito.StringAttribute({
          mutable: true,
        }),
        institutionName: new cognito.StringAttribute({
          mutable: true,
        }),
        preferredLanguage: new cognito.StringAttribute({
          mutable: true,
        }),
        dataConsentGiven: new cognito.StringAttribute({
          mutable: true,
        }),
        aadhaarOptional: new cognito.StringAttribute({
          mutable: true,
        }),
        gritScore: new cognito.NumberAttribute({
          mutable: true,
          min: 0,
          max: 100,
        }),
        skillLevel: new cognito.NumberAttribute({
          mutable: true,
          min: 1,
          max: 10,
        }),
      },
      passwordPolicy: {
        minLength: 12, // Strong password requirement
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(1), // Temporary passwords expire quickly
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: cognito.Mfa.OPTIONAL, // Allow users to enable MFA
      mfaSecondFactor: {
        sms: true,
        otp: true, // TOTP support
      },
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: true,
      },
      userInvitation: {
        emailSubject: 'Welcome to Sutra-Code - Your Socratic AI Mentor',
        emailBody: `
          <h2>Welcome to Sutra-Code!</h2>
          <p>Your journey from copy-paste to problem-solving starts here.</p>
          <p>Username: {username}</p>
          <p>Temporary Password: {####}</p>
          <p>Please sign in and change your password.</p>
          <p><strong>Data Privacy:</strong> Your learning data is protected under DPDP Act 2023.</p>
        `,
        smsMessage: 'Welcome to Sutra-Code! Username: {username}, Temp Password: {####}',
      },
      userVerification: {
        emailSubject: 'Verify your Sutra-Code account',
        emailBody: 'Please verify your account by clicking: {##Verify Email##}',
        emailStyle: cognito.VerificationEmailStyle.LINK,
        smsMessage: 'Your Sutra-Code verification code: {####}',
      },
      lambdaTriggers: {
        // Pre-signup trigger for custom validation
        preSignUp: undefined, // Will be added later
        // Post-confirmation trigger for profile setup
        postConfirmation: undefined, // Will be added later
        // Pre-authentication trigger for security checks
        preAuthentication: undefined, // Will be added later
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Protect user data
    });

    // Create User Pool Client for web and mobile applications
    this.userPoolClient = new cognito.UserPoolClient(this, 'SutraCodeUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'SutraCode-WebClient',
      generateSecret: false, // Public client for web/mobile apps
      authFlows: {
        userSrp: true, // Secure Remote Password protocol
        userPassword: false, // Disable less secure password flow
        adminUserPassword: false, // Disable admin-initiated auth
        custom: true, // Allow custom authentication flows
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false, // Less secure, disabled
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.PHONE,
        ],
        callbackUrls: [
          'http://localhost:3000/auth/callback', // Development
          'https://sutra-code.edu.in/auth/callback', // Production
        ],
        logoutUrls: [
          'http://localhost:3000/auth/logout', // Development
          'https://sutra-code.edu.in/auth/logout', // Production
        ],
      },
      preventUserExistenceErrors: true, // Security best practice
      refreshTokenValidity: cdk.Duration.days(30), // 30-day refresh token
      accessTokenValidity: cdk.Duration.hours(8), // 8 hours for students
      idTokenValidity: cdk.Duration.hours(8), // 8 hours for students
      enableTokenRevocation: true, // Allow token revocation
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        // Future: Add Google, Facebook for easier signup
      ],
    });

    // Create Identity Pool for AWS resource access
    this.identityPool = new cognito.CfnIdentityPool(this, 'SutraCodeIdentityPool', {
      identityPoolName: 'SutraCode-IdentityPool',
      allowUnauthenticatedIdentities: true, // Allow guest access for demos
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
          serverSideTokenCheck: true, // Validate tokens server-side
        },
      ],
      // Future: Add SAML providers for institutional SSO
    });

    // Attach roles to Identity Pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: this.authenticatedRole.roleArn,
        unauthenticated: this.unauthenticatedRole.roleArn,
      },
      roleMappings: {
        mapping: {
          type: 'Token',
          ambiguousRoleResolution: 'AuthenticatedRole',
          identityProvider: `${this.userPool.userPoolProviderName}:${this.userPoolClient.userPoolClientId}`,
        },
      },
    });

    // Update role trust policies with actual identity pool ID
    const authenticatedRoleTrustPolicy = this.authenticatedRole.assumeRolePolicy as iam.PolicyDocument;
    authenticatedRoleTrustPolicy.addStatements(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.FederatedPrincipal('cognito-identity.amazonaws.com')],
        actions: ['sts:AssumeRoleWithWebIdentity'],
        conditions: {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
      })
    );

    const unauthenticatedRoleTrustPolicy = this.unauthenticatedRole.assumeRolePolicy as iam.PolicyDocument;
    unauthenticatedRoleTrustPolicy.addStatements(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.FederatedPrincipal('cognito-identity.amazonaws.com')],
        actions: ['sts:AssumeRoleWithWebIdentity'],
        conditions: {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
      })
    );

    // Create User Pool Domain for hosted UI
    new cognito.UserPoolDomain(this, 'SutraCodeUserPoolDomain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: `sutra-code-${this.account}`, // Must be globally unique
      },
    });
  }

  private createLambdaFunctions(): void {
    // JWT Validator Lambda function
    this.jwtValidatorLambda = new lambda.Function(this, 'JWTValidatorLambda', {
      functionName: 'SutraCode-JWTValidator',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'jwt-validator.handler',
      code: lambda.Code.fromAsset('lambda/auth'),
      role: this.lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        USER_POOL_ID: this.userPool.userPoolId,
        CLIENT_ID: this.userPoolClient.userPoolClientId,
        STUDENT_PROFILES_TABLE: this.studentProfilesTable.tableName,
        KMS_KEY_ID: this.kmsKey.keyId,
      },
      description: 'JWT token validation middleware for Sutra-Code authentication',
      reservedConcurrentExecutions: 100, // Limit concurrent executions
      deadLetterQueue: new sqs.Queue(this, 'JWTValidatorDLQ', {
        queueName: 'SutraCode-JWTValidator-DLQ',
        retentionPeriod: cdk.Duration.days(14),
      }),
      retryAttempts: 2,
    });

    // Grant permissions to Lambda function
    this.studentProfilesTable.grantReadWriteData(this.jwtValidatorLambda);
    this.kmsKey.grantDecrypt(this.jwtValidatorLambda);

    // Cultural Analogy Generator Lambda function (create first since others depend on it)
    this.culturalAnalogyLambda = new lambda.Function(this, 'CulturalAnalogyLambda', {
      functionName: 'SutraCode-CulturalAnalogyGenerator',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/cultural-analogy-generator'),
      role: this.lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024, // Higher memory for complex analogy generation
      environment: {
        STUDENT_PROFILES_TABLE: this.studentProfilesTable.tableName,
        ANALOGY_CACHE_TABLE: this.analogyCacheTable.tableName,
        KMS_KEY_ID: this.kmsKey.keyId,
      },
      description: 'Cultural Analogy Generator for creating culturally relevant programming analogies',
      reservedConcurrentExecutions: 150, // Moderate limit for analogy generation
      deadLetterQueue: new sqs.Queue(this, 'CulturalAnalogyDLQ', {
        queueName: 'SutraCode-CulturalAnalogy-DLQ',
        retentionPeriod: cdk.Duration.days(14),
      }),
      retryAttempts: 2,
    });

    // Grant permissions to Cultural Analogy Lambda
    this.studentProfilesTable.grantReadData(this.culturalAnalogyLambda);
    this.analogyCacheTable.grantReadWriteData(this.culturalAnalogyLambda);
    this.kmsKey.grantDecrypt(this.culturalAnalogyLambda);

    // Socratic Engine Lambda function
    this.socraticEngineLambda = new lambda.Function(this, 'SocraticEngineLambda', {
      functionName: 'SutraCode-SocraticEngine',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/socratic-engine'),
      role: this.lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512, // Higher memory for Bedrock API calls
      environment: {
        LEARNER_SESSIONS_TABLE: this.learnerSessionsTable.tableName,
        FRICTION_EVENTS_TABLE: this.frictionEventsTable.tableName,
        STUDENT_PROFILES_TABLE: this.studentProfilesTable.tableName,
        CULTURAL_ANALOGY_LAMBDA_NAME: this.culturalAnalogyLambda.functionName,
        KMS_KEY_ID: this.kmsKey.keyId,
      },
      description: 'Core Socratic Engine for generating guided questions and cultural analogies',
      reservedConcurrentExecutions: 200, // Higher limit for core functionality
      deadLetterQueue: new sqs.Queue(this, 'SocraticEngineDLQ', {
        queueName: 'SutraCode-SocraticEngine-DLQ',
        retentionPeriod: cdk.Duration.days(14),
      }),
      retryAttempts: 2,
    });

    // Grant permissions to Socratic Engine Lambda
    this.learnerSessionsTable.grantReadWriteData(this.socraticEngineLambda);
    this.frictionEventsTable.grantReadWriteData(this.socraticEngineLambda);
    this.studentProfilesTable.grantReadWriteData(this.socraticEngineLambda);
    this.kmsKey.grantDecrypt(this.socraticEngineLambda);
    
    // Grant permission to invoke Cultural Analogy Lambda
    this.culturalAnalogyLambda.grantInvoke(this.socraticEngineLambda);

    // Faded Scaffolds Generator Lambda function
    this.fadedScaffoldsLambda = new lambda.Function(this, 'FadedScaffoldsLambda', {
      functionName: 'SutraCode-FadedScaffoldsGenerator',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/faded-scaffolds-generator'),
      role: this.lambdaExecutionRole,
      timeout: cdk.Duration.seconds(60), // Longer timeout for scaffold generation
      memorySize: 1024, // Higher memory for complex scaffold generation
      environment: {
        STUDENT_PROFILES_TABLE: this.studentProfilesTable.tableName,
        STRUGGLE_LOGS_TABLE: this.struggleLogsTable.tableName,
        LEARNER_SESSIONS_TABLE: this.learnerSessionsTable.tableName,
        SCAFFOLD_CACHE_TABLE: this.scaffoldCacheTable.tableName,
        CULTURAL_ANALOGY_LAMBDA_NAME: this.culturalAnalogyLambda.functionName,
        KMS_KEY_ID: this.kmsKey.keyId,
      },
      description: 'Faded Scaffolds Generator for creating strategic fill-in-the-blank code templates',
      reservedConcurrentExecutions: 100, // Moderate limit for scaffold generation
      deadLetterQueue: new sqs.Queue(this, 'FadedScaffoldsDLQ', {
        queueName: 'SutraCode-FadedScaffolds-DLQ',
        retentionPeriod: cdk.Duration.days(14),
      }),
      retryAttempts: 2,
    });

    // Grant permissions to Faded Scaffolds Lambda
    this.studentProfilesTable.grantReadData(this.fadedScaffoldsLambda);
    this.struggleLogsTable.grantReadWriteData(this.fadedScaffoldsLambda);
    this.learnerSessionsTable.grantReadData(this.fadedScaffoldsLambda);
    this.scaffoldCacheTable.grantReadWriteData(this.fadedScaffoldsLambda);
    this.culturalAnalogyLambda.grantInvoke(this.fadedScaffoldsLambda);
    this.kmsKey.grantDecrypt(this.fadedScaffoldsLambda);

    // Voice Viva Processor Lambda function
    this.voiceVivaProcessorLambda = new lambda.Function(this, 'VoiceVivaProcessorLambda', {
      functionName: 'SutraCode-VoiceVivaProcessor',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/voice-viva-processor'),
      role: this.lambdaExecutionRole,
      timeout: cdk.Duration.seconds(60), // Longer timeout for voice processing
      memorySize: 1024, // Higher memory for audio processing and Bhashini API calls
      environment: {
        LEARNER_SESSIONS_TABLE: this.learnerSessionsTable.tableName,
        STUDENT_PROFILES_TABLE: this.studentProfilesTable.tableName,
        STRUGGLE_LOGS_TABLE: this.struggleLogsTable.tableName,
        AUDIO_STORAGE_BUCKET: this.audioStorageBucket.bucketName,
        SOCRATIC_ENGINE_LAMBDA_NAME: this.socraticEngineLambda.functionName,
        BHASHINI_API_KEY: 'placeholder-key', // Will be set via environment or secrets manager
        BHASHINI_BASE_URL: 'https://dhruva-api.bhashini.gov.in/services',
        KMS_KEY_ID: this.kmsKey.keyId,
      },
      description: 'Voice Viva Processor for multilingual voice interactions via Bhashini API',
      reservedConcurrentExecutions: 50, // Limited for voice processing
      deadLetterQueue: new sqs.Queue(this, 'VoiceVivaProcessorDLQ', {
        queueName: 'SutraCode-VoiceVivaProcessor-DLQ',
        retentionPeriod: cdk.Duration.days(14),
      }),
      retryAttempts: 2,
    });

    // Grant permissions to Voice Viva Processor Lambda
    this.learnerSessionsTable.grantReadWriteData(this.voiceVivaProcessorLambda);
    this.studentProfilesTable.grantReadData(this.voiceVivaProcessorLambda);
    this.struggleLogsTable.grantReadWriteData(this.voiceVivaProcessorLambda);
    this.audioStorageBucket.grantReadWrite(this.voiceVivaProcessorLambda);
    this.culturalAnalogyLambda.grantInvoke(this.voiceVivaProcessorLambda);
    this.kmsKey.grantDecrypt(this.voiceVivaProcessorLambda);

    // Add Lambda function to API Gateway
    this.addAuthenticationEndpoints();
    this.addSocraticEngineEndpoints();
    this.addCulturalAnalogyEndpoints();
    this.addFadedScaffoldsEndpoints();
    this.addVoiceVivaEndpoints();
  }

  private createSecurityLambdaFunctions(): void {
    // Consent Manager Lambda function
    this.consentManagerLambda = new lambda.Function(this, 'ConsentManagerLambda', {
      functionName: 'SutraCode-ConsentManager',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/consent-manager'),
      role: this.lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CONSENT_TABLE: this.consentRecordsTable.tableName,
        AUDIT_TABLE: this.auditLogTable.tableName,
        KMS_KEY_ID: this.encryptionConfig.auditLogKey.keyId,
      },
      description: 'DPDP Act 2023 compliant consent management system',
      reservedConcurrentExecutions: 100,
      deadLetterQueue: new sqs.Queue(this, 'ConsentManagerDLQ', {
        queueName: 'SutraCode-ConsentManager-DLQ',
        retentionPeriod: cdk.Duration.days(14),
      }),
      retryAttempts: 2,
    });

    // Grant permissions to Consent Manager Lambda
    this.consentRecordsTable.grantReadWriteData(this.consentManagerLambda);
    this.auditLogTable.grantWriteData(this.consentManagerLambda);
    this.encryptionConfig.auditLogKey.grantEncryptDecrypt(this.consentManagerLambda);

    // Audit Logger Lambda function (DynamoDB Stream processor)
    this.auditLoggerLambda = new lambda.Function(this, 'AuditLoggerLambda', {
      functionName: 'SutraCode-AuditLogger',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/audit-logger'),
      role: this.lambdaExecutionRole,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: {
        AUDIT_TABLE: this.auditLogTable.tableName,
        SECURITY_ALERTS_TABLE: this.securityAlertsTable.tableName,
        ALERT_TOPIC_ARN: this.securityAlertTopic.topicArn,
        KMS_KEY_ID: this.encryptionConfig.auditLogKey.keyId,
      },
      description: 'Comprehensive audit logging for DPDP Act 2023 compliance',
      reservedConcurrentExecutions: 50,
      deadLetterQueue: new sqs.Queue(this, 'AuditLoggerDLQ', {
        queueName: 'SutraCode-AuditLogger-DLQ',
        retentionPeriod: cdk.Duration.days(14),
      }),
      retryAttempts: 2,
    });

    // Grant permissions to Audit Logger Lambda
    this.auditLogTable.grantWriteData(this.auditLoggerLambda);
    this.securityAlertsTable.grantWriteData(this.auditLoggerLambda);
    this.securityAlertTopic.grantPublish(this.auditLoggerLambda);
    this.encryptionConfig.auditLogKey.grantEncryptDecrypt(this.auditLoggerLambda);

    // Grant CloudWatch Logs permissions
    this.auditLoggerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['arn:aws:logs:*:*:*'],
    }));

    // Session Manager Lambda function
    this.sessionManagerLambda = new lambda.Function(this, 'SessionManagerLambda', {
      functionName: 'SutraCode-SessionManager',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/session-manager'),
      role: this.lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        SESSIONS_TABLE: this.userSessionsTable.tableName,
        KMS_KEY_ID: this.encryptionConfig.kmsKey.keyId,
        JWT_SECRET: 'sutra-code-jwt-secret-2024', // Should be from Secrets Manager in production
        SESSION_TIMEOUT: '3600', // 1 hour
        MAX_SESSIONS_PER_USER: '5',
      },
      description: 'Secure session management with DPDP Act 2023 compliance',
      reservedConcurrentExecutions: 200,
      deadLetterQueue: new sqs.Queue(this, 'SessionManagerDLQ', {
        queueName: 'SutraCode-SessionManager-DLQ',
        retentionPeriod: cdk.Duration.days(14),
      }),
      retryAttempts: 2,
    });

    // Grant permissions to Session Manager Lambda
    this.userSessionsTable.grantReadWriteData(this.sessionManagerLambda);
    this.encryptionConfig.kmsKey.grantEncryptDecrypt(this.sessionManagerLambda);

    // Grant Cognito permissions for token validation
    this.sessionManagerLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:GetUser',
        'cognito-idp:AdminGetUser',
      ],
      resources: [this.userPool.userPoolArn],
    }));

    // Connect DynamoDB streams to audit logger
    this.connectStreamsToAuditLogger();

    // Add security endpoints to API Gateway
    this.addSecurityEndpoints();
  }

  private createServiceIntegrationVerifier(): void {
    // Service Integration Verifier Lambda function
    this.serviceIntegrationVerifierLambda = new lambda.Function(this, 'ServiceIntegrationVerifierLambda', {
      functionName: 'SutraCode-ServiceIntegrationVerifier',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/service-integration-verifier'),
      role: this.lambdaExecutionRole,
      timeout: cdk.Duration.seconds(60), // Longer timeout for comprehensive checks
      memorySize: 1024, // Higher memory for multiple service checks
      environment: {
        ALERT_TOPIC_ARN: this.securityAlertTopic.topicArn,
        AUDIO_STORAGE_BUCKET: this.audioStorageBucket.bucketName,
        BHASHINI_BASE_URL: 'https://dhruva-api.bhashini.gov.in/services',
        BHASHINI_API_KEY: 'placeholder-key', // Should be from Secrets Manager in production
        KMS_KEY_ID: this.encryptionConfig.kmsKey.keyId,
      },
      description: 'Service integration verification and health monitoring for all Sutra-Code services',
      reservedConcurrentExecutions: 10, // Limited for monitoring function
      deadLetterQueue: new sqs.Queue(this, 'ServiceIntegrationVerifierDLQ', {
        queueName: 'SutraCode-ServiceIntegrationVerifier-DLQ',
        retentionPeriod: cdk.Duration.days(14),
      }),
      retryAttempts: 2,
    });

    // Grant comprehensive permissions for service verification
    this.serviceIntegrationVerifierLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
      ],
    }));

    this.serviceIntegrationVerifierLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:DescribeTable',
        'dynamodb:ListTables',
      ],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/*`,
      ],
    }));

    this.serviceIntegrationVerifierLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:HeadBucket',
        's3:GetBucketLocation',
      ],
      resources: [
        this.audioStorageBucket.bucketArn,
      ],
    }));

    this.serviceIntegrationVerifierLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:PutMetricData',
      ],
      resources: ['*'],
    }));

    // Grant SNS publish permissions for alerts
    this.securityAlertTopic.grantPublish(this.serviceIntegrationVerifierLambda);

    // Grant KMS permissions
    this.encryptionConfig.kmsKey.grantDecrypt(this.serviceIntegrationVerifierLambda);

    // Add health check endpoints to API Gateway
    this.addHealthCheckEndpoints();
  }

  private connectStreamsToAuditLogger(): void {
    // Connect all DynamoDB table streams to the audit logger
    const tables = [
      this.learnerSessionsTable,
      this.frictionEventsTable,
      this.struggleLogsTable,
      this.studentProfilesTable,
      this.consentRecordsTable,
      this.analogyCacheTable,
      this.scaffoldCacheTable,
    ];

    tables.forEach((table, index) => {
      if (table.tableStreamArn) {
        new lambda.EventSourceMapping(this, `AuditLoggerEventSource${index}`, {
          target: this.auditLoggerLambda,
          eventSourceArn: table.tableStreamArn,
          startingPosition: lambda.StartingPosition.LATEST,
          batchSize: 10,
          maxBatchingWindow: cdk.Duration.seconds(5),
          retryAttempts: 3,
        });
      }
    });
  }

  private addSecurityEndpoints(): void {
    // Create security resource group
    const security = this.v1Resource.addResource('security');

    // Consent management endpoints
    const consent = security.addResource('consent');
    
    // POST /v1/security/consent/grant - Grant consent
    const grantConsent = consent.addResource('grant');
    grantConsent.addMethod('POST', new apigateway.LambdaIntegration(this.consentManagerLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'ConsentGrantAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
    });

    // POST /v1/security/consent/withdraw - Withdraw consent
    const withdrawConsent = consent.addResource('withdraw');
    withdrawConsent.addMethod('POST', new apigateway.LambdaIntegration(this.consentManagerLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'ConsentWithdrawAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
    });

    // POST /v1/security/consent/verify - Verify consent
    const verifyConsent = consent.addResource('verify');
    verifyConsent.addMethod('POST', new apigateway.LambdaIntegration(this.consentManagerLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'ConsentVerifyAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
    });

    // GET /v1/security/consent/student - Get student consents
    const studentConsent = consent.addResource('student');
    studentConsent.addMethod('GET', new apigateway.LambdaIntegration(this.consentManagerLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'ConsentStudentAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
    });

    // Session management endpoints
    const session = security.addResource('session');

    // POST /v1/security/session/create - Create session
    const createSession = session.addResource('create');
    createSession.addMethod('POST', new apigateway.LambdaIntegration(this.sessionManagerLambda), {
      apiKeyRequired: true,
    });

    // POST /v1/security/session/validate - Validate session
    const validateSession = session.addResource('validate');
    validateSession.addMethod('POST', new apigateway.LambdaIntegration(this.sessionManagerLambda), {
      apiKeyRequired: true,
    });

    // POST /v1/security/session/refresh - Refresh session
    const refreshSession = session.addResource('refresh');
    refreshSession.addMethod('POST', new apigateway.LambdaIntegration(this.sessionManagerLambda), {
      apiKeyRequired: true,
    });

    // DELETE /v1/security/session/terminate - Terminate session
    const terminateSession = session.addResource('terminate');
    terminateSession.addMethod('DELETE', new apigateway.LambdaIntegration(this.sessionManagerLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'SessionTerminateAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
    });
  }

  private addHealthCheckEndpoints(): void {
    // Create health check resource group
    const health = this.v1Resource.addResource('health');

    // GET /v1/health/check - Basic health check
    const check = health.addResource('check');
    check.addMethod('GET', new apigateway.LambdaIntegration(this.serviceIntegrationVerifierLambda), {
      apiKeyRequired: false, // Public endpoint for monitoring
      methodResponses: [{
        statusCode: '200',
        responseModels: {
          'application/json': new apigateway.Model(this, 'HealthCheckResponseModel', {
            restApi: this.api,
            contentType: 'application/json',
            schema: {
              type: apigateway.JsonSchemaType.OBJECT,
              properties: {
                overallStatus: { type: apigateway.JsonSchemaType.STRING },
                services: {
                  type: apigateway.JsonSchemaType.ARRAY,
                  items: { type: apigateway.JsonSchemaType.OBJECT }
                },
                timestamp: { type: apigateway.JsonSchemaType.NUMBER },
                recommendations: {
                  type: apigateway.JsonSchemaType.ARRAY,
                  items: { type: apigateway.JsonSchemaType.STRING }
                }
              },
            },
          }),
        },
      }],
    });

    // GET /v1/health/detailed - Detailed health check with performance tests
    const detailed = health.addResource('detailed');
    detailed.addMethod('GET', new apigateway.LambdaIntegration(this.serviceIntegrationVerifierLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'DetailedHealthAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
    });

    // GET /v1/health/recovery - Recovery and graceful degradation tests
    const recovery = health.addResource('recovery');
    recovery.addMethod('GET', new apigateway.LambdaIntegration(this.serviceIntegrationVerifierLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'RecoveryTestAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
    });

    // Create CloudWatch Event Rule for scheduled health checks
    const healthCheckRule = new events.Rule(this, 'HealthCheckSchedule', {
      ruleName: 'SutraCode-HealthCheckSchedule',
      description: 'Scheduled health checks for Sutra-Code services',
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)), // Check every 5 minutes
    });

    // Add Lambda target to the rule
    healthCheckRule.addTarget(new targets.LambdaFunction(this.serviceIntegrationVerifierLambda, {
      event: events.RuleTargetInput.fromObject({
        source: 'scheduled-health-check',
        action: 'health-check'
      })
    }));

    // Grant EventBridge permission to invoke the Lambda
    this.serviceIntegrationVerifierLambda.addPermission('AllowEventBridgeInvoke', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: healthCheckRule.ruleArn,
    });
  }

  private addAuthenticationEndpoints(): void {
    // Create auth resource
    const auth = this.api.root.addResource('auth');
    
    // JWT validation endpoint
    const validate = auth.addResource('validate');
    validate.addMethod('POST', new apigateway.LambdaIntegration(this.jwtValidatorLambda), {
      apiKeyRequired: true,
      requestValidator: new apigateway.RequestValidator(this, 'AuthValidateRequestValidator', {
        restApi: this.api,
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'AuthValidateModel', {
          restApi: this.api,
          contentType: 'application/json',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              token: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'JWT token to validate',
              },
            },
            required: ['token'],
          },
        }),
      },
    });

    // Health check endpoint (no auth required)
    const health = this.api.root.addResource('health');
    health.addMethod('GET', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseTemplates: {
          'application/json': JSON.stringify({
            status: 'healthy',
            service: 'Sutra-Code Authentication Service',
            timestamp: '$context.requestTime',
            region: this.region,
          }),
        },
      }],
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }), {
      methodResponses: [{
        statusCode: '200',
        responseModels: {
          'application/json': apigateway.Model.EMPTY_MODEL,
        },
      }],
    });

    // User profile endpoints
    this.v1Resource = this.api.root.addResource('v1');
    const profiles = this.v1Resource.addResource('profiles');
    const profileById = profiles.addResource('{studentId}');
    
    // GET /v1/profiles/{studentId} - Get user profile
    profileById.addMethod('GET', new apigateway.LambdaIntegration(this.jwtValidatorLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'ProfileAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
    });
  }

  private addSocraticEngineEndpoints(): void {
    // Use the existing v1 resource
    const socratic = this.v1Resource.addResource('socratic');
    
    // POST /v1/socratic/ask - Main Socratic questioning endpoint
    const ask = socratic.addResource('ask');
    ask.addMethod('POST', new apigateway.LambdaIntegration(this.socraticEngineLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'SocraticAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
      requestValidator: new apigateway.RequestValidator(this, 'SocraticAskRequestValidator', {
        restApi: this.api,
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'SocraticAskModel', {
          restApi: this.api,
          contentType: 'application/json',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              studentId: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Student ID',
              },
              sessionId: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Optional session ID for continuing conversation',
              },
              question: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Student question or problem statement',
              },
              language: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Preferred language for response',
              },
            },
            required: ['studentId', 'question'],
          },
        }),
      },
      methodResponses: [{
        statusCode: '200',
        responseModels: {
          'application/json': new apigateway.Model(this, 'SocraticResponseModel', {
            restApi: this.api,
            contentType: 'application/json',
            schema: {
              type: apigateway.JsonSchemaType.OBJECT,
              properties: {
                sessionId: { type: apigateway.JsonSchemaType.STRING },
                culturalAnalogy: { type: apigateway.JsonSchemaType.STRING },
                guidingQuestion: { type: apigateway.JsonSchemaType.STRING },
                hint: { type: apigateway.JsonSchemaType.STRING },
                nextStepIndicator: { type: apigateway.JsonSchemaType.STRING },
                frictionLevel: { type: apigateway.JsonSchemaType.NUMBER },
                conceptualDepth: { type: apigateway.JsonSchemaType.NUMBER },
              },
            },
          }),
        },
      }],
    });

    // GET /v1/socratic/context/{sessionId} - Get conversation context
    const context = socratic.addResource('context');
    const contextById = context.addResource('{sessionId}');
    contextById.addMethod('GET', new apigateway.LambdaIntegration(this.socraticEngineLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'SocraticContextAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
    });
  }

  private addCulturalAnalogyEndpoints(): void {
    // Use the existing v1 resource
    const analogies = this.v1Resource.addResource('analogies');
    
    // POST /v1/analogies/generate - Generate new cultural analogy
    const generate = analogies.addResource('generate');
    generate.addMethod('POST', new apigateway.LambdaIntegration(this.culturalAnalogyLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'AnalogyGenerateAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
      requestValidator: new apigateway.RequestValidator(this, 'AnalogyGenerateRequestValidator', {
        restApi: this.api,
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'AnalogyGenerateModel', {
          restApi: this.api,
          contentType: 'application/json',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              concept: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Programming concept to create analogy for',
              },
              difficulty: {
                type: apigateway.JsonSchemaType.STRING,
                enum: ['beginner', 'intermediate', 'advanced'],
                description: 'Difficulty level for the analogy',
              },
              studentProfile: {
                type: apigateway.JsonSchemaType.OBJECT,
                description: 'Student profile for personalization',
                properties: {
                  studentId: { type: apigateway.JsonSchemaType.STRING },
                  preferredLanguage: { type: apigateway.JsonSchemaType.STRING },
                  skillLevel: { type: apigateway.JsonSchemaType.NUMBER },
                  culturalPreferences: {
                    type: apigateway.JsonSchemaType.ARRAY,
                    items: { type: apigateway.JsonSchemaType.STRING },
                  },
                  regionContext: { type: apigateway.JsonSchemaType.STRING },
                },
                required: ['studentId', 'preferredLanguage', 'skillLevel'],
              },
              language: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Preferred language for the analogy',
              },
            },
            required: ['concept', 'difficulty', 'studentProfile'],
          },
        }),
      },
      methodResponses: [{
        statusCode: '200',
        responseModels: {
          'application/json': new apigateway.Model(this, 'AnalogyResponseModel', {
            restApi: this.api,
            contentType: 'application/json',
            schema: {
              type: apigateway.JsonSchemaType.OBJECT,
              properties: {
                analogy: { type: apigateway.JsonSchemaType.STRING },
                culturalContext: { type: apigateway.JsonSchemaType.STRING },
                conceptMapping: { type: apigateway.JsonSchemaType.OBJECT },
                followUpQuestions: {
                  type: apigateway.JsonSchemaType.ARRAY,
                  items: { type: apigateway.JsonSchemaType.STRING },
                },
                effectiveness: { type: apigateway.JsonSchemaType.NUMBER },
                alternativeAnalogies: {
                  type: apigateway.JsonSchemaType.ARRAY,
                  items: { type: apigateway.JsonSchemaType.STRING },
                },
              },
            },
          }),
        },
      }],
    });

    // GET /v1/analogies/{concept} - Get cached analogies for a concept
    const conceptResource = analogies.addResource('{concept}');
    conceptResource.addMethod('GET', new apigateway.LambdaIntegration(this.culturalAnalogyLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'AnalogyGetAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
    });

    // PUT /v1/analogies/feedback - Update analogy effectiveness
    const feedback = analogies.addResource('feedback');
    feedback.addMethod('PUT', new apigateway.LambdaIntegration(this.culturalAnalogyLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'AnalogyFeedbackAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
      requestValidator: new apigateway.RequestValidator(this, 'AnalogyFeedbackRequestValidator', {
        restApi: this.api,
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'AnalogyFeedbackModel', {
          restApi: this.api,
          contentType: 'application/json',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              analogyId: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'ID of the analogy to update',
              },
              effectiveness: {
                type: apigateway.JsonSchemaType.NUMBER,
                minimum: 0,
                maximum: 1,
                description: 'Effectiveness score between 0 and 1',
              },
              feedback: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Optional feedback text',
              },
            },
            required: ['analogyId', 'effectiveness'],
          },
        }),
      },
    });
  }

  private addFadedScaffoldsEndpoints(): void {
    // Use the existing v1 resource
    const scaffolds = this.v1Resource.addResource('scaffolds');
    
    // POST /v1/scaffolds/generate - Generate new faded scaffold
    const generate = scaffolds.addResource('generate');
    generate.addMethod('POST', new apigateway.LambdaIntegration(this.fadedScaffoldsLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'ScaffoldGenerateAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
      requestValidator: new apigateway.RequestValidator(this, 'ScaffoldGenerateRequestValidator', {
        restApi: this.api,
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'ScaffoldGenerateModel', {
          restApi: this.api,
          contentType: 'application/json',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              concept: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Programming concept to create scaffold for',
              },
              studentLevel: {
                type: apigateway.JsonSchemaType.NUMBER,
                minimum: 1,
                maximum: 10,
                description: 'Student skill level (1-10)',
              },
              language: {
                type: apigateway.JsonSchemaType.STRING,
                enum: ['python', 'javascript', 'java', 'cpp'],
                description: 'Programming language for the scaffold',
              },
              difficulty: {
                type: apigateway.JsonSchemaType.STRING,
                enum: ['beginner', 'intermediate', 'advanced'],
                description: 'Difficulty level for the scaffold',
              },
              studentId: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Student ID for personalization',
              },
              sessionId: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Optional session ID',
              },
              previousAttempts: {
                type: apigateway.JsonSchemaType.ARRAY,
                description: 'Previous scaffold attempts for adaptation',
                items: { type: apigateway.JsonSchemaType.OBJECT },
              },
            },
            required: ['concept', 'studentLevel', 'language', 'studentId'],
          },
        }),
      },
      methodResponses: [{
        statusCode: '200',
        responseModels: {
          'application/json': new apigateway.Model(this, 'ScaffoldResponseModel', {
            restApi: this.api,
            contentType: 'application/json',
            schema: {
              type: apigateway.JsonSchemaType.OBJECT,
              properties: {
                scaffoldId: { type: apigateway.JsonSchemaType.STRING },
                template: { type: apigateway.JsonSchemaType.STRING },
                blanks: {
                  type: apigateway.JsonSchemaType.ARRAY,
                  items: { type: apigateway.JsonSchemaType.OBJECT },
                },
                hints: {
                  type: apigateway.JsonSchemaType.ARRAY,
                  items: { type: apigateway.JsonSchemaType.STRING },
                },
                validationRules: {
                  type: apigateway.JsonSchemaType.ARRAY,
                  items: { type: apigateway.JsonSchemaType.OBJECT },
                },
                completionCriteria: { type: apigateway.JsonSchemaType.OBJECT },
                culturalAnalogy: { type: apigateway.JsonSchemaType.STRING },
                progressTracking: { type: apigateway.JsonSchemaType.OBJECT },
              },
            },
          }),
        },
      }],
    });

    // POST /v1/scaffolds/validate - Validate completed scaffold
    const validate = scaffolds.addResource('validate');
    validate.addMethod('POST', new apigateway.LambdaIntegration(this.fadedScaffoldsLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'ScaffoldValidateAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
      requestValidator: new apigateway.RequestValidator(this, 'ScaffoldValidateRequestValidator', {
        restApi: this.api,
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'ScaffoldValidateModel', {
          restApi: this.api,
          contentType: 'application/json',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              scaffoldId: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'ID of the scaffold to validate',
              },
              studentId: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Student ID',
              },
              completedCode: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Completed code with filled blanks',
              },
              blanksCompleted: {
                type: apigateway.JsonSchemaType.OBJECT,
                description: 'Map of blank IDs to completed values',
              },
            },
            required: ['scaffoldId', 'studentId', 'completedCode'],
          },
        }),
      },
    });

    // GET /v1/scaffolds/{scaffoldId} - Get scaffold by ID
    const scaffoldById = scaffolds.addResource('{scaffoldId}');
    scaffoldById.addMethod('GET', new apigateway.LambdaIntegration(this.fadedScaffoldsLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'ScaffoldGetAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
    });

    // PUT /v1/scaffolds/progress - Update scaffold progress
    const progress = scaffolds.addResource('progress');
    progress.addMethod('PUT', new apigateway.LambdaIntegration(this.fadedScaffoldsLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'ScaffoldProgressAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
      requestValidator: new apigateway.RequestValidator(this, 'ScaffoldProgressRequestValidator', {
        restApi: this.api,
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'ScaffoldProgressModel', {
          restApi: this.api,
          contentType: 'application/json',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              studentId: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Student ID',
              },
              scaffoldId: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Scaffold ID',
              },
              blankId: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Blank ID being worked on',
              },
              attemptedValue: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Value attempted by student',
              },
              timeSpent: {
                type: apigateway.JsonSchemaType.NUMBER,
                description: 'Time spent on this blank in milliseconds',
              },
            },
            required: ['studentId', 'scaffoldId', 'blankId'],
          },
        }),
      },
    });
  }

  private addVoiceVivaEndpoints(): void {
    // Use the existing v1 resource
    const voiceViva = this.v1Resource.addResource('voice-viva');
    
    // POST /v1/voice-viva/action - Main Voice Viva action endpoint
    const action = voiceViva.addResource('action');
    action.addMethod('POST', new apigateway.LambdaIntegration(this.voiceVivaProcessorLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'VoiceVivaActionAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
      requestValidator: new apigateway.RequestValidator(this, 'VoiceVivaActionRequestValidator', {
        restApi: this.api,
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'VoiceVivaActionModel', {
          restApi: this.api,
          contentType: 'application/json',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              studentId: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Student ID',
              },
              sessionId: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Optional session ID for continuing viva',
              },
              action: {
                type: apigateway.JsonSchemaType.STRING,
                enum: ['start', 'process_audio', 'get_question', 'submit_response', 'get_results'],
                description: 'Action to perform',
              },
              audioData: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Base64 encoded audio data (for process_audio action)',
              },
              audioFormat: {
                type: apigateway.JsonSchemaType.STRING,
                enum: ['wav', 'mp3', 'webm'],
                description: 'Audio format',
              },
              language: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Preferred language for voice interaction',
              },
              concept: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Programming concept for viva (for start action)',
              },
              scaffoldCompletion: {
                type: apigateway.JsonSchemaType.NUMBER,
                minimum: 0,
                maximum: 100,
                description: 'Scaffold completion percentage',
              },
            },
            required: ['studentId', 'action'],
          },
        }),
      },
      methodResponses: [{
        statusCode: '200',
        responseModels: {
          'application/json': new apigateway.Model(this, 'VoiceVivaActionResponseModel', {
            restApi: this.api,
            contentType: 'application/json',
            schema: {
              type: apigateway.JsonSchemaType.OBJECT,
              properties: {
                sessionId: { type: apigateway.JsonSchemaType.STRING },
                vivaId: { type: apigateway.JsonSchemaType.STRING },
                status: { 
                  type: apigateway.JsonSchemaType.STRING,
                  enum: ['started', 'in_progress', 'completed', 'failed'],
                },
                currentQuestion: { type: apigateway.JsonSchemaType.OBJECT },
                questionNumber: { type: apigateway.JsonSchemaType.NUMBER },
                totalQuestions: { type: apigateway.JsonSchemaType.NUMBER },
                audioUrl: { type: apigateway.JsonSchemaType.STRING },
                transcription: { type: apigateway.JsonSchemaType.STRING },
                score: { type: apigateway.JsonSchemaType.NUMBER },
                feedback: { type: apigateway.JsonSchemaType.STRING },
                nextAction: { type: apigateway.JsonSchemaType.STRING },
                timeRemaining: { type: apigateway.JsonSchemaType.NUMBER },
                canProceed: { type: apigateway.JsonSchemaType.BOOLEAN },
                error: { type: apigateway.JsonSchemaType.STRING },
              },
            },
          }),
        },
      }],
    });

    // GET /v1/voice-viva/status/{sessionId} - Get viva session status
    const status = voiceViva.addResource('status');
    const statusBySession = status.addResource('{sessionId}');
    statusBySession.addMethod('GET', new apigateway.LambdaIntegration(this.voiceVivaProcessorLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'VoiceVivaStatusAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
    });

    // PUT /v1/voice-viva/session - Update viva session (pause, extend time, etc.)
    const session = voiceViva.addResource('session');
    session.addMethod('PUT', new apigateway.LambdaIntegration(this.voiceVivaProcessorLambda), {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, 'VoiceVivaSessionAuthorizer', {
        cognitoUserPools: [this.userPool],
      }),
      requestValidator: new apigateway.RequestValidator(this, 'VoiceVivaSessionRequestValidator', {
        restApi: this.api,
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'VoiceVivaSessionModel', {
          restApi: this.api,
          contentType: 'application/json',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              sessionId: {
                type: apigateway.JsonSchemaType.STRING,
                description: 'Session ID to update',
              },
              action: {
                type: apigateway.JsonSchemaType.STRING,
                enum: ['pause', 'resume', 'extend_time', 'cancel'],
                description: 'Update action to perform',
              },
              extensionMinutes: {
                type: apigateway.JsonSchemaType.NUMBER,
                minimum: 1,
                maximum: 10,
                description: 'Minutes to extend (for extend_time action)',
              },
            },
            required: ['sessionId', 'action'],
          },
        }),
      },
    });
  }

  private createDynamoDBTables(): void {
    // LearnerSessions table - stores active learning sessions and conversation state
    this.learnerSessionsTable = new dynamodb.Table(this, 'LearnerSessionsTable', {
      tableName: 'LearnerSessions',
      partitionKey: {
        name: 'sessionId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionConfig.dynamoDbEncryptionKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Protect learning data
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // For real-time analytics
    });

    // Add GSI for querying by studentId
    this.learnerSessionsTable.addGlobalSecondaryIndex({
      indexName: 'StudentIdIndex',
      partitionKey: {
        name: 'studentId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // FrictionEvents table - tracks Socratic friction moments and learning resistance
    this.frictionEventsTable = new dynamodb.Table(this, 'FrictionEventsTable', {
      tableName: 'FrictionEvents',
      partitionKey: {
        name: 'eventId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionConfig.dynamoDbEncryptionKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Add GSI for querying friction events by student and session
    this.frictionEventsTable.addGlobalSecondaryIndex({
      indexName: 'StudentSessionIndex',
      partitionKey: {
        name: 'studentId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sessionId',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // StruggleLogs table - comprehensive tracking of student learning struggles and grit metrics
    this.struggleLogsTable = new dynamodb.Table(this, 'StruggleLogsTable', {
      tableName: 'StruggleLogs',
      partitionKey: {
        name: 'logId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionConfig.dynamoDbEncryptionKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Add GSI for grit score analytics
    this.struggleLogsTable.addGlobalSecondaryIndex({
      indexName: 'StudentGritIndex',
      partitionKey: {
        name: 'studentId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'gritScore',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // StudentProfiles table - stores student information and learning preferences
    this.studentProfilesTable = new dynamodb.Table(this, 'StudentProfilesTable', {
      tableName: 'StudentProfiles',
      partitionKey: {
        name: 'studentId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionConfig.dynamoDbEncryptionKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Add GSI for querying by email (for authentication)
    this.studentProfilesTable.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: {
        name: 'email',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Add GSI for recruiter dashboard filtering
    this.studentProfilesTable.addGlobalSecondaryIndex({
      indexName: 'SkillLevelIndex',
      partitionKey: {
        name: 'skillLevel',
        type: dynamodb.AttributeType.NUMBER,
      },
      sortKey: {
        name: 'gritScore',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // AnalogyCache table - stores generated cultural analogies for reuse and effectiveness tracking
    this.analogyCacheTable = new dynamodb.Table(this, 'AnalogyCacheTable', {
      tableName: 'AnalogyCache',
      partitionKey: {
        name: 'analogyId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionConfig.dynamoDbEncryptionKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Add GSI for querying by concept and difficulty
    this.analogyCacheTable.addGlobalSecondaryIndex({
      indexName: 'ConceptDifficultyIndex',
      partitionKey: {
        name: 'concept',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'difficulty',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Add GSI for querying by concept only
    this.analogyCacheTable.addGlobalSecondaryIndex({
      indexName: 'ConceptIndex',
      partitionKey: {
        name: 'concept',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // Add GSI for effectiveness tracking
    this.analogyCacheTable.addGlobalSecondaryIndex({
      indexName: 'EffectivenessIndex',
      partitionKey: {
        name: 'culturalContext',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'effectiveness',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // ScaffoldCache table - stores generated faded scaffolds for reuse and effectiveness tracking
    this.scaffoldCacheTable = new dynamodb.Table(this, 'ScaffoldCacheTable', {
      tableName: 'ScaffoldCache',
      partitionKey: {
        name: 'scaffoldId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionConfig.dynamoDbEncryptionKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Add GSI for querying by concept and language
    this.scaffoldCacheTable.addGlobalSecondaryIndex({
      indexName: 'ConceptLanguageIndex',
      partitionKey: {
        name: 'concept',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'language',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Add GSI for querying by concept only
    this.scaffoldCacheTable.addGlobalSecondaryIndex({
      indexName: 'ConceptIndex',
      partitionKey: {
        name: 'concept',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // Add GSI for effectiveness tracking
    this.scaffoldCacheTable.addGlobalSecondaryIndex({
      indexName: 'EffectivenessIndex',
      partitionKey: {
        name: 'language',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'effectiveness',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // Security Tables for DPDP Act 2023 compliance

    // ConsentRecords table - stores user consent for data sharing
    this.consentRecordsTable = new dynamodb.Table(this, 'ConsentRecordsTable', {
      tableName: 'ConsentRecords',
      partitionKey: {
        name: 'studentId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'consentId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionConfig.auditLogKey, // Use audit key for consent data
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Critical for compliance
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Add GSI for querying by recipient
    this.consentRecordsTable.addGlobalSecondaryIndex({
      indexName: 'RecipientIndex',
      partitionKey: {
        name: 'recipientId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'consentTimestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // AuditLog table - comprehensive audit trail for DPDP compliance
    this.auditLogTable = new dynamodb.Table(this, 'AuditLogTable', {
      tableName: 'AuditLog',
      partitionKey: {
        name: 'auditId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionConfig.auditLogKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Add GSI for querying by student ID
    this.auditLogTable.addGlobalSecondaryIndex({
      indexName: 'StudentAuditIndex',
      partitionKey: {
        name: 'studentId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // Add GSI for querying by event type
    this.auditLogTable.addGlobalSecondaryIndex({
      indexName: 'EventTypeIndex',
      partitionKey: {
        name: 'eventType',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // SecurityAlerts table - stores security alerts and incidents
    this.securityAlertsTable = new dynamodb.Table(this, 'SecurityAlertsTable', {
      tableName: 'SecurityAlerts',
      partitionKey: {
        name: 'alertId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionConfig.auditLogKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for querying by severity
    this.securityAlertsTable.addGlobalSecondaryIndex({
      indexName: 'SeverityIndex',
      partitionKey: {
        name: 'severity',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // UserSessions table - secure session management
    this.userSessionsTable = new dynamodb.Table(this, 'UserSessionsTable', {
      tableName: 'UserSessions',
      partitionKey: {
        name: 'sessionId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionConfig.kmsKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Sessions can be recreated
      timeToLiveAttribute: 'expiresAt', // Automatic cleanup of expired sessions
    });

    // Add GSI for querying by user ID
    this.userSessionsTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.NUMBER,
      },
    });
  }

  private createS3AudioBucket(): void {
    // S3 bucket for voice recordings with encryption and lifecycle policies
    this.audioStorageBucket = new s3.Bucket(this, 'AudioStorageBucket', {
      bucketName: `sutra-code-audio-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionConfig.s3EncryptionKey,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Protect voice data
      lifecycleRules: [
        {
          id: 'VoiceRecordingLifecycle',
          enabled: true,
          // Move to IA after 30 days (less frequent access)
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          // Delete after 7 years (compliance with data retention policies)
          expiration: cdk.Duration.days(2555), // ~7 years
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // Will be restricted in production
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // Configure additional security settings using the encryption config
    this.encryptionConfig.configureS3Encryption(this.audioStorageBucket);

    // Add bucket notification for processing uploaded audio files
    // This will be used later for automatic transcription and analysis
  }

  private createAPIGateway(): void {
    // Create API Gateway with CORS and rate limiting
    this.api = new apigateway.RestApi(this, 'SutraCodeAPI', {
      restApiName: 'Sutra-Code Socratic AI Mentor API',
      description: 'API for the Sutra-Code Socratic AI Mentor system',
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Will be restricted in production
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
          'X-Student-Id',
          'X-Session-Id',
        ],
      },
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['*'],
            conditions: {
              IpAddress: {
                'aws:SourceIp': [
                  '0.0.0.0/0', // Will be restricted to Indian IP ranges in production
                ],
              },
            },
          }),
        ],
      }),
    });

    // Create API key for rate limiting per user
    const apiKey = new apigateway.ApiKey(this, 'SutraCodeAPIKey', {
      apiKeyName: 'sutra-code-api-key',
      description: 'API key for Sutra-Code client applications',
    });

    // Create usage plan with rate limiting
    const usagePlan = new apigateway.UsagePlan(this, 'SutraCodeUsagePlan', {
      name: 'sutra-code-usage-plan',
      description: 'Usage plan for Sutra-Code API with rate limiting',
      throttle: {
        rateLimit: 100, // 100 requests per minute per user
        burstLimit: 200,
      },
      quota: {
        limit: 10000, // 10,000 requests per month per user
        period: apigateway.Period.MONTH,
      },
      apiStages: [
        {
          api: this.api,
          stage: this.api.deploymentStage,
        },
      ],
    });

    // Associate API key with usage plan
    usagePlan.addApiKey(apiKey);

    // Configure throttling using CfnStage
    const cfnStage = this.api.deploymentStage.node.defaultChild as apigateway.CfnStage;
    cfnStage.addPropertyOverride('ThrottleSettings', {
      RateLimit: 100, // 100 requests per minute per user
      BurstLimit: 200,
    });

    // Create resource structure for the API will be done in individual endpoint methods
  }

  private createOutputs(): void {
    // Output important resource information for other stacks and applications
    new cdk.CfnOutput(this, 'KMSKeyId', {
      value: this.kmsKey.keyId,
      description: 'KMS Key ID for Sutra-Code encryption',
      exportName: 'SutraCode-KMSKeyId',
    });

    new cdk.CfnOutput(this, 'KMSKeyArn', {
      value: this.kmsKey.keyArn,
      description: 'KMS Key ARN for Sutra-Code encryption',
      exportName: 'SutraCode-KMSKeyArn',
    });

    new cdk.CfnOutput(this, 'LearnerSessionsTableName', {
      value: this.learnerSessionsTable.tableName,
      description: 'DynamoDB table name for learner sessions',
      exportName: 'SutraCode-LearnerSessionsTable',
    });

    new cdk.CfnOutput(this, 'FrictionEventsTableName', {
      value: this.frictionEventsTable.tableName,
      description: 'DynamoDB table name for friction events',
      exportName: 'SutraCode-FrictionEventsTable',
    });

    new cdk.CfnOutput(this, 'StruggleLogsTableName', {
      value: this.struggleLogsTable.tableName,
      description: 'DynamoDB table name for struggle logs',
      exportName: 'SutraCode-StruggleLogsTable',
    });

    new cdk.CfnOutput(this, 'StudentProfilesTableName', {
      value: this.studentProfilesTable.tableName,
      description: 'DynamoDB table name for student profiles',
      exportName: 'SutraCode-StudentProfilesTable',
    });

    new cdk.CfnOutput(this, 'AudioStorageBucketName', {
      value: this.audioStorageBucket.bucketName,
      description: 'S3 bucket name for audio storage',
      exportName: 'SutraCode-AudioStorageBucket',
    });

    new cdk.CfnOutput(this, 'AudioStorageBucketArn', {
      value: this.audioStorageBucket.bucketArn,
      description: 'S3 bucket ARN for audio storage',
      exportName: 'SutraCode-AudioStorageBucketArn',
    });

    new cdk.CfnOutput(this, 'APIGatewayId', {
      value: this.api.restApiId,
      description: 'API Gateway ID for Sutra-Code API',
      exportName: 'SutraCode-APIGatewayId',
    });

    new cdk.CfnOutput(this, 'APIGatewayURL', {
      value: this.api.url,
      description: 'API Gateway URL for Sutra-Code API',
      exportName: 'SutraCode-APIGatewayURL',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region (ap-south-1 for DPDP compliance)',
      exportName: 'SutraCode-Region',
    });

    // Authentication outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'SutraCode-UserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'SutraCode-UserPoolClientId',
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      description: 'Cognito Identity Pool ID',
      exportName: 'SutraCode-IdentityPoolId',
    });

    new cdk.CfnOutput(this, 'AuthenticatedRoleArn', {
      value: this.authenticatedRole.roleArn,
      description: 'IAM Role ARN for authenticated users',
      exportName: 'SutraCode-AuthenticatedRoleArn',
    });

    new cdk.CfnOutput(this, 'JWTValidatorLambdaArn', {
      value: this.jwtValidatorLambda.functionArn,
      description: 'JWT Validator Lambda Function ARN',
      exportName: 'SutraCode-JWTValidatorLambdaArn',
    });

    new cdk.CfnOutput(this, 'SocraticEngineLambdaArn', {
      value: this.socraticEngineLambda.functionArn,
      description: 'Socratic Engine Lambda Function ARN',
      exportName: 'SutraCode-SocraticEngineLambdaArn',
    });

    new cdk.CfnOutput(this, 'CulturalAnalogyLambdaArn', {
      value: this.culturalAnalogyLambda.functionArn,
      description: 'Cultural Analogy Generator Lambda Function ARN',
      exportName: 'SutraCode-CulturalAnalogyLambdaArn',
    });

    new cdk.CfnOutput(this, 'AnalogyCacheTableName', {
      value: this.analogyCacheTable.tableName,
      description: 'DynamoDB table name for analogy cache',
      exportName: 'SutraCode-AnalogyCacheTable',
    });

    new cdk.CfnOutput(this, 'ScaffoldCacheTableName', {
      value: this.scaffoldCacheTable.tableName,
      description: 'DynamoDB table name for scaffold cache',
      exportName: 'SutraCode-ScaffoldCacheTable',
    });

    new cdk.CfnOutput(this, 'FadedScaffoldsLambdaArn', {
      value: this.fadedScaffoldsLambda.functionArn,
      description: 'Faded Scaffolds Generator Lambda Function ARN',
      exportName: 'SutraCode-FadedScaffoldsLambdaArn',
    });

    new cdk.CfnOutput(this, 'VoiceVivaProcessorLambdaArn', {
      value: this.voiceVivaProcessorLambda.functionArn,
      description: 'Voice Viva Processor Lambda Function ARN',
      exportName: 'SutraCode-VoiceVivaProcessorLambdaArn',
    });

    // Security component outputs
    new cdk.CfnOutput(this, 'ConsentManagerLambdaArn', {
      value: this.consentManagerLambda.functionArn,
      description: 'Consent Manager Lambda Function ARN',
      exportName: 'SutraCode-ConsentManagerLambdaArn',
    });

    new cdk.CfnOutput(this, 'AuditLoggerLambdaArn', {
      value: this.auditLoggerLambda.functionArn,
      description: 'Audit Logger Lambda Function ARN',
      exportName: 'SutraCode-AuditLoggerLambdaArn',
    });

    new cdk.CfnOutput(this, 'SessionManagerLambdaArn', {
      value: this.sessionManagerLambda.functionArn,
      description: 'Session Manager Lambda Function ARN',
      exportName: 'SutraCode-SessionManagerLambdaArn',
    });

    new cdk.CfnOutput(this, 'ServiceIntegrationVerifierLambdaArn', {
      value: this.serviceIntegrationVerifierLambda.functionArn,
      description: 'Service Integration Verifier Lambda Function ARN',
      exportName: 'SutraCode-ServiceIntegrationVerifierLambdaArn',
    });

    new cdk.CfnOutput(this, 'ConsentRecordsTableName', {
      value: this.consentRecordsTable.tableName,
      description: 'DynamoDB table name for consent records',
      exportName: 'SutraCode-ConsentRecordsTable',
    });

    new cdk.CfnOutput(this, 'AuditLogTableName', {
      value: this.auditLogTable.tableName,
      description: 'DynamoDB table name for audit logs',
      exportName: 'SutraCode-AuditLogTable',
    });

    new cdk.CfnOutput(this, 'SecurityAlertsTableName', {
      value: this.securityAlertsTable.tableName,
      description: 'DynamoDB table name for security alerts',
      exportName: 'SutraCode-SecurityAlertsTable',
    });

    new cdk.CfnOutput(this, 'UserSessionsTableName', {
      value: this.userSessionsTable.tableName,
      description: 'DynamoDB table name for user sessions',
      exportName: 'SutraCode-UserSessionsTable',
    });

    new cdk.CfnOutput(this, 'SecurityAlertTopicArn', {
      value: this.securityAlertTopic.topicArn,
      description: 'SNS topic ARN for security alerts',
      exportName: 'SutraCode-SecurityAlertTopicArn',
    });

    // Encryption keys outputs
    new cdk.CfnOutput(this, 'S3EncryptionKeyArn', {
      value: this.encryptionConfig.s3EncryptionKey.keyArn,
      description: 'S3 encryption key ARN',
      exportName: 'SutraCode-S3EncryptionKeyArn',
    });

    new cdk.CfnOutput(this, 'DynamoDbEncryptionKeyArn', {
      value: this.encryptionConfig.dynamoDbEncryptionKey.keyArn,
      description: 'DynamoDB encryption key ARN',
      exportName: 'SutraCode-DynamoDbEncryptionKeyArn',
    });

    new cdk.CfnOutput(this, 'AuditLogKeyArn', {
      value: this.encryptionConfig.auditLogKey.keyArn,
      description: 'Audit log encryption key ARN',
      exportName: 'SutraCode-AuditLogKeyArn',
    });
  }
}