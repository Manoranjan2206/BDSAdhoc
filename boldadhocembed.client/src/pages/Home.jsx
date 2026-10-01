import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';
import { crmAPI } from '../services/apiService';
import { TENANT_DATA, PIPELINE_STAGES, getRoleHomeData } from '../data/homeFixtures';
import '../styles/home.css';

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

  const totalPipelineAmount = useMemo(() => {
    if (pgSummary?.totalActivePipeline > 0) {
      return (pgSummary.totalActivePipeline / 1000000);
    }
    const tenant = TENANT_DATA[tenantName] || TENANT_DATA.AlphaCorp;
    return parseFloat(tenant.baseRevenue || '4.85');
  }, [pgSummary, tenantName]);

  const dynamicPipelineStages = useMemo(() => {
    const total = totalPipelineAmount;
    const stages = [
      { name: 'Qualification', count: 18, pct: 28, color: 'bg-blue-500', barBg: 'bg-blue-100 dark:bg-blue-950/60' },
      { name: 'Proposal / Quote', count: 24, pct: 36, color: 'bg-indigo-500', barBg: 'bg-indigo-100 dark:bg-indigo-950/60' },
      { name: 'Negotiation', count: 14, pct: 22, color: 'bg-amber-500', barBg: 'bg-amber-100 dark:bg-amber-950/60' },
      { name: 'Closed Won', count: 12, pct: 14, color: 'bg-emerald-500', barBg: 'bg-emerald-100 dark:bg-emerald-950/60' },
    ];
    return stages.map(s => ({
      ...s,
      amount: `$${(total * (s.pct / 100)).toFixed(2)}M`
    }));
  }, [totalPipelineAmount]);

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
    <div className="p-4 md:p-5 max-w-[1600px] mx-auto space-y-4 home-dashboard">
      
      {/* Compact Hero Header */}
      <div className="hero-gradient-card p-0 relative">
        <div className="relative z-10 space-y-3">
          
          {/* Row 1: Tenant Context + Sync */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300 border border-primary-200 dark:border-primary-800 flex items-center gap-1.5 cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-600 dark:bg-primary-400"></span>
                  {tenantName}
                  <span className="material-symbols-outlined text-[12px]">expand_more</span>
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  {userRegion}
                  <span className="material-symbols-outlined text-[12px]">expand_more</span>
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                {effectiveRole} Workspace
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="hidden sm:inline">Last updated: <strong>{lastSyncedTime}</strong></span>
              <button
                onClick={fetchPgData}
                disabled={loadingDb}
                title="Refresh live PostgreSQL CRM metrics"
                className="px-3 py-1.5 rounded-lg font-medium bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary-600 dark:hover:text-primary-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95"
              >
                <span className={`material-symbols-outlined text-[16px] ${loadingDb ? 'animate-spin text-primary-600' : ''}`}>sync</span>
                {loadingDb ? 'Syncing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Row 2: Greeting (compact) */}
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[15px]">calendar_today</span>
              {todayFormatted}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Welcome back, <span className="text-primary-600 dark:text-primary-400">{userName}</span>
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-3xl mt-1">
              {homeData.roleDescription}
            </p>
          </div>

          {/* Row 3: AI Insight Ticker (compact, solid surface) */}
          <div className="ai-ticker-badge rounded-xl px-3 py-2 flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-200">
            <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-[10px]">
              ✨
            </span>
            <div className="flex-1 min-w-0">
              <strong className="text-primary-600 dark:text-primary-400">AI Insights:</strong> Performance velocity in <strong>{userRegion}</strong> is tracking <strong>+18.4% YoY</strong>. Quota attainment goal achieved for {tenantName}.
            </div>
            <Link to="/dashboards" className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-0.5 whitespace-nowrap">
              Analytics <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
            </Link>
          </div>

        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {homeData.kpis.map((kpi, idx) => (
          <Link
            key={idx}
            to={kpi.link}
            className="kpi-card-enhanced group"
            style={{ '--card-accent': kpi.accent }}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-label uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate max-w-[170px]">
                {kpi.title}
              </span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${kpi.colorClass} group-hover:scale-110 transition-transform`}>
                <span className="material-symbols-outlined text-[22px]">{kpi.icon}</span>
              </div>
            </div>

            <div className="mb-3">
              <h3 className="text-kpi text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {kpi.value}
              </h3>
              <div className={`text-xs font-semibold flex items-center gap-1 mt-1 ${kpi.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                <span className="material-symbols-outlined text-[14px]">
                  {kpi.isPositive ? 'trending_up' : 'trending_down'}
                </span>
                {kpi.sub}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-label text-slate-400 dark:text-slate-500">
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

      {/* Pipeline Section */}
      <div className="glass-card rounded-panel p-5 md:p-6 border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-section-title font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-600 dark:text-primary-400">bar_chart</span>
              {effectiveRole} Pipeline &amp; Opportunity Stages
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Distribution of opportunities by stage in {userRegion} for {tenantName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total Scoped:</span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
              ${totalPipelineAmount.toFixed(2)}M
            </span>
            <Link to="/deals" className="text-xs font-semibold text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center gap-0.5">
              View Kanban <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </Link>
          </div>
        </div>

        {/* Visual Stage Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {dynamicPipelineStages.map((stage, idx) => (
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
                <div className="flex justify-between text-label text-slate-400">
                  <span>Pipeline share</span>
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

      {/* Bento Grid: Quick Actions (3) | Action Plan (5) | Pinned (4) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

        {/* Quick Actions - 3 cols, more compact */}
        <div className="md:col-span-3 glass-card rounded-panel p-5 border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex flex-col shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-section-title font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-600 dark:text-primary-400">bolt</span>
              Quick Actions
            </h2>
            <span className="text-label text-slate-400 uppercase tracking-wider">Shortcuts</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 flex-1">
            {homeData.quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => navigate(action.route)}
                className="quick-action-tile rounded-xl p-3 flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className={`material-symbols-outlined ${action.colorClass} text-[22px]`}>
                    {action.icon}
                  </span>
                </div>
                <div>
                  <span className="block text-compact font-semibold text-slate-800 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {action.label}
                  </span>
                  <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-label font-extrabold bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400">
                    {action.shortcut}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Action Plan - 5 cols */}
        <div className="md:col-span-5 glass-card rounded-panel p-5 border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex flex-col shadow-card">
          
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
            <h2 className="text-section-title font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-600 dark:text-primary-400">checklist</span>
              Action Plan
            </h2>
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              {['All', 'Pending', 'Completed'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setTaskFilter(tab)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                    taskFilter === tab
                      ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Task Completion Progress */}
          <div className="mb-3 space-y-1">
            <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>Today's Progress</span>
              <span>{completedTasksCount} of {totalTasksCount} tasks ({taskCompletionPct}%)</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-purple-400 rounded-full transition-all duration-500"
                style={{ width: `${taskCompletionPct}%` }}
              ></div>
            </div>
          </div>

          {/* Task Items List - 3 visible, rest via scroll */}
          <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-[220px]">
            {tasksToDisplay.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No {taskFilter.toLowerCase()} tasks for {effectiveRole} right now.
              </div>
            ) : (
              tasksToDisplay.map(task => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`rounded-xl p-2.5 border transition-all cursor-pointer flex items-start gap-2.5 ${
                    task.completed
                      ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-800 opacity-75'
                      : 'bg-white/90 dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/80 hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-sm'
                  }`}
                >
                  <div className="mt-0.5">
                    <span className={`material-symbols-outlined text-[18px] transition-colors ${task.completed ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}>
                      {task.completed ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <h4 className={`text-xs font-semibold truncate ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                        {task.title}
                      </h4>
                      <span className={`px-1.5 py-0.5 rounded text-label font-extrabold uppercase tracking-wider ${
                        task.priority === 'HIGH' ? 'tag-high' : task.priority === 'MED' ? 'tag-med' : 'tag-normal'
                      }`}>
                        {task.priority || 'NORMAL'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">schedule</span> {task.time}
                      </span>
                      <span className="font-semibold text-primary-600 dark:text-primary-400">
                        {task.role}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pinned Accounts - 4 cols */}
        <div className="md:col-span-4 glass-card rounded-panel p-5 border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex flex-col shadow-card">
          <h2 className="text-section-title font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-600 dark:text-primary-400">push_pin</span>
            Pinned Accounts
          </h2>

          <div className="space-y-2.5 flex-1">
            {homeData.pinnedItems.map((item, idx) => (
              <Link
                key={idx}
                to={item.link}
                className="block p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 hover:border-primary-200 dark:hover:border-primary-800 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  </div>
                  <div className="overflow-hidden min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                        {item.title}
                      </p>
                      <span className={`px-1.5 py-0.5 rounded text-label font-bold ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
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
      <div className="glass-card rounded-panel p-5 md:p-6 border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-card space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">campaign</span>
            </div>
            <div>
              <h2 className="text-section-title font-bold text-slate-900 dark:text-white">
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
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  announcementFilter === filterCat
                    ? 'bg-primary-600 text-white shadow-sm'
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
                className="bg-slate-50/80 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200/70 dark:border-slate-700/70 hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-md transition-all relative overflow-hidden group"
              >
                <div className={`absolute top-0 left-0 w-1.5 h-full ${ann.colorClass}`}></div>
                
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-label font-extrabold uppercase tracking-wider bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800">
                    {ann.category}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">schedule</span>
                    {ann.time}
                  </span>
                </div>

                <h4 className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 mb-1.5 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
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

