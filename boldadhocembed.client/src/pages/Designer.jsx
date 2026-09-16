/* eslint-disable */
import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { reportsAPI } from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

// AdventureWorks dataset reference (server-side data source id).
// Used for auto-attaching a default shared dataset when the user clicks
// "New Data" — same behaviour as the MVC Design page.
const ADVENTUREWORKS_DATASOURCE_ID = '49463a51-c475-46eb-be52-8111fc0193ca';
const ADVENTUREWORKS_NAME = 'crmdata';

// Bold Reports designer permission for shared data sources.
// Admin → "Shared", User → "Shared" (per the MVC sample's permString).
function getPermissionForRole(role) {
    const r = (role || '').toLowerCase();
    return r === 'admin' ? 'Shared' : 'Shared';
}

export default function Designer() {
    const navigate = useNavigate();
    const { getViewerSettings, getReports } = useData();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEdit, setIsEdit] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    // currentUser (email used for defaulting category in Save-As)
    const currentUser = useMemo(() => {
        try { return authService.getUser()?.user || authService.getUser() || null; }
        catch { return null; }
    }, []);
    const permissionForDs = useMemo(() => {
        return getPermissionForRole(currentUser?.role);
    }, [currentUser?.role]);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                // Use shared DataContext so we don't dual-fetch with <Header/>.
                // DataProvider caches 'viewerSettings' globally; this call is
                // a no-op when the cache is already populated.
                const s = await getViewerSettings();
                if (s) setSettings(s);
            } catch (e) {
                console.error('Failed to load designer settings', e);
                setError('Failed to load settings');
            } finally {
                setLoading(false);
            }
        };
        load();
        // getViewerSettings from DataContext has stable identity per state,
        // but to avoid re-firing on every render we only depend on mount.

    }, []);

    const currentItem = useMemo(() => {
        const q = new URLSearchParams(window.location.search);
        const urlName = q.get('name');
        const urlCategory = q.get('category');
        const urlDesc = q.get('desc');

        const name = urlName || (window.currentItem && window.currentItem.Name);
        const category = urlCategory || (window.currentItem && window.currentItem.CategoryName);
        const description = urlDesc || (window.currentItem && window.currentItem.Description) || 'New report';

        if (!name && !category) return null;
        return { Name: name || 'Untitled', CategoryName: category || '', Description: description };
    }, []);

    useEffect(() => {
        if (currentItem) {
            window.currentItem = currentItem;
            setIsEdit(!!currentItem.Name);
        } else if (window.currentItem) {
            setIsEdit(!!window.currentItem.Name);
        } else {
            setIsEdit(false);
        }
    }, [currentItem]);

    // windowUnload guard (mirrors MVC formSubmit + windowUnload).
    // Warns the user before navigating away / closing the tab if there
    // are unsaved changes in the designer.
    useEffect(() => {
        const handler = (e) => {
            if (!hasChanges) return;
            e.preventDefault();
            e.returnValue = ''; // Chromium requires a non-empty value
            return 'Changes you made may not be saved';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [hasChanges]);

    const designerServiceUrl = useMemo(() => {
        if (!settings) return '';
        if (settings.reportRootUrl) {
            return `${settings.reportRootUrl}/reportservice/api/Designer`;
        }
        const viewer = settings.serviceUrl || '';
        return viewer.endsWith('/Viewer') ? viewer.slice(0, -7) + '/Designer' : viewer.replace('Viewer', 'Designer');
    }, [settings]);

    // The Bold Reports designer widget accepts `embedToken` and forwards it
    // verbatim into both the `authorization` and `embedToken` request
    // headers. Strip any prefix the upstream may have accidentally added
    // so the widget doesn't end up sending
    // "Authorization: Bearer Bearer eyJ…" (which the Reports site rejects
    // with 401). Mirrors the strip-and-set pattern used by Reports.jsx
    // viewer for the same reason.
    const embedToken = useMemo(() => {
        const raw = settings?.token || null;
        if (!raw) return null;
        return String(raw).replace(/^Bearer\s+/i, '').trim() || null;
    }, [settings?.token]);

    const getDesigner = () => {
        try {
            const $ = window.$ || window.jQuery;
            if ($) {
                const inst = $('#reportdesigner-container').data('boldReportDesigner');
                return inst || null;
            }
        } catch { }
        return null;
    };

    const controlInitialized = () => {
        const designer = getDesigner();
        if (!designer) return;
        designer.showImportData = true;

        // Auto-attach AdventureWorks data source on "New Data" click,
        // matching the MVC Design page behaviour.
        if (designer.model) {
            designer.model.newDataClick = function (args) {
                try { args.cancel = true; } catch (e) { }
                try {
                    const dataSources = designer.getDataSources() || [];
                    const existing = dataSources.find(ds => ds.Name === ADVENTUREWORKS_NAME);
                    if (!existing) {
                        const newDs = {
                            __type: 'BoldReports.RDL.DOM.DataSource',
                            Name: ADVENTUREWORKS_NAME,
                            Transaction: false,
                            SecurityType: 'None',
                            DataSourceReference: ADVENTUREWORKS_DATASOURCE_ID,
                            ConnectionProperties: null,
                        };
                        designer.addDataSource(newDs);
                    }
                    const updated = designer.getDataSources() || [];
                    const dataSetInst = designer.getInstance && designer.getInstance('DataSet');
                    if (dataSetInst) {
                        if (typeof dataSetInst.clearSelection === 'function') {
                            dataSetInst.clearSelection();
                        }
                        if (typeof dataSetInst.datasourceSelection === 'function') {
                            dataSetInst.datasourceSelection(ADVENTUREWORKS_NAME, updated);
                        }
                    }
                } catch (e) {
                    console.warn('AdventureWorks auto-attach failed', e);
                }
            };
        }

        const q = new URLSearchParams(window.location.search);
        const urlName = q.get('name') || (window.currentItem && window.currentItem.Name);
        const urlCategory = q.get('category') || (window.currentItem && window.currentItem.CategoryName) || '';

        if (urlName) {
            setIsEdit(true);
            openServerReport(urlName, urlCategory);
        } else {
            setIsEdit(false);
            newUntitledReport();
        }
    };

    const reportOpened = (args) => {
        setIsEdit(true);
        if (args?.reportName) {
            document.title = String(args.reportName).replace('.rdl', '');
        }
    };

    const reportModified = (args) => {
        try {
            const $ = window.$ || window.jQuery;
            if ($) {
                const spanId = 'reportdesigner-container_status_span';
                if (args?.isModified) {
                    $('#' + spanId).text('Unsaved Changes.');
                } else {
                    $('#' + spanId).text('');
                }
            }
        } catch { }
        setHasChanges(!!args?.isModified);
    };

    const ajaxBeforeSend = (args) => {
        if (args && args.headers) {
            const currentUser = authService.getUser()?.user || authService.getUser();
            if (currentUser && currentUser.email) {
                args.headers.push({ Key: 'X-User-Email', Value: currentUser.email });
            }
            const currentUserId = currentUser?.id || currentUser?.userId;
            if (currentUserId) {
                args.headers.push({ Key: 'X-User-Id', Value: String(currentUserId) });
            }
        }
        if (
            args?.actionType === 'openServerReport' ||
            args?.actionType === 'saveServerReport' ||
            args?.actionType === 'createServerReport'
        ) {
            const item = window.currentItem || {};
            args.data = {
                category: item.CategoryName,
                reportName: item.Name,
                description: item.Description,
                isEdit: isEdit,
            };
        }
    };

    const saveReport = () => {
        if (isSaving) return;
        const designer = getDesigner();
        if (!designer) return;
        if (designer.isNewServerReport()) designer.saveReport(window.currentItem?.Name || 'Untitled');
        else designer.saveReport();
    };

    const reportSaved = () => {
        setIsEdit(true);
        setIsSaving(false);
        setHasChanges(false);
        try { notifyReportSaved(); } catch (e) { }
    };

    const notifyReportSaved = () => {
        try {
            window.dispatchEvent(new CustomEvent('reports:changed'));
        } catch (e) { }
    };

    const newUntitledReport = () => {
        const designer = getDesigner();
        if (!designer) return;
        designer.newReport('Untitled');
    };

    const saveAsServer = (name, category) => {
        const designer = getDesigner();
        if (!designer) return;
        window.currentItem = {
            ...(window.currentItem || {}),
            Name: name,
            CategoryName: category,
            Description: (window.currentItem && window.currentItem.Description) || 'no desc',
        };
        designer.saveReport(`${category}/${name}`);
    };

    const openServerReport = (name, category) => {
        const designer = getDesigner();
        if (!designer || !name) return;
        window.currentItem = {
            ...(window.currentItem || {}),
            Name: name,
            CategoryName: category || '',
            Description: (window.currentItem && window.currentItem.Description) || 'no desc',
        };
        const cleanName = name.trim();
        const cleanCat = category ? category.trim() : '';
        const reportPath = cleanCat
            ? `/${cleanCat}/${cleanName}`.replace(/\/{2,}/g, '/')
            : (cleanName.startsWith('/') ? cleanName : `/${cleanName}`);
        console.log('[openServerReport] Opening report path:', reportPath);
        designer.openReport(reportPath);
    };

    const browseReport = (browseType) => {
        const designer = getDesigner();
        if (!designer) return;
        designer.showOpenSaveReportDialog(browseType, function (args) {
            if (args['type'] === 'Open') openServerReport(args.name, args.category);
            else if (args['type'] === 'Save') saveAsServer(args.name, args.category);
        });
    };

    const openMenuClick = (args) => {
        switch (args.select) {
            case 'Device':
                browseFromClient();
                args.cancel = true;
                break;
            case 'Server':
                browseReport(ej.ReportDesigner.BrowseType.Open);
                args.cancel = true;
                break;
        }
    };

    const saveMenuClick = (args) => {
        switch (args.select) {
            case 'Save':
                if (isSaving) { args.cancel = true; return; }
                saveReport();
                args.cancel = true;
                break;
            case 'SaveAsDisk':
                if (isSaving) { args.cancel = true; return; }
                downloadReport();
                args.cancel = true;
                break;
            case 'SaveAsServer':
                if (isSaving) { args.cancel = true; return; }
                browseReport(ej.ReportDesigner.BrowseType.Save);
                args.cancel = true;
                break;
        }
    };

    const browseFromClient = () => {
        const designer = getDesigner();
        if (!designer) return;
        designer.openReportFromDevice();
    };

    const downloadReport = () => {
        const designer = getDesigner();
        if (!designer) return;
        designer.saveToDevice();
    };

    function toolbarClick(args) {
        if (args.click === 'Save') {
            args.cancel = true;
            if (isSaving) return;
            const designer = getDesigner();
            if (!designer) return;
            if (isEdit) designer.saveReport();
            else openSaveDialog();
        }
    }

    // In-flight guard for the Publish/Save custom button. Resets when the
    // designer signals the save completed (reportSaved / publish dialog
    // close). Without this, a single user click can trigger two POSTs in
    // succession because Bold Reports' internal Save lifecycle can re-enter
    // after our explicit designer.saveReport() call.
    const handlePublishClick = () => {

        console.log('[publish-click] invoked. isSaving=', isSaving, 'isEdit=', isEdit);
        if (isSaving) {

            console.log('[publish-click] BLOCKED — already saving');
            return;
        }
        const designer = getDesigner();
        if (!designer) {

            console.log('[publish-click] BLOCKED — designer not ready');
            return;
        }
        if (isEdit) {
            // Editing an existing report — fast path, no dialog
            setIsSaving(true);
            try { designer.saveReport(); } finally {
                setTimeout(() => setIsSaving(false), 1500);
            }
        } else {
            // New report — open the React Save-As dialog (replaces the
            // legacy designer.openPublishDialog flow).
            openSaveDialog('publish');
        }
    };

    // Always opens the dialog (mirrors MVC #btn-item-publish-as).
    const handlePublishAsClick = () => {
        if (isSaving) return;
        openSaveDialog('publishAs');
    };

    const [showDialog, setShowDialog] = useState(false);
    const [pendingName, setPendingName] = useState('');
    const [pendingDescription, setPendingDescription] = useState('');
    const [pendingCategory, setPendingCategory] = useState('');
    const [pendingTags, setPendingTags] = useState('');
    const [availableCategories, setAvailableCategories] = useState([]);
    const [dialogMode, setDialogMode] = useState('publish'); // 'publish' | 'publishAs'

    // Fetch the report tree once to derive a category list for the Save-As
    // dialog (mirrors MVC's populateCatagories + /api/Report/GetCatagories).
    // We do NOT remove this state when navigating — the user can reopen the
    // dialog and the dropdown is still populated.
    const refreshCategories = async () => {
        try {
            const tree = await getReports();
            if (Array.isArray(tree)) {
                const names = Array.from(new Set(
                    tree
                        .map(c => c.Name || c.name)
                        .filter(n => n && n.toLowerCase() !== 'master')
                ));
                setAvailableCategories(names);
            }
        } catch (e) {
            console.warn('Failed to load categories for designer dialog', e);
        }
    };

    const openSaveDialog = (mode = 'publish') => {
        // Reset dialog state with sensible defaults
        const seedName = window.currentItem?.Name || '';
        setPendingName(seedName || '');
        setPendingDescription(window.currentItem?.Description || '');
        setPendingCategory(window.currentItem?.CategoryName || '');
        setPendingTags('');
        setDialogMode(mode);
        setShowDialog(true);
        // Refresh category list in the background
        refreshCategories();
    };

    const confirmSave = () => {
        const name = (pendingName || '').trim();
        const category = (pendingCategory || '').trim() || currentUser?.email || '';
        if (!name || !category) {
            alert('Report name and category are required.');
            return;
        }
        const designer = getDesigner();
        if (!designer) return;

        // Persist the new description + tags back onto window.currentItem
        // so the next ajaxBeforeSend picks them up. This mirrors the
        // publishDialog args.name/category/description call in MVC's
        // saveAsServer.
        window.currentItem = {
            ...(window.currentItem || {}),
            Name: name,
            CategoryName: category,
            Description: pendingDescription || (window.currentItem?.Description ?? 'no desc'),
        };

        if (isSaving) return;
        setIsSaving(true);
        try {
            saveAsServer(name, category);
        } finally {
            setTimeout(() => setIsSaving(false), 1500);
        }
        setShowDialog(false);
        // note: reportSaved event will be dispatched by the designer once
        // the server save completes; that will reset isEditing/hasChanges.
    };

    if (loading) return (
        <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
            <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#FF4800', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Loading Report Designer…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (error) return (
        <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
            <p style={{ fontSize: 14, color: '#b91c1c', fontWeight: 500 }}>{error}</p>
            <button style={{ padding: '8px 16px', background: '#FF4800', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
                onClick={() => navigate('/reports')}>
                Back to Reports
            </button>
        </div>
    );

    if (!settings) return null;

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-slate-50 dark:bg-[#111422]">
            {/* Sleek, Compact Sub-Header */}
            <div className="h-12 px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181c2c] flex items-center justify-between flex-shrink-0 z-20">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-slate-400">Reports /</span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {isEdit ? (window.currentItem?.Name || 'Edit Report') : 'New Report'}
                    </h2>
                    {isEdit && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-orange-50 text-[#FF4800] dark:bg-orange-950/40 rounded-full border border-orange-200/60 dark:border-orange-900/40">
                            Editing
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handlePublishAsClick}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        Publish As
                    </button>
                    <button
                        type="button"
                        onClick={handlePublishClick}
                        disabled={isSaving}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-[#FF4800] hover:bg-[#e03f00] rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isEdit ? 'Save Report' : 'Publish Report'}
                    </button>
                    <button
                        onClick={() => navigate('/reports')}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        ← Back to Reports
                    </button>
                </div>
            </div>

            {/* Designer Canvas Viewport */}
            <div className="flex-1 w-full relative overflow-hidden" style={{ height: 'calc(100vh - 112px)' }}>
                <BoldReportDesignerComponent
                    id="reportdesigner-container"
                    serviceUrl={designerServiceUrl}
                    reportServerUrl={settings.serverUrl}
                    embedToken={embedToken}
                    ajaxBeforeLoad={ajaxBeforeSend}
                    create={controlInitialized}
                    saveReportClick={saveMenuClick}
                    openReportClick={openMenuClick}
                    toolbarSettings={{
                        items:
                            window.ej?.ReportDesigner?.ToolbarItems?.All &
                            ~window.ej?.ReportDesigner?.ToolbarItems?.New,
                    }}
                    permissionSettings={{
                        dataSource: window.ej?.ReportDesigner?.Permission?.Shared,
                        dataset: window.ej?.ReportDesigner?.Permission?.All
                    }}
                    toolbarClick={toolbarClick}
                    reportModified={reportModified}
                    reportOpened={reportOpened}
                    reportSaved={reportSaved}
                    style={{ height: '100%', width: '100%' }}
                />
            </div>

            {showDialog && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                    <div style={{ width: 'min(480px, 92vw)', background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                                {dialogMode === 'publishAs' ? 'Publish As…' : 'Publish Report'}
                            </h3>
                            <button
                                type="button"
                                aria-label="Close"
                                onClick={() => setShowDialog(false)}
                                style={{ background: 'transparent', border: 'none', fontSize: 18, color: '#64748b', cursor: 'pointer', lineHeight: 1 }}
                            >×</button>
                        </div>

                        <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>Report Name<span style={{ color: '#dc2626' }}> *</span></label>
                        <input
                            type="text"
                            value={pendingName}
                            onChange={(e) => setPendingName(e.target.value)}
                            placeholder="Enter report name"
                            autoFocus
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }}
                        />

                        <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>Category<span style={{ color: '#dc2626' }}> *</span></label>
                        <select
                            value={pendingCategory}
                            onChange={(e) => setPendingCategory(e.target.value)}
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, marginBottom: 14, background: '#fff', boxSizing: 'border-box' }}
                        >
                            <option value="">Choose a category…</option>
                            {currentUser?.email ? (
                                <option value={currentUser.email}>{currentUser.email} (your workspace)</option>
                            ) : null}
                            {availableCategories.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>Description</label>
                        <textarea
                            value={pendingDescription}
                            onChange={(e) => setPendingDescription(e.target.value)}
                            placeholder="Optional description shown in the report tree"
                            rows={3}
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 14, resize: 'vertical', boxSizing: 'border-box' }}
                        />

                        <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>Tags <span style={{ fontWeight: 400, color: '#94a3b8' }}>(comma separated)</span></label>
                        <input
                            type="text"
                            value={pendingTags}
                            onChange={(e) => setPendingTags(e.target.value)}
                            placeholder="e.g. finance, monthly, kpi"
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 18, boxSizing: 'border-box' }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => setShowDialog(false)}
                                style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#475569' }}
                            >Cancel</button>
                            <button
                                type="button"
                                onClick={confirmSave}
                                disabled={isSaving}
                                style={{ padding: '8px 18px', background: '#FF4800', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: isSaving ? 0.6 : 1 }}
                            >{dialogMode === 'publishAs' ? 'Publish As' : 'Publish'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}