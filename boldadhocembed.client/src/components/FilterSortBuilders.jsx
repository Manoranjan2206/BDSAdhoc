import React from 'react';

// Shared UI for editing Tablix-level <Filters> and <SortExpressions>
// in Quick Edit and Quick Create dialogs. Each Filter entry maps to a
// matching <ReportParameter> at save time so the viewer prompts the
// user; each Sort entry maps to a <SortExpression>.
//
// Backed by:
//   filter = { fieldName, operator, dataType, multiValue, promptLabel,
//              parameterName, defaultValues: [..csv..] }
//   sort   = { fieldName, direction: 'Ascending' | 'Descending' }

export const FILTER_OPERATORS = [
    { value: 'Equal', label: 'Equal (=)' },
    { value: 'NotEqual', label: 'Not equal (!=)' },
    { value: 'In', label: 'In (multi)' },
    { value: 'NotIn', label: 'Not in (multi)' },
    { value: 'Like', label: 'Like' },
    { value: 'GreaterThan', label: 'Greater than (>)' },
    { value: 'GreaterThanOrEqual', label: 'Greater or equal (≥)' },
    { value: 'LessThan', label: 'Less than (<)' },
    { value: 'LessThanOrEqual', label: 'Less or equal (≤)' },
    { value: 'Between', label: 'Between' },
];

export const FILTER_DATA_TYPES = ['String', 'Integer', 'Decimal', 'DateTime', 'Boolean'];

export function inferDataTypeFromField(fieldName, fields) {
    const f = (fields || []).find(
        (x) => String(x?.name || '').toLowerCase() === String(fieldName || '').toLowerCase()
    );
    if (!f?.type) return 'String';
    const t = String(f.type).toLowerCase();
    if (t.includes('int')) return 'Integer';
    if (t.includes('decimal') || t.includes('numeric') || t.includes('float') || t.includes('double')) return 'Decimal';
    if (t.includes('datetime') || t.includes('date')) return 'DateTime';
    if (t.includes('bool')) return 'Boolean';
    return 'String';
}

function uniqueOrdered(...sources) {
    const seen = new Set();
    const out = [];
    for (const s of sources) {
        for (const n of s || []) {
            if (!n) continue;
            const k = String(n).toLowerCase();
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(n);
        }
    }
    return out;
}

