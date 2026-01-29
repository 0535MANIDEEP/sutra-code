import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  ChatMessage, 
  ChatSession, 
  SocraticResponse, 
  ConversationContext,
  LoadingState 
} from '../types';
import { apiService } from '../services/apiService';
import { websocketService } from '../services/websocketService';
import { useAuth } from './AuthContext';
import { STORAGE_KEYS, CHAT_CONFIG } from '../constants';
import toast from 'react-hot-toast';

interface ChatContextType {
  // State
  messages: ChatMessage[];
  currentSession: ChatSession | null;
  conversationContext: ConversationContext | null;
  isTyping: boolean;
  isConnected: boolean;
  loadingState: LoadingState;
  
  // Actions
  sendMessage: (content: string) => Promise<void>;
  startNewSession: () => void;
  loadSession: (sessionId: string) => Promise<void>;
  clearChat: () => void;
  setTyping: (isTyping: boolean) => void;
  
  // Voice
  sendVoiceMessage: (audioBlob: Blob, language: string) => Promise<void>;
  
  // Feedback
  provideFeedback: (analogyId: string, effectiveness: number, feedback?: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [conversationContext, setConversationContext] = useState<ConversationContext | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: false });

  // Initialize chat when user is authenticated
  useEffect(() => {
    if (user) {
      initializeChat();
      setupWebSocketListeners();
    } else {
      clearChat();
    }

    return () => {
      cleanupWebSocketListeners();
    };
  }, [user]);

  // Initialize chat session
  const initializeChat = useCallback(() => {
    // Load chat history from localStorage
    const savedMessages = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
        
        // Get the latest session
        if (parsedMessages.length > 0) {
          const latestMessage = parsedMessages[parsedMessages.length - 1];
          loadSession(latestMessage.sessionId);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    }

    // Start new session if no existing session
    if (!currentSession) {
      startNewSession();
    }
  }, [currentSession]);

  // Setup WebSocket event listeners
  const setupWebSocketListeners = useCallback(() => {
    websocketService.on('connected', () => {
      setIsConnected(true);
      if (currentSession) {
        websocketService.joinSession(currentSession.sessionId);
      }
    });

    websocketService.on('disconnected', () => {
      setIsConnected(false);
    });

    websocketService.on('message', (data: ChatMessage) => {
      addMessage(data);
    });

    websocketService.on('typing', (data: { sessionId: string; isTyping: boolean }) => {
      if (data.sessionId === currentSession?.sessionId) {
        setIsTyping(data.isTyping);
      }
    });

    websocketService.on('sessionUpdate', (data: any) => {
      // Handle session updates
      console.log('Session update:', data);
    });

    websocketService.on('error', (data: any) => {
      console.error('WebSocket error:', data);
      toast.error('Connection error occurred');
    });
  }, [currentSession]);

  // Cleanup WebSocket listeners
  const cleanupWebSocketListeners = useCallback(() => {
    websocketService.off('connected', () => {});
    websocketService.off('disconnected', () => {});
    websocketService.off('message', () => {});
    websocketService.off('typing', () => {});
    websocketService.off('sessionUpdate', () => {});
    websocketService.off('error', () => {});
  }, []);

  // Add message to chat
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      const newMessages = [...prev, message];
      // Keep only last 100 messages for performance
      const trimmedMessages = newMessages.slice(-100);
      
      // Save to localStorage
      localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(trimmedMessages));
      
      return trimmedMessages;
    });
  }, []);

  // Send message
  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!user || !currentSession || content.trim().length === 0) {
      return;
    }

    if (content.length > CHAT_CONFIG.MAX_MESSAGE_LENGTH) {
      toast.error(`Message too long. Maximum ${CHAT_CONFIG.MAX_MESSAGE_LENGTH} characters allowed.`);
      return;
    }

    setLoadingState({ isLoading: true, message: 'Sending message...' });

    try {
      // Create student message
      const studentMessage: ChatMessage = {
        id: uuidv4(),
        type: 'student',
        content: content.trim(),
        timestamp: Date.now(),
        sessionId: currentSession.sessionId,
      };

      // Add student message immediately
      addMessage(studentMessage);

      // Send via WebSocket if connected, otherwise use API
      if (isConnected) {
        websocketService.sendChatMessage(studentMessage);
      }

      // Get Socratic response from API
      const response = await apiService.askSocraticQuestion(
        user.userId,
        content,
        currentSession.sessionId,
        user.preferredLanguage
      );

      if (response.success && response.data) {
        const socraticResponse = response.data;
        
        // Create mentor message
        const mentorMessage: ChatMessage = {
          id: uuidv4(),
          type: 'mentor',
          content: socraticResponse.guidingQuestion,
          timestamp: Date.now(),
          sessionId: currentSession.sessionId,
          culturalAnalogy: socraticResponse.culturalAnalogy,
          followUpQuestions: socraticResponse.nextStepIndicator ? [socraticResponse.nextStepIndicator] : undefined,
        };

        // Add mentor message
        addMessage(mentorMessage);

        // Update conversation context
        setConversationContext(socraticResponse.sessionState);

        // Send via WebSocket if connected
        if (isConnected) {
          websocketService.sendChatMessage(mentorMessage);
        }

      } else {
        throw new Error(response.error?.message || 'Failed to get response');
      }

    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast.error(error.message || 'Failed to send message');
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        type: 'mentor',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
        sessionId: currentSession.sessionId,
      };
      addMessage(errorMessage);
    } finally {
      setLoadingState({ isLoading: false });
    }
  }, [user, currentSession, isConnected, addMessage]);

  // Send voice message
  const sendVoiceMessage = useCallback(async (audioBlob: Blob, language: string): Promise<void> => {
    if (!user || !currentSession) {
      return;
    }

    setLoadingState({ isLoading: true, message: 'Processing voice message...' });

    try {
      const response = await apiService.uploadVoiceRecording(
        audioBlob,
        currentSession.sessionId,
        language
      );

      if (response.success && response.data) {
        // Send the transcribed text as a regular message
        await sendMessage(response.data.transcription);
        toast.success('Voice message processed successfully!');
      } else {
        throw new Error(response.error?.message || 'Failed to process voice message');
      }

    } catch (error: any) {
      console.error('Failed to send voice message:', error);
      toast.error(error.message || 'Failed to process voice message');
    } finally {
      setLoadingState({ isLoading: false });
    }
  }, [user, currentSession, sendMessage]);

  // Start new session
  const startNewSession = useCallback(() => {
    if (!user) return;

    const newSession: ChatSession = {
      sessionId: uuidv4(),
      studentId: user.userId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      isActive: true,
    };

    setCurrentSession(newSession);
    setConversationContext(null);

    // Join session via WebSocket if connected
    if (isConnected) {
      websocketService.joinSession(newSession.sessionId);
    }

    // Add welcome message
    const welcomeMessage: ChatMessage = {
      id: uuidv4(),
      type: 'mentor',
      content: `Namaste! I'm your Socratic AI Mentor. I'm here to guide you through programming concepts using familiar Indian contexts. What would you like to explore today?`,
      timestamp: Date.now(),
      sessionId: newSession.sessionId,
    };

    addMessage(welcomeMessage);
  }, [user, isConnected, addMessage]);

  // Load existing session
  const loadSession = useCallback(async (sessionId: string): Promise<void> => {
    if (!user) return;

    setLoadingState({ isLoading: true, message: 'Loading session...' });

    try {
      // Get conversation context
      const response = await apiService.getConversationContext(sessionId);
      
      if (response.success && response.data) {
        setConversationContext(response.data);
      }

      // Create session object
      const session: ChatSession = {
        sessionId,
        studentId: user.userId,
        startTime: Date.now(), // This should come from API in real implementation
        lastActivity: Date.now(),
        messageCount: messages.filter(m => m.sessionId === sessionId).length,
        isActive: true,
      };

      setCurrentSession(session);

      // Join session via WebSocket if connected
      if (isConnected) {
        websocketService.joinSession(sessionId);
      }

    } catch (error: any) {
      console.error('Failed to load session:', error);
      toast.error('Failed to load session');
    } finally {
      setLoadingState({ isLoading: false });
    }
  }, [user, messages, isConnected]);

  // Clear chat
  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentSession(null);
    setConversationContext(null);
    localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
  }, []);

  // Set typing indicator
  const setTyping = useCallback((typing: boolean) => {
    if (currentSession && isConnected) {
      websocketService.sendTypingIndicator(currentSession.sessionId, typing);
    }
  }, [currentSession, isConnected]);

  // Provide feedback on analogy
  const provideFeedback = useCallback(async (
    analogyId: string, 
    effectiveness: number, 
    feedback?: string
  ): Promise<void> => {
    try {
      const response = await apiService.provideFeedback(analogyId, effectiveness, feedback);
      
      if (response.success) {
        toast.success('Thank you for your feedback!');
      } else {
        throw new Error(response.error?.message || 'Failed to submit feedback');
      }
    } catch (error: any) {
      console.error('Failed to provide feedback:', error);
      toast.error('Failed to submit feedback');
    }
  }, []);

  const value: ChatContextType = {
    // State
    messages,
    currentSession,
    conversationContext,
    isTyping,
    isConnected,
    loadingState,
    
    // Actions
    sendMessage,
    startNewSession,
    loadSession,
    clearChat,
    setTyping,
    
    // Voice
    sendVoiceMessage,
    
    // Feedback
    provideFeedback,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};