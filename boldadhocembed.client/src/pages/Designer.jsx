/* eslint-disable */
import React, { useEffect, useMemo, useState } from 'react';
import { reportsAPI } from '../services/apiService';

export default function Designer() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEdit, setIsEdit] = useState(false);

    // expose compat window variables (for provided snippet)
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
        // prefer explicit URL params, but fall back to window.currentItem if the host page
        // set it when opening the designer (single-page navigation / edit button flows).
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
        // only overwrite window.currentItem when we have one from URL or derived value.
        if (currentItem) {
            window.currentItem = currentItem;
            setIsEdit(!!currentItem.Name);
        } else if (window.currentItem) {
            // if an external caller already populated window.currentItem (edit button),
            // honor that and enable edit mode.
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
    // Notify other parts of the app that a report was saved so lists can refresh
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
                    // Attempt to close the publish dialog. Prefer the designer API if available,
                    // otherwise remove/hide the dialog and overlay from DOM as a fallback.
                    try {
                        const d = getDesigner();
                        if (d && typeof d.closePublishDialog === 'function') {
                            d.closePublishDialog();
                            return;
                        }
                    } catch (e) {
                        // ignore
                    }
                    setTimeout(() => {
                        try {
                            // Remove specific publish dialog(s)
                            const dlgSelectors = ['#reportdesigner-container_publish_report_dialog', '.e-dlg-container.e-publish', '.e-publish-dialog'];
                            dlgSelectors.forEach(sel => document.querySelectorAll(sel).forEach(n => n.remove()));

                            // Remove any overlay/backdrop elements that may block interaction
                            const overlaySelectors = ['.e-dlg-overlay', '.e-overlay', '.e-modal-overlay', '.modal-backdrop', '.ej-overlay'];
                            overlaySelectors.forEach(sel => document.querySelectorAll(sel).forEach(n => n.remove()));

                            // Remove any body-level classes that indicate a modal is open
                            ['e-popup-open', 'modal-open', 'dialog-open'].forEach(c => document.body.classList.remove(c));

                            // Restore pointer events and aria-hidden on the designer container
                            const designerRoot = document.getElementById('reportdesigner-container');
                            if (designerRoot) {
                                designerRoot.style.pointerEvents = '';
                                designerRoot.removeAttribute('aria-hidden');
                                // also clear inline pointer-events on immediate children
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
        // We observed the designer creates a publish dialog with id
        // `reportdesigner-container_publish_report_dialog` and container class
        // `e-dlg-container e-publish`. Move that specific dialog and its overlay
        // to document.body and force fixed centering so it appears in the viewport
        // center (avoids being clipped/offset by parent layout).
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
            } catch (e) {
                // ignore
            }
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

    if (loading) return <div style={{ padding: 16 }}>Loading designer…</div>;
    if (error) return <div style={{ padding: 16, color: '#b91c1c' }}>{error}</div>;
    if (!settings) return null;

    const rootStyle = { display: 'flex', flexDirection: 'column', height: '100%', width: '100%' };
    const toolbarStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #e5e7eb', background: '#fff' };
    const titleStyle = { margin: 0, fontSize: 18, fontWeight: 600, color: '#111827' };
    const actionsStyle = { display: 'flex', gap: 8 };
    const btnStyle = { padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' };
    const btnPrimaryStyle = { ...btnStyle, background: '#4f46e5', borderColor: '#4f46e5', color: '#fff' };
    const canvasStyle = { height: 'calc(100vh - 64px)', width: '100%' };

    return (
        <div style={rootStyle}>
            <div style={toolbarStyle}>
                <h2 style={titleStyle}>{isEdit ? 'Edit Report' : 'New Report'}</h2>
                <div style={actionsStyle}>
                    <button style={btnStyle} onClick={() => window.history.back()}>Back</button>
                    <button
                        style={btnPrimaryStyle}
                        onClick={() => {
                            const designer = getDesigner();
                            if (!designer) return;
                            if (isEdit) designer.saveReport(); else openSaveDialog();
                        }}
                    >
                        {isEdit ? 'Save' : 'Publish'}
                    </button>
                </div>
            </div>

            <div style={canvasStyle}>
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
                    <div style={{ width: 'min(420px, 90vw)', background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Save As</h3>
                        <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Report Name</label>
                        <input
                            type="text"
                            value={pendingName}
                            onChange={(e) => setPendingName(e.target.value)}
                            placeholder="Enter report name"
                            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', marginBottom: 12 }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button style={btnStyle} onClick={() => setShowDialog(false)}>Cancel</button>
                            <button style={btnPrimaryStyle} onClick={confirmSave}>Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}