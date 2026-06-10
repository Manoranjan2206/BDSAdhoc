import { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { UserIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function Users() {
  const { getUsers } = useData();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ field: 'fullName', dir: 'asc' });
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    const load = async () => {
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
    load();
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
    <div className="reports-page font-inter">
      {/* Consistent Topbar */}
      <div className="reports-topbar">
        <div className="flex items-center gap-4">
          <h1 className="reports-topbar-title">Users</h1>
          <p className="reports-topbar-sub">Manage user accounts and permissions</p>
        </div>
        <button className="modern-btn px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">
          Add User
        </button>
      </div>

      <div className="reports-main" style={{ padding: '16px' }}>
        {loading ? (
          <div className="reports-tree-loading h-full flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
            <p>Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="reports-placeholder h-full flex flex-col items-center justify-center">
            <UserIcon className="reports-placeholder-icon w-20 h-20 text-gray-400" />
            <h3 className="reports-placeholder-title mt-6">No Users Found</h3>
            <p className="reports-placeholder-text">
              There are no user accounts in the system yet.
            </p>
            <button className="modern-btn mt-6 px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">
              <UserIcon className="w-5 h-5 mr-2 inline" />
              Add First User
            </button>
          </div>
        ) : (
          <div className="bg-[var(--surface)] rounded-xl shadow-md overflow-hidden border border-[var(--brand-200)] p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full md:w-72 border rounded px-3 py-2"
                placeholder="Search users..."
              />
              <div className="flex gap-2">
                <button onClick={onExportCsv} className="px-3 py-2 border rounded hover:bg-gray-50">Export CSV</button>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-gray-50">
                    {[
                      { key: 'id', title: 'ID', width: 100 },
                      { key: 'firstName', title: 'First Name', width: 140 },
                      { key: 'lastName', title: 'Last Name', width: 140 },
                      { key: 'fullName', title: 'Full Name', width: 180 },
                      { key: 'email', title: 'Email', width: 220 },
                      { key: 'status', title: 'Status', width: 110 },
                      { key: 'actions', title: 'Actions', width: 110 },
                    ].map(col => (
                      <th key={col.key} className="text-left text-sm font-semibold text-gray-700 sticky top-0 px-3 py-2 border-b" style={{ width: col.width }}>
                        <button
                          disabled={col.key === 'actions'}
                          className={`flex items-center gap-1 ${col.key === 'actions' ? 'cursor-default' : ''}`}
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
                            <span className="text-xs opacity-60">{sort.dir === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 border-b text-sm text-gray-800">{u.id}</td>
                      <td className="px-3 py-2 border-b text-sm text-gray-800">{u.firstName}</td>
                      <td className="px-3 py-2 border-b text-sm text-gray-800">{u.lastName}</td>
                      <td className="px-3 py-2 border-b text-sm text-gray-800">{u.fullName}</td>
                      <td className="px-3 py-2 border-b text-sm text-gray-800">{u.email}</td>
                      <td className="px-3 py-2 border-b text-sm">{statusBadge(u.status)}</td>
                      <td className="px-3 py-2 border-b text-sm">
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 rounded hover:bg-gray-200" title="Edit"><PencilIcon className="w-4 h-4 text-blue-600"/></button>
                          <button className="p-1.5 rounded hover:bg-gray-200" title="Delete"><TrashIcon className="w-4 h-4 text-red-600"/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-3 text-sm">
              <span className="text-gray-600">Page {page} of {Math.max(1, Math.ceil(filtered.length / pageSize))}</span>
              <div className="flex gap-2">
                <button className="px-3 py-1 border rounded disabled:opacity-50" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
                <button className="px-3 py-1 border rounded disabled:opacity-50" disabled={page >= Math.ceil(filtered.length / pageSize)} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Derived data
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

// Hooks placed at bottom to keep component readable
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
 