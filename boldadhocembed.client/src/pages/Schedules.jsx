import { useEffect, useState } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
  CalendarIcon,
  ClockIcon,
  EnvelopeIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ViewColumnsIcon,
  TableCellsIcon,
  Squares2X2Icon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChartBarIcon,
  XMarkIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { schedulesAPI } from '../services/apiService';
import { useData } from '../context/DataContext';

const VIEW_MODES = {
  CARD: 'card',
  LIST: 'list',
  TABLE: 'table',
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

  const title = isEdit
    ? `Edit Schedule – ${schedule.reportName || 'Asset'}`
    : 'Create New Schedule';

  // Robust category matching
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
    dailyRecurrence: 'everyN',
    dailyEveryN: 1,
    weeklyEveryN: 1,
    weeklyDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
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

      console.log('Schedule save attempt', { isEdit, scheduleId, payload });

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-100 flex flex-col transform scale-100 transition-transform">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 text-white p-6 flex justify-between items-center rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            <p className="text-xs text-indigo-100 mt-1">Configure automated delivery rules and formats</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Target Asset Group */}
          <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100/50 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Target Asset</h3>
              <div className="flex bg-gray-200/60 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => handleAssetTypeChange('Report')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${assetType === 'Report' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Report
                </button>
                <button
                  type="button"
                  onClick={() => handleAssetTypeChange('Dashboard')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${assetType === 'Dashboard' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Dashboard
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assetType === 'Report' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Report Category *</label>
                    <select className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.category} onChange={(e) => handleCategoryChange(e.target.value)}>
                      <option value="">Select Category</option>
                      {reportCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Report *</label>
                    <select className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400" value={formData.reportId} onChange={(e) => handleReportChange(e.target.value)} disabled={!formData.category}>
                      <option value="">{formData.category ? 'Select Report' : 'Select Category First'}</option>
                      {(reportsByCategory[formData.category] || []).map(r => <option key={r.Id} value={r.Id}>{r.Name}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Dashboard *</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.reportId} onChange={(e) => handleReportChange(e.target.value)}>
                    <option value="">Select Dashboard</option>
                    {(reportsByCategory['Dashboards'] || []).map(d => <option key={d.Id} value={d.Id}>{d.Name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Schedule Info */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-700">General Information</h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Schedule Name *</label>
              <input type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.scheduleName} onChange={(e) => setFormData(prev => ({ ...prev, scheduleName: e.target.value }))} placeholder="e.g. Weekly Executive Dashboard Email" />
            </div>
          </div>

          {/* Recurrence Pattern */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Recurrence Pattern</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Frequency Type</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.type} onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}>
                  <option>Hourly</option>
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Monthly</option>
                  <option>Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Start Date & Time *</label>
                <input type="datetime-local" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.startsOn} onChange={(e) => setFormData(prev => ({ ...prev, startsOn: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">End Options</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.endsMode} onChange={(e) => setFormData(prev => ({ ...prev, endsMode: e.target.value }))}>
                  <option value="never">Never End</option>
                  <option value="after">End After Occurrences</option>
                  <option value="on">End On Date</option>
                </select>
              </div>
            </div>

            {/* Custom Conditional recurrence options */}
            <div className="grid grid-cols-1 gap-4 pt-1">
              {formData.type === 'Hourly' && (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center gap-3">
                  <ClockIcon className="w-5 h-5 text-indigo-500" />
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600">Hourly Interval</label>
                    <select className="mt-1 border border-gray-200 rounded px-2 py-1 bg-white text-xs" value={formData.hourlyInterval} onChange={(e) => setFormData(prev => ({ ...prev, hourlyInterval: e.target.value }))}>
                      <option value="00:15">Every 15 minutes</option>
                      <option value="00:30">Every 30 minutes</option>
                      <option value="01:00">Every 1 hour</option>
                      <option value="02:00">Every 2 hours</option>
                      <option value="04:00">Every 4 hours</option>
                      <option value="08:00">Every 8 hours</option>
                      <option value="12:00">Every 12 hours</option>
                    </select>
                  </div>
                </div>
              )}

              {formData.endsMode === 'after' && (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600">End After Occurrences</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="number" min="1" className="border border-gray-200 rounded px-2 py-1 text-xs w-20" value={formData.afterOccurrences} onChange={(e) => setFormData(prev => ({ ...prev, afterOccurrences: e.target.value }))} />
                      <span className="text-xs text-gray-500">runs</span>
                    </div>
                  </div>
                </div>
              )}

              {formData.endsMode === 'on' && (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600">End On Date & Time</label>
                    <input type="datetime-local" className="mt-1 border border-gray-200 rounded px-2 py-1 text-xs" value={formData.endDate} onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Delivery & Formats */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-700">Delivery Options</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Export Format</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.format} onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value }))}>
                  <option>Pdf</option>
                  {formData.category === 'Dashboards' ? <option>Image</option> : <option>Word</option>}
                  <option>Excel</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Recipients (Comma Separated)</label>
                <input type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={formData.recipients} onChange={(e) => setFormData(prev => ({ ...prev, recipients: e.target.value }))} placeholder="ceo@company.com, support@company.com" />
              </div>
            </div>

            <div className="flex items-center gap-6 bg-purple-50/50 p-4 rounded-xl border border-purple-100/50">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" className="w-4.5 h-4.5 rounded text-purple-600 focus:ring-purple-500 border-gray-300" checked={formData.isEmailAttachment} onChange={(e) => setFormData(prev => ({ ...prev, isEmailAttachment: e.target.checked }))} />
                <span className="text-sm font-medium text-gray-700">Send output file as email attachment</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" className="w-4.5 h-4.5 rounded text-purple-600 focus:ring-purple-500 border-gray-300" checked={formData.enabled} onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))} />
                <span className="text-sm font-medium text-gray-700">Enable Schedule Immediately</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg font-medium text-sm transition">Cancel</button>
          <button onClick={onSubmit} className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white rounded-lg font-semibold text-sm shadow-md transition transform active:scale-95">{isEdit ? 'Save Changes' : 'Create Schedule'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Schedules() {
  const { getSchedules, getReports, getDashboards, invalidate } = useData();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(VIEW_MODES.CARD);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [categories, setCategories] = useState([]);
  const [reportsByCategory, setReportsByCategory] = useState({});
  const [runningId, setRunningId] = useState(null);

  // Filters & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('All'); // 'All' | 'Report' | 'Dashboard'
  const [selectedStatus, setSelectedStatus] = useState('All'); // 'All' | 'Active' | 'Paused'
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'nextRun' | 'status'

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
      alert('Schedule deleted.');
    } catch (err) {
      console.error('Delete schedule failed:', err);
      alert('Failed to delete schedule.');
    }
  };

  // KPI Calculations
  const totalCount = schedules.length;
  const activeCount = schedules.filter(s => {
    const enabled = s?.enabled !== undefined ? s.enabled : s?.Enabled;
    return !!enabled;
  }).length;
  const reportCount = schedules.filter(s => {
    const type = s?.itemType || s?.ItemType || '';
    return type.toLowerCase() === 'report' || type.toLowerCase() === 'schedule';
  }).length;
  const dashboardCount = schedules.filter(s => {
    const type = s?.itemType || s?.ItemType || '';
    return type.toLowerCase() === 'dashboard';
  }).length;

  // Search & Filter & Sort application
  const filteredSchedules = schedules
    .filter(s => {
      if (!s) return false;
      
      const name = s.name || s.Name || '';
      const reportName = s.reportName || s.ReportName || '';
      const description = s.description || s.Description || '';
      const itemType = s.itemType || s.ItemType || 'Report';
      const enabled = s.enabled !== undefined ? s.enabled : (s.Enabled !== undefined ? s.Enabled : true);

      const search = searchTerm.toLowerCase();
      const matchSearch = name.toLowerCase().includes(search) || 
                          reportName.toLowerCase().includes(search) ||
                          description.toLowerCase().includes(search);
      
      const isTypeReport = itemType.toLowerCase() === 'report' || itemType.toLowerCase() === 'schedule';
      const isTypeDashboard = itemType.toLowerCase() === 'dashboard';

      let matchType = false;
      if (selectedType === 'All') {
        matchType = true;
      } else if (selectedType === 'Report') {
        matchType = isTypeReport;
      } else if (selectedType === 'Dashboard') {
        matchType = isTypeDashboard;
      }

      const matchStatus = selectedStatus === 'All' || 
                          (selectedStatus === 'Active' && enabled) ||
                          (selectedStatus === 'Paused' && !enabled);

      return matchSearch && matchType && matchStatus;
    })
    .sort((a, b) => {
      const nameA = a?.name || a?.Name || '';
      const nameB = b?.name || b?.Name || '';
      if (sortBy === 'name') {
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'nextRun') {
        const nextA = a?.nextSchedule || a?.NextSchedule || 0;
        const nextB = b?.nextSchedule || b?.NextSchedule || 0;
        const dateA = nextA ? new Date(nextA).getTime() : 0;
        const dateB = nextB ? new Date(nextB).getTime() : 0;
        return dateA - dateB;
      }
      if (sortBy === 'status') {
        const enabledA = a?.enabled !== undefined ? a.enabled : a?.Enabled;
        const enabledB = b?.enabled !== undefined ? b.enabled : b?.Enabled;
        return (enabledA === enabledB) ? 0 : enabledA ? -1 : 1;
      }
      return 0;
    });

  const renderCard = (s) => {
    if (!s) return null;
    const id = s.id || s.Id;
    const name = s.name || s.Name || 'Untitled Schedule';
    const reportName = s.reportName || s.ReportName || '';
    const description = s.description || s.Description || '';
    const rawType = s.itemType || s.ItemType || 'Report';
    const isDashboard = rawType.toLowerCase() === 'dashboard';
    const enabled = s.enabled !== undefined ? s.enabled : (s.Enabled !== undefined ? s.Enabled : true);
    const nextSchedule = s.nextSchedule || s.NextSchedule;
    const exportType = s.exportType || s.ExportType;
    const recurrenceType = s.recurrenceType || s.RecurrenceType || 'Hourly';

    return (
      <div key={id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden relative">
        <div className="absolute top-4 right-4 flex gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${
            enabled 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}>
            {enabled ? 'Active' : 'Paused'}
          </span>
        </div>

        <div className="p-6 space-y-4">
          <div>
            {isDashboard ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-cyan-50 text-cyan-700 border border-cyan-100">
                <ChartBarIcon className="w-3.5 h-3.5" />
                Dashboard
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                <DocumentTextIcon className="w-3.5 h-3.5" />
                Report
              </span>
            )}
          </div>

          <div>
            <h3 className="font-bold text-lg text-gray-800 line-clamp-1 group-hover:text-indigo-600 transition-colors duration-200" title={name}>{name}</h3>
            <p className="text-xs font-medium text-gray-500 mt-0.5 line-clamp-1">{reportName}</p>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-gray-400" />
              <span>Recurrence: <span className="font-medium text-gray-800">{recurrenceType}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-gray-400" />
              <span className="truncate">Next Run: <span className="font-medium text-gray-800">{nextSchedule ? new Date(nextSchedule).toLocaleString() : '—'}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <EnvelopeIcon className="w-4 h-4 text-gray-400" />
              <span>Format: <span className="font-semibold text-indigo-600">{mapExportType(exportType)}</span></span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50/80 px-6 py-4 border-t border-gray-100 flex justify-between items-center gap-3">
          <button
            onClick={() => handleRunNow(id)}
            disabled={runningId === id}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95"
          >
            <PlayIcon className="w-4 h-4" />
            {runningId === id ? 'Running...' : 'Run Now'}
          </button>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => { setEditingSchedule(s); setShowModal(true); }} 
              className="p-2 text-indigo-600 hover:bg-indigo-100/50 rounded-lg transition"
              title="Edit Schedule"
            >
              <PencilIcon className="w-4.5 h-4.5" />
            </button>
            <button 
              onClick={() => handleDelete(id)} 
              className="p-2 text-rose-600 hover:bg-rose-100/50 rounded-lg transition"
              title="Delete Schedule"
            >
              <TrashIcon className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-gray-50/50 space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-gray-200/80 p-6 rounded-2xl shadow-sm gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            Schedules Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">Configure and manage automatic e-mail delivery schedules for both Reports and Dashboards</p>
        </div>
        <button
          onClick={() => { setEditingSchedule(null); setShowModal(true); }}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white rounded-xl font-semibold text-sm shadow-md transition transform active:scale-95"
        >
          <PlusIcon className="w-5 h-5" />
          Create Schedule
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Schedules</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-0.5">{totalCount}</h3>
          </div>
        </div>

        <div className="bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
            <CheckCircleIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Deliveries</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-0.5">{activeCount}</h3>
          </div>
        </div>

        <div className="bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-100 text-purple-600">
            <DocumentTextIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Report Schedules</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-0.5">{reportCount}</h3>
          </div>
        </div>

        <div className="bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-cyan-50 rounded-xl border border-cyan-100 text-cyan-600">
            <ChartBarIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dashboard Schedules</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-0.5">{dashboardCount}</h3>
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-white border border-gray-200/80 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <MagnifyingGlassIcon className="w-5 h-5" />
          </span>
          <input
            type="text"
            className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50/50"
            placeholder="Search schedules by name or asset..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters and View Toggles */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Asset Type Filters */}
          <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
            {['All', 'Report', 'Dashboard'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                  selectedType === type
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {type === 'All' ? 'All Types' : type + 's'}
              </button>
            ))}
          </div>

          {/* Status Selection */}
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Paused">Paused Only</option>
          </select>

          {/* Sort Selection */}
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name">Sort by Name</option>
            <option value="nextRun">Sort by Next Run</option>
            <option value="status">Sort by Status</option>
          </select>

          {/* View Mode buttons */}
          <div className="border-l border-gray-200 pl-4 flex gap-1">
            <button
              onClick={() => setViewMode(VIEW_MODES.CARD)}
              className={`p-2 rounded-lg transition ${
                viewMode === VIEW_MODES.CARD ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Squares2X2Icon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode(VIEW_MODES.LIST)}
              className={`p-2 rounded-lg transition ${
                viewMode === VIEW_MODES.LIST ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <ViewColumnsIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode(VIEW_MODES.TABLE)}
              className={`p-2 rounded-lg transition ${
                viewMode === VIEW_MODES.TABLE ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <TableCellsIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white border border-gray-200 p-16 rounded-2xl text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-500 font-medium text-sm">Retrieving combined schedules list...</p>
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="bg-white border border-gray-200 p-16 rounded-2xl text-center space-y-4 max-w-xl mx-auto">
          <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto" />
          <div>
            <h3 className="font-bold text-lg text-gray-800">No schedules matched</h3>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or search terms, or create a new delivery schedule ruleset.</p>
          </div>
          <button
            onClick={() => { setEditingSchedule(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition"
          >
            <PlusIcon className="w-4 h-4" />
            Create First Schedule
          </button>
        </div>
      ) : viewMode === VIEW_MODES.CARD ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSchedules.map(renderCard)}
        </div>
      ) : viewMode === VIEW_MODES.LIST ? (
        <div className="space-y-4">
          {filteredSchedules.map(s => {
            if (!s) return null;
            const id = s.id || s.Id;
            const name = s.name || s.Name || 'Untitled Schedule';
            const reportName = s.reportName || s.ReportName || '';
            const rawType = s.itemType || s.ItemType || 'Report';
            const isDashboard = rawType.toLowerCase() === 'dashboard';
            const displayType = isDashboard ? 'Dashboard' : 'Report';
            const enabled = s.enabled !== undefined ? s.enabled : (s.Enabled !== undefined ? s.Enabled : true);
            const nextSchedule = s.nextSchedule || s.NextSchedule;
            const exportType = s.exportType || s.ExportType;
            const recurrenceType = s.recurrenceType || s.RecurrenceType || 'Hourly';

            return (
              <div key={id} className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition duration-200 border-l-4 ${isDashboard ? 'border-l-cyan-500' : 'border-l-indigo-500'}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-800">{name}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isDashboard ? 'bg-cyan-50 text-cyan-700' : 'bg-indigo-50 text-indigo-700'}`}>{displayType}</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-400">{reportName} • Format: {mapExportType(exportType)}</p>
                  <div className="flex gap-4 text-xs text-gray-500 pt-1">
                    <span>Recurrence: <span className="font-medium text-gray-700">{recurrenceType}</span></span>
                    <span>Next Run: <span className="font-medium text-gray-700">{nextSchedule ? new Date(nextSchedule).toLocaleString() : '—'}</span></span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleRunNow(id)}
                    disabled={runningId === id}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-semibold rounded-lg transition"
                  >
                    {runningId === id ? 'Running...' : 'Run Now'}
                  </button>
                  <button 
                    onClick={() => { setEditingSchedule(s); setShowModal(true); }}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200 font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Asset Type</th>
                  <th className="px-6 py-4">Target Name</th>
                  <th className="px-6 py-4">Next Run</th>
                  <th className="px-6 py-4">Format</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSchedules.map(s => {
                  if (!s) return null;
                  const id = s.id || s.Id;
                  const name = s.name || s.Name || 'Untitled Schedule';
                  const reportName = s.reportName || s.ReportName || '';
                  const rawType = s.itemType || s.ItemType || 'Report';
                  const isDashboard = rawType.toLowerCase() === 'dashboard';
                  const displayType = isDashboard ? 'Dashboard' : 'Report';
                  const enabled = s.enabled !== undefined ? s.enabled : (s.Enabled !== undefined ? s.Enabled : true);
                  const nextSchedule = s.nextSchedule || s.NextSchedule;
                  const exportType = s.exportType || s.ExportType;

                  return (
                    <tr key={id} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-bold text-gray-800">{name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold ${isDashboard ? 'bg-cyan-50 text-cyan-700 border border-cyan-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>{displayType}</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-600">{reportName}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-gray-700">{nextSchedule ? new Date(nextSchedule).toLocaleString() : '—'}</td>
                      <td className="px-6 py-4 font-semibold text-indigo-600">{mapExportType(exportType)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${enabled ? 'text-emerald-700 bg-emerald-50' : 'text-gray-600 bg-gray-100'}`}>{enabled ? 'Active' : 'Paused'}</span>
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-3 items-center">
                        <button onClick={() => handleRunNow(id)} disabled={runningId === id} className="text-emerald-600 hover:text-emerald-700 font-semibold text-xs disabled:opacity-50">Run</button>
                        <button onClick={() => { setEditingSchedule(s); setShowModal(true); }} className="text-indigo-600 hover:text-indigo-900"><PencilIcon className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(id)} className="text-rose-600 hover:text-rose-900"><TrashIcon className="w-4.5 h-4.5" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ScheduleModal
          schedule={editingSchedule}
          categories={categories}
          reportsByCategory={reportsByCategory}
          onClose={() => { setShowModal(false); setEditingSchedule(null); }}
          onSaved={reloadSchedules}
        />
      )}
    </div>
  );
}