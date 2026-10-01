import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../context/DataContext';
import { usersAPI } from '../services/apiService';
import { UserIcon, PencilIcon, TrashIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';

export default function Users() {
  const { getUsers } = useData();
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

  const onExportCsv = () => {
    const headers = ['ID', 'First Name', 'Last Name', 'Full Name', 'Email', 'Status'];
    const rows = filtered.map(u => [u.id, u.firstName, u.lastName, u.fullName, u.email, u.status]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenCreate = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
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
    if (!formData.email) {
      showNotification('Email is required', 'error');
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

  const handleDeleteUser = async (user) => {
    const confirmed = window.confirm(`Are you sure you want to delete user ${user.fullName} (${user.email})?`);
    if (!confirmed) return;

    try {
      await usersAPI.deleteUser(user.email);
      setUsers(prev => prev.filter(u => u.email !== user.email));
      showNotification(`User ${user.email} deleted successfully`);
    } catch (err) {
      console.error('Error deleting user:', err);
      showNotification(`Failed to delete user: ${err.message || 'Unknown error'}`, 'error');
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

  const { filtered, paged } = useDerived(users, search, sort, page, pageSize);

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
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Users &amp; Permissions</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage user accounts and identity access</p>
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
            <p className="text-xs text-slate-500 dark:text-slate-400">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-xs">
            <UserIcon className="w-16 h-16 text-slate-400 mb-4" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Users Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              There are no user accounts registered for your organization.
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
                placeholder="Search users by name, email, or role..."
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
                      { key: 'id', title: 'ID', width: 90 },
                      { key: 'firstName', title: 'First Name', width: 130 },
                      { key: 'lastName', title: 'Last Name', width: 130 },
                      { key: 'fullName', title: 'Full Name', width: 180 },
                      { key: 'email', title: 'Email', width: 220 },
                      { key: 'status', title: 'Status', width: 100 },
                      { key: 'actions', title: 'Actions', width: 100 },
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
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-[11px] truncate max-w-[90px]">{u.id}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{u.firstName}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{u.lastName}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{u.fullName}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                      <td className="px-4 py-3">{statusBadge(u.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 transition"
                            title="Edit User"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-red-600 dark:text-red-400 transition"
                            title="Delete User"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Page {page} of {Math.max(1, Math.ceil(filtered.length / pageSize))} ({filtered.length} total)
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
                  {modalState.mode === 'create' ? 'Create User Account' : 'Edit User Profile'}
                </h3>
                <p className="text-xs text-indigo-100 mt-0.5">
                  {modalState.mode === 'create' ? 'Add a new member to the tenant workspace' : `Updating ${modalState.user?.email}`}
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
                  placeholder="jane.doe@company.com"
                />
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
  return {
    id: String(u.id ?? u.Id ?? ''),
    firstName: first,
    lastName: last,
    fullName: full || '—',
    email: String(u.email ?? u.Email ?? '—'),
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
      [u.id, u.firstName, u.lastName, u.fullName, u.email, u.status]
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