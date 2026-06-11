import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartBarIcon, DocumentTextIcon, ClockIcon, UserGroupIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useData } from '../context/DataContext';
import { motion } from 'framer-motion';
import '../styles/home.css';

export default function Home() {
  const navigate = useNavigate();
  const { getAllData } = useData();
  const [stats, setStats] = useState({
    reports: 0,
    dashboards: 0,
    schedules: 0,
    users: 0,
    loading: true,
    categoriesData: [],
    recentAssets: []
  });

  useEffect(() => {
    const load = async () => {
      try {
        const { reports: reportTree, dashboards: dashboardList, schedules: scheduleList, users: userList } = await getAllData();

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

        const combined = [...allReports, ...allDashboards];
        combined.sort((a, b) => new Date(b.date) - new Date(a.date));

        setStats({
          reports: reportCount,
          dashboards: dashboardCount,
          schedules: Array.isArray(scheduleList) ? scheduleList.length : 0,
          users: Array.isArray(userList) ? userList.length : 0,
          loading: false,
          categoriesData: catData,
          recentAssets: combined.slice(0, 5)
        });
      } catch (err) {
        console.error('Failed to load home page data:', err);
        setStats({
          reports: 0,
          dashboards: 0,
          schedules: 0,
          users: 0,
          loading: false,
          categoriesData: [],
          recentAssets: []
        });
      }
    };
    load();
  }, [getAllData]);

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

  if (stats.loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
          <p className="text-[var(--text-muted)]">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // Calculate some analytics
  const maxReports = stats.categoriesData.length > 0
    ? Math.max(...stats.categoriesData.map(c => c.count))
    : 0;

  const totalAssets = stats.reports + stats.dashboards;

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
              <h3 className="text-3xl font-extrabold mt-1">{stats.reports}</h3>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
              <DocumentTextIcon className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-[var(--text-muted)]">
            <span className="font-semibold text-blue-600 dark:text-blue-400 mr-1.5">{stats.categoriesData.length}</span> categories defined
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
              <h3 className="text-3xl font-extrabold mt-1">{stats.dashboards}</h3>
            </div>
            <div className="p-2.5 bg-orange-50 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400">
              <ChartBarIcon className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-[var(--text-muted)]">
            <span className="font-semibold text-orange-600 dark:text-orange-400 mr-1.5">{stats.dashboards > 0 ? 'Active' : 'No'}</span> instances embedded
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
              <h3 className="text-3xl font-extrabold mt-1">{stats.schedules}</h3>
            </div>
            <div className="p-2.5 bg-green-50 dark:bg-green-900/30 rounded-xl text-green-600 dark:text-green-400">
              <ClockIcon className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-[var(--text-muted)]">
            Automated report deliveries
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
              <h3 className="text-3xl font-extrabold mt-1">{stats.users}</h3>
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
              <UserGroupIcon className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-[var(--text-muted)]">
            Registered team members
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
            {stats.categoriesData.length === 0 ? (
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
              {stats.recentAssets.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-sm text-[var(--text-muted)]">No assets found</td>
                </tr>
              ) : (
                stats.recentAssets.map((asset, idx) => (
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