import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { StudentPortfolioCard } from './StudentPortfolioCard';

interface FilterOptions {
  colleges: string[];
  locations: string[];
  programmingLanguages: string[];
  graduationYears: number[];
}

interface SearchFilters {
  query?: string;
  gritScoreRange?: [number, number];
  industryReadinessRange?: [number, number];
  colleges?: string[];
  locations?: string[];
  programmingLanguages?: string[];
  graduationYear?: number;
  learningTimeRange?: [number, number];
}

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

interface StudentSearchProps {
  filterOptions: FilterOptions;
  searchResults: Portfolio[];
  onSearch: (filters: SearchFilters) => void;
  selectedStudents: string[];
  onSelectionChange: (selected: string[]) => void;
}

export const StudentSearch: React.FC<StudentSearchProps> = ({
  filterOptions,
  searchResults,
  onSearch,
  selectedStudents,
  onSelectionChange
}) => {
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [filters, searchQuery]);

  const handleSearch = () => {
    const searchFilters = {
      ...filters,
      query: searchQuery.trim() || undefined
    };
    onSearch(searchFilters);
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  const handleStudentSelect = (studentId: string) => {
    const isSelected = selectedStudents.includes(studentId);
    if (isSelected) {
      onSelectionChange(selectedStudents.filter(id => id !== studentId));
    } else {
      onSelectionChange([...selectedStudents, studentId]);
    }
  };

  const activeFilterCount = Object.values(filters).filter(value => 
    value !== undefined && value !== null && 
    (Array.isArray(value) ? value.length > 0 : true)
  ).length + (searchQuery.trim() ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Advanced Student Search</h2>
            <p className="text-gray-600 mt-1">
              Find students based on specific criteria and learning patterns
            </p>
          </div>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center px-4 py-2 text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg hover:bg-blue-50"
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5 mr-2" />
            Advanced Filters
            {activeFilterCount > 0 && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, college, or skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 p-4 bg-gray-50 rounded-lg"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Grit Score Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grit Score Range
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Min"
                    value={filters.gritScoreRange?.[0] || ''}
                    onChange={(e) => handleFilterChange('gritScoreRange', [
                      parseInt(e.target.value) || 0,
                      filters.gritScoreRange?.[1] || 100
                    ])}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Max"
                    value={filters.gritScoreRange?.[1] || ''}
                    onChange={(e) => handleFilterChange('gritScoreRange', [
                      filters.gritScoreRange?.[0] || 0,
                      parseInt(e.target.value) || 100
                    ])}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* Industry Readiness Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industry Readiness (%)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Min"
                    value={filters.industryReadinessRange?.[0] || ''}
                    onChange={(e) => handleFilterChange('industryReadinessRange', [
                      parseInt(e.target.value) || 0,
                      filters.industryReadinessRange?.[1] || 100
                    ])}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Max"
                    value={filters.industryReadinessRange?.[1] || ''}
                    onChange={(e) => handleFilterChange('industryReadinessRange', [
                      filters.industryReadinessRange?.[0] || 0,
                      parseInt(e.target.value) || 100
                    ])}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* Colleges */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Colleges
                </label>
                <select
                  multiple
                  value={filters.colleges || []}
                  onChange={(e) => handleFilterChange('colleges', 
                    Array.from(e.target.selectedOptions, option => option.value)
                  )}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  size={3}
                >
                  {filterOptions.colleges.map(college => (
                    <option key={college} value={college}>{college}</option>
                  ))}
                </select>
              </div>

              {/* Locations */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Locations
                </label>
                <select
                  multiple
                  value={filters.locations || []}
                  onChange={(e) => handleFilterChange('locations', 
                    Array.from(e.target.selectedOptions, option => option.value)
                  )}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  size={3}
                >
                  {filterOptions.locations.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>

              {/* Programming Languages */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Programming Languages
                </label>
                <select
                  multiple
                  value={filters.programmingLanguages || []}
                  onChange={(e) => handleFilterChange('programmingLanguages', 
                    Array.from(e.target.selectedOptions, option => option.value)
                  )}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  size={3}
                >
                  {filterOptions.programmingLanguages.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              {/* Graduation Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Graduation Year
                </label>
                <select
                  value={filters.graduationYear || ''}
                  onChange={(e) => handleFilterChange('graduationYear', 
                    e.target.value ? parseInt(e.target.value) : undefined
                  )}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="">All Years</option>
                  {filterOptions.graduationYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={clearFilters}
                className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-800"
              >
                <XMarkIcon className="h-4 w-4 mr-1" />
                Clear All Filters
              </button>
              <div className="text-sm text-gray-600">
                {searchResults.length} students found
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Search Results */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Search Results ({searchResults.length})
          </h3>
          {selectedStudents.length > 0 && (
            <div className="text-sm text-blue-600">
              {selectedStudents.length} selected
            </div>
          )}
        </div>

        {searchResults.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchResults.map((portfolio, index) => (
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
                  onViewDetails={() => {}} // Will be handled by parent
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FunnelIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No students found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search criteria or filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};