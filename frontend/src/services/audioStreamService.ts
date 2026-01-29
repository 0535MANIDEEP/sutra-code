import { API_CONFIG } from '../constants';

export interface AudioStreamConfig {
  studentId: string;
  sessionId: string;
  language?: string;
  chunkDuration?: number; // seconds
  maxDuration?: number; // seconds
}

export interface AudioChunkData {
  chunkIndex: number;
  audioBlob: Blob;
  isLast: boolean;
}

export interface StreamStatus {
  streamId: string;
  status: 'started' | 'processing' | 'completed' | 'error';
  totalChunks: number;
  processedChunks: number;
  transcription?: string;
  confidence?: number;
  processingTime?: number;
  error?: string;
}

export interface StreamingTranscription {
  chunkIndex: number;
  text: string;
  confidence: number;
  isPartial: boolean;
}

export class AudioStreamService {
  private streamId: string | null = null;
  private config: AudioStreamConfig | null = null;
  private onTranscriptionCallback: ((transcription: StreamingTranscription) => void) | null = null;
  private onStatusCallback: ((status: StreamStatus) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;

  /**
   * Initialize audio streaming session
   */
  async startStream(config: AudioStreamConfig): Promise<string> {
    try {
      this.config = config;

      const response = await fetch(`${API_CONFIG.BASE_URL}/v1/audio-stream/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify({
          studentId: config.studentId,
          sessionId: config.sessionId,
          action: 'start_stream',
          language: config.language || 'english',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start stream: ${response.statusText}`);
      }

      const result = await response.json();
      this.streamId = result.streamId;

      console.log('Audio stream started:', this.streamId);
      return this.streamId || '';

    } catch (error) {
      console.error('Error starting audio stream:', error);
      this.handleError(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Upload audio chunk for streaming processing
   */
  async uploadChunk(chunkData: AudioChunkData): Promise<void> {
    if (!this.streamId || !this.config) {
      throw new Error('Stream not initialized. Call startStream() first.');
    }

    try {
      // Convert blob to base64
      const audioBase64 = await this.blobToBase64(chunkData.audioBlob);
      
      // Determine audio format from blob type
      const audioFormat = this.getAudioFormat(chunkData.audioBlob.type);

      const response = await fetch(`${API_CONFIG.BASE_URL}/v1/audio-stream/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify({
          streamId: this.streamId,
          studentId: this.config.studentId,
          sessionId: this.config.sessionId,
          action: 'upload_chunk',
          chunkIndex: chunkData.chunkIndex,
          audioData: audioBase64,
          audioFormat,
          isLastChunk: chunkData.isLast,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to upload chunk ${chunkData.chunkIndex}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Notify status update
      if (this.onStatusCallback) {
        this.onStatusCallback(result);
      }

      // Start polling for transcription of this chunk
      this.pollChunkTranscription(chunkData.chunkIndex);

      console.log(`Chunk ${chunkData.chunkIndex} uploaded successfully`);

    } catch (error) {
      console.error(`Error uploading chunk ${chunkData.chunkIndex}:`, error);
      this.handleError(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Poll for chunk transcription (real-time streaming)
   */
  private async pollChunkTranscription(chunkIndex: number): Promise<void> {
    if (!this.streamId || !this.config) return;

    const maxAttempts = 10; // Max 10 attempts (50 seconds)
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;

        const response = await fetch(`${API_CONFIG.BASE_URL}/v1/audio-stream/action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify({
            streamId: this.streamId,
            studentId: this.config!.studentId,
            sessionId: this.config!.sessionId,
            action: 'process_chunk',
            chunkIndex,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          
          if (result.status === 'completed' && result.transcription) {
            // Chunk transcription ready
            if (this.onTranscriptionCallback) {
              this.onTranscriptionCallback({
                chunkIndex,
                text: result.transcription,
                confidence: result.confidence || 0,
                isPartial: false,
              });
            }
            return; // Stop polling
          }
        }

        // Continue polling if not ready and haven't exceeded max attempts
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          console.warn(`Transcription polling timeout for chunk ${chunkIndex}`);
        }

      } catch (error) {
        console.error(`Error polling chunk ${chunkIndex} transcription:`, error);
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Retry on error
        }
      }
    };

    // Start polling after a short delay to allow processing to begin
    setTimeout(poll, 2000);
  }

  /**
   * Finalize stream and get complete transcription
   */
  async finalizeStream(): Promise<StreamStatus> {
    if (!this.streamId || !this.config) {
      throw new Error('Stream not initialized');
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/v1/audio-stream/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify({
          streamId: this.streamId,
          studentId: this.config.studentId,
          sessionId: this.config.sessionId,
          action: 'finalize_stream',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to finalize stream: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Notify final status
      if (this.onStatusCallback) {
        this.onStatusCallback(result);
      }

      console.log('Audio stream finalized:', result);
      return result;

    } catch (error) {
      console.error('Error finalizing stream:', error);
      this.handleError(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get current stream status
   */
  async getStatus(): Promise<StreamStatus | null> {
    if (!this.streamId) return null;

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/v1/audio-stream/status/${this.streamId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get stream status: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Error getting stream status:', error);
      return null;
    }
  }

  /**
   * Set callback for real-time transcription updates
   */
  onTranscription(callback: (transcription: StreamingTranscription) => void): void {
    this.onTranscriptionCallback = callback;
  }

  /**
   * Set callback for status updates
   */
  onStatus(callback: (status: StreamStatus) => void): void {
    this.onStatusCallback = callback;
  }

  /**
   * Set callback for error handling
   */
  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.streamId = null;
    this.config = null;
    this.onTranscriptionCallback = null;
    this.onStatusCallback = null;
    this.onErrorCallback = null;
  }

  /**
   * Convert blob to base64
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:audio/webm;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Get audio format from MIME type
   */
  private getAudioFormat(mimeType: string): string {
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('ogg')) return 'ogg';
    return 'webm'; // Default fallback
  }

  /**
   * Get authentication token
   */
  private getAuthToken(): string {
    // Get token from localStorage or auth context
    const tokens = localStorage.getItem('sutra_code_tokens');
    if (tokens) {
      const parsedTokens = JSON.parse(tokens);
      return parsedTokens.accessToken || '';
    }
    return '';
  }

  /**
   * Handle errors
   */
  private handleError(error: string): void {
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
  }
}

// Export singleton instance
export const audioStreamService = new AudioStreamService();