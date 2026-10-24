import React, { useEffect, useMemo, useState } from 'react';
import {
    XMarkIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    Squares2X2Icon,
    BoltIcon,
} from '@heroicons/react/24/outline';
import { loadQuickEdit, saveQuickEdit } from '../services/quickEditService';
import { FilterBuilder, SortBuilder } from './FilterSortBuilders';

// The FULL dataset column catalog when the server can resolve it
// (availableDatasetFields), falling back to datasetFields for older
// backend builds / reports with no shared-dataset reference.
function fieldCatalogOf(model) {
    const available = model?.availableDatasetFields || [];
    if (available.length > 0) return available;
    return model?.datasetFields || [];
}

// Look up a dataset field object by name (case-insensitive). Falls back
// to a minimal `{name}` object so a Tablix's selectedColumns always render
// in the field list, even if the catalog doesn't carry metadata for it.
function datasetFieldByName(catalog, name) {
    if (!catalog || !name) return { name };
    const target = String(name).toLowerCase();
    const hit = catalog.find((f) => String(f?.name || '').toLowerCase() === target);
    return hit || { name };
}

// Lower-cased set of field names the *selected* Tablix currently renders.
// Used to drive the initial checkbox state for that Tablix. RDL field
// names are case-insensitive, so we normalise to lower case for comparison.
function tablixUsedFieldSet(tablix) {
    const used = new Set();
    if (!tablix) return used;
    for (const c of tablix.selectedColumns || []) {
        if (c) used.add(String(c).toLowerCase());
    }
    return used;
}

// Pre-check exactly the columns the *selected* Tablix already uses —
// NOT the whole catalog. Everything else in the catalog is shown
// unchecked and can be opted into. A field in `datasetFields` but not
// in any Tablix (e.g. a row-group name like "Details") is not a
// column, so it is left unchecked too unless a Tablix genuinely
// selects it.
function initialSelectionFor(model, tablix) {
    if (!tablix) return [];
    const used = tablixUsedFieldSet(tablix);
    return fieldCatalogOf(model)
        .map((f) => f?.name)
        .filter((n) => n && used.has(String(n).toLowerCase()));
}

/**
 * Quick Edit Report dialog. Replaces the old Copy → designer flow.
 *
 * "Report Columns" lists the FULL dataset column catalog from the
 * server (`availableDatasetFields`, falling back to `datasetFields`):
 *   - Columns the Tablixes already render are PRE-CHECKED and styled
 *     bold indigo. Unchecking one removes it from the new report.
 *   - Columns merely available in the dataset are shown greyed and
 *     unchecked. Checking one adds it to the new report.
 *
 * Save emits a `columnToggles` entry per (Tablix, field) for the union of
 * Tablix-used + available catalog fields, with `remove: !checked`. The
 * backend rebuilds the RDL and uploads it as a new report; the original
 * report is never modified.
 *
 * Props:
 *   isOpen:       boolean, dialog visibility
 *   onClose:      () => void
 *   source:       { name, serverPath, reportId?, description? }
 *   targetCategory?: string — defaults to "My Reports"
 *   onSaved:      (result) => void — receives { newReportId, newReportName, targetCategory }
 *   onOpenFullDesigner: () => void — opt-out chip
 */
