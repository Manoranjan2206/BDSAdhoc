import React, { createContext, useContext, useState, useCallback } from 'react';
import { reportsAPI, schedulesAPI, usersAPI } from '../services/apiService';
import dashboardsAPI from '../services/dashboardService';

/**
 * DataContext - Global cache for API data
 * Prevents unnecessary API calls when data is already loaded
 */
const DataContext = createContext(null);

export function DataProvider({ children }) {
  // Cache state
  const [cache, setCache] = useState({
    reports: null,
    dashboards: null,
    schedules: null,
    users: null,
    viewerSettings: null,
  });

  // Loading state
  const [loading, setLoading] = useState({
    reports: false,
    dashboards: false,
    schedules: false,
    users: false,
    viewerSettings: false,
  });

  // Error state
  const [errors, setErrors] = useState({
    reports: null,
    dashboards: null,
    schedules: null,
    users: null,
    viewerSettings: null,
  });

  // Sidebar collapsed states
  const [reportsSidebarCollapsed, setReportsSidebarCollapsed] = useState(false);
  const [dashboardsSidebarCollapsed, setDashboardsSidebarCollapsed] = useState(false);

  // Clear cache whenever user logs in or out
  React.useEffect(() => {
    const handleAuthChange = () => {
      setCache({
        reports: null,
        dashboards: null,
        schedules: null,
        users: null,
        viewerSettings: null,
      });
    };
    window.addEventListener('auth-changed', handleAuthChange);
    return () => window.removeEventListener('auth-changed', handleAuthChange);
  }, []);

  /**
   * Generic fetch function with caching
   * Only fetches if data is not already cached
   */
  const fetchData = useCallback(async (dataType, fetchFn) => {
    // Return cached data if available
    if (cache[dataType] !== null) {
      return cache[dataType];
    }

    // Prevent multiple simultaneous requests for the same data type
    if (loading[dataType]) {
      return null;
    }

    setLoading((prev) => ({ ...prev, [dataType]: true }));
    setErrors((prev) => ({ ...prev, [dataType]: null }));

    try {
      const data = await fetchFn();
      
      // Cache the result
      setCache((prev) => ({ ...prev, [dataType]: data }));
      
      return data;
    } catch (error) {
      console.error(`Error fetching ${dataType}:`, error);
      setErrors((prev) => ({ ...prev, [dataType]: error.message }));
      return null;
    } finally {
      setLoading((prev) => ({ ...prev, [dataType]: false }));
    }
  }, [cache, loading]);

  /**
   * Public methods to fetch each data type
   */
  const getReports = useCallback(() => 
    fetchData('reports', reportsAPI.getReportTree),
    [fetchData]
  );

  const getDashboards = useCallback(() => 
    fetchData('dashboards', dashboardsAPI.getList),
    [fetchData]
  );

  const getSchedules = useCallback(() => 
    fetchData('schedules', schedulesAPI.getSchedules),
    [fetchData]
  );

  const getUsers = useCallback(() =>
    fetchData('users', usersAPI.getUsers),
    [fetchData]
  );

  const getViewerSettings = useCallback(() =>
    fetchData('viewerSettings', () => reportsAPI.getViewerSettings()),
    [fetchData]
  );

  /**
   * Manual invalidation - force refresh data
   */
  const invalidate = useCallback((dataType) => {
    if (dataType === 'all') {
      setCache({
        reports: null,
        dashboards: null,
        schedules: null,
        users: null,
        viewerSettings: null,
      });
    } else {
      setCache((prev) => ({ ...prev, [dataType]: null }));
    }
  }, []);

  /**
   * Get all data (used by Home page)
   */
  const getAllData = useCallback(async () => {
    const [reports, dashboards, schedules, users] = await Promise.all([
      getReports(),
      getDashboards(),
      getSchedules(),
      getUsers(),
    ]);

    return { reports, dashboards, schedules, users };
  }, [getReports, getDashboards, getSchedules, getUsers]);

  const value = {
    // Sidebar collapsed states
    reportsSidebarCollapsed,
    setReportsSidebarCollapsed,
    dashboardsSidebarCollapsed,
    setDashboardsSidebarCollapsed,

    // Cache state
    cache,

    // Loading state
    loading,

    // Error state
    errors,

    // Data fetchers
    getReports,
    getDashboards,
    getSchedules,
    getUsers,
    getViewerSettings,
    getAllData,

    // Cache management
    invalidate,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

/**
 * Hook to use DataContext
 */
export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    console.warn('useData was called outside DataProvider -- using fallback context');
    return {
      reportsSidebarCollapsed: false,
      setReportsSidebarCollapsed: () => {},
      dashboardsSidebarCollapsed: false,
      setDashboardsSidebarCollapsed: () => {},
      cache: {},
      loading: {},
      errors: {},
      getReports: async () => [],
      getDashboards: async () => [],
      getSchedules: async () => [],
      getUsers: async () => [],
      getViewerSettings: async () => null,
      getAllData: async () => ({}),
      invalidate: () => {},
    };
  }
  return context;
}
