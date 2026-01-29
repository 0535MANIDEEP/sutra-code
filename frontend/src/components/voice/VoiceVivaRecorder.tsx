import React, { useState, useCallback, useEffect } from 'react';
import { AudioRecorder } from './AudioRecorder';
import { audioStreamService, StreamStatus, StreamingTranscription } from '../../services/audioStreamService';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../hooks/useAuth';

interface VoiceVivaRecorderProps {
  sessionId: string;
  questionId: string;
  questionText: string;
  timeLimit: number; // seconds
  onTranscriptionComplete: (transcription: string, confidence: number) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

interface TranscriptionChunk {
  chunkIndex: number;
  text: string;
  confidence: number;
  timestamp: number;
}

export const VoiceVivaRecorder: React.FC<VoiceVivaRecorderProps> = ({
  sessionId,
  questionId,
  questionText,
  timeLimit,
  onTranscriptionComplete,
  onError,
  disabled = false,
}) => {
  const { getLocalizedText, currentLanguage } = useLanguage();
  const { user } = useAuth();
  
  const [isRecording, setIsRecording] = useState(false);
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [transcriptionChunks, setTranscriptionChunks] = useState<TranscriptionChunk[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [averageConfidence, setAverageConfidence] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');

  // Initialize audio streaming service
  useEffect(() => {
    audioStreamService.onTranscription(handleTranscriptionUpdate);
    audioStreamService.onStatus(handleStatusUpdate);
    audioStreamService.onError(handleStreamError);

    return () => {
      audioStreamService.cleanup();
    };
  }, []);

  // Handle real-time transcription updates
  const handleTranscriptionUpdate = useCallback((transcription: StreamingTranscription) => {
    const newChunk: TranscriptionChunk = {
      chunkIndex: transcription.chunkIndex,
      text: transcription.text,
      confidence: transcription.confidence,
      timestamp: Date.now(),
    };

    setTranscriptionChunks(prev => {
      const updated = [...prev];
      const existingIndex = updated.findIndex(chunk => chunk.chunkIndex === transcription.chunkIndex);
      
      if (existingIndex >= 0) {
        updated[existingIndex] = newChunk;
      } else {
        updated.push(newChunk);
        updated.sort((a, b) => a.chunkIndex - b.chunkIndex);
      }
      
      return updated;
    });

    // Update current transcription
    setTranscriptionChunks(chunks => {
      const sortedChunks = chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
      const fullText = sortedChunks.map(chunk => chunk.text).join(' ').trim();
      const avgConfidence = sortedChunks.length > 0 
        ? sortedChunks.reduce((sum, chunk) => sum + chunk.confidence, 0) / sortedChunks.length
        : 0;
      
      setCurrentTranscription(fullText);
      setAverageConfidence(avgConfidence);
      
      return chunks;
    });

    console.log(`Transcription chunk ${transcription.chunkIndex}: "${transcription.text}" (confidence: ${transcription.confidence})`);
  }, []);

  // Handle stream status updates
  const handleStatusUpdate = useCallback((status: StreamStatus) => {
    setStreamStatus(status);
    
    if (status.status === 'completed') {
      setProcessingStatus('completed');
      
      // Finalize transcription
      if (status.transcription && status.confidence !== undefined) {
        setCurrentTranscription(status.transcription);
        setAverageConfidence(status.confidence);
        onTranscriptionComplete(status.transcription, status.confidence);
      }
    } else if (status.status === 'error') {
      setProcessingStatus('error');
      onError(status.error || 'Stream processing failed');
    } else if (status.status === 'processing') {
      setProcessingStatus('processing');
    }
  }, [onTranscriptionComplete, onError]);

  // Handle stream errors
  const handleStreamError = useCallback((error: string) => {
    setProcessingStatus('error');
    onError(error);
  }, [onError]);

  // Handle audio chunk from recorder
  const handleAudioChunk = useCallback(async (chunk: Blob, chunkIndex: number, isLast: boolean) => {
    if (!user?.userId) {
      onError('User not authenticated');
      return;
    }

    try {
      // Start stream if this is the first chunk
      if (chunkIndex === 0) {
        await audioStreamService.startStream({
          studentId: user.userId,
          sessionId,
          language: currentLanguage.code === 'en' ? 'english' : currentLanguage.name.toLowerCase(),
          chunkDuration: 30, // 30-second chunks as per requirements
          maxDuration: timeLimit,
        });
        setProcessingStatus('processing');
      }

      // Upload chunk for streaming processing
      await audioStreamService.uploadChunk({
        chunkIndex,
        audioBlob: chunk,
        isLast,
      });

      console.log(`Audio chunk ${chunkIndex} uploaded (${chunk.size} bytes, isLast: ${isLast})`);

    } catch (error) {
      console.error('Error handling audio chunk:', error);
      onError(error instanceof Error ? error.message : 'Failed to process audio chunk');
    }
  }, [user?.userId, sessionId, currentLanguage, timeLimit, onError]);

  // Handle recording completion
  const handleRecordingComplete = useCallback(async (totalChunks: number, duration: number) => {
    setIsRecording(false);
    setRecordingTime(duration);
    
    try {
      // Finalize the stream to get complete transcription
      const finalStatus = await audioStreamService.finalizeStream();
      
      if (finalStatus.transcription) {
        setCurrentTranscription(finalStatus.transcription);
        setAverageConfidence(finalStatus.confidence || 0);
        onTranscriptionComplete(finalStatus.transcription, finalStatus.confidence || 0);
      }
      
      console.log(`Recording completed: ${totalChunks} chunks, ${duration}s duration`);
      
    } catch (error) {
      console.error('Error finalizing recording:', error);
      onError(error instanceof Error ? error.message : 'Failed to finalize recording');
    }
  }, [onTranscriptionComplete, onError]);

  // Handle recording error
  const handleRecordingError = useCallback((error: string) => {
    setIsRecording(false);
    setProcessingStatus('error');
    onError(error);
  }, [onError]);

  // Format confidence as percentage
  const formatConfidence = (confidence: number) => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  // Get processing status color
  const getStatusColor = () => {
    switch (processingStatus) {
      case 'processing': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Get processing status text
  const getStatusText = () => {
    switch (processingStatus) {
      case 'processing': return getLocalizedText('processing');
      case 'completed': return getLocalizedText('completed');
      case 'error': return getLocalizedText('error');
      default: return getLocalizedText('ready');
    }
  };

  return (
    <div className="space-y-6">
      {/* Question Display */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          {getLocalizedText('voiceVivaQuestion')}
        </h3>
        <p className="text-blue-800">{questionText}</p>
        <div className="mt-2 text-sm text-blue-600">
          {getLocalizedText('timeLimit')}: {timeLimit} {getLocalizedText('seconds')}
        </div>
      </div>

      {/* Audio Recorder */}
      <AudioRecorder
        onAudioChunk={handleAudioChunk}
        onRecordingComplete={handleRecordingComplete}
        onError={handleRecordingError}
        maxDuration={timeLimit}
        chunkDuration={30} // 30-second chunks
        disabled={disabled || processingStatus === 'completed'}
      />

      {/* Processing Status */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-gray-900">
            {getLocalizedText('processingStatus')}
          </h4>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        {streamStatus && (
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">{getLocalizedText('chunksProcessed')}:</span>
              <span className="ml-1">{streamStatus.processedChunks} / {streamStatus.totalChunks}</span>
            </div>
            {streamStatus.processingTime && (
              <div>
                <span className="font-medium">{getLocalizedText('processingTime')}:</span>
                <span className="ml-1">{(streamStatus.processingTime / 1000).toFixed(1)}s</span>
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        {streamStatus && streamStatus.totalChunks > 0 && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(streamStatus.processedChunks / streamStatus.totalChunks) * 100}%` 
                }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1 text-center">
              {streamStatus.processedChunks} / {streamStatus.totalChunks} chunks processed
            </div>
          </div>
        )}
      </div>

      {/* Real-time Transcription Display */}
      {currentTranscription && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-green-900">
              {getLocalizedText('transcription')}
            </h4>
            <div className="text-sm text-green-700">
              {getLocalizedText('confidence')}: {formatConfidence(averageConfidence)}
            </div>
          </div>
          
          <div className="bg-white border border-green-200 rounded p-3">
            <p className="text-gray-800 leading-relaxed">
              {currentTranscription || getLocalizedText('noTranscriptionYet')}
            </p>
          </div>

          {/* Chunk-by-chunk transcription (for debugging/transparency) */}
          {transcriptionChunks.length > 0 && (
            <details className="mt-3">
              <summary className="text-sm text-green-700 cursor-pointer hover:text-green-800">
                {getLocalizedText('viewChunkDetails')} ({transcriptionChunks.length} chunks)
              </summary>
              <div className="mt-2 space-y-2">
                {transcriptionChunks.map((chunk, index) => (
                  <div key={chunk.chunkIndex} className="bg-green-100 rounded p-2 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-green-800">
                        Chunk {chunk.chunkIndex + 1}
                      </span>
                      <span className="text-green-600">
                        {formatConfidence(chunk.confidence)}
                      </span>
                    </div>
                    <p className="text-green-900">{chunk.text}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-900 mb-2">
          {getLocalizedText('instructions')}
        </h4>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• {getLocalizedText('speakClearlyAndSlowly')}</li>
          <li>• {getLocalizedText('answerInSelectedLanguage')}</li>
          <li>• {getLocalizedText('audioProcessedInRealTime')}</li>
          <li>• {getLocalizedText('canStopRecordingAnytime')}</li>
        </ul>
      </div>
    </div>
  );
};