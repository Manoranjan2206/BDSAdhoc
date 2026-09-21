/* eslint-disable */
import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { reportsAPI } from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { usePermissions } from '../hooks/usePermissions';

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
    const { currentUser, canEditReports, canCopyReports } = usePermissions();
    const canAccess = canEditReports || canCopyReports;

    useEffect(() => {
        if (currentUser && !canAccess) {
            navigate('/reports');
        }
    }, [currentUser, canAccess, navigate]);

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

        return () => {
            window.currentItem = null;
        };
    }, []);

    const isClone = useMemo(() => {
        const q = new URLSearchParams(window.location.search);
        return q.get('mode') === 'clone' || q.get('mode') === 'copy' || q.get('isCopy') === 'true';
    }, []);

    const currentItem = useMemo(() => {
        const q = new URLSearchParams(window.location.search);
        const urlName = q.get('name');
        const urlCategory = q.get('category');
        const urlDesc = q.get('desc');
        const isCloning = q.get('mode') === 'clone' || q.get('mode') === 'copy' || q.get('isCopy') === 'true';

        // When creating a new report, clear window.currentItem and return null
        if (!urlName && !urlCategory && !isCloning) {
            window.currentItem = null;
            return null;
        }

        return { 
            Name: urlName || '', 
            displayName: urlName || '', 
            CategoryName: urlCategory || 'Analytics Reports', 
            Description: urlDesc || '' 
        };
    }, []);

    useEffect(() => {
        const q = new URLSearchParams(window.location.search);
        const hasName = !!q.get('name');
        const isCloning = q.get('mode') === 'clone' || q.get('mode') === 'copy' || q.get('isCopy') === 'true';

        if (isCloning) {
            setIsEdit(false);
        } else if (hasName) {
            setIsEdit(true);
        } else {
            // Brand new report!
            window.currentItem = null;
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
        const sourceName = q.get('source');
        const urlName = q.get('name');
        const urlCategory = q.get('category') || '';

        if (isClone && sourceName) {
            setIsEdit(false);
            openServerReport(sourceName, urlCategory);
            if (urlName) {
                window.currentItem = {
                    ...(window.currentItem || {}),
                    Name: urlName,
                    displayName: urlName,
                    CategoryName: 'Analytics Reports',
                    Description: q.get('description') || '',
                };
            }
        } else if (urlName) {
            setIsEdit(true);
            openServerReport(urlName, urlCategory);
        } else {
            // BRAND NEW REPORT - clear any stale data and create untitled canvas
            window.currentItem = null;
            setIsEdit(false);
            newUntitledReport();
        }
    };

    const reportOpened = (args) => {
        setIsEdit(!isClone);
        const q = new URLSearchParams(window.location.search);
        const customName = q.get('name');
        if (args?.reportName) {
            const cleanName = String(args.reportName).replace('.rdl', '');
            document.title = (isClone && customName) ? customName : cleanName;
            if (isClone && customName) {
                window.currentItem = {
                    ...(window.currentItem || {}),
                    Name: customName,
                    CategoryName: 'Analytics Reports',
                };
            }
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
        try {
            if (window.currentItem?.Name) {
                const tenantName = currentUser?.tenantName || currentUser?.tenant || '';
                const rawName = window.currentItem.displayName || window.currentItem.Name;
                const cleanName = (tenantName && rawName.startsWith(`${tenantName}_`))
                    ? rawName.substring(tenantName.length + 1)
                    : rawName;
                const serverName = (tenantName && !window.currentItem.Name.startsWith(`${tenantName}_`))
                    ? `${tenantName}_${window.currentItem.Name}`
                    : window.currentItem.Name;

                reportsAPI.registerReport({
                    reportName: cleanName,
                    serverReportName: serverName,
                    category: window.currentItem.CategoryName || 'Analytics Reports',
                    description: window.currentItem.Description || '',
                }).catch(err => console.warn('Failed to register report to tenant DB on reportSaved:', err));
            }
            notifyReportSaved();
        } catch (e) { }
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

    const CUSTOM_GROUPS = [
        'Sales Analytics',
        'Marketing & Finance Analytics',
        'Finance Analytics',
        'Marketing Analytics',
        'System & Operational Reports',
        'System Reports',
        'Other Analytics'
    ];

    const saveAsServer = (name, category) => {
        const designer = getDesigner();
        if (!designer) return;
        const targetCategory = 'Analytics Reports';
        let desc = (window.currentItem && window.currentItem.Description) || '';
        const userEmail = currentUser?.email || '';
        const tenantName = currentUser?.tenantName || currentUser?.tenant || '';

        // Clean user-facing display name
        const cleanName = (tenantName && name.startsWith(`${tenantName}_`))
            ? name.substring(tenantName.length + 1)
            : name;

        // Scoped name on Bold Reports Server so tenants never overwrite each other
        const serverReportName = (tenantName && !name.startsWith(`${tenantName}_`))
            ? `${tenantName}_${name}`
            : name;

        // Inject domain and user ownership tags
        if (tenantName && !desc.includes('[Tenant:')) {
            desc = `[Tenant: ${tenantName}] ${desc}`.trim();
        }
        if (userEmail && !desc.includes('[Owner:')) {
            desc = `[Owner: ${userEmail}] ${desc}`.trim();
        }

        window.currentItem = {
            ...(window.currentItem || {}),
            Name: serverReportName,
            displayName: cleanName,
            CategoryName: targetCategory,
            Description: desc,
        };
        designer.saveReport(`${targetCategory}/${serverReportName}`);

        // Register report in tenant PostgreSQL database
        reportsAPI.registerReport({
            reportName: cleanName,
            serverReportName: serverReportName,
            category: targetCategory,
            description: desc,
        }).catch(err => console.warn('Failed to register report to tenant DB:', err));
    };

    const openServerReport = (name, category) => {
        const designer = getDesigner();
        if (!designer || !name) return;
        const serverCat = (!category || CUSTOM_GROUPS.includes(category.trim())) ? 'Analytics Reports' : category.trim();
        window.currentItem = {
            ...(window.currentItem || {}),
            Name: name,
            CategoryName: serverCat,
            Description: (window.currentItem && window.currentItem.Description) || 'no desc',
        };
        const cleanName = name.trim();
        const reportPath = `/${serverCat}/${cleanName}`.replace(/\/{2,}/g, '/');
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
    const [dialogMode, setDialogMode] = useState('publish'); // 'publish' | 'publishAs'

    const openSaveDialog = (mode = 'publish') => {
        // Reset dialog state with custom name if in clone mode
        const q = new URLSearchParams(window.location.search);
        const customName = q.get('name');
        let seedName = (isClone && customName) ? customName : (!isEdit ? '' : (window.currentItem?.displayName || window.currentItem?.Name || ''));
        setPendingName(seedName || '');
        setPendingDescription((!isEdit && !isClone) ? '' : (window.currentItem?.Description || q.get('description') || ''));
        setDialogMode(mode);
        setShowDialog(true);
    };

    const confirmSave = () => {
        const name = (pendingName || '').trim();
        const category = 'Analytics Reports';
        if (!name) {
            alert('Report name is required.');
            return;
        }
        const designer = getDesigner();
        if (!designer) return;

        let finalDesc = pendingDescription || (window.currentItem?.Description ?? '');
        const userEmail = currentUser?.email || '';
        const tenantName = currentUser?.tenantName || currentUser?.tenant || '';

        // Inject domain and user ownership tags
        if (tenantName && !finalDesc.includes('[Tenant:')) {
            finalDesc = `[Tenant: ${tenantName}] ${finalDesc}`.trim();
        }
        if (userEmail && !finalDesc.includes('[Owner:')) {
            finalDesc = `[Owner: ${userEmail}] ${finalDesc}`.trim();
        }

        const serverReportName = (tenantName && !name.startsWith(`${tenantName}_`))
            ? `${tenantName}_${name}`
            : name;

        window.currentItem = {
            ...(window.currentItem || {}),
            Name: serverReportName,
            displayName: name,
            CategoryName: category,
            Description: finalDesc,
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
                        {isClone
                            ? (new URLSearchParams(window.location.search).get('name') || window.currentItem?.Name || 'Cloned Report')
                            : isEdit
                            ? (window.currentItem?.Name || 'Edit Report')
                            : 'New Report'}
                    </h2>
                    {isClone ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-50 text-purple-600 dark:bg-purple-950/40 rounded-full border border-purple-200/60 dark:border-purple-900/40">
                            Copy / Clone Mode
                        </span>
                    ) : isEdit ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-orange-50 text-[#FF4800] dark:bg-orange-950/40 rounded-full border border-orange-200/60 dark:border-orange-900/40">
                            Editing
                        </span>
                    ) : null}
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
                        {(isEdit && !isClone) ? 'Save Report' : 'Publish Report'}
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

                        <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>Description</label>
                        <textarea
                            value={pendingDescription}
                            onChange={(e) => setPendingDescription(e.target.value)}
                            placeholder="Optional description shown in the report tree"
                            rows={3}
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 18, resize: 'vertical', boxSizing: 'border-box' }}
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