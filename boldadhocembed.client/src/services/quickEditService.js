/**
 * Quick Edit / Customize service — client side.
 * Wraps the /api/reports/customize/* endpoints with auth.
 *
 * Server endpoints (Phase 1):
 *   POST /api/reports/customize/load    { serverPath, reportId? }
 *   POST /api/reports/customize/preview { sessionId, columnToggles, itemRemovals }
 *   POST /api/reports/customize/save    { sessionId, newReportName, description?, targetCategory, columnToggles, itemRemovals }
 *
 * IMPORTANT: paths are passed WITHOUT a leading /api to buildApiUrl —
 * it prepends /api automatically. Other call sites in apiService.js follow
 * this convention (e.g. '/reports/viewer-settings').
 */
import { authService } from './authService';
import { API_BASE_URL, buildApiUrl, unwrapResponse } from '../utils/http';

async function authedFetch(endpoint, options = {}) {
    const token = authService.getToken();
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const url = buildApiUrl(endpoint);
    const resp = await fetch(url, { ...options, headers });

    // Parse JSON FIRST, then unwrap the { success, data, message }
    // envelope. Passing the raw Response to unwrapResponse was a bug —
    // it returns the Response unchanged (Response has no `data` key),
    // and the dialog then saw res.data === undefined and fell back to
    // using the Response as the model, producing empty columns.
    const text = await resp.text();
    let parsed;
    try {
        parsed = text ? JSON.parse(text) : {};
    } catch (e) {
        throw new Error(`API ${endpoint} returned non-JSON (status ${resp.status}): ${text.slice(0, 200)}`);
    }
    if (!resp.ok) {
        const msg = parsed?.error || parsed?.message || `API ${endpoint} failed (${resp.status})`;
        throw new Error(msg);
    }
    return unwrapResponse(parsed);
}

export async function loadQuickEdit({ serverPath, reportId } = {}) {
    if (!serverPath) throw new Error('serverPath is required');
    return authedFetch('reports/customize/load', {
        method: 'POST',
        body: JSON.stringify({ serverPath, reportId: reportId || null }),
    });
}

export async function previewQuickEdit({ sessionId, columnToggles = [], itemRemovals = [] } = {}) {
    if (!sessionId) throw new Error('sessionId is required');
    return authedFetch('reports/customize/preview', {
        method: 'POST',
        body: JSON.stringify({ sessionId, columnToggles, itemRemovals }),
    });
}

export async function saveQuickEdit(payload = {}) {
    if (!payload.sessionId) throw new Error('sessionId is required');
    if (!payload.newReportName) throw new Error('newReportName is required');
    return authedFetch('reports/customize/save', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}
