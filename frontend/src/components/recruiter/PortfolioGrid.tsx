import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AcademicCapIcon,
  TrophyIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { StudentPortfolioCard } from './StudentPortfolioCard';
import { PortfolioModal } from './PortfolioModal';

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

interface PortfolioGridProps {
  portfolios: Portfolio[];
  selectedStudents: string[];
  onSelectionChange: (selected: string[]) => void;
  onSearch: (filters: any) => void;
}

export const PortfolioGrid: React.FC<PortfolioGridProps> = ({
  portfolios,
  selectedStudents,
  onSelectionChange,
  onSearch
}) => {
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [sortBy, setSortBy] = useState<'gritScore' | 'industryReadiness' | 'lastActive'>('gritScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const handleStudentSelect = (studentId: string) => {
    const isSelected = selectedStudents.includes(studentId);
    if (isSelected) {
      onSelectionChange(selectedStudents.filter(id => id !== studentId));
    } else {
      onSelectionChange([...selectedStudents, studentId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === portfolios.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(portfolios.map(p => p.studentId));
    }
  };

  const sortedPortfolios = [...portfolios].sort((a, b) => {
    let aValue: number;
    let bValue: number;

    switch (sortBy) {
      case 'gritScore':
        aValue = a.gritScore.overallScore;
        bValue = b.gritScore.overallScore;
        break;
      case 'industryReadiness':
        aValue = a.portfolioMetrics.industryReadiness;
        bValue = b.portfolioMetrics.industryReadiness;
        break;
      case 'lastActive':
        aValue = a.personalInfo.lastActive;
        bValue = b.personalInfo.lastActive;
        break;
      default:
        aValue = a.gritScore.overallScore;
        bValue = b.gritScore.overallScore;
    }

    return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
  });

  const getGritScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getIndustryReadinessColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-100';
    if (score >= 60) return 'text-blue-600 bg-blue-100';
    return 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Student Portfolios</h2>
            <p className="text-gray-600 mt-1">
              {portfolios.length} students • {selectedStudents.length} selected
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Sort Controls */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="gritScore">Grit Score</option>
                <option value="industryReadiness">Industry Readiness</option>
                <option value="lastActive">Last Active</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="p-1 text-gray-500 hover:text-gray-700"
              >
                {sortOrder === 'desc' ? '↓' : '↑'}
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex border border-gray-300 rounded-md">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 text-sm ${
                  viewMode === 'grid' ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-sm ${
                  viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                }`}
              >
                List
              </button>
            </div>

            {/* Select All */}
            <button
              onClick={handleSelectAll}
              className="flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <CheckCircleIcon className="h-4 w-4 mr-1" />
              {selectedStudents.length === portfolios.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPortfolios.map((portfolio, index) => (
            <motion.div
              key={portfolio.studentId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <StudentPortfolioCard
                portfolio={portfolio}
                isSelected={selectedStudents.includes(portfolio.studentId)}
                onSelect={() => handleStudentSelect(portfolio.studentId)}
                onViewDetails={() => setSelectedPortfolio(portfolio)}
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedStudents.length === portfolios.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grit Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Industry Readiness
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Skills
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Learning Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedPortfolios.map((portfolio) => (
                  <tr key={portfolio.studentId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(portfolio.studentId)}
                        onChange={() => handleStudentSelect(portfolio.studentId)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-sm">
                              {portfolio.personalInfo.name.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {portfolio.personalInfo.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {portfolio.personalInfo.college}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getGritScoreColor(portfolio.gritScore.overallScore)}`}>
                        {portfolio.gritScore.overallScore}/100
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getIndustryReadinessColor(portfolio.portfolioMetrics.industryReadiness)}`}>
                        {portfolio.portfolioMetrics.industryReadiness}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {portfolio.skillAssessment.programmingLanguages.slice(0, 3).map((lang) => (
                          <span key={lang} className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                            {lang}
                          </span>
                        ))}
                        {portfolio.skillAssessment.programmingLanguages.length > 3 && (
                          <span className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                            +{portfolio.skillAssessment.programmingLanguages.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Math.round(portfolio.learningMetrics.totalLearningTime / 3600000)}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setSelectedPortfolio(portfolio)}
                        className="text-blue-600 hover:text-blue-900 flex items-center"
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {portfolios.length === 0 && (
        <div className="text-center py-12">
          <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No portfolios found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search criteria or check back later.
          </p>
        </div>
      )}

      {/* Portfolio Detail Modal */}
      {selectedPortfolio && (
        <PortfolioModal
          portfolio={selectedPortfolio}
          isOpen={!!selectedPortfolio}
          onClose={() => setSelectedPortfolio(null)}
        />
      )}
    </div>
  );
};