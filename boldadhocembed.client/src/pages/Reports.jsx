import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  DocumentIcon,
  FolderIcon,
  PlusIcon,
  DocumentDuplicateIcon,
  EllipsisVerticalIcon,
  StarIcon as StarIconOutline,
  Squares2X2Icon,
  ListBulletIcon,
  ArrowPathIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  CheckCircleIcon,
  XMarkIcon,
  BoltIcon,
  UserIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { useNavigate, useLocation } from 'react-router-dom';
import { reportsAPI } from '../services/apiService';
import { useData } from '../context/DataContext';
import { authService } from '../services/authService';
import { usePermissions } from '../hooks/usePermissions';
import { motion } from 'framer-motion';
import ReportScheduleDrawer from '../components/ReportScheduleDrawer';
import QuickEditDialog from '../components/QuickEditDialog';
import QuickCreateDialog from '../components/QuickCreateDialog';
import '../styles/reports.css';

import { getCategoryPalette } from '../utils/palette';
import { COLOR_PALETTES } from '../constants/colorPalettes';

const CUSTOM_GROUPS = [
  'Sales Analytics',
  'Marketing & Finance Analytics',
  'Finance Analytics',
  'Marketing Analytics',
  'System & Operational Reports',
  'System Reports',
  'Other Analytics',
  'My Reports'
];

