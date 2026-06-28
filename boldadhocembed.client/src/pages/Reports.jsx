import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  DocumentIcon,
  FolderIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { reportsAPI } from '../services/apiService';
import { useData } from '../context/DataContext';
import { authService } from '../services/authService';
// Replaced Syncfusion UI components with native React/HTML equivalents.
import { motion } from 'framer-motion';
import '../styles/reports.css';

export default function Reports() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getReports, reportsSidebarCollapsed, setReportsSidebarCollapsed } = useData();

  const [tree, setTree] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('default'); // default | shared | own
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [viewerSettings, setViewerSettings] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerKey, setViewerKey] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isResizingRef = useRef(false);
  const mainRef = useRef(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [activeMenu, setActiveMenu] = useState(null);

  const toggleMenu = (id) => {
    setActiveMenu(prev => (prev === id ? null : id));
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenu(null);
    };
    if (activeMenu) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [activeMenu]);

  const viewerDivRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const treeViewData = useMemo(() => {
    const categories = Array.isArray(tree) ? tree : [];
    const term = debouncedSearchTerm.toLowerCase().trim();

    const currentUser = authService.getUser()?.user || authService.getUser();
    const currentUserId = currentUser?.id || currentUser?.userId;
    console.log('[Reports Page] Current logged-in user ID:', currentUserId, 'User object:', currentUser);

    return categories
      .map(cat => {
        const catName = String(cat.Name || cat.name || 'Uncategorized').trim();
        const reports = (cat.Reports || cat.reports || []).filter(r => {
          // Tab filtering
          const isOwn = String(r.CreatedById || r.createdById) === String(currentUserId);
          const isPublic = r.IsPublic || r.isPublic;

          if (activeTab === 'default' && !isPublic) return false;
          if (activeTab === 'shared' && (isPublic || isOwn)) return false;
          if (activeTab === 'own' && !isOwn) return false;

          // Search term filtering
          if (!term) return true;
          const name = String(r.Name || r.name || '').toLowerCase();
          const desc = String(r.Description || r.description || '').toLowerCase();
          return name.includes(term) || desc.includes(term);
        }).map(r => ({
          id: `rep_${r.Id || r.id}`,
          text: String(r.Name || r.name || 'Untitled Report'),
          isReport: true,
          reportRef: r,
          categoryName: catName,
          description: r.Description || r.description || 'No description available',
          modifiedDate: r.ModifiedDate || r.modifiedDate || new Date().toISOString(),
        }));

        return {
          id: `cat_${cat.Id || cat.id}`,
          text: catName,
          expanded: expandedCategories.has(`cat_${cat.Id || cat.id}`),
          subChild: reports,
          reportCount: reports.length,
        };
      })
      .filter(node => node.subChild.length > 0);
  }, [tree, debouncedSearchTerm, expandedCategories, activeTab]);

  const treeFields = {
    dataSource: treeViewData,
    id: 'id',
    text: 'text',
    child: 'subChild',
  };

  useEffect(() => {
    fetchReports();
    fetchViewerSettings();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await getReports();
      const normalized = Array.isArray(data) ? data : [];
      console.log('[Reports Page] Loaded report tree from API:', normalized);
      setTree(normalized);
      // Auto-expand all categories on first load
      const initialExpanded = new Set(normalized.map(cat => `cat_${cat.Id || cat.id}`));
      setExpandedCategories(initialExpanded);
    } catch (err) {
      console.error('Failed to load reports:', err);
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

  // Resizer handlers: track pointer moves globally and update sidebar width
  useEffect(() => {
    const onMove = (e) => {
      if (!isResizingRef.current) return;
      const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
      if (!clientX || !mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      const newWidth = Math.max(180, Math.min(600, clientX - rect.left));
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
    setSelectedCategory(category || null);
    setViewerKey(prev => prev + 1);
    // Collapse folder tree sidebar when report renders
    setReportsSidebarCollapsed(true);
  };

  const handleEditReport = (reportName, category) => {
    const params = new URLSearchParams();
    if (reportName) params.set('name', reportName);
    if (category) params.set('category', category);
    navigate(`/designer?${params.toString()}`);
  };

  const handlePreviewReport = (report, category) => {
    handleSelectReport(report, category);
  };

  const handleDeleteReport = async (report, category) => {
    if (!report) return;
    if (!window.confirm(`Delete report "${report.Name || report.name}"?`)) return;
    try {
      await reportsAPI.deleteReport(report.Name || report.name, category || report.CategoryName || report.categoryName);
      // Refresh list by calling the data provider's getReports and updating local tree
      try {
        const data = await getReports();
        const normalized = Array.isArray(data) ? data : [];
        setTree(normalized);
        const initialExpanded = new Set(normalized.map(cat => `cat_${cat.Id || cat.id}`));
        setExpandedCategories(initialExpanded);
      } catch (e) {
        // fallback to full fetch
        await fetchReports();
      }
      // Clear viewer if deleted report was selected
      if (selectedReport && (selectedReport.Id === report.Id || selectedReport.Name === report.Name)) {
        setSelectedReport(null);
        setSelectedCategory(null);
      }
      alert('Report deleted');
    } catch (err) {
      console.error('Delete report failed:', err);
      alert('Failed to delete report.');
    }
  };

  

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return 'Recently';
    }
  };

  // Rich node template (now using native elements, no Tooltip component)
  const nodeTemplate = (data, onReportClick) => {
    if (!data.isReport) {
      return (
        <div 
          className="rich-card flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[var(--brand-100)] transition-colors group cursor-pointer"
          title={data.text}
        >
          <div className="flex items-center gap-3">
            <FolderIcon className="w-5 h-5 text-[var(--accent)] flex-shrink-0" />
            <span 
              className="font-medium text-sm text-[var(--text-strong)] truncate max-w-[180px]"
              title={data.text}
            >
              {data.text}
            </span>
          </div>
          <span className="text-xs font-medium text-[var(--text-muted)] bg-[var(--neutral-100)] px-2.5 py-1 rounded-full group-hover:bg-[var(--neutral-200)] transition-colors">
            {data.reportCount}
          </span>
        </div>
      );
    }

    const isSelected = selectedReport && (selectedReport.Id === data.reportRef?.Id || selectedReport.Id === data.reportRef?.id || selectedReport.Name === data.text || selectedReport.name === data.text);

    return (
      <div
        className={`rich-card flex items-center justify-between py-2 px-3 rounded-lg transition-colors group cursor-pointer relative ${
          isSelected 
            ? 'bg-[#E5F3FF] text-[#2563EB] border-l-[3px] border-[#2563EB] font-semibold dark:bg-[rgba(37,99,235,0.15)] dark:text-[#60A5FA] dark:border-l-[3px] dark:border-[#3B82F6]' 
            : 'bg-white dark:bg-transparent text-[#2D343D] dark:text-gray-300 hover:bg-[#F5F7FA] dark:hover:bg-slate-800/50'
        }`}
        title={data.description ? `${data.text}\n${data.description}` : data.text}
        onClick={(e) => { if (onReportClick) onReportClick(data.reportRef, data.categoryName); }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <DocumentIcon className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-[#2563EB] dark:text-[#60A5FA]' : 'text-[#6B7280] dark:text-gray-400'}`} />
          <span 
            className="font-medium text-sm truncate pr-2"
            title={data.text}
          >
            {data.text}
          </span>
        </div>

        {/* 3-dots Context Menu */}
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleMenu(data.id);
            }}
            className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--brand-200)]/30 dark:hover:bg-gray-700/50 transition-colors"
            title="Options"
          >
            <EllipsisVerticalIcon className="w-5 h-5" />
          </button>

          {activeMenu === data.id && (
            <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-[#181c2c] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(null);
                  handleEditReport(data.text, data.categoryName);
                }}
                className="w-full text-left px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] hover:bg-[var(--brand-100)] dark:hover:bg-[#283a5e] flex items-center gap-2 transition-colors"
              >
                <PencilIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(null);
                  handlePreviewReport(data.reportRef, data.categoryName);
                }}
                className="w-full text-left px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] hover:bg-[var(--brand-100)] dark:hover:bg-[#283a5e] flex items-center gap-2 transition-colors"
              >
                <EyeIcon className="w-3.5 h-3.5 text-[var(--info)]" />
                Preview
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(null);
                  handleDeleteReport(data.reportRef, data.categoryName);
                }}
                className="w-full text-left px-3 py-1.5 text-xs font-medium text-[var(--danger)] hover:bg-[var(--brand-100)] dark:hover:bg-[#283a5e] flex items-center gap-2 transition-colors"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ────────────────────────────────────────────────
  //  REPORT PATH & VIEWER SETUP (your original logic preserved)
  // ────────────────────────────────────────────────

  const reportName = selectedReport?.Name || selectedReport?.name || null;
  const categoryName = selectedCategory ||
    selectedReport?.CategoryName ||
    selectedReport?.categoryName ||
    null;

  const reportPath = reportName
    ? categoryName
      ? `/${categoryName.trim()}/${reportName.trim()}`.replace(/\/{2,}/g, '/')
      : `/${reportName.trim()}`
    : null;

  const reportDescription = selectedReport?.Description || selectedReport?.description || 'No description available';

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
        groupIndex: 1,
        index: 1,
        type: 'Default',
        cssClass: 'e-icon',
        prefixIcon: 'e-mail e-viewer-icons',
        id: 'E-Mail',
        tooltip: { header: 'E-Mail', content: 'Send rendered report as mail attachment' },
      },
      {
        groupIndex: 4,
        index: 2,
        type: 'Default',
        cssClass: 'e-icons',
        prefixIcon: 'e-edit',
        id: 'EditIcon',
        tooltip: { header: 'Edit', content: 'Edit this report' },
      },
    ],
  }), []);

  const onToolBarItemClick = (args) => {
    if (args?.value === 'EditIcon') {
      handleEditReport(reportName, categoryName);
    }
  };

  // ────────────────────────────────────────────────
  //  VIEWER RENDERING LOGIC (React component preferred + jQuery fallback)
  // ────────────────────────────────────────────────

  // Check if React Viewer component is available
  const Viewer = typeof window !== 'undefined' && window.BoldReportViewerComponent
    ? window.BoldReportViewerComponent
    : null;

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

    // Clean up previous instance
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
        reportLoaded: () => console.log('Report loaded successfully'),
        ajaxRequestFailure: (args) => console.error('AJAX failure:', args),
        reportError: (args) => console.error('Report error:', args),
        serviceAuthorizationToken,
        locale: 'en-US',
        processingMode: 'Remote',
        height: '100%',
        width: '100%',
        isResponsive: true
      });

      console.log('jQuery viewer initialized with path:', reportPath);
    } catch (err) {
      console.error('Failed to initialize jQuery viewer:', err);
    }

    return () => {
      if ($(sel).data('boldReportViewer')) {
        try {
          $(sel).boldReportViewer('destroy');
        } catch (e) {}
      }
    };
  }, [viewerKey, reportPath, reportServiceUrl, reportServerUrl, serviceAuthorizationToken, toolbarSettings]);

  // Handle responsive layout calculations when folder tree sidebar collapses or expands
  useEffect(() => {
    const handleLayoutResize = () => {
      // Dispatch standard window resize event so the responsive layout updates
      window.dispatchEvent(new Event('resize'));

      // Programmatically trigger page fitting to container if available
      const $ = window.$ || window.jQuery;
      if ($) {
        const elem = viewerDivRef.current;
        if (elem) {
          const sel = `#${elem.id}`;
          const viewerObj = $(sel).data('boldReportViewer');
          if (viewerObj && typeof viewerObj.fitToPageWidth === 'function') {
            try {
              viewerObj.fitToPageWidth();
            } catch (e) {
              console.warn('Failed to call fitToPageWidth:', e);
            }
          }
        }
      }
    };

    // Trigger multiple times during and after the sidebar toggle animation
    const timers = [
      setTimeout(handleLayoutResize, 50),
      setTimeout(handleLayoutResize, 150),
      setTimeout(handleLayoutResize, 300),
      setTimeout(handleLayoutResize, 500)
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [reportsSidebarCollapsed, sidebarWidth]);

  return (
    <div className="reports-page font-inter">
      {/* Topbar */}
      <div className="reports-topbar">
        <div className="flex items-center gap-4">
          <h1 className="reports-topbar-title">Reports</h1>
          <p className="reports-topbar-sub">Browse, preview & manage your reports</p>
        </div>
        <Link to="/designer">
          <button className="e-primary modern-btn flex items-center gap-2">
            <PlusIcon className="w-5 h-5" />
            New Report
          </button>
        </Link>
      </div>

      <div className="reports-main" ref={mainRef}>
        {/* Sidebar */}
        <div
          className={`reports-sidebar ${reportsSidebarCollapsed ? 'collapsed' : ''}`}
          style={{ width: reportsSidebarCollapsed ? 0 : sidebarWidth }}
        >
          {/* Tab Filters */}
          {!reportsSidebarCollapsed && (
            <div className="px-4 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700 flex gap-1 bg-gray-50 dark:bg-gray-900/50">
              <button
                onClick={() => setActiveTab('default')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'default'
                    ? 'bg-[#E5F3FF] text-[#2563EB] dark:bg-[rgba(37,99,235,0.15)] dark:text-[#60A5FA] shadow-sm'
                    : 'text-[#6B7280] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                Public
              </button>
              <button
                onClick={() => setActiveTab('shared')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'shared'
                    ? 'bg-[#E5F3FF] text-[#2563EB] dark:bg-[rgba(37,99,235,0.15)] dark:text-[#60A5FA] shadow-sm'
                    : 'text-[#6B7280] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                Shared
              </button>
              <button
                onClick={() => setActiveTab('own')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'own'
                    ? 'bg-[#E5F3FF] text-[#2563EB] dark:bg-[rgba(37,99,235,0.15)] dark:text-[#60A5FA] shadow-sm'
                    : 'text-[#6B7280] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                Own
              </button>
            </div>
          )}

          {!reportsSidebarCollapsed && (
            <div className="reports-search">
              <input
                type="text"
                className="modern-input"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}

          {!reportsSidebarCollapsed && (
            <div className="reports-tree">
              {loading ? (
                <div className="reports-tree-loading">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)] mx-auto mb-3"></div>
                  <p>Loading reports...</p>
                </div>
              ) : treeViewData.length === 0 ? (
                <div className="reports-tree-empty">
                  <DocumentIcon className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                  <p>No reports found</p>
                  {searchTerm && <p className="text-sm mt-1">Try a different keyword</p>}
                </div>
              ) : (
                <div className="modern-tree">
                  {treeViewData.map((node) => (
                    <div key={node.id} className="mb-2">
                      <div onClick={() => {
                        const newSet = new Set(expandedCategories);
                        if (newSet.has(node.id)) newSet.delete(node.id); else newSet.add(node.id);
                        setExpandedCategories(newSet);
                      }}>
                        {nodeTemplate(node)}
                      </div>

                      {expandedCategories.has(node.id) && node.subChild.map((child) => (
                        <div key={child.id} className="ml-4">
                          {nodeTemplate(child, handleSelectReport)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resizer hidden based on feedback */}

        {/* Viewer / Placeholder */}
        <div className="reports-view">
          {selectedReport && reportPath ? (
            <motion.div
              key={viewerKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="reports-viewer-container"
            >
              {viewerLoading ? (
                <div className="reports-viewer-loading">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                  <p>Loading viewer...</p>
                </div>
              ) : !viewerSettings ? (
                <div className="reports-viewer-error">
                  <p>Viewer configuration not loaded</p>
                  <p className="text-sm mt-2">Check console for errors</p>
                </div>
              ) : (
                <div
                  id={`reportviewer-${viewerKey}`}
                  ref={viewerDivRef}
                  style={{ height: '100%', width: '100%' }}
                />
              )}
            </motion.div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md text-center p-8 bg-white dark:bg-[#181c2c] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800"
              >
                <div className="w-16 h-16 bg-[var(--brand-100)] dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 text-[var(--brand-500)]">
                  <DocumentIcon className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-[var(--text-strong)]">Welcome to Reports Viewer</h2>
                <p className="text-sm text-[var(--text-muted)] mb-6">
                  Select a report from the sidebar to view, analyze, and export its data.
                </p>
                <div className="text-xs text-[var(--text-light)]">
                  Use search or categories to find a specific report.
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}