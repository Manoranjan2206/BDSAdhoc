import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BoldBI } from '@boldbi/boldbi-embedded-sdk';
import dashboardsAPI from '../services/dashboardService';
import { useData } from '../context/DataContext';
import { authService } from '../services/authService';

import { motion } from 'framer-motion';
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  ChartBarIcon,
  FolderIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  StarIcon as StarIconOutline,
  Squares2X2Icon,
  ListBulletIcon,
  ArrowPathIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/reports.css';

// Cohesive vibrant color palettes for categories
const COLOR_PALETTES = [
  {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800/40',
    iconBg: 'bg-blue-100/70 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800/40',
    iconBg: 'bg-purple-100/70 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
    dot: 'bg-purple-500',
  },
  {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    iconBg: 'bg-emerald-100/70 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/40',
    iconBg: 'bg-amber-100/70 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800/40',
    iconBg: 'bg-rose-100/70 dark:bg-rose-900/40',
    iconColor: 'text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-800/40',
    iconBg: 'bg-indigo-100/70 dark:bg-indigo-900/40',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    dot: 'bg-indigo-500',
  },
];

const getCategoryPalette = (categoryName) => {
  if (!categoryName) return COLOR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index];
};

const Dashboards = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getDashboards, dashboardsSidebarCollapsed, setDashboardsSidebarCollapsed } = useData();

  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardInstance, setDashboardInstance] = useState(null);

  // Filters & View state
  const [activeScope, setActiveScope] = useState('all'); // 'all' | 'favorites'
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all'); // 'all' or category name
  const [viewMode, setViewMode] = useState('table'); // 'grid' | 'table'

  // Column Sorting state
  const [sortColumn, setSortColumn] = useState('name'); // 'name' | 'categoryName' | 'description' | 'createdDate'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const [sidebarWidth, setSidebarWidth] = useState(250);
  const isResizingRef = useRef(false);
  const mainRef = useRef(null);

  const [starredDashboards, setStarredDashboards] = useState(() => {
    try {
      const saved = localStorage.getItem('starred_dashboards');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const normalizeDashboard = (d) => ({
    id: d.Id || d.id,
    name: String(d.Name || d.name || 'Untitled Dashboard'),
    description: String(d.Description || d.description || 'Interactive business dashboard'),
    categoryName: String(d.CategoryName || d.category || d.Category || 'General'),
    createdDate: d.CreatedDate || d.createdDate || d.ModifiedDate || d.modifiedDate || new Date().toISOString(),
    modifiedDate: d.ModifiedDate || d.modifiedDate || d.CreatedDate || d.createdDate || new Date().toISOString(),
    ...d,
  });

  useEffect(() => {
    loadDashboards();
  }, []);

  useEffect(() => {
    if (selectedDashboard) {
      loadDashboardViewer();
    }
    return () => {
      if (dashboardInstance) {
        try {
          dashboardInstance.dispose();
        } catch (e) { }
        setDashboardInstance(null);
      }
    };
  }, [selectedDashboard]);

  // Deep link support ?dashboardId=...
  useEffect(() => {
    if (!dashboards.length) return;
    const params = new URLSearchParams(location.search);
    const qId = params.get('dashboardId');
    if (!qId) return;
    const match = dashboards.find(d => String(d.id || d.Id) === String(qId));
    if (match) setSelectedDashboard(match);
  }, [dashboards, location.search]);

  // Resizer handlers
  useEffect(() => {
    const onMove = (e) => {
      if (!isResizingRef.current) return;
      const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
      if (!clientX || !mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      const newWidth = Math.max(180, Math.min(400, clientX - rect.left));
      setSidebarWidth(newWidth);
    };

    const onUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchend', onUp);
    };
  }, []);

  const toggleStar = (dbId, e) => {
    e.preventDefault();
    e.stopPropagation();
    setStarredDashboards(prev => {
      const next = prev.includes(dbId)
        ? prev.filter(id => id !== dbId)
        : [...prev, dbId];
      localStorage.setItem('starred_dashboards', JSON.stringify(next));
      return next;
    });
  };

  const getFormattedDateString = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return String(dateStr);
    }
  };

  const loadDashboards = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await getDashboards();
      setDashboards((list || []).map(normalizeDashboard));
    } catch (err) {
      console.error('Dashboards load error:', err);
      setError('Failed to load dashboards');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardViewer = async () => {
    if (!selectedDashboard) return;
    try {
      setError(null);
      const dashboardId = selectedDashboard.id || selectedDashboard.Id;
      const config = await dashboardsAPI.getEmbedConfig(dashboardId);

      if (!config) throw new Error('No embed config');

      const serverUrl = `${config.serverUrl}/site/${config.siteIdentifier}`;
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
      const authorizationUrl = `${API_BASE_URL}/dashboards/authorize`;

      const dashboard = BoldBI.create({
        serverUrl,
        dashboardId,
        embedContainerId: 'dashboard-container',
        width: '100%',
        height: '100%',
        embedType: config.embedType || BoldBI.EmbedType.Component,
        environment: config.environment || BoldBI.Environment.Enterprise,
        mode: BoldBI.Mode.View,
        authorizationServer: { url: authorizationUrl },
        expirationTime: 100000,
      });

      dashboard.loadDashboard();
      setDashboardInstance(dashboard);
    } catch (err) {
      console.error('Dashboard viewer error:', err);
      setError(err.message || 'Failed to load dashboard');
    }
  };

  // Categories list calculation
  const categoriesList = useMemo(() => {
    const map = {};
    dashboards.forEach(d => {
      const cat = d.categoryName || 'General';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.keys(map).map(cat => ({ name: cat, count: map[cat] }));
  }, [dashboards]);

  // Filtered dashboards calculation
  const filteredDashboards = useMemo(() => {
    let result = [...dashboards];

    if (selectedCategoryFilter !== 'all') {
      result = result.filter(d => d.categoryName === selectedCategoryFilter);
    }

    if (activeScope === 'favorites') {
      result = result.filter(d => starredDashboards.includes(d.id));
    }

    // Column Sorting
    result.sort((a, b) => {
      let valA = a[sortColumn] ?? '';
      let valB = b[sortColumn] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [dashboards, selectedCategoryFilter, activeScope, starredDashboards, sortColumn, sortDirection]);

  return (
    <div className="reports-page font-inter bg-slate-50 dark:bg-[#111422] h-full flex flex-col overflow-hidden">
      {/* Work Area (Sidebar + Content Workspace) */}
      <div className="reports-main flex-1 flex min-h-0 relative" ref={mainRef}>
        {/* Category Sidebar */}
        <div
          className={`bg-white dark:bg-[#181c2c] border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-200 z-10 ${
            dashboardsSidebarCollapsed ? 'w-0 overflow-hidden border-none' : ''
          }`}
          style={{ width: dashboardsSidebarCollapsed ? 0 : sidebarWidth }}
        >
          {!dashboardsSidebarCollapsed && (
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1">
                <span>Categories</span>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500 font-semibold">
                  {categoriesList.length}
                </span>
              </div>

              {/* All Categories */}
              <button
                onClick={() => setSelectedCategoryFilter('all')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FolderIcon className="w-4 h-4 text-blue-500" /> All Categories
                </span>
                <span className="text-[11px] opacity-70 font-semibold">{dashboards.length}</span>
              </button>

              {/* Category List */}
              <div className="space-y-1 pt-1">
                {categoriesList.map((cat, idx) => {
                  const palette = getCategoryPalette(cat.name);
                  const isSelected = selectedCategoryFilter === cat.name;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedCategoryFilter(cat.name)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-colors ${
                        isSelected
                          ? `${palette.bg} ${palette.text} font-semibold border ${palette.border}`
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate pr-2">
                        <span className={`w-2 h-2 rounded-full ${palette.dot}`} />
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-500">
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setDashboardsSidebarCollapsed(!dashboardsSidebarCollapsed)}
          className="absolute top-3.5 z-30 flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow transition-all"
          style={{ left: dashboardsSidebarCollapsed ? 12 : sidebarWidth - 14 }}
          title={dashboardsSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronRightIcon className={`w-3.5 h-3.5 text-slate-500 transition-transform ${dashboardsSidebarCollapsed ? '' : 'rotate-180'}`} />
        </button>

        {/* Content View Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50 dark:bg-[#111422]">
          {selectedDashboard ? (
            /* Viewer View */
            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#181c2c] m-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setSelectedDashboard(null)}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <ChevronLeftIcon className="w-4 h-4" /> Back to list
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">{selectedDashboard.name}</h2>
                    <p className="text-[11px] text-slate-400 truncate">{selectedDashboard.categoryName}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDashboard(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Close Viewer
                </button>
              </div>

              <div className="flex-1 min-h-0 relative">
                {error ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{error}</p>
                    <button
                      onClick={() => { setError(null); loadDashboardViewer(); }}
                      className="mt-3 px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition"
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <div id="dashboard-container" style={{ height: '100%', width: '100%' }} />
                )}
              </div>
            </div>
          ) : (
            /* Dashboards Listing View */
            <div className="flex-1 flex flex-col min-h-0">
              {/* Single Compact Action Bar */}
              <div className="px-6 py-3 flex items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-[#181c2c]/60 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-medium">
                    <button
                      onClick={() => setActiveScope('all')}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        activeScope === 'all'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      All Dashboards
                    </button>
                    <button
                      onClick={() => setActiveScope('favorites')}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        activeScope === 'favorites'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Favorites ({starredDashboards.length})
                    </button>
                  </div>

                  {selectedCategoryFilter !== 'all' && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Filtering by: <strong className="text-slate-800 dark:text-slate-200">{selectedCategoryFilter}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-lg transition-all ${
                        viewMode === 'grid'
                          ? 'bg-white dark:bg-slate-700 text-[#FF4800] shadow-sm'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                      title="Grid View"
                    >
                      <Squares2X2Icon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded-lg transition-all ${
                        viewMode === 'table'
                          ? 'bg-white dark:bg-slate-700 text-[#FF4800] shadow-sm'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                      title="Table View"
                    >
                      <ListBulletIcon className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => { window.location.href = '/dashboards/designer'; }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#FF4800] hover:bg-[#e03f00] rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    <PlusIcon className="w-4 h-4 stroke-[2.5]" />
                    New Dashboard
                  </button>
                </div>
              </div>

              {/* Grid / Table Container */}
              <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                  <div className="h-64 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#FF4800] animate-spin mb-3" />
                    <p className="text-xs text-slate-500">Loading Dashboards...</p>
                  </div>
                ) : filteredDashboards.length === 0 ? (
                  <div className="bg-white dark:bg-[#181c2c] rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-md mx-auto space-y-3 mt-12">
                    <ChartBarIcon className="w-12 h-12 text-slate-300 mx-auto" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">No Dashboards Found</h3>
                    <p className="text-xs text-slate-500">
                      No dashboards match your current filter. Try selecting a different category or clearing filters.
                    </p>
                    <button
                      onClick={() => { setSelectedCategoryFilter('all'); setActiveScope('all'); }}
                      className="px-4 py-2 text-xs font-semibold text-[#FF4800] bg-orange-50 dark:bg-orange-950/40 rounded-xl hover:bg-orange-100 transition-colors"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : viewMode === 'grid' ? (
                  /* GRID VIEW */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredDashboards.map(dashboard => {
                      const isStarred = starredDashboards.includes(dashboard.id);
                      const palette = getCategoryPalette(dashboard.categoryName);
                      return (
                        <motion.div
                          key={dashboard.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => setSelectedDashboard(dashboard)}
                          className="bg-white dark:bg-[#181c2c] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative hover:-translate-y-0.5"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors truncate min-w-0 flex-1">
                                {dashboard.name}
                              </h3>
                              <button
                                onClick={(e) => toggleStar(dashboard.id, e)}
                                className="p-1 text-slate-400 hover:text-amber-400 transition-colors flex-shrink-0"
                                title={isStarred ? "Remove Star" : "Star Dashboard"}
                              >
                                {isStarred ? (
                                  <StarIconSolid className="w-4 h-4 text-amber-400" />
                                ) : (
                                  <StarIconOutline className="w-4 h-4" />
                                )}
                              </button>
                            </div>

                            <div>
                              <span className={`inline-block px-2.5 py-0.5 text-[10px] font-semibold rounded-md ${palette.bg} ${palette.text} border ${palette.border} truncate max-w-full whitespace-nowrap`}>
                                {dashboard.categoryName}
                              </span>
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                                {dashboard.description}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                            <span>{getFormattedDateString(dashboard.modifiedDate || dashboard.createdDate)}</span>
                            <span className="font-semibold text-blue-600 group-hover:underline">Open</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  /* TABLE VIEW */
                  <div className="bg-white dark:bg-[#181c2c] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse table-auto">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/60 dark:bg-slate-900/60 select-none">
                          <th className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors w-1/3 min-w-[200px]" onClick={() => handleSort('name')}>
                            <div className="flex items-center gap-1.5">
                              <span>Dashboard Name</span>
                              {sortColumn === 'name' ? (
                                <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                              )}
                            </div>
                          </th>
                          <th className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors w-44 whitespace-nowrap" onClick={() => handleSort('categoryName')}>
                            <div className="flex items-center gap-1.5">
                              <span>Category</span>
                              {sortColumn === 'categoryName' ? (
                                <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                              )}
                            </div>
                          </th>
                          <th className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors w-1/3 max-w-sm" onClick={() => handleSort('description')}>
                            <div className="flex items-center gap-1.5">
                              <span>Description</span>
                              {sortColumn === 'description' ? (
                                <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                              )}
                            </div>
                          </th>
                          <th className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors w-36 whitespace-nowrap" onClick={() => handleSort('modifiedDate')}>
                            <div className="flex items-center gap-1.5">
                              <span>Last Modified</span>
                              {sortColumn === 'modifiedDate' ? (
                                <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                              )}
                            </div>
                          </th>
                          <th className="py-3.5 px-4 text-right w-28 whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {filteredDashboards.map(dashboard => {
                          const isStarred = starredDashboards.includes(dashboard.id);
                          const palette = getCategoryPalette(dashboard.categoryName);
                          return (
                            <tr
                              key={dashboard.id}
                              onClick={() => setSelectedDashboard(dashboard)}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                            >
                              <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-2.5">
                                  <ChartBarIcon className={`w-4 h-4 ${palette.iconColor} shrink-0`} />
                                  <span className="truncate">{dashboard.name}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 shadow-2xs ${palette.bg} ${palette.text} border ${palette.border}`}>
                                  {dashboard.categoryName}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{dashboard.description}</td>
                              <td className="py-3.5 px-4 text-slate-500 font-medium whitespace-nowrap">{getFormattedDateString(dashboard.modifiedDate || dashboard.createdDate)}</td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => toggleStar(dashboard.id, e)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    {isStarred ? <StarIconSolid className="w-4 h-4 text-amber-400" /> : <StarIconOutline className="w-4 h-4" />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboards;