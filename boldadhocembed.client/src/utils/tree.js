// Utilities for tree data structures used in Reports and Dashboards
import { REP_PREFIX, DB_PREFIX } from '../constants';

export function buildIdMap(nodes) {
  const map = new Map();
  const walk = (arr) => {
    (arr || []).forEach(n => {
      map.set(n.id, n);
      if (n.subChild && n.subChild.length) walk(n.subChild);
    });
  };
  walk(nodes);
  return map;
}

export function isReportNodeId(id) {
  return typeof id === 'string' && id.startsWith(REP_PREFIX);
}

export function isDashboardNodeId(id) {
  return typeof id === 'string' && id.startsWith(DB_PREFIX);
}
