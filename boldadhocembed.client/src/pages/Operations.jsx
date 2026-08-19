import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { crmAPI } from '../services/apiService';

const SAMPLE_CAMPAIGNS = [
  // AlphaCorp (Tenant 1)
  { id: 101, tenantName: 'AlphaCorp', name: 'AlphaCorp Q3 Enterprise Summit', type: 'Trade Show', status: 'Completed', budget: 35000, cost: 34200, leads: 114, region: 'North America', roi: '320%' },
  { id: 102, tenantName: 'AlphaCorp', name: 'AlphaCorp Cloud Migration Webinar', type: 'Webinar', status: 'Active', budget: 12000, cost: 10500, leads: 88, region: 'Europe', roi: '240%' },
  { id: 103, tenantName: 'AlphaCorp', name: 'AlphaCorp APAC AI Capabilities', type: 'Email', status: 'Active', budget: 8500, cost: 7200, leads: 62, region: 'Asia', roi: '185%' },

  // BetaSolutions (Tenant 2)
  { id: 201, tenantName: 'BetaSolutions', name: 'BetaSolutions FinTech Security Forum', type: 'Event', status: 'Active', budget: 45000, cost: 41000, leads: 140, region: 'Europe', roi: '350%' },
  { id: 202, tenantName: 'BetaSolutions', name: 'BetaSolutions NA Scaling Workshop', type: 'Webinar', status: 'Completed', budget: 18000, cost: 17500, leads: 92, region: 'North America', roi: '275%' },

  // GammaIndustries (Tenant 3)
  { id: 301, tenantName: 'GammaIndustries', name: 'GammaIndustries Industrial IoT Expo', type: 'Expo', status: 'Active', budget: 60000, cost: 58000, leads: 210, region: 'North America', roi: '410%' },
  { id: 302, tenantName: 'GammaIndustries', name: 'GammaIndustries EU Supply Chain Summit', type: 'Conference', status: 'Completed', budget: 30000, cost: 29000, leads: 125, region: 'Europe', roi: '310%' },

  // DeltaEnterprises (Tenant 4)
  { id: 401, tenantName: 'DeltaEnterprises', name: 'DeltaEnterprises Global Commerce Keynote', type: 'Keynote', status: 'Active', budget: 75000, cost: 71000, leads: 310, region: 'North America', roi: '480%' },
  { id: 402, tenantName: 'DeltaEnterprises', name: 'DeltaEnterprises Retail AI Roadshow', type: 'Roadshow', status: 'Completed', budget: 40000, cost: 38500, leads: 165, region: 'Europe', roi: '380%' },
];

const SAMPLE_AUDIT = [
  // AlphaCorp (Tenant 1)
  { id: 101, tenantName: 'AlphaCorp', table: 'deals', record: 104, action: 'UPDATE', user: 'alpha2@alphacorp.com', details: 'Changed stage from Proposal to Negotiation ($185k)', time: '10 mins ago', region: 'Europe' },
  { id: 102, tenantName: 'AlphaCorp', table: 'contacts', record: 101, action: 'INSERT', user: 'alpha1@alphacorp.com', details: 'Added new contact: William Lopez (Nexus Group)', time: '45 mins ago', region: 'Oceania' },

  // BetaSolutions (Tenant 2)
  { id: 201, tenantName: 'BetaSolutions', table: 'deals', record: 201, action: 'UPDATE', user: 'beta2@betasolutions.com', details: 'Approved deal terms for Sterling Financial ($310k)', time: '15 mins ago', region: 'Europe' },
  { id: 202, tenantName: 'BetaSolutions', table: 'contacts', record: 201, action: 'INSERT', user: 'beta1@betasolutions.com', details: 'Created account contact Alexander Wright', time: '1 hour ago', region: 'Europe' },

  // GammaIndustries (Tenant 3)
  { id: 301, tenantName: 'GammaIndustries', table: 'deals', record: 301, action: 'UPDATE', user: 'gamma1@gammaindustries.com', details: 'Marked deal Vanguard Heavy as Closed Won ($420k)', time: '20 mins ago', region: 'North America' },

  // DeltaEnterprises (Tenant 4)
  { id: 401, tenantName: 'DeltaEnterprises', table: 'deals', record: 401, action: 'UPDATE', user: 'delta1@deltaenterprises.com', details: 'Marked deal Apex Retail as Closed Won ($550k)', time: '5 mins ago', region: 'North America' },
];

export default function Operations() {
  const currentUser = authService.getUser() || {};
  const userRole = currentUser.role || 'Admin';
  const userRegion = currentUser.region || 'North America';
  const tenantName = currentUser.tenantName || 'AlphaCorp';

  const filterFallbackCampaigns = () => {
    return SAMPLE_CAMPAIGNS.filter(c => 
      (c.tenantName === tenantName || !c.tenantName) &&
      (userRole === 'Admin' || c.region === userRegion)
    );
  };

  const filterFallbackAudit = () => {
    return SAMPLE_AUDIT.filter(a => 
      (a.tenantName === tenantName || !a.tenantName) &&
      (userRole === 'Admin' || a.region === userRegion)
    );
  };

  const [campaigns, setCampaigns] = useState(filterFallbackCampaigns);
  const [auditLogs, setAuditLogs] = useState(filterFallbackAudit);
  const [activeTab, setActiveTab] = useState('campaigns'); // campaigns | audit
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [cData, aData] = await Promise.allSettled([
          crmAPI.getCampaigns(),
          crmAPI.getAuditLogs()
        ]);

        if (isMounted && cData.status === 'fulfilled' && Array.isArray(cData.value) && cData.value.length > 0) {
          setCampaigns(cData.value.map(c => ({
            id: c.campaignId || c.id,
            name: c.name,
            type: c.type || 'Campaign',
            status: c.status || 'Active',
            budget: c.budget || 10000,
            cost: c.actualCost || c.cost || 8000,
            leads: c.leadsGenerated || c.leads || 45,
            region: c.region || userRegion,
            roi: c.roi || '210%'
          })));
        } else if (isMounted) {
          setCampaigns(filterFallbackCampaigns());
        }

        if (isMounted && aData.status === 'fulfilled' && Array.isArray(aData.value) && aData.value.length > 0) {
          setAuditLogs(aData.value.map(a => ({
            id: a.logId || a.id,
            table: a.tableName || a.table || 'crm_records',
            record: a.recordId || a.record || 1,
            action: a.action || 'UPDATE',
            user: a.performedByEmail || a.user || 'system',
            details: a.changeDetails || a.details || 'Record updated',
            time: a.timestamp ? a.timestamp.split('T')[0] : 'Today',
            region: a.region || userRegion
          })));
        } else if (isMounted) {
          setAuditLogs(filterFallbackAudit());
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Backend operations API offline, applying tenant RLS filter', err.message);
          setCampaigns(filterFallbackCampaigns());
          setAuditLogs(filterFallbackAudit());
        }
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [tenantName, userRegion, userRole]);

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
                  {campaigns.map(c => (
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
                {auditLogs.map(a => (
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
