import { useState, useEffect } from 'react';
import { ChartBarIcon, DocumentTextIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useData } from '../context/DataContext';
import { motion } from 'framer-motion';
import '../styles/home.css';

export default function Home() {
  const { getAllData, loading, errors } = useData();
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

  // Only keeping hero stats on home page per request

  return (
    <div className="reports-page font-inter space-y-6 p-4 min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="home-hero bg-[var(--surface)] rounded-xl shadow-md p-6 text-center border border-[var(--brand-200)]"
      >
        <h1 className="text-3xl font-bold text-[var(--text-strong)] mb-3">Welcome to Bold Reports Explorer</h1>
        <p className="text-lg text-[var(--text-muted)] mb-6">Your centralized hub for reports, dashboards, and analytics</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="home-stat-card">
            <DocumentTextIcon className="w-8 h-8 text-[var(--brand-500)] mb-3" />
            <h3 className="text-2xl font-bold text-[var(--text-strong)]">{stats.reports}</h3>
            <p className="text-sm text-[var(--text-muted)]">Reports</p>
          </div>
          <div className="home-stat-card">
            <ChartBarIcon className="w-8 h-8 text-[var(--brand-500)] mb-3" />
            <h3 className="text-2xl font-bold text-[var(--text-strong)]">{stats.dashboards}</h3>
            <p className="text-sm text-[var(--text-muted)]">Dashboards</p>
          </div>
          <div className="home-stat-card">
            <ClockIcon className="w-8 h-8 text-[var(--brand-500)] mb-3" />
            <h3 className="text-2xl font-bold text-[var(--text-strong)]">{stats.schedules}</h3>
            <p className="text-sm text-[var(--text-muted)]">Schedules</p>
          </div>
          {/* Users stat removed */}
        </div>
        {/* Quick links: Knowledge Base, User Guide, Support Portal (large cards) */}
        <div className="mt-6 home-quick-links grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
          <a
            className="home-quick-link-card"
            href="https://support.boldreports.com/kb/"
            target="_blank"
            rel="noopener noreferrer"
            title="Bold Reports Knowledge Base"
            aria-label="Open Knowledge Base in new tab"
          >
            <span className="link-icon" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 3h10v14H7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 17c0 1.104-.896 2-2 2H5v-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <div className="link-body">
              <h4>Knowledge Base</h4>
              <p className="desc">Search articles and troubleshooting guides</p>
            </div>
          </a>

          <a
            className="home-quick-link-card primary"
            href="https://help.boldreports.com"
            target="_blank"
            rel="noopener noreferrer"
            title="Bold Reports User Guide"
            aria-label="Open User Guide in new tab"
          >
            <span className="link-icon" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3h8v14H8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 17v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <div className="link-body">
              <h4>User Guide</h4>
              <p className="desc">Step-by-step docs and how-tos</p>
            </div>
          </a>

          <a
            className="home-quick-link-card"
            href="https://support.boldreports.com/support/tickets"
            target="_blank"
            rel="noopener noreferrer"
            title="Create Support Ticket"
            aria-label="Open support ticket creation page in new tab"
          >
            <span className="link-icon" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </span>
            <div className="link-body">
              <h4>Support Portal</h4>
              <p className="desc">Open a ticket or contact support</p>
            </div>
          </a>
        </div>
      </motion.section>
      {/* Other sections removed per request - only hero stats remain */}
    </div>
  );
}