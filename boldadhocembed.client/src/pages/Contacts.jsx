import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { authService } from '../services/authService';
import { crmAPI } from '../services/apiService';

const SAMPLE_CONTACTS = [
  // AlphaCorp (Tenant 1)
  { id: 101, tenantName: 'AlphaCorp', firstName: 'William', lastName: 'Lopez', email: 'william.lopez@nexusgroup.com', phone: '+1 (622) 225-3938', company: 'Nexus Group', jobTitle: 'Infrastructure Architect', region: 'Oceania', leadSource: 'Webinar Signup', status: 'Active', owner: 'Mike Brown' },
  { id: 102, tenantName: 'AlphaCorp', firstName: 'Sarah', lastName: 'Hernandez', email: 'sarah.hernandez@quantumcorp.com', phone: '+1 (918) 310-7267', company: 'Quantum Corp', jobTitle: 'VP of Engineering', region: 'Oceania', leadSource: 'LinkedIn Outreach', status: 'Active', owner: 'Mike Brown' },
  { id: 103, tenantName: 'AlphaCorp', firstName: 'Karen', lastName: 'Anderson', email: 'karen.anderson@zenithindustries.com', phone: '+1 (428) 224-4164', company: 'Zenith Industries', jobTitle: 'Operations Manager', region: 'North America', leadSource: 'Webinar Signup', status: 'Active', owner: 'Anna Smith' },
  { id: 104, tenantName: 'AlphaCorp', firstName: 'David', lastName: 'Miller', email: 'david.miller@acmecorp.com', phone: '+1 (555) 123-4567', company: 'Acme Corp', jobTitle: 'Chief Technology Officer', region: 'Europe', leadSource: 'Partner Referral', status: 'Active', owner: 'John Doe' },
  { id: 105, tenantName: 'AlphaCorp', firstName: 'Michael', lastName: 'Chen', email: 'michael.chen@horizonlabs.com', phone: '+65 6789 0123', company: 'Horizon Labs', jobTitle: 'Financial Controller', region: 'Asia', leadSource: 'Conference', status: 'Active', owner: 'Linda Lee' },

  // BetaSolutions (Tenant 2)
  { id: 201, tenantName: 'BetaSolutions', firstName: 'Alexander', lastName: 'Wright', email: 'alex.wright@sterlingfinancial.com', phone: '+44 20 7946 0912', company: 'Sterling Financial', jobTitle: 'VP of Global Risk', region: 'Europe', leadSource: 'Executive Network', status: 'Active', owner: 'Julia King' },
  { id: 202, tenantName: 'BetaSolutions', firstName: 'Rachel', lastName: 'Green', email: 'rachel.g@crestviewlabs.com', phone: '+1 (415) 890-1122', company: 'Crestview Labs', jobTitle: 'Director of Procurement', region: 'North America', leadSource: 'Website Inbound', status: 'Active', owner: 'Betty Jones' },
  { id: 203, tenantName: 'BetaSolutions', firstName: 'Hiroshi', lastName: 'Tanaka', email: 'htanaka@orionlogistics.jp', phone: '+81 3 5555 0143', company: 'Orion Logistics', jobTitle: 'Supply Chain Lead', region: 'Asia', leadSource: 'Partner Referral', status: 'Active', owner: 'Brian Adams' },

  // GammaIndustries (Tenant 3)
  { id: 301, tenantName: 'GammaIndustries', firstName: 'Marcus', lastName: 'Vance', email: 'mvance@vanguardheavy.com', phone: '+1 (312) 555-7890', company: 'Vanguard Heavy', jobTitle: 'Chief Operating Officer', region: 'North America', leadSource: 'Industrial Expo', status: 'Active', owner: 'George William' },
  { id: 302, tenantName: 'GammaIndustries', firstName: 'Elena', lastName: 'Rostova', email: 'elena.rostova@eurologistics.eu', phone: '+49 30 1234 5678', company: 'Euro Logistics', jobTitle: 'Head of Automation', region: 'Europe', leadSource: 'Direct Email', status: 'Active', owner: 'Jack Black' },

  // DeltaEnterprises (Tenant 4)
  { id: 401, tenantName: 'DeltaEnterprises', firstName: 'Samantha', lastName: 'Sterling', email: 'ssterling@apexretail.com', phone: '+1 (212) 999-4321', company: 'Apex Retail', jobTitle: 'E-Commerce VP', region: 'North America', leadSource: 'Keynote Speaker', status: 'Active', owner: 'Megan Young' },
  { id: 402, tenantName: 'DeltaEnterprises', firstName: 'Lars', lastName: 'Lindqvist', email: 'lars.l@nordicmarket.se', phone: '+46 8 123 456', company: 'Nordic Market', jobTitle: 'Retail Systems Director', region: 'Europe', leadSource: 'Webinar', status: 'Active', owner: 'Zoe Turner' },
];

