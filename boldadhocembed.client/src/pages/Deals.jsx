import { useState, useEffect } from 'react';
import { authService } from '../services/authService';

const STAGES = [
  { id: 'Prospecting', label: 'Prospecting', prob: '10%', color: 'border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  { id: 'Qualification', label: 'Qualification', prob: '30%', color: 'border-purple-400 text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
  { id: 'Proposal', label: 'Proposal', prob: '60%', color: 'border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  { id: 'Negotiation', label: 'Negotiation', prob: '80%', color: 'border-orange-400 text-orange-600 bg-orange-50 dark:bg-orange-950/30' },
  { id: 'Closed Won', label: 'Closed Won', prob: '100%', color: 'border-emerald-400 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  { id: 'Closed Lost', label: 'Closed Lost', prob: '0%', color: 'border-red-400 text-red-600 bg-red-50 dark:bg-red-950/30' },
];

const INITIAL_DEALS = [
  { id: 1, name: 'Acme Corp - Enterprise License', company: 'Acme Corp', amount: 142000, stage: 'Negotiation', prob: 80, owner: 'John Doe', region: 'Europe', closeDate: '2026-08-30' },
  { id: 2, name: 'Nexus Dynamics - Cloud Suite', company: 'Nexus Dynamics', amount: 88000, stage: 'Proposal', prob: 60, owner: 'Anna Smith', region: 'North America', closeDate: '2026-09-15' },
  { id: 3, name: 'Quantum Soft - BI Engine Pro', company: 'Quantum Soft', amount: 54000, stage: 'Qualification', prob: 30, owner: 'Linda Lee', region: 'Asia', closeDate: '2026-09-28' },
  { id: 4, name: 'Horizon Tech - Multi-Tenant Expansion', company: 'Horizon Tech', amount: 215000, stage: 'Closed Won', prob: 100, owner: 'John Doe', region: 'Europe', closeDate: '2026-07-22' },
  { id: 5, name: 'Apex Global - 24/7 Dedicated Support', company: 'Apex Global', amount: 36000, stage: 'Prospecting', prob: 10, owner: 'Mike Brown', region: 'Oceania', closeDate: '2026-10-10' },
  { id: 6, name: 'Sterling Financial - Security Shield', company: 'Sterling Financial', amount: 110000, stage: 'Proposal', prob: 60, owner: 'Anna Smith', region: 'North America', closeDate: '2026-08-25' },
  { id: 7, name: 'Crestview Labs - API Integration Package', company: 'Crestview Labs', amount: 48500, stage: 'Closed Won', prob: 100, owner: 'Anna Smith', region: 'North America', closeDate: '2026-06-18' },
  { id: 8, name: 'Orion Logistics - Warehouse Connector', company: 'Orion Logistics', amount: 32000, stage: 'Closed Lost', prob: 0, owner: 'Linda Lee', region: 'Asia', closeDate: '2026-05-14' },
];

export default function Deals() {
  const [deals, setDeals] = useState(INITIAL_DEALS);
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('kanban'); // kanban | list
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeal, setNewDeal] = useState({ name: '', company: '', amount: '', stage: 'Prospecting', closeDate: '', region: 'North America' });

  const currentUser = authService.getUser() || {};
  const userRegion = currentUser.region || 'North America';

  const filteredDeals = deals.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRegion = regionFilter === 'ALL' || d.region === regionFilter;
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
      {showAddModal && (
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
        </div>
      )}
    </div>
  );
}
