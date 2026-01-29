import React, { useState } from 'react';
import { AuthUser } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface ChatHeaderProps {
  user: AuthUser;
  isConnected: boolean;
  onNewSession: () => void;
  onClearChat: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  user,
  isConnected,
  onNewSession,
  onClearChat
}) => {
  const { getLocalizedText } = useLanguage();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        {/* Logo/Avatar */}
        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-lg">सू</span>
        </div>
        
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            Sutra-Code
          </h1>
          <p className="text-xs text-gray-500">
            Socratic AI Mentor
          </p>
        </div>
      </div>

      {/* Menu */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            <button
              onClick={() => {
                onNewSession();
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>New Session</span>
            </button>
            
            <button
              onClick={() => {
                onClearChat();
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Clear Chat</span>
            </button>
            
            <div className="border-t border-gray-100 my-1"></div>
            
            <div className="px-4 py-2">
              <div className="text-xs text-gray-500 mb-1">Grit Score</div>
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${user.gritScore}%` }}
                  ></div>
                </div>
                <span className="text-xs font-medium text-gray-700">
                  {user.gritScore}/100
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};