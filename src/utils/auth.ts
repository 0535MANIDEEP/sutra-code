import { CognitoIdentityProviderClient, InitiateAuthCommand, RespondToAuthChallengeCommand } from '@aws-sdk/client-cognito-identity-provider';
import { CognitoIdentityClient, GetIdCommand, GetCredentialsForIdentityCommand } from '@aws-sdk/client-cognito-identity';

// Configuration from environment or CDK outputs
const REGION = process.env.REACT_APP_AWS_REGION || 'ap-south-1';
const USER_POOL_ID = process.env.REACT_APP_USER_POOL_ID!;
const CLIENT_ID = process.env.REACT_APP_CLIENT_ID!;
const IDENTITY_POOL_ID = process.env.REACT_APP_IDENTITY_POOL_ID!;
const API_GATEWAY_URL = process.env.REACT_APP_API_GATEWAY_URL!;

// Initialize AWS clients
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
const identityClient = new CognitoIdentityClient({ region: REGION });

export interface AuthUser {
  userId: string;
  email: string;
  phoneNumber?: string;
  userRole: 'student' | 'recruiter';
  preferredLanguage: string;
  gritScore: number;
  skillLevel: number;
  accessToken: string;
  idToken: string;
  refreshToken: string;
  sessionTimeout: number;
  mfaEnabled: boolean;
}

export interface SignUpData {
  email: string;
  phoneNumber: string;
  password: string;
  givenName: string;
  familyName: string;
  userRole: 'student' | 'recruiter';
  institutionName?: string;
  preferredLanguage: string;
  dataConsentGiven: boolean;
  aadhaarOptional: boolean;
}

export interface SignInData {
  email: string;
  password: string;
  mfaCode?: string;
}

/**
 * Authentication service for Sutra-Code
 * Handles Cognito authentication with DPDP Act 2023 compliance
 */
export class AuthService {
  private static instance: AuthService;
  private currentUser: AuthUser | null = null;
  private sessionTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Load user from localStorage on initialization
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
  async signUp(userData: SignUpData): Promise<{ success: boolean; message: string; challengeName?: string }> {
    try {
      // Validate data consent
      if (!userData.dataConsentGiven) {
        throw new Error('Data processing consent is required under DPDP Act 2023');
      }

      const command = new InitiateAuthCommand({
        ClientId: CLIENT_ID,
        AuthFlow: 'USER_SRP_AUTH',
        AuthParameters: {
          USERNAME: userData.email,
          PASSWORD: userData.password,
        },
        ClientMetadata: {
          email: userData.email,
          phone_number: userData.phoneNumber,
          given_name: userData.givenName,
          family_name: userData.familyName,
          'custom:userRole': userData.userRole,
          'custom:institutionName': userData.institutionName || '',
          'custom:preferredLanguage': userData.preferredLanguage,
          'custom:dataConsentGiven': Date.now().toString(),
          'custom:aadhaarOptional': userData.aadhaarOptional.toString(),
          'custom:gritScore': '0',
          'custom:skillLevel': '1',
        },
      });

      const response = await cognitoClient.send(command);

      if (response.ChallengeName) {
        return {
          success: false,
          message: 'Additional verification required',
          challengeName: response.ChallengeName,
        };
      }

      return {
        success: true,
        message: 'Account created successfully. Please check your email for verification.',
      };

    } catch (error: any) {
      console.error('Sign up error:', error);
      return {
        success: false,
        message: error.message || 'Failed to create account',
      };
    }
  }

  /**
   * Sign in user with SRP authentication
   */
  async signIn(credentials: SignInData): Promise<{ success: boolean; user?: AuthUser; message: string; challengeName?: string }> {
    try {
      const command = new InitiateAuthCommand({
        ClientId: CLIENT_ID,
        AuthFlow: 'USER_SRP_AUTH',
        AuthParameters: {
          USERNAME: credentials.email,
          PASSWORD: credentials.password,
        },
      });

      const response = await cognitoClient.send(command);

      if (response.ChallengeName) {
        // Handle MFA or other challenges
        if (response.ChallengeName === 'SMS_MFA' || response.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
          if (!credentials.mfaCode) {
            return {
              success: false,
              message: 'MFA code required',
              challengeName: response.ChallengeName,
            };
          }

          // Respond to MFA challenge
          const mfaCommand = new RespondToAuthChallengeCommand({
            ClientId: CLIENT_ID,
            ChallengeName: response.ChallengeName,
            Session: response.Session,
            ChallengeResponses: {
              USERNAME: credentials.email,
              SMS_MFA_CODE: credentials.mfaCode,
              SOFTWARE_TOKEN_MFA_CODE: credentials.mfaCode,
            },
          });

          const mfaResponse = await cognitoClient.send(mfaCommand);
          if (!mfaResponse.AuthenticationResult) {
            return {
              success: false,
              message: 'Invalid MFA code',
            };
          }

          // Process successful authentication
          return this.processAuthenticationResult(mfaResponse.AuthenticationResult);
        }

        return {
          success: false,
          message: 'Additional authentication required',
          challengeName: response.ChallengeName,
        };
      }

      if (!response.AuthenticationResult) {
        return {
          success: false,
          message: 'Authentication failed',
        };
      }

      return this.processAuthenticationResult(response.AuthenticationResult);

    } catch (error: any) {
      console.error('Sign in error:', error);
      return {
        success: false,
        message: this.getErrorMessage(error),
      };
    }
  }

  /**
   * Process successful authentication result
   */
  private async processAuthenticationResult(authResult: any): Promise<{ success: boolean; user: AuthUser; message: string }> {
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
      user,
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
      localStorage.removeItem('sutra_code_user');
      localStorage.removeItem('sutra_code_tokens');

      // TODO: Revoke tokens on server side
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
   * Validate JWT token with backend
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_GATEWAY_URL}/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ token }),
      });

      return response.ok;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
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
        ClientId: CLIENT_ID,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: this.currentUser.refreshToken,
        },
      });

      const response = await cognitoClient.send(command);

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
      // Redirect to login page or show session expired modal
      window.location.href = '/auth/signin';
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
    
    localStorage.setItem('sutra_code_user', JSON.stringify(userData));
    
    // Store tokens separately with shorter expiration
    const tokens = {
      accessToken: user.accessToken,
      idToken: user.idToken,
      refreshToken: user.refreshToken,
      expiresAt: Date.now() + (user.sessionTimeout * 60 * 1000),
    };
    localStorage.setItem('sutra_code_tokens', JSON.stringify(tokens));
  }

  /**
   * Load user from localStorage
   */
  private loadUserFromStorage(): void {
    try {
      const userData = localStorage.getItem('sutra_code_user');
      const tokenData = localStorage.getItem('sutra_code_tokens');

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
          localStorage.removeItem('sutra_code_user');
          localStorage.removeItem('sutra_code_tokens');
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