import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartBarIcon, DocumentTextIcon, ClockIcon, UserGroupIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useData } from '../context/DataContext';
import { motion } from 'framer-motion';
import '../styles/home.css';

export default function Home() {
  const navigate = useNavigate();
  const { getReports, getDashboards, getSchedules, getUsers } = useData();
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
              category: d.CategoryName || d.category || d.Category || 'Uncategorized',
              date: d.ModifiedDate || d.modifiedDate || new Date().toISOString(),
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

  const totalAssets = stats.reports + stats.dashboards;

  const recentAssets = useMemo(() => {
    const combined = [...(stats.recentReports || []), ...(stats.recentDashboards || [])];
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));
    return combined.slice(0, 5);
  }, [stats.recentReports, stats.recentDashboards]);

  return (
    <div className="home-dashboard p-6 space-y-6 overflow-y-auto h-full text-[var(--text-strong)]">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics Overview</h1>
          <p className="text-sm text-[var(--text-muted)]">System status and resource breakdown</p>
        </div>
      </div>

      {/* Analytics KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="dashboard-kpi-card"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Total Reports</p>
              {stats.loadingReports ? (
                <div className="h-9 w-16 bg-gray-200 dark:bg-gray-800 animate-pulse rounded mt-1" />
              ) : (
                <h3 className="text-3xl font-extrabold mt-1">{stats.reports}</h3>
              )}
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
              <DocumentTextIcon className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-[var(--text-muted)] font-medium">
            {stats.loadingReports ? (
              <div className="h-4 w-28 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" />
            ) : (
              <><span className="font-semibold text-blue-600 dark:text-blue-400 mr-1.5">{stats.categoriesData.length}</span> categories defined</>
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="dashboard-kpi-card"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Dashboards</p>
              {stats.loadingDashboards ? (
                <div className="h-9 w-16 bg-gray-200 dark:bg-gray-800 animate-pulse rounded mt-1" />
              ) : (
                <h3 className="text-3xl font-extrabold mt-1">{stats.dashboards}</h3>
              )}
            </div>
            <div className="p-2.5 bg-orange-50 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400">
              <ChartBarIcon className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-[var(--text-muted)] font-medium">
            {stats.loadingDashboards ? (
              <div className="h-4 w-28 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" />
            ) : (
              <><span className="font-semibold text-orange-600 dark:text-orange-400 mr-1.5">{stats.dashboards > 0 ? 'Active' : 'No'}</span> instances embedded</>
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="dashboard-kpi-card"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Schedules</p>
              {stats.loadingSchedules ? (
                <div className="h-9 w-16 bg-gray-200 dark:bg-gray-800 animate-pulse rounded mt-1" />
              ) : (
                <h3 className="text-3xl font-extrabold mt-1">{stats.schedules}</h3>
              )}
            </div>
            <div className="p-2.5 bg-green-50 dark:bg-green-900/30 rounded-xl text-green-600 dark:text-green-400">
              <ClockIcon className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-[var(--text-muted)] font-medium">
            {stats.loadingSchedules ? (
              <div className="h-4 w-28 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" />
            ) : (
              'Automated report deliveries'
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="dashboard-kpi-card"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Total Users</p>
              {stats.loadingUsers ? (
                <div className="h-9 w-16 bg-gray-200 dark:bg-gray-800 animate-pulse rounded mt-1" />
              ) : (
                <h3 className="text-3xl font-extrabold mt-1">{stats.users}</h3>
              )}
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
              <UserGroupIcon className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-[var(--text-muted)] font-medium">
            {stats.loadingUsers ? (
              <div className="h-4 w-28 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" />
            ) : (
              'Registered team members'
            )}
          </div>
        </motion.div>
      </div>

      {/* Main Charts & Table Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Reports by Category Bar Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-3 bg-white dark:bg-[#181c2c] rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm space-y-4"
        >
          <div>
            <h3 className="font-bold text-base">Reports Distribution</h3>
            <p className="text-xs text-[var(--text-muted)]">Number of reports grouped by category</p>
          </div>

          <div className="space-y-4 pt-2">
            {stats.loadingReports ? (
              <div className="space-y-4 py-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between">
                      <div className="h-3.5 w-24 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" />
                      <div className="h-3.5 w-12 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" />
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-gray-200 dark:bg-gray-700 h-full w-1/2 animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats.categoriesData.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-8 text-center">No category data found</p>
            ) : (
              stats.categoriesData.map((cat, idx) => {
                const percent = maxReports > 0 ? (cat.count / maxReports) * 100 : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{cat.category}</span>
                      <span className="font-bold text-[var(--text-muted)]">{cat.count} {cat.count === 1 ? 'report' : 'reports'}</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Assets Summary Circular Ring */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="lg:col-span-2 bg-white dark:bg-[#181c2c] rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm flex flex-col justify-between"
        >
          <div>
            <h3 className="font-bold text-base">Asset Allocation</h3>
            <p className="text-xs text-[var(--text-muted)]">Comparison between reports and dashboards</p>
          </div>

          {(stats.loadingReports || stats.loadingDashboards) ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full border-4 border-gray-200 dark:border-gray-800 border-t-blue-500 animate-spin" />
              <div className="h-4 w-28 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" />
            </div>
          ) : (
            <>
              <div className="flex justify-center items-center py-6 relative">
                <svg width="150" height="150" viewBox="0 0 36 36" className="transform -rotate-90">
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--brand-100)" strokeWidth="3.2" className="dark:stroke-gray-800" />
                  {totalAssets > 0 && (
                    <circle 
                      cx="18" 
                      cy="18" 
                      r="15.915" 
                      fill="none" 
                      stroke="var(--info)" 
                      strokeWidth="3.2" 
                      strokeDasharray={`${(stats.reports / totalAssets) * 100} ${100 - (stats.reports / totalAssets) * 100}`}
                      strokeDashoffset="0"
                    />
                  )}
                  {totalAssets > 0 && (
                    <circle 
                      cx="18" 
                      cy="18" 
                      r="15.915" 
                      fill="none" 
                      stroke="var(--accent)" 
                      strokeWidth="3.2" 
                      strokeDasharray={`${(stats.dashboards / totalAssets) * 100} ${100 - (stats.dashboards / totalAssets) * 100}`}
                      strokeDashoffset={`${100 - (stats.reports / totalAssets) * 100}`}
                    />
                  )}
                </svg>
                <div className="absolute text-center">
                  <span className="text-2xl font-black block">{totalAssets}</span>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Total Assets</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-800 pt-4 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[var(--info)] block" />
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px] uppercase">Reports</span>
                    <span>{stats.reports} ({totalAssets > 0 ? Math.round((stats.reports / totalAssets) * 100) : 0}%)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[var(--accent)] block" />
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px] uppercase">Dashboards</span>
                    <span>{stats.dashboards} ({totalAssets > 0 ? Math.round((stats.dashboards / totalAssets) * 100) : 0}%)</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Recent Activity Table */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-white dark:bg-[#181c2c] rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm space-y-4"
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-base">Recently Modified Assets</h3>
            <p className="text-xs text-[var(--text-muted)]">Quick access to your most recently updated reports and dashboards</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                <th className="pb-3 pr-4">Asset Name</th>
                <th className="pb-3 px-4">Type</th>
                <th className="pb-3 px-4">Category</th>
                <th className="pb-3 px-4">Modified Date</th>
                <th className="pb-3 pl-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(stats.loadingReports || stats.loadingDashboards) ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800/50">
                    <td className="py-4 pr-4"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-16 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" /></td>
                    <td className="py-4 pl-4 text-right"><div className="h-4 w-12 bg-gray-200 dark:bg-gray-800 animate-pulse rounded ml-auto" /></td>
                  </tr>
                ))
              ) : recentAssets.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-sm text-[var(--text-muted)]">No assets found</td>
                </tr>
              ) : (
                recentAssets.map((asset, idx) => (
                  <tr key={idx} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="py-3.5 pr-4 font-semibold text-sm truncate max-w-[200px]" title={asset.name}>{asset.name}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        asset.type === 'report' 
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                          : 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
                      }`}>
                        {asset.type === 'report' ? 'Report' : 'Dashboard'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[var(--text-muted)]">{asset.category}</td>
                    <td className="py-3.5 px-4 text-xs text-[var(--text-muted)]">{formatDate(asset.date)}</td>
                    <td className="py-3.5 pl-4 text-right">
                      <button
                        onClick={() => {
                          if (asset.type === 'report') {
                            navigate(`/reports?report=${encodeURIComponent(asset.name)}&category=${encodeURIComponent(asset.category)}`);
                          } else {
                            navigate(`/dashboards?dashboardId=${asset.id}`);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:text-orange-700 transition-colors"
                      >
                        View <ArrowRightIcon className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}