export function FilterBuilder({ tablixFields = [], fields = [], value = [], onChange, parameterPrefix = 'QuickEdit_' }) {
    const datasetOptions = uniqueOrdered(
        (fields || []).map((f) => f?.name),
        tablixFields
    );

    const addFilter = () => {
        const firstField = tablixFields[0] || (fields[0]?.name) || '';
        onChange([
            ...value,
            {
                fieldName: firstField,
                operator: 'Equal',
                dataType: inferDataTypeFromField(firstField, fields),
                multiValue: false,
                promptLabel: firstField,
                parameterName: `${parameterPrefix}${firstField}_Param`,
                defaultValues: [],
            },
        ]);
    };

    const updateFilter = (i, patch) => {
        const next = value.slice();
        next[i] = { ...next[i], ...patch };
        if (patch.fieldName) {
            next[i].dataType = inferDataTypeFromField(patch.fieldName, fields);
            next[i].promptLabel = patch.fieldName;
        }
        // Multi-value forces operator to be In/NotIn; clearing it
        // demotes back to Equal so the dropdown stays consistent.
        if (next[i].multiValue && next[i].operator === 'Equal') next[i].operator = 'In';
        if (!next[i].multiValue && (next[i].operator === 'In' || next[i].operator === 'NotIn')) next[i].operator = 'Equal';
        onChange(next);
    };

    const removeFilter = (i) => {
        const next = value.slice();
        next.splice(i, 1);
        onChange(next);
    };

    return (
        <div className="space-y-2">
            {value.length === 0 && (
                <div className="text-xs text-slate-400 italic">
                    No filters. Click <strong>Add filter</strong> to add a Tablix-level filter (also creates a viewer prompt).
                </div>
            )}
            {value.map((f, i) => {
                return (
                    <div key={i} className="space-y-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                Filter {i + 1}
                            </span>
                            <button
                                type="button"
                                onClick={() => removeFilter(i)}
                                className="text-[11px] text-red-500 hover:text-red-600"
                            >
                                Remove
                            </button>
                        </div>
                        <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-12 sm:col-span-5">
                                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                    Dataset field
                                </label>
                                <select
                                    value={f.fieldName || ''}
                                    onChange={(e) => updateFilter(i, { fieldName: e.target.value })}
                                    className="w-full text-xs px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                >
                                    <option value="">Select field…</option>
                                    {datasetOptions.map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-6 sm:col-span-3">
                                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                    Operator
                                </label>
                                <select
                                    value={f.operator || 'Equal'}
                                    onChange={(e) => updateFilter(i, { operator: e.target.value })}
                                    className="w-full text-xs px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                >
                                    {FILTER_OPERATORS.map((op) => (
                                        <option key={op.value} value={op.value}>{op.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-6 sm:col-span-2">
                                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                    Data type
                                </label>
                                <select
                                    value={f.dataType || 'String'}
                                    onChange={(e) => updateFilter(i, { dataType: e.target.value })}
                                    className="w-full text-xs px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                >
                                    {FILTER_DATA_TYPES.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-12 sm:col-span-2 flex items-end">
                                <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!!f.multiValue}
                                        onChange={(e) => updateFilter(i, { multiValue: e.target.checked })}
                                        className="accent-[#FF4800]"
                                    />
                                    Multi-select
                                </label>
                            </div>
                        </div>
                        <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-12 sm:col-span-6">
                                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                    Parameter name <span className="font-normal text-slate-400">(report-level)</span>
                                </label>
                                <input
                                    type="text"
                                    value={f.parameterName || ''}
                                    onChange={(e) => updateFilter(i, { parameterName: e.target.value })}
                                    placeholder={`${parameterPrefix}<Field>_Param`}
                                    className="w-full text-xs px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>
                );
            })}
            <button
                type="button"
                onClick={addFilter}
                className="text-xs font-semibold text-[#FF4800] hover:bg-orange-50 dark:hover:bg-orange-950/30 px-3 py-1.5 rounded-lg border border-dashed border-[#FF4800]/40 transition-colors"
            >
                + Add filter
            </button>
        </div>
    );
}

export function SortBuilder({ tablixFields = [], allCatalogNames = [], value = [], onChange }) {
    const options = uniqueOrdered(tablixFields, allCatalogNames);

    const addSort = () => {
        const firstField = tablixFields[0] || allCatalogNames[0] || '';
        onChange([...value, { fieldName: firstField, direction: 'Ascending' }]);
    };
    const updateSort = (i, patch) => {
        const next = value.slice();
        next[i] = { ...next[i], ...patch };
        onChange(next);
    };
    const removeSort = (i) => {
        const next = value.slice();
        next.splice(i, 1);
        onChange(next);
    };
    const moveSort = (i, delta) => {
        const j = i + delta;
        if (j < 0 || j >= value.length) return;
        const next = value.slice();
        const tmp = next[i]; next[i] = next[j]; next[j] = tmp;
        onChange(next);
    };

    return (
        <div className="space-y-2">
            {value.length === 0 && (
                <div className="text-xs text-slate-400 italic">
                    No sort expressions. Click <strong>Add sort</strong> to order rows by a dataset field.
                </div>
            )}
            {value.map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40">
                    <span className="text-[10px] font-semibold text-slate-500 w-5 text-center">{i + 1}</span>
                    <select
                        value={s.fieldName || ''}
                        onChange={(e) => updateSort(i, { fieldName: e.target.value })}
                        className="flex-1 min-w-0 text-xs px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                        <option value="">Select field…</option>
                        {options.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <select
                        value={s.direction || 'Ascending'}
                        onChange={(e) => updateSort(i, { direction: e.target.value })}
                        className="text-xs px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                        <option value="Ascending">Ascending</option>
                        <option value="Descending">Descending</option>
                    </select>
                    <button
                        type="button"
                        onClick={() => moveSort(i, -1)}
                        disabled={i === 0}
                        className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-30"
                        title="Move up"
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        onClick={() => moveSort(i, 1)}
                        disabled={i === value.length - 1}
                        className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-30"
                        title="Move down"
                    >
                        ↓
                    </button>
                    <button
                        type="button"
                        onClick={() => removeSort(i)}
                        className="text-[11px] text-red-500 hover:text-red-600"
                    >
                        Remove
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={addSort}
                className="text-xs font-semibold text-[#FF4800] hover:bg-orange-50 dark:hover:bg-orange-950/30 px-3 py-1.5 rounded-lg border border-dashed border-[#FF4800]/40 transition-colors"
            >
                + Add sort
            </button>
        </div>
    );
}
