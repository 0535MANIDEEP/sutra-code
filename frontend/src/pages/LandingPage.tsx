import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

export const LandingPage: React.FC = () => {
  const { getLocalizedText } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">सू</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Sutra-Code</h1>
              <p className="text-sm text-gray-600">Socratic AI Mentor</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link
              to="/auth/signin"
              className="text-gray-700 hover:text-gray-900 font-medium"
            >
              {getLocalizedText('signIn')}
            </Link>
            <Link
              to="/auth/signup"
              className="btn-primary"
            >
              {getLocalizedText('signUp')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="px-4 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              From Copy-Paste to
              <span className="bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent"> Problem-Solver</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Master programming through Socratic questioning with culturally relevant Indian contexts. 
              No more shortcuts - build genuine understanding that lasts.
            </p>
          </div>

          {/* Cultural Icons */}
          <div className="flex justify-center space-x-8 mb-12 text-4xl">
            <span title="Cricket">🏏</span>
            <span title="Mandi">🏪</span>
            <span title="Festivals">🎉</span>
            <span title="Railways">🚂</span>
            <span title="Bollywood">🎬</span>
          </div>

          {/* CTA */}
          <div className="space-y-4">
            <Link
              to="/auth/signup"
              className="inline-block bg-primary-500 hover:bg-primary-600 text-white font-semibold px-8 py-4 rounded-lg text-lg transition-colors duration-200"
            >
              Start Learning with Socratic AI
            </Link>
            <p className="text-sm text-gray-500">
              Free for students • 22 Indian languages supported
            </p>
          </div>

          {/* Features */}
          <div className="mt-20 grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🤔</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Socratic Questioning
              </h3>
              <p className="text-gray-600">
                Learn through guided questions that build deep understanding, not memorization.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🇮🇳</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Cultural Context
              </h3>
              <p className="text-gray-600">
                Programming concepts explained through familiar Indian contexts and analogies.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💪</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Grit Development
              </h3>
              <p className="text-gray-600">
                Build resilience and problem-solving skills that employers value.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-8 border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto text-center text-gray-600">
          <p>&copy; 2024 Sutra-Code. Built for Viksit Bharat 2047.</p>
        </div>
      </footer>
    </div>
  );
};