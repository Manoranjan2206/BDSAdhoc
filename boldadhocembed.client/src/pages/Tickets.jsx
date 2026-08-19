import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { authService } from '../services/authService';
import { crmAPI } from '../services/apiService';

const SAMPLE_TICKETS = [
  // AlphaCorp (Tenant 1)
  { id: 101, tenantName: 'AlphaCorp', number: 'TKT-ALPHA-01', subject: 'AlphaCorp SSO Integration Failure with Azure AD', company: 'Acme Corp', priority: 'High', status: 'Open', category: 'Technical', assignedTo: 'Mike Brown', region: 'North America', csat: null, created: '2026-08-14' },
  { id: 102, tenantName: 'AlphaCorp', number: 'TKT-ALPHA-02', subject: 'AlphaCorp Dashboard PDF export timeout', company: 'Horizon Tech', priority: 'High', status: 'Resolved', category: 'Technical', assignedTo: 'Diana Miller', region: 'Europe', csat: 5, created: '2026-08-08' },
  { id: 103, tenantName: 'AlphaCorp', number: 'TKT-ALPHA-03', subject: 'AlphaCorp Asia region data sync latency', company: 'Quantum Soft', priority: 'Critical', status: 'Escalated', category: 'Bug', assignedTo: 'Linda Lee', region: 'Asia', csat: null, created: '2026-07-28' },

  // BetaSolutions (Tenant 2)
  { id: 201, tenantName: 'BetaSolutions', number: 'TKT-BETA-01', subject: 'BetaSolutions Payment Gateway Webhook Timeout', company: 'Sterling Financial', priority: 'Critical', status: 'Open', category: 'Billing', assignedTo: 'Julia King', region: 'Europe', csat: null, created: '2026-08-15' },
  { id: 202, tenantName: 'BetaSolutions', number: 'TKT-BETA-02', subject: 'BetaSolutions API Rate Limit Exceeded during bulk sync', company: 'Crestview Labs', priority: 'High', status: 'In Progress', category: 'Technical', assignedTo: 'Betty Jones', region: 'North America', csat: null, created: '2026-08-11' },

  // GammaIndustries (Tenant 3)
  { id: 301, tenantName: 'GammaIndustries', number: 'TKT-GAMMA-01', subject: 'GammaIndustries Industrial IoT Telemetry Dropouts', company: 'Vanguard Heavy', priority: 'Critical', status: 'In Progress', category: 'Hardware', assignedTo: 'George William', region: 'North America', csat: null, created: '2026-08-12' },
  { id: 302, tenantName: 'GammaIndustries', number: 'TKT-GAMMA-02', subject: 'GammaIndustries Custom Report Engine Memory Limit', company: 'Euro Logistics', priority: 'Medium', status: 'Open', category: 'Technical', assignedTo: 'Jack Black', region: 'Europe', csat: null, created: '2026-08-09' },

  // DeltaEnterprises (Tenant 4)
  { id: 401, tenantName: 'DeltaEnterprises', number: 'TKT-DELTA-01', subject: 'DeltaEnterprises POS Transaction Sync Lag', company: 'Apex Retail', priority: 'Critical', status: 'Open', category: 'Infrastructure', assignedTo: 'Megan Young', region: 'North America', csat: null, created: '2026-08-16' },
  { id: 402, tenantName: 'DeltaEnterprises', number: 'TKT-DELTA-02', subject: 'DeltaEnterprises Multi-Currency Invoice Calculation Error', company: 'Nordic Market', priority: 'High', status: 'In Progress', category: 'Billing', assignedTo: 'Zoe Turner', region: 'Europe', csat: null, created: '2026-08-13' },
];

