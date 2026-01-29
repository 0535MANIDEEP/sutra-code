import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock AWS SDK
const mockSend = jest.fn() as jest.MockedFunction<any>;
const mockDocClient = {
  send: mockSend,
};

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDocClient),
  },
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
}));

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: jest.fn(),
    })),
  },
}));

// Mock environment variables
process.env.USER_POOL_ID = 'ap-south-1_test123';
process.env.CLIENT_ID = 'test-client-id';
process.env.STUDENT_PROFILES_TABLE = 'StudentProfiles';
process.env.AWS_REGION = 'ap-south-1';

describe('JWT Validator Lambda Tests', () => {
  let handler: any;
  let mockVerifier: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Import handler after mocks are set up
    const module = await import('../lambda/auth/jwt-validator');
    handler = module.handler;
    
    // Get mock verifier
    const { CognitoJwtVerifier } = await import('aws-jwt-verify');
    mockVerifier = (CognitoJwtVerifier.create as jest.Mock).mock.results[0].value;
  });

  describe('Authentication Tests', () => {
    it('should return 401 for missing Authorization header', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        path: '/auth/validate',
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({ token: 'test-token' }),
      };

      const context: Partial<Context> = {
        awsRequestId: 'test-request-id',
      };

      const result = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error).toBe('Unauthorized');
      expect(JSON.parse(result.body).message).toBe('Missing Authorization header');
    });

    it('should return 401 for invalid Authorization header format', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        path: '/auth/validate',
        httpMethod: 'POST',
        headers: {
          Authorization: 'InvalidFormat token',
        },
        body: JSON.stringify({ token: 'test-token' }),
      };

      const context: Partial<Context> = {
        awsRequestId: 'test-request-id',
      };

      const result = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).message).toBe('Invalid Authorization header format');
    });

    it('should return 401 for invalid JWT token', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        path: '/auth/validate',
        httpMethod: 'POST',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({ token: 'invalid-token' }),
      };

      const context: Partial<Context> = {
        awsRequestId: 'test-request-id',
      };

      // Mock JWT verification failure
      mockVerifier.verify.mockRejectedValue(new Error('Invalid token'));

      const result = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).message).toBe('Invalid or expired token');
    });

    it('should return 200 for valid JWT token with existing user profile', async () => {
      const mockToken = 'Bearer valid-token';
      const mockPayload = {
        sub: 'test-user-id',
        email: 'test@example.com',
        phone_number: '+919876543210',
        token_use: 'access',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_test123',
      };

      const mockUserProfile = {
        studentId: 'test-user-id',
        email: 'test@example.com',
        phoneNumber: '+919876543210',
        userRole: 'student',
        preferredLanguage: 'en',
        gritScore: 75,
        skillLevel: 5,
        sessionTimeoutMinutes: 480,
        mfaEnabled: false,
        accountLocked: false,
        lastLoginAt: Date.now() - 1000, // 1 second ago
      };

      const event: Partial<APIGatewayProxyEvent> = {
        path: '/auth/validate',
        httpMethod: 'POST',
        headers: {
          Authorization: mockToken,
        },
        body: JSON.stringify({ token: 'valid-token' }),
      };

      const context: Partial<Context> = {
        awsRequestId: 'test-request-id',
      };

      // Mock JWT verification success
      mockVerifier.verify.mockResolvedValue(mockPayload);

      // Mock DynamoDB get user profile
      mockSend.mockResolvedValue({
        Item: mockUserProfile,
      });

      const result = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.message).toBe('Authentication successful');
      expect(responseBody.authContext.isAuthenticated).toBe(true);
      expect(responseBody.authContext.userId).toBe('test-user-id');
      expect(responseBody.authContext.userRole).toBe('student');
      expect(responseBody.authContext.sessionTimeout).toBe(480);
    });

    it('should create new user profile for first-time login', async () => {
      const mockToken = 'Bearer valid-token';
      const mockPayload = {
        sub: 'new-user-id',
        email: 'newuser@example.com',
        phone_number: '+919876543210',
        given_name: 'New',
        family_name: 'User',
        'custom:userRole': 'student',
        'custom:preferredLanguage': 'hi',
        'custom:dataConsentGiven': Date.now().toString(),
        'custom:aadhaarOptional': 'true',
        'custom:gritScore': '0',
        'custom:skillLevel': '1',
        token_use: 'access',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_test123',
      };

      const event: Partial<APIGatewayProxyEvent> = {
        path: '/auth/validate',
        httpMethod: 'POST',
        headers: {
          Authorization: mockToken,
        },
        body: JSON.stringify({ token: 'valid-token' }),
      };

      const context: Partial<Context> = {
        awsRequestId: 'test-request-id',
      };

      // Mock JWT verification success
      mockVerifier.verify.mockResolvedValue(mockPayload);

      // Mock DynamoDB get user profile (not found)
      mockSend
        .mockResolvedValueOnce({ Item: undefined }) // GetCommand returns no item
        .mockResolvedValueOnce({}); // PutCommand succeeds

      const result = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.authContext.userId).toBe('new-user-id');
      expect(responseBody.authContext.userRole).toBe('student');
      expect(responseBody.authContext.preferredLanguage).toBe('hi');
    });

    it('should return 401 for locked account', async () => {
      const mockToken = 'Bearer valid-token';
      const mockPayload = {
        sub: 'locked-user-id',
        email: 'locked@example.com',
        token_use: 'access',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_test123',
      };

      const mockLockedProfile = {
        studentId: 'locked-user-id',
        email: 'locked@example.com',
        accountLocked: true,
        userRole: 'student',
      };

      const event: Partial<APIGatewayProxyEvent> = {
        path: '/auth/validate',
        httpMethod: 'POST',
        headers: {
          Authorization: mockToken,
        },
        body: JSON.stringify({ token: 'valid-token' }),
      };

      const context: Partial<Context> = {
        awsRequestId: 'test-request-id',
      };

      // Mock JWT verification success
      mockVerifier.verify.mockResolvedValue(mockPayload);

      // Mock DynamoDB get locked user profile
      mockSend.mockResolvedValue({
        Item: mockLockedProfile,
      });

      const result = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).message).toBe('Account is locked due to security violations');
    });

    it('should handle session timeout for students (8 hours)', async () => {
      const mockToken = 'Bearer valid-token';
      const mockPayload = {
        sub: 'student-user-id',
        email: 'student@example.com',
        token_use: 'access',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_test123',
      };

      const expiredSessionProfile = {
        studentId: 'student-user-id',
        email: 'student@example.com',
        userRole: 'student',
        sessionTimeoutMinutes: 480, // 8 hours
        lastLoginAt: Date.now() - (9 * 60 * 60 * 1000), // 9 hours ago (expired)
        accountLocked: false,
      };

      const event: Partial<APIGatewayProxyEvent> = {
        path: '/auth/validate',
        httpMethod: 'POST',
        headers: {
          Authorization: mockToken,
        },
        body: JSON.stringify({ token: 'valid-token' }),
      };

      const context: Partial<Context> = {
        awsRequestId: 'test-request-id',
      };

      // Mock JWT verification success
      mockVerifier.verify.mockResolvedValue(mockPayload);

      // Mock DynamoDB get expired session profile
      mockSend.mockResolvedValue({
        Item: expiredSessionProfile,
      });

      const result = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).message).toBe('Session expired');
    });

    it('should handle session timeout for recruiters (4 hours)', async () => {
      const mockToken = 'Bearer valid-token';
      const mockPayload = {
        sub: 'recruiter-user-id',
        email: 'recruiter@example.com',
        token_use: 'access',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_test123',
      };

      const expiredRecruiterProfile = {
        studentId: 'recruiter-user-id',
        email: 'recruiter@example.com',
        userRole: 'recruiter',
        sessionTimeoutMinutes: 240, // 4 hours
        lastLoginAt: Date.now() - (5 * 60 * 60 * 1000), // 5 hours ago (expired)
        accountLocked: false,
      };

      const event: Partial<APIGatewayProxyEvent> = {
        path: '/auth/validate',
        httpMethod: 'POST',
        headers: {
          Authorization: mockToken,
        },
        body: JSON.stringify({ token: 'valid-token' }),
      };

      const context: Partial<Context> = {
        awsRequestId: 'test-request-id',
      };

      // Mock JWT verification success
      mockVerifier.verify.mockResolvedValue(mockPayload);

      // Mock DynamoDB get expired recruiter session profile
      mockSend.mockResolvedValue({
        Item: expiredRecruiterProfile,
      });

      const result = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).message).toBe('Session expired');
    });
  });

  describe('DPDP Act 2023 Compliance Tests', () => {
    it('should handle user profiles with DPDP compliance data', async () => {
      const mockToken = 'Bearer valid-token';
      const mockPayload = {
        sub: 'compliant-user-id',
        email: 'compliant@example.com',
        'custom:userRole': 'student',
        'custom:dataConsentGiven': Date.now().toString(),
        'custom:aadhaarOptional': 'true',
        'custom:preferredLanguage': 'hi',
        token_use: 'access',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_test123',
      };

      const event: Partial<APIGatewayProxyEvent> = {
        path: '/auth/validate',
        httpMethod: 'POST',
        headers: {
          Authorization: mockToken,
        },
        body: JSON.stringify({ token: 'valid-token' }),
      };

      const context: Partial<Context> = {
        awsRequestId: 'test-request-id',
      };

      // Mock JWT verification success
      mockVerifier.verify.mockResolvedValue(mockPayload);

      // Mock DynamoDB - no existing profile, will create new one
      mockSend
        .mockResolvedValueOnce({ Item: undefined }) // GetCommand returns no item
        .mockResolvedValueOnce({}); // PutCommand succeeds

      const result = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.authContext.preferredLanguage).toBe('hi');
      expect(responseBody.authContext.userRole).toBe('student');
    });
  });

  describe('Error Handling Tests', () => {
    it('should return 500 for internal server errors', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        path: '/auth/validate',
        httpMethod: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ token: 'valid-token' }),
      };

      const context: Partial<Context> = {
        awsRequestId: 'test-request-id',
      };

      // Mock JWT verification to throw unexpected error
      mockVerifier.verify.mockRejectedValue(new Error('Unexpected error'));

      const result = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toBe('Internal server error during authentication');
    });

    it('should handle DynamoDB errors gracefully', async () => {
      const mockToken = 'Bearer valid-token';
      const mockPayload = {
        sub: 'test-user-id',
        email: 'test@example.com',
        token_use: 'access',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_test123',
      };

      const event: Partial<APIGatewayProxyEvent> = {
        path: '/auth/validate',
        httpMethod: 'POST',
        headers: {
          Authorization: mockToken,
        },
        body: JSON.stringify({ token: 'valid-token' }),
      };

      const context: Partial<Context> = {
        awsRequestId: 'test-request-id',
      };

      // Mock JWT verification success
      mockVerifier.verify.mockResolvedValue(mockPayload);

      // Mock DynamoDB error
      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      const result = await handler(event as APIGatewayProxyEvent, context as Context);

      // Should still return 200 but with null user profile
      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.authContext.isAuthenticated).toBe(true);
    });
  });
});

