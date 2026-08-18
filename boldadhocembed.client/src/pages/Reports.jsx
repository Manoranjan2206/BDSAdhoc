import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  DocumentIcon,
  FolderIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  StarIcon as StarIconOutline,
  Squares2X2Icon,
  ListBulletIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { useNavigate, useLocation } from 'react-router-dom';
import { reportsAPI } from '../services/apiService';
import { useData } from '../context/DataContext';
import { authService } from '../services/authService';
import { motion } from 'framer-motion';
import '../styles/reports.css';

// Cohesive vibrant color palettes for categories
const COLOR_PALETTES = [
  {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    iconBg: 'bg-emerald-100/70 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800/40',
    iconBg: 'bg-purple-100/70 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
    dot: 'bg-purple-500',
  },
  {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-400',
    border: 'border-sky-200 dark:border-sky-800/40',
    iconBg: 'bg-sky-100/70 dark:bg-sky-900/40',
    iconColor: 'text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-500',
  },
  {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/40',
    iconBg: 'bg-amber-100/70 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800/40',
    iconBg: 'bg-rose-100/70 dark:bg-rose-900/40',
    iconColor: 'text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-800/40',
    iconBg: 'bg-indigo-100/70 dark:bg-indigo-900/40',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    dot: 'bg-indigo-500',
  },
  {
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    text: 'text-teal-700 dark:text-teal-400',
    border: 'border-teal-200 dark:border-teal-800/40',
    iconBg: 'bg-teal-100/70 dark:bg-teal-900/40',
    iconColor: 'text-teal-600 dark:text-teal-400',
    dot: 'bg-teal-500',
  },
  {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800/40',
    iconBg: 'bg-orange-100/70 dark:bg-orange-900/40',
    iconColor: 'text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
];

const getCategoryPalette = (categoryName) => {
  if (!categoryName) return COLOR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index];
};

const DEFAULT_REPORT_TREE = [
  {
    Name: 'Sales & Pipeline',
    Reports: [
      { Id: 'rep-01', Name: 'Annual Sales Performance', Description: 'Complete 12-month revenue performance breakdown across regions and deal stages.', CreatedDate: '2026-08-01', ModifiedDate: '2026-08-15' },
      { Id: 'rep-02', Name: 'Regional Win Rate Analysis', Description: 'Comparison of deal win probabilities and pipeline velocity across North America, Europe, Asia, Oceania.', CreatedDate: '2026-08-05', ModifiedDate: '2026-08-16' },
      { Id: 'rep-03', Name: 'Deal Stage Velocity & Conversion', Description: 'Analysis of time spent in each pipeline stage from Prospecting to Closed Won.', CreatedDate: '2026-07-20', ModifiedDate: '2026-08-12' },
    ]
  },
  {
    Name: 'Operations & Support',
    Reports: [
      { Id: 'rep-04', Name: 'Support SLA & CSAT Compliance', Description: 'Customer support case resolution metrics, first-response time, and CSAT ratings.', CreatedDate: '2026-08-02', ModifiedDate: '2026-08-14' },
      { Id: 'rep-05', Name: 'Marketing Campaign Lead Generation ROI', Description: 'ROI, cost-per-lead, and attribution metrics for trade shows, webinars, and inbound campaigns.', CreatedDate: '2026-07-28', ModifiedDate: '2026-08-10' },
    ]
  },
  {
    Name: 'Executive & Finance',
    Reports: [
      { Id: 'rep-06', Name: 'Enterprise Revenue & Invoicing Summary', Description: 'Comprehensive financial reporting by tenant company, billing status, and regional tax brackets.', CreatedDate: '2026-08-10', ModifiedDate: '2026-08-17' },
      { Id: 'rep-07', Name: 'Multi-Tenant Row-Level Audit Log', Description: 'Security audit trail of user data actions and permission changes filtered by tenant schema.', CreatedDate: '2026-08-12', ModifiedDate: '2026-08-18' },
    ]
  }
];

