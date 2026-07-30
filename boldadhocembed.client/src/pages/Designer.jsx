/* eslint-disable */
import React, { useEffect, useMemo, useState } from 'react';
import { reportsAPI } from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

export default function Designer() {
    const navigate = useNavigate();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEdit, setIsEdit] = useState(false);

    // expose compat window variables
    useEffect(() => {
        if (settings) {
            window.info = {
                ServiceUrl: settings.reportRootUrl
                    ? `${settings.reportRootUrl}/reportservice/api/Viewer`
                    : settings.serviceUrl,
                ServerUrl: settings.serverUrl,
                Token: settings.token,
            };
        }
    }, [settings]);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const s = await reportsAPI.getViewerSettings();
                setSettings(s);
            } catch (e) {
                console.error('Failed to load designer settings', e);
                setError('Failed to load settings');
            } finally {
                setLoading(false);
            }
        };
        load();
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

    const designerServiceUrl = useMemo(() => {
        if (!settings) return '';
        if (settings.reportRootUrl) {
            return `${settings.reportRootUrl}/reportservice/api/Designer`;
        }
        const viewer = settings.serviceUrl || '';
        return viewer.endsWith('/Viewer') ? viewer.slice(0, -7) + '/Designer' : viewer.replace('Viewer', 'Designer');
    }, [settings]);

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

        if (window.currentItem && isEdit) {
            openServerReport(window.currentItem.Name, window.currentItem.CategoryName);
        } else if (window.currentItem) {
            const hasDataset = !!window.currentItem.DatasetName;
            const hasCategory = !!window.currentItem.CategoryName;
            if (hasDataset) {
                designer.newServerReport(window.currentItem.Name, window.currentItem.DatasetName);
            } else if (hasCategory) {
                designer.newServerReport(window.currentItem.Name);
            } else {
                newUntitledReport();
            }
        } else {
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
        const designer = getDesigner();
        if (!designer) return;
        if (designer.isNewServerReport()) designer.saveReport(window.currentItem?.Name || 'Untitled');
        else designer.saveReport();
    };

    const reportSaved = () => {
        setIsEdit(true);
        try { notifyReportSaved(); } catch (e) {}
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
        if (!designer) return;
        window.currentItem = {
            ...(window.currentItem || {}),
            Name: name,
            CategoryName: category,
            Description: (window.currentItem && window.currentItem.Description) || 'no desc',
        };
        const reportPath = category ? `${category}/${name}` : name;
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
                saveReport();
                args.cancel = true;
                break;
            case 'SaveAsDisk':
                downloadReport();
                args.cancel = true;
                break;
            case 'SaveAsServer':
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
            const designer = getDesigner();
            if (!designer) return;
            if (isEdit) designer.saveReport();
            else openSaveDialog();
        }
    }

    const [showDialog, setShowDialog] = useState(false);
    const [pendingName, setPendingName] = useState('');

    const openSaveDialog = () => {
        const designer = getDesigner();
        if (!designer) return;
        const availableTags = [];
        const selectedTags = [];
        const description = window.currentItem?.Description || '';
        const reportName = window.currentItem?.Name || 'Untitled';
        const tagInfo = { tags: availableTags, selectedTags };

        designer.openPublishDialog(
            description,
            function (args) {
                if (args && args.type === 'Save') {
                    saveAsServer(args.name, args.category, args.categoryId, args.description, args.tags, args.callBackInfo);
                    try { notifyReportSaved(); } catch (e) {}
                    try {
                        const d = getDesigner();
                        if (d && typeof d.closePublishDialog === 'function') {
                            d.closePublishDialog();
                            return;
                        }
                    } catch (e) { }
                    setTimeout(() => {
                        try {
                            const dlgSelectors = ['#reportdesigner-container_publish_report_dialog', '.e-dlg-container.e-publish', '.e-publish-dialog'];
                            dlgSelectors.forEach(sel => document.querySelectorAll(sel).forEach(n => n.remove()));
                            const overlaySelectors = ['.e-dlg-overlay', '.e-overlay', '.e-modal-overlay', '.modal-backdrop', '.ej-overlay'];
                            overlaySelectors.forEach(sel => document.querySelectorAll(sel).forEach(n => n.remove()));
                            ['e-popup-open', 'modal-open', 'dialog-open'].forEach(c => document.body.classList.remove(c));
                            const designerRoot = document.getElementById('reportdesigner-container');
                            if (designerRoot) {
                                designerRoot.style.pointerEvents = '';
                                designerRoot.removeAttribute('aria-hidden');
                                designerRoot.querySelectorAll('*').forEach(el => { if (el && el.style) el.style.pointerEvents = ''; });
                            }
                        } catch (e) { }
                    }, 120);
                }
            },
            true,
            tagInfo,
            reportName
        );

        setTimeout(() => {
            try {
                const dlg = document.getElementById('reportdesigner-container_publish_report_dialog') || document.querySelector('.e-dlg-container.e-publish');
                const overlay = document.querySelector('.e-dlg-overlay');
                if (dlg) {
                    if (dlg.parentElement !== document.body) document.body.appendChild(dlg);
                    dlg.style.position = 'fixed';
                    dlg.style.left = '50%';
                    dlg.style.top = '50%';
                    dlg.style.transform = 'translate(-50%, -50%)';
                    dlg.style.margin = '0';
                    dlg.style.zIndex = '20000';
                }
                if (overlay) {
                    if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
                    overlay.style.position = 'fixed';
                    overlay.style.inset = '0';
                    overlay.style.zIndex = '19990';
                }
            } catch (e) { }
        }, 120);
    };

    const confirmSave = () => {
        const name = (pendingName || '').trim();
        if (!name) return;
        const designer = getDesigner();
        if (!designer) return;
        designer.saveReport(name);
        setShowDialog(false);
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
                        onClick={() => navigate('/reports')}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        ← Back to Reports
                    </button>
                    <button
                        onClick={() => {
                            const designer = getDesigner();
                            if (!designer) return;
                            if (isEdit) designer.saveReport(); else openSaveDialog();
                        }}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-[#FF4800] hover:bg-[#e03f00] rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                        {isEdit ? 'Save Report' : 'Publish Report'}
                    </button>
                </div>
            </div>

            {/* Designer Canvas Viewport */}
            <div className="flex-1 w-full relative overflow-hidden" style={{ height: 'calc(100vh - 112px)' }}>
                <BoldReportDesignerComponent
                    id="reportdesigner-container"
                    serviceUrl={designerServiceUrl}
                    reportServerUrl={settings.serverUrl}
                    serviceAuthorizationToken={settings.token && (String(settings.token).toLowerCase().startsWith('bearer ') ? settings.token : `Bearer ${settings.token}`)}
                    ajaxBeforeLoad={ajaxBeforeSend}
                    create={controlInitialized}
                    saveReportClick={saveMenuClick}
                    openReportClick={openMenuClick}
                    toolbarSettings={{
                        items:
                            ej.ReportDesigner.ToolbarItems.All &
                            ~ej.ReportDesigner.ToolbarItems.Save &
                            ~ej.ReportDesigner.ToolbarItems.Open &
                            ~ej.ReportDesigner.ToolbarItems.New,
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
                    <div style={{ width: 'min(420px, 90vw)', background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Save As</h3>
                        <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>Report Name</label>
                        <input
                            type="text"
                            value={pendingName}
                            onChange={(e) => setPendingName(e.target.value)}
                            placeholder="Enter report name"
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 16 }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }} onClick={() => setShowDialog(false)}>Cancel</button>
                            <button style={{ padding: '6px 16px', background: '#FF4800', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }} onClick={confirmSave}>Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}