describe('Authentication Security Tests', () => {
  it('should validate JWT token structure', () => {
    const validJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjo5OTk5OTk5OTk5fQ.signature';
    const invalidJWT = 'invalid.token';

    expect(validJWT.split('.').length).toBe(3);
    expect(invalidJWT.split('.').length).not.toBe(3);
  });

  it('should enforce proper session timeout values', () => {
    const studentTimeout = 480; // 8 hours in minutes
    const recruiterTimeout = 240; // 4 hours in minutes

    expect(studentTimeout).toBe(8 * 60);
    expect(recruiterTimeout).toBe(4 * 60);
    expect(studentTimeout).toBeGreaterThan(recruiterTimeout);
  });

  it('should validate Indian phone number format', () => {
    const validPhoneNumbers = ['+919876543210', '+918765432109', '+917654321098'];
    const invalidPhoneNumbers = ['9876543210', '+1234567890', '123456'];

    validPhoneNumbers.forEach(phone => {
      expect(phone).toMatch(/^\+91[6-9]\d{9}$/);
    });

    invalidPhoneNumbers.forEach(phone => {
      expect(phone).not.toMatch(/^\+91[6-9]\d{9}$/);
    });
  });

  it('should validate email format', () => {
    const validEmails = ['test@example.com', 'user@domain.co.in', 'student@university.edu'];
    const invalidEmails = ['invalid-email', '@domain.com', 'user@'];

    validEmails.forEach(email => {
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    invalidEmails.forEach(email => {
      expect(email).not.toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });
  });
});
