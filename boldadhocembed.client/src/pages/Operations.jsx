import { useState } from 'react';
import { authService } from '../services/authService';

const SAMPLE_CAMPAIGNS = [
  { id: 1, name: 'Q3 Enterprise Tech Summit', type: 'Trade Show', status: 'Completed', budget: 35000, cost: 34200, leads: 114, region: 'North America', roi: '320%' },
  { id: 2, name: 'Winter Cloud Migration Webinar', type: 'Webinar', status: 'Active', budget: 12000, cost: 10500, leads: 88, region: 'Europe', roi: '240%' },
  { id: 3, name: 'Spring AI Capabilities Launch', type: 'Email', status: 'Active', budget: 8500, cost: 7200, leads: 62, region: 'Asia', roi: '185%' },
  { id: 4, name: 'Summer Security Whitepaper Lead Gen', type: 'Content', status: 'Completed', budget: 15000, cost: 14800, leads: 95, region: 'Oceania', roi: '290%' },
  { id: 5, name: 'Q4 Executive Roundtable Series', type: 'Event', status: 'Planned', budget: 25000, cost: 0, leads: 0, region: 'North America', roi: '—' },
];

const SAMPLE_AUDIT = [
  { id: 1, table: 'deals', record: 104, action: 'UPDATE', user: 'alpha2@alphacorp.com', details: 'Changed stage from Proposal to Negotiation ($142k)', time: '10 mins ago', region: 'Europe' },
  { id: 2, table: 'contacts', record: 260, action: 'INSERT', user: 'alpha1@alphacorp.com', details: 'Added new contact: William Lopez (Nexus Group)', time: '45 mins ago', region: 'Oceania' },
  { id: 3, table: 'support_tickets', record: 42, action: 'UPDATE', user: 'alpha4@alphacorp.com', details: 'Status changed to In Progress (Assigned: Mike Brown)', time: '2 hours ago', region: 'North America' },
  { id: 4, table: 'invoices', record: 37, action: 'INSERT', user: 'alpha3@alphacorp.com', details: 'Generated invoice INV-2026-0037 for $48,500', time: 'Yesterday', region: 'North America' },
  { id: 5, table: 'campaigns', record: 28, action: 'UPDATE', user: 'alpha5@alphacorp.com', details: 'Campaign Winter Webinar leads count updated (+15)', time: '2 days ago', region: 'Europe' },
];

export default function Operations() {
  const [activeTab, setActiveTab] = useState('campaigns'); // campaigns | audit
  const [searchTerm, setSearchTerm] = useState('');

  const currentUser = authService.getUser() || {};
  const userRole = currentUser.role || 'Admin';

  return (
    <div className="p-container-padding max-w-[1600px] mx-auto space-y-gutter">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">monitoring</span>
            <h1 className="font-headline-lg text-2xl font-bold text-on-surface">Operations & System Audit</h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Track marketing campaigns, operational metrics, and complete data audit trail.
          </p>
        </div>

        <div className="flex bg-surface-container rounded-lg p-0.5 border border-outline-variant/40 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'campaigns' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">campaign</span> Campaigns
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'audit' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">history</span> Audit Log
          </button>
        </div>
      </div>

      {activeTab === 'campaigns' ? (
        /* Marketing Campaigns Tab */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-on-surface-variant uppercase font-medium">Total Campaigns</p>
                <h3 className="text-xl font-bold text-primary">28</h3>
              </div>
              <span className="material-symbols-outlined text-primary text-[28px]">campaign</span>
            </div>

            <div className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-on-surface-variant uppercase font-medium">Active Leads</p>
                <h3 className="text-xl font-bold text-role-sales">420</h3>
              </div>
              <span className="material-symbols-outlined text-role-sales text-[28px]">group_add</span>
            </div>

            <div className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-on-surface-variant uppercase font-medium">Total Spend</p>
                <h3 className="text-xl font-bold text-emerald-600">$66,700</h3>
              </div>
              <span className="material-symbols-outlined text-emerald-600 text-[28px]">payments</span>
            </div>

            <div className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-on-surface-variant uppercase font-medium">Avg Lead ROI</p>
                <h3 className="text-xl font-bold text-purple-600">285%</h3>
              </div>
              <span className="material-symbols-outlined text-purple-600 text-[28px]">trending_up</span>
            </div>
          </div>

          <div className="glass-card rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container text-on-surface-variant border-b border-glass-border uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="p-3.5">Campaign Name</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Budget</th>
                    <th className="p-3.5">Actual Spend</th>
                    <th className="p-3.5">Leads</th>
                    <th className="p-3.5">Region</th>
                    <th className="p-3.5">Estimated ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass-border">
                  {SAMPLE_CAMPAIGNS.map(c => (
                    <tr key={c.id} className="hover:bg-surface-container-high transition-colors">
                      <td className="p-3.5 font-bold text-on-surface">{c.name}</td>
                      <td className="p-3.5 text-on-surface-variant">{c.type}</td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'Active' ? 'bg-blue-100 text-blue-700' : c.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3.5">${c.budget.toLocaleString()}</td>
                      <td className="p-3.5 font-medium">${c.cost.toLocaleString()}</td>
                      <td className="p-3.5 font-bold text-primary">{c.leads}</td>
                      <td className="p-3.5 text-on-surface-variant">{c.region}</td>
                      <td className="p-3.5 font-bold text-emerald-600">{c.roi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Audit Log Tab */
        <div className="glass-card rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-glass-border flex items-center justify-between">
            <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">history</span>
              System Change Log (RLS Protected)
            </h3>
            <span className="text-[11px] text-on-surface-variant">Showing latest 600 system operations</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container text-on-surface-variant border-b border-glass-border uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Table</th>
                  <th className="p-3.5">Details</th>
                  <th className="p-3.5">Performed By</th>
                  <th className="p-3.5">Region</th>
                  <th className="p-3.5">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {SAMPLE_AUDIT.map(a => (
                  <tr key={a.id} className="hover:bg-surface-container-high transition-colors">
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        a.action === 'INSERT' ? 'bg-emerald-100 text-emerald-700' : a.action === 'UPDATE' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {a.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-primary">{a.table}</td>
                    <td className="p-3.5 font-medium text-on-surface">{a.details}</td>
                    <td className="p-3.5 text-on-surface-variant">{a.user}</td>
                    <td className="p-3.5 text-on-surface-variant">{a.region}</td>
                    <td className="p-3.5 text-on-surface-variant text-[11px]">{a.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
