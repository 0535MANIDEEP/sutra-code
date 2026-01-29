import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  AcademicCapIcon,
  TrophyIcon,
  ClockIcon,
  MapPinIcon,
  StarIcon,
  ChartBarIcon,
  CodeBracketIcon,
  ChatBubbleLeftRightIcon,
  ArrowDownTrayIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar
} from 'recharts';

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

interface PortfolioModalProps {
  portfolio: Portfolio;
  isOpen: boolean;
  onClose: () => void;
}

export const PortfolioModal: React.FC<PortfolioModalProps> = ({
  portfolio,
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'learning' | 'projects'>('overview');

  // Mock data for detailed analytics
  const learningProgressData = [
    { week: 'Week 1', concepts: 5, time: 12 },
    { week: 'Week 2', concepts: 8, time: 18 },
    { week: 'Week 3', concepts: 12, time: 25 },
    { week: 'Week 4', concepts: 15, time: 30 },
    { week: 'Week 5', concepts: 20, time: 35 },
    { week: 'Week 6', concepts: 25, time: 40 }
  ];

  const skillsRadarData = [
    { skill: 'Persistence', score: portfolio.gritScore.persistence },
    { skill: 'Resilience', score: portfolio.gritScore.resilience },
    { skill: 'Curiosity', score: portfolio.gritScore.curiosity },
    { skill: 'Algorithmic Thinking', score: portfolio.skillAssessment.algorithmicThinking },
    { skill: 'Problem Solving', score: portfolio.skillAssessment.problemSolving },
    { skill: 'Communication', score: portfolio.skillAssessment.communication }
  ];

  const strugglesData = [
    { category: 'Syntax Errors', count: 45, resolved: 42 },
    { category: 'Logic Errors', count: 28, resolved: 25 },
    { category: 'Algorithm Design', count: 15, resolved: 12 },
    { category: 'Debugging', count: 32, resolved: 30 }
  ];

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
    return `${hours} hours`;
  };

  const getGritScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: EyeIcon },
    { id: 'skills', label: 'Skills Analysis', icon: ChartBarIcon },
    { id: 'learning', label: 'Learning Journey', icon: AcademicCapIcon },
    { id: 'projects', label: 'Projects & Code', icon: CodeBracketIcon }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={onClose}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="inline-block w-full max-w-6xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-6 border-b border-gray-200">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl">
                      {portfolio.personalInfo.name.charAt(0)}
                    </div>
                    {portfolio.gritScore.overallScore >= 80 && (
                      <div className="absolute -top-1 -right-1 h-6 w-6 bg-yellow-400 rounded-full flex items-center justify-center">
                        <StarIcon className="h-4 w-4 text-yellow-800" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {portfolio.personalInfo.name}
                    </h2>
                    <div className="flex items-center text-gray-600 mt-1">
                      <AcademicCapIcon className="h-4 w-4 mr-1" />
                      <span>{portfolio.personalInfo.college}</span>
                      <span className="mx-2">•</span>
                      <MapPinIcon className="h-4 w-4 mr-1" />
                      <span>{portfolio.personalInfo.location}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      <span>Last active {formatTimeAgo(portfolio.personalInfo.lastActive)}</span>
                      <span className="mx-2">•</span>
                      <span>Graduating {portfolio.personalInfo.graduationYear}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Export Portfolio
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-4 py-6 border-b border-gray-200">
                <div className="text-center">
                  <div className={`inline-flex px-4 py-2 rounded-full text-lg font-bold ${getGritScoreColor(portfolio.gritScore.overallScore)}`}>
                    {portfolio.gritScore.overallScore}/100
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Grit Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {portfolio.portfolioMetrics.industryReadiness}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Industry Ready</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(portfolio.portfolioMetrics.hiringProbability * 100)}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Hiring Probability</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatLearningTime(portfolio.learningMetrics.totalLearningTime)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Learning Time</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex space-x-1 mt-6 mb-6 bg-gray-100 p-1 rounded-lg">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as any)}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === id
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="min-h-96">
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Grit Score Breakdown */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Grit Score Breakdown</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700">Persistence</span>
                          <div className="flex items-center">
                            <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${portfolio.gritScore.persistence}%` }}
                              />
                            </div>
                            <span className="font-semibold">{portfolio.gritScore.persistence}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700">Resilience</span>
                          <div className="flex items-center">
                            <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                              <div
                                className="bg-green-600 h-2 rounded-full"
                                style={{ width: `${portfolio.gritScore.resilience}%` }}
                              />
                            </div>
                            <span className="font-semibold">{portfolio.gritScore.resilience}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700">Curiosity</span>
                          <div className="flex items-center">
                            <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                              <div
                                className="bg-purple-600 h-2 rounded-full"
                                style={{ width: `${portfolio.gritScore.curiosity}%` }}
                              />
                            </div>
                            <span className="font-semibold">{portfolio.gritScore.curiosity}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Programming Languages */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Programming Languages</h3>
                      <div className="flex flex-wrap gap-2">
                        {portfolio.skillAssessment.programmingLanguages.map((lang) => (
                          <span
                            key={lang}
                            className="inline-flex px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700">Algorithmic Thinking</span>
                          <span className="font-semibold">{portfolio.skillAssessment.algorithmicThinking}/100</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700">Problem Solving</span>
                          <span className="font-semibold">{portfolio.skillAssessment.problemSolving}/100</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700">Communication</span>
                          <span className="font-semibold">{portfolio.skillAssessment.communication}/100</span>
                        </div>
                      </div>
                    </div>

                    {/* Learning Metrics */}
                    <div className="bg-gray-50 rounded-lg p-6 lg:col-span-2">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Metrics</h3>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {portfolio.learningMetrics.conceptsMastered}
                          </div>
                          <div className="text-sm text-gray-600">Concepts Mastered</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {portfolio.learningMetrics.learningVelocity}
                          </div>
                          <div className="text-sm text-gray-600">Learning Velocity</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {portfolio.learningMetrics.focusQualityScore}
                          </div>
                          <div className="text-sm text-gray-600">Focus Quality</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {portfolio.portfolioMetrics.portfolioCompleteness}%
                          </div>
                          <div className="text-sm text-gray-600">Portfolio Complete</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'skills' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills Radar</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={skillsRadarData}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="skill" />
                            <PolarRadiusAxis angle={90} domain={[0, 100]} />
                            <Radar
                              name="Skills"
                              dataKey="score"
                              stroke="#3B82F6"
                              fill="#3B82F6"
                              fillOpacity={0.3}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Struggle Analysis</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={strugglesData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="category" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#EF4444" name="Total Struggles" />
                            <Bar dataKey="resolved" fill="#10B981" name="Resolved" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'learning' && (
                  <div className="space-y-6">
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Progress Over Time</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={learningProgressData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="week" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="concepts" stroke="#3B82F6" name="Concepts Learned" />
                            <Line type="monotone" dataKey="time" stroke="#10B981" name="Hours Spent" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Milestones</h3>
                        <div className="space-y-3">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                            <span className="text-sm">Completed Data Structures module</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                            <span className="text-sm">Mastered sorting algorithms</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                            <span className="text-sm">Working on dynamic programming</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-gray-300 rounded-full mr-3"></div>
                            <span className="text-sm">Graph algorithms (upcoming)</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Voice Viva Performance</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-700">Average Score</span>
                            <span className="font-semibold">85%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-700">Sessions Completed</span>
                            <span className="font-semibold">12</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-700">Concepts Explained</span>
                            <span className="font-semibold">45</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-700">Language Preference</span>
                            <span className="font-semibold">Hindi + English</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'projects' && (
                  <div className="space-y-6">
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">GitHub Portfolio</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="font-medium text-gray-900">E-commerce Backend</h4>
                          <p className="text-sm text-gray-600 mt-1">Node.js, Express, MongoDB</p>
                          <div className="flex items-center mt-2 text-xs text-gray-500">
                            <span>⭐ 15 stars</span>
                            <span className="mx-2">•</span>
                            <span>🍴 8 forks</span>
                            <span className="mx-2">•</span>
                            <span>Updated 2 days ago</span>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="font-medium text-gray-900">React Todo App</h4>
                          <p className="text-sm text-gray-600 mt-1">React, TypeScript, Tailwind</p>
                          <div className="flex items-center mt-2 text-xs text-gray-500">
                            <span>⭐ 8 stars</span>
                            <span className="mx-2">•</span>
                            <span>🍴 3 forks</span>
                            <span className="mx-2">•</span>
                            <span>Updated 1 week ago</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Code Quality Metrics</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">A</div>
                          <div className="text-sm text-gray-600">Code Quality Grade</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">92%</div>
                          <div className="text-sm text-gray-600">Test Coverage</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">15</div>
                          <div className="text-sm text-gray-600">Projects Completed</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};