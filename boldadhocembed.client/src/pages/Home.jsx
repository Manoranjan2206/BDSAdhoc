import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const [tasks, setTasks] = useState([
    { id: 1, title: 'Follow up with TechNova on contract terms', time: '10:00 AM', role: 'Sales', roleClass: 'bg-role-sales/10 text-role-sales border-role-sales/20', completed: false },
    { id: 2, title: 'Review Q3 Financial Projections & invoices', time: '1:30 PM', role: 'Finance', roleClass: 'bg-role-finance/10 text-role-finance border-role-finance/20', completed: false },
    { id: 3, title: 'Approve new vendor MSA security agreements', time: '3:00 PM', role: 'Admin', roleClass: 'bg-role-admin/10 text-role-admin border-role-admin/20', completed: false },
    { id: 4, title: 'Resolve SSO integration ticket #TKT-2025-0042', time: '4:15 PM', role: 'Support', roleClass: 'bg-role-support/10 text-role-support border-role-support/20', completed: true },
  ]);

  useEffect(() => {
    const currentUser = authService.getUser();
    setUser(currentUser?.user || currentUser);
  }, []);

  const userName = user?.name || user?.firstName || 'Anna';
  const userRole = user?.role || 'Admin';
  const tenantName = user?.tenantName || (user?.email?.includes('alpha') ? 'AlphaCorp' : user?.email?.includes('beta') ? 'BetaSolutions' : user?.email?.includes('gamma') ? 'GammaIndustries' : user?.email?.includes('delta') ? 'DeltaEnterprises' : 'AlphaCorp');
  const userRegion = user?.region || 'North America';

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  return (
    <div className="p-container-padding max-w-[1600px] mx-auto space-y-gutter">
      {/* Hero Section */}
      <div className="glass-card rounded-xl p-8 relative overflow-hidden bg-white/80 dark:bg-slate-900/80 shadow-sm border border-glass-border">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              {tenantName} • {userRegion}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface-container text-on-surface-variant">
              {userRole} Workspace
            </span>
          </div>
          <h1 className="font-headline-lg text-3xl md:text-4xl font-bold text-on-surface mb-2">
            Welcome Back, {userName}!
          </h1>
          <p className="font-body-lg text-base text-on-surface-variant max-w-2xl">
            Here's a quick overview of your CRM organization. All data is isolated to <strong className="text-primary">{tenantName}</strong> with Row-Level Security active for <strong className="text-primary">{userRegion}</strong>.
          </p>
        </div>

        {/* Decorative Gradients from Stitch */}
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-primary-container/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-40 bottom-10 w-64 h-64 bg-secondary-container/15 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* CRM Quick Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <Link to="/deals" className="glass-card rounded-xl p-5 hover-lift transition-all flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-primary flex items-center justify-center font-bold text-xl">
            <span className="material-symbols-outlined text-[26px]">handshake</span>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">Active Pipeline</p>
            <h3 className="text-2xl font-bold text-on-surface group-hover:text-primary transition-colors">$1.24M</h3>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[14px]">trending_up</span> +14.2% this month
            </span>
          </div>
        </Link>

        <Link to="/contacts" className="glass-card rounded-xl p-5 hover-lift transition-all flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-role-sales flex items-center justify-center font-bold text-xl">
            <span className="material-symbols-outlined text-[26px]">contacts</span>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">CRM Contacts</p>
            <h3 className="text-2xl font-bold text-on-surface group-hover:text-role-sales transition-colors">260</h3>
            <span className="text-[11px] text-on-surface-variant">Across 4 global regions</span>
          </div>
        </Link>

        <Link to="/tickets" className="glass-card rounded-xl p-5 hover-lift transition-all flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-role-support flex items-center justify-center font-bold text-xl">
            <span className="material-symbols-outlined text-[26px]">confirmation_number</span>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">Support Cases</p>
            <h3 className="text-2xl font-bold text-on-surface group-hover:text-role-support transition-colors">220</h3>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[14px]">star</span> 4.8 / 5.0 CSAT
            </span>
          </div>
        </Link>

        <Link to="/schedules" className="glass-card rounded-xl p-5 hover-lift transition-all flex items-center gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-role-finance flex items-center justify-center font-bold text-xl">
            <span className="material-symbols-outlined text-[26px]">calendar_month</span>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">Scheduled Reports</p>
            <h3 className="text-2xl font-bold text-on-surface group-hover:text-role-finance transition-colors">8 Active</h3>
            <span className="text-[11px] text-on-surface-variant">Automated email delivery</span>
          </div>
        </Link>
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
            <button
              onClick={() => navigate('/contacts')}
              className="bg-white/70 dark:bg-slate-800/70 hover:bg-surface-container-high hover-lift transition-all rounded-lg p-4 flex flex-col items-center justify-center text-center gap-2 border border-glass-border cursor-pointer group"
            >
              <span className="material-symbols-outlined text-role-sales text-[28px] group-hover:scale-110 transition-transform" style={{ fontVariationSettings: "'FILL' 1" }}>
                person_add
              </span>
              <span className="font-label-md text-xs font-semibold text-on-surface">Manage Contacts</span>
            </button>

            <button
              onClick={() => navigate('/activities')}
              className="bg-white/70 dark:bg-slate-800/70 hover:bg-surface-container-high hover-lift transition-all rounded-lg p-4 flex flex-col items-center justify-center text-center gap-2 border border-glass-border cursor-pointer group"
            >
              <span className="material-symbols-outlined text-role-ops text-[28px] group-hover:scale-110 transition-transform" style={{ fontVariationSettings: "'FILL' 1" }}>
                event_note
              </span>
              <span className="font-label-md text-xs font-semibold text-on-surface">Log Activity</span>
            </button>

            <button
              onClick={() => navigate('/deals')}
              className="bg-white/70 dark:bg-slate-800/70 hover:bg-surface-container-high hover-lift transition-all rounded-lg p-4 flex flex-col items-center justify-center text-center gap-2 border border-glass-border cursor-pointer group"
            >
              <span className="material-symbols-outlined text-role-finance text-[28px] group-hover:scale-110 transition-transform" style={{ fontVariationSettings: "'FILL' 1" }}>
                handshake
              </span>
              <span className="font-label-md text-xs font-semibold text-on-surface">Sales Pipeline</span>
            </button>

            <button
              onClick={() => navigate('/tickets')}
              className="bg-white/70 dark:bg-slate-800/70 hover:bg-surface-container-high hover-lift transition-all rounded-lg p-4 flex flex-col items-center justify-center text-center gap-2 border border-glass-border cursor-pointer group"
            >
              <span className="material-symbols-outlined text-role-support text-[28px] group-hover:scale-110 transition-transform" style={{ fontVariationSettings: "'FILL' 1" }}>
                headset_mic
              </span>
              <span className="font-label-md text-xs font-semibold text-on-surface">Support Tickets</span>
            </button>
          </div>
        </div>

        {/* Tasks (5 cols) */}
        <div className="md:col-span-5 glass-card rounded-xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-headline-md text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">checklist</span>
              My Tasks for Today
            </h2>
            <Link to="/tasks" className="text-xs font-semibold text-primary hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-[280px]">
            {tasks.map(task => (
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
                <div className="flex-1">
                  <h4 className={`text-xs font-semibold mb-1 ${task.completed ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
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

        {/* Pinned Items (3 cols) */}
        <div className="md:col-span-3 glass-card rounded-xl p-6 flex flex-col">
          <h2 className="font-headline-md text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              push_pin
            </span>
            Pinned Items
          </h2>

          <div className="space-y-3.5 flex-1">
            <Link to="/contacts" className="block group hover:bg-white/40 dark:hover:bg-slate-800/40 p-2 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-role-sales/10 text-role-sales flex items-center justify-center border border-role-sales/20 flex-shrink-0">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors truncate">Global Industries Corp</p>
                  <p className="text-[11px] text-on-surface-variant">Key Account • Enterprise</p>
                </div>
              </div>
            </Link>

            <Link to="/deals" className="block group hover:bg-white/40 dark:hover:bg-slate-800/40 p-2 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-role-finance/10 text-role-finance flex items-center justify-center border border-role-finance/20 flex-shrink-0">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>request_quote</span>
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors truncate">Q4 Cloud Suite Expansion</p>
                  <p className="text-[11px] text-on-surface-variant">Deal • $220,000</p>
                </div>
              </div>
            </Link>

            <Link to="/dashboards" className="block group hover:bg-white/40 dark:hover:bg-slate-800/40 p-2 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-role-ops/10 text-role-ops flex items-center justify-center border border-role-ops/20 flex-shrink-0">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>pie_chart</span>
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors truncate">Executive Overview BI</p>
                  <p className="text-[11px] text-on-surface-variant">Dashboard • Real-Time</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Announcements */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-headline-md text-lg font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">campaign</span>
            Recent Announcements
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/70 dark:bg-slate-800/70 rounded-lg p-4 border border-glass-border hover-lift transition-all relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-role-admin"></div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-role-admin/10 text-role-admin border border-role-admin/20">System</span>
              <span className="text-[11px] text-on-surface-variant">2 hours ago</span>
            </div>
            <h4 className="text-xs font-semibold text-on-surface mb-1 group-hover:text-primary transition-colors">PostgreSQL CRM Multitenancy Active</h4>
            <p className="text-xs text-on-surface-variant line-clamp-2">All 14 CRM tables and 12-month data are connected with automated Row-Level Security filtering.</p>
          </div>

          <div className="bg-white/70 dark:bg-slate-800/70 rounded-lg p-4 border border-glass-border hover-lift transition-all relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-role-sales"></div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-role-sales/10 text-role-sales border border-role-sales/20">Sales Team</span>
              <span className="text-[11px] text-on-surface-variant">Yesterday</span>
            </div>
            <h4 className="text-xs font-semibold text-on-surface mb-1 group-hover:text-primary transition-colors">New Pipeline Stages Enabled</h4>
            <p className="text-xs text-on-surface-variant line-clamp-2">Kanban board now tracks 6 stages from Prospecting to Closed Won/Lost with win probabilities.</p>
          </div>

          <div className="bg-white/70 dark:bg-slate-800/70 rounded-lg p-4 border border-glass-border hover-lift transition-all relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-role-finance"></div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-role-finance/10 text-role-finance border border-role-finance/20">Reports & BI</span>
              <span className="text-[11px] text-on-surface-variant">Oct 12</span>
            </div>
            <h4 className="text-xs font-semibold text-on-surface mb-1 group-hover:text-primary transition-colors">Automated Report Scheduling</h4>
            <p className="text-xs text-on-surface-variant line-clamp-2">Use the Scheduler module to configure recurring PDF/Excel/CSV exports directly to user inboxes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}