import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  TrophyIcon,
  UserGroupIcon,
  ArrowsUpDownIcon
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  LineChart,
  Line
} from 'recharts';

interface Analytics {
  gritScoreDistribution: Array<{ range: string; count: number; percentage: number }>;
  skillsAnalysis: Array<{ skill: string; averageScore: number; studentCount: number }>;
  learningPatterns: Array<{ pattern: string; count: number; description: string }>;
  industryReadinessStats: { ready: number; developing: number; learning: number };
  topPerformers: Array<{ studentId: string; name: string; gritScore: number; industryReadiness: number }>;
}

interface ComparativeAnalyticsProps {
  analytics: Analytics | null;
  selectedStudents: string[];
  onRefresh: () => void;
}

export const ComparativeAnalytics: React.FC<ComparativeAnalyticsProps> = ({
  analytics,
  selectedStudents,
  onRefresh
}) => {
  const [comparisonMode, setComparisonMode] = useState<'all' | 'selected'>('all');
  const [activeChart, setActiveChart] = useState<'grit' | 'skills' | 'readiness' | 'patterns'>('grit');

  // Mock data for selected students comparison (in real app, this would come from API)
  const selectedStudentsData = useMemo(() => {
    if (!analytics || selectedStudents.length === 0) return [];
    
    return selectedStudents.map((studentId, index) => ({
      studentId,
      name: `Student ${index + 1}`,
      gritScore: 75 + Math.random() * 25,
      persistence: 70 + Math.random() * 30,
      resilience: 65 + Math.random() * 35,
      curiosity: 80 + Math.random() * 20,
      algorithmicThinking: 70 + Math.random() * 30,
      problemSolving: 75 + Math.random() * 25,
      communication: 60 + Math.random() * 40,
      industryReadiness: 60 + Math.random() * 40,
      learningVelocity: 50 + Math.random() * 50
    }));
  }, [analytics, selectedStudents]);

  const radarData = useMemo(() => {
    if (comparisonMode === 'selected' && selectedStudentsData.length > 0) {
      const avgData = selectedStudentsData.reduce((acc, student) => {
        acc.persistence += student.persistence;
        acc.resilience += student.resilience;
        acc.curiosity += student.curiosity;
        acc.algorithmicThinking += student.algorithmicThinking;
        acc.problemSolving += student.problemSolving;
        acc.communication += student.communication;
        return acc;
      }, {
        persistence: 0,
        resilience: 0,
        curiosity: 0,
        algorithmicThinking: 0,
        problemSolving: 0,
        communication: 0
      });

      const count = selectedStudentsData.length;
      return [
        { skill: 'Persistence', selected: avgData.persistence / count, average: 75 },
        { skill: 'Resilience', selected: avgData.resilience / count, average: 72 },
        { skill: 'Curiosity', selected: avgData.curiosity / count, average: 78 },
        { skill: 'Algorithmic Thinking', selected: avgData.algorithmicThinking / count, average: 70 },
        { skill: 'Problem Solving', selected: avgData.problemSolving / count, average: 73 },
        { skill: 'Communication', selected: avgData.communication / count, average: 68 }
      ];
    }

    return [
      { skill: 'Persistence', average: 75 },
      { skill: 'Resilience', average: 72 },
      { skill: 'Curiosity', average: 78 },
      { skill: 'Algorithmic Thinking', average: 70 },
      { skill: 'Problem Solving', average: 73 },
      { skill: 'Communication', average: 68 }
    ];
  }, [comparisonMode, selectedStudentsData]);

  const scatterData = useMemo(() => {
    if (comparisonMode === 'selected') {
      return selectedStudentsData.map(student => ({
        x: student.gritScore,
        y: student.industryReadiness,
        name: student.name,
        size: student.learningVelocity
      }));
    }

    // Mock data for all students
    return Array.from({ length: 50 }, (_, i) => ({
      x: 40 + Math.random() * 60,
      y: 30 + Math.random() * 70,
      name: `Student ${i + 1}`,
      size: 30 + Math.random() * 70
    }));
  }, [comparisonMode, selectedStudentsData]);

  if (!analytics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No analytics data</h3>
          <p className="mt-1 text-sm text-gray-500">
            Analytics data is not available at the moment.
          </p>
          <button
            onClick={onRefresh}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Comparative Analytics</h2>
            <p className="text-gray-600 mt-1">
              Compare student performance and identify patterns
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex border border-gray-300 rounded-lg">
              <button
                onClick={() => setComparisonMode('all')}
                className={`px-4 py-2 text-sm ${
                  comparisonMode === 'all' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                All Students
              </button>
              <button
                onClick={() => setComparisonMode('selected')}
                disabled={selectedStudents.length === 0}
                className={`px-4 py-2 text-sm ${
                  comparisonMode === 'selected' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                Selected ({selectedStudents.length})
              </button>
            </div>
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Chart Navigation */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: 'grit', label: 'Grit Distribution', icon: TrophyIcon },
            { id: 'skills', label: 'Skills Comparison', icon: ChartBarIcon },
            { id: 'readiness', label: 'Industry Readiness', icon: ArrowTrendingUpIcon },
            { id: 'patterns', label: 'Learning Patterns', icon: UserGroupIcon }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveChart(id as any)}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeChart === id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
            </button>
          ))}
        </div>

        {/* Chart Content */}
        <div className="h-96">
          {activeChart === 'grit' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.gritScoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#3B82F6" name="Student Count" />
              </BarChart>
            </ResponsiveContainer>
          )}

          {activeChart === 'skills' && (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
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
                {comparisonMode === 'selected' && (
                  <Radar
                    name="Selected Students"
                    dataKey="selected"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.2}
                  />
                )}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          )}

          {activeChart === 'readiness' && (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={scatterData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="x" 
                  name="Grit Score" 
                  domain={[0, 100]}
                  label={{ value: 'Grit Score', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  dataKey="y" 
                  name="Industry Readiness" 
                  domain={[0, 100]}
                  label={{ value: 'Industry Readiness (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow">
                          <p className="font-medium">{data.name}</p>
                          <p className="text-sm text-gray-600">Grit Score: {data.x.toFixed(1)}</p>
                          <p className="text-sm text-gray-600">Industry Readiness: {data.y.toFixed(1)}%</p>
                          <p className="text-sm text-gray-600">Learning Velocity: {data.size.toFixed(1)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter 
                  dataKey="y" 
                  fill="#8B5CF6"
                  fillOpacity={0.6}
                />
              </ScatterChart>
            </ResponsiveContainer>
          )}

          {activeChart === 'patterns' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.learningPatterns} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="pattern" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrophyIcon className="h-8 w-8 text-yellow-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Top Performers</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.topPerformers.length}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm text-gray-600">
              Students with Grit Score ≥ 80
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <ArrowTrendingUpIcon className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Industry Ready</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.industryReadinessStats.ready}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm text-gray-600">
              Students ready for industry roles
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <ArrowsUpDownIcon className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Comparison Mode</p>
              <p className="text-2xl font-bold text-gray-900">
                {comparisonMode === 'selected' ? selectedStudents.length : 'All'}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm text-gray-600">
              {comparisonMode === 'selected' ? 'Selected students' : 'All students in database'}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Students Details */}
      {comparisonMode === 'selected' && selectedStudents.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Selected Students Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
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
                    Learning Velocity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ranking
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedStudentsData
                  .sort((a, b) => b.gritScore - a.gritScore)
                  .map((student, index) => (
                    <tr key={student.studentId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.gritScore.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.industryReadiness.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.learningVelocity.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        #{index + 1}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};