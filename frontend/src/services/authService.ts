import { 
  CognitoIdentityProviderClient, 
  InitiateAuthCommand, 
  RespondToAuthChallengeCommand,
  SignUpCommand,
  ConfirmSignUpCommand 
} from '@aws-sdk/client-cognito-identity-provider';
import { AuthUser, SignUpForm, SignInForm, ApiResponse } from '../types';
import { COGNITO_CONFIG, STORAGE_KEYS } from '../constants';

class AuthService {
  private static instance: AuthService;
  private cognitoClient: CognitoIdentityProviderClient;
  private currentUser: AuthUser | null = null;
  private sessionTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.cognitoClient = new CognitoIdentityProviderClient({ 
      region: COGNITO_CONFIG.REGION 
    });
    this.loadUserFromStorage();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Sign up a new user with DPDP Act 2023 compliance
   */
  async signUp(userData: SignUpForm): Promise<ApiResponse<{ challengeName?: string }>> {
    try {
      // Validate data consent
      if (!userData.dataConsentGiven) {
        return {
          success: false,
          error: {
            message: 'Data processing consent is required under DPDP Act 2023',
            code: 'CONSENT_REQUIRED'
          }
        };
      }

      // Validate password confirmation
      if (userData.password !== userData.confirmPassword) {
        return {
          success: false,
          error: {
            message: 'Passwords do not match',
            code: 'PASSWORD_MISMATCH'
          }
        };
      }

      // For demo purposes, we'll simulate a successful sign-up
      // In production, this would connect to AWS Cognito
      console.log('Demo sign-up attempt:', {
        email: userData.email,
        name: `${userData.givenName} ${userData.familyName}`,
        role: userData.userRole,
        language: userData.preferredLanguage
      });

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if Cognito is configured
      if (!COGNITO_CONFIG.CLIENT_ID || !COGNITO_CONFIG.USER_POOL_ID) {
        console.warn('Cognito not configured, using demo mode');
        return {
          success: true,
          message: 'Demo account created successfully! You can now sign in with any credentials.',
        };
      }

      const command = new SignUpCommand({
        ClientId: COGNITO_CONFIG.CLIENT_ID,
        Username: userData.email,
        Password: userData.password,
        UserAttributes: [
          { Name: 'email', Value: userData.email },
          { Name: 'phone_number', Value: userData.phoneNumber },
          { Name: 'given_name', Value: userData.givenName },
          { Name: 'family_name', Value: userData.familyName },
          { Name: 'custom:userRole', Value: userData.userRole },
          { Name: 'custom:institutionName', Value: userData.institutionName || '' },
          { Name: 'custom:preferredLanguage', Value: userData.preferredLanguage },
          { Name: 'custom:dataConsentGiven', Value: Date.now().toString() },
          { Name: 'custom:aadhaarOptional', Value: userData.aadhaarOptional.toString() },
          { Name: 'custom:gritScore', Value: '0' },
          { Name: 'custom:skillLevel', Value: '1' },
        ],
        ClientMetadata: {
          signUpSource: 'sutra-code-web',
          consentTimestamp: Date.now().toString(),
        },
      });

      const response = await this.cognitoClient.send(command);

      return {
        success: true,
        message: 'Account created successfully. Please check your email for verification.',
        data: { challengeName: response.CodeDeliveryDetails?.DeliveryMedium }
      };

    } catch (error: any) {
      console.error('Sign up error:', error);
      return {
        success: false,
        error: {
          message: this.getErrorMessage(error),
          code: error.name
        }
      };
    }
  }

