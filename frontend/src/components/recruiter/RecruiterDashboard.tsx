import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ChartBarIcon, 
  UserGroupIcon, 
  AcademicCapIcon,
  TrophyIcon,
  FunnelIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { PortfolioGrid } from './PortfolioGrid';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { StudentSearch } from './StudentSearch';
import { ComparativeAnalytics } from './ComparativeAnalytics';
import { usePortfolioAPI } from '../../hooks/usePortfolioAPI';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

interface RecruiterDashboardProps {
  recruiterId: string;
}

type DashboardView = 'portfolios' | 'analytics' | 'search' | 'comparative';

export const RecruiterDashboard: React.FC<RecruiterDashboardProps> = ({ recruiterId }) => {
  const [activeView, setActiveView] = useState<DashboardView>('portfolios');
  const [searchFilters, setSearchFilters] = useState({});
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const {
    portfolios,
    analytics,
    filterOptions,
    loading,
    error,
    fetchPortfolios,
    fetchAnalytics,
    searchPortfolios,
    exportData
  } = usePortfolioAPI(recruiterId);

  useEffect(() => {
    // Load initial data based on active view
    switch (activeView) {
      case 'portfolios':
        fetchPortfolios();
        break;
      case 'analytics':
        fetchAnalytics();
        break;
      default:
        break;
    }
  }, [activeView, fetchPortfolios, fetchAnalytics]);

  const handleSearch = async (filters: any) => {
    setSearchFilters(filters);
    try {
      await searchPortfolios(filters);
      setActiveView('search');
    } catch (error) {
      toast.error('Failed to search portfolios');
    }
  };

  const handleExport = async () => {
    try {
      await exportData({
        format: 'csv',
        studentIds: selectedStudents,
        fields: ['name', 'college', 'gritScore', 'industryReadiness', 'skillAssessment']
      });
      toast.success('Portfolio data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const navigationItems = [
    {
      id: 'portfolios' as DashboardView,
      name: 'Student Portfolios',
      icon: UserGroupIcon,
      description: 'Browse and review student portfolios'
    },
    {
      id: 'analytics' as DashboardView,
      name: 'Analytics Dashboard',
      icon: ChartBarIcon,
      description: 'View learning analytics and insights'
    },
    {
      id: 'search' as DashboardView,
      name: 'Advanced Search',
      icon: FunnelIcon,
      description: 'Search and filter students by criteria'
    },
    {
      id: 'comparative' as DashboardView,
      name: 'Comparative Analysis',
      icon: TrophyIcon,
      description: 'Compare students and identify top talent'
    }
  ];

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️ Error Loading Dashboard</div>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Sutra-Code Recruiter Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Discover authentic talent through learning analytics
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleExport}
                disabled={selectedStudents.length === 0}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Export ({selectedStudents.length})
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 flex-shrink-0">
            <nav className="space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeView === item.id
                        ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-500'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.description}</div>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Quick Stats */}
            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Students</span>
                  <span className="font-semibold text-blue-600">
                    {portfolios?.pagination?.total || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">High Grit (80+)</span>
                  <span className="font-semibold text-green-600">
                    {analytics?.industryReadinessStats?.ready || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Selected</span>
                  <span className="font-semibold text-purple-600">
                    {selectedStudents.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : (
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {activeView === 'portfolios' && (
                  <PortfolioGrid
                    portfolios={portfolios?.portfolios || []}
                    selectedStudents={selectedStudents}
                    onSelectionChange={setSelectedStudents}
                    onSearch={handleSearch}
                  />
                )}

                {activeView === 'analytics' && (
                  <AnalyticsDashboard
                    analytics={analytics}
                    onRefresh={fetchAnalytics}
                  />
                )}

                {activeView === 'search' && (
                  <StudentSearch
                    filterOptions={filterOptions}
                    searchResults={portfolios?.portfolios || []}
                    onSearch={handleSearch}
                    selectedStudents={selectedStudents}
                    onSelectionChange={setSelectedStudents}
                  />
                )}

                {activeView === 'comparative' && (
                  <ComparativeAnalytics
                    analytics={analytics}
                    selectedStudents={selectedStudents}
                    onRefresh={fetchAnalytics}
                  />
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};