import React from 'react';
import { ChatMessage as ChatMessageType } from '../../types';
import { CULTURAL_ICONS } from '../../constants';
import { formatDistanceToNow } from 'date-fns';

interface ChatMessageProps {
  message: ChatMessageType;
  isOwn: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isOwn }) => {
  const formatTime = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  const getCulturalIcon = (analogy?: string) => {
    if (!analogy) return null;
    
    const lowerAnalogy = analogy.toLowerCase();
    for (const [key, icon] of Object.entries(CULTURAL_ICONS)) {
      if (lowerAnalogy.includes(key)) {
        return icon;
      }
    }
    return '🎯'; // Default icon
  };

  if (isOwn) {
    // Student message
    return (
      <div className="flex justify-end mb-4 chat-bubble-enter">
        <div className="chat-bubble-student">
          <p className="text-sm">{message.content}</p>
          <p className="text-xs text-primary-100 mt-1 opacity-75">
            {formatTime(message.timestamp)}
          </p>
        </div>
      </div>
    );
  }

  // Mentor message
  return (
    <div className="flex justify-start mb-4 chat-bubble-enter">
      <div className="flex-shrink-0 mr-3">
        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-bold">सू</span>
        </div>
      </div>
      
      <div className="flex-1 max-w-md">
        <div className="chat-bubble-mentor">
          {/* Cultural analogy section */}
          {message.culturalAnalogy && (
            <div className="cultural-analogy mb-3">
              <div className="flex items-center mb-2">
                <span className="text-lg mr-2">
                  {getCulturalIcon(message.culturalAnalogy)}
                </span>
                <span className="text-xs font-medium text-cultural-saffron uppercase tracking-wide">
                  Cultural Context
                </span>
              </div>
              <p className="text-sm text-gray-700 italic">
                {message.culturalAnalogy}
              </p>
            </div>
          )}
          
          {/* Main message content */}
          <p className="text-sm text-gray-800 leading-relaxed">
            {message.content}
          </p>
          
          {/* Follow-up questions */}
          {message.followUpQuestions && message.followUpQuestions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-2">
                Think about this:
              </p>
              <ul className="space-y-1">
                {message.followUpQuestions.map((question, index) => (
                  <li key={index} className="text-xs text-gray-600 flex items-start">
                    <span className="text-primary-500 mr-1">•</span>
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <p className="text-xs text-gray-400 mt-2">
            {formatTime(message.timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
};