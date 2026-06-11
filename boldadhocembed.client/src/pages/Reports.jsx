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
} from '@heroicons/react/24/outline';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { reportsAPI } from '../services/apiService';
import { useData } from '../context/DataContext';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [viewerSettings, setViewerSettings] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerKey, setViewerKey] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isResizingRef = useRef(false);
  const mainRef = useRef(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  const viewerDivRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const treeViewData = useMemo(() => {
    const categories = Array.isArray(tree) ? tree : [];
    const term = debouncedSearchTerm.toLowerCase().trim();

    return categories
      .map(cat => {
        const catName = String(cat.Name || cat.name || 'Uncategorized').trim();
        const reports = (cat.Reports || cat.reports || []).filter(r => {
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
      .filter(node => node.subChild.length > 0 || !debouncedSearchTerm);
  }, [tree, debouncedSearchTerm, expandedCategories]);

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
    if (window.innerWidth < 1024) setReportsSidebarCollapsed(true);
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
        <div className="rich-card flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[var(--brand-100)] transition-colors group">
          <div className="flex items-center gap-3">
            <FolderIcon className="w-5 h-5 text-[var(--accent)] flex-shrink-0" />
            <span className="font-medium text-sm text-[var(--text-strong)] truncate max-w-[180px]">
              {data.text}
            </span>
          </div>
          <span className="text-xs font-medium text-[var(--text-muted)] bg-[var(--neutral-100)] px-2.5 py-1 rounded-full group-hover:bg-[var(--neutral-200)] transition-colors">
            {data.reportCount}
          </span>
        </div>
      );
    }

    return (
      <div
        className="rich-card flex flex-col py-2 px-3 rounded-lg hover:bg-[var(--brand-100)] transition-colors group cursor-pointer"
        title={data.description}
        onClick={(e) => { if (onReportClick) onReportClick(data.reportRef, data.categoryName); }}
      >
        <div className="flex items-center gap-3 mb-1">
          <DocumentIcon className="w-5 h-5 text-[var(--info)] flex-shrink-0" />
          <span className="font-medium text-sm text-[var(--text-strong)] truncate max-w-[160px]">
            {data.text}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">

            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditReport(data.text, data.categoryName);
              }}
              className="p-1 hover:text-[var(--accent)] transition-colors"
              title="Edit report"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteReport(data.reportRef, data.categoryName); }}
              className="p-1 hover:text-[var(--danger)] transition-colors"
              title="Delete report"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handlePreviewReport(data.reportRef, data.categoryName); }}
              className="p-1 hover:text-[var(--info)] transition-colors"
              title="Preview report"
            >
              <EyeIcon className="w-4 h-4" />
            </button>
          </div>
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
        width: '100%'
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
        </div>

        {!reportsSidebarCollapsed && (
          <div
            className="sidebar-resizer"
            onMouseDown={(e) => { isResizingRef.current = true; document.body.style.cursor = 'col-resize'; e.preventDefault(); }}
            onTouchStart={(e) => { isResizingRef.current = true; document.body.style.cursor = 'col-resize'; e.preventDefault(); }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
          />
        )}

        {/* Viewer / Placeholder */}
        <div className="reports-view">

          {selectedReport && reportPath ? (
            <>
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
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}