export default function Reports() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getReports, reportsSidebarCollapsed, setReportsSidebarCollapsed } = useData();

  const [tree, setTree] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  
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
          description: r.Description || r.description || 'Standard enterprise analytics report',
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
  }, [allReports, selectedCategoryFilter, activeScope, starredReports, sortColumn, sortDirection]);

  useEffect(() => {
    fetchReports();
    fetchViewerSettings();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await getReports();
      const normalized = Array.isArray(data) && data.length > 0 ? data : DEFAULT_REPORT_TREE;
      setTree(normalized);
    } catch (err) {
      console.error('Failed to load reports:', err);
      setTree(DEFAULT_REPORT_TREE);
    } finally {
      setLoading(false);
    }
  };

  const fetchViewerSettings = async () => {
    setViewerLoading(true);
    try {
      const settings = await reportsAPI.getViewerSettings();
      setViewerSettings(settings);
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

  const handleEditReport = (reportName, category) => {
    const params = new URLSearchParams();
    if (reportName) params.set('name', reportName);
    if (category) params.set('category', category);
    navigate(`/designer?${params.toString()}`);
  };

  const handleDeleteReport = async (report, category) => {
    if (!report) return;
    if (!window.confirm(`Delete report "${report.name || report.Name}"?`)) return;
    try {
      await reportsAPI.deleteReport(report.name || report.Name, category || report.categoryName);
      fetchReports();
      if (selectedReport && (selectedReport.id === report.id || selectedReport.name === report.name)) {
        setSelectedReport(null);
        setSelectedCategory(null);
      }
    } catch (err) {
      console.error('Delete report failed:', err);
      alert('Failed to delete report.');
    }
  };

  // Viewer parameters
  const reportName = selectedReport?.name || selectedReport?.Name || null;
  const categoryName = selectedCategory || selectedReport?.categoryName || null;

  const reportPath = reportName
    ? categoryName
      ? `/${categoryName.trim()}/${reportName.trim()}`.replace(/\/{2,}/g, '/')
      : `/${reportName.trim()}`
    : null;

  const reportServiceUrl = viewerSettings?.serviceUrl ||
    import.meta.env.VITE_BOLD_REPORT_SERVICE_URL ||
    'https://demos.boldreports.com/services/api/ReportViewer';

  const reportServerUrl = viewerSettings?.serverUrl || 'https://demos.boldreports.com/reporting/api';

  const serviceAuthorizationToken = viewerSettings?.token
    ? viewerSettings.token.toLowerCase().startsWith('bearer ')
      ? viewerSettings.token
      : `Bearer ${viewerSettings.token}`
    : null;

  const toolbarSettings = useMemo(() => ({
    showToolbar: true,
    items: window.ej?.ReportViewer?.ToolbarItems?.All & ~window.ej?.ReportViewer?.ToolbarItems?.Print,
    customItems: [
      {
        groupIndex: 4,
        index: 2,
        type: 'Default',
        cssClass: 'e-icons',
        prefixIcon: 'e-edit',
        id: 'EditIcon',
        tooltip: { header: 'Edit', content: 'Edit this report in designer' },
      },
    ],
  }), []);

  const onToolBarItemClick = (args) => {
    if (args?.value === 'EditIcon') {
      handleEditReport(reportName, categoryName);
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
        toolbarSettings,
        toolBarItemClick: onToolBarItemClick,
        serviceAuthorizationToken,
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
  }, [viewerKey, reportPath, reportServiceUrl, reportServerUrl, serviceAuthorizationToken, toolbarSettings]);

  return (
    <div className="reports-page font-inter bg-slate-50 dark:bg-[#111422] h-full flex flex-col overflow-hidden">
      {/* Work Area (Sidebar + Content Workspace) */}
      <div className="reports-main flex-1 flex min-h-0 relative" ref={mainRef}>
        {/* Category Sidebar */}
        <div
          className={`bg-white dark:bg-[#181c2c] border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-200 z-10 ${
            reportsSidebarCollapsed ? 'w-0 overflow-hidden border-none' : ''
          }`}
          style={{ width: reportsSidebarCollapsed ? 0 : sidebarWidth }}
        >
          {!reportsSidebarCollapsed && (
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1">
                <span>Categories</span>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500 font-semibold">
                  {categoriesList.length}
                </span>
              </div>

              {/* All Categories Option */}
              <button
                onClick={() => setSelectedCategoryFilter('all')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FolderIcon className="w-4 h-4 text-indigo-500" /> All Categories
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
                      onClick={() => setSelectedCategoryFilter(cat.name)}
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
                    onClick={() => { setSelectedReport(null); setSelectedCategory(null); }}
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

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditReport(reportName, categoryName)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <PencilIcon className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setViewerKey(prev => prev + 1)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors"
                    title="Reload report"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                  </button>
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
                  </div>

                  {selectedCategoryFilter !== 'all' && (
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

                  <button
                    onClick={() => navigate('/designer')}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#FF4800] hover:bg-[#e03f00] rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    <PlusIcon className="w-4 h-4 stroke-[2.5]" />
                    New Report
                  </button>
                </div>
              </div>

              {/* Main Content List / Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                  <div className="h-64 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#FF4800] animate-spin mb-3" />
                    <p className="text-xs text-slate-500">Loading Reports...</p>
                  </div>
                ) : filteredReports.length === 0 ? (
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
                    {filteredReports.map(report => {
                      const isStarred = starredReports.includes(report.id);
                      const palette = getCategoryPalette(report.categoryName);
                      return (
                        <motion.div
                          key={report.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => handleSelectReport(report, report.categoryName)}
                          className="bg-white dark:bg-[#181c2c] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative hover:-translate-y-0.5"
                        >
                          <div className="space-y-2">
                            {/* Top row with Title and Star/Menu actions */}
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
                                      <button
                                        onClick={() => handleEditReport(report.name, report.categoryName)}
                                        className="w-full text-left px-3 py-1.5 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                      >
                                        <PencilIcon className="w-3.5 h-3.5 text-blue-500" /> Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteReport(report, report.categoryName)}
                                        className="w-full text-left px-3 py-1.5 font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
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
                              <span className={`inline-block px-2.5 py-0.5 text-[10px] font-semibold rounded-md ${palette.bg} ${palette.text} border ${palette.border} truncate max-w-full whitespace-nowrap`}>
                                {report.categoryName}
                              </span>
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                                {report.description}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                            <span>{getFormattedDateString(report.modifiedDate)}</span>
                            <span className="font-semibold text-[#FF4800] group-hover:underline">Open</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  /* TABLE VIEW */
                  <div className="bg-white dark:bg-[#181c2c] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse table-auto">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/60 dark:bg-slate-900/60 select-none">
                          <th className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors w-1/3 min-w-[200px]" onClick={() => handleSort('name')}>
                            <div className="flex items-center gap-1.5">
                              <span>Report Name</span>
                              {sortColumn === 'name' ? (
                                <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                              )}
                            </div>
                          </th>
                          <th className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors w-44 whitespace-nowrap" onClick={() => handleSort('categoryName')}>
                            <div className="flex items-center gap-1.5">
                              <span>Category</span>
                              {sortColumn === 'categoryName' ? (
                                <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                              )}
                            </div>
                          </th>
                          <th className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors w-1/3 max-w-sm" onClick={() => handleSort('description')}>
                            <div className="flex items-center gap-1.5">
                              <span>Description</span>
                              {sortColumn === 'description' ? (
                                <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                              )}
                            </div>
                          </th>
                          <th className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors w-36 whitespace-nowrap" onClick={() => handleSort('modifiedDate')}>
                            <div className="flex items-center gap-1.5">
                              <span>Last Modified</span>
                              {sortColumn === 'modifiedDate' ? (
                                <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                              )}
                            </div>
                          </th>
                          <th className="py-3.5 px-4 text-right w-28 whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {filteredReports.map(report => {
                          const isStarred = starredReports.includes(report.id);
                          const palette = getCategoryPalette(report.categoryName);
                          return (
                            <tr
                              key={report.id}
                              onClick={() => handleSelectReport(report, report.categoryName)}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                            >
                              <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-2.5">
                                  <DocumentIcon className={`w-4 h-4 ${palette.iconColor} shrink-0`} />
                                  <span className="truncate">{report.name}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 shadow-2xs ${palette.bg} ${palette.text} border ${palette.border}`}>
                                  {report.categoryName}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{report.description}</td>
                              <td className="py-3.5 px-4 text-slate-500 font-medium whitespace-nowrap">{getFormattedDateString(report.modifiedDate)}</td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => toggleStar(report.id, e)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    {isStarred ? <StarIconSolid className="w-4 h-4 text-amber-400" /> : <StarIconOutline className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => handleEditReport(report.name, report.categoryName)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    title="Edit"
                                  >
                                    <PencilIcon className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteReport(report, report.categoryName)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                    title="Delete"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
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
    </div>
  );
}
