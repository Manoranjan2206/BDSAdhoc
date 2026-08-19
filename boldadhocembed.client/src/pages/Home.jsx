import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';
import { crmAPI } from '../services/apiService';
import '../styles/home.css';

// Tenant metadata and default stats configurations
const TENANT_DATA = {
  AlphaCorp: {
    industry: 'Enterprise Cloud & SaaS',
    currency: '$',
    baseRevenue: '4.82M',
    growth: '+18.4%',
    dealsCount: 68,
    contactsCount: 340,
    supportCount: 185,
    schedulesCount: 8,
    keyAccounts: ['TechNova Global', 'Apex Systems', 'Skyline Networks'],
  },
  BetaSolutions: {
    industry: 'Digital Marketing & Growth Agency',
    currency: '$',
    baseRevenue: '2.95M',
    growth: '+12.1%',
    dealsCount: 84,
    contactsCount: 290,
    supportCount: 142,
    schedulesCount: 6,
    keyAccounts: ['OmniMedia Group', 'Pulse Interactive', 'Nexus Media'],
  },
  GammaIndustries: {
    industry: 'Heavy Manufacturing & Engineering',
    currency: '$',
    baseRevenue: '6.40M',
    growth: '+22.8%',
    dealsCount: 46,
    contactsCount: 220,
    supportCount: 198,
    schedulesCount: 11,
    keyAccounts: ['Vanguard Heavy Machinery', 'Titan Steel Works', 'AeroDynamics UK'],
  },
  DeltaEnterprises: {
    industry: 'Global Logistics & Supply Chain',
    currency: '$',
    baseRevenue: '5.18M',
    growth: '+15.3%',
    dealsCount: 92,
    contactsCount: 410,
    supportCount: 235,
    schedulesCount: 9,
    keyAccounts: ['Pacific Freightways', 'Atlas Global Shipping', 'Beacon Hubs Ltd'],
  },
};

// Pipeline stage definitions for the visual widget
const PIPELINE_STAGES = [
  { name: 'Qualification', amount: '$1.42M', count: 18, pct: 28, color: 'bg-blue-500', barBg: 'bg-blue-100 dark:bg-blue-950/60' },
  { name: 'Proposal / Quote', amount: '$1.85M', count: 24, pct: 36, color: 'bg-indigo-500', barBg: 'bg-indigo-100 dark:bg-indigo-950/60' },
  { name: 'Negotiation', amount: '$1.10M', count: 14, pct: 22, color: 'bg-amber-500', barBg: 'bg-amber-100 dark:bg-amber-950/60' },
  { name: 'Closed Won', amount: '$0.75M', count: 12, pct: 14, color: 'bg-emerald-500', barBg: 'bg-emerald-100 dark:bg-emerald-950/60' },
];

