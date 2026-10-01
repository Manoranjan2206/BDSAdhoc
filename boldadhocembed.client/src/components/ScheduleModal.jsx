import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { schedulesAPI } from '../services/apiService';
import { authService } from '../services/authService';
import { toLocalInputValue } from '../utils/dateUtils';
import { cleanScheduleName, exportCodeToKey } from '../utils/scheduleUtils';

export default function ScheduleModal({ schedule, onClose, onSaved, categories = [], reportsByCategory = {} }) {
  const isEdit = !!schedule;
  const title = isEdit ? `Edit Schedule – ${cleanScheduleName(schedule.reportName || schedule.name || 'Asset')}` : 'Create New Schedule';

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

  const currentUser = authService.getUser();
  const defaultRecipients = currentUser?.email || 'admin@alphacorp.com';

  const [formData, setFormData] = useState({
    category: initialCategory,
    reportId: initialReportId,
    reportName: initialReportName,
    scheduleName: isEdit ? cleanScheduleName(schedule.name || '') : '',
    enabled: isEdit ? !!schedule.enabled : true,
    type: schedule?.recurrenceType || schedule?.scheduleType || 'Hourly',
    startsOn: schedule?.startDate || schedule?.startTime || toLocalInputValue(),
    endsMode: schedule?.neverEnd ? 'never' : (schedule?.endAfterOccurrence > 0 ? 'after' : 'on'),
    afterOccurrences: schedule?.endAfterOccurrence || 1,
    endDate: schedule?.endDate || '',
    hourlyInterval: schedule?.hourlySchedule?.scheduleInterval || '00:15',
    format: isEdit ? exportCodeToKey(schedule?.exportType) : 'Pdf',
    recipients: isEdit && schedule.externalRecipientsList && schedule.externalRecipientsList.length > 0 ? schedule.externalRecipientsList.join(', ') : defaultRecipients,
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

    const recipientList = (formData.recipients || '')
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    if (recipientList.length === 0) {
      recipientList.push(defaultRecipients);
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
      ExternalRecipientsList: recipientList,
      ScheduleType: formData.type,
    };

    if (formData.type === 'Hourly') {
      payload.HourlySchedule = { ScheduleInterval: formData.hourlyInterval || '01:00' };
    } else if (formData.type === 'Weekly') {
      payload.WeeklySchedule = {
        RecurrenceWeeks: 1,
        RecurrenceDays: ['Monday']
      };
    } else if (formData.type === 'Monthly') {
      payload.MonthlySchedule = {
        RecurrenceType: 'DayRecurrence',
        DayRecurrence: {
          DayInterval: 1,
          MonthInterval: 1
        }
      };
    } else {
      payload.DailySchedule = {
        RecurrenceType: 'EveryNdays',
        EveryNdays: 1,
        EveryWeekday: false
      };
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

  return createPortal(
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
    </div>,
    document.body
  );
}