export default function Tickets() {
  const currentUser = authService.getUser() || {};
  const userRole = currentUser.role || 'Admin';
  const userRegion = currentUser.region || 'North America';
  const tenantName = currentUser.tenantName || 'AlphaCorp';

  const filterFallbackTickets = () => {
    return SAMPLE_TICKETS.filter(t => 
      (t.tenantName === tenantName || !t.tenantName) &&
      (userRole === 'Admin' || t.region === userRegion)
    );
  };

  const [tickets, setTickets] = useState(filterFallbackTickets);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState(userRole === 'Admin' ? 'ALL' : userRegion);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', company: '', priority: 'Medium', category: 'Technical', region: userRegion });

  useEffect(() => {
    let isMounted = true;
    const fetchTickets = async () => {
      setLoading(true);
      try {
        const data = await crmAPI.getTickets();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          const mapped = data.map(t => ({
            id: t.ticketId || t.id,
            number: t.ticketNumber || `TKT-${t.ticketId}`,
            subject: t.subject,
            company: t.companyName || t.company,
            priority: t.priority,
            status: t.status,
            category: t.category || 'Technical',
            assignedTo: t.assignedTo || 'Support Agent',
            region: t.region || userRegion,
            created: t.createdAt ? t.createdAt.split('T')[0] : '2026-08-15',
          }));
          setTickets(mapped);
        } else if (isMounted) {
          setTickets(filterFallbackTickets());
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Backend tickets API offline, applying tenant RLS filter', err.message);
          setTickets(filterFallbackTickets());
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchTickets();
    return () => { isMounted = false; };
  }, [tenantName, userRegion, userRole]);

  useEffect(() => {
    setRegionFilter(userRole === 'Admin' ? 'ALL' : userRegion);
  }, [userRole, userRegion]);

  const filteredTickets = tickets.filter(t => {
    const text = `${t.number || ''} ${t.subject || ''} ${t.company || ''}`.toLowerCase();
    const matchesSearch = text.includes(searchTerm.toLowerCase());
    const matchesRegion = regionFilter === 'ALL' ? (userRole === 'Admin' || t.region === userRegion) : t.region === regionFilter;
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    return matchesSearch && matchesRegion && matchesStatus && matchesPriority;
  });

  const getPriorityColor = (prio) => {
    if (prio === 'Critical') return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-300';
    if (prio === 'High') return 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border-orange-300';
    if (prio === 'Medium') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400 border-yellow-300';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-300';
  };

  const getStatusColor = (status) => {
    if (status === 'Resolved' || status === 'Closed') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
    if (status === 'Escalated') return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
    if (status === 'In Progress') return 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400';
  };

  const handleAddTicket = (e) => {
    e.preventDefault();
    if (!newTicket.subject) return;
    const created = {
      id: Date.now(),
      number: `TKT-2026-${String(tickets.length + 45).padStart(4, '0')}`,
      ...newTicket,
      status: 'Open',
      assignedTo: currentUser.name || 'Support Agent',
      csat: null,
      created: new Date().toISOString().split('T')[0]
    };
    setTickets(prev => [created, ...prev]);
    setShowAddModal(false);
    setNewTicket({ subject: '', company: '', priority: 'Medium', category: 'Technical', region: 'North America' });
  };

  return (
    <div className="p-container-padding max-w-[1600px] mx-auto space-y-gutter">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">headset_mic</span>
            <h1 className="font-headline-lg text-2xl font-bold text-on-surface">Support Cases & Tickets</h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Track customer support requests, SLA compliance, resolution times, and CSAT scores.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary text-xs flex items-center gap-1.5 cursor-pointer self-start md:self-auto shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span> Raise Ticket
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-on-surface-variant uppercase font-medium">Open Cases</p>
            <h3 className="text-xl font-bold text-blue-600">{tickets.filter(t => t.status === 'Open').length}</h3>
          </div>
          <span className="material-symbols-outlined text-blue-600 text-[28px]">pending_actions</span>
        </div>

        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-on-surface-variant uppercase font-medium">In Progress</p>
            <h3 className="text-xl font-bold text-purple-600">{tickets.filter(t => t.status === 'In Progress').length}</h3>
          </div>
          <span className="material-symbols-outlined text-purple-600 text-[28px]">hourglass_top</span>
        </div>

        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-on-surface-variant uppercase font-medium">Resolved Cases</p>
            <h3 className="text-xl font-bold text-emerald-600">{tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length}</h3>
          </div>
          <span className="material-symbols-outlined text-emerald-600 text-[28px]">check_circle</span>
        </div>

        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-on-surface-variant uppercase font-medium">Avg CSAT Rating</p>
            <h3 className="text-xl font-bold text-amber-500 flex items-center gap-1">
              4.8 <span className="material-symbols-outlined text-[18px]">star</span>
            </h3>
          </div>
          <span className="material-symbols-outlined text-amber-500 text-[28px]">sentiment_satisfied</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-card rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center bg-surface-container rounded-lg px-3 py-1.5 border border-outline-variant/40 w-full md:w-80">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px] mr-2">search</span>
          <input
            type="text"
            placeholder="Search ticket # or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-xs w-full placeholder-on-surface-variant/70 text-on-surface"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-on-surface-variant">Region:</label>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:ring-primary"
            >
              <option value="ALL">All Regions (Admin)</option>
              <option value="North America">North America</option>
              <option value="Europe">Europe</option>
              <option value="Asia">Asia</option>
              <option value="Oceania">Oceania</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-on-surface-variant">Priority:</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:ring-primary"
            >
              <option value="ALL">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-on-surface-variant">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:ring-primary"
            >
              <option value="ALL">All Status</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
              <option value="Escalated">Escalated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="glass-card rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container text-on-surface-variant border-b border-glass-border uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3.5">Ticket #</th>
                <th className="p-3.5">Subject & Company</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Assigned Agent</th>
                <th className="p-3.5">Region</th>
                <th className="p-3.5">CSAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {filteredTickets.map((t) => (
                <tr key={t.id} className="hover:bg-surface-container-high transition-colors">
                  <td className="p-3.5 font-bold text-primary">{t.number}</td>
                  <td className="p-3.5">
                    <div className="font-semibold text-on-surface">{t.subject}</div>
                    <div className="text-[11px] text-on-surface-variant">{t.company} • {t.created}</div>
                  </td>
                  <td className="p-3.5 text-on-surface-variant">{t.category}</td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityColor(t.priority)}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(t.status)}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="p-3.5">{t.assignedTo}</td>
                  <td className="p-3.5 text-on-surface-variant">{t.region}</td>
                  <td className="p-3.5">
                    {t.csat ? (
                      <span className="text-amber-500 font-bold flex items-center gap-0.5">
                        {t.csat} <span className="material-symbols-outlined text-[14px]">star</span>
                      </span>
                    ) : (
                      <span className="text-on-surface-variant/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Ticket Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-glass-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-glass-border">
              <h3 className="font-bold text-base text-on-surface">Raise Support Ticket</h3>
              <button onClick={() => setShowAddModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddTicket} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Issue Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Export failure on BI dashboard"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={newTicket.company}
                  onChange={(e) => setNewTicket({ ...newTicket, company: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Priority</label>
                  <select
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Category</label>
                  <select
                    value={newTicket.category}
                    onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                  >
                    <option value="Technical">Technical</option>
                    <option value="Billing">Billing</option>
                    <option value="Bug">Bug</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Region</label>
                <select
                  value={newTicket.region}
                  onChange={(e) => setNewTicket({ ...newTicket, region: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                >
                  <option value="North America">North America</option>
                  <option value="Europe">Europe</option>
                  <option value="Asia">Asia</option>
                  <option value="Oceania">Oceania</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-glass-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs px-4 py-2"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