// Generate dynamic data tailored specifically for user role, tenant, and region
const getRoleHomeData = (role, tenantName, region, userName) => {
  const tenant = TENANT_DATA[tenantName] || TENANT_DATA.AlphaCorp;

  switch (role) {
    case 'Sales':
      return {
        roleDescription: `Managing sales pipeline, high-value opportunities, and customer engagements in ${region}.`,
        kpis: [
          {
            title: 'My Active Pipeline',
            value: `$${(parseFloat(tenant.baseRevenue) * 0.38).toFixed(2)}M`,
            sub: '+24.2% vs last month',
            isPositive: true,
            progress: 78,
            accent: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
            icon: 'handshake',
            colorClass: 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',
            link: '/deals',
          },
          {
            title: 'Quota Attainment',
            value: '108.4%',
            sub: `${region} Target Exceeded`,
            isPositive: true,
            progress: 100,
            accent: 'linear-gradient(90deg, #10b981, #34d399)',
            icon: 'verified',
            colorClass: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
            link: '/deals',
          },
          {
            title: 'Assigned Leads',
            value: `${Math.round(tenant.contactsCount * 0.35)}`,
            sub: '14 qualified this week',
            isPositive: true,
            progress: 64,
            accent: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
            icon: 'person_search',
            colorClass: 'bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400',
            link: '/contacts',
          },
          {
            title: 'Avg Deal Velocity',
            value: '24 Days',
            sub: '-3.5 days cycle time',
            isPositive: true,
            progress: 88,
            accent: 'linear-gradient(90deg, #14b8a6, #2dd4bf)',
            icon: 'speed',
            colorClass: 'bg-teal-100 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400',
            link: '/dashboards',
          },
        ],
        quickActions: [
          { label: 'New Deal', icon: 'handshake', route: '/deals', shortcut: '⌘D', colorClass: 'text-blue-500' },
          { label: 'Add Lead', icon: 'person_add', route: '/contacts', shortcut: '⌘L', colorClass: 'text-purple-500' },
          { label: 'Log Activity', icon: 'event_note', route: '/activities', shortcut: '⌘A', colorClass: 'text-teal-500' },
          { label: 'Sales Reports', icon: 'bar_chart', route: '/reports', shortcut: '⌘R', colorClass: 'text-emerald-500' },
        ],
        tasks: [
          { id: 1, title: `Deliver proposal to ${tenant.keyAccounts[0]} decision makers`, time: '10:30 AM', role: 'Sales', priority: 'HIGH', completed: false },
          { id: 2, title: `Discovery demo with incoming enterprise lead in ${region}`, time: '1:15 PM', role: 'Sales', priority: 'MED', completed: false },
          { id: 3, title: `Follow up on contract terms with ${tenant.keyAccounts[1]}`, time: '3:45 PM', role: 'Sales', priority: 'HIGH', completed: false },
          { id: 4, title: 'Update CRM stage probabilities for Q3 pipeline', time: '5:00 PM', role: 'Sales', priority: 'NORMAL', completed: true },
        ],
        pinnedItems: [
          { title: `${tenant.keyAccounts[0]} Expansion`, subtitle: 'High Priority Opportunity • $185,000', icon: 'request_quote', badge: 'Active Deal', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', link: '/deals' },
          { title: `${tenant.keyAccounts[1]}`, subtitle: 'Enterprise Key Account • Renewal Q4', icon: 'corporate_fare', badge: 'Key Tier 1', badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300', link: '/contacts' },
          { title: 'Sales Performance Analytics', subtitle: 'Bold BI Executive Dashboard • Live', icon: 'pie_chart', badge: 'BI Live', badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', link: '/dashboards' },
        ],
        announcements: [
          { category: 'Sales', time: '1 hour ago', title: `${tenantName} Q3 Sales Kickoff`, description: `Special incentive program launched for ${region} reps closing expansion deals this quarter.`, colorClass: 'bg-blue-500' },
          { category: 'Security', time: 'Yesterday', title: 'Kanban Stage Automation Active', description: 'Deals now trigger automatic manager notifications upon reaching Proposal and Negotiation stages.', colorClass: 'bg-purple-500' },
          { category: 'BI Analytics', time: 'Oct 14', title: 'Real-Time Win-Loss Analytics Ready', description: 'Explore conversion funnels in the Embedded Bold BI dashboard module.', colorClass: 'bg-emerald-500' },
        ],
      };

    case 'Finance':
      return {
        roleDescription: `Managing financial forecasting, revenue recognition, and invoice reconciliations for ${tenantName}.`,
        kpis: [
          {
            title: 'Recognized Revenue',
            value: `$${tenant.baseRevenue}`,
            sub: `${tenant.growth} YoY Growth`,
            isPositive: true,
            progress: 92,
            accent: 'linear-gradient(90deg, #10b981, #059669)',
            icon: 'account_balance',
            colorClass: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
            link: '/reports',
          },
          {
            title: 'Monthly Recurring (MRR)',
            value: `$${(parseFloat(tenant.baseRevenue) * 0.22).toFixed(2)}M`,
            sub: '+8.6% new subscriptions',
            isPositive: true,
            progress: 81,
            accent: 'linear-gradient(90deg, #2563eb, #3b82f6)',
            icon: 'trending_up',
            colorClass: 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',
            link: '/dashboards',
          },
          {
            title: 'Pending Invoices',
            value: `$${(parseFloat(tenant.baseRevenue) * 0.08).toFixed(2)}M`,
            sub: '12 accounts in collections',
            isPositive: false,
            progress: 35,
            accent: 'linear-gradient(90deg, #f97316, #fb923c)',
            icon: 'receipt_long',
            colorClass: 'bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400',
            link: '/deals',
          },
          {
            title: 'Scheduled Audit Jobs',
            value: `${tenant.schedulesCount} Active`,
            sub: 'Automated CSV/PDF exports',
            isPositive: true,
            progress: 100,
            accent: 'linear-gradient(90deg, #9333ea, #a855f7)',
            icon: 'calendar_month',
            colorClass: 'bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400',
            link: '/schedules',
          },
        ],
        quickActions: [
          { label: 'Revenue BI', icon: 'pie_chart', route: '/dashboards', shortcut: '⌘B', colorClass: 'text-emerald-500' },
          { label: 'Schedule Job', icon: 'calendar_month', route: '/schedules', shortcut: '⌘S', colorClass: 'text-purple-500' },
          { label: 'View Reports', icon: 'description', route: '/reports', shortcut: '⌘R', colorClass: 'text-blue-500' },
          { label: 'Deals Ledger', icon: 'receipt_long', route: '/deals', shortcut: '⌘D', colorClass: 'text-amber-500' },
        ],
        tasks: [
          { id: 1, title: `Reconcile monthly wire receipts for ${tenantName}`, time: '9:00 AM', role: 'Finance', priority: 'HIGH', completed: false },
          { id: 2, title: `Review tax exemptions for ${tenant.keyAccounts[0]} invoice`, time: '11:30 AM', role: 'Finance', priority: 'MED', completed: false },
          { id: 3, title: `Generate Q3 Gross Margin Variance Report in ${region}`, time: '2:15 PM', role: 'Finance', priority: 'HIGH', completed: false },
          { id: 4, title: 'Approve vendor expense reimbursements batch #84', time: '4:45 PM', role: 'Finance', priority: 'NORMAL', completed: true },
        ],
        pinnedItems: [
          { title: 'Q3 Financial Health Statement', subtitle: 'Bold Report • PDF/Excel Ready', icon: 'description', badge: 'Audit Ready', badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', link: '/reports' },
          { title: 'Executive Revenue Dashboard', subtitle: 'Bold BI • Real-Time MRR', icon: 'pie_chart', badge: 'Live Metrics', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', link: '/dashboards' },
          { title: 'Daily Revenue Sync Schedule', subtitle: 'Automated Email • 06:00 AM Daily', icon: 'schedule', badge: 'Cron Active', badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300', link: '/schedules' },
        ],
        announcements: [
          { category: 'Finance', time: '3 hours ago', title: `${tenantName} Q3 Close Checklist`, description: 'All departments must finalize and approve open deal invoices before month-end accounting close.', colorClass: 'bg-emerald-500' },
          { category: 'BI Analytics', time: 'Yesterday', title: 'Automated Tax Compliance Reports', description: 'New Bold Reports templates deployed for automated VAT/GST summaries.', colorClass: 'bg-blue-500' },
          { category: 'Security', time: 'Oct 11', title: 'ERP Gateway Re-indexed', description: 'Enterprise payment gateways are operating at nominal latency across server clusters.', colorClass: 'bg-purple-500' },
        ],
      };

    case 'Support':
      return {
        roleDescription: `Monitoring customer support SLA compliance, tickets queue, and client satisfaction in ${region}.`,
        kpis: [
          {
            title: 'Open Support Cases',
            value: `${Math.round(tenant.supportCount * 0.18)}`,
            sub: '4 high-priority escalations',
            isPositive: false,
            progress: 42,
            accent: 'linear-gradient(90deg, #ea580c, #f97316)',
            icon: 'confirmation_number',
            colorClass: 'bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400',
            link: '/tickets',
          },
          {
            title: 'First Response SLA',
            value: '98.6%',
            sub: 'Avg response < 12 mins',
            isPositive: true,
            progress: 98,
            accent: 'linear-gradient(90deg, #10b981, #059669)',
            icon: 'timer',
            colorClass: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
            link: '/tickets',
          },
          {
            title: 'Customer CSAT',
            value: '4.92 / 5.0',
            sub: '98.1% positive feedback',
            isPositive: true,
            progress: 96,
            accent: 'linear-gradient(90deg, #0284c7, #38bdf8)',
            icon: 'sentiment_very_satisfied',
            colorClass: 'bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400',
            link: '/dashboards',
          },
          {
            title: 'Resolved This Week',
            value: `${Math.round(tenant.supportCount * 0.42)} Cases`,
            sub: '+14% resolution speed',
            isPositive: true,
            progress: 88,
            accent: 'linear-gradient(90deg, #0d9488, #14b8a6)',
            icon: 'task_alt',
            colorClass: 'bg-teal-100 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400',
            link: '/tickets',
          },
        ],
        quickActions: [
          { label: 'View Queue', icon: 'confirmation_number', route: '/tickets', shortcut: '⌘T', colorClass: 'text-orange-500' },
          { label: 'Customer Base', icon: 'contacts', route: '/contacts', shortcut: '⌘C', colorClass: 'text-blue-500' },
          { label: 'SLA Dashboard', icon: 'pie_chart', route: '/dashboards', shortcut: '⌘S', colorClass: 'text-teal-500' },
          { label: 'Audit Logs', icon: 'security', route: '/operations', shortcut: '⌘A', colorClass: 'text-purple-500' },
        ],
        tasks: [
          { id: 1, title: `Investigate SSO integration ticket #TKT-${tenantName.slice(0, 3).toUpperCase()}-1042`, time: '9:30 AM', role: 'Support', priority: 'HIGH', completed: false },
          { id: 2, title: `Escalation call with ${tenant.keyAccounts[0]} Technical Director`, time: '1:00 PM', role: 'Support', priority: 'HIGH', completed: false },
          { id: 3, title: `Review and resolve Tier 2 latency ticket in ${region}`, time: '3:15 PM', role: 'Support', priority: 'MED', completed: false },
          { id: 4, title: 'Update internal Knowledge Base for API token renewal', time: '4:30 PM', role: 'Support', priority: 'NORMAL', completed: true },
        ],
        pinnedItems: [
          { title: `${tenant.keyAccounts[0]} SLA Tier 1`, subtitle: 'VIP Enterprise Account • 24/7 Phone Support', icon: 'support_agent', badge: 'SLA VIP', badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', link: '/tickets' },
          { title: 'Support SLA Compliance BI', subtitle: 'Bold BI • Resolution Metrics', icon: 'pie_chart', badge: 'BI Live', badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300', link: '/dashboards' },
          { title: 'Weekly Support Summary', subtitle: 'Automated Report • Monday 08:00 AM', icon: 'description', badge: 'Scheduled', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', link: '/reports' },
        ],
        announcements: [
          { category: 'Support', time: '1 hour ago', title: `${tenantName} SLA Response Time Record`, description: `Engineers in ${region} achieved an average first-response time of 8.4 minutes this week.`, colorClass: 'bg-orange-500' },
          { category: 'System', time: 'Yesterday', title: 'Portal Help Center Upgraded', description: 'Updated customer knowledge base with video guides for embedded BI and Report exports.', colorClass: 'bg-blue-500' },
          { category: 'Security', time: 'Oct 10', title: 'Database Optimization Complete', description: 'Row-Level Security query optimizations reduced ticket filtering latency by 45%.', colorClass: 'bg-teal-500' },
        ],
      };

    case 'Operations':
      return {
        roleDescription: `Overseeing cross-regional marketing campaigns, workflow automation, and security audit logs in ${region}.`,
        kpis: [
          {
            title: 'Live Campaigns',
            value: '12 Active',
            sub: '+3 launched this month',
            isPositive: true,
            progress: 75,
            accent: 'linear-gradient(90deg, #0d9488, #2dd4bf)',
            icon: 'rocket_launch',
            colorClass: 'bg-teal-100 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400',
            link: '/operations',
          },
          {
            title: 'MQL Lead Velocity',
            value: `${Math.round(tenant.contactsCount * 0.45)} MQLs`,
            sub: '+18.5% conversion rate',
            isPositive: true,
            progress: 82,
            accent: 'linear-gradient(90deg, #2563eb, #60a5fa)',
            icon: 'group_add',
            colorClass: 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',
            link: '/contacts',
          },
          {
            title: 'Campaign ROI',
            value: '342%',
            sub: `$${(parseFloat(tenant.baseRevenue) * 0.45).toFixed(2)}M pipeline`,
            isPositive: true,
            progress: 95,
            accent: 'linear-gradient(90deg, #10b981, #34d399)',
            icon: 'query_stats',
            colorClass: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
            link: '/dashboards',
          },
          {
            title: 'Audit Log Trail',
            value: '1,420 Events',
            sub: '100% compliance verified',
            isPositive: true,
            progress: 100,
            accent: 'linear-gradient(90deg, #7c3aed, #c084fc)',
            icon: 'security',
            colorClass: 'bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400',
            link: '/operations',
          },
        ],
        quickActions: [
          { label: 'Campaigns', icon: 'campaign', route: '/operations', shortcut: '⌘C', colorClass: 'text-teal-500' },
          { label: 'Security Trail', icon: 'verified_user', route: '/operations', shortcut: '⌘S', colorClass: 'text-purple-500' },
          { label: 'Marketing Leads', icon: 'contacts', route: '/contacts', shortcut: '⌘L', colorClass: 'text-blue-500' },
          { label: 'Campaign BI', icon: 'pie_chart', route: '/dashboards', shortcut: '⌘B', colorClass: 'text-emerald-500' },
        ],
        tasks: [
          { id: 1, title: `Optimize email nurture sequence for ${region} prospects`, time: '10:00 AM', role: 'Operations', priority: 'HIGH', completed: false },
          { id: 2, title: `Review LinkedIn ads ROI metrics for ${tenantName}`, time: '1:45 PM', role: 'Operations', priority: 'MED', completed: false },
          { id: 3, title: `Audit user role access policies across ${tenantName} databases`, time: '3:30 PM', role: 'Operations', priority: 'HIGH', completed: false },
          { id: 4, title: 'Verify daily Postgres automated database backups', time: '5:15 PM', role: 'Operations', priority: 'NORMAL', completed: true },
        ],
        pinnedItems: [
          { title: `${region} Growth Campaign 2026`, subtitle: 'Multi-Channel Omnichannel Campaign • Active', icon: 'campaign', badge: 'Active Lead Gen', badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300', link: '/operations' },
          { title: 'Security & Audit Event Trail', subtitle: 'PostgreSQL Real-Time Security Logging', icon: 'security', badge: 'RLS Verified', badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300', link: '/operations' },
          { title: 'Marketing Attribution Dashboard', subtitle: 'Bold BI • Conversion Insights', icon: 'pie_chart', badge: 'BI Analytics', badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', link: '/dashboards' },
        ],
        announcements: [
          { category: 'Operations', time: '2 hours ago', title: `${tenantName} Automation v2.4`, description: `Automated lead enrichment rules deployed for all inbound leads in ${region}.`, colorClass: 'bg-teal-500' },
          { category: 'Security', time: 'Yesterday', title: 'Postgres Audit Logs Retention Active', description: 'Audit trail events synchronized and stored with full SHA-256 integrity validation.', colorClass: 'bg-purple-500' },
          { category: 'BI Analytics', time: 'Oct 09', title: 'Bold BI Workspace Sync Complete', description: 'Cross-functional operations analytics updated with real-time pipeline velocity numbers.', colorClass: 'bg-blue-500' },
        ],
      };

    // Default: Admin
    case 'Admin':
    default:
      return {
        roleDescription: `Overview of ${tenantName} (${tenant.industry}) operations and performance metrics for ${region}.`,
        kpis: [
          {
            title: 'Total Active Pipeline',
            value: `$${tenant.baseRevenue}`,
            sub: `${tenant.growth} YoY Growth`,
            isPositive: true,
            progress: 88,
            accent: 'linear-gradient(90deg, #ff4800, #ff8800)',
            icon: 'handshake',
            colorClass: 'bg-orange-100 dark:bg-orange-950/50 text-brand-orange',
            link: '/deals',
          },
          {
            title: 'CRM Contacts & Leads',
            value: `${tenant.contactsCount}`,
            sub: 'Across 4 Global Regions',
            isPositive: true,
            progress: 74,
            accent: 'linear-gradient(90deg, #2563eb, #60a5fa)',
            icon: 'contacts',
            colorClass: 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',
            link: '/contacts',
          },
          {
            title: 'Support Cases Queue',
            value: `${tenant.supportCount}`,
            sub: '4.88 / 5.0 Global CSAT Score',
            isPositive: true,
            progress: 92,
            accent: 'linear-gradient(90deg, #eab308, #fde047)',
            icon: 'confirmation_number',
            colorClass: 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
            link: '/tickets',
          },
          {
            title: 'Scheduled Jobs',
            value: `${tenant.schedulesCount} Active`,
            sub: 'Automated PDF/Excel delivery',
            isPositive: true,
            progress: 100,
            accent: 'linear-gradient(90deg, #10b981, #34d399)',
            icon: 'calendar_month',
            colorClass: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
            link: '/schedules',
          },
        ],
        quickActions: [
          { label: 'Sales Deals', icon: 'handshake', route: '/deals', shortcut: '⌘D', colorClass: 'text-brand-orange' },
          { label: 'Contacts', icon: 'contacts', route: '/contacts', shortcut: '⌘C', colorClass: 'text-blue-500' },
          { label: 'BI Dashboards', icon: 'pie_chart', route: '/dashboards', shortcut: '⌘B', colorClass: 'text-purple-500' },
          { label: 'Support Queue', icon: 'headset_mic', route: '/tickets', shortcut: '⌘T', colorClass: 'text-amber-500' },
        ],
        tasks: [
          { id: 1, title: `Approve Q3 vendor Master Services Agreement for ${tenant.keyAccounts[0]}`, time: '10:00 AM', role: 'Admin', priority: 'HIGH', completed: false },
          { id: 2, title: `Review quarterly revenue forecast with ${tenantName} board`, time: '1:30 PM', role: 'Finance', priority: 'HIGH', completed: false },
          { id: 3, title: `Evaluate ${region} sales team expansion proposals`, time: '3:00 PM', role: 'Sales', priority: 'MED', completed: false },
          { id: 4, title: `Verify PostgreSQL RLS tenant database replication status`, time: '4:15 PM', role: 'Admin', priority: 'NORMAL', completed: true },
        ],
        pinnedItems: [
          { title: `${tenant.keyAccounts[0]}`, subtitle: 'Tier 1 Enterprise Client • Strategic Partner', icon: 'corporate_fare', badge: 'Tier 1', badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300', link: '/contacts' },
          { title: `${tenant.keyAccounts[1]} Renewal`, subtitle: 'Closed Won Opportunity • $240,000', icon: 'request_quote', badge: 'Closed Won', badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', link: '/deals' },
          { title: 'Executive BI Overview', subtitle: 'Bold BI Enterprise Dashboard • Real-Time', icon: 'pie_chart', badge: 'Real-Time', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', link: '/dashboards' },
        ],
        announcements: [
          { category: 'System', time: '2 hours ago', title: 'Enterprise Multitenant Security Active', description: `All CRM tables and live operational data operate with isolated row-level security policies for ${tenantName}.`, colorClass: 'bg-brand-orange' },
          { category: 'Sales', time: 'Yesterday', title: `${tenantName} Q3 Expansion Goals Met`, description: `Enterprise deals closed across ${region} exceeded baseline quarterly expectations by 14.8%.`, colorClass: 'bg-blue-500' },
          { category: 'Scheduler', time: 'Oct 12', title: 'Automated Report Delivery Configured', description: 'Enterprise reports scheduled for automatic Monday morning executive inbox distribution.', colorClass: 'bg-emerald-500' },
        ],
      };
  }
};

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeRoleOverride, setActiveRoleOverride] = useState(null);
  const [tasksState, setTasksState] = useState(null);
  const [taskFilter, setTaskFilter] = useState('All');
  const [announcementFilter, setAnnouncementFilter] = useState('All');
  const [pgSummary, setPgSummary] = useState(null);
  const [loadingDb, setLoadingDb] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState('Just now');

  useEffect(() => {
    const loadUser = () => {
      const currentUser = authService.getUser();
      setUser(currentUser?.user || currentUser);
    };
    loadUser();

    window.addEventListener('auth-changed', loadUser);
    return () => window.removeEventListener('auth-changed', loadUser);
  }, []);

  const userName = user?.name || user?.firstName || 'Anna Smith';
  const effectiveRole = activeRoleOverride || user?.role || 'Admin';
  const tenantName = user?.tenantName || (user?.email?.includes('alpha') ? 'AlphaCorp' : user?.email?.includes('beta') ? 'BetaSolutions' : user?.email?.includes('gamma') ? 'GammaIndustries' : user?.email?.includes('delta') ? 'DeltaEnterprises' : 'AlphaCorp');
  const userRegion = user?.region || 'North America';

  // Fetch real PostgreSQL CRM data
  const fetchPgData = async () => {
    if (!user) return;
    setLoadingDb(true);
    try {
      const summary = await crmAPI.getHomeSummary({
        tenantName,
        email: user?.email,
        role: effectiveRole,
        region: userRegion
      });
      if (summary) {
        setPgSummary(summary);
        if (summary.tasks && summary.tasks.length > 0) {
          setTasksState(summary.tasks.map(t => ({
            id: t.id,
            title: t.title,
            time: t.time || '10:00 AM',
            role: t.role || effectiveRole,
            priority: t.priority || 'MED',
            completed: Boolean(t.completed)
          })));
        }
      }
      setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.warn('[PostgreSQL CRM] Using fallback stats while database responds:', err);
    } finally {
      setLoadingDb(false);
    }
  };

  useEffect(() => {
    fetchPgData();
  }, [effectiveRole, tenantName, userRegion]);

  // Compute dynamic role/tenant home content with live PostgreSQL overlays
  const homeData = useMemo(() => {
    const base = getRoleHomeData(effectiveRole, tenantName, userRegion, userName);
    if (!pgSummary) return base;

    // Overlay live PostgreSQL metrics
    const updatedKpis = base.kpis.map((kpi, idx) => {
      if (effectiveRole === 'Sales') {
        if (idx === 0 && pgSummary.totalActivePipeline > 0) {
          return { ...kpi, value: `$${(pgSummary.totalActivePipeline / 1000000).toFixed(2)}M`, sub: `${pgSummary.wonDealsCount} Won Deals in ${userRegion}` };
        }
        if (idx === 2 && pgSummary.totalContactsCount > 0) {
          return { ...kpi, value: `${pgSummary.totalContactsCount}`, sub: `Active Accounts in ${userRegion}` };
        }
        if (idx === 3 && pgSummary.totalDealsCount > 0) {
          return { ...kpi, value: `${pgSummary.totalDealsCount} Deals`, sub: `${pgSummary.wonDealsCount} Closed Won` };
        }
      } else if (effectiveRole === 'Finance') {
        if (idx === 0 && pgSummary.totalRevenue > 0) {
          return { ...kpi, value: `$${(pgSummary.totalRevenue / 1000000).toFixed(2)}M` };
        }
        if (idx === 1 && pgSummary.totalActivePipeline > 0) {
          return { ...kpi, value: `$${(pgSummary.totalActivePipeline * 0.12 / 1000).toFixed(1)}k` };
        }
      } else if (effectiveRole === 'Support') {
        if (idx === 0 && pgSummary.openTicketsCount >= 0) {
          return { ...kpi, value: `${pgSummary.openTicketsCount} Open`, sub: `${pgSummary.totalTicketsCount} Total Scoped Tickets` };
        }
        if (idx === 2 && pgSummary.csatScore > 0) {
          return { ...kpi, value: `${pgSummary.csatScore} / 5.0` };
        }
      } else if (effectiveRole === 'Operations') {
        if (idx === 0 && pgSummary.activeCampaignsCount >= 0) {
          return { ...kpi, value: `${pgSummary.activeCampaignsCount} Active` };
        }
      } else { // Admin
        if (idx === 0 && pgSummary.totalActivePipeline > 0) {
          return { ...kpi, value: `$${(pgSummary.totalActivePipeline / 1000000).toFixed(2)}M`, sub: `${pgSummary.wonDealsCount} Won Deals • YoY Growth` };
        }
        if (idx === 1 && pgSummary.totalContactsCount > 0) {
          return { ...kpi, value: `${pgSummary.totalContactsCount}` };
        }
        if (idx === 2 && pgSummary.totalTicketsCount > 0) {
          return { ...kpi, value: `${pgSummary.totalTicketsCount}`, sub: `${pgSummary.openTicketsCount} Open • ${pgSummary.csatScore} CSAT` };
        }
      }
      return kpi;
    });

    const updatedPinned = (pgSummary.pinnedAccounts && pgSummary.pinnedAccounts.length > 0)
      ? pgSummary.pinnedAccounts.map(p => ({
          title: p.title,
          subtitle: p.subtitle,
          icon: p.icon || 'corporate_fare',
          badge: 'Live DB',
          badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
          link: p.link || '/contacts'
        }))
      : base.pinnedItems;

    return {
      ...base,
      kpis: updatedKpis,
      pinnedItems: updatedPinned
    };
  }, [effectiveRole, tenantName, userRegion, userName, pgSummary]);

  // Sync tasks state when role/data changes
  useEffect(() => {
    if (homeData?.tasks) {
      setTasksState(homeData.tasks);
    }
  }, [homeData]);

  const toggleTask = (id) => {
    setTasksState(prev => prev ? prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t) : []);
  };

  const tasksToDisplay = useMemo(() => {
    const list = tasksState || homeData.tasks || [];
    if (taskFilter === 'Pending') return list.filter(t => !t.completed);
    if (taskFilter === 'Completed') return list.filter(t => t.completed);
    return list;
  }, [tasksState, homeData, taskFilter]);

  const completedTasksCount = useMemo(() => {
    const list = tasksState || homeData.tasks || [];
    return list.filter(t => t.completed).length;
  }, [tasksState, homeData]);

  const totalTasksCount = (tasksState || homeData.tasks || []).length;
  const taskCompletionPct = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const filteredAnnouncements = useMemo(() => {
    const list = homeData.announcements || [];
    if (announcementFilter === 'All') return list;
    return list.filter(a => a.category.toLowerCase().includes(announcementFilter.toLowerCase()));
  }, [homeData, announcementFilter]);

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="p-container-padding max-w-[1600px] mx-auto space-y-6 home-dashboard">
      
      {/* Executive Hero Mesh Banner */}
      <div className="hero-gradient-card rounded-2xl p-6 md:p-8 relative overflow-hidden">
        {/* Background Ambient Orbs */}
        <div className="hero-orb-1 absolute -right-16 -top-16 w-80 h-80 bg-brand-orange/15 dark:bg-brand-orange/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="hero-orb-2 absolute right-48 bottom-0 w-64 h-64 bg-indigo-500/15 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-4">
          
          {/* Top Bar Pills & Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-700/60 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-orange/10 text-brand-orange border border-brand-orange/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-orange animate-ping"></span>
                {tenantName}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                📍 {userRegion}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {effectiveRole} Workspace
              </span>
            </div>

            {/* Live Sync Button & Timestamp */}
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="hidden sm:inline">Last Synced: <strong>{lastSyncedTime}</strong></span>
              <button
                onClick={fetchPgData}
                disabled={loadingDb}
                title="Refresh live PostgreSQL CRM metrics"
                className="px-3 py-1.5 rounded-lg font-medium bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-brand-orange border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95"
              >
                <span className={`material-symbols-outlined text-[16px] ${loadingDb ? 'animate-spin text-brand-orange' : ''}`}>sync</span>
                {loadingDb ? 'Syncing...' : 'Live Sync'}
              </button>
            </div>
          </div>

          {/* Main Hero Header */}
          <div className="pt-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
              {todayFormatted}
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Welcome back, <span className="bg-gradient-to-r from-brand-orange via-amber-500 to-indigo-600 bg-clip-text text-transparent">{userName}</span>!
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 max-w-3xl mt-1">
              {homeData.roleDescription}
            </p>
          </div>

          {/* AI Executive Insight Ticker */}
          <div className="ai-ticker-badge rounded-xl p-3 border border-brand-orange/20 dark:border-brand-orange/30 flex items-center gap-3 text-xs md:text-sm text-slate-800 dark:text-slate-200">
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-brand-orange text-white flex items-center justify-center font-bold">
              ✨
            </span>
            <div className="flex-1 min-w-0">
              <strong className="text-brand-orange dark:text-amber-400">AI Executive Ticker:</strong> Performance velocity in <strong>{userRegion}</strong> is tracking <strong>+18.4% YoY</strong>. Quota attainment goal achieved for {tenantName} quarterly targets.
            </div>
            <Link to="/dashboards" className="text-xs font-bold text-brand-orange hover:underline flex items-center gap-0.5 whitespace-nowrap">
              Open Analytics <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>

        </div>
      </div>

      {/* CRM Dynamic KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {homeData.kpis.map((kpi, idx) => (
          <Link
            key={idx}
            to={kpi.link}
            className="kpi-card-enhanced group"
            style={{ '--card-accent': kpi.accent }}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate max-w-[170px]">
                {kpi.title}
              </span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${kpi.colorClass} group-hover:scale-110 transition-transform`}>
                <span className="material-symbols-outlined text-[24px]">{kpi.icon}</span>
              </div>
            </div>

            <div className="mb-3">
              <h3 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white group-hover:text-brand-orange transition-colors">
                {kpi.value}
              </h3>
              <div className={`text-xs font-semibold flex items-center gap-1 mt-1 ${kpi.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                <span className="material-symbols-outlined text-[14px]">
                  {kpi.isPositive ? 'trending_up' : 'trending_down'}
                </span>
                {kpi.sub}
              </div>
            </div>

            {/* Sparkline Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                <span>Target Progress</span>
                <span>{kpi.progress}%</span>
              </div>
              <div className="sparkbar-track">
                <div
                  className="sparkbar-fill"
                  style={{ width: `${kpi.progress}%`, background: kpi.accent }}
                ></div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Interactive Deal Pipeline Visualizer Widget */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-orange">bar_chart</span>
              {effectiveRole} Pipeline & Opportunity Stages
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Distribution of enterprise sales opportunities by stage in {userRegion} for {tenantName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Total Scoped:</span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-brand-orange/10 text-brand-orange border border-brand-orange/20">
              $5.12M
            </span>
            <Link to="/deals" className="text-xs font-bold text-slate-500 hover:text-brand-orange transition-colors flex items-center gap-0.5">
              View Kanban <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </Link>
          </div>
        </div>

        {/* Visual Stage Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PIPELINE_STAGES.map((stage, idx) => (
            <div key={idx} className="bg-slate-50/80 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-200/60 dark:border-slate-700/60 pipeline-stage-bar">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${stage.color}`}></span>
                  {stage.name}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {stage.count} deals
                </span>
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mb-2">
                {stage.amount}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                  <span>Pipeline Allocation</span>
                  <span>{stage.pct}%</span>
                </div>
                <div className={`w-full h-2 rounded-full ${stage.barBg} overflow-hidden`}>
                  <div className={`h-full rounded-full ${stage.color}`} style={{ width: `${stage.pct}%` }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

        {/* Quick Actions (4 cols) */}
        <div className="md:col-span-4 glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-orange">bolt</span>
              Quick Actions
            </h2>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Shortcuts</span>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-1">
            {homeData.quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => navigate(action.route)}
                className="quick-action-tile rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 cursor-pointer group relative overflow-hidden"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className={`material-symbols-outlined ${action.colorClass} text-[26px]`}>
                    {action.icon}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand-orange transition-colors">
                    {action.label}
                  </span>
                  <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400">
                    {action.shortcut}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-center">
            <button
              onClick={() => navigate('/deals')}
              className="w-full py-2 rounded-xl text-xs font-bold text-brand-orange hover:bg-brand-orange/10 border border-brand-orange/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              Create Custom Action
            </button>
          </div>
        </div>

        {/* Dynamic Tasks Manager (5 cols) */}
        <div className="md:col-span-5 glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex flex-col shadow-sm">
          
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-orange">checklist</span>
              {effectiveRole} Action Plan
            </h2>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              {['All', 'Pending', 'Completed'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setTaskFilter(tab)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    taskFilter === tab
                      ? 'bg-white dark:bg-slate-700 text-brand-orange shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Task Completion Progress */}
          <div className="mb-4 space-y-1">
            <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>Today's Progress</span>
              <span>{completedTasksCount} of {totalTasksCount} tasks ({taskCompletionPct}%)</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-orange to-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${taskCompletionPct}%` }}
              ></div>
            </div>
          </div>

          {/* Task Items List */}
          <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-[260px]">
            {tasksToDisplay.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No {taskFilter.toLowerCase()} tasks for {effectiveRole} right now.
              </div>
            ) : (
              tasksToDisplay.map(task => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`rounded-xl p-3 border transition-all cursor-pointer flex items-start gap-3 ${
                    task.completed
                      ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-800 opacity-75'
                      : 'bg-white/90 dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/80 hover:border-brand-orange/40 hover:shadow-sm'
                  }`}
                >
                  <div className="mt-0.5">
                    <span className={`material-symbols-outlined text-[20px] transition-colors ${task.completed ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}>
                      {task.completed ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className={`text-xs font-bold truncate ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                        {task.title}
                      </h4>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                        task.priority === 'HIGH' ? 'tag-high' : task.priority === 'MED' ? 'tag-med' : 'tag-normal'
                      }`}>
                        {task.priority || 'NORMAL'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 font-medium">
                        <span className="material-symbols-outlined text-[13px]">schedule</span> {task.time}
                      </span>
                      <span className="font-semibold text-brand-orange">
                        {task.role}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pinned & Key Accounts (3 cols) */}
        <div className="md:col-span-3 glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex flex-col shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-orange">push_pin</span>
            Pinned Accounts
          </h2>

          <div className="space-y-3 flex-1">
            {homeData.pinnedItems.map((item, idx) => (
              <Link
                key={idx}
                to={item.link}
                className="block p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 hover:border-brand-orange/40 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-orange/10 text-brand-orange flex items-center justify-center flex-shrink-0 font-bold group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  </div>
                  <div className="overflow-hidden min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand-orange transition-colors truncate">
                        {item.title}
                      </p>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>

      {/* Dynamic Filterable Announcements Feed */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-orange/10 text-brand-orange flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">campaign</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {tenantName} Enterprise Broadcast Feed
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live organization updates and row-level security audit releases
              </p>
            </div>
          </div>

          {/* Announcement Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['All', 'Sales', 'Finance', 'Support', 'Security'].map(filterCat => (
              <button
                key={filterCat}
                onClick={() => setAnnouncementFilter(filterCat)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  announcementFilter === filterCat
                    ? 'bg-brand-orange text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {filterCat}
              </button>
            ))}
          </div>
        </div>

        {/* Announcement Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredAnnouncements.length === 0 ? (
            <div className="col-span-3 py-6 text-center text-xs text-slate-400">
              No announcements found for "{announcementFilter}".
            </div>
          ) : (
            filteredAnnouncements.map((ann, idx) => (
              <div
                key={idx}
                className="bg-slate-50/80 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200/70 dark:border-slate-700/70 hover:border-brand-orange/40 hover:shadow-md transition-all relative overflow-hidden group"
              >
                <div className={`absolute top-0 left-0 w-1.5 h-full ${ann.colorClass}`}></div>
                
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-brand-orange/10 text-brand-orange border border-brand-orange/20">
                    {ann.category}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">schedule</span>
                    {ann.time}
                  </span>
                </div>

                <h4 className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 mb-1.5 group-hover:text-brand-orange transition-colors line-clamp-1">
                  {ann.title}
                </h4>
                
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {ann.description}
                </p>
              </div>
            ))
          )}
        </div>

      </div>

    </div>
  );
}
