import React, { useEffect, useMemo, useState } from 'react';
import {
    XMarkIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    BoltIcon,
} from '@heroicons/react/24/outline';
import { authService } from '../services/authService';
import { buildApiUrl } from '../utils/http';
import { FilterBuilder, SortBuilder } from './FilterSortBuilders';

/**
 * Quick Create Report wizard.
 *
 * A lightweight alternative to the full Bold Reports designer: the user
 * picks a shared dataset, ticks the columns they want, names the report,
 * and the backend generates a plain-tablix RDL bound to that dataset.
 *
 * Backend contract:
 *   GET  /api/reports/datasets                    -> [{ id, name }]
 *   GET  /api/reports/datasets/{id}/fields        -> { id, name, dataSourceId, columns: [{name, typeName}] }
 *   POST /api/reports/build                       -> { datasetId, reportName, description, columns: [name,...] }
 *                                                  -> { itemId, reportName, categoryName, serverPath }
 *
 * Props:
 *   isOpen:        boolean, dialog visibility
 *   onClose:       () => void
 *   onCreated:     (result) => void — receives { itemId, reportName, categoryName, serverPath }
 *   targetCategory?: string — defaults to "My Reports" (the caller usually pre-resolves this)
 */
export default function QuickCreateDialog({
    isOpen,
    onClose,
    onCreated,
    targetCategory = 'My Reports',
}) {
    const [step, setStep] = useState(1); // 1: pick dataset, 2: pick columns + name, 3: result
    const [datasets, setDatasets] = useState([]);
    const [datasetsLoading, setDatasetsLoading] = useState(false);
    const [selectedDatasetId, setSelectedDatasetId] = useState('');
    const [datasetDetail, setDatasetDetail] = useState(null);
    const [datasetDetailLoading, setDatasetDetailLoading] = useState(false);
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [reportName, setReportName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState(null);
    const [building, setBuilding] = useState(false);
    const [result, setResult] = useState(null);
    // Filter and sort state — applied to the new report's single Tablix.
    const [filters, setFilters] = useState([]);
    const [sorts, setSorts] = useState([]);

    // Reset when the dialog opens/closes.
    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setDatasets([]);
            setSelectedDatasetId('');
            setDatasetDetail(null);
            setSelectedColumns([]);
            setReportName('');
            setDescription('');
            setError(null);
            setBuilding(false);
            setResult(null);
            setFilters([]);
            setSorts([]);
            return;
        }
        // Open -> load dataset list immediately so step 1 is interactive.
        loadDatasets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const authHeader = () => {
        const token = authService.getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const unwrap = (res) => {
        if (res == null) return null;
        if (typeof res === 'object' && 'success' in res) {
            if (!res.success) throw new Error(res.message || res.error || 'Request failed');
            return res.data;
        }
        return res;
    };

    const loadDatasets = async () => {
        setDatasetsLoading(true);
        setError(null);
        try {
            const resp = await fetch(buildApiUrl('/reports/datasets'), {
                headers: { ...authHeader() },
            });
            if (!resp.ok) throw new Error(`Failed to load datasets (HTTP ${resp.status})`);
            const json = await resp.json();
            const list = unwrap(json) || [];
            setDatasets(Array.isArray(list) ? list : []);
        } catch (e) {
            setError(e?.message || 'Failed to load datasets');
            setDatasets([]);
        } finally {
            setDatasetsLoading(false);
        }
    };

    const loadDatasetDetail = async (id) => {
        if (!id) return;
        setDatasetDetailLoading(true);
        setDatasetDetail(null);
        setSelectedColumns([]);
        setError(null);
        try {
            const resp = await fetch(
                buildApiUrl(`/reports/datasets/${encodeURIComponent(id)}/fields`),
                { headers: { ...authHeader() } }
            );
            if (!resp.ok) {
                const t = await resp.text().catch(() => '');
                throw new Error(t || `Failed to load dataset fields (HTTP ${resp.status})`);
            }
            const json = await resp.json();
            const detail = unwrap(json);
            if (!detail) throw new Error('Dataset detail is empty');
            setDatasetDetail(detail);
            // Pre-check every column — the user un-checks whatever they don't want.
            const cols = (detail.columns || []).map((c) => c.name).filter(Boolean);
            setSelectedColumns(cols);
            // Seed a sensible default name. User can override.
            if (!reportName) {
                const dsName = detail.name || 'Report';
                setReportName(`${dsName} - Quick Create`);
            }
        } catch (e) {
            setError(e?.message || 'Failed to load dataset fields');
        } finally {
            setDatasetDetailLoading(false);
        }
    };

    const handleDatasetChange = (id) => {
        setSelectedDatasetId(id);
        loadDatasetDetail(id);
    };

    const toggleColumn = (name) => {
        setSelectedColumns((prev) =>
            prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
        );
    };

    const allColumns = useMemo(
        () => (datasetDetail?.columns || []).map((c) => c.name).filter(Boolean),
        [datasetDetail]
    );

    const canBuild =
        !!selectedDatasetId &&
        !!datasetDetail &&
        selectedColumns.length > 0 &&
        reportName.trim().length > 0;

    const handleBuild = async (runAfterSave = false) => {
        if (!canBuild) return;
        setBuilding(true);
        setError(null);
        try {
            const resp = await fetch(buildApiUrl('/reports/build'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader() },
                body: JSON.stringify({
                    datasetId: selectedDatasetId,
                    reportName: reportName.trim(),
                    description: description || '',
                    // Preserve user-selected display order.
                    columns: selectedColumns.slice(),
                    // Optional filter/sort — always send so an empty list
                    // means "no filters/sorts on the generated Tablix".
                    // The generator emits the matching XML from these.
                    filters: (filters || [])
                        .filter((f) => f && f.fieldName)
                        .map((f) => ({
                            fieldName: f.fieldName,
                            operator: f.operator || 'Equal',
                            dataType: f.dataType || 'String',
                            multiValue: !!f.multiValue,
                            promptLabel: f.promptLabel || f.fieldName,
                            parameterName: f.parameterName || `QuickCreate_${f.fieldName}_Param`,
                            defaultValues: Array.isArray(f.defaultValues) ? f.defaultValues : [],
                        })),
                    sorts: (sorts || [])
                        .filter((s) => s && s.fieldName)
                        .map((s) => ({
                            fieldName: s.fieldName,
                            direction: s.direction || 'Ascending',
                        })),
                }),
            });
            const json = await resp.json().catch(() => null);
            if (!resp.ok || (json && json.success === false)) {
                throw new Error(json?.message || json?.error || `Build failed (HTTP ${resp.status})`);
            }
            const payload = unwrap(json);
            setResult(payload);

            if (typeof onCreated === 'function') {
                try { onCreated(payload, { runAfterSave }); } catch { /* noop */ }
            }

            // When the user asked to run the report, close the wizard
            // immediately so the viewer underneath isn't obscured by
            // the modal. The success screen is skipped in that case.
            if (runAfterSave) {
                onClose?.();
                return;
            }
            setStep(3);
        } catch (e) {
            setError(e?.message || 'Failed to build report');
        } finally {
            setBuilding(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#181c2c] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                        <BoltIcon className="w-5 h-5 text-[#FF4800]" />
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Quick Create Report</h2>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Generate a new report from a shared dataset in seconds.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Close"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 px-6 pt-4 text-[11px]">
                    <span className={`px-2 py-0.5 rounded-full ${step >= 1 ? 'bg-[#FF4800] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>1. Dataset</span>
                    <span className="text-slate-400">→</span>
                    <span className={`px-2 py-0.5 rounded-full ${step >= 2 ? 'bg-[#FF4800] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>2. Columns &amp; name</span>
                    <span className="text-slate-400">→</span>
                    <span className={`px-2 py-0.5 rounded-full ${step >= 3 ? 'bg-[#FF4800] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>3. Done</span>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
                            <ExclamationTriangleIcon className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-3">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Choose a shared dataset
                            </label>
                            {datasetsLoading ? (
                                <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
                                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                    Loading datasets…
                                </div>
                            ) : datasets.length === 0 ? (
                                <div className="text-xs text-slate-500 py-3">
                                    No datasets available.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                                    {datasets.map((d) => (
                                        <button
                                            key={d.id}
                                            onClick={() => handleDatasetChange(d.id)}
                                            className={`text-left p-3 rounded-xl border transition-all ${
                                                selectedDatasetId === d.id
                                                    ? 'border-[#FF4800] bg-orange-50 dark:bg-orange-950/30'
                                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{d.name}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{d.id}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={onClose}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => setStep(2)}
                                    disabled={!selectedDatasetId || datasetDetailLoading}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#FF4800] text-white hover:bg-[#e03f00] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            {datasetDetailLoading ? (
                                <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
                                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                    Loading columns…
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Columns to include ({selectedColumns.length}/{allColumns.length})
                                        </label>
                                        <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1 border border-slate-200 dark:border-slate-700 rounded-xl p-2">
                                            {allColumns.map((name) => (
                                                <label
                                                    key={name}
                                                    className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedColumns.includes(name)}
                                                        onChange={() => toggleColumn(name)}
                                                        className="rounded border-slate-300 text-[#FF4800] focus:ring-[#FF4800]"
                                                    />
                                                    <span className="truncate" title={name}>{name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Report name
                                        </label>
                                        <input
                                            value={reportName}
                                            onChange={(e) => setReportName(e.target.value)}
                                            placeholder="My New Report"
                                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF4800]/40"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Description (optional)
                                        </label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            rows={2}
                                            placeholder="What does this report show?"
                                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF4800]/40 resize-none"
                                        />
                                    </div>

                                    {/* Filters (optional) — each creates a
                                        matching <ReportParameter> so the
                                        viewer prompts the user at run time. */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Filters <span className="font-normal text-slate-400">(optional)</span>
                                        </label>
                                        <FilterBuilder
                                            tablixFields={allColumns}
                                            fields={(datasetDetail?.columns || []).map((c) => ({ name: c.name, type: c.typeName }))}
                                            value={filters}
                                            onChange={setFilters}
                                            parameterPrefix="QuickCreate_"
                                        />
                                    </div>

                                    {/* Sorting (optional) — Tablix-level
                                        <SortExpressions>. Applied left to
                                        right (first = primary). */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Sorting <span className="font-normal text-slate-400">(optional)</span>
                                        </label>
                                        <SortBuilder
                                            tablixFields={allColumns}
                                            allCatalogNames={allColumns}
                                            value={sorts}
                                            onChange={setSorts}
                                        />
                                    </div>

                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                        Will be saved to <strong>{targetCategory}</strong>.
                                    </p>
                                </>
                            )}

                            <div className="flex justify-between gap-2 pt-2">
                                <button
                                    onClick={() => setStep(1)}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    Back
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleBuild(false)}
                                        disabled={!canBuild || building}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                        title="Create the report and save it to your user folder"
                                    >
                                        {building && <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />}
                                        {building ? 'Creating…' : 'Create'}
                                    </button>
                                    <button
                                        onClick={() => handleBuild(true)}
                                        disabled={!canBuild || building}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#FF4800] text-white hover:bg-[#e03f00] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                        title="Create the report and open it in the viewer"
                                    >
                                        {building && <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />}
                                        <BoltIcon className="w-3.5 h-3.5" />
                                        {building ? 'Creating…' : 'Create & Run'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && result && (
                        <div className="space-y-4 py-3">
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
                                <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-green-700 dark:text-green-300">
                                        Report created
                                    </p>
                                    <p className="text-xs text-green-700/80 dark:text-green-300/80 truncate">
                                        “{result.reportName}” in “{result.categoryName || targetCategory}”.
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={onClose}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => onCreated && onCreated(result, { runAfterSave: true })}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#FF4800] text-white hover:bg-[#e03f00] flex items-center gap-1.5"
                                    title="Open this report in the viewer"
                                >
                                    <BoltIcon className="w-3.5 h-3.5" />
                                    Run report
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