  /**
   * Sign in user with SRP authentication
   */
  async signIn(credentials: SignInForm): Promise<ApiResponse<AuthUser>> {
    try {
      // For demo purposes, simulate successful sign-in
      console.log('Demo sign-in attempt:', credentials.email);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if Cognito is configured
      if (!COGNITO_CONFIG.CLIENT_ID || !COGNITO_CONFIG.USER_POOL_ID) {
        console.warn('Cognito not configured, using demo mode');
        
        // Create demo user
        const demoUser: AuthUser = {
          userId: 'demo-user-123',
          email: credentials.email,
          phoneNumber: '+91 9876543210',
          userRole: 'student',
          preferredLanguage: 'en',
          gritScore: 45,
          skillLevel: 3,
          accessToken: 'demo-access-token',
          idToken: 'demo-id-token',
          refreshToken: 'demo-refresh-token',
          sessionTimeout: 480, // 8 hours for students
          mfaEnabled: false,
        };

        // Store demo user
        this.currentUser = demoUser;
        this.saveUserToStorage(demoUser);
        this.startSessionTimer();

        return {
          success: true,
          data: demoUser,
          message: 'Demo sign-in successful!',
        };
      }

      const command = new InitiateAuthCommand({
        ClientId: COGNITO_CONFIG.CLIENT_ID,
        AuthFlow: 'USER_SRP_AUTH',
        AuthParameters: {
          USERNAME: credentials.email,
          PASSWORD: credentials.password,
        },
      });

      const response = await this.cognitoClient.send(command);

      if (response.ChallengeName) {
        // Handle MFA or other challenges
        if (response.ChallengeName === 'SMS_MFA' || response.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
          if (!credentials.mfaCode) {
            return {
              success: false,
              error: {
                message: 'MFA code required',
                code: 'MFA_REQUIRED'
              }
            };
          }

          // Respond to MFA challenge
          const mfaCommand = new RespondToAuthChallengeCommand({
            ClientId: COGNITO_CONFIG.CLIENT_ID,
            ChallengeName: response.ChallengeName,
            Session: response.Session,
            ChallengeResponses: {
              USERNAME: credentials.email,
              SMS_MFA_CODE: credentials.mfaCode,
              SOFTWARE_TOKEN_MFA_CODE: credentials.mfaCode,
            },
          });

          const mfaResponse = await this.cognitoClient.send(mfaCommand);
          if (!mfaResponse.AuthenticationResult) {
            return {
              success: false,
              error: {
                message: 'Invalid MFA code',
                code: 'INVALID_MFA'
              }
            };
          }

          // Process successful authentication
          return this.processAuthenticationResult(mfaResponse.AuthenticationResult);
        }

        return {
          success: false,
          error: {
            message: 'Additional authentication required',
            code: response.ChallengeName
          }
        };
      }

      if (!response.AuthenticationResult) {
        return {
          success: false,
          error: {
            message: 'Authentication failed',
            code: 'AUTH_FAILED'
          }
        };
      }

      return this.processAuthenticationResult(response.AuthenticationResult);

    } catch (error: any) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: {
          message: this.getErrorMessage(error),
          code: error.name
        }
      };
    }
  }

  /**
   * Process successful authentication result
   */
  private async processAuthenticationResult(authResult: any): Promise<ApiResponse<AuthUser>> {
    const accessToken = authResult.AccessToken;
    const idToken = authResult.IdToken;
    const refreshToken = authResult.RefreshToken;

    // Decode JWT to get user information
    const tokenPayload = this.decodeJWT(idToken);
    
    const user: AuthUser = {
      userId: tokenPayload.sub,
      email: tokenPayload.email,
      phoneNumber: tokenPayload.phone_number,
      userRole: tokenPayload['custom:userRole'] || 'student',
      preferredLanguage: tokenPayload['custom:preferredLanguage'] || 'en',
      gritScore: parseInt(tokenPayload['custom:gritScore']) || 0,
      skillLevel: parseInt(tokenPayload['custom:skillLevel']) || 1,
      accessToken,
      idToken,
      refreshToken,
      sessionTimeout: tokenPayload['custom:userRole'] === 'recruiter' ? 240 : 480, // minutes
      mfaEnabled: false, // Will be updated from user profile
    };

    // Store user and tokens
    this.currentUser = user;
    this.saveUserToStorage(user);
    this.startSessionTimer();

    return {
      success: true,
      data: user,
      message: 'Successfully signed in',
    };
  }

  /**
   * Sign out user and clear session
   */
  async signOut(): Promise<void> {
    try {
      // Clear session timer
      if (this.sessionTimer) {
        clearTimeout(this.sessionTimer);
        this.sessionTimer = null;
      }

      // Clear user data
      this.currentUser = null;
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      localStorage.removeItem(STORAGE_KEYS.TOKENS);
      localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);

      console.log('User signed out successfully');

    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null && this.isTokenValid(this.currentUser.accessToken);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<boolean> {
    if (!this.currentUser?.refreshToken) {
      return false;
    }

    try {
      const command = new InitiateAuthCommand({
        ClientId: COGNITO_CONFIG.CLIENT_ID,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: this.currentUser.refreshToken,
        },
      });

      const response = await this.cognitoClient.send(command);

      if (response.AuthenticationResult) {
        this.currentUser.accessToken = response.AuthenticationResult.AccessToken!;
        this.currentUser.idToken = response.AuthenticationResult.IdToken!;
        this.saveUserToStorage(this.currentUser);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  /**
   * Start session timeout timer
   */
  private startSessionTimer(): void {
    if (!this.currentUser) return;

    const timeoutMs = this.currentUser.sessionTimeout * 60 * 1000; // Convert minutes to milliseconds

    this.sessionTimer = setTimeout(() => {
      console.log('Session expired');
      this.signOut();
      // Dispatch custom event for session expiry
      window.dispatchEvent(new CustomEvent('sessionExpired'));
    }, timeoutMs);
  }

  /**
   * Save user to localStorage
   */
  private saveUserToStorage(user: AuthUser): void {
    const userData = { ...user };
    // Don't store sensitive tokens in localStorage for security
    delete (userData as any).accessToken;
    delete (userData as any).idToken;
    delete (userData as any).refreshToken;
    
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
    
    // Store tokens separately with shorter expiration
    const tokens = {
      accessToken: user.accessToken,
      idToken: user.idToken,
      refreshToken: user.refreshToken,
      expiresAt: Date.now() + (user.sessionTimeout * 60 * 1000),
    };
    localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
  }

  /**
   * Load user from localStorage
   */
  private loadUserFromStorage(): void {
    try {
      const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
      const tokenData = localStorage.getItem(STORAGE_KEYS.TOKENS);

      if (userData && tokenData) {
        const user = JSON.parse(userData);
        const tokens = JSON.parse(tokenData);

        // Check if tokens are still valid
        if (Date.now() < tokens.expiresAt) {
          this.currentUser = {
            ...user,
            accessToken: tokens.accessToken,
            idToken: tokens.idToken,
            refreshToken: tokens.refreshToken,
          };
          this.startSessionTimer();
        } else {
          // Tokens expired, clear storage
          localStorage.removeItem(STORAGE_KEYS.USER_DATA);
          localStorage.removeItem(STORAGE_KEYS.TOKENS);
        }
      }
    } catch (error) {
      console.error('Error loading user from storage:', error);
    }
  }

  /**
   * Decode JWT token (client-side only for display purposes)
   */
  private decodeJWT(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('JWT decode error:', error);
      return {};
    }
  }

  /**
   * Check if token is valid (not expired)
   */
  private isTokenValid(token: string): boolean {
    try {
      const payload = this.decodeJWT(token);
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp > currentTime;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: any): string {
    switch (error.name) {
      case 'UserNotConfirmedException':
        return 'Please verify your email address before signing in';
      case 'NotAuthorizedException':
        return 'Invalid email or password';
      case 'UserNotFoundException':
        return 'User not found';
      case 'TooManyRequestsException':
        return 'Too many attempts. Please try again later';
      case 'InvalidParameterException':
        return 'Invalid input parameters';
      case 'CodeMismatchException':
        return 'Invalid verification code';
      case 'ExpiredCodeException':
        return 'Verification code has expired';
      default:
        return error.message || 'An error occurred during authentication';
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();