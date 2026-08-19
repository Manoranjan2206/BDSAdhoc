import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { authService } from '../services/authService';
import { crmAPI } from '../services/apiService';

const STAGES = [
  { id: 'Prospecting', label: 'Prospecting', prob: '10%', color: 'border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  { id: 'Qualification', label: 'Qualification', prob: '30%', color: 'border-purple-400 text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
  { id: 'Proposal', label: 'Proposal', prob: '60%', color: 'border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  { id: 'Negotiation', label: 'Negotiation', prob: '80%', color: 'border-orange-400 text-orange-600 bg-orange-50 dark:bg-orange-950/30' },
  { id: 'Closed Won', label: 'Closed Won', prob: '100%', color: 'border-emerald-400 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  { id: 'Closed Lost', label: 'Closed Lost', prob: '0%', color: 'border-red-400 text-red-600 bg-red-50 dark:bg-red-950/30' },
];

const INITIAL_DEALS = [
  // AlphaCorp (Tenant 1)
  { id: 101, tenantName: 'AlphaCorp', name: 'AlphaCorp - Enterprise Cloud Suite', company: 'Acme Corp', amount: 185000, stage: 'Negotiation', prob: 80, owner: 'John Doe', region: 'Europe', closeDate: '2026-08-30' },
  { id: 102, tenantName: 'AlphaCorp', name: 'AlphaCorp - BI Engine Expansion', company: 'Nexus Dynamics', amount: 94000, stage: 'Proposal', prob: 60, owner: 'Anna Smith', region: 'North America', closeDate: '2026-09-15' },
  { id: 103, tenantName: 'AlphaCorp', name: 'AlphaCorp - APAC Analytics Node', company: 'Quantum Soft', amount: 62000, stage: 'Qualification', prob: 30, owner: 'Linda Lee', region: 'Asia', closeDate: '2026-09-28' },
  { id: 104, tenantName: 'AlphaCorp', name: 'AlphaCorp - Multi-Tenant Security Upgrade', company: 'Horizon Tech', amount: 240000, stage: 'Closed Won', prob: 100, owner: 'John Doe', region: 'Europe', closeDate: '2026-07-22' },
  { id: 105, tenantName: 'AlphaCorp', name: 'AlphaCorp - Oceania Support SLA', company: 'Apex Global', amount: 42000, stage: 'Prospecting', prob: 10, owner: 'Mike Brown', region: 'Oceania', closeDate: '2026-10-10' },

  // BetaSolutions (Tenant 2)
  { id: 201, tenantName: 'BetaSolutions', name: 'BetaSolutions - FinTech Infrastructure', company: 'Sterling Financial', amount: 310000, stage: 'Negotiation', prob: 80, owner: 'Julia King', region: 'Europe', closeDate: '2026-09-05' },
  { id: 202, tenantName: 'BetaSolutions', name: 'BetaSolutions - North America Scaling', company: 'Crestview Labs', amount: 155000, stage: 'Proposal', prob: 60, owner: 'Betty Jones', region: 'North America', closeDate: '2026-09-20' },
  { id: 203, tenantName: 'BetaSolutions', name: 'BetaSolutions - Asia Logistics Hub', company: 'Orion Logistics', amount: 88000, stage: 'Closed Won', prob: 100, owner: 'Brian Adams', region: 'Asia', closeDate: '2026-08-10' },
  { id: 204, tenantName: 'BetaSolutions', name: 'BetaSolutions - Oceania Telemetry Engine', company: 'Pacific Wave', amount: 76000, stage: 'Qualification', prob: 30, owner: 'Diana Miller', region: 'Oceania', closeDate: '2026-10-01' },

  // GammaIndustries (Tenant 3)
  { id: 301, tenantName: 'GammaIndustries', name: 'GammaIndustries - Industrial Automation Suite', company: 'Vanguard Heavy', amount: 420000, stage: 'Closed Won', prob: 100, owner: 'George William', region: 'North America', closeDate: '2026-07-15' },
  { id: 302, tenantName: 'GammaIndustries', name: 'GammaIndustries - EU Supply Chain AI', company: 'Euro Logistics', amount: 280000, stage: 'Negotiation', prob: 80, owner: 'Jack Black', region: 'Europe', closeDate: '2026-09-12' },
  { id: 303, tenantName: 'GammaIndustries', name: 'GammaIndustries - Asia Power Grid Sync', company: 'Tokyo Energy', amount: 195000, stage: 'Proposal', prob: 60, owner: 'Olivia Martin', region: 'Asia', closeDate: '2026-10-05' },
  { id: 304, tenantName: 'GammaIndustries', name: 'GammaIndustries - Oceania Mining Sensor Grid', company: 'Aussie Metals', amount: 110000, stage: 'Prospecting', prob: 10, owner: 'Sophia White', region: 'Oceania', closeDate: '2026-11-01' },

  // DeltaEnterprises (Tenant 4)
  { id: 401, tenantName: 'DeltaEnterprises', name: 'DeltaEnterprises - Global Retail POS Integration', company: 'Apex Retail', amount: 550000, stage: 'Closed Won', prob: 100, owner: 'Megan Young', region: 'North America', closeDate: '2026-08-01' },
  { id: 402, tenantName: 'DeltaEnterprises', name: 'DeltaEnterprises - Euro Commerce Gateway', company: 'Nordic Market', amount: 340000, stage: 'Negotiation', prob: 80, owner: 'Zoe Turner', region: 'Europe', closeDate: '2026-09-25' },
  { id: 403, tenantName: 'DeltaEnterprises', name: 'DeltaEnterprises - Asia Fulfillment Engine', company: 'Silk Road Freight', amount: 225000, stage: 'Proposal', prob: 60, owner: 'Ryan Evans', region: 'Asia', closeDate: '2026-10-15' },
  { id: 404, tenantName: 'DeltaEnterprises', name: 'DeltaEnterprises - Oceania Cloud Pipeline', company: 'Sydney Logistics', amount: 140000, stage: 'Qualification', prob: 30, owner: 'Liam Cooper', region: 'Oceania', closeDate: '2026-11-10' },
];

export default function Deals() {
  const currentUser = authService.getUser() || {};
  const userRole = currentUser.role || 'Admin';
  const userRegion = currentUser.region || 'North America';
  const tenantName = currentUser.tenantName || 'AlphaCorp';

  const filterFallbackDeals = () => {
    return INITIAL_DEALS.filter(d => 
      (d.tenantName === tenantName || !d.tenantName) &&
      (userRole === 'Admin' || d.region === userRegion)
    );
  };

  const [deals, setDeals] = useState(filterFallbackDeals);
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState(userRole === 'Admin' ? 'ALL' : userRegion);
  const [viewMode, setViewMode] = useState('kanban'); // kanban | list
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeal, setNewDeal] = useState({ name: '', company: '', amount: '', stage: 'Prospecting', closeDate: '', region: userRegion });

  useEffect(() => {
    let isMounted = true;
    const fetchDeals = async () => {
      try {
        const data = await crmAPI.getDeals();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setDeals(data.map(d => ({
            id: d.dealId || d.id,
            name: d.title || d.name,
            company: d.companyName || d.company || 'Enterprise Client',
            amount: Number(d.amount || 0),
            stage: d.stage || 'Prospecting',
            prob: d.probability || 50,
            owner: d.ownerEmail || currentUser.name || 'Sales Rep',
            region: d.region || userRegion,
            closeDate: d.expectedCloseDate ? d.expectedCloseDate.split('T')[0] : '2026-09-30'
          })));
        } else if (isMounted) {
          setDeals(filterFallbackDeals());
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Backend deals API offline, applying tenant RLS filter', err.message);
          setDeals(filterFallbackDeals());
        }
      }
    };
    fetchDeals();
    return () => { isMounted = false; };
  }, [tenantName, userRegion, userRole]);

  useEffect(() => {
    setRegionFilter(userRole === 'Admin' ? 'ALL' : userRegion);
  }, [userRole, userRegion]);

  const filteredDeals = deals.filter(d => {
    const matchesSearch = (d.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (d.company || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRegion = regionFilter === 'ALL' ? (userRole === 'Admin' || d.region === userRegion) : d.region === regionFilter;
    return matchesSearch && matchesRegion;
  });

  const totalPipeline = filteredDeals.reduce((sum, d) => sum + Number(d.amount), 0);
  const wonPipeline = filteredDeals.filter(d => d.stage === 'Closed Won').reduce((sum, d) => sum + Number(d.amount), 0);

  const handleAddDeal = (e) => {
    e.preventDefault();
    if (!newDeal.name || !newDeal.amount) return;
    const stageObj = STAGES.find(s => s.id === newDeal.stage) || STAGES[0];
    const created = {
      id: Date.now(),
      name: newDeal.name,
      company: newDeal.company || 'Enterprise Account',
      amount: Number(newDeal.amount),
      stage: newDeal.stage,
      prob: parseInt(stageObj.prob),
      owner: currentUser.name || 'Current User',
      region: newDeal.region || userRegion,
      closeDate: newDeal.closeDate || new Date().toISOString().split('T')[0]
    };
    setDeals(prev => [created, ...prev]);
    setShowAddModal(false);
    setNewDeal({ name: '', company: '', amount: '', stage: 'Prospecting', closeDate: '', region: 'North America' });
  };

  return (
    <div className="p-container-padding max-w-[1600px] mx-auto space-y-gutter">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">handshake</span>
            <h1 className="font-headline-lg text-2xl font-bold text-on-surface">Sales Pipeline & Deals</h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Manage deal progression across 6 stages with win probability and RLS regional filtering.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-surface-container rounded-lg p-0.5 border border-outline-variant/40">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'kanban' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">view_kanban</span> Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'list' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">view_list</span> Table
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span> New Deal
          </button>
        </div>
      </div>

      {/* Summary KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-on-surface-variant uppercase font-medium">Total Pipeline Value</p>
            <h3 className="text-xl font-bold text-primary">${totalPipeline.toLocaleString()}</h3>
          </div>
          <span className="material-symbols-outlined text-primary text-[32px] opacity-80">account_balance_wallet</span>
        </div>

        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-on-surface-variant uppercase font-medium">Closed Won Revenue</p>
            <h3 className="text-xl font-bold text-emerald-600">${wonPipeline.toLocaleString()}</h3>
          </div>
          <span className="material-symbols-outlined text-emerald-600 text-[32px] opacity-80">verified</span>
        </div>

        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-on-surface-variant uppercase font-medium">Active Opportunities</p>
            <h3 className="text-xl font-bold text-on-surface">{filteredDeals.length} Deals</h3>
          </div>
          <span className="material-symbols-outlined text-role-sales text-[32px] opacity-80">leaderboard</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-card rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center bg-surface-container rounded-lg px-3 py-1.5 border border-outline-variant/40 w-full md:w-80">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px] mr-2">search</span>
          <input
            type="text"
            placeholder="Search deals or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-xs w-full placeholder-on-surface-variant/70 text-on-surface"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-xs font-semibold text-on-surface-variant">Region (RLS):</label>
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
      </div>

      {/* Kanban Board View */}
      {viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          {STAGES.map((stage) => {
            const stageDeals = filteredDeals.filter(d => d.stage === stage.id);
            const stageTotal = stageDeals.reduce((sum, d) => sum + Number(d.amount), 0);

            return (
              <div key={stage.id} className="glass-card rounded-xl p-3 flex flex-col w-[260px] flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/50 border border-glass-border">
                <div className="flex items-center justify-between pb-2 border-b border-glass-border mb-3">
                  <div>
                    <h4 className="text-xs font-bold text-on-surface">{stage.label}</h4>
                    <span className="text-[10px] text-on-surface-variant">{stage.prob} win rate</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-slate-800 text-on-surface border border-glass-border">
                    {stageDeals.length}
                  </span>
                </div>

                <div className="text-[11px] font-semibold text-primary mb-2">
                  ${stageTotal.toLocaleString()}
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar pr-0.5">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-glass-border hover-lift shadow-sm cursor-pointer space-y-2"
                    >
                      <h5 className="text-xs font-semibold text-on-surface line-clamp-2">{deal.name}</h5>
                      <p className="text-[11px] text-on-surface-variant truncate">{deal.company}</p>
                      
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
                        <span className="text-xs font-bold text-primary">${deal.amount.toLocaleString()}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium">
                          {deal.region}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-on-surface-variant">
                        <span>{deal.owner}</span>
                        <span>{deal.closeDate}</span>
                      </div>
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <div className="text-center py-8 text-xs text-on-surface-variant/60 border border-dashed border-outline-variant/30 rounded-lg">
                      No deals
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="glass-card rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container text-on-surface-variant border-b border-glass-border uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5">Deal Name</th>
                  <th className="p-3.5">Company</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Stage</th>
                  <th className="p-3.5">Probability</th>
                  <th className="p-3.5">Region</th>
                  <th className="p-3.5">Owner</th>
                  <th className="p-3.5">Target Close</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {filteredDeals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-surface-container-high transition-colors">
                    <td className="p-3.5 font-semibold text-on-surface">{deal.name}</td>
                    <td className="p-3.5 text-on-surface-variant">{deal.company}</td>
                    <td className="p-3.5 font-bold text-primary">${deal.amount.toLocaleString()}</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                        {deal.stage}
                      </span>
                    </td>
                    <td className="p-3.5">{deal.prob}%</td>
                    <td className="p-3.5 text-on-surface-variant">{deal.region}</td>
                    <td className="p-3.5">{deal.owner}</td>
                    <td className="p-3.5 text-on-surface-variant">{deal.closeDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Deal Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-glass-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-glass-border">
              <h3 className="font-bold text-base text-on-surface">Create New Deal</h3>
              <button onClick={() => setShowAddModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddDeal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Deal Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Global Tech Enterprise Package"
                  value={newDeal.name}
                  onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={newDeal.company}
                  onChange={(e) => setNewDeal({ ...newDeal, company: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Amount ($ USD) *</label>
                  <input
                    type="number"
                    required
                    placeholder="50000"
                    value={newDeal.amount}
                    onChange={(e) => setNewDeal({ ...newDeal, amount: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Pipeline Stage</label>
                  <select
                    value={newDeal.stage}
                    onChange={(e) => setNewDeal({ ...newDeal, stage: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                  >
                    {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Region</label>
                  <select
                    value={newDeal.region}
                    onChange={(e) => setNewDeal({ ...newDeal, region: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                  >
                    <option value="North America">North America</option>
                    <option value="Europe">Europe</option>
                    <option value="Asia">Asia</option>
                    <option value="Oceania">Oceania</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Target Close Date</label>
                  <input
                    type="date"
                    value={newDeal.closeDate}
                    onChange={(e) => setNewDeal({ ...newDeal, closeDate: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                  />
                </div>
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
                  Save Deal
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