export default function Contacts() {
  const currentUser = authService.getUser() || {};
  const userRole = currentUser.role || 'Admin';
  const userRegion = currentUser.region || 'North America';
  const tenantName = currentUser.tenantName || 'AlphaCorp';

  const filterFallbackContacts = () => {
    return SAMPLE_CONTACTS.filter(c => 
      (c.tenantName === tenantName || !c.tenantName) &&
      (userRole === 'Admin' || c.region === userRegion)
    );
  };

  const [contacts, setContacts] = useState(filterFallbackContacts);
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState(userRole === 'Admin' ? 'ALL' : userRegion);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', jobTitle: '', region: userRegion, leadSource: 'Website Inbound' });

  useEffect(() => {
    let isMounted = true;
    const fetchContacts = async () => {
      try {
        const data = await crmAPI.getContacts();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setContacts(data.map(c => ({
            id: c.contactId || c.id,
            firstName: c.firstName || (c.fullName ? c.fullName.split(' ')[0] : 'Contact'),
            lastName: c.lastName || (c.fullName ? c.fullName.split(' ').slice(1).join(' ') : ''),
            email: c.email || '',
            phone: c.phone || '+1 (555) 000-0000',
            company: c.companyName || c.company || 'Enterprise Account',
            jobTitle: c.title || c.jobTitle || 'Representative',
            region: c.region || userRegion,
            leadSource: c.leadScore ? `Score: ${c.leadScore}` : 'Website Inbound',
            status: 'Active',
            owner: currentUser.name || 'Account Executive'
          })));
        } else if (isMounted) {
          setContacts(filterFallbackContacts());
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Backend contacts API offline, applying tenant RLS filter', err.message);
          setContacts(filterFallbackContacts());
        }
      }
    };
    fetchContacts();
    return () => { isMounted = false; };
  }, [tenantName, userRegion, userRole]);

  useEffect(() => {
    setRegionFilter(userRole === 'Admin' ? 'ALL' : userRegion);
  }, [userRole, userRegion]);

  const filteredContacts = contacts.filter(c => {
    const name = `${c.firstName || ''} ${c.lastName || ''} ${c.company || ''} ${c.email || ''}`.toLowerCase();
    const matchesSearch = name.includes(searchTerm.toLowerCase());
    const matchesRegion = regionFilter === 'ALL' ? (userRole === 'Admin' || c.region === userRegion) : c.region === regionFilter;
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesRegion && matchesStatus;
  });

  const handleAddContact = (e) => {
    e.preventDefault();
    if (!newContact.firstName || !newContact.email) return;
    const created = {
      id: Date.now(),
      ...newContact,
      status: 'Active',
      owner: currentUser.name || 'Current User'
    };
    setContacts(prev => [created, ...prev]);
    setShowAddModal(false);
    setNewContact({ firstName: '', lastName: '', email: '', phone: '', company: '', jobTitle: '', region: 'North America', leadSource: 'Website Inbound' });
  };

  return (
    <div className="p-container-padding max-w-[1600px] mx-auto space-y-gutter">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">contacts</span>
            <h1 className="font-headline-lg text-2xl font-bold text-on-surface">CRM Contacts & Leads</h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Browse and manage customer profiles across your organization with RLS filtering.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary text-xs flex items-center gap-1.5 cursor-pointer self-start md:self-auto shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span> Add Contact
        </button>
      </div>

      {/* Filters Bar */}
      <div className="glass-card rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center bg-surface-container rounded-lg px-3 py-1.5 border border-outline-variant/40 w-full md:w-80">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px] mr-2">search</span>
          <input
            type="text"
            placeholder="Search by name, company, email..."
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
            <label className="text-xs font-semibold text-on-surface-variant">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-1.5 text-xs text-on-surface focus:ring-primary"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Churned">Churned</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="glass-card rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container text-on-surface-variant border-b border-glass-border uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3.5">Name</th>
                <th className="p-3.5">Company & Title</th>
                <th className="p-3.5">Contact Info</th>
                <th className="p-3.5">Region (RLS)</th>
                <th className="p-3.5">Lead Source</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Assigned Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {filteredContacts.map((c) => (
                <tr key={c.id} className="hover:bg-surface-container-high transition-colors">
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {c.firstName[0]}{c.lastName[0]}
                      </div>
                      <span className="font-semibold text-on-surface">{c.firstName} {c.lastName}</span>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <div className="font-medium text-on-surface">{c.company}</div>
                    <div className="text-[11px] text-on-surface-variant">{c.jobTitle}</div>
                  </td>
                  <td className="p-3.5">
                    <div className="text-on-surface">{c.email}</div>
                    <div className="text-[11px] text-on-surface-variant">{c.phone}</div>
                  </td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium text-[11px]">
                      {c.region}
                    </span>
                  </td>
                  <td className="p-3.5 text-on-surface-variant">{c.leadSource}</td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      c.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-on-surface-variant font-medium">{c.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Contact Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-glass-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-glass-border">
              <h3 className="font-bold text-base text-on-surface">Add New Contact</h3>
              <button onClick={() => setShowAddModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddContact} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newContact.firstName}
                    onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Last Name</label>
                  <input
                    type="text"
                    value={newContact.lastName}
                    onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Company</label>
                  <input
                    type="text"
                    value={newContact.company}
                    onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Job Title</label>
                  <input
                    type="text"
                    value={newContact.jobTitle}
                    onChange={(e) => setNewContact({ ...newContact, jobTitle: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Region</label>
                  <select
                    value={newContact.region}
                    onChange={(e) => setNewContact({ ...newContact, region: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:ring-primary"
                  >
                    <option value="North America">North America</option>
                    <option value="Europe">Europe</option>
                    <option value="Asia">Asia</option>
                    <option value="Oceania">Oceania</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Lead Source</label>
                  <input
                    type="text"
                    placeholder="e.g. Website Inbound"
                    value={newContact.leadSource}
                    onChange={(e) => setNewContact({ ...newContact, leadSource: e.target.value })}
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
                  Save Contact
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
