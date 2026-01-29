import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ChatMessage } from '../../components/chat/ChatMessage';
import { ChatInput } from '../../components/chat/ChatInput';
import { ChatHeader } from '../../components/chat/ChatHeader';
import { LanguageSelector } from '../../components/common/LanguageSelector';
import { ConnectionStatus } from '../../components/chat/ConnectionStatus';
import { CHAT_CONFIG } from '../../constants';

export const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    messages, 
    sendMessage, 
    isTyping, 
    isConnected, 
    loadingState,
    startNewSession,
    clearChat 
  } = useChat();
  const { getLocalizedText } = useLanguage();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isNearBottom]);

  // Handle scroll to detect if user is near bottom
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNear = scrollHeight - scrollTop - clientHeight < CHAT_CONFIG.AUTO_SCROLL_THRESHOLD;
    setIsNearBottom(isNear);
  };

  // Handle sending message
  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  // Handle voice message
  const handleVoiceMessage = async (audioBlob: Blob) => {
    // This will be implemented when we add voice functionality
    console.log('Voice message received:', audioBlob);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading user data..." />
      </div>
    );
  }

  return (
    <div className="mobile-chat-container">
      {/* Header */}
      <div className="mobile-chat-header">
        <ChatHeader 
          user={user}
          isConnected={isConnected}
          onNewSession={startNewSession}
          onClearChat={clearChat}
        />
        <div className="flex items-center space-x-2">
          <LanguageSelector />
          <ConnectionStatus isConnected={isConnected} />
        </div>
      </div>

      {/* Messages */}
      <div 
        className="mobile-chat-messages"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-4">
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl">🏏</span>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {getLocalizedText('welcome')}
              </h2>
              <p className="text-gray-600 mb-4">
                I'm your Socratic AI Mentor. Ask me any programming question and I'll guide you to the answer using familiar Indian contexts!
              </p>
              <div className="text-sm text-gray-500">
                <p>Try asking about:</p>
                <ul className="mt-2 space-y-1">
                  <li>• "How do sorting algorithms work?"</li>
                  <li>• "Explain recursion to me"</li>
                  <li>• "What are data structures?"</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage 
                key={message.id} 
                message={message}
                isOwn={message.type === 'student'}
              />
            ))}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start mb-4">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 max-w-md shadow-sm">
                  <div className="typing-indicator">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {getLocalizedText('typing')}
                  </p>
                </div>
              </div>
            )}
            
            {/* Loading state */}
            {loadingState.isLoading && (
              <div className="flex justify-center mb-4">
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
                  <LoadingSpinner size="sm" message={loadingState.message} />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="mobile-chat-input">
        <ChatInput 
          onSendMessage={handleSendMessage}
          onVoiceMessage={handleVoiceMessage}
          disabled={loadingState.isLoading}
          placeholder="Ask me about programming concepts..."
        />
      </div>
    </div>
  );
};