export default function Reports() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getReports, getViewerSettings, reportsSidebarCollapsed, setReportsSidebarCollapsed, invalidate } = useData();

  const [tree, setTree] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  // My Reports: dedicated server-side listing for the category whose
  // name equals the current user's email. Fetched lazily on first toggle
  // activation; refreshed whenever the user changes (new login).
  const [myReports, setMyReports] = useState([]);
  const [myReportsCategoryName, setMyReportsCategoryName] = useState('');
  const [myReportsFetched, setMyReportsFetched] = useState(false);

  const { currentUser, canEditReports, canCopyReports, canExportReports } = usePermissions();
  const canCreateReport = canEditReports || canCopyReports;
  
  // Copy / Quick Edit state
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditSource, setQuickEditSource] = useState(null);

  // Quick Create (new report from shared dataset) state
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  // Report-Centric Scheduling & Export Action Drawer (matching Davis reference)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerReport, setDrawerReport] = useState(null);
  const [drawerInitialTab, setDrawerInitialTab] = useState('schedule');
  const [successToast, setSuccessToast] = useState(null);

  // Single source of truth for the floating "Saved / Created" toast.
  // Replaces any in-flight toast with the new payload and auto-dismisses
  // after 3s. Any pending dismissal timer is cleared first so back-to-back
  // saves don't leave the previous timer running and pop the toast early.
  const toastTimerRef = useRef(null);
  const showToast = useCallback((payload, durationMs = 3000) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setSuccessToast(payload);
    if (durationMs > 0) {
      toastTimerRef.current = setTimeout(() => {
        setSuccessToast(null);
        toastTimerRef.current = null;
      }, durationMs);
    }
  }, []);
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const handleScheduleSaved = (data) => {
    showToast({
      title: data?.isEdit ? 'Schedule Updated Successfully' : 'Schedule Created Successfully',
      name: data?.name,
      reportName: data?.reportName,
      summary: data?.summary,
    });
  };

  const handleOpenDrawer = (report, category, tab = 'schedule', e) => {
    if (tab && typeof tab === 'object' && typeof tab.stopPropagation === 'function') {
      tab.stopPropagation();
      tab = 'schedule';
    } else if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    const resolvedTab = typeof tab === 'string' ? tab : 'schedule';
    setDrawerReport({
      ...report,
      categoryName: category || report?.categoryName || 'Reports',
    });
    setDrawerInitialTab(resolvedTab);
    setDrawerOpen(true);
  };
  
  // Filtering & View state
  const [activeScope, setActiveScope] = useState('all'); // 'all' | 'favorites'
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all'); // 'all' or category name
  const [viewMode, setViewMode] = useState('table'); // 'grid' | 'table'
  
  // Column Sorting state
  const [sortColumn, setSortColumn] = useState('name'); // 'name' | 'categoryName' | 'description' | 'modifiedDate'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };
  
  const [starredReports, setStarredReports] = useState(() => {
    try {
      const saved = localStorage.getItem('starred_reports');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [viewerSettings, setViewerSettings] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerKey, setViewerKey] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isResizingRef = useRef(false);
  const mainRef = useRef(null);
  const [activeMenu, setActiveMenu] = useState(null);

  const toggleMenu = (id, e) => {
    e?.stopPropagation();
    setActiveMenu(prev => (prev === id ? null : id));
  };

  useEffect(() => {
    const handleOutsideClick = () => setActiveMenu(null);
    if (activeMenu) window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeMenu]);

  const viewerDivRef = useRef(null);

  const toggleStar = (reportId, e) => {
    e.preventDefault();
    e.stopPropagation();
    setStarredReports(prev => {
      const next = prev.includes(reportId)
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId];
      localStorage.setItem('starred_reports', JSON.stringify(next));
      return next;
    });
  };

  const handleDeleteReport = async (report, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!window.confirm(`Are you sure you want to delete "${report.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // Call the delete API — Bold Reports v1.0 endpoint uses ItemId (GUID)
      // as the primary key; name+category are kept as fallback.
      const response = await fetch('/api/reports/Delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken()}`,
        },
        body: JSON.stringify({
          id: report.id || report.Id,
          name: report.serverReportName || report.name,
          category: report.serverCategory || 'Analytics Reports',
        }),
      });

      const data = await response.json();

      if (data.success) {
        showToast({
          title: 'Report Deleted',
          name: report.name,
          summary: `"${report.name}" has been successfully deleted.`,
        });
        
        // Refresh the report tree
        try {
          const fresh = await reportsAPI.getReportTree();
          setTree(Array.isArray(fresh) && fresh.length > 0 ? fresh : []);
        } catch (err) {
          console.warn('Tree refresh after delete failed', err);
        }
        
        // Refresh My Reports if applicable
        try { fetchMyReportsRef.current(); } catch (e) { /* noop */ }
      } else {
        showToast({
          title: 'Delete Failed',
          name: report.name,
          summary: data.error || 'Failed to delete the report. Please try again.',
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast({
        title: 'Delete Error',
        name: report.name,
        summary: error.message || 'An error occurred while deleting the report.',
      });
    }
  };

  const handleBulkDeleteCategory = async (categoryName, reportCount, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!window.confirm(`Delete all ${reportCount} reports in "${categoryName}"? This action cannot be undone.`)) {
      return;
    }

    const reportsInCategory = allReports.filter(r => r.categoryName === categoryName && r.canDelete);
    if (reportsInCategory.length === 0) {
      showToast({
        title: 'No Reports to Delete',
        summary: 'No reports in this category can be deleted.',
      });
      return;
    }

    let deleted = 0;
    let failed = 0;

    for (const report of reportsInCategory) {
      try {
        const response = await fetch('/api/reports/Delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authService.getToken()}`,
          },
          body: JSON.stringify({
            name: report.serverReportName || report.name,
            category: report.serverCategory || 'Analytics Reports',
          }),
        });

        const data = await response.json();
        if (data.success) {
          deleted++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error('Delete error for report:', report.name, error);
        failed++;
      }
    }

    // Refresh UI
    try {
      const fresh = await reportsAPI.getReportTree();
      setTree(Array.isArray(fresh) && fresh.length > 0 ? fresh : []);
    } catch (e) {
      console.warn('Tree refresh after bulk delete failed', e);
    }

    try { fetchMyReportsRef.current(); } catch (e) { /* noop */ }

    showToast({
      title: 'Bulk Delete Complete',
      summary: `${deleted} report${deleted !== 1 ? 's' : ''} deleted${failed > 0 ? `, ${failed} failed` : ''}`,
    });
  };

  const getFormattedDateString = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return String(dateStr);
    }
  };

  // Flatten reports list
  const allReports = useMemo(() => {
    const list = [];
    if (!Array.isArray(tree)) return list;
    tree.forEach(cat => {
      const catName = cat.Name || cat.name || 'Uncategorized';
      const reports = cat.Reports || cat.reports || [];
      reports.forEach(r => {
        list.push({
          ...r,
          id: r.Id || r.id,
          name: r.Name || r.name,
          categoryName: catName,
          serverCategory: r.ServerCategory || r.serverCategory || r.CategoryName || 'Analytics Reports',
          serverReportName: r.ServerReportName || r.serverReportName || r.Name || r.name,
          description: r.Description || r.description || '',
          modifiedDate: r.ModifiedDate || r.modifiedDate || r.ModifiedDateString || r.CreatedDate || r.createdDate || null,
          createdById: r.CreatedById || r.createdById,
          isPublic: r.IsPublic ?? r.isPublic ?? true,
        });
      });
    });
    return list;
  }, [tree]);

  // Categories list with counts
  const categoriesList = useMemo(() => {
    if (!Array.isArray(tree)) return [];
    return tree.map(cat => ({
      name: cat.Name || cat.name || 'Uncategorized',
      count: Array.isArray(cat.Reports || cat.reports) ? (cat.Reports || cat.reports).length : 0
    }));
  }, [tree]);

  // Filtered reports calculation
  const filteredReports = useMemo(() => {
    let result = [...allReports];

    // Category filter
    if (selectedCategoryFilter !== 'all') {
      result = result.filter(r => r.categoryName === selectedCategoryFilter);
    }

    // Scope filter
    if (activeScope === 'favorites') {
      result = result.filter(r => starredReports.includes(r.id));
    } else if (activeScope === 'my') {
      const userEmail = (currentUser?.email || '').trim().toLowerCase();
      result = result.filter(r =>
        userEmail && String(r.categoryName || '').trim().toLowerCase() === userEmail
      );
    }

    // Column Sorting
    result.sort((a, b) => {
      let valA = a[sortColumn] ?? '';
      let valB = b[sortColumn] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allReports, selectedCategoryFilter, activeScope, starredReports, sortColumn, sortDirection, currentUser]);

  useEffect(() => {
    fetchReports();
    fetchViewerSettings();
  }, []);

  // My Reports: dedicated /api/reports/my fetch. Server returns every
  // report whose CategoryName equals the caller's email (case-insensitive,
  // trimmed). Stored behind a ref so the listener and the effect can use
  // a single stable function reference — otherwise the effect would
  // re-fire on every render and produce a runaway fetch loop when a save
  // updates state.
  const fetchMyReportsRef = useRef(async () => {});
  fetchMyReportsRef.current = async () => {
    const userEmail = currentUser?.email;
    if (!userEmail) return;
    console.log('[MY-REPORTS] fetchMyReports() for', userEmail);
    try {
      const res = await reportsAPI.getMyReports();
      const categoryName = res?.categoryName ?? userEmail;
      const reports = Array.isArray(res?.reports) ? res.reports : [];
      console.log('[MY-REPORTS] fetchMyReports response. categoryName=', categoryName, 'reports.length=', reports.length);
      setMyReportsCategoryName(categoryName);
      setMyReports(reports);
      setMyReportsFetched(true);
    } catch (err) {
      console.error('[MY-REPORTS] Failed to load My Reports:', err);
      setMyReports([]);
    }
  };

  // Run only when the tab is entered or the user changes.
  useEffect(() => {
    if (activeScope !== 'my') return;
    if (!currentUser?.email) return;
    fetchMyReportsRef.current();
  }, [activeScope, currentUser]);

  // Re-fetch when Designer dispatches `reports:changed` after its Save.
  // Mounted once with [] — uses the ref so the handler identity is
  // stable, so adding/removing listeners doesn't loop.
  useEffect(() => {
    const handler = () => fetchMyReportsRef.current();
    window.addEventListener('reports:changed', handler);
    return () => window.removeEventListener('reports:changed', handler);
  }, []);

  // When My Reports scope is active, render the server-fetched list
  // directly — no client-side filter over the tree. Apply only the
  // sort column/direction on top so the user's chosen order is preserved.
  const displayReports = useMemo(() => {
    if (activeScope !== 'my') {
      console.log('[MY-REPORTS] displayReports: scope=', activeScope, '→ returning filteredReports.length=', filteredReports.length);
      return filteredReports;
    }
    const result = myReports.map(r => ({
      ...r,
      id: r.id || r.Id,
      name: r.name || r.Name,
      categoryName: r.categoryName || myReportsCategoryName || currentUser?.email,
      serverCategory: r.serverCategory || r.categoryName || myReportsCategoryName || currentUser?.email,
      serverReportName: r.serverReportName || r.name || r.Name,
      description: r.description || '',
      modifiedDate: r.modifiedDate || r.createdDate || null,
      createdById: r.createdById,
      isPublic: r.isPublic ?? true,
      canDelete: true, // My Reports allows delete
    }));
    console.log('[MY-REPORTS] displayReports: scope=my, myReports.length=', myReports.length, '→ result.length=', result.length);
    if (result.length === 0) return result;
    result.sort((a, b) => {
      let valA = a[sortColumn] ?? '';
      let valB = b[sortColumn] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [activeScope, myReports, myReportsCategoryName, filteredReports, sortColumn, sortDirection, currentUser]);

  // Toolbar badge — prefer the server-fetched count when available, fall
  // back to the client-side estimate over the tree so the badge is never
  // empty before the first fetch completes.
  const myReportsCount = useMemo(() => {
    if (myReportsFetched) return myReports.length;
    const userEmail = (currentUser?.email || '').trim().toLowerCase();
    if (!userEmail) return 0;
    return allReports.filter(r =>
      String(r.categoryName || '').trim().toLowerCase() === userEmail
    ).length;
  }, [myReportsFetched, myReports, allReports, currentUser]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await getReports();
      const normalized = Array.isArray(data) && data.length > 0 ? data : [];
      setTree(normalized);
    } catch (err) {
      console.error('Failed to load reports:', err);
      setTree([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchViewerSettings = async () => {
    setViewerLoading(true);
    try {
      // Use the shared viewer-settings cache so we hit the same endpoint
      // as Designer.jsx/Header.jsx (`/api/reports/viewer-settings`),
      // which returns { token, serviceUrl, serverUrl, reportRootUrl } —
      // the schema the viewer component below expects. The previous code
      // called `getEmbedToken()` (different endpoint, different schema),
      // which left `viewerSettings` null and caused the demo
      // `demos.boldreports.com` fallbacks below to engage.
      const settings = await getViewerSettings();
      if (settings && (settings.token || settings.serviceUrl || settings.serverUrl)) {
        setViewerSettings(settings);
      } else {
        console.warn('viewer-settings response missing known keys', settings);
      }
    } catch (err) {
      console.error('Failed to load viewer settings:', err);
    } finally {
      setViewerLoading(false);
    }
  };

  // Deep link support (?report=...&category=...)
  useEffect(() => {
    if (!tree.length || !location.search) return;

    const params = new URLSearchParams(location.search);
    const reportName = decodeURIComponent(params.get('report') || '').trim();
    const categoryName = decodeURIComponent(params.get('category') || '').trim();

    if (!reportName) return;

    const reportLower = reportName.toLowerCase();
    const catLower = categoryName.toLowerCase();

    for (const cat of tree) {
      const catName = String(cat.Name || cat.name || '').trim();
      if (catLower && catName.toLowerCase() !== catLower) continue;

      const found = (cat.Reports || cat.reports || []).find(
        r => String(r.Name || r.name || '').toLowerCase() === reportLower
      );

      if (found) {
        handleSelectReport(found, catName);
        break;
      }
    }
  }, [tree, location.search]);

  // Resizer handlers
  useEffect(() => {
    const onMove = (e) => {
      if (!isResizingRef.current) return;
      const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
      if (!clientX || !mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      const newWidth = Math.max(180, Math.min(400, clientX - rect.left));
      setSidebarWidth(newWidth);
    };

    const onUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchend', onUp);
    };
  }, []);

  const handleSelectReport = (report, category) => {
    if (!report) return;
    setSelectedReport(report);
    setSelectedCategory(category || report.categoryName || null);
    setViewerKey(prev => prev + 1);
  };


  const handleOpenCopyModal = (report, category) => {
    // Opens the Quick Edit dialog. The old "open in full designer"
    // behaviour is preserved as an opt-out chip inside the dialog.
    const name = report?.name || report?.Name || '';
    const serverCategory = report?.serverCategory || category || 'Analytics Reports';
    const serverReportName = report?.serverReportName || report?.ServerReportName || name;
    setQuickEditSource({
      name,
      serverPath: serverCategory ? `/${serverCategory}/${serverReportName}` : serverReportName,
      reportId: report?.itemId || report?.ItemId || report?.id || null,
      category: serverCategory,
      serverReportName,
      description: report?.description || report?.Description || '',
    });
    setQuickEditOpen(true);
  };

  const handleOpenFullDesignerFromQuickEdit = () => {
    // Open the source report directly in the Bold Reports designer
    // (no Quick Edit intermediate). Mirrors the legacy Bold Reports
    // open-designer flow:
    //
    //   var designerObj = $('#designer').data('boldReportDesigner');
    //   designerObj.openReport('/Cat name/Report name');
    //
    // We navigate to /designer?open=<serverPath> so the Designer page
    // can grab the designer widget instance after init and call
    // openReport(serverPath) verbatim. serverPath is the Bold Reports
    // server path ("/<category>/<report-name>") and IS the source
    // report — not a clone.
    if (!quickEditSource) return;
    setQuickEditOpen(false);
    const serverName = quickEditSource.serverReportName || quickEditSource.name;
    let serverCategory = quickEditSource.category || 'Analytics Reports';

    // Strip the tenant-name prefix (e.g. "AlphaCorp/") when present.
    // The tree's serverCategory already includes the tenant at the
    // front ("AlphaCorp/alpha1@alphacorp.com"), but Bold Reports'
    // openReport expects the inner category only ("alpha1@alphacorp.com")
    // — the tenant is implied by the authenticated site. Passing the
    // tenant-prefixed path makes the designer look up the report under
    // a category that doesn't exist (the per-user email category is
    // nested INSIDE the tenant, not a sibling), so it returns nothing.
    const user = authService.getUser()?.user || authService.getUser();
    const tenant = user?.tenantName || user?.TenantName || '';
    if (tenant && serverCategory.toLowerCase().startsWith(`${tenant.toLowerCase()}/`)) {
        serverCategory = serverCategory.substring(tenant.length + 1);
    }

    const serverPath = `/${serverCategory}/${serverName}`.replace(/\/{2,}/g, '/');
    const params = new URLSearchParams();
    params.set('open', serverPath);
    params.set('name', serverName);
    params.set('category', serverCategory);
    if (quickEditSource.description) params.set('desc', quickEditSource.description);
    navigate(`/designer?${params.toString()}`);
  };

  const handleQuickEditSaved = (data, opts = {}) => {
    // Refresh the reports tree. invalidate() schedules a state update,
    // but reading cache synchronously after it still returns the stale
    // value (React batches). Calling the API directly bypasses the
    // cache entirely so the new report shows up in the listing now,
    // not on the next tick.
    (async () => {
      try {
        if (typeof invalidate === 'function') invalidate('reports');
        const fresh = await reportsAPI.getReportTree();
        setTree(Array.isArray(fresh) && fresh.length > 0 ? fresh : []);
      } catch (e) {
        console.warn('Tree refresh after Quick Edit save failed', e);
      }
    })();

    // My Reports has its own endpoint and its own ref-based fetcher.
    try { fetchMyReportsRef.current(); } catch (e) { /* noop */ }

    showToast({
      title: 'Quick Edit saved',
      name: data?.newReportName,
      reportName: data?.newReportName,
      summary: `Saved to “${data?.targetCategory}”.`,
    });

    // Save & Run: open the new report in the inline Bold Reports
    // viewer so the user can verify the result without leaving the
    // Reports page.
    if (opts.runAfterSave && data?.newReportId) {
      openNewReportInViewer({
        id: data.newReportId,
        name: data.newReportName,
        serverReportName: data.newReportName,
        serverCategory: data.targetCategory,
      });
    }
  };

  const handleQuickCreateCreated = (data, opts = {}) => {
    // Same bypass-the-cache pattern as Quick Edit so the listing is
    // up-to-date immediately after a Quick Create.
    (async () => {
      try {
        if (typeof invalidate === 'function') invalidate('reports');
        const fresh = await reportsAPI.getReportTree();
        setTree(Array.isArray(fresh) && fresh.length > 0 ? fresh : []);
      } catch (e) {
        console.warn('Tree refresh after Quick Create save failed', e);
      }
    })();

    try { fetchMyReportsRef.current(); } catch (e) { /* noop */ }

    showToast({
      title: 'Quick Create report saved',
      name: data?.reportName,
      reportName: data?.reportName,
      summary: `Saved to “${data?.categoryName || 'My Reports'}”.`,
    });

    if (opts.runAfterSave && data?.itemId) {
      openNewReportInViewer({
        id: data.itemId,
        name: data.reportName,
        serverReportName: data.reportName,
        serverCategory: data.categoryName || 'My Reports',
      });
    }
  };

  // After Save & Run: open the newly-saved report in the inline Bold
  // Reports viewer. Builds a synthetic report object shaped like the
  // tree entries so the existing viewer effect picks it up and the
  // user immediately sees the rendered report without leaving the page.
  const openNewReportInViewer = (report) => {
    if (!report) return;
    setSelectedReport({
      id: report.id,
      name: report.name,
      serverReportName: report.serverReportName,
      serverCategory: report.serverCategory,
      categoryName: report.serverCategory,
      isPublic: true,
      canRead: true,
      canWrite: true,
    });
    setSelectedCategory(report.serverCategory);
    setViewerKey((prev) => prev + 1);
  };

  // Destroy the jQuery-based Bold Reports viewer before unmounting so it does
  // not leak DOM event handlers or overlay the listing view, and so the next
  // selected report always boots a fresh widget.
  const destroyReportViewer = () => {
    const $ = window.$ || window.jQuery;
    const elem = viewerDivRef.current;
    if (!$) return;
    const sel = elem?.id ? `#${elem.id}` : null;
    if (!sel) return;
    try {
      if ($(sel).data('boldReportViewer')) {
        $(sel).boldReportViewer('destroy');
      }
    } catch (e) {
      console.warn('Failed to destroy viewer on back-to-list:', e);
    }
    try {
      // Force-clear any leftover render targets the widget may have appended
      $(sel).empty().off().removeData();
    } catch (e) {
      // no-op
    }
  };

  const handleBackToList = () => {
    destroyReportViewer();
    // Bump viewer key so the next mount uses a fresh DOM node id
    setViewerKey(prev => prev + 1);
    setSelectedReport(null);
    setSelectedCategory(null);
  };

  const handleCategorySelect = (catName) => {
    if (selectedReport) {
      handleBackToList();
    }
    setSelectedCategoryFilter(catName);
  };

  // Viewer parameters
  const reportName = selectedReport?.name || selectedReport?.Name || null;
  const serverReportName = selectedReport?.serverReportName || selectedReport?.ServerReportName || reportName;
  const categoryName = selectedReport?.CategoryName || selectedCategory || selectedReport?.categoryName || 'Analytics Reports';

  const serverCategory = selectedReport?.serverCategory || selectedReport?.ServerCategory ||
    ((!categoryName || CUSTOM_GROUPS.includes(categoryName.trim()))
      ? 'Analytics Reports'
      : categoryName.trim());

  // Report Path: Prioritize Report ID (GUID) as recommended by user and official Bold Reports docs,
  // which loads the report directly and uniquely without any path or category hierarchy issues.
  // If no GUID, fall back to path with tenant name properly included.
  const reportPath = useMemo(() => {
    const reportGuid = selectedReport?.id || selectedReport?.Id || selectedReport?.ReportId;
    if (reportGuid && typeof reportGuid === 'string' && reportGuid.length > 20 && !reportGuid.includes('/')) {
      return String(reportGuid).trim();
    }

    if (serverReportName) {
      let cat = serverCategory;
      const user = authService.getUser()?.user || authService.getUser();
      const tenant = user?.tenantName || user?.TenantName || '';
      if (tenant && cat !== 'Analytics Reports' && !cat.toLowerCase().startsWith(tenant.toLowerCase())) {
        cat = `${tenant}/${cat}`;
      }
      return `/${cat}/${serverReportName.trim()}`.replace(/\/{2,}/g, '/');
    }
    return null;
  }, [selectedReport, serverCategory, serverReportName]);

  // The viewer-settings endpoint returns:
  //   { token, serviceUrl, serverUrl, reportRootUrl }
  // `token` is the authentication bearer. `serviceUrl` already points at
  // the `/reportservice/api/Viewer` endpoint on cloud.boldreports.com.
  const reportServiceUrl = viewerSettings?.serviceUrl ||
    import.meta.env.VITE_BOLD_REPORT_SERVICE_URL ||
    null;

  const reportServerUrl = viewerSettings?.serverUrl || null;

  // Reports viewer widget does NOT add a "Bearer " prefix around the
  // embedToken — it forwards the value verbatim into both the
  // `authorization` and `embedToken` request headers. Strip any prefix the
  // upstream may have accidentally added so the widget doesn't end up
  // sending "Authorization: Bearer Bearer eyJ…" (which the Reports site
  // rejects with 401).
  const rawToken = viewerSettings?.token || null;
  const stripBearer = (s) =>
    s ? String(s).replace(/^Bearer\s+/i, '').trim() : s;
  const embedToken = rawToken ? stripBearer(rawToken) : null;

  const selectedReportRef = useRef(selectedReport);
  useEffect(() => {
    selectedReportRef.current = selectedReport;
  }, [selectedReport]);

  const toolbarSettings = useMemo(() => {
    const customItems = [
      {
        groupIndex: 4,
        index: 1,
        type: 'Default',
        cssClass: 'e-icon e-clock e-reportviewer-icon CustomSchedule',
        id: 'Schedule',
        tooltip: { header: 'Schedule', content: 'Create a time based Schedule Report' },
      },
    ];

    return {
      showToolbar: true,
      items: window.ej?.ReportViewer?.ToolbarItems?.All & ~window.ej?.ReportViewer?.ToolbarItems?.Print,
      customItems,
    };
  }, []);

  const onToolBarItemClick = (args) => {
    const value = args?.value || args?.id || args?.target?.id || args?.name;
    if (value === 'Schedule' || value === 'CustomSchedule' || (typeof value === 'string' && value.toLowerCase().includes('schedule'))) {
      if (selectedReportRef.current) {
        handleOpenDrawer(selectedReportRef.current, selectedReportRef.current.categoryName || '', 'schedule');
      }
    }
  };

  useEffect(() => {
    if (!reportPath || !viewerDivRef.current) return;

    const elem = viewerDivRef.current;
    const $ = window.$ || window.jQuery;

    if (!$) {
      console.warn('jQuery not found - viewer may not initialize');
      return;
    }

    const id = elem.id;
    const sel = `#${id}`;

    if ($(sel).data('boldReportViewer')) {
      try {
        $(sel).boldReportViewer('destroy');
      } catch (e) {
        console.warn('Failed to destroy previous viewer instance', e);
      }
    }

    try {
      $(sel).boldReportViewer({
        reportServiceUrl,
        reportServerUrl,
        reportPath,
        embedToken,
        toolbarSettings,
        toolBarItemClick: onToolBarItemClick,
        toolbarClick: onToolBarItemClick,
        ajaxBeforeLoad: (args) => {
          const currentUser = authService.getUser()?.user || authService.getUser();
          if (currentUser && currentUser.email) {
            args.headers.push({ Key: 'X-User-Email', Value: currentUser.email });
          }
          const currentUserId = currentUser?.id || currentUser?.userId;
          if (currentUserId) {
            args.headers.push({ Key: 'X-User-Id', Value: String(currentUserId) });
          }
        },
        locale: 'en-US',
        processingMode: 'Remote',
        height: '100%',
        width: '100%',
        isResponsive: true
      });
    } catch (err) {
      console.error('Failed to initialize jQuery viewer:', err);
    }

    return () => {
      if ($(sel).data('boldReportViewer')) {
        try {
          $(sel).boldReportViewer('destroy');
        } catch (e) { }
      }
    };
  }, [viewerKey, reportPath, reportServiceUrl, reportServerUrl, embedToken, toolbarSettings]);

  return (
    <div
      className="reports-page font-inter h-full flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--background)' }}
    >
      {/* Work Area (Sidebar + Content Workspace) */}
      <div className="reports-main flex-1 flex min-h-0 relative" ref={mainRef}>
        {/* Category Sidebar */}
        <div
          className={`border-r flex flex-col transition-all duration-200 z-10 ${
            reportsSidebarCollapsed ? 'w-0 overflow-hidden border-none' : ''
          }`}
          style={{
            width: reportsSidebarCollapsed ? 0 : sidebarWidth,
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          {!reportsSidebarCollapsed && (
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1">
                <span>Collections</span>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500 font-semibold">
                  {categoriesList.length}
                </span>
              </div>

              {/* All Categories Option */}
              <button
                onClick={() => handleCategorySelect('all')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FolderIcon className="w-4 h-4 text-indigo-500" /> All Collections
                </span>
                <span className="text-[11px] opacity-70 font-semibold">{allReports.length}</span>
              </button>

              {/* Category Items */}
              <div className="space-y-1 pt-1">
                {categoriesList.map((cat, idx) => {
                  const palette = getCategoryPalette(cat.name);
                  const isSelected = selectedCategoryFilter === cat.name;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleCategorySelect(cat.name)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-colors ${
                        isSelected
                          ? `${palette.bg} ${palette.text} font-semibold border ${palette.border}`
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate pr-2">
                        <span className={`w-2 h-2 rounded-full ${palette.dot}`} />
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-500">
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setReportsSidebarCollapsed(!reportsSidebarCollapsed)}
          className="absolute top-3.5 z-30 flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow transition-all"
          style={{ left: reportsSidebarCollapsed ? 12 : sidebarWidth - 14 }}
          title={reportsSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronRightIcon className={`w-3.5 h-3.5 text-slate-500 transition-transform ${reportsSidebarCollapsed ? '' : 'rotate-180'}`} />
        </button>

        {/* Content View Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50 dark:bg-[#111422]">
          {selectedReport && reportPath ? (
            /* Viewer View */
            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#181c2c] m-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Viewer Top Toolbar */}
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={handleBackToList}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <ChevronLeftIcon className="w-4 h-4" /> Back to list
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">{reportName}</h2>
                    {categoryName && <p className="text-[11px] text-slate-400 truncate">{categoryName}</p>}
                  </div>
                </div>
              </div>

              {/* Viewer Container */}
              <div className="flex-1 min-h-0 relative">
                {viewerLoading ? (
                  <div className="h-full flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#FF4800] animate-spin mb-3" />
                    <p className="text-xs text-slate-500">Loading Report Viewer...</p>
                  </div>
                ) : (
                  <div
                    id={`reportviewer-${viewerKey}`}
                    ref={viewerDivRef}
                    style={{ height: '100%', width: '100%' }}
                  />
                )}
              </div>
            </div>
          ) : (
            /* Reports Listing View */
            <div className="flex-1 flex flex-col min-h-0">
              {/* Single Compact Action Bar */}
              <div className="px-6 py-3 flex items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-[#181c2c]/60 backdrop-blur-sm">
                {/* Left: Filter Pills */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-medium">
                    <button
                      onClick={() => setActiveScope('all')}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        activeScope === 'all'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      All Reports
                    </button>
                    <button
                      onClick={() => setActiveScope('favorites')}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        activeScope === 'favorites'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Favorites ({starredReports.length})
                    </button>
                    <button
                      onClick={() => {
                        console.log('[MY-REPORTS] button clicked → setActiveScope(my). currentUser.email=', currentUser?.email);
                        setActiveScope('my');
                      }}
                      title={currentUser?.email ? `Reports in category "${currentUser.email}"` : 'My Reports'}
                      className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                        activeScope === 'my'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <UserIcon className="w-3.5 h-3.5" />
                      My Reports ({myReportsCount})
                    </button>
                  </div>

                  {/* When "My Reports" is active, surface the user's email as
                      the resolved category name (the Bold Reports category the
                      toggle is filtering to) so it's obvious what category is
                      being shown. Falls back to the sidebar's category filter
                      indicator when the user has drilled in further. */}
                  {activeScope === 'my' && currentUser?.email && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Filtering by: <strong className="text-slate-800 dark:text-slate-200">{currentUser.email}</strong>
                    </span>
                  )}
                  {activeScope !== 'my' && selectedCategoryFilter !== 'all' && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Filtering by: <strong className="text-slate-800 dark:text-slate-200">{selectedCategoryFilter}</strong>
                    </span>
                  )}
                </div>

                {/* Right: View mode & Create report */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-lg transition-all ${
                        viewMode === 'grid'
                          ? 'bg-white dark:bg-slate-700 text-[#FF4800] shadow-sm'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                      title="Grid View"
                    >
                      <Squares2X2Icon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded-lg transition-all ${
                        viewMode === 'table'
                          ? 'bg-white dark:bg-slate-700 text-[#FF4800] shadow-sm'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                      title="Table View"
                    >
                      <ListBulletIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {canCreateReport && (
                    <>
                      <button
                        onClick={() => setQuickCreateOpen(true)}
                        title="Quick Create — build a report from a shared dataset"
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#FF4800] bg-white border border-[#FF4800]/40 hover:bg-orange-50 dark:bg-transparent dark:hover:bg-orange-950/30 rounded-xl transition-all shadow-sm cursor-pointer"
                      >
                        <BoltIcon className="w-4 h-4" />
                        Quick Create
                      </button>
                      <button
                        onClick={() => navigate('/designer')}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#FF4800] hover:bg-[#e03f00] rounded-xl transition-all shadow-sm cursor-pointer"
                      >
                        <PlusIcon className="w-4 h-4 stroke-[2.5]" />
                        New Report
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Main Content List / Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                  <div className="h-64 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#FF4800] animate-spin mb-3" />
                    <p className="text-xs text-slate-500">Loading Reports...</p>
                  </div>
                ) : displayReports.length === 0 ? (
                  <div className="bg-white dark:bg-[#181c2c] rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-md mx-auto space-y-3 mt-12">
                    <DocumentIcon className="w-12 h-12 text-slate-300 mx-auto" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">No Reports Found</h3>
                    <p className="text-xs text-slate-500">
                      No reports match your current filter. Try selecting a different category or clearing filters.
                    </p>
                    <button
                      onClick={() => { setSelectedCategoryFilter('all'); setActiveScope('all'); }}
                      className="px-4 py-2 text-xs font-semibold text-[#FF4800] bg-orange-50 dark:bg-orange-950/40 rounded-xl hover:bg-orange-100 transition-colors"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : viewMode === 'grid' ? (
                  /* GRID VIEW */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {displayReports.map(report => {
                      const isStarred = starredReports.includes(report.id);
                      const palette = getCategoryPalette(report.categoryName);
                      const isDrawerActive = drawerOpen && drawerReport?.id === report.id;
                      return (
                        <motion.div
                          key={report.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => handleSelectReport(report, report.categoryName)}
                          className={`bg-white dark:bg-[#181c2c] rounded-2xl border p-4 transition-all cursor-pointer flex flex-col justify-between group relative ${
                            isDrawerActive
                              ? 'border-[#183955] dark:border-[#FF4800] ring-2 ring-[#183955]/30 dark:ring-[#FF4800]/40 shadow-xl -translate-y-1 bg-slate-50/60 dark:bg-slate-800/40'
                              : 'border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                          }`}
                        >
                          <div className="space-y-2">
                            {/* Title and Star/Menu actions */}
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#FF4800] transition-colors truncate min-w-0 flex-1">
                                {report.name}
                              </h3>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={(e) => toggleStar(report.id, e)}
                                  className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
                                  title={isStarred ? "Remove Star" : "Star Report"}
                                >
                                  {isStarred ? (
                                    <StarIconSolid className="w-4 h-4 text-amber-400" />
                                  ) : (
                                    <StarIconOutline className="w-4 h-4" />
                                  )}
                                </button>
                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => toggleMenu(report.id, e)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    <EllipsisVerticalIcon className="w-4 h-4" />
                                  </button>
                                  {activeMenu === report.id && (
                                    <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-[#181c2c] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-50 text-xs">
                                      {canCopyReports && (
                                        <button
                                          onClick={() => handleOpenCopyModal(report, report.categoryName)}
                                          className="w-full text-left px-3 py-1.5 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                        >
                                          <DocumentDuplicateIcon className="w-3.5 h-3.5 text-purple-500" /> Copy
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDeleteReport(report)}
                                        className="w-full text-left px-3 py-1.5 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-red-600 dark:text-red-400"
                                      >
                                        <TrashIcon className="w-3.5 h-3.5" /> Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Category & Description */}
                            <div>
                              {selectedCategoryFilter === 'all' && (
                                <span className={`inline-block px-2.5 py-0.5 text-[10px] font-semibold rounded-md ${palette.bg} ${palette.text} border ${palette.border} truncate max-w-full whitespace-nowrap mb-1.5`}>
                                  {report.categoryName}
                                </span>
                              )}
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                {report.description}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                            <span>{getFormattedDateString(report.modifiedDate)}</span>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleSelectReport(report, report.categoryName)}
                                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-[11px] font-medium"
                                title="View Report"
                              >
                                <EyeIcon className="w-3.5 h-3.5 text-indigo-600" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleOpenDrawer(report, report.categoryName, 'export', e)}
                                className="p-1 rounded-lg text-slate-400 hover:text-green-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-[11px] font-medium"
                                title="Export Report"
                              >
                                <ArrowDownTrayIcon className="w-3.5 h-3.5 text-green-600" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleOpenDrawer(report, report.categoryName, 'schedule', e)}
                                className="p-1 rounded-lg text-slate-400 hover:text-[#FF4800] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-[11px] font-medium"
                                title="Create a time based Schedule Report"
                              >
                                <ClockIcon className="w-3.5 h-3.5 text-[#FF4800]" />
                              </button>
                              {report.canDelete && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteReport(report, e)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-[11px] font-medium"
                                  title="Delete Report"
                                >
                                  <TrashIcon className="w-3.5 h-3.5 text-red-600" />
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  /* TABLE VIEW */
                  <div className="bg-white dark:bg-[#181c2c] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse table-fixed">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/60 dark:bg-slate-900/60 select-none">
                          <th className={`py-3 px-3.5 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors ${selectedCategoryFilter === 'all' ? 'w-[32%]' : 'w-[42%]'}`} onClick={() => handleSort('name')}>
                            <div className="flex items-center gap-1">
                              <span>Report Name</span>
                              {sortColumn === 'name' ? (
                                <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                              )}
                            </div>
                          </th>
                          {selectedCategoryFilter === 'all' && (
                            <th className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors w-[18%]" onClick={() => handleSort('categoryName')}>
                              <div className="flex items-center gap-1">
                                <span>Collection</span>
                                {sortColumn === 'categoryName' ? (
                                  <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                                )}
                              </div>
                            </th>
                          )}
                          <th className={`py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors ${selectedCategoryFilter === 'all' ? 'w-[24%]' : 'w-[32%]'}`} onClick={() => handleSort('description')}>
                            <div className="flex items-center gap-1">
                              <span>Description</span>
                              {sortColumn === 'description' ? (
                                <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                              )}
                            </div>
                          </th>
                          <th className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors w-[16%]" onClick={() => handleSort('modifiedDate')}>
                            <div className="flex items-center gap-1">
                              <span>Last Modified</span>
                              {sortColumn === 'modifiedDate' ? (
                                <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                              )}
                            </div>
                          </th>
                          <th className="py-3 px-3 text-right w-[10%]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {displayReports.map(report => {
                          const isStarred = starredReports.includes(report.id);
                          const palette = getCategoryPalette(report.categoryName);
                          const isDrawerActive = drawerOpen && drawerReport?.id === report.id;
                          return (
                            <tr
                              key={report.id}
                              onClick={() => handleSelectReport(report, report.categoryName)}
                              className={`transition-colors cursor-pointer group ${
                                isDrawerActive
                                  ? 'bg-slate-100/90 dark:bg-slate-800/80 font-medium'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              <td className="py-3 px-3.5 font-semibold text-slate-900 dark:text-white overflow-hidden">
                                <div className="flex items-center gap-2 min-w-0">
                                  <DocumentIcon className={`w-4 h-4 ${palette.iconColor} shrink-0`} />
                                  <span className="truncate block" title={report.name}>{report.name}</span>
                                </div>
                              </td>
                              {selectedCategoryFilter === 'all' && (
                                <td className="py-3 px-3 overflow-hidden">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold truncate max-w-full shadow-2xs ${palette.bg} ${palette.text} border ${palette.border}`} title={report.categoryName}>
                                    <span className="truncate">{report.categoryName}</span>
                                  </span>
                                </td>
                              )}
                              <td className="py-3 px-3 text-slate-500 overflow-hidden align-middle">
                                {report.description ? (
                                  <span
                                    className="block leading-snug break-words"
                                    style={{
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                    title={report.description}
                                  >
                                    {report.description}
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-3 px-3 text-slate-500 font-medium overflow-hidden whitespace-nowrap text-[11px] align-middle" title={getFormattedDateString(report.modifiedDate)}>
                                {getFormattedDateString(report.modifiedDate)}
                              </td>
                              <td className="py-3 px-3 text-right whitespace-nowrap align-middle">
                                <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleSelectReport(report, report.categoryName)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    title="View Report"
                                  >
                                    <EyeIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => handleOpenDrawer(report, report.categoryName, 'export', e)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-green-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    title="Export Report"
                                  >
                                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => handleOpenDrawer(report, report.categoryName, 'schedule', e)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-[#FF4800] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    title="Create a time based Schedule Report"
                                  >
                                    <ClockIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => toggleStar(report.id, e)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    title={isStarred ? "Remove Star" : "Star Report"}
                                  >
                                    {isStarred ? <StarIconSolid className="w-3.5 h-3.5 text-amber-400" /> : <StarIconOutline className="w-3.5 h-3.5" />}
                                  </button>
                                  {canCopyReports && (
                                    <button
                                      onClick={() => handleOpenCopyModal(report, report.categoryName)}
                                      className="p-1 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                      title="Copy Report"
                                    >
                                      <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {report.canDelete && (
                                    <button
                                      onClick={(e) => handleDeleteReport(report, e)}
                                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                      title="Delete Report"
                                    >
                                      <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Edit Report Dialog (replaces the old Copy modal) */}
      <QuickEditDialog
        isOpen={quickEditOpen}
        onClose={() => setQuickEditOpen(false)}
        source={quickEditSource}
        targetCategory={(authService.getUser()?.user || authService.getUser())?.email || ''}
        onSaved={handleQuickEditSaved}
        onOpenFullDesigner={handleOpenFullDesignerFromQuickEdit}
      />
      {/* Quick Create (build-from-shared-dataset) wizard */}
      <QuickCreateDialog
        isOpen={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        targetCategory={(authService.getUser()?.user || authService.getUser())?.email || ''}
        onCreated={handleQuickCreateCreated}
      />
      {/* Report-Centric Scheduling Action Drawer */}
      <ReportScheduleDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        report={drawerReport}
        mode={drawerInitialTab}
        onScheduleSaved={handleScheduleSaved}
      />

      {/* Success Notification Popup */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-[100001] max-w-md bg-white dark:bg-[#181c2c] border border-emerald-500/30 rounded-2xl shadow-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircleIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">{successToast.title}</h4>
            <p className="text-[11px] text-[#FF4800] font-semibold truncate mt-0.5">{successToast.name}</p>
            {successToast.summary && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                {successToast.summary}
              </p>
            )}
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
