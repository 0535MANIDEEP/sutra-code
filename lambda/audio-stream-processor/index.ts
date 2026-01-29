import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// Environment variables
const REGION = process.env.AWS_REGION || 'ap-south-1';
const AUDIO_STORAGE_BUCKET = process.env.AUDIO_STORAGE_BUCKET!;
const AUDIO_STREAMS_TABLE = process.env.AUDIO_STREAMS_TABLE || 'SutraCode-AudioStreams';
const BHASHINI_API_KEY = process.env.BHASHINI_API_KEY!;
const BHASHINI_BASE_URL = process.env.BHASHINI_BASE_URL || 'https://dhruva-api.bhashini.gov.in/services';

// Initialize AWS clients
const s3Client = new S3Client({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Interfaces
interface AudioStreamRequest {
  streamId?: string;
  studentId: string;
  sessionId: string;
  action: 'start_stream' | 'upload_chunk' | 'process_chunk' | 'finalize_stream' | 'get_status';
  chunkIndex?: number;
  audioData?: string; // Base64 encoded audio chunk
  audioFormat?: 'webm' | 'wav' | 'mp3';
  language?: string;
  isLastChunk?: boolean;
  totalChunks?: number;
}

interface AudioStreamResponse {
  streamId: string;
  status: 'started' | 'processing' | 'completed' | 'error';
  chunkIndex?: number;
  totalChunks?: number;
  processedChunks?: number;
  transcription?: string;
  confidence?: number;
  uploadUrl?: string; // Pre-signed URL for direct upload
  error?: string;
  processingTime?: number;
}

interface AudioStream {
  streamId: string;
  studentId: string;
  sessionId: string;
  status: 'active' | 'processing' | 'completed' | 'error';
  language: string;
  startTime: number;
  endTime?: number;
  totalChunks: number;
  processedChunks: number;
  chunks: AudioChunk[];
  finalTranscription?: string;
  averageConfidence?: number;
  processingMetrics: ProcessingMetrics;
}

interface AudioChunk {
  chunkIndex: number;
  s3Key: string;
  uploadTime: number;
  size: number;
  duration?: number;
  transcription?: string;
  confidence?: number;
  processingTime?: number;
  status: 'uploaded' | 'processing' | 'processed' | 'error';
}

interface ProcessingMetrics {
  totalUploadTime: number;
  totalProcessingTime: number;
  averageChunkSize: number;
  bufferUtilization: number;
  errorCount: number;
}

interface BhashiniSTTRequest {
  config: {
    language: {
      sourceLanguage: string;
    };
    serviceId: string;
    audioFormat: string;
    samplingRate: number;
  };
  audio: {
    audioContent: string;
  };
}

// Language code mapping for Bhashini API
const BHASHINI_LANGUAGE_CODES = {
  'hindi': 'hi',
  'tamil': 'ta',
  'telugu': 'te',
  'bengali': 'bn',
  'marathi': 'mr',
  'gujarati': 'gu',
  'kannada': 'kn',
  'malayalam': 'ml',
  'odia': 'or',
  'punjabi': 'pa',
  'assamese': 'as',
  'urdu': 'ur',
  'english': 'en',
};

/**
 * Main Lambda handler for Audio Stream Processor
 * Implements server-side stream processing with 5-second buffers
 * Requirements: 4.2, 10.1
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Audio Stream Processor - Processing request:', {
    path: event.path,
    method: event.httpMethod,
    body: event.body ? (() => {
      try {
        return JSON.parse(event.body);
      } catch {
        return 'Invalid JSON';
      }
    })() : null,
  });

  try {
    switch (event.httpMethod) {
      case 'POST':
        return await handleStreamAction(event);
      case 'GET':
        return await handleGetStreamStatus(event);
      default:
        return createErrorResponse(405, 'Method not allowed');
    }
  } catch (error) {
    console.error('Audio Stream Processor error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
};

/**
 * Handle POST requests for audio streaming actions
 */
async function handleStreamAction(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return createErrorResponse(400, 'Request body is required');
  }

  let request: AudioStreamRequest;
  try {
    request = JSON.parse(event.body);
  } catch (error) {
    return createErrorResponse(400, 'Invalid JSON in request body');
  }

  if (!request.studentId || !request.sessionId || !request.action) {
    return createErrorResponse(400, 'studentId, sessionId, and action are required');
  }

  try {
    let response: AudioStreamResponse;

    switch (request.action) {
      case 'start_stream':
        response = await startAudioStream(request);
        break;
      case 'upload_chunk':
        response = await uploadAudioChunk(request);
        break;
      case 'process_chunk':
        response = await processAudioChunk(request);
        break;
      case 'finalize_stream':
        response = await finalizeAudioStream(request);
        break;
      case 'get_status':
        response = await getStreamStatus(request);
        break;
      default:
        return createErrorResponse(400, `Invalid action: ${request.action}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error(`Error handling action ${request.action}:`, error);
    return createErrorResponse(500, `Failed to process ${request.action}`);
  }
}

/**
 * Start a new audio stream
 */
async function startAudioStream(request: AudioStreamRequest): Promise<AudioStreamResponse> {
  try {
    const streamId = uuidv4();
    const language = request.language || 'english';

    const audioStream: AudioStream = {
      streamId,
      studentId: request.studentId,
      sessionId: request.sessionId,
      status: 'active',
      language,
      startTime: Date.now(),
      totalChunks: 0,
      processedChunks: 0,
      chunks: [],
      processingMetrics: {
        totalUploadTime: 0,
        totalProcessingTime: 0,
        averageChunkSize: 0,
        bufferUtilization: 0,
        errorCount: 0,
      },
    };

    // Save stream to DynamoDB
    await saveAudioStream(audioStream);

    return {
      streamId,
      status: 'started',
      totalChunks: 0,
      processedChunks: 0,
    };

  } catch (error) {
    console.error('Error starting audio stream:', error);
    throw error;
  }
}

/**
 * Upload audio chunk with 5-second buffer processing
 * Requirements: 4.2
 */
async function uploadAudioChunk(request: AudioStreamRequest): Promise<AudioStreamResponse> {
  try {
    if (!request.streamId || !request.audioData || request.chunkIndex === undefined) {
      throw new Error('streamId, audioData, and chunkIndex are required');
    }

    const startTime = Date.now();
    
    // Get audio stream
    const audioStream = await getAudioStream(request.streamId);
    if (!audioStream) {
      throw new Error('Audio stream not found');
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(request.audioData, 'base64');
    const audioFormat = request.audioFormat || 'webm';

    // Generate S3 key for chunk
    const s3Key = `audio-streams/${request.streamId}/chunk-${request.chunkIndex.toString().padStart(3, '0')}.${audioFormat}`;

    // Upload chunk to S3 with encryption
    const putCommand = new PutObjectCommand({
      Bucket: AUDIO_STORAGE_BUCKET,
      Key: s3Key,
      Body: audioBuffer,
      ContentType: `audio/${audioFormat}`,
      ServerSideEncryption: 'AES256',
      Metadata: {
        streamId: request.streamId,
        chunkIndex: request.chunkIndex.toString(),
        studentId: request.studentId,
        sessionId: request.sessionId,
        uploadTime: Date.now().toString(),
      },
    });

    await s3Client.send(putCommand);

    const uploadTime = Date.now() - startTime;

    // Create chunk record
    const chunk: AudioChunk = {
      chunkIndex: request.chunkIndex,
      s3Key,
      uploadTime: Date.now(),
      size: audioBuffer.length,
      status: 'uploaded',
    };

    // Update audio stream
    audioStream.chunks.push(chunk);
    audioStream.totalChunks = Math.max(audioStream.totalChunks, request.chunkIndex + 1);
    audioStream.processingMetrics.totalUploadTime += uploadTime;
    audioStream.processingMetrics.averageChunkSize = 
      audioStream.chunks.reduce((sum, c) => sum + c.size, 0) / audioStream.chunks.length;

    // Save updated stream
    await saveAudioStream(audioStream);

    // Trigger immediate processing for real-time transcription (5-second buffer)
    const processingPromise = processChunkAsync(request.streamId, request.chunkIndex, audioStream.language);
    
    // Don't wait for processing to complete - return immediately for streaming
    processingPromise.catch(error => {
      console.error(`Async chunk processing failed for chunk ${request.chunkIndex}:`, error);
    });

    return {
      streamId: request.streamId,
      status: 'processing',
      chunkIndex: request.chunkIndex,
      totalChunks: audioStream.totalChunks,
      processedChunks: audioStream.processedChunks,
      processingTime: uploadTime,
    };

  } catch (error) {
    console.error('Error uploading audio chunk:', error);
    throw error;
  }
}

/**
 * Process audio chunk asynchronously with 5-second buffer
 */
async function processChunkAsync(streamId: string, chunkIndex: number, language: string): Promise<void> {
  try {
    const startTime = Date.now();

    // Get audio stream
    const audioStream = await getAudioStream(streamId);
    if (!audioStream) {
      throw new Error('Audio stream not found');
    }

    const chunk = audioStream.chunks.find(c => c.chunkIndex === chunkIndex);
    if (!chunk) {
      throw new Error('Chunk not found');
    }

    // Update chunk status
    chunk.status = 'processing';
    await saveAudioStream(audioStream);

    // Download audio from S3
    const getCommand = new GetObjectCommand({
      Bucket: AUDIO_STORAGE_BUCKET,
      Key: chunk.s3Key,
    });

    const s3Response = await s3Client.send(getCommand);
    const audioBuffer = await streamToBuffer(s3Response.Body as any);

    // Convert to base64 for Bhashini API
    const audioBase64 = audioBuffer.toString('base64');

    // Transcribe using Bhashini STT with 5-second timeout
    const transcriptionResult = await transcribeAudioChunk(audioBase64, language);

    const processingTime = Date.now() - startTime;

    // Update chunk with results
    chunk.transcription = transcriptionResult.text;
    chunk.confidence = transcriptionResult.confidence;
    chunk.processingTime = processingTime;
    chunk.status = 'processed';

    // Update stream metrics
    audioStream.processedChunks++;
    audioStream.processingMetrics.totalProcessingTime += processingTime;

    // Calculate buffer utilization (processing time vs real-time)
    const realTimeChunkDuration = 30000; // 30 seconds per chunk
    audioStream.processingMetrics.bufferUtilization = 
      (audioStream.processingMetrics.totalProcessingTime / 
       (audioStream.processedChunks * realTimeChunkDuration)) * 100;

    await saveAudioStream(audioStream);

    console.log(`Chunk ${chunkIndex} processed in ${processingTime}ms with confidence ${transcriptionResult.confidence}`);

  } catch (error) {
    console.error(`Error processing chunk ${chunkIndex}:`, error);
    
    // Update chunk status to error
    const audioStream = await getAudioStream(streamId);
    if (audioStream) {
      const chunk = audioStream.chunks.find(c => c.chunkIndex === chunkIndex);
      if (chunk) {
        chunk.status = 'error';
        audioStream.processingMetrics.errorCount++;
        await saveAudioStream(audioStream);
      }
    }
  }
}

/**
 * Process specific audio chunk (synchronous)
 */
async function processAudioChunk(request: AudioStreamRequest): Promise<AudioStreamResponse> {
  try {
    if (!request.streamId || request.chunkIndex === undefined) {
      throw new Error('streamId and chunkIndex are required');
    }

    const audioStream = await getAudioStream(request.streamId);
    if (!audioStream) {
      throw new Error('Audio stream not found');
    }

    const chunk = audioStream.chunks.find(c => c.chunkIndex === request.chunkIndex);
    if (!chunk) {
      throw new Error('Chunk not found');
    }

    // If already processed, return cached result
    if (chunk.status === 'processed') {
      return {
        streamId: request.streamId,
        status: 'completed',
        chunkIndex: request.chunkIndex,
        transcription: chunk.transcription,
        confidence: chunk.confidence,
        processingTime: chunk.processingTime,
      };
    }

    // Process chunk synchronously
    await processChunkAsync(request.streamId, request.chunkIndex!, audioStream.language);

    // Get updated chunk
    const updatedStream = await getAudioStream(request.streamId);
    const updatedChunk = updatedStream?.chunks.find(c => c.chunkIndex === request.chunkIndex);

    return {
      streamId: request.streamId,
      status: updatedChunk?.status === 'processed' ? 'completed' : 'error',
      chunkIndex: request.chunkIndex,
      transcription: updatedChunk?.transcription,
      confidence: updatedChunk?.confidence,
      processingTime: updatedChunk?.processingTime,
    };

  } catch (error) {
    console.error('Error processing audio chunk:', error);
    throw error;
  }
}

/**
 * Finalize audio stream and generate complete transcription
 */
async function finalizeAudioStream(request: AudioStreamRequest): Promise<AudioStreamResponse> {
  try {
    if (!request.streamId) {
      throw new Error('streamId is required');
    }

    const audioStream = await getAudioStream(request.streamId);
    if (!audioStream) {
      throw new Error('Audio stream not found');
    }

    // Wait for all chunks to be processed
    const maxWaitTime = 30000; // 30 seconds max wait
    const startWait = Date.now();
    
    while (audioStream.processedChunks < audioStream.totalChunks && 
           (Date.now() - startWait) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      const updatedStream = await getAudioStream(request.streamId);
      if (updatedStream) {
        Object.assign(audioStream, updatedStream);
      }
    }

    // Generate final transcription by combining all chunks
    const processedChunks = audioStream.chunks
      .filter(chunk => chunk.status === 'processed' && chunk.transcription)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);

    const finalTranscription = processedChunks
      .map(chunk => chunk.transcription)
      .join(' ')
      .trim();

    const averageConfidence = processedChunks.length > 0 
      ? processedChunks.reduce((sum, chunk) => sum + (chunk.confidence || 0), 0) / processedChunks.length
      : 0;

    // Update stream with final results
    audioStream.status = 'completed';
    audioStream.endTime = Date.now();
    audioStream.finalTranscription = finalTranscription;
    audioStream.averageConfidence = averageConfidence;

    await saveAudioStream(audioStream);

    return {
      streamId: request.streamId,
      status: 'completed',
      totalChunks: audioStream.totalChunks,
      processedChunks: audioStream.processedChunks,
      transcription: finalTranscription,
      confidence: averageConfidence,
      processingTime: audioStream.endTime - audioStream.startTime,
    };

  } catch (error) {
    console.error('Error finalizing audio stream:', error);
    throw error;
  }
}

/**
 * Get stream status
 */
async function getStreamStatus(request: AudioStreamRequest): Promise<AudioStreamResponse> {
  try {
    if (!request.streamId) {
      throw new Error('streamId is required');
    }

    const audioStream = await getAudioStream(request.streamId);
    if (!audioStream) {
      throw new Error('Audio stream not found');
    }

    return {
      streamId: request.streamId,
      status: audioStream.status as any,
      totalChunks: audioStream.totalChunks,
      processedChunks: audioStream.processedChunks,
      transcription: audioStream.finalTranscription,
      confidence: audioStream.averageConfidence,
    };

  } catch (error) {
    console.error('Error getting stream status:', error);
    throw error;
  }
}

/**
 * Transcribe audio chunk using Bhashini STT API
 */
async function transcribeAudioChunk(
  audioBase64: string,
  language: string
): Promise<{ text: string; confidence: number }> {
  try {
    const bhashiniLangCode = BHASHINI_LANGUAGE_CODES[language.toLowerCase() as keyof typeof BHASHINI_LANGUAGE_CODES] || 'en';
    
    const sttRequest: BhashiniSTTRequest = {
      config: {
        language: {
          sourceLanguage: bhashiniLangCode,
        },
        serviceId: 'ai4bharat/conformer-hi-gpu--t4',
        audioFormat: 'webm',
        samplingRate: 16000,
      },
      audio: {
        audioContent: audioBase64,
      },
    };

    const response = await axios.post(
      `${BHASHINI_BASE_URL}/inference/pipeline`,
      sttRequest,
      {
        headers: {
          'Authorization': `Bearer ${BHASHINI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000, // 5-second timeout for streaming
      }
    );

    if (response.data && response.data.pipelineResponse) {
      const transcription = response.data.pipelineResponse[0];
      return {
        text: transcription.output[0].source || '',
        confidence: transcription.config?.confidence || 0.8,
      };
    }

    throw new Error('Invalid response from Bhashini STT API');

  } catch (error) {
    console.error('Error transcribing audio chunk:', error);
    
    // Return empty transcription with low confidence on error
    return {
      text: '',
      confidence: 0.0,
    };
  }
}

/**
 * Save audio stream to DynamoDB
 */
async function saveAudioStream(audioStream: AudioStream): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: AUDIO_STREAMS_TABLE,
      Item: {
        ...audioStream,
        timestamp: Date.now(),
        ttl: Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000), // 7 days TTL
      },
    });

    await docClient.send(command);
  } catch (error) {
    console.error('Error saving audio stream:', error);
    throw error;
  }
}

