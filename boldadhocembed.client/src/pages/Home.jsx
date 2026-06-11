import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartBarIcon, DocumentTextIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useData } from '../context/DataContext';
import { motion } from 'framer-motion';
import '../styles/home.css';

export default function Home() {
  const navigate = useNavigate();
  const { getAllData, setReportsSidebarCollapsed, setDashboardsSidebarCollapsed } = useData();
  const [stats, setStats] = useState({
    reports: 0,
    dashboards: 0,
    schedules: 0,
    users: 0,
    loading: true,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const { reports: reportTree, dashboards: dashboardList, schedules: scheduleList, users: userList } = await getAllData();

        const treeArr = Array.isArray(reportTree)
          ? reportTree
          : (reportTree && Array.isArray(reportTree.data) ? reportTree.data : []);

        const reportCount = Array.isArray(treeArr)
          ? treeArr.reduce((sum, cat) => {
              const reps = cat.Reports || cat.reports || [];
              return sum + (Array.isArray(reps) ? reps.length : 0);
            }, 0)
          : 0;

        const dashboardCount = Array.isArray(dashboardList) ? dashboardList.length : 0;

        setStats({
          reports: reportCount,
          dashboards: dashboardCount,
          schedules: Array.isArray(scheduleList) ? scheduleList.length : 0,
          users: Array.isArray(userList) ? userList.length : 0,
          loading: false,
        });
      } catch (err) {
        setStats({ reports: 0, dashboards: 0, schedules: 0, users: 0, loading: false });
      }
    };
    load();
  }, [getAllData]);

  return (
    <div className="reports-page font-inter space-y-8 p-6 h-full overflow-y-auto">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="home-hero flex-shrink-0"
      >
        <motion.h1 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl md:text-5xl font-extrabold mb-4 text-gradient"
        >
          Welcome to Bold Reports
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-[var(--text-muted)] mb-10 max-w-2xl mx-auto"
        >
          Your centralized hub for beautiful reports, interactive dashboards, and analytics
        </motion.p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="home-stat-card cursor-pointer"
            onClick={() => {
              setReportsSidebarCollapsed(false);
              navigate('/reports');
            }}
          >
            <div className="stat-icon-wrapper">
              <DocumentTextIcon className="w-8 h-8 text-[var(--brand-500)]" />
            </div>
            <h3 className="stat-value">{stats.reports}</h3>
            <p className="stat-label">Reports</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="home-stat-card cursor-pointer"
            onClick={() => {
              setDashboardsSidebarCollapsed(false);
              navigate('/dashboards');
            }}
          >
            <div className="stat-icon-wrapper">
              <ChartBarIcon className="w-8 h-8 text-[var(--brand-500)]" />
            </div>
            <h3 className="stat-value">{stats.dashboards}</h3>
            <p className="stat-label">Dashboards</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="home-stat-card cursor-pointer"
            onClick={() => {
              navigate('/schedules');
            }}
          >
            <div className="stat-icon-wrapper">
              <ClockIcon className="w-8 h-8 text-[var(--brand-500)]" />
            </div>
            <h3 className="stat-value">{stats.schedules}</h3>
            <p className="stat-label">Schedules</p>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}