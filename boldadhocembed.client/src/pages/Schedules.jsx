import { useEffect, useState, useMemo, useRef } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
  CalendarIcon,
  ClockIcon,
  DocumentTextIcon,
  ChartBarIcon,
  XMarkIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronRightIcon,
  FolderIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { schedulesAPI } from '../services/apiService';
import { useData } from '../context/DataContext';
import { motion } from 'framer-motion';
import '../styles/reports.css';

// Color palettes for recurrence types
const COLOR_PALETTES = [
  {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    iconBg: 'bg-emerald-100/70 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800/40',
    iconBg: 'bg-purple-100/70 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
    dot: 'bg-purple-500',
  },
  {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800/40',
    iconBg: 'bg-blue-100/70 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/40',
    iconBg: 'bg-amber-100/70 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800/40',
    iconBg: 'bg-rose-100/70 dark:bg-rose-900/40',
    iconColor: 'text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
];

const getPalette = (keyName) => {
  if (!keyName) return COLOR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < keyName.length; i++) {
    hash = keyName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_PALETTES[Math.abs(hash) % COLOR_PALETTES.length];
};

function mapExportType(value) {
  const nameMap = { Pdf: 'PDF', Word: 'Word', Excel: 'Excel', CSV: 'CSV', HTML: 'HTML', PPT: 'PPT', Image: 'Image', Xml: 'XML' };
  const codeMap = { '1': 'Excel', '2': 'HTML', '3': 'PDF', '4': 'Word', '5': 'Image', '6': 'PPT', '7': 'CSV', '8': 'XML' };
  if (value == null) return 'PDF';
  const key = String(value);
  return nameMap[key] || codeMap[key] || key;
}

function exportCodeToKey(value) {
  if (value == null) return 'Pdf';
  const s = String(value).trim();
  const codeMap = { '1': 'Excel', '2': 'Html', '3': 'Pdf', '4': 'Word', '5': 'Image', '6': 'Ppt', '7': 'Csv', '8': 'Xml' };
  if (codeMap[s]) return codeMap[s];
  const lower = s.toLowerCase();
  if (lower === 'pdf') return 'Pdf';
  if (lower.includes('excel')) return 'Excel';
  if (lower.includes('word')) return 'Word';
  if (lower.includes('csv')) return 'Csv';
  if (lower.includes('html')) return 'Html';
  if (lower.includes('ppt')) return 'Ppt';
  if (lower.includes('image')) return 'Image';
  return s;
}

function toLocalInputValue(date = new Date()) {
  const d = new Date(date);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function ScheduleModal({ schedule, onClose, onSaved, categories = [], reportsByCategory = {} }) {
  const isEdit = !!schedule;
  const title = isEdit ? `Edit Schedule – ${schedule.reportName || 'Asset'}` : 'Create New Schedule';

  const isDashboardInit = isEdit && (
    (schedule?.itemType || schedule?.ItemType || '').toLowerCase() === 'dashboard' ||
    (schedule?.categoryName || '').toLowerCase().includes('dashboard')
  );

  let initialCategory = '';
  if (isDashboardInit) {
    initialCategory = 'Dashboards';
  } else if (isEdit && schedule.categoryName) {
    const trimmed = schedule.categoryName.trim();
    const exact = categories.find(c => c === trimmed);
    initialCategory = exact || categories.find(c => c.toLowerCase() === trimmed.toLowerCase()) || '';
  }

  const reportsInCat = reportsByCategory[initialCategory] || [];
  let initialReportId = isEdit ? schedule.itemId || '' : '';
  let initialReportName = isEdit ? schedule.reportName || '' : '';

  if (isEdit && initialReportId) {
    const matched = reportsInCat.find(r => r.Id === initialReportId);
    if (matched) initialReportName = matched.Name;
  }

  const [assetType, setAssetType] = useState(isDashboardInit ? 'Dashboard' : 'Report');
  const reportCategories = categories.filter(c => c !== 'Dashboards');

  const [formData, setFormData] = useState({
    category: initialCategory,
    reportId: initialReportId,
    reportName: initialReportName,
    scheduleName: isEdit ? (schedule.name || '') : '',
    enabled: isEdit ? !!schedule.enabled : true,
    type: schedule?.recurrenceType || schedule?.scheduleType || 'Hourly',
    startsOn: schedule?.startDate || schedule?.startTime || toLocalInputValue(),
    endsMode: schedule?.neverEnd ? 'never' : (schedule?.endAfterOccurrence > 0 ? 'after' : 'on'),
    afterOccurrences: schedule?.endAfterOccurrence || 1,
    endDate: schedule?.endDate || '',
    hourlyInterval: schedule?.hourlySchedule?.scheduleInterval || '00:15',
    format: isEdit ? exportCodeToKey(schedule?.exportType) : 'Pdf',
    recipients: isEdit && schedule.externalRecipientsList ? schedule.externalRecipientsList.join(', ') : '',
    isEmailAttachment: isEdit ? !!(schedule.isEmailAttachment || schedule.IsEmailAttachment) : true,
  });

  useEffect(() => {
    if (formData.reportId) {
      const report = reportsByCategory[formData.category]?.find(r => r.Id === formData.reportId);
      if (report) setFormData(prev => ({ ...prev, reportName: report.Name }));
    }
  }, [formData.reportId, formData.category, reportsByCategory]);

  const handleAssetTypeChange = (type) => {
    setAssetType(type);
    if (type === 'Dashboard') {
      const dashboards = reportsByCategory['Dashboards'] || [];
      const first = dashboards[0] || { Id: '', Name: '' };
      setFormData(prev => ({
        ...prev,
        category: 'Dashboards',
        reportId: first.Id || '',
        reportName: first.Name || ''
      }));
    } else {
      const firstCat = reportCategories[0] || '';
      const reports = reportsByCategory[firstCat] || [];
      const first = reports[0] || { Id: '', Name: '' };
      setFormData(prev => ({
        ...prev,
        category: firstCat,
        reportId: first.Id || '',
        reportName: first.Name || ''
      }));
    }
  };

  const handleCategoryChange = (cat) => {
    const list = Array.isArray(reportsByCategory?.[cat]) ? reportsByCategory[cat] : [];
    const first = list[0] || { Id: '', Name: '' };
    setFormData(prev => ({ ...prev, category: cat, reportId: first.Id || '', reportName: first.Name || '' }));
  };

  const handleReportChange = (id) => {
    const report = reportsByCategory[formData.category]?.find(r => r.Id === id);
    setFormData(prev => ({
      ...prev,
      reportId: id,
      reportName: report ? report.Name : ''
    }));
  };

  const onSubmit = async () => {
    const isDashboard = formData.category === 'Dashboards';
    if (!formData.reportId || !formData.scheduleName.trim()) {
      alert(isDashboard ? 'Please select a dashboard and enter a schedule name.' : 'Please select a report and enter a schedule name.');
      return;
    }

    const payload = {
      Name: formData.scheduleName.trim(),
      Description: formData.reportName,
      ItemType: isDashboard ? 'Dashboard' : 'Schedule',
      ItemId: formData.reportId,
      ExportType: formData.format,
      StartTime: new Date(formData.startsOn).toISOString(),
      NeverEnd: formData.endsMode === 'never',
      EndAfterOccurrence: formData.endsMode === 'after' ? Number(formData.afterOccurrences) : 0,
      Enabled: formData.enabled,
      IsEmailAttachment: !!formData.isEmailAttachment,
      ExternalRecipientsList: formData.recipients.split(',').map(e => e.trim()).filter(Boolean),
      ScheduleType: formData.type,
      UserList: [],
      GroupList: []
    };
    if (formData.type === 'Hourly') {
      payload.HourlySchedule = { ScheduleInterval: formData.hourlyInterval };
    }
    if (formData.endsMode === 'on' && formData.endDate) {
      payload.EndDate = new Date(formData.endDate).toISOString();
    }
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    try {
      const scheduleId = schedule?.id ?? schedule?.Id ?? schedule?.name ?? schedule?.Name ?? null;
      if (isEdit) {
        if (!scheduleId) {
          alert('Cannot update: schedule identifier is missing.');
          return;
        }
        await schedulesAPI.update(scheduleId, payload);
      } else {
        await schedulesAPI.create(payload);
      }

      alert(isEdit ? 'Schedule updated successfully!' : 'Schedule created successfully!');
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      console.error('Schedule save error:', err);
      alert(`Failed to save: ${err?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#181c2c] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-[#FF4800] text-white p-6 flex justify-between items-center rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            <p className="text-xs text-orange-100 mt-1">Configure automated email deliveries</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto text-xs text-slate-700 dark:text-slate-200">
          <div className="bg-orange-50/50 dark:bg-orange-950/20 rounded-xl p-4 border border-orange-100 dark:border-orange-900/30 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#FF4800]">Target Asset</h3>
              <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => handleAssetTypeChange('Report')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${assetType === 'Report' ? 'bg-white dark:bg-slate-700 text-[#FF4800] shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  Report
                </button>
                <button
                  type="button"
                  onClick={() => handleAssetTypeChange('Dashboard')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${assetType === 'Dashboard' ? 'bg-white dark:bg-slate-700 text-[#FF4800] shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  Dashboard
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assetType === 'Report' ? (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Category *</label>
                    <select className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF4800]" value={formData.category} onChange={(e) => handleCategoryChange(e.target.value)}>
                      <option value="">Select Category</option>
                      {reportCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Report *</label>
                    <select className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF4800] disabled:opacity-50" value={formData.reportId} onChange={(e) => handleReportChange(e.target.value)} disabled={!formData.category}>
                      <option value="">{formData.category ? 'Select Report' : 'Select Category First'}</option>
                      {(reportsByCategory[formData.category] || []).map(r => <option key={r.Id} value={r.Id}>{r.Name}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Dashboard *</label>
                  <select className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF4800]" value={formData.reportId} onChange={(e) => handleReportChange(e.target.value)}>
                    <option value="">Select Dashboard</option>
                    {(reportsByCategory['Dashboards'] || []).map(d => <option key={d.Id} value={d.Id}>{d.Name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Schedule Name *</label>
            <input type="text" className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF4800]" value={formData.scheduleName} onChange={(e) => setFormData(prev => ({ ...prev, scheduleName: e.target.value }))} placeholder="e.g. Weekly Executive Performance Email" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Frequency</label>
              <select className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF4800]" value={formData.type} onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}>
                <option>Hourly</option>
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Start Date & Time</label>
              <input type="datetime-local" className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF4800]" value={formData.startsOn} onChange={(e) => setFormData(prev => ({ ...prev, startsOn: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Export Format</label>
              <select className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF4800]" value={formData.format} onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value }))}>
                <option>Pdf</option>
                {formData.category === 'Dashboards' ? <option>Image</option> : <option>Word</option>}
                <option>Excel</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Recipients (Comma Separated)</label>
            <input type="text" className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF4800]" value={formData.recipients} onChange={(e) => setFormData(prev => ({ ...prev, recipients: e.target.value }))} placeholder="admin@company.com, analytics@company.com" />
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4 rounded text-[#FF4800] focus:ring-[#FF4800]" checked={formData.isEmailAttachment} onChange={(e) => setFormData(prev => ({ ...prev, isEmailAttachment: e.target.checked }))} />
              <span>Attach File to Email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4 rounded text-[#FF4800] focus:ring-[#FF4800]" checked={formData.enabled} onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))} />
              <span>Enable Schedule</span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition">Cancel</button>
          <button onClick={onSubmit} className="px-5 py-2 bg-[#FF4800] hover:bg-[#e03f00] text-white rounded-xl font-semibold text-xs transition shadow-sm">{isEdit ? 'Save Changes' : 'Create Schedule'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Schedules() {
  const { getSchedules, getReports, getDashboards, invalidate } = useData();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table'); // 'grid' | 'table'
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [categories, setCategories] = useState([]);
  const [reportsByCategory, setReportsByCategory] = useState({});
  const [runningId, setRunningId] = useState(null);

  // Filtering State
  const [activeScope, setActiveScope] = useState('all'); // 'all' | 'active' | 'paused'
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all'); // 'all' | 'report' | 'dashboard'
  
  // Column Sorting state
  const [sortColumn, setSortColumn] = useState('name'); // 'name' | 'reportName' | 'recurrenceType' | 'exportType' | 'enabled'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mainRef = useRef(null);

  const reloadSchedules = async () => {
    try {
      invalidate && invalidate('schedules');
      setLoading(true);
      const list = await getSchedules();
      setSchedules(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Error reloading schedules:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [list, tree, dashboards] = await Promise.all([
          getSchedules(),
          getReports(),
          getDashboards(),
        ]);

        setSchedules(Array.isArray(list) ? list : []);

        let reportTree = tree;
        if (!reportTree) {
          reportTree = [];
        } else if (!Array.isArray(reportTree)) {
          reportTree = (reportTree.Categories || reportTree.categories || []);
        }

        const cat = [];
        const map = {};

        if (Array.isArray(reportTree)) {
          reportTree.forEach(c => {
            const name = (c.Name || c.name || '').trim();
            if (name) {
              cat.push(name);
              map[name] = (c.Reports || c.reports || []).map(r => ({ Id: r.Id || r.id, Name: r.Name || r.name })).filter(r => r.Id);
            }
          });
        }

        if (Array.isArray(dashboards) && dashboards.length > 0) {
          const dashboardCategoryName = 'Dashboards';
          cat.push(dashboardCategoryName);
          map[dashboardCategoryName] = dashboards.map(d => ({
            Id: d.Id || d.id,
            Name: d.Name || d.name
          })).filter(d => d.Id);
        }

        setCategories(cat);
        setReportsByCategory(map);
      } catch (e) {
        console.error('Error loading schedules:', e);
        setCategories([]);
        setReportsByCategory({});
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [getSchedules, getReports, getDashboards]);

  const handleRunNow = async (id) => {
    setRunningId(id);
    try {
      await schedulesAPI.runNow(id);
      alert('Schedule execution triggered successfully!');
    } catch {
      alert('Failed to trigger execution.');
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) return;
    try {
      await schedulesAPI.delete(id);
      invalidate && invalidate('schedules');
      await reloadSchedules();
    } catch (err) {
      console.error('Delete schedule failed:', err);
      alert('Failed to delete schedule.');
    }
  };

  // Filtered schedules calculation
  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      if (!s) return false;
      const rawType = (s.itemType || s.ItemType || 'Report').toLowerCase();
      const isDashboard = rawType === 'dashboard';
      const enabled = s.enabled !== undefined ? s.enabled : (s.Enabled !== undefined ? s.Enabled : true);

      if (selectedTypeFilter === 'report' && isDashboard) return false;
      if (selectedTypeFilter === 'dashboard' && !isDashboard) return false;

      if (activeScope === 'active' && !enabled) return false;
      if (activeScope === 'paused' && enabled) return false;

      return true;
    }).sort((a, b) => {
      let valA = a[sortColumn] ?? a[sortColumn === 'name' ? 'Name' : sortColumn] ?? '';
      let valB = b[sortColumn] ?? b[sortColumn === 'name' ? 'Name' : sortColumn] ?? '';
      if (typeof valA === 'boolean') valA = valA ? 1 : 0;
      if (typeof valB === 'boolean') valB = valB ? 1 : 0;
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [schedules, selectedTypeFilter, activeScope, sortColumn, sortDirection]);

  return (
    <div className="reports-page font-inter bg-slate-50 dark:bg-[#111422] h-full flex flex-col overflow-hidden">
      {/* Modal Dialog */}
      {showModal && (
        <ScheduleModal
          schedule={editingSchedule}
          onClose={() => { setShowModal(false); setEditingSchedule(null); }}
          onSaved={reloadSchedules}
          categories={categories}
          reportsByCategory={reportsByCategory}
        />
      )}

      {/* Main Work Area (Sidebar + Content Workspace) */}
      <div className="reports-main flex-1 flex min-h-0 relative" ref={mainRef}>
        {/* Category / Type Sidebar */}
        <div
          className={`bg-white dark:bg-[#181c2c] border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-200 z-10 ${
            sidebarCollapsed ? 'w-0 overflow-hidden border-none' : ''
          }`}
          style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
        >
          {!sidebarCollapsed && (
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1">
                <span>Asset Types</span>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500 font-semibold">
                  {schedules.length}
                </span>
              </div>

              {/* All Types */}
              <button
                onClick={() => setSelectedTypeFilter('all')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${
                  selectedTypeFilter === 'all'
                    ? 'bg-orange-50 dark:bg-orange-950/40 text-[#FF4800]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FolderIcon className="w-4 h-4 text-orange-500" /> All Schedules
                </span>
                <span className="text-[11px] opacity-70 font-semibold">{schedules.length}</span>
              </button>

              <button
                onClick={() => setSelectedTypeFilter('report')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${
                  selectedTypeFilter === 'report'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <DocumentTextIcon className="w-4 h-4 text-indigo-500" /> Report Schedules
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {schedules.filter(s => (s.itemType || s.ItemType || '').toLowerCase() !== 'dashboard').length}
                </span>
              </button>

              <button
                onClick={() => setSelectedTypeFilter('dashboard')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${
                  selectedTypeFilter === 'dashboard'
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ChartBarIcon className="w-4 h-4 text-blue-500" /> Dashboard Schedules
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {schedules.filter(s => (s.itemType || s.ItemType || '').toLowerCase() === 'dashboard').length}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute top-3.5 z-30 flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow transition-all"
          style={{ left: sidebarCollapsed ? 12 : sidebarWidth - 14 }}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronRightIcon className={`w-3.5 h-3.5 text-slate-500 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
        </button>

        {/* Content View Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50 dark:bg-[#111422]">
          {/* Single Compact Action Bar */}
          <div className="px-6 py-3 flex items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-[#181c2c]/60 backdrop-blur-sm">
            {/* Scope Filter Pills */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-medium">
                <button
                  onClick={() => setActiveScope('all')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    activeScope === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All Statuses
                </button>
                <button
                  onClick={() => setActiveScope('active')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    activeScope === 'active'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Active Only
                </button>
                <button
                  onClick={() => setActiveScope('paused')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    activeScope === 'paused'
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Paused
                </button>
              </div>
            </div>

            {/* Right: View mode & Create Schedule */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-slate-700 text-[#FF4800] shadow-sm'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                  title="Grid View"
                >
                  <Squares2X2Icon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-700 text-[#FF4800] shadow-sm'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                  title="Table View"
                >
                  <ListBulletIcon className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => { setEditingSchedule(null); setShowModal(true); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#FF4800] hover:bg-[#e03f00] rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <PlusIcon className="w-4 h-4 stroke-[2.5]" />
                Create Schedule
              </button>
            </div>
          </div>

          {/* Main Content Grid / Table */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#FF4800] animate-spin mb-3" />
                <p className="text-xs text-slate-500">Loading Schedules...</p>
              </div>
            ) : filteredSchedules.length === 0 ? (
              <div className="bg-white dark:bg-[#181c2c] rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-md mx-auto space-y-3 mt-12">
                <ClockIcon className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">No Schedules Found</h3>
                <p className="text-xs text-slate-500">
                  No automated schedules match your filter criteria. Click below to create a new delivery schedule.
                </p>
                <button
                  onClick={() => { setSelectedTypeFilter('all'); setActiveScope('all'); }}
                  className="px-4 py-2 text-xs font-semibold text-[#FF4800] bg-orange-50 dark:bg-orange-950/40 rounded-xl hover:bg-orange-100 transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredSchedules.map(s => {
                  const id = s.id || s.Id;
                  const name = s.name || s.Name || 'Untitled Schedule';
                  const reportName = s.reportName || s.ReportName || '';
                  const rawType = s.itemType || s.ItemType || 'Report';
                  const isDashboard = rawType.toLowerCase() === 'dashboard';
                  const enabled = s.enabled !== undefined ? s.enabled : (s.Enabled !== undefined ? s.Enabled : true);
                  const nextSchedule = s.nextSchedule || s.NextSchedule;
                  const exportType = s.exportType || s.ExportType;
                  const recurrenceType = s.recurrenceType || s.RecurrenceType || 'Hourly';
                  const palette = getPalette(recurrenceType);

                  return (
                    <motion.div
                      key={id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white dark:bg-[#181c2c] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative hover:-translate-y-0.5"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className={`p-2.5 rounded-xl ${palette.iconBg} ${palette.iconColor} border ${palette.border}`}>
                            {isDashboard ? <ChartBarIcon className="w-5 h-5 stroke-[2]" /> : <DocumentTextIcon className="w-5 h-5 stroke-[2]" />}
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            enabled
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {enabled ? 'Active' : 'Paused'}
                          </span>
                        </div>

                        <div>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${palette.bg} ${palette.text} border ${palette.border}`}>
                            {recurrenceType} • {mapExportType(exportType)}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2 group-hover:text-[#FF4800] transition-colors truncate">
                            {name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {reportName || 'Automated Delivery'}
                          </p>
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
                          <div className="flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">Next Run: {nextSchedule ? new Date(nextSchedule).toLocaleDateString() : 'Scheduled'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <UserGroupIcon className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">Recipients: {Array.isArray(s.ExternalRecipientsList) && s.ExternalRecipientsList.length > 0 ? s.ExternalRecipientsList.length : 'Configured'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                        <button
                          onClick={() => handleRunNow(id)}
                          disabled={runningId === id}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition shadow-sm"
                        >
                          <PlayIcon className="w-3.5 h-3.5" />
                          {runningId === id ? 'Running...' : 'Run Now'}
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditingSchedule(s); setShowModal(true); }}
                            className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                            title="Edit Schedule"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                            title="Delete Schedule"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* TABLE VIEW */
              <div className="bg-white dark:bg-[#181c2c] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-900/50 select-none">
                      <th className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors" onClick={() => handleSort('name')}>
                        <div className="flex items-center gap-1.5">
                          <span>Schedule Name</span>
                          {sortColumn === 'name' ? (
                            <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors" onClick={() => handleSort('reportName')}>
                        <div className="flex items-center gap-1.5">
                          <span>Asset</span>
                          {sortColumn === 'reportName' ? (
                            <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors" onClick={() => handleSort('recurrenceType')}>
                        <div className="flex items-center gap-1.5">
                          <span>Frequency</span>
                          {sortColumn === 'recurrenceType' ? (
                            <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors" onClick={() => handleSort('exportType')}>
                        <div className="flex items-center gap-1.5">
                          <span>Format</span>
                          {sortColumn === 'exportType' ? (
                            <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors" onClick={() => handleSort('enabled')}>
                        <div className="flex items-center gap-1.5">
                          <span>Status</span>
                          {sortColumn === 'enabled' ? (
                            <span className="text-[#FF4800]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-normal">↕</span>
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                    {filteredSchedules.map(s => {
                      const id = s.id || s.Id;
                      const name = s.name || s.Name || 'Untitled Schedule';
                      const reportName = s.reportName || s.ReportName || '';
                      const rawType = s.itemType || s.ItemType || 'Report';
                      const isDashboard = rawType.toLowerCase() === 'dashboard';
                      const enabled = s.enabled !== undefined ? s.enabled : (s.Enabled !== undefined ? s.Enabled : true);
                      const exportType = s.exportType || s.ExportType;
                      const recurrenceType = s.recurrenceType || s.RecurrenceType || 'Hourly';
                      const palette = getPalette(recurrenceType);

                      return (
                        <tr key={id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2.5">
                              {isDashboard ? <ChartBarIcon className="w-4 h-4 text-blue-500" /> : <DocumentTextIcon className="w-4 h-4 text-orange-500" />}
                              <span>{name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-500">{reportName || 'Asset'}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${palette.bg} ${palette.text} border ${palette.border}`}>
                              {recurrenceType}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">{mapExportType(exportType)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              enabled ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {enabled ? 'Active' : 'Paused'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleRunNow(id)}
                                disabled={runningId === id}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium"
                              >
                                {runningId === id ? '...' : 'Run'}
                              </button>
                              <button
                                onClick={() => { setEditingSchedule(s); setShowModal(true); }}
                                className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(id)}
                                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}