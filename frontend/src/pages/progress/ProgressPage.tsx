import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

export const ProgressPage: React.FC = () => {
  const { getLocalizedText } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {getLocalizedText('progress')}
          </h1>
          
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              Progress Tracking Coming Soon
            </h2>
            <p className="text-gray-600">
              We're building comprehensive analytics to track your learning journey and grit development.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};