export default function QuickEditDialog({
    isOpen,
    onClose,
    source,
    targetCategory = 'My Reports',
    onSaved,
    onOpenFullDesigner,
}) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [model, setModel] = useState(null);
    const [selectedTablixName, setSelectedTablixName] = useState('');
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [newReportName, setNewReportName] = useState('');
    const [description, setDescription] = useState('');
    const [successMsg, setSuccessMsg] = useState(null);
    // Filters and sorts — keyed by Tablix name. Re-built from the
    // source report on load (pre-populated) so editing the existing
    // values works; otherwise empty arrays.
    const [filtersByTablix, setFiltersByTablix] = useState({}); // { [tablixName]: QuickEditFilter[] }
    const [sortsByTablix, setSortsByTablix] = useState({});     // { [tablixName]: QuickEditSort[] }

    const updateFilters = (tablixName, next) =>
        setFiltersByTablix((prev) => ({ ...prev, [tablixName]: next }));
    const updateSorts = (tablixName, next) =>
        setSortsByTablix((prev) => ({ ...prev, [tablixName]: next }));

    // ----- Load on open -----
    useEffect(() => {
        if (!isOpen || !source) return;
        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        setModel(null);
        setSelectedTablixName('');
        setSelectedColumns([]);
        setFiltersByTablix({});
        setSortsByTablix({});
        setNewReportName(source.name ? `${source.name} - Customized` : '');
        setDescription(source.description || '');

        const serverPath = source.serverPath || (source.category ? `/${source.category}/${source.name}` : source.name);
        loadQuickEdit({ serverPath, reportId: source.reportId })
            .then((res) => {
                const m = res?.data || res;
                if (!m) throw new Error(res?.message || 'Empty response');
                setModel(m);
                // Pick the first Tablix by default so the user lands in
                // a working state. They can switch with the Tablix chips
                // above the column list.
                const firstTablix = (m?.tablixes || [])[0];
                const firstName = firstTablix?.name || '';
                setSelectedTablixName(firstName);
                setSelectedColumns(initialSelectionFor(m, firstTablix));

                // Pre-populate filters/sorts from the parser so the
                // dialog edits existing entries instead of starting blank.
                const fMap = {};
                const sMap = {};
                for (const t of (m?.tablixes || [])) {
                    if (t.name) {
                        fMap[t.name] = Array.isArray(t.filters) ? t.filters : [];
                        sMap[t.name] = Array.isArray(t.sorts) ? t.sorts : [];
                    }
                }
                setFiltersByTablix(fMap);
                setSortsByTablix(sMap);
            })
            .catch((e) => {
                console.error('QuickEdit load failed', e);
                setError(e?.message || 'Failed to load report.');
            })
            .finally(() => setLoading(false));
    }, [isOpen, source]);

    // ----- Derived state -----
    // The full dataset catalog. Field objects, so the grid can show the
    // column type alongside the name.
    const allFields = useMemo(() => fieldCatalogOf(model), [model]);
    // Memoized so the fieldToTablixes useMemo below has a stable dependency —
    // an inline `|| []` would be a new array on every render.
    const tablixes = useMemo(() => model?.tablixes || [], [model]);
    const lockedReasons = useMemo(() => model?.lockedReasons || [], [model]);

    // The Tablix the column toggles target. Tabs/chips above the column
    // list let the user switch target without losing their selection.
    const selectedTablix = useMemo(
        () => tablixes.find((t) => t.name === selectedTablixName) || tablixes[0] || null,
        [tablixes, selectedTablixName]
    );

    // Dataset fields the SELECTED Tablix currently renders, in the
    // order they appear in the Tablix. Built from the dataset catalog
    // so each item carries the field's type metadata; falls back to a
    // `{name}` stub if the catalog has no entry for that field.
    // This is the list shown in the "Report Columns" section — exactly
    // the dataset fields rendered by the selected Tablix, so toggling
    // them directly edits that Tablix's columns.
    const tablixFields = useMemo(() => {
        if (!selectedTablix) return [];
        const cols = selectedTablix.selectedColumns || [];
        const seen = new Set();
        const result = [];
        for (const name of cols) {
            if (!name) continue;
            const key = String(name).toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            const f = datasetFieldByName(allFields, name);
            result.push(f);
        }
        return result;
    }, [selectedTablix, allFields]);

    // Which fields the SELECTED Tablix already renders — drives both the
    // initial checkbox state and the "currently in Tablix" styling.
    const usedFieldNames = useMemo(() => tablixUsedFieldSet(selectedTablix), [selectedTablix]);
    const isInTablix = (name) => usedFieldNames.has(String(name).toLowerCase());

    // When the user switches Tablix, reset the column selection to that
    // Tablix's currently-rendered fields. Otherwise the user could carry
    // over a stale check state from another Tablix.
    useEffect(() => {
        if (!model || !selectedTablix) {
            setSelectedColumns([]);
            return;
        }
        setSelectedColumns(initialSelectionFor(model, selectedTablix));
        // We intentionally exclude `model` from deps — only changes to the
        // selected Tablix should reset the selection.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTablixName, selectedTablix?.name]);

    const toggleColumn = (name) => {
        setSelectedColumns((prev) =>
            prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
        );
    };

    // Build a map of fieldName -> Tablix names that reference it. Used
    // by the small subtitle under each checkbox so users know which
    // regions will be affected if they uncheck a field.
    const fieldToTablixes = useMemo(() => {
        const m = new Map();
        for (const t of tablixes) {
            for (const c of (t.selectedColumns || [])) {
                if (!m.has(c)) m.set(c, []);
                m.get(c).push(t.name);
            }
        }
        return m;
    }, [tablixes]);

    const buildPayload = () => {
        // Only emit toggles for the SELECTED Tablix. Each column toggle
        // targets exactly one Tablix region, so per-Tablix dispatch in
        // the rebuilder matches user intent without touching other Tablixes.
        if (!selectedTablix) return { columnToggles: [], filters: [], sorts: [] };

        // Every field the user could act on = the UNION of
        //   - what the selected Tablix already renders (so we can remove it), and
        //   - the full dataset catalog (so we can add it).
        const catalogNames = allFields.map((f) => f?.name).filter(Boolean);
        const tablixNames = (selectedTablix.selectedColumns || []).filter(Boolean);

        const union = [];
        const seen = new Set();
        for (const n of [...catalogNames, ...tablixNames]) {
            const key = String(n).toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            union.push(n);
        }

        const isChecked = (n) => selectedColumns.some((c) => String(c).toLowerCase() === String(n).toLowerCase());

        const toggles = union.map((field) => ({
            tablixName: selectedTablix.name,
            fieldName: field,
            remove: !isChecked(field),
        }));

        // Always send the COMPLETE desired state for the SELECTED Tablix —
        // even when the arrays are empty. The rebuilder treats an empty
        // list as "clear this Tablix's filters/sorts entirely", which is
        // what the UI's Remove button expects. We never leave the source
        // RDL's existing entries untouched when the user is actively
        // editing this Tablix's filters.
        const filters = (filtersByTablix[selectedTablix.name] || [])
            .filter((f) => f && f.fieldName)
            .map((f) => ({
                tablixName: selectedTablix.name,
                fieldName: f.fieldName,
                operator: f.operator || 'Equal',
                dataType: f.dataType || 'String',
                multiValue: !!f.multiValue,
                promptLabel: f.promptLabel || f.fieldName,
                parameterName: f.parameterName || `QuickEdit_${f.fieldName}_Param`,
                defaultValues: Array.isArray(f.defaultValues) ? f.defaultValues : [],
            }));
        const sorts = (sortsByTablix[selectedTablix.name] || [])
            .filter((s) => s && s.fieldName)
            .map((s) => ({
                tablixName: selectedTablix.name,
                fieldName: s.fieldName,
                direction: s.direction || 'Ascending',
            }));

        return { columnToggles: toggles, filters, sorts };
    };

    const canSave = !!model && !loading && !saving && newReportName.trim().length > 0;

    // Refresh the report session against the server. Used by handleSave
    // when the previous sessionId has been invalidated (e.g. backend
    // restart cleared the in-memory session cache).
    const reloadSession = async () => {
        const serverPath = source.serverPath
            || (source.category ? `/${source.category}/${source.name}` : source.name);
        const res = await loadQuickEdit({ serverPath, reportId: source.reportId });
        const m = res?.data || res;
        if (!m) throw new Error(res?.message || 'Failed to reload report.');
        setModel(m);
        // Reset the column selection to whatever the server reports, so
        // the retry has the same default state as a fresh load. Keep the
        // user's chosen Tablix if it still exists, otherwise fall back
        // to the first Tablix.
        const firstTablix = (m?.tablixes || [])[0];
        const keep = (m?.tablixes || []).find((t) => t.name === selectedTablixName) || firstTablix;
        setSelectedTablixName(keep?.name || '');
        setSelectedColumns(initialSelectionFor(m, keep));
        return m;
    };

    const isSessionExpiredError = (e) =>
        /session\s+expired/i.test(e?.message || '');

    // The previous single "Save" button is now joined by "Save & Run".
    // Both share the save path; the only difference is whether we ask
    // the parent to open the new report in the viewer afterwards.
    const handleSave = async (runAfterSave = false) => {
        setSaving(true);
        setError(null);
        try {
            const { columnToggles, filters, sorts } = buildPayload();
            const doSave = (sessionId) => saveQuickEdit({
                sessionId,
                newReportName: newReportName.trim(),
                description: description.trim(),
                targetCategory,
                columnToggles,
                filters,
                sorts,
                // Tell the rebuilder which Tablix the filters/sorts
                // lists target — required so an empty list actually
                // clears that Tablix's existing filters/sorts.
                targetTablixName: selectedTablix?.name || null,
            });

            let res;
            try {
                res = await doSave(model.sessionId);
            } catch (e) {
                // Backend restart invalidated the in-memory session. Reload
                // once and try again with the fresh sessionId. If it fails
                // a second time, surface the error to the user.
                if (!isSessionExpiredError(e)) throw e;
                const fresh = await reloadSession();
                res = await doSave(fresh.sessionId);
            }

            const ok = res?.success !== false;
            if (!ok) throw new Error(res?.error || res?.message || 'Save failed');
            const data = res?.data || res;

            // Notify the parent first so it can invalidate the reports
            // cache and start opening the viewer, then close this dialog
            // so nothing is stacked on top of the report that loads.
            onSaved?.(data, { runAfterSave });

            if (runAfterSave) {
                onClose?.();
            } else {
                setSuccessMsg(`Saved "${data.newReportName}" to "${data.targetCategory}".`);
            }
        } catch (e) {
            console.error('QuickEdit save failed', e);
            setError(e?.message || 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100000] p-4">
            <div className="bg-white dark:bg-[#181c2c] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
                <Header
                    sourceName={source?.name || model?.sourceReportName || ''}
                    onClose={onClose}
                />

                <div className="overflow-y-auto px-6 py-4 space-y-5 flex-1">
                    {loading && (
                        <div className="flex items-center justify-center py-12 gap-2 text-sm text-slate-500">
                            <ArrowPathIcon className="w-4 h-4 animate-spin" /> Downloading report…
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs">
                            <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold">Quick Edit failed</div>
                                <div className="opacity-90">{error}</div>
                            </div>
                        </div>
                    )}

                    {successMsg && (
                        <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">
                            <CheckCircleIcon className="w-4 h-4" /> {successMsg}
                        </div>
                    )}

                    {model && !loading && (
                        <>
                            {lockedReasons.length > 0 && (
                                <LockedBanner reasons={lockedReasons} />
                            )}

                            {/* Dataset context (informational) */}
                            <section className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700">
                                Data source: <strong>{model.datasetName || '(unnamed)'}</strong>
                                {model.datasetId && <> · ID <code>{model.datasetId}</code></>}
                                {' '}— existing query preserved.
                            </section>

                            {/* Tablix picker — switch which Tablix's columns are
                                listed below. Each chip becomes the active target
                                when clicked; the column list refreshes to that
                                Tablix's dataset fields. */}
                            {tablixes.length > 0 && (
                                <section>
                                    <SectionHeader
                                        title="Tablix"
                                        subtitle={`Select the Tablix to edit · ${tablixes.length} region${tablixes.length === 1 ? '' : 's'} in this report.`}
                                    />
                                    <div className="flex flex-wrap gap-1.5">
                                        {tablixes.map((t) => {
                                            const active = (selectedTablix?.name || '') === t.name;
                                            return (
                                                <button
                                                    key={t.name}
                                                    type="button"
                                                    onClick={() => setSelectedTablixName(t.name)}
                                                    className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                                                        active
                                                            ? 'bg-[#FF4800] border-[#FF4800] text-white shadow-sm'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                    }`}
                                                >
                                                    <strong>{t.name}</strong>
                                                    <span className={`${active ? 'opacity-90' : 'opacity-60'}`}>
                                                        · {(t.selectedColumns || []).length} cols
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Report columns — the FULL available dataset field
                                catalog, with the SELECTED Tablix's body-cell fields
                                pre-checked. Switching the Tablix chip above refreshes
                                which fields are checked (each Tablix renders its own
                                subset of dataset fields). Checking a new field adds it
                                to the new report; unchecking a Tablix field removes it. */}
                            <section className="space-y-3">
                                <SectionHeader
                                    title="Report Columns"
                                    subtitle={
                                        !selectedTablix
                                            ? 'No Tablix in this report.'
                                            : (() => {
                                                const total = allFields.length;
                                                const kept = selectedColumns.length;
                                                return total === 0
                                                    ? `${selectedTablix.name} has no dataset fields.`
                                                    : `${kept} of ${total} dataset fields selected · ${tablixFields.length} currently in ${selectedTablix.name}. Check a field to add it, uncheck a Tablix field to remove it.`;
                                            })()
                                    }
                                />

                                {!selectedTablix ? (
                                    <div className="text-xs text-slate-400 italic">
                                        The source report does not contain any Tablix regions. Saving will produce a copy with the same structure but no Tablix fields to toggle.
                                    </div>
                                ) : allFields.length === 0 ? (
                                    <div className="text-xs text-slate-400 italic">
                                        This dataset does not expose any columns. Saving will produce a copy with the same structure but no data fields to toggle.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {allFields.map((field) => {
                                            const fieldName = field?.name;
                                            if (!fieldName) return null;
                                            const checked = selectedColumns.includes(fieldName);
                                            const inTablix = isInTablix(fieldName);
                                            return (
                                                <label
                                                    key={fieldName}
                                                    title={
                                                        inTablix
                                                            ? `Field currently rendered by ${selectedTablix.name} — uncheck to remove it`
                                                            : `Field available in the dataset — check to add it to ${selectedTablix.name}`
                                                    }
                                                    className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                                                        checked
                                                            ? inTablix
                                                                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
                                                                : 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                                                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-400'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="mt-0.5 accent-[#FF4800]"
                                                        checked={checked}
                                                        onChange={() => toggleColumn(fieldName)}
                                                    />
                                                    <span className="flex-1 min-w-0">
                                                        <span
                                                            className={`block truncate ${checked ? 'font-bold' : 'font-medium text-slate-400'}`}
                                                        >
                                                            {fieldName}
                                                        </span>
                                                        <span className="block text-[10px] opacity-70 truncate">
                                                            {field?.type ? `${field.type} · ` : ''}
                                                            {inTablix
                                                                ? `currently in ${selectedTablix.name}`
                                                                : 'available in dataset'}
                                                        </span>
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>

                            {/* Filters — Tablix-level filters that
                                also create a matching <ReportParameter>
                                at the report root, so the user is
                                prompted for the value when the report
                                runs. Each entry: dataset field, operator,
                                data type, multi-value, default values. */}
                            <section className="space-y-3">
                                <SectionHeader
                                    title="Filters"
                                    subtitle={
                                        !selectedTablix
                                            ? 'No Tablix in this report.'
                                            : (() => {
                                                const list = filtersByTablix[selectedTablix.name] || [];
                                                return `${list.length} filter${list.length === 1 ? '' : 's'} on ${selectedTablix.name}. Each filter creates a report parameter so the viewer prompts the user at run time.`;
                                            })()
                                    }
                                />
                                {!selectedTablix ? null : (
                                    <FilterBuilder
                                        tablixFields={tablixFields.map((f) => f?.name).filter(Boolean)}
                                        fields={allFields}
                                        value={filtersByTablix[selectedTablix.name] || []}
                                        onChange={(next) => updateFilters(selectedTablix.name, next)}
                                    />
                                )}
                            </section>

                            {/* Sorting — Tablix-level <SortExpressions>
                                built from the dataset field catalog. Each
                                entry: dataset field + Ascending/Descending.
                                Empty list = no sort applied. */}
                            <section className="space-y-3">
                                <SectionHeader
                                    title="Sorting"
                                    subtitle={
                                        !selectedTablix
                                            ? 'No Tablix in this report.'
                                            : (() => {
                                                const list = sortsByTablix[selectedTablix.name] || [];
                                                return `${list.length} sort expression${list.length === 1 ? '' : 's'} on ${selectedTablix.name}. Applied left-to-right (first = primary).`;
                                            })()
                                    }
                                />
                                {!selectedTablix ? null : (
                                    <SortBuilder
                                        tablixFields={tablixFields.map((f) => f?.name).filter(Boolean)}
                                        allCatalogNames={allFields.map((f) => f?.name).filter(Boolean)}
                                        value={sortsByTablix[selectedTablix.name] || []}
                                        onChange={(next) => updateSorts(selectedTablix.name, next)}
                                    />
                                )}
                            </section>

                            {/* Save options */}
                            <section>
                                <SectionHeader title="Save as New Report" />
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            New report name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newReportName}
                                            onChange={(e) => setNewReportName(e.target.value)}
                                            className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF4800]/50"
                                            placeholder="My customized report"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Description <span className="opacity-50 font-normal">(optional)</span>
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF4800]/50 resize-none"
                                            placeholder="Brief description"
                                        />
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        Target category: <strong>{targetCategory || "(your user folder)"}</strong> — original report stays unchanged.
                                    </div>
                                </div>
                            </section>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-slate-100 dark:border-slate-800/80">
                    <button
                        type="button"
                        onClick={onOpenFullDesigner}
                        disabled={loading}
                        className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline disabled:opacity-40"
                    >
                        Open in full designer instead
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            {successMsg ? 'Close' : 'Cancel'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSave(false)}
                            disabled={!canSave}
                            className="px-4 py-2 text-xs font-semibold text-white bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5"
                            title="Save the customized copy to your user folder"
                        >
                            {saving && !successMsg && <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />}
                            {successMsg ? 'Saved' : 'Save'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSave(true)}
                            disabled={!canSave}
                            className="px-4 py-2 text-xs font-semibold text-white bg-[#FF4800] hover:bg-[#e03f00] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5"
                            title="Save the customized copy and open it in the viewer"
                        >
                            {saving && <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />}
                            <BoltIcon className="w-3.5 h-3.5" />
                            {saving ? 'Saving…' : 'Save & Run'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Header({ sourceName, onClose }) {
    return (
        <div className="flex items-center justify-between pb-3 px-6 pt-6 border-b border-slate-100 dark:border-slate-800">
            <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Quick Edit Report</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Original: <strong>{sourceName}</strong> — your original report will not be changed.
                </p>
            </div>
            <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg p-1"
                title="Close"
            >
                <XMarkIcon className="w-4 h-4" />
            </button>
        </div>
    );
}

function SectionHeader({ title, subtitle }) {
    return (
        <div className="mb-1">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">{title}</h4>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
    );
}

function LockedBanner({ reasons }) {
    return (
        <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs">
            <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
                <div className="font-semibold">Partial editability</div>
                <ul className="list-disc ml-4 mt-1 opacity-90">
                    {reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
            </div>
        </div>
    );
}

