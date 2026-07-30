import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChartBarIcon,
  DocumentTextIcon,
  ClockIcon,
  UserGroupIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  PlusIcon,
  FolderPlusIcon,
  SparklesIcon,
  StarIcon as StarIconOutline,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { useData } from '../context/DataContext';
import { authService } from '../services/authService';
import { motion } from 'framer-motion';
import '../styles/home.css';

export default function Home() {
  const navigate = useNavigate();
  const { getReports, getDashboards, getSchedules, getUsers } = useData();
  const [user] = useState(() => {
    const u = authService.getUser();
    return u?.user || u;
  });
  const [activeAssetTab, setActiveAssetTab] = useState('all');
  const [starredReports, setStarredReports] = useState(() => {
    try {
      const saved = localStorage.getItem('starred_reports');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [stats, setStats] = useState({
    reports: 0,
    dashboards: 0,
    schedules: 0,
    users: 0,
    loadingReports: true,
    loadingDashboards: true,
    loadingSchedules: true,
    loadingUsers: true,
    categoriesData: [],
    recentReports: [],
    recentDashboards: []
  });

  // Client-side local time greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  useEffect(() => {
    const loadReports = async () => {
      try {
        const reportTree = await getReports();
        const treeArr = Array.isArray(reportTree)
          ? reportTree
          : (reportTree && Array.isArray(reportTree.data) ? reportTree.data : []);

        const catData = [];
        let reportCount = 0;
        const allReports = [];

        if (Array.isArray(treeArr)) {
          treeArr.forEach(cat => {
            const reps = cat.Reports || cat.reports || [];
            const count = Array.isArray(reps) ? reps.length : 0;
            reportCount += count;
            const catName = cat.Name || cat.name || 'Uncategorized';
            catData.push({ category: catName, count });

            reps.forEach(r => {
              allReports.push({
                id: r.Id || r.id,
                name: r.Name || r.name,
                type: 'report',
                category: catName,
                date: r.ModifiedDate || r.modifiedDate || new Date().toISOString(),
                description: r.Description || r.description || 'Paginated analytics report',
                owner: 'System Administrator'
              });
            });
          });
        }

        setStats(prev => ({
          ...prev,
          reports: reportCount,
          loadingReports: false,
          categoriesData: catData,
          recentReports: allReports
        }));
      } catch (err) {
        console.error('Failed to load reports:', err);
        setStats(prev => ({ ...prev, loadingReports: false }));
      }
    };

    const loadDashboards = async () => {
      try {
        const dashboardList = await getDashboards();
        const dashboardCount = Array.isArray(dashboardList) ? dashboardList.length : 0;
        const allDashboards = [];
        if (Array.isArray(dashboardList)) {
          dashboardList.forEach(d => {
            allDashboards.push({
              id: d.Id || d.id,
              name: d.Name || d.name,
              type: 'dashboard',
              category: d.CategoryName || d.category || d.Category || 'General',
              date: d.ModifiedDate || d.modifiedDate || new Date().toISOString(),
              description: d.Description || d.description || 'Interactive BI dashboard',
              owner: 'Analytics Team'
            });
          });
        }

        setStats(prev => ({
          ...prev,
          dashboards: dashboardCount,
          loadingDashboards: false,
          recentDashboards: allDashboards
        }));
      } catch (err) {
        console.error('Failed to load dashboards:', err);
        setStats(prev => ({ ...prev, loadingDashboards: false }));
      }
    };

    const loadSchedules = async () => {
      try {
        const scheduleList = await getSchedules();
        setStats(prev => ({
          ...prev,
          schedules: Array.isArray(scheduleList) ? scheduleList.length : 0,
          loadingSchedules: false
        }));
      } catch (err) {
        console.error('Failed to load schedules:', err);
        setStats(prev => ({ ...prev, loadingSchedules: false }));
      }
    };

    const loadUsers = async () => {
      try {
        const userList = await getUsers();
        setStats(prev => ({
          ...prev,
          users: Array.isArray(userList) ? userList.length : 0,
          loadingUsers: false
        }));
      } catch (err) {
        console.error('Failed to load users:', err);
        setStats(prev => ({ ...prev, loadingUsers: false }));
      }
    };

    loadReports();
    loadDashboards();
    loadSchedules();
    loadUsers();
  }, [getReports, getDashboards, getSchedules, getUsers]);

  const toggleStar = (id, e) => {
    e.stopPropagation();
    setStarredReports(prev => {
      const next = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
      localStorage.setItem('starred_reports', JSON.stringify(next));
      return next;
    });
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Recently';
    }
  };

  const maxReports = useMemo(() => {
    return stats.categoriesData.length > 0
      ? Math.max(...stats.categoriesData.map(c => c.count))
      : 0;
  }, [stats.categoriesData]);

  const recentAssets = useMemo(() => {
    const combined = [...(stats.recentReports || []), ...(stats.recentDashboards || [])];
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));
    return combined;
  }, [stats.recentReports, stats.recentDashboards]);

  const filteredAssets = useMemo(() => {
    if (activeAssetTab === 'reports') {
      return recentAssets.filter(a => a.type === 'report').slice(0, 6);
    }
    if (activeAssetTab === 'dashboards') {
      return recentAssets.filter(a => a.type === 'dashboard').slice(0, 6);
    }
    if (activeAssetTab === 'favorites') {
      return recentAssets.filter(a => starredReports.includes(a.id)).slice(0, 6);
    }
    return recentAssets.slice(0, 6);
  }, [recentAssets, activeAssetTab, starredReports]);

  return (
    <div className="home-dashboard p-6 space-y-6 overflow-y-auto h-full text-[var(--text-strong)] font-inter">
      {/* 1. Header with dynamic time-of-day greeting */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#181c2c] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {greeting}, {user?.name || 'Amanulla Aman'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            No tasks are due today. Enjoy your day!
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => navigate('/designer')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#FF4800] hover:bg-[#e03f00] rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <PlusIcon className="w-4 h-4 stroke-[2.5]" />
            New Report
          </button>
          <button
            onClick={() => navigate('/dashboards')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <FolderPlusIcon className="w-4 h-4" />
            New Dashboard
          </button>
          <button
            onClick={() => window.location.reload()}
            className="p-2.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
            title="Refresh Overview"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. KPI Cards matching soft pastel palette of reference screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Reports KPI Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-[#f0edff] dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
          onClick={() => navigate('/reports')}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Total Reports</p>
              {stats.loadingReports ? (
                <div className="h-8 w-16 bg-indigo-200/50 animate-pulse rounded mt-2" />
              ) : (
                <h3 className="text-3xl font-extrabold mt-1 text-indigo-950 dark:text-white">{stats.reports}</h3>
              )}
            </div>
            <div className="p-3 bg-white/80 dark:bg-indigo-900/60 rounded-xl text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 shadow-2xs">
              <DocumentTextIcon className="w-6 h-6 stroke-[2]" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-200/50 dark:border-indigo-900/60 flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
            <span>Paginated & RDL Reports</span>
            <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.div>

        {/* Dashboards KPI Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-[#fff4e8] dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
          onClick={() => navigate('/dashboards')}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Dashboards</p>
              {stats.loadingDashboards ? (
                <div className="h-8 w-16 bg-amber-200/50 animate-pulse rounded mt-2" />
              ) : (
                <h3 className="text-3xl font-extrabold mt-1 text-amber-950 dark:text-white">{stats.dashboards}</h3>
              )}
            </div>
            <div className="p-3 bg-white/80 dark:bg-amber-900/60 rounded-xl text-amber-600 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50 shadow-2xs">
              <ChartBarIcon className="w-6 h-6 stroke-[2]" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-amber-200/50 dark:border-amber-900/60 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
            <span>Interactive Analytics</span>
            <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.div>

        {/* Schedules KPI Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-[#f7edff] dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
          onClick={() => navigate('/schedules')}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Scheduled Tasks</p>
              {stats.loadingSchedules ? (
                <div className="h-8 w-16 bg-purple-200/50 animate-pulse rounded mt-2" />
              ) : (
                <h3 className="text-3xl font-extrabold mt-1 text-purple-950 dark:text-white">{stats.schedules}</h3>
              )}
            </div>
            <div className="p-3 bg-white/80 dark:bg-purple-900/60 rounded-xl text-purple-600 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/50 shadow-2xs">
              <ClockIcon className="w-6 h-6 stroke-[2]" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-purple-200/50 dark:border-purple-900/60 flex items-center justify-between text-xs text-purple-700 dark:text-purple-300">
            <span>Automated Deliveries</span>
            <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.div>

        {/* Users KPI Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-[#ffe8f0] dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/40 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
          onClick={() => navigate('/settings')}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-pink-700 dark:text-pink-300 uppercase tracking-wider">Team Members</p>
              {stats.loadingUsers ? (
                <div className="h-8 w-16 bg-pink-200/50 animate-pulse rounded mt-2" />
              ) : (
                <h3 className="text-3xl font-extrabold mt-1 text-pink-950 dark:text-white">{stats.users}</h3>
              )}
            </div>
            <div className="p-3 bg-white/80 dark:bg-pink-900/60 rounded-xl text-pink-600 dark:text-pink-300 border border-pink-200/60 dark:border-pink-800/50 shadow-2xs">
              <UserGroupIcon className="w-6 h-6 stroke-[2]" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-pink-200/50 dark:border-pink-900/60 flex items-center justify-between text-xs text-pink-700 dark:text-pink-300">
            <span>Active Collaborators</span>
            <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.div>
      </div>

      {/* 3. Main Content Area (Recent Activity + Shortcuts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent Activity & Content Access (Col span 2) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#181c2c] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white">Recent Activity</h2>
              <p className="text-xs text-[var(--text-muted)]">Quickly pick up where you left off</p>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-medium">
              <button
                onClick={() => setActiveAssetTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeAssetTab === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveAssetTab('reports')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeAssetTab === 'reports'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Reports
              </button>
              <button
                onClick={() => setActiveAssetTab('dashboards')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeAssetTab === 'dashboards'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Dashboards
              </button>
              <button
                onClick={() => setActiveAssetTab('favorites')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeAssetTab === 'favorites'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Favorites ({starredReports.length})
              </button>
            </div>
          </div>

          {/* List of Recent Items */}
          <div className="space-y-2">
            {(stats.loadingReports || stats.loadingDashboards) ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 animate-pulse">
                  <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              ))
            ) : filteredAssets.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                No items found for this filter.
              </div>
            ) : (
              filteredAssets.map(asset => {
                const isStarred = starredReports.includes(asset.id);
                return (
                  <div
                    key={asset.id}
                    onClick={() => {
                      if (asset.type === 'report') {
                        navigate(`/reports?report=${encodeURIComponent(asset.name)}&category=${encodeURIComponent(asset.category)}`);
                      } else {
                        navigate(`/dashboards?dashboardId=${asset.id}`);
                      }
                    }}
                    className="flex items-center justify-between p-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700/60 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-[#FF4800] transition-colors">
                            {asset.name}
                          </h4>
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                            asset.type === 'report'
                              ? 'bg-orange-50 text-[#FF4800] dark:bg-orange-950/40'
                              : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40'
                          }`}>
                            {asset.category}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{asset.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <span className="text-xs text-[var(--text-muted)] hidden sm:block">
                        {formatDate(asset.date)}
                      </span>
                      <button
                        onClick={(e) => toggleStar(asset.id, e)}
                        className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors"
                        title={isStarred ? "Remove from Favorites" : "Add to Favorites"}
                      >
                        {isStarred ? (
                          <StarIconSolid className="w-4 h-4 text-amber-400" />
                        ) : (
                          <StarIconOutline className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        className="flex items-center gap-1 text-xs font-semibold text-[#FF4800] hover:text-[#e03f00] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        View <ArrowRightIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Quick Launch & Category Summary (Col span 1) */}
        <div className="space-y-6">
          {/* Top Categories Card */}
          <div className="bg-white dark:bg-[#181c2c] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Categories</h3>
              <button
                onClick={() => navigate('/reports')}
                className="text-xs font-semibold text-[#FF4800] hover:underline"
              >
                View All
              </button>
            </div>

            <div className="space-y-3">
              {stats.loadingReports ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
                  </div>
                ))
              ) : stats.categoriesData.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-4 text-center">No categories found</p>
              ) : (
                stats.categoriesData.slice(0, 5).map((cat, idx) => {
                  const percent = maxReports > 0 ? (cat.count / maxReports) * 100 : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-800 dark:text-slate-200 truncate">{cat.category}</span>
                        <span className="text-[var(--text-muted)] font-semibold">{cat.count}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className="bg-[#FF4800] h-full rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Report Designer Shortcut Card */}
          <div className="bg-gradient-to-br from-slate-900 to-[#181c2c] text-white rounded-2xl p-6 shadow-md border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
              <SparklesIcon className="w-4 h-4" /> Adhoc Report Builder
            </div>
            <div>
              <h3 className="text-lg font-extrabold">Build Custom Reports</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Design custom RDL reports with our drag-and-drop report designer interface.
              </p>
            </div>
            <button
              onClick={() => navigate('/designer')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Launch Designer <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}