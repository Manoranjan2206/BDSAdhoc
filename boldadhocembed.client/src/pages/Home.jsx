import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';

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

// Generate dynamic data tailored specifically for the user's role, tenant, and region
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
            icon: 'handshake',
            colorClass: 'bg-blue-100 dark:bg-blue-950/40 text-role-sales',
            link: '/deals',
          },
          {
            title: 'Quota Attainment',
            value: '108.4%',
            sub: `${region} Sales Target Met`,
            isPositive: true,
            icon: 'verified',
            colorClass: 'bg-emerald-100 dark:bg-emerald-950/40 text-role-finance',
            link: '/deals',
          },
          {
            title: 'Assigned Leads',
            value: `${Math.round(tenant.contactsCount * 0.35)}`,
            sub: '14 qualified this week',
            isPositive: true,
            icon: 'person_search',
            colorClass: 'bg-purple-100 dark:bg-purple-950/40 text-role-admin',
            link: '/contacts',
          },
          {
            title: 'Avg Deal Velocity',
            value: '24 Days',
            sub: '-3.5 days faster cycle',
            isPositive: true,
            icon: 'speed',
            colorClass: 'bg-teal-100 dark:bg-teal-950/40 text-role-ops',
            link: '/dashboards',
          },
        ],
        quickActions: [
          { label: 'New Deal', icon: 'handshake', route: '/deals', colorClass: 'text-role-sales' },
          { label: 'Add Lead', icon: 'person_add', route: '/contacts', colorClass: 'text-role-sales' },
          { label: 'Log Activity', icon: 'event_note', route: '/activities', colorClass: 'text-role-ops' },
          { label: 'Sales Reports', icon: 'bar_chart', route: '/reports', colorClass: 'text-role-finance' },
        ],
        tasks: [
          { id: 1, title: `Deliver proposal to ${tenant.keyAccounts[0]} stakeholders`, time: '10:30 AM', role: 'Sales', roleClass: 'bg-role-sales/10 text-role-sales border-role-sales/20', completed: false },
          { id: 2, title: `Discovery demo with incoming enterprise lead in ${region}`, time: '1:15 PM', role: 'Sales', roleClass: 'bg-role-sales/10 text-role-sales border-role-sales/20', completed: false },
          { id: 3, title: `Follow up on contract terms with ${tenant.keyAccounts[1]}`, time: '3:45 PM', role: 'Sales', roleClass: 'bg-role-sales/10 text-role-sales border-role-sales/20', completed: false },
          { id: 4, title: 'Update CRM stage probabilities for Q3 pipeline', time: '5:00 PM', role: 'Sales', roleClass: 'bg-role-sales/10 text-role-sales border-role-sales/20', completed: true },
        ],
        pinnedItems: [
          { title: `${tenant.keyAccounts[0]} Expansion`, subtitle: 'High Priority Deal • $185,000', icon: 'request_quote', iconClass: 'bg-role-sales/10 text-role-sales border-role-sales/20', link: '/deals' },
          { title: `${tenant.keyAccounts[1]}`, subtitle: 'Key Account • Enterprise Tier', icon: 'corporate_fare', iconClass: 'bg-role-sales/10 text-role-sales border-role-sales/20', link: '/contacts' },
          { title: 'Sales Performance BI', subtitle: 'Executive Dashboard • Live', icon: 'pie_chart', iconClass: 'bg-role-ops/10 text-role-ops border-role-ops/20', link: '/dashboards' },
        ],
        announcements: [
          { category: 'Sales Update', time: '1 hour ago', title: `${tenantName} Q3 Sales Kickoff`, description: `Special incentive program launched for ${region} sales representatives closing expansion deals this quarter.`, colorClass: 'bg-role-sales' },
          { category: 'CRM Enhancement', time: 'Yesterday', title: 'Kanban Stage Automation Active', description: 'Deals now trigger automatic email notifications upon moving to Proposal and Negotiation stages.', colorClass: 'bg-role-admin' },
          { category: 'BI Analytics', time: 'Oct 14', title: 'Real-Time Win-Loss Reports Ready', description: 'Explore detailed conversion funnels in the Embedded Bold BI dashboard module.', colorClass: 'bg-role-finance' },
        ],
      };

    case 'Finance':
      return {
        roleDescription: `Managing financial forecasting, revenue recognition, and invoice reconciliations for ${tenantName}.`,
        kpis: [
          {
            title: 'Recognized Revenue',
            value: `$${tenant.baseRevenue}`,
            sub: `${tenant.growth} Year-over-Year`,
            isPositive: true,
            icon: 'account_balance',
            colorClass: 'bg-emerald-100 dark:bg-emerald-950/40 text-role-finance',
            link: '/reports',
          },
          {
            title: 'Monthly Recurring (MRR)',
            value: `$${(parseFloat(tenant.baseRevenue) * 0.22).toFixed(2)}M`,
            sub: '+8.6% new subscription growth',
            isPositive: true,
            icon: 'trending_up',
            colorClass: 'bg-blue-100 dark:bg-blue-950/40 text-role-sales',
            link: '/dashboards',
          },
          {
            title: 'Pending Invoices',
            value: `$${(parseFloat(tenant.baseRevenue) * 0.08).toFixed(2)}M`,
            sub: '12 accounts in collection cycle',
            isPositive: false,
            icon: 'receipt_long',
            colorClass: 'bg-orange-100 dark:bg-orange-950/40 text-role-support',
            link: '/deals',
          },
          {
            title: 'Scheduled Audit Jobs',
            value: `${tenant.schedulesCount} Active`,
            sub: 'Automated weekly CSV/PDF exports',
            isPositive: true,
            icon: 'calendar_month',
            colorClass: 'bg-purple-100 dark:bg-purple-950/40 text-role-admin',
            link: '/schedules',
          },
        ],
        quickActions: [
          { label: 'Revenue BI', icon: 'pie_chart', route: '/dashboards', colorClass: 'text-role-finance' },
          { label: 'Schedule Job', icon: 'calendar_month', route: '/schedules', colorClass: 'text-role-finance' },
          { label: 'View Reports', icon: 'description', route: '/reports', colorClass: 'text-role-ops' },
          { label: 'Deals Ledger', icon: 'receipt_long', route: '/deals', colorClass: 'text-role-sales' },
        ],
        tasks: [
          { id: 1, title: `Reconcile monthly wire receipts for ${tenantName}`, time: '9:00 AM', role: 'Finance', roleClass: 'bg-role-finance/10 text-role-finance border-role-finance/20', completed: false },
          { id: 2, title: `Review tax exemptions for ${tenant.keyAccounts[0]} invoice`, time: '11:30 AM', role: 'Finance', roleClass: 'bg-role-finance/10 text-role-finance border-role-finance/20', completed: false },
          { id: 3, title: `Generate Q3 Gross Margin Variance Report in ${region}`, time: '2:15 PM', role: 'Finance', roleClass: 'bg-role-finance/10 text-role-finance border-role-finance/20', completed: false },
          { id: 4, title: 'Approve vendor expense reimbursements batch #84', time: '4:45 PM', role: 'Finance', roleClass: 'bg-role-finance/10 text-role-finance border-role-finance/20', completed: true },
        ],
        pinnedItems: [
          { title: 'Q3 Financial Health Statement', subtitle: 'Bold Report • PDF/Excel Ready', icon: 'description', iconClass: 'bg-role-finance/10 text-role-finance border-role-finance/20', link: '/reports' },
          { title: 'Executive Revenue Dashboard', subtitle: 'Bold BI • Real-Time MRR', icon: 'pie_chart', iconClass: 'bg-role-ops/10 text-role-ops border-role-ops/20', link: '/dashboards' },
          { title: 'Daily Revenue Sync Schedule', subtitle: 'Automated Email • 06:00 AM Daily', icon: 'schedule', iconClass: 'bg-role-admin/10 text-role-admin border-role-admin/20', link: '/schedules' },
        ],
        announcements: [
          { category: 'Fiscal Notice', time: '3 hours ago', title: `${tenantName} Q3 Close Checklist`, description: 'All departments must finalize and approve open deal invoices before month-end accounting close.', colorClass: 'bg-role-finance' },
          { category: 'Reporting Service', time: 'Yesterday', title: 'Automated Tax Compliance Reports', description: 'New Bold Reports templates have been deployed for automated VAT/GST summaries.', colorClass: 'bg-role-admin' },
          { category: 'Billing Sync', time: 'Oct 11', title: 'ERP Gateway Re-indexed', description: 'Enterprise payment gateways are operating at nominal latency across all 4 server clusters.', colorClass: 'bg-role-ops' },
        ],
      };

    case 'Support':
      return {
        roleDescription: `Monitoring customer support SLA compliance, tickets queue, and client satisfaction in ${region}.`,
        kpis: [
          {
            title: 'Open Support Cases',
            value: `${Math.round(tenant.supportCount * 0.18)}`,
            sub: '4 high-priority escalation cases',
            isPositive: false,
            icon: 'confirmation_number',
            colorClass: 'bg-orange-100 dark:bg-orange-950/40 text-role-support',
            link: '/tickets',
          },
          {
            title: 'First Response SLA',
            value: '98.6%',
            sub: 'Avg response time < 12 mins',
            isPositive: true,
            icon: 'timer',
            colorClass: 'bg-emerald-100 dark:bg-emerald-950/40 text-role-finance',
            link: '/tickets',
          },
          {
            title: 'Customer CSAT',
            value: '4.92 / 5.0',
            sub: '98.1% positive customer feedback',
            isPositive: true,
            icon: 'sentiment_very_satisfied',
            colorClass: 'bg-blue-100 dark:bg-blue-950/40 text-role-sales',
            link: '/dashboards',
          },
          {
            title: 'Resolved This Week',
            value: `${Math.round(tenant.supportCount * 0.42)} Cases`,
            sub: '+14% resolution speed increase',
            isPositive: true,
            icon: 'task_alt',
            colorClass: 'bg-teal-100 dark:bg-teal-950/40 text-role-ops',
            link: '/tickets',
          },
        ],
        quickActions: [
          { label: 'View Queue', icon: 'confirmation_number', route: '/tickets', colorClass: 'text-role-support' },
          { label: 'Customer Base', icon: 'contacts', route: '/contacts', colorClass: 'text-role-sales' },
          { label: 'SLA Dashboard', icon: 'pie_chart', route: '/dashboards', colorClass: 'text-role-ops' },
          { label: 'Audit Logs', icon: 'security', route: '/operations', colorClass: 'text-role-admin' },
        ],
        tasks: [
          { id: 1, title: `Investigate SSO integration ticket #TKT-${tenantName.slice(0, 3).toUpperCase()}-1042`, time: '9:30 AM', role: 'Support', roleClass: 'bg-role-support/10 text-role-support border-role-support/20', completed: false },
          { id: 2, title: `Escalation call with ${tenant.keyAccounts[0]} Technical Director`, time: '1:00 PM', role: 'Support', roleClass: 'bg-role-support/10 text-role-support border-role-support/20', completed: false },
          { id: 3, title: `Review and resolve Tier 2 latency ticket in ${region}`, time: '3:15 PM', role: 'Support', roleClass: 'bg-role-support/10 text-role-support border-role-support/20', completed: false },
          { id: 4, title: 'Update internal Knowledge Base for API token renewal', time: '4:30 PM', role: 'Support', roleClass: 'bg-role-support/10 text-role-support border-role-support/20', completed: true },
        ],
        pinnedItems: [
          { title: `${tenant.keyAccounts[0]} SLA Tier 1`, subtitle: 'VIP Enterprise Account • 24/7 Phone Support', icon: 'support_agent', iconClass: 'bg-role-support/10 text-role-support border-role-support/20', link: '/tickets' },
          { title: 'Support SLA Compliance BI', subtitle: 'Bold BI • Resolution Metrics', icon: 'pie_chart', iconClass: 'bg-role-ops/10 text-role-ops border-role-ops/20', link: '/dashboards' },
          { title: 'Weekly Support Summary', subtitle: 'Automated Report • Monday 08:00 AM', icon: 'description', iconClass: 'bg-role-finance/10 text-role-finance border-role-finance/20', link: '/reports' },
        ],
        announcements: [
          { category: 'SLA Alert', time: '1 hour ago', title: `${tenantName} SLA Response Time Record`, description: `Support engineers in ${region} achieved an average first-response time of 8.4 minutes this week.`, colorClass: 'bg-role-support' },
          { category: 'System Status', time: 'Yesterday', title: 'Portal Help Center Upgraded', description: 'Updated customer knowledge base with step-by-step video guides for embedded BI and Report exports.', colorClass: 'bg-role-admin' },
          { category: 'Maintenance', time: 'Oct 10', title: 'Database Optimization Complete', description: 'Row-Level Security query optimizations have reduced ticket filtering latency by 45%.', colorClass: 'bg-role-ops' },
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
            icon: 'rocket_launch',
            colorClass: 'bg-teal-100 dark:bg-teal-950/40 text-role-ops',
            link: '/operations',
          },
          {
            title: 'MQL Lead Velocity',
            value: `${Math.round(tenant.contactsCount * 0.45)} MQLs`,
            sub: '+18.5% marketing conversion',
            isPositive: true,
            icon: 'group_add',
            colorClass: 'bg-blue-100 dark:bg-blue-950/40 text-role-sales',
            link: '/contacts',
          },
          {
            title: 'Campaign ROI',
            value: '342%',
            sub: `$${(parseFloat(tenant.baseRevenue) * 0.45).toFixed(2)}M attributed pipeline`,
            isPositive: true,
            icon: 'query_stats',
            colorClass: 'bg-emerald-100 dark:bg-emerald-950/40 text-role-finance',
            link: '/dashboards',
          },
          {
            title: 'Audit Log Trail',
            value: '1,420 Events',
            sub: '100% security compliance verified',
            isPositive: true,
            icon: 'security',
            colorClass: 'bg-purple-100 dark:bg-purple-950/40 text-role-admin',
            link: '/operations',
          },
        ],
        quickActions: [
          { label: 'Campaigns', icon: 'campaign', route: '/operations', colorClass: 'text-role-ops' },
          { label: 'Security Trail', icon: 'verified_user', route: '/operations', colorClass: 'text-role-admin' },
          { label: 'Marketing Leads', icon: 'contacts', route: '/contacts', colorClass: 'text-role-sales' },
          { label: 'Campaign BI', icon: 'pie_chart', route: '/dashboards', colorClass: 'text-role-finance' },
        ],
        tasks: [
          { id: 1, title: `Optimize email nurture sequence for ${region} prospects`, time: '10:00 AM', role: 'Operations', roleClass: 'bg-role-ops/10 text-role-ops border-role-ops/20', completed: false },
          { id: 2, title: `Review LinkedIn ads ROI metrics for ${tenantName}`, time: '1:45 PM', role: 'Operations', roleClass: 'bg-role-ops/10 text-role-ops border-role-ops/20', completed: false },
          { id: 3, title: `Audit user role access policies across ${tenantName} databases`, time: '3:30 PM', role: 'Operations', roleClass: 'bg-role-ops/10 text-role-ops border-role-ops/20', completed: false },
          { id: 4, title: 'Verify daily Postgres automated database backups', time: '5:15 PM', role: 'Operations', roleClass: 'bg-role-ops/10 text-role-ops border-role-ops/20', completed: true },
        ],
        pinnedItems: [
          { title: `${region} Growth Campaign 2026`, subtitle: 'Multi-Channel Omnichannel Campaign • Active', icon: 'campaign', iconClass: 'bg-role-ops/10 text-role-ops border-role-ops/20', link: '/operations' },
          { title: 'Security & Audit Event Trail', subtitle: 'PostgreSQL Real-Time Logging', icon: 'security', iconClass: 'bg-role-admin/10 text-role-admin border-role-admin/20', link: '/operations' },
          { title: 'Marketing Attribution Dashboard', subtitle: 'Bold BI • Conversion Insights', icon: 'pie_chart', iconClass: 'bg-role-finance/10 text-role-finance border-role-finance/20', link: '/dashboards' },
        ],
        announcements: [
          { category: 'Ops Update', time: '2 hours ago', title: `${tenantName} Marketing Automation v2.4`, description: `Automated lead enrichment rules have been deployed for all inbound leads in ${region}.`, colorClass: 'bg-role-ops' },
          { category: 'Security Compliance', time: 'Yesterday', title: 'Postgres Audit Logs Retention Active', description: 'Audit trail events are synchronized and stored with full SHA-256 integrity validation.', colorClass: 'bg-role-admin' },
          { category: 'Analytics', time: 'Oct 09', title: 'Bold BI Workspace Sync', description: 'Cross-functional operations analytics updated with real-time pipeline velocity numbers.', colorClass: 'bg-role-sales' },
        ],
      };

    // Default: Admin
    case 'Admin':
    default:
      return {
        roleDescription: `Enterprise executive overview of ${tenantName} (${tenant.industry}) with Row-Level Security scoped to ${region}.`,
        kpis: [
          {
            title: 'Total Active Pipeline',
            value: `$${tenant.baseRevenue}`,
            sub: `${tenant.growth} YoY Growth`,
            isPositive: true,
            icon: 'handshake',
            colorClass: 'bg-purple-100 dark:bg-purple-950/40 text-primary',
            link: '/deals',
          },
          {
            title: 'CRM Contacts & Leads',
            value: `${tenant.contactsCount}`,
            sub: `Across 4 Global Regions`,
            isPositive: true,
            icon: 'contacts',
            colorClass: 'bg-blue-100 dark:bg-blue-950/40 text-role-sales',
            link: '/contacts',
          },
          {
            title: 'Support Cases Queue',
            value: `${tenant.supportCount}`,
            sub: '4.88 / 5.0 Global CSAT Score',
            isPositive: true,
            icon: 'confirmation_number',
            colorClass: 'bg-orange-100 dark:bg-orange-950/40 text-role-support',
            link: '/tickets',
          },
          {
            title: 'Scheduled Jobs',
            value: `${tenant.schedulesCount} Active`,
            sub: 'Automated PDF/Excel delivery',
            isPositive: true,
            icon: 'calendar_month',
            colorClass: 'bg-emerald-100 dark:bg-emerald-950/40 text-role-finance',
            link: '/schedules',
          },
        ],
        quickActions: [
          { label: 'Sales Deals', icon: 'handshake', route: '/deals', colorClass: 'text-role-sales' },
          { label: 'Contacts', icon: 'contacts', route: '/contacts', colorClass: 'text-role-sales' },
          { label: 'BI Dashboards', icon: 'pie_chart', route: '/dashboards', colorClass: 'text-role-finance' },
          { label: 'Support Queue', icon: 'headset_mic', route: '/tickets', colorClass: 'text-role-support' },
        ],
        tasks: [
          { id: 1, title: `Approve Q3 vendor Master Services Agreement for ${tenant.keyAccounts[0]}`, time: '10:00 AM', role: 'Admin', roleClass: 'bg-role-admin/10 text-role-admin border-role-admin/20', completed: false },
          { id: 2, title: `Review quarterly revenue forecast with ${tenantName} board`, time: '1:30 PM', role: 'Finance', roleClass: 'bg-role-finance/10 text-role-finance border-role-finance/20', completed: false },
          { id: 3, title: `Evaluate ${region} sales team expansion proposals`, time: '3:00 PM', role: 'Sales', roleClass: 'bg-role-sales/10 text-role-sales border-role-sales/20', completed: false },
          { id: 4, title: `Verify PostgreSQL RLS tenant database replication status`, time: '4:15 PM', role: 'Admin', roleClass: 'bg-role-admin/10 text-role-admin border-role-admin/20', completed: true },
        ],
        pinnedItems: [
          { title: `${tenant.keyAccounts[0]}`, subtitle: 'Tier 1 Enterprise Client • Key Account', icon: 'corporate_fare', iconClass: 'bg-role-sales/10 text-role-sales border-role-sales/20', link: '/contacts' },
          { title: `${tenant.keyAccounts[1]} Renewal`, subtitle: 'Closed Won Deal • $240,000', icon: 'request_quote', iconClass: 'bg-role-finance/10 text-role-finance border-role-finance/20', link: '/deals' },
          { title: 'Executive BI Overview', subtitle: 'Bold BI Enterprise Dashboard • Real-Time', icon: 'pie_chart', iconClass: 'bg-role-ops/10 text-role-ops border-role-ops/20', link: '/dashboards' },
        ],
        announcements: [
          { category: 'System Alert', time: '2 hours ago', title: 'PostgreSQL Multitenancy & RLS Active', description: `All 14 CRM tables and 12-month data are operating with automated Row-Level Security for ${tenantName}.`, colorClass: 'bg-role-admin' },
          { category: 'Sales Pipeline', time: 'Yesterday', title: `${tenantName} Q3 Expansion Goals Met`, description: `Enterprise deals closed across ${region} exceeded baseline quarterly expectations by 14.8%.`, colorClass: 'bg-role-sales' },
          { category: 'Scheduler Update', time: 'Oct 12', title: 'Automated Report Delivery Configured', description: 'Enterprise reports are scheduled for automatic Monday morning executive inbox distribution.', colorClass: 'bg-role-finance' },
        ],
      };
  }
};

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tasksState, setTasksState] = useState(null);

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
  const userRole = user?.role || 'Admin';
  const tenantName = user?.tenantName || (user?.email?.includes('alpha') ? 'AlphaCorp' : user?.email?.includes('beta') ? 'BetaSolutions' : user?.email?.includes('gamma') ? 'GammaIndustries' : user?.email?.includes('delta') ? 'DeltaEnterprises' : 'AlphaCorp');
  const userRegion = user?.region || 'North America';

  // Compute dynamic role/tenant home content
  const homeData = useMemo(() => {
    return getRoleHomeData(userRole, tenantName, userRegion, userName);
  }, [userRole, tenantName, userRegion, userName]);

  // Sync tasks state when user/role changes
  useEffect(() => {
    if (homeData?.tasks) {
      setTasksState(homeData.tasks);
    }
  }, [homeData]);

  const toggleTask = (id) => {
    setTasksState(prev => prev ? prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t) : []);
  };

  const tasksToDisplay = tasksState || homeData.tasks;

  return (
    <div className="p-container-padding max-w-[1600px] mx-auto space-y-gutter">
      {/* Hero Section */}
      <div className="glass-card rounded-xl p-8 relative overflow-hidden bg-white/80 dark:bg-slate-900/80 shadow-sm border border-glass-border">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              {tenantName} • {userRegion}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface-container text-on-surface-variant">
              {userRole} Workspace
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              RLS Active
            </span>
          </div>
          <h1 className="font-headline-lg text-3xl md:text-4xl font-bold text-on-surface mb-2">
            Welcome Back, {userName}!
          </h1>
          <p className="font-body-lg text-base text-on-surface-variant max-w-3xl">
            {homeData.roleDescription} Data access is isolated to <strong className="text-primary">{tenantName}</strong> with Row-Level Security policies active for your assigned region (<strong className="text-primary">{userRegion}</strong>).
          </p>
        </div>

        {/* Decorative Gradients from Stitch */}
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-primary-container/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-40 bottom-10 w-64 h-64 bg-secondary-container/15 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* CRM Dynamic Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {homeData.kpis.map((kpi, idx) => (
          <Link key={idx} to={kpi.link} className="glass-card rounded-xl p-5 hover-lift transition-all flex items-center gap-4 group">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl ${kpi.colorClass}`}>
              <span className="material-symbols-outlined text-[26px]">{kpi.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider truncate">{kpi.title}</p>
              <h3 className="text-2xl font-bold text-on-surface group-hover:text-primary transition-colors">{kpi.value}</h3>
              <span className={`text-[11px] font-semibold flex items-center gap-0.5 truncate ${kpi.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {kpi.sub}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        {/* Quick Actions (4 cols) */}
        <div className="md:col-span-4 glass-card rounded-xl p-6 flex flex-col justify-between">
          <h2 className="font-headline-md text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">bolt</span>
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {homeData.quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => navigate(action.route)}
                className="bg-white/70 dark:bg-slate-800/70 hover:bg-surface-container-high hover-lift transition-all rounded-lg p-4 flex flex-col items-center justify-center text-center gap-2 border border-glass-border cursor-pointer group"
              >
                <span className={`material-symbols-outlined ${action.colorClass} text-[28px] group-hover:scale-110 transition-transform`} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {action.icon}
                </span>
                <span className="font-label-md text-xs font-semibold text-on-surface">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Tasks (5 cols) */}
        <div className="md:col-span-5 glass-card rounded-xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-headline-md text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">checklist</span>
              {userRole} Tasks for Today
            </h2>
            <span className="text-xs font-medium text-on-surface-variant">
              {tasksToDisplay.filter(t => t.completed).length} of {tasksToDisplay.length} done
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-[280px]">
            {tasksToDisplay.map(task => (
              <div
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-3 border border-outline-variant/30 flex items-start gap-3 hover-lift transition-transform cursor-pointer"
              >
                <div className="mt-0.5">
                  <span className={`material-symbols-outlined text-[20px] ${task.completed ? 'text-primary' : 'text-outline'}`}>
                    {task.completed ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-xs font-semibold mb-1 truncate ${task.completed ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                    {task.title}
                  </h4>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">schedule</span> {task.time}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${task.roleClass}`}>
                      {task.role}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Pinned Items (3 cols) */}
        <div className="md:col-span-3 glass-card rounded-xl p-6 flex flex-col">
          <h2 className="font-headline-md text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              push_pin
            </span>
            Pinned for {userRole}
          </h2>

          <div className="space-y-3.5 flex-1">
            {homeData.pinnedItems.map((item, idx) => (
              <Link key={idx} to={item.link} className="block group hover:bg-white/40 dark:hover:bg-slate-800/40 p-2 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center border flex-shrink-0 ${item.iconClass}`}>
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {item.icon}
                    </span>
                  </div>
                  <div className="overflow-hidden min-w-0">
                    <p className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-on-surface-variant truncate">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Dynamic Announcements Feed */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-headline-md text-lg font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">campaign</span>
            {tenantName} Enterprise Announcements
          </h2>
          <span className="text-xs text-on-surface-variant">Live Updates</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {homeData.announcements.map((ann, idx) => (
            <div key={idx} className="bg-white/70 dark:bg-slate-800/70 rounded-lg p-4 border border-glass-border hover-lift transition-all relative overflow-hidden group">
              <div className={`absolute top-0 left-0 w-1 h-full ${ann.colorClass}`}></div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20`}>
                  {ann.category}
                </span>
                <span className="text-[11px] text-on-surface-variant">{ann.time}</span>
              </div>
              <h4 className="text-xs font-semibold text-on-surface mb-1 group-hover:text-primary transition-colors line-clamp-1">
                {ann.title}
              </h4>
              <p className="text-xs text-on-surface-variant line-clamp-2">
                {ann.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}