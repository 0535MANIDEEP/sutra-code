import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface AudioRecorderProps {
  onAudioChunk: (chunk: Blob, chunkIndex: number, isLast: boolean) => void;
  onRecordingComplete: (totalChunks: number, duration: number) => void;
  onError: (error: string) => void;
  maxDuration?: number; // seconds
  chunkDuration?: number; // seconds
  disabled?: boolean;
}

interface AudioChunk {
  blob: Blob;
  timestamp: number;
  chunkIndex: number;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onAudioChunk,
  onRecordingComplete,
  onError,
  maxDuration = 300, // 5 minutes default
  chunkDuration = 30, // 30 seconds per chunk as per requirements
  disabled = false,
}) => {
  const { getLocalizedText } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<AudioChunk[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Audio level monitoring for visual feedback
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    setAudioLevel(average / 255); // Normalize to 0-1

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
    }
  }, [isRecording]);

  // Start recording with chunked processing
  const startRecording = async () => {
    try {
      // Request microphone access with high-quality audio settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Optimized for Bhashini API
          channelCount: 1, // Mono audio
        },
      });

      streamRef.current = stream;

      // Set up audio context for level monitoring
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Configure MediaRecorder for chunked recording
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus', // Efficient codec for streaming
        audioBitsPerSecond: 32000, // Balanced quality/size
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setCurrentChunk(0);
      setIsRecording(true);
      setRecordingTime(0);

      // Handle data available (chunk ready)
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const chunk: AudioChunk = {
            blob: event.data,
            timestamp: Date.now(),
            chunkIndex: audioChunksRef.current.length,
          };
          
          audioChunksRef.current.push(chunk);
          
          // Send chunk immediately for streaming processing
          const isLastChunk = recordingTime >= maxDuration;
          onAudioChunk(event.data, chunk.chunkIndex, isLastChunk);
          
          setCurrentChunk(chunk.chunkIndex + 1);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        const totalDuration = recordingTime;
        const totalChunks = audioChunksRef.current.length;
        onRecordingComplete(totalChunks, totalDuration);
        cleanup();
      };

      // Start recording
      mediaRecorder.start();

      // Set up chunk timer (30-second intervals)
      chunkTimerRef.current = setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData(); // Force chunk creation
        }
      }, chunkDuration * 1000);

      // Set up recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          
          // Auto-stop at max duration
          if (newTime >= maxDuration) {
            stopRecording();
          }
          
          return newTime;
        });
      }, 1000);

      // Start audio level monitoring
      monitorAudioLevel();

    } catch (error) {
      console.error('Failed to start recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Permission denied')) {
        onError('Microphone access denied. Please enable microphone permissions and try again.');
      } else if (errorMessage.includes('NotFound')) {
        onError('No microphone found. Please connect a microphone and try again.');
      } else {
        onError(`Failed to start recording: ${errorMessage}`);
      }
      
      cleanup();
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Cleanup resources
  const cleanup = () => {
    // Stop timers
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Reset state
    setRecordingTime(0);
    setCurrentChunk(0);
    setAudioLevel(0);
    audioChunksRef.current = [];
  };

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, []);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercentage = (recordingTime / maxDuration) * 100;
  const chunkProgress = ((recordingTime % chunkDuration) / chunkDuration) * 100;

  return (
    <div className="flex flex-col items-center space-y-4 p-4 bg-white rounded-lg shadow-sm border">
      {/* Recording Status */}
      {isRecording && (
        <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-700 font-medium">
                {getLocalizedText('recording')} - Chunk {currentChunk + 1}
              </span>
            </div>
            <span className="text-red-600 font-mono">
              {formatTime(recordingTime)} / {formatTime(maxDuration)}
            </span>
          </div>
          
          {/* Progress bars */}
          <div className="mt-2 space-y-1">
            {/* Overall progress */}
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div 
                className="bg-red-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
            
            {/* Current chunk progress */}
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div 
                className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${chunkProgress}%` }}
              />
            </div>
          </div>
          
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>Overall Progress</span>
            <span>Current Chunk ({chunkDuration}s)</span>
          </div>
        </div>
      )}

      {/* Audio Level Indicator */}
      {isRecording && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Audio Level:</span>
          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex items-center space-x-4">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled}
          className={`p-4 rounded-full transition-all duration-200 ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg scale-110'
              : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg'
          } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
          title={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Recording info */}
        <div className="text-center">
          <div className="text-sm font-medium text-gray-700">
            {isRecording ? 'Recording...' : 'Ready to Record'}
          </div>
          <div className="text-xs text-gray-500">
            {chunkDuration}s chunks, max {formatTime(maxDuration)}
          </div>
        </div>
      </div>

      {/* Recording Statistics */}
      {currentChunk > 0 && (
        <div className="w-full bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-600 text-center">
            <div>Chunks recorded: {currentChunk}</div>
            <div>Total duration: {formatTime(recordingTime)}</div>
          </div>
        </div>
      )}
    </div>
  );
};