import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface ConnectionStatusProps {
  isConnected: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnected }) => {
  const { getLocalizedText } = useLanguage();

  return (
    <div className="flex items-center space-x-1">
      <div
        className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      <span className="text-xs text-gray-600">
        {isConnected ? getLocalizedText('connected') : getLocalizedText('disconnected')}
      </span>
    </div>
  );
};