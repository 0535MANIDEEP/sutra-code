import { API_CONFIG, API_ENDPOINTS } from '../constants';
import { authService } from './authService';
import { 
  SocraticResponse, 
  CulturalAnalogy, 
  StudentProfile, 
  ApiResponse, 
  ConversationContext 
} from '../types';

class ApiService {
  private static instance: ApiService;
  private baseURL: string;

  private constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const user = authService.getCurrentUser();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      // Add authorization header if user is authenticated
      if (user?.accessToken) {
        headers['Authorization'] = `Bearer ${user.accessToken}`;
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
      });

      // Handle token refresh if needed
      if (response.status === 401 && user) {
        const refreshed = await authService.refreshToken();
        if (refreshed) {
          // Retry request with new token
          const newUser = authService.getCurrentUser();
          if (newUser?.accessToken) {
            headers['Authorization'] = `Bearer ${newUser.accessToken}`;
            const retryResponse = await fetch(`${this.baseURL}${endpoint}`, {
              ...options,
              headers,
            });
            return this.handleResponse<T>(retryResponse);
          }
        } else {
          // Refresh failed, redirect to login
          authService.signOut();
          window.dispatchEvent(new CustomEvent('authRequired'));
          throw new Error('Authentication required');
        }
      }

      return this.handleResponse<T>(response);

    } catch (error: any) {
      console.error('API request error:', error);
      return {
        success: false,
        error: {
          message: error.message || 'Network error occurred',
          code: 'NETWORK_ERROR',
        },
      };
    }
  }

  /**
   * Handle API response
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          data,
          message: data.message,
        };
      } else {
        return {
          success: false,
          error: {
            message: data.error || data.message || 'Request failed',
            code: data.code || 'API_ERROR',
            statusCode: response.status,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          message: 'Failed to parse response',
          code: 'PARSE_ERROR',
          statusCode: response.status,
        },
      };
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.makeRequest(API_ENDPOINTS.HEALTH, {
      method: 'GET',
    });
  }

  /**
   * Ask Socratic Engine a question
   */
  async askSocraticQuestion(
    studentId: string,
    question: string,
    sessionId?: string,
    language?: string
  ): Promise<ApiResponse<SocraticResponse>> {
    return this.makeRequest(API_ENDPOINTS.SOCRATIC_ASK, {
      method: 'POST',
      body: JSON.stringify({
        studentId,
        question,
        sessionId,
        language,
      }),
    });
  }

  /**
   * Get conversation context
   */
  async getConversationContext(sessionId: string): Promise<ApiResponse<ConversationContext>> {
    return this.makeRequest(`${API_ENDPOINTS.SOCRATIC_CONTEXT}/${sessionId}`, {
      method: 'GET',
    });
  }

  /**
   * Generate cultural analogy
   */
  async generateCulturalAnalogy(
    concept: string,
    difficulty: 'beginner' | 'intermediate' | 'advanced',
    studentProfile: StudentProfile,
    language?: string
  ): Promise<ApiResponse<CulturalAnalogy>> {
    return this.makeRequest(API_ENDPOINTS.ANALOGIES_GENERATE, {
      method: 'POST',
      body: JSON.stringify({
        concept,
        difficulty,
        studentProfile,
        language,
      }),
    });
  }

  /**
   * Provide feedback on analogy effectiveness
   */
  async provideFeedback(
    analogyId: string,
    effectiveness: number,
    feedback?: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest(API_ENDPOINTS.ANALOGIES_FEEDBACK, {
      method: 'PUT',
      body: JSON.stringify({
        analogyId,
        effectiveness,
        feedback,
      }),
    });
  }

  /**
   * Get student profile
   */
  async getStudentProfile(studentId: string): Promise<ApiResponse<StudentProfile>> {
    return this.makeRequest(`${API_ENDPOINTS.PROFILES}/${studentId}`, {
      method: 'GET',
    });
  }

  /**
   * Update student profile
   */
  async updateStudentProfile(
    studentId: string,
    profile: Partial<StudentProfile>
  ): Promise<ApiResponse<StudentProfile>> {
    return this.makeRequest(`${API_ENDPOINTS.PROFILES}/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<ApiResponse<{ valid: boolean }>> {
    return this.makeRequest(API_ENDPOINTS.AUTH_VALIDATE, {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  /**
   * Upload voice recording
   */
  async uploadVoiceRecording(
    audioBlob: Blob,
    sessionId: string,
    language: string
  ): Promise<ApiResponse<{ transcription: string; audioUrl: string }>> {
    try {
      const user = authService.getCurrentUser();
      if (!user?.accessToken) {
        throw new Error('Authentication required');
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('sessionId', sessionId);
      formData.append('language', language);

      const response = await fetch(`${this.baseURL}/v1/voice/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
        },
        body: formData,
      });

      return this.handleResponse(response);

    } catch (error: any) {
      return {
        success: false,
        error: {
          message: error.message || 'Failed to upload voice recording',
          code: 'UPLOAD_ERROR',
        },
      };
    }
  }

  /**
   * Get cached analogies for a concept
   */
  async getCachedAnalogies(concept: string): Promise<ApiResponse<{ analogies: CulturalAnalogy[] }>> {
    return this.makeRequest(`/v1/analogies/${concept}`, {
      method: 'GET',
    });
  }

  /**
   * Search for programming concepts
   */
  async searchConcepts(query: string): Promise<ApiResponse<{ concepts: string[] }>> {
    return this.makeRequest(`/v1/concepts/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
    });
  }

  /**
   * Get learning analytics
   */
  async getLearningAnalytics(
    studentId: string,
    timeRange?: 'day' | 'week' | 'month' | 'year'
  ): Promise<ApiResponse<any>> {
    const params = timeRange ? `?range=${timeRange}` : '';
    return this.makeRequest(`/v1/analytics/${studentId}${params}`, {
      method: 'GET',
    });
  }

  /**
   * Report a bug or issue
   */
  async reportIssue(
    type: 'bug' | 'feedback' | 'suggestion',
    description: string,
    metadata?: any
  ): Promise<ApiResponse<{ ticketId: string }>> {
    return this.makeRequest('/v1/support/report', {
      method: 'POST',
      body: JSON.stringify({
        type,
        description,
        metadata,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }),
    });
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<ApiResponse<{
    status: 'operational' | 'degraded' | 'maintenance';
    services: Record<string, 'up' | 'down' | 'degraded'>;
    lastUpdated: string;
  }>> {
    return this.makeRequest('/v1/status', {
      method: 'GET',
    });
  }
}

// Export singleton instance
export const apiService = ApiService.getInstance();