/**
 * Get audio stream from DynamoDB
 */
async function getAudioStream(streamId: string): Promise<AudioStream | null> {
  try {
    const command = new GetCommand({
      TableName: AUDIO_STREAMS_TABLE,
      Key: { streamId },
    });

    const result = await docClient.send(command);
    return result.Item as AudioStream || null;
  } catch (error) {
    console.error('Error getting audio stream:', error);
    return null;
  }
}

/**
 * Handle GET requests for stream status
 */
async function handleGetStreamStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const streamId = event.pathParameters?.streamId;
  
  if (!streamId) {
    return createErrorResponse(400, 'Stream ID parameter is required');
  }

  try {
    const audioStream = await getAudioStream(streamId);
    
    if (!audioStream) {
      return createErrorResponse(404, 'Audio stream not found');
    }

    const response: AudioStreamResponse = {
      streamId,
      status: audioStream.status as any,
      totalChunks: audioStream.totalChunks,
      processedChunks: audioStream.processedChunks,
      transcription: audioStream.finalTranscription,
      confidence: audioStream.averageConfidence,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Error getting stream status:', error);
    return createErrorResponse(500, 'Failed to get stream status');
  }
}

/**
 * Convert stream to buffer
 */
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

/**
 * Create error response
 */
function createErrorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      error: message,
      timestamp: new Date().toISOString(),
    }),
  };
}