import React from 'react';
import { motion } from 'framer-motion';
import {
  AcademicCapIcon,
  TrophyIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  EyeIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';

interface Portfolio {
  studentId: string;
  personalInfo: {
    name: string;
    college: string;
    location: string;
    graduationYear: number;
    lastActive: number;
  };
  gritScore: {
    overallScore: number;
    persistence: number;
    resilience: number;
    curiosity: number;
  };
  learningMetrics: {
    totalLearningTime: number;
    conceptsMastered: number;
    learningVelocity: number;
    focusQualityScore: number;
  };
  skillAssessment: {
    programmingLanguages: string[];
    algorithmicThinking: number;
    problemSolving: number;
    communication: number;
  };
  portfolioMetrics: {
    portfolioCompleteness: number;
    industryReadiness: number;
    hiringProbability: number;
  };
}

interface StudentPortfolioCardProps {
  portfolio: Portfolio;
  isSelected: boolean;
  onSelect: () => void;
  onViewDetails: () => void;
}

export const StudentPortfolioCard: React.FC<StudentPortfolioCardProps> = ({
  portfolio,
  isSelected,
  onSelect,
  onViewDetails
}) => {
  const getGritScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    return 'text-red-600 bg-red-100 border-red-200';
  };

  const getIndustryReadinessLevel = (score: number) => {
    if (score >= 80) return { label: 'Ready', color: 'text-green-600 bg-green-100' };
    if (score >= 60) return { label: 'Developing', color: 'text-blue-600 bg-blue-100' };
    return { label: 'Learning', color: 'text-gray-600 bg-gray-100' };
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const formatLearningTime = (milliseconds: number) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    if (hours < 1) return '<1h';
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  };

  const readinessLevel = getIndustryReadinessLevel(portfolio.portfolioMetrics.industryReadiness);

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className={`bg-white rounded-xl shadow-md border-2 transition-all duration-200 ${
        isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Card Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                {portfolio.personalInfo.name.charAt(0)}
              </div>
              {portfolio.gritScore.overallScore >= 80 && (
                <div className="absolute -top-1 -right-1 h-5 w-5 bg-yellow-400 rounded-full flex items-center justify-center">
                  <StarIcon className="h-3 w-3 text-yellow-800" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {portfolio.personalInfo.name}
              </h3>
              <div className="flex items-center text-sm text-gray-600 mt-1">
                <AcademicCapIcon className="h-4 w-4 mr-1" />
                <span className="truncate">{portfolio.personalInfo.college}</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={onSelect}
            className={`p-2 rounded-full transition-colors ${
              isSelected 
                ? 'text-blue-600 bg-blue-100' 
                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
            }`}
          >
            {isSelected ? (
              <CheckCircleIconSolid className="h-6 w-6" />
            ) : (
              <CheckCircleIcon className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Location and Last Active */}
        <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
          <div className="flex items-center">
            <MapPinIcon className="h-4 w-4 mr-1" />
            <span>{portfolio.personalInfo.location}</span>
          </div>
          <div className="flex items-center">
            <ClockIcon className="h-4 w-4 mr-1" />
            <span>{formatTimeAgo(portfolio.personalInfo.lastActive)}</span>
          </div>
        </div>
      </div>

      {/* Metrics Section */}
      <div className="px-6 pb-4">
        {/* Grit Score */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Grit Score</span>
          <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${getGritScoreColor(portfolio.gritScore.overallScore)}`}>
            {portfolio.gritScore.overallScore}/100
          </div>
        </div>

        {/* Industry Readiness */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Industry Readiness</span>
          <div className={`px-3 py-1 rounded-full text-sm font-semibold ${readinessLevel.color}`}>
            {readinessLevel.label} ({portfolio.portfolioMetrics.industryReadiness}%)
          </div>
        </div>

        {/* Learning Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-900">
              {formatLearningTime(portfolio.learningMetrics.totalLearningTime)}
            </div>
            <div className="text-xs text-gray-600">Learning Time</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-900">
              {portfolio.learningMetrics.conceptsMastered}
            </div>
            <div className="text-xs text-gray-600">Concepts Mastered</div>
          </div>
        </div>

        {/* Skills */}
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">Programming Languages</div>
          <div className="flex flex-wrap gap-1">
            {portfolio.skillAssessment.programmingLanguages.slice(0, 4).map((lang) => (
              <span
                key={lang}
                className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-md"
              >
                {lang}
              </span>
            ))}
            {portfolio.skillAssessment.programmingLanguages.length > 4 && (
              <span className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md">
                +{portfolio.skillAssessment.programmingLanguages.length - 4} more
              </span>
            )}
          </div>
        </div>

        {/* Hiring Probability */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Hiring Probability</span>
            <span className="font-semibold text-purple-600">
              {Math.round(portfolio.portfolioMetrics.hiringProbability * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${portfolio.portfolioMetrics.hiringProbability * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="px-6 pb-6">
        <button
          onClick={onViewDetails}
          className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <EyeIcon className="h-4 w-4 mr-2" />
          View Full Portfolio
        </button>
      </div>
    </motion.div>
  );
};