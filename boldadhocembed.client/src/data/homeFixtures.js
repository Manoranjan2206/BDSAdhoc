// Tenant metadata and default stats configurations
export const TENANT_DATA = {
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
export const PIPELINE_STAGES = [
  { name: 'Qualification', amount: '$1.42M', count: 18, pct: 28, color: 'bg-blue-500', barBg: 'bg-blue-100 dark:bg-blue-950/60' },
  { name: 'Proposal / Quote', amount: '$1.85M', count: 24, pct: 36, color: 'bg-indigo-500', barBg: 'bg-indigo-100 dark:bg-indigo-950/60' },
  { name: 'Negotiation', amount: '$1.10M', count: 14, pct: 22, color: 'bg-amber-500', barBg: 'bg-amber-100 dark:bg-amber-950/60' },
  { name: 'Closed Won', amount: '$0.75M', count: 12, pct: 14, color: 'bg-emerald-500', barBg: 'bg-emerald-100 dark:bg-emerald-950/60' },
];

// Generate dynamic data tailored specifically for user role, tenant, and region
export const getRoleHomeData = (role, tenantName, region, userName) => {
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
          { label: 'Executive BI', icon: 'pie_chart', route: '/dashboards', shortcut: '⌘B', colorClass: 'text-teal-500' },
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
            accent: 'linear-gradient(90deg, #5b4ce6, #7c5eff)',
            icon: 'handshake',
            colorClass: 'bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400',
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
            accent: 'linear-gradient(90deg, #d97706, #f59e0b)',
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
            accent: 'linear-gradient(90deg, #059669, #10b981)',
            icon: 'calendar_month',
            colorClass: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
            link: '/schedules',
          },
        ],
        quickActions: [
          { label: 'Sales Deals', icon: 'handshake', route: '/deals', shortcut: '⌘D', colorClass: 'text-blue-500' },
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
          { category: 'System', time: '2 hours ago', title: 'Enterprise Multitenant Security Active', description: `All CRM tables and live operational data operate with isolated row-level security policies for ${tenantName}.`, colorClass: 'bg-purple-500' },
          { category: 'Sales', time: 'Yesterday', title: `${tenantName} Q3 Expansion Goals Met`, description: `Enterprise deals closed across ${region} exceeded baseline quarterly expectations by 14.8%.`, colorClass: 'bg-blue-500' },
          { category: 'Scheduler', time: 'Oct 12', title: 'Automated Report Delivery Configured', description: 'Enterprise reports scheduled for automatic Monday morning executive inbox distribution.', colorClass: 'bg-emerald-500' },
        ],
      };
  }
};
