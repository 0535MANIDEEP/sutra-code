import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  TrophyIcon,
  UserGroupIcon,
  AcademicCapIcon,
  ArrowTrendingUpIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

interface Analytics {
  gritScoreDistribution: Array<{ range: string; count: number; percentage: number }>;
  skillsAnalysis: Array<{ skill: string; averageScore: number; studentCount: number }>;
  learningPatterns: Array<{ pattern: string; count: number; description: string }>;
  industryReadinessStats: { ready: number; developing: number; learning: number };
  topPerformers: Array<{ studentId: string; name: string; gritScore: number; industryReadiness: number }>;
}

interface AnalyticsDashboardProps {
  analytics: Analytics | null;
  onRefresh: () => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  analytics,
  onRefresh
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No analytics data</h3>
        <p className="mt-1 text-sm text-gray-500">
          Click refresh to load analytics data.
        </p>
        <button
          onClick={onRefresh}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Load Analytics
        </button>
      </div>
    );
  }

  // Calculate derived metrics
  const totalStudents = analytics.gritScoreDistribution.reduce((sum, item) => sum + item.count, 0);
  const averageGritScore = Math.round(
    analytics.gritScoreDistribution.reduce((sum, item, index) => {
      const midpoint = (index * 20) + 10; // Approximate midpoint of each range
      return sum + (item.count * midpoint);
    }, 0) / totalStudents
  );

  // Prepare data for charts
  const skillsData = analytics.skillsAnalysis.map(skill => ({
    skill: skill.skill,
    score: skill.averageScore,
    students: skill.studentCount
  }));

  const industryReadinessData = [
    { name: 'Ready', value: analytics.industryReadinessStats.ready, color: '#10B981' },
    { name: 'Developing', value: analytics.industryReadinessStats.developing, color: '#3B82F6' },
    { name: 'Learning', value: analytics.industryReadinessStats.learning, color: '#F59E0B' }
  ];

  // Mock data for additional charts
  const skillRadarData = [
    { skill: 'Problem Solving', average: 75, top10: 90 },
    { skill: 'Communication', average: 68, top10: 85 },
    { skill: 'Algorithmic Thinking', average: 72, top10: 88 },
    { skill: 'Code Quality', average: 70, top10: 87 },
    { skill: 'Debugging', average: 65, top10: 82 },
    { skill: 'System Design', average: 60, top10: 80 }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
            <p className="text-gray-600 mt-1">
              Insights from {totalStudents} student portfolios
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            
            <button
              onClick={onRefresh}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrophyIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Grit Score</p>
              <p className="text-2xl font-bold text-gray-900">{averageGritScore}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <AcademicCapIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Industry Ready</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.industryReadinessStats.ready}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <ArrowTrendingUpIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">High Potential</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.topPerformers.length}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grit Score Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Grit Score Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.gritScoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip 
                formatter={(value: any, name: any) => [value, 'Students']}
                labelFormatter={(label: any) => `Score Range: ${label}`}
              />
              <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Industry Readiness Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Industry Readiness</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={industryReadinessData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percentage }: any) => `${name}: ${value} (${Math.round(percentage)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {industryReadinessData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Skills Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={skillsData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="skill" type="category" width={100} />
              <Tooltip 
                formatter={(value: any, name: any) => [value, name === 'score' ? 'Avg Score' : 'Students']}
              />
              <Bar dataKey="score" fill="#10B981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Skills Radar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={skillRadarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="skill" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar
                name="Average"
                dataKey="average"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.1}
              />
              <Radar
                name="Top 10%"
                dataKey="top10"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.1}
              />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Learning Patterns */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-white rounded-lg shadow p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Pattern Trends</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics.learningPatterns}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="pattern" />
            <YAxis />
            <Tooltip 
              formatter={(value: any, name: any) => [value, name === 'count' ? 'Students' : 'Percentage']}
            />
            <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Top Performers Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
          <div className="space-y-2">
            {analytics.topPerformers.slice(0, 5).map((performer, index) => (
              <div key={performer.studentId} className="flex items-center justify-between p-2 bg-green-50 rounded">
                <span className="text-sm font-medium text-green-800">{performer.name}</span>
                <div className="text-xs text-green-600">
                  <span>Grit: {performer.gritScore}</span>
                  <span className="ml-2">Ready: {performer.industryReadiness}%</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Insights</h3>
          <div className="space-y-3">
            {analytics.learningPatterns.slice(0, 4).map((pattern) => (
              <div key={pattern.pattern}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{pattern.pattern}</span>
                  <span className="text-sm text-gray-500">{pattern.count} students</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{pattern.description}</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${Math.min((pattern.count / totalStudents) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};