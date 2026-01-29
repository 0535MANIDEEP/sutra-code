import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

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

interface PortfoliosResponse {
  portfolios: Portfolio[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface Analytics {
  gritScoreDistribution: Array<{ range: string; count: number; percentage: number }>;
  skillsAnalysis: Array<{ skill: string; averageScore: number; studentCount: number }>;
  learningPatterns: Array<{ pattern: string; count: number; description: string }>;
  industryReadinessStats: { ready: number; developing: number; learning: number };
  topPerformers: Array<{ studentId: string; name: string; gritScore: number; industryReadiness: number }>;
}

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

interface ExportOptions {
  format: 'csv' | 'json' | 'pdf';
  studentIds: string[];
  fields: string[];
}

export const usePortfolioAPI = (recruiterId: string) => {
  const [portfolios, setPortfolios] = useState<PortfoliosResponse | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    colleges: [],
    locations: [],
    programmingLanguages: [],
    graduationYears: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data generator for development
  const generateMockPortfolios = useCallback((count: number = 20): Portfolio[] => {
    const colleges = [
      'IIT Delhi', 'IIT Bombay', 'NIT Trichy', 'BITS Pilani', 'VIT Vellore',
      'SRM University', 'Manipal Institute', 'PES University', 'RV College',
      'BMS College', 'JSS Academy', 'Dayananda Sagar'
    ];
    
    const locations = [
      'Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad',
      'Pune', 'Kolkata', 'Indore', 'Jaipur', 'Ahmedabad'
    ];
    
    const programmingLanguages = [
      'JavaScript', 'Python', 'Java', 'C++', 'TypeScript',
      'React', 'Node.js', 'Go', 'Rust', 'Swift'
    ];

    const names = [
      'Aarav Sharma', 'Vivaan Patel', 'Aditya Kumar', 'Vihaan Singh', 'Arjun Gupta',
      'Sai Reddy', 'Reyansh Jain', 'Ayaan Khan', 'Krishna Iyer', 'Ishaan Nair',
      'Priya Agarwal', 'Ananya Mehta', 'Kavya Rao', 'Diya Verma', 'Aadhya Joshi'
    ];

    return Array.from({ length: count }, (_, i) => ({
      studentId: `student-${i + 1}`,
      personalInfo: {
        name: names[Math.floor(Math.random() * names.length)],
        college: colleges[Math.floor(Math.random() * colleges.length)],
        location: locations[Math.floor(Math.random() * locations.length)],
        graduationYear: 2024 + Math.floor(Math.random() * 3),
        lastActive: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000 // Last 30 days
      },
      gritScore: {
        overallScore: Math.floor(40 + Math.random() * 60),
        persistence: Math.floor(40 + Math.random() * 60),
        resilience: Math.floor(40 + Math.random() * 60),
        curiosity: Math.floor(40 + Math.random() * 60)
      },
      learningMetrics: {
        totalLearningTime: Math.floor(50 + Math.random() * 200) * 3600000, // 50-250 hours in ms
        conceptsMastered: Math.floor(10 + Math.random() * 50),
        learningVelocity: Math.floor(30 + Math.random() * 70),
        focusQualityScore: Math.floor(40 + Math.random() * 60)
      },
      skillAssessment: {
        programmingLanguages: programmingLanguages
          .sort(() => 0.5 - Math.random())
          .slice(0, 3 + Math.floor(Math.random() * 4)),
        algorithmicThinking: Math.floor(40 + Math.random() * 60),
        problemSolving: Math.floor(40 + Math.random() * 60),
        communication: Math.floor(40 + Math.random() * 60)
      },
      portfolioMetrics: {
        portfolioCompleteness: Math.floor(30 + Math.random() * 70),
        industryReadiness: Math.floor(30 + Math.random() * 70),
        hiringProbability: 0.3 + Math.random() * 0.7
      }
    }));
  }, []);

  const generateMockAnalytics = useCallback((): Analytics => {
    return {
      gritScoreDistribution: [
        { range: '0-20', count: 5, percentage: 5 },
        { range: '21-40', count: 15, percentage: 15 },
        { range: '41-60', count: 35, percentage: 35 },
        { range: '61-80', count: 30, percentage: 30 },
        { range: '81-100', count: 15, percentage: 15 }
      ],
      skillsAnalysis: [
        { skill: 'JavaScript', averageScore: 75, studentCount: 85 },
        { skill: 'Python', averageScore: 72, studentCount: 78 },
        { skill: 'Java', averageScore: 68, studentCount: 65 },
        { skill: 'React', averageScore: 70, studentCount: 55 },
        { skill: 'Node.js', averageScore: 67, studentCount: 45 }
      ],
      learningPatterns: [
        { pattern: 'Deep Focus Learner', count: 25, description: 'Long, concentrated study sessions' },
        { pattern: 'Quick Iteration', count: 35, description: 'Frequent short learning bursts' },
        { pattern: 'Project-Based', count: 20, description: 'Learns through building projects' },
        { pattern: 'Theory First', count: 15, description: 'Prefers conceptual understanding' },
        { pattern: 'Collaborative', count: 5, description: 'Learns best in groups' }
      ],
      industryReadinessStats: {
        ready: 25,
        developing: 45,
        learning: 30
      },
      topPerformers: [
        { studentId: 'student-1', name: 'Aarav Sharma', gritScore: 95, industryReadiness: 92 },
        { studentId: 'student-2', name: 'Priya Agarwal', gritScore: 92, industryReadiness: 88 },
        { studentId: 'student-3', name: 'Vivaan Patel', gritScore: 90, industryReadiness: 85 },
        { studentId: 'student-4', name: 'Ananya Mehta', gritScore: 88, industryReadiness: 90 },
        { studentId: 'student-5', name: 'Aditya Kumar', gritScore: 87, industryReadiness: 83 }
      ]
    };
  }, []);

  const generateMockFilterOptions = useCallback((): FilterOptions => {
    return {
      colleges: [
        'IIT Delhi', 'IIT Bombay', 'NIT Trichy', 'BITS Pilani', 'VIT Vellore',
        'SRM University', 'Manipal Institute', 'PES University', 'RV College',
        'BMS College', 'JSS Academy', 'Dayananda Sagar'
      ],
      locations: [
        'Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad',
        'Pune', 'Kolkata', 'Indore', 'Jaipur', 'Ahmedabad'
      ],
      programmingLanguages: [
        'JavaScript', 'Python', 'Java', 'C++', 'TypeScript',
        'React', 'Node.js', 'Go', 'Rust', 'Swift'
      ],
      graduationYears: [2024, 2025, 2026, 2027]
    };
  }, []);

  const fetchPortfolios = useCallback(async (page: number = 1, limit: number = 20) => {
    setLoading(true);
    setError(null);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockPortfolios = generateMockPortfolios(limit);
      const mockResponse: PortfoliosResponse = {
        portfolios: mockPortfolios,
        pagination: {
          total: 100,
          page,
          limit,
          totalPages: Math.ceil(100 / limit)
        }
      };

      setPortfolios(mockResponse);
      
      // Also set filter options on first load
      if (!filterOptions.colleges.length) {
        setFilterOptions(generateMockFilterOptions());
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch portfolios';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [generateMockPortfolios, generateMockFilterOptions, filterOptions.colleges.length]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));

      const mockAnalytics = generateMockAnalytics();
      setAnalytics(mockAnalytics);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [generateMockAnalytics]);

  const searchPortfolios = useCallback(async (filters: SearchFilters) => {
    setLoading(true);
    setError(null);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 600));

      // Generate filtered mock data based on search criteria
      let mockPortfolios = generateMockPortfolios(50);

      // Apply filters (simplified for demo)
      if (filters.query) {
        mockPortfolios = mockPortfolios.filter(p => 
          p.personalInfo.name.toLowerCase().includes(filters.query!.toLowerCase()) ||
          p.personalInfo.college.toLowerCase().includes(filters.query!.toLowerCase())
        );
      }

      if (filters.gritScoreRange) {
        mockPortfolios = mockPortfolios.filter(p => 
          p.gritScore.overallScore >= filters.gritScoreRange![0] &&
          p.gritScore.overallScore <= filters.gritScoreRange![1]
        );
      }

      if (filters.colleges && filters.colleges.length > 0) {
        mockPortfolios = mockPortfolios.filter(p => 
          filters.colleges!.includes(p.personalInfo.college)
        );
      }

      if (filters.programmingLanguages && filters.programmingLanguages.length > 0) {
        mockPortfolios = mockPortfolios.filter(p => 
          filters.programmingLanguages!.some(lang => 
            p.skillAssessment.programmingLanguages.includes(lang)
          )
        );
      }

      const searchResponse: PortfoliosResponse = {
        portfolios: mockPortfolios,
        pagination: {
          total: mockPortfolios.length,
          page: 1,
          limit: mockPortfolios.length,
          totalPages: 1
        }
      };

      setPortfolios(searchResponse);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search portfolios';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [generateMockPortfolios]);

  const exportData = useCallback(async (options: ExportOptions) => {
    try {
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 1500));

      // In a real implementation, this would call the API and download the file
      const filename = `portfolio-export-${Date.now()}.${options.format}`;
      
      // Mock download
      console.log(`Exporting ${options.studentIds.length} portfolios as ${options.format}`, {
        filename,
        fields: options.fields,
        studentIds: options.studentIds
      });

      toast.success(`Export completed: ${filename}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export data';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  return {
    portfolios,
    analytics,
    filterOptions,
    loading,
    error,
    fetchPortfolios,
    fetchAnalytics,
    searchPortfolios,
    exportData
  };
};