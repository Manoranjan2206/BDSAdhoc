import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../context/DataContext';
import { usersAPI } from '../services/apiService';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { inferTenantFromEmail } from '../constants/tenants';
import { UserIcon, PencilIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';

export default function Users() {
  const { getUsers } = useData();
  const { tenantName } = useCurrentUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ field: 'fullName', dir: 'asc' });
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modal state
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'create', // 'create' | 'edit'
    user: null,
  });
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'User',
    password: '',
    status: 'Active',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const list = await getUsers();
      const mapped = (Array.isArray(list) ? list : []).map(normalize);
      setUsers(mapped);
    } catch (e) {
      console.error('Failed to load users:', e);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [getUsers]);

  // Filter users strictly to current tenant
  const tenantFilteredUsers = useMemo(() => {
    if (!tenantName) return users;
    const targetTenant = tenantName.toLowerCase();
    return users.filter(u => {
      const uTenant = (u.tenantName || inferTenantFromEmail(u.email) || '').toLowerCase();
      return uTenant === targetTenant;
    });
  }, [users, tenantName]);

  const onExportCsv = () => {
    const headers = ['ID', 'First Name', 'Last Name', 'Full Name', 'Email', 'Role', 'Tenant', 'Status'];
    const rows = filtered.map(u => [u.id, u.firstName, u.lastName, u.fullName, u.email, u.role, u.tenantName, u.status]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tenantName || 'tenant'}-users.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenCreate = () => {
    const domain = (tenantName || 'company').toLowerCase();
    setFormData({
      firstName: '',
      lastName: '',
      email: `@${domain}.com`,
      role: 'User',
      password: '',
      status: 'Active',
    });
    setModalState({ isOpen: true, mode: 'create', user: null });
  };

  const handleOpenEdit = (user) => {
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      role: user.role || 'User',
      password: '',
      status: user.status || 'Active',
    });
    setModalState({ isOpen: true, mode: 'edit', user });
  };

  const handleCloseModal = () => {
    setModalState({ isOpen: false, mode: 'create', user: null });
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!formData.email || formData.email.startsWith('@')) {
      showNotification('A valid email address is required', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      if (modalState.mode === 'create') {
        const payload = {
          email: formData.email.trim(),
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          password: formData.password || undefined,
        };
        await usersAPI.createUser(payload);
        showNotification(`User ${payload.email} created successfully`);
        // Optimistic update
        setUsers(prev => [
          normalize({
            id: `usr_${Date.now()}`,
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            role: formData.role,
            tenantName: tenantName,
            isActive: formData.status === 'Active',
          }),
          ...prev,
        ]);
      } else {
        const payload = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
        };
        await usersAPI.updateUser(modalState.user.email, payload);
        showNotification(`User ${modalState.user.email} updated successfully`);
        // Update local state
        setUsers(prev =>
          prev.map(u =>
            u.email === modalState.user.email
              ? {
                  ...u,
                  firstName: payload.firstName,
                  lastName: payload.lastName,
                  fullName: `${payload.firstName} ${payload.lastName}`.trim(),
                  role: formData.role,
                }
              : u
          )
        );
      }
      handleCloseModal();
    } catch (err) {
      console.error('Error saving user:', err);
      showNotification(`Failed to save user: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusBadge = (status) => {
    const isActive = (status || '').toLowerCase() === 'active';
    return (
      <span
        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
          isActive
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
        }`}
      >
        {status || '—'}
      </span>
    );
  };

  const roleBadge = (role) => {
    const r = (role || 'User').toLowerCase();
    const color =
      r === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800' :
      r === 'sales' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' :
      r === 'finance' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
      r === 'support' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${color}`}>
        {role || 'User'}
      </span>
    );
  };

  const { filtered, paged } = useDerived(tenantFilteredUsers, search, sort, page, pageSize);

  return (
    <div className="reports-page font-inter bg-slate-50 dark:bg-[#0b0f19] min-h-screen text-slate-800 dark:text-slate-200">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold text-white transition-all ${
            notification.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
          }`}
        >
          {notification.msg}
        </div>
      )}

      {/* Consistent Topbar */}
      <div className="reports-topbar p-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Users &amp; Permissions</h1>
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {tenantName}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage team accounts and role permissions for {tenantName}
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
        >
          <PlusIcon className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Loading {tenantName} users...</p>
          </div>
        ) : tenantFilteredUsers.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-xs">
            <UserIcon className="w-16 h-16 text-slate-400 mb-4" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Users Found for {tenantName}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              There are no user accounts registered for {tenantName} yet.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Add First User
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card overflow-hidden border border-slate-200/80 dark:border-slate-800 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full sm:w-80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={`Search ${tenantName} users...`}
              />
              <div className="flex gap-2">
                <button
                  onClick={onExportCsv}
                  className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                  <tr>
                    {[
                      { key: 'fullName', title: 'User / Name', width: 200 },
                      { key: 'email', title: 'Email Address', width: 230 },
                      { key: 'role', title: 'Role', width: 120 },
                      { key: 'status', title: 'Status', width: 100 },
                      { key: 'actions', title: 'Actions', width: 80 },
                    ].map(col => (
                      <th
                        key={col.key}
                        className="px-4 py-3 text-xs tracking-wider"
                        style={{ width: col.width }}
                      >
                        <button
                          disabled={col.key === 'actions'}
                          className={`flex items-center gap-1 font-semibold ${col.key === 'actions' ? 'cursor-default' : 'hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                          onClick={() => {
                            if (col.key === 'actions') return;
                            setSort((prev) => {
                              const dir = prev.field === col.key && prev.dir === 'asc' ? 'desc' : 'asc';
                              return { field: col.key, dir };
                            });
                          }}
                        >
                          {col.title}
                          {sort.field === col.key && (
                            <span className="text-xs opacity-70">{sort.dir === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {paged.map(u => (
                    <tr
                      key={u.id || u.email}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {u.firstName ? u.firstName.charAt(0) : u.fullName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{u.fullName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">{u.email}</td>
                      <td className="px-4 py-3">{roleBadge(u.role)}</td>
                      <td className="px-4 py-3">{statusBadge(u.status)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 transition"
                          title="Edit User"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Page {page} of {Math.max(1, Math.ceil(filtered.length / pageSize))} ({filtered.length} total {tenantName} users)
              </span>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <button
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  disabled={page >= Math.ceil(filtered.length / pageSize)}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Create / Edit Modal */}
      {modalState.isOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold">
                  {modalState.mode === 'create' ? `Add User (${tenantName})` : `Edit User – ${modalState.user?.fullName}`}
                </h3>
                <p className="text-xs text-indigo-100 mt-0.5">
                  {modalState.mode === 'create' ? `Add a new member to ${tenantName}` : `Updating ${modalState.user?.email}`}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  disabled={modalState.mode === 'edit'}
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={`jane@${(tenantName || 'company').toLowerCase()}.com`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Sales">Sales</option>
                    <option value="Finance">Finance</option>
                    <option value="Support">Support</option>
                    <option value="Operations">Operations</option>
                    <option value="User">User</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {modalState.mode === 'create' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Temporary Password (Optional)
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Leave blank to auto-generate"
                  />
                </div>
              )}

              <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold transition shadow-sm"
                >
                  {isSubmitting ? 'Saving...' : modalState.mode === 'create' ? 'Create User' : 'Save Changes'}
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

// Derived data normalization
const normalize = (u) => {
  const first = String(u.firstName ?? u.FirstName ?? '').trim();
  const last = String(u.lastName ?? u.LastName ?? '').trim();
  const full = String(u.fullName ?? u.FullName ?? `${first} ${last}`.trim()).trim();
  const email = String(u.email ?? u.Email ?? '—');
  const tenant = String(u.tenantName ?? u.TenantName ?? inferTenantFromEmail(email));
  const role = String(u.role ?? u.Role ?? 'User');

  return {
    id: String(u.id ?? u.Id ?? ''),
    firstName: first,
    lastName: last,
    fullName: full || '—',
    email,
    role,
    tenantName: tenant,
    status: String(
      u.status ??
      u.Status ??
      ((u.isActive ?? u.IsActive) ? 'Active' : 'Inactive')
    ),
  };
};

function useDerived(users, search, sort, page, pageSize) {
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
      [u.id, u.firstName, u.lastName, u.fullName, u.email, u.role, u.tenantName, u.status]
        .some(v => String(v || '').toLowerCase().includes(q))
    );
  }, [users, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = String(a[sort.field] ?? '');
      const bv = String(b[sort.field] ?? '');
      return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return copy;
  }, [filtered, sort]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  return { filtered, sorted, paged };
}