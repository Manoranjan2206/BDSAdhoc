import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  XMarkIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { schedulesAPI } from '../services/apiService';
import { authService } from '../services/authService';
import { toLocalInputValue } from '../utils/dateUtils';
import { cleanScheduleName, exportCodeToKey } from '../utils/scheduleUtils';

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORT_EXPORT_FORMATS = [
  { id: 'PDF',   label: 'PDF',   icon: '📄' },
  { id: 'Excel', label: 'Excel', icon: '📊' },
  { id: 'CSV',   label: 'CSV',   icon: '📋' },
  { id: 'Word',  label: 'Word',  icon: '📝' },
  { id: 'HTML',  label: 'HTML',  icon: '🌐' },
  { id: 'PPT',   label: 'PPT',   icon: '🎞' },
];

const DASHBOARD_EXPORT_FORMATS = [
  { id: 'PDF',   label: 'PDF',   icon: '📄' },
  { id: 'Image', label: 'Image', icon: '🖼' },
  { id: 'Excel', label: 'Excel', icon: '📊' },
];

const SCHEDULE_TYPES = ['Hourly', 'Daily', 'Weekly', 'Monthly', 'Yearly'];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEK_OF_MONTH = ['first', 'second', 'third', 'fourth', 'last'];

const DAY_OF_WEEK_OPTIONS = ['day', 'weekday', ...WEEKDAYS];

function formatStartDateTime(startsOn) {
  if (!startsOn) return '';
  try {
    const d = new Date(startsOn);
    if (isNaN(d.getTime())) return startsOn;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return startsOn;
  }
}

/** Build a human-readable recurrence summary */
function buildSummary({
  scheduleType,
  hourlyHours,
  hourlyMinutes,
  dailyMode,
  dailyEveryN,
  weeklyEveryN,
  weeklyDays,
  monthlyMode,
  monthlyDayInterval,
  monthlyMonthInterval,
  monthlyCustomWeek,
  monthlyCustomDay,
  monthlyCustomMonth,
  yearlyEveryN,
  yearlyMode,
  yearlyMonth,
  yearlyDayOfMonth,
  yearlyCustomWeek,
  yearlyCustomDay,
  startsOn,
}) {
  const timeLabel = formatStartDateTime(startsOn);

  if (scheduleType === 'Hourly') {
    const parts = [];
    if (hourlyHours > 0) parts.push(`${hourlyHours} hr${hourlyHours > 1 ? 's' : ''}`);
    if (hourlyMinutes > 0) parts.push(`${hourlyMinutes} min${hourlyMinutes > 1 ? 's' : ''}`);
    const intervalStr = parts.length > 0 ? parts.join(' ') : '1 hr';
    return `Every ${intervalStr}, starting on ${timeLabel}`;
  }
  if (scheduleType === 'Daily') {
    if (dailyMode === 'weekday') return `Every weekday (Mon-Fri), starting on ${timeLabel}`;
    return `Every ${dailyEveryN} day(s), starting on ${timeLabel}`;
  }
  if (scheduleType === 'Weekly') {
    const days = weeklyDays.length ? weeklyDays.map(d => d.slice(0, 3)).join(', ') : '—';
    return `Every ${weeklyEveryN} week(s) on ${days}, starting on ${timeLabel}`;
  }
  if (scheduleType === 'Monthly') {
    if (monthlyMode === 'day') return `Day ${monthlyDayInterval} of every ${monthlyMonthInterval} month(s), starting on ${timeLabel}`;
    return `The ${monthlyCustomWeek} ${monthlyCustomDay} of every ${monthlyCustomMonth} month(s), starting on ${timeLabel}`;
  }
  if (scheduleType === 'Yearly') {
    if (yearlyMode === 'month') return `${yearlyMonth} ${yearlyDayOfMonth}, every ${yearlyEveryN} year(s), starting on ${timeLabel}`;
    return `The ${yearlyCustomWeek} ${yearlyCustomDay} of ${yearlyMonth}, every ${yearlyEveryN} year(s), starting on ${timeLabel}`;
  }
  return '';
}

export default function ScheduleModal({
  schedule,
  onClose,
  onSaved,
  categories = [],
  reportsByCategory = {},
}) {
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
  let initialReportId = isEdit ? schedule.itemId || schedule.ItemId || '' : '';
  let initialReportName = isEdit ? schedule.reportName || schedule.ReportName || schedule.description || schedule.Description || '' : '';

  if (isEdit && initialReportId) {
    const matched = reportsInCat.find(r => r.Id === initialReportId);
    if (matched) initialReportName = matched.Name;
  }

  const [assetType, setAssetType] = useState(isDashboardInit ? 'Dashboard' : 'Report');
  const reportCategories = categories.filter(c => c !== 'Dashboards');

  const currentUser = authService.getUser()?.user || authService.getUser();
  const defaultRecipients = currentUser?.email || 'admin@alphacorp.com';

  // Form states
  const [category, setCategory] = useState(initialCategory || (assetType === 'Dashboard' ? 'Dashboards' : reportCategories[0] || ''));
  const [reportId, setReportId] = useState(initialReportId);
  const [reportName, setReportName] = useState(initialReportName);
  const [scheduleName, setScheduleName] = useState(isEdit ? cleanScheduleName(schedule.name || schedule.Name || '') : '');
  const [isEnabled, setIsEnabled] = useState(schedule ? (schedule.enabled !== undefined ? !!schedule.enabled : (schedule.Enabled !== undefined ? !!schedule.Enabled : true)) : true);
  const [exportFormat, setExportFormat] = useState(isEdit ? exportCodeToKey(schedule?.exportType || schedule?.ExportType) : 'PDF');

  // Recurrence states
  const rawType = schedule?.recurrenceType || schedule?.scheduleType || schedule?.ScheduleType || 'Daily';
  const matchedType = SCHEDULE_TYPES.find(t => t.toLowerCase() === rawType.toLowerCase()) || 'Daily';
  const [scheduleType, setScheduleType] = useState(matchedType);

  // Hourly
  const [hourlyHours, setHourlyHours] = useState(() => {
    const interval = schedule?.hourlySchedule?.scheduleInterval || schedule?.HourlySchedule?.ScheduleInterval;
    if (interval) {
      const h = Number(String(interval).split(':')[0]);
      return isNaN(h) ? 1 : h;
    }
    return 1;
  });
  const [hourlyMinutes, setHourlyMinutes] = useState(() => {
    const interval = schedule?.hourlySchedule?.scheduleInterval || schedule?.HourlySchedule?.ScheduleInterval;
    if (interval) {
      const m = Number(String(interval).split(':')[1]);
      return isNaN(m) ? 0 : m;
    }
    return 0;
  });

  // Daily
  const [dailyMode, setDailyMode] = useState(() => {
    const ds = schedule?.dailySchedule || schedule?.DailySchedule;
    return (ds?.recurrenceType === 'EveryWeekday' || ds?.everyWeekday) ? 'weekday' : 'everyN';
  });
  const [dailyEveryN, setDailyEveryN] = useState(() => {
    const ds = schedule?.dailySchedule || schedule?.DailySchedule;
    return ds?.everyNdays || ds?.EveryNdays || 1;
  });

  // Weekly
  const [weeklyEveryN, setWeeklyEveryN] = useState(() => {
    const ws = schedule?.weeklySchedule || schedule?.WeeklySchedule;
    return ws?.recurrenceWeeks || ws?.RecurrenceWeeks || 1;
  });
  const [weeklyDays, setWeeklyDays] = useState(() => {
    const ws = schedule?.weeklySchedule || schedule?.WeeklySchedule;
    return Array.isArray(ws?.recurrenceDays || ws?.RecurrenceDays) && (ws.recurrenceDays || ws.RecurrenceDays).length > 0
      ? (ws.recurrenceDays || ws.RecurrenceDays)
      : ['Monday'];
  });

  // Monthly
  const [monthlyMode, setMonthlyMode] = useState(() => {
    const ms = schedule?.monthlySchedule || schedule?.MonthlySchedule;
    return (ms?.recurrenceType === 'CustomRecurrence' || ms?.customRecurrence) ? 'custom' : 'day';
  });
  const [monthlyDayInterval, setMonthlyDayInterval] = useState(() => {
    const ms = schedule?.monthlySchedule || schedule?.MonthlySchedule;
    return ms?.dayRecurrence?.dayInterval || ms?.DayRecurrence?.DayInterval || 1;
  });
  const [monthlyMonthInterval, setMonthlyMonthInterval] = useState(() => {
    const ms = schedule?.monthlySchedule || schedule?.MonthlySchedule;
    return ms?.dayRecurrence?.monthInterval || ms?.DayRecurrence?.MonthInterval || 1;
  });
  const [monthlyCustomWeek, setMonthlyCustomWeek] = useState(() => {
    const ms = schedule?.monthlySchedule || schedule?.MonthlySchedule;
    return ms?.customRecurrence?.weekOfMonth || ms?.CustomRecurrence?.WeekOfMonth || 'first';
  });
  const [monthlyCustomDay, setMonthlyCustomDay] = useState(() => {
    const ms = schedule?.monthlySchedule || schedule?.MonthlySchedule;
    return ms?.customRecurrence?.dayOfWeek || ms?.CustomRecurrence?.DayOfWeek || 'Monday';
  });
  const [monthlyCustomMonth, setMonthlyCustomMonth] = useState(() => {
    const ms = schedule?.monthlySchedule || schedule?.MonthlySchedule;
    return ms?.customRecurrence?.monthInterval || ms?.CustomRecurrence?.MonthInterval || 1;
  });

  // Yearly
  const [yearlyEveryN, setYearlyEveryN] = useState(() => {
    const ys = schedule?.yearlySchedule || schedule?.YearlySchedule;
    return ys?.yearInterval || ys?.YearInterval || 1;
  });
  const [yearlyMode, setYearlyMode] = useState(() => {
    const ys = schedule?.yearlySchedule || schedule?.YearlySchedule;
    return (ys?.recurrenceType === 'CustomRecurrence' || ys?.customRecurrence) ? 'custom' : 'month';
  });
  const [yearlyMonth, setYearlyMonth] = useState(() => {
    const ys = schedule?.yearlySchedule || schedule?.YearlySchedule;
    return ys?.monthRecurrence?.monthOfYear || ys?.MonthRecurrence?.MonthOfYear || 'January';
  });
  const [yearlyDayOfMonth, setYearlyDayOfMonth] = useState(() => {
    const ys = schedule?.yearlySchedule || schedule?.YearlySchedule;
    return ys?.monthRecurrence?.dayOfMonth || ys?.MonthRecurrence?.DayOfMonth || 1;
  });
  const [yearlyCustomWeek, setYearlyCustomWeek] = useState(() => {
    const ys = schedule?.yearlySchedule || schedule?.YearlySchedule;
    return ys?.customRecurrence?.weekOfMonth || ys?.CustomRecurrence?.WeekOfMonth || 'first';
  });
  const [yearlyCustomDay, setYearlyCustomDay] = useState(() => {
    const ys = schedule?.yearlySchedule || schedule?.YearlySchedule;
    return ys?.customRecurrence?.dayOfWeek || ys?.CustomRecurrence?.DayOfWeek || 'Monday';
  });
  const [yearlyCustomMonth, setYearlyCustomMonth] = useState(() => {
    const ys = schedule?.yearlySchedule || schedule?.YearlySchedule;
    return ys?.customRecurrence?.monthOfYear || ys?.CustomRecurrence?.MonthOfYear || 'January';
  });

  // StartsOn & Ends
  const [startsOn, setStartsOn] = useState(() => {
    const raw = schedule?.startDate || schedule?.startTime || schedule?.StartDate || schedule?.StartTime;
    return raw ? toLocalInputValue(raw) : toLocalInputValue();
  });
  const [endsMode, setEndsMode] = useState(() => {
    if (schedule?.neverEnd !== undefined || schedule?.NeverEnd !== undefined) {
      return (schedule.neverEnd ?? schedule.NeverEnd) ? 'never' : ((schedule.endAfterOccurrence || schedule.EndAfterOccurrence) > 0 ? 'after' : 'on');
    }
    return 'never';
  });
  const [afterOccurrences, setAfterOccurrences] = useState(schedule?.endAfterOccurrence || schedule?.EndAfterOccurrence || 1);
  const [endDate, setEndDate] = useState(schedule?.endDate || schedule?.EndDate || '');

  // Recipients
  const [recipients, setRecipients] = useState(() => {
    const list = schedule?.externalRecipientsList || schedule?.ExternalRecipientsList;
    if (Array.isArray(list) && list.length > 0) return list.join(', ');
    return defaultRecipients;
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync report name if reportId changes
  useEffect(() => {
    if (reportId) {
      const list = reportsByCategory[category] || [];
      const r = list.find(item => item.Id === reportId);
      if (r) setReportName(r.Name);
    }
  }, [reportId, category, reportsByCategory]);

  const handleAssetTypeChange = (type) => {
    setAssetType(type);
    if (type === 'Dashboard') {
      const dashboards = reportsByCategory['Dashboards'] || [];
      const first = dashboards[0] || { Id: '', Name: '' };
      setCategory('Dashboards');
      setReportId(first.Id || '');
      setReportName(first.Name || '');
      setExportFormat('PDF');
    } else {
      const firstCat = reportCategories[0] || '';
      const reports = reportsByCategory[firstCat] || [];
      const first = reports[0] || { Id: '', Name: '' };
      setCategory(firstCat);
      setReportId(first.Id || '');
      setReportName(first.Name || '');
      setExportFormat('PDF');
    }
  };

  const handleCategoryChange = (cat) => {
    const list = Array.isArray(reportsByCategory?.[cat]) ? reportsByCategory[cat] : [];
    const first = list[0] || { Id: '', Name: '' };
    setCategory(cat);
    setReportId(first.Id || '');
    setReportName(first.Name || '');
  };

  const handleReportChange = (id) => {
    const report = reportsByCategory[category]?.find(r => r.Id === id);
    setReportId(id);
    setReportName(report ? report.Name : '');
  };

  const onSubmit = async () => {
    const isDashboard = category === 'Dashboards';
    if (!reportId || !scheduleName.trim()) {
      setErrorMsg(isDashboard ? 'Please select a dashboard and enter a schedule name.' : 'Please select a report and enter a schedule name.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    const recipientList = (recipients || '')
      .split(/[,\n]/)
      .map(e => e.trim())
      .filter(Boolean);

    if (recipientList.length === 0) {
      recipientList.push(defaultRecipients);
    }

    const computedHourlyInterval = `${String(Math.max(0, Math.min(23, Number(hourlyHours) || 0))).padStart(2, '0')}:${String(Math.max(0, Math.min(59, Number(hourlyMinutes) || 0))).padStart(2, '0')}`;
    const safeHourlyInterval = computedHourlyInterval === '00:00' ? '01:00' : computedHourlyInterval;

    const payload = {
      Name: scheduleName.trim(),
      Description: reportName || scheduleName.trim(),
      ItemType: isDashboard ? 'Dashboard' : 'Schedule',
      ItemId: reportId,
      ExportType: exportCodeToKey(exportFormat),
      StartTime: startsOn ? new Date(startsOn).toISOString() : new Date().toISOString(),
      NeverEnd: endsMode === 'never',
      EndAfterOccurrence: endsMode === 'after' ? Number(afterOccurrences) : 0,
      Enabled: true,
      IsEmailAttachment: true,
      ExternalRecipientsList: recipientList,
      ScheduleType: scheduleType,
    };

    if (endsMode === 'on' && endDate) {
      payload.EndDate = new Date(endDate).toISOString();
    }

    if (scheduleType === 'Hourly') {
      payload.HourlySchedule = { ScheduleInterval: safeHourlyInterval };
    } else if (scheduleType === 'Daily') {
      payload.DailySchedule = {
        RecurrenceType: dailyMode === 'weekday' ? 'EveryWeekday' : 'EveryNdays',
        EveryNdays: dailyMode === 'weekday' ? 1 : Number(dailyEveryN),
        EveryWeekday: dailyMode === 'weekday',
      };
    } else if (scheduleType === 'Weekly') {
      payload.WeeklySchedule = {
        RecurrenceWeeks: Number(weeklyEveryN),
        RecurrenceDays: weeklyDays.length > 0 ? weeklyDays : ['Monday'],
      };
    } else if (scheduleType === 'Monthly') {
      if (monthlyMode === 'custom') {
        payload.MonthlySchedule = {
          RecurrenceType: 'CustomRecurrence',
          CustomRecurrence: {
            WeekOfMonth: monthlyCustomWeek,
            DayOfWeek: monthlyCustomDay,
            MonthInterval: Number(monthlyCustomMonth),
          },
        };
      } else {
        payload.MonthlySchedule = {
          RecurrenceType: 'DayRecurrence',
          DayRecurrence: {
            DayInterval: Number(monthlyDayInterval),
            MonthInterval: Number(monthlyMonthInterval),
          },
        };
      }
    } else if (scheduleType === 'Yearly') {
      if (yearlyMode === 'custom') {
        payload.YearlySchedule = {
          YearInterval: Number(yearlyEveryN),
          RecurrenceType: 'CustomRecurrence',
          CustomRecurrence: {
            WeekOfMonth: yearlyCustomWeek,
            DayOfWeek: yearlyCustomDay,
            MonthOfYear: yearlyCustomMonth,
          },
        };
      } else {
        payload.YearlySchedule = {
          YearInterval: Number(yearlyEveryN),
          RecurrenceType: 'MonthRecurrence',
          MonthRecurrence: {
            MonthOfYear: yearlyMonth,
            DayOfMonth: Number(yearlyDayOfMonth),
          },
        };
      }
    }

    try {
      const scheduleId = schedule?.id ?? schedule?.Id ?? schedule?.name ?? schedule?.Name ?? null;
      if (isEdit) {
        if (!scheduleId) {
          setErrorMsg('Cannot update: schedule identifier is missing.');
          setSaving(false);
          return;
        }
        await schedulesAPI.update(scheduleId, payload);
      } else {
        await schedulesAPI.create(payload);
      }

      onClose();
      if (onSaved) await onSaved(payload);
    } catch (err) {
      console.error('Schedule save error:', err);
      setErrorMsg(err?.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] focus:border-[#FF4800] outline-none';
  const labelCls = 'block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1';
  const rowCls = 'flex items-center gap-2';

  function SmallSelect({ value, onChange, children, className = '' }) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)}
        className={`text-xs px-2 py-1.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] outline-none ${className}`}>
        {children}
      </select>
    );
  }

  function SmallNum({ value, onChange, min = 1, max = 999, className = '' }) {
    return (
      <input type="number" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value) || min)}
        className={`text-xs px-2 py-1.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] outline-none text-center w-16 ${className}`}
      />
    );
  }

  const availableFormats = assetType === 'Dashboard' ? DASHBOARD_EXPORT_FORMATS : REPORT_EXPORT_FORMATS;

  const summaryText = buildSummary({
    scheduleType,
    hourlyHours,
    hourlyMinutes,
    dailyMode,
    dailyEveryN,
    weeklyEveryN,
    weeklyDays,
    monthlyMode,
    monthlyDayInterval,
    monthlyMonthInterval,
    monthlyCustomWeek,
    monthlyCustomDay,
    monthlyCustomMonth,
    yearlyEveryN,
    yearlyMode,
    yearlyMonth,
    yearlyDayOfMonth,
    yearlyCustomWeek,
    yearlyCustomDay,
    startsOn,
  });

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000] p-4">
      <div className="bg-white dark:bg-[#181c2c] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-[#FF4800] text-white px-6 py-4 flex justify-between items-center rounded-t-2xl shrink-0">
          <div>
            <h2 className="text-base font-bold tracking-tight">{title}</h2>
            <p className="text-xs text-orange-100 mt-0.5">Configure automated email deliveries</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto text-xs text-slate-700 dark:text-slate-200">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
              <ExclamationCircleIcon className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Target Asset Section */}
          <div className="bg-orange-50/50 dark:bg-orange-950/20 rounded-xl p-4 border border-orange-100 dark:border-orange-900/30 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#FF4800]">Target Asset</h3>
              <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => handleAssetTypeChange('Report')}
                  className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${assetType === 'Report' ? 'bg-white dark:bg-slate-700 text-[#FF4800] shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  Report
                </button>
                <button
                  type="button"
                  onClick={() => handleAssetTypeChange('Dashboard')}
                  className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${assetType === 'Dashboard' ? 'bg-white dark:bg-slate-700 text-[#FF4800] shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  Dashboard
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assetType === 'Report' ? (
                <>
                  <div>
                    <label className={labelCls}>Category *</label>
                    <select className={inputCls} value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
                      <option value="">Select Category</option>
                      {reportCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Report *</label>
                    <select className={inputCls} value={reportId} onChange={(e) => handleReportChange(e.target.value)} disabled={!category}>
                      <option value="">{category ? 'Select Report' : 'Select Category First'}</option>
                      {(reportsByCategory[category] || []).map(r => <option key={r.Id} value={r.Id}>{r.Name}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className={labelCls}>Dashboard *</label>
                  <select className={inputCls} value={reportId} onChange={(e) => handleReportChange(e.target.value)}>
                    <option value="">Select Dashboard</option>
                    {(reportsByCategory['Dashboards'] || []).map(d => <option key={d.Id} value={d.Id}>{d.Name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Schedule Name */}
          <div>
            <label className={labelCls}>Schedule Name *</label>
            <input type="text" className={inputCls} value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} placeholder="e.g. Weekly Executive Performance Dispatch" />
          </div>

          {/* Export Format */}
          <div>
            <label className={labelCls}>Export Format</label>
            <div className="flex gap-1.5 flex-wrap">
              {availableFormats.map(fmt => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setExportFormat(fmt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${exportFormat.toLowerCase() === fmt.id.toLowerCase()
                    ? 'bg-orange-50 dark:bg-orange-950/40 border-[#FF4800] text-[#FF4800]'
                    : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <span>{fmt.icon}</span>
                  <span>{fmt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Frequency Type */}
          <div>
            <label className={labelCls}>Frequency</label>
            <div className="flex gap-1 flex-wrap">
              {SCHEDULE_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setScheduleType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${scheduleType === t
                    ? 'bg-[#FF4800] text-white border-[#FF4800]'
                    : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-[#FF4800] hover:text-[#FF4800]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Hourly Sub-options (Inputs) */}
          {scheduleType === 'Hourly' && (
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
              <span className={labelCls}>Repeat Every</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hourlyHours}
                  onChange={e => setHourlyHours(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
                  className="text-xs px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] outline-none text-center w-16"
                />
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">hour(s)</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={hourlyMinutes}
                  onChange={e => setHourlyMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                  className="text-xs px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] outline-none text-center w-16"
                />
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">minute(s)</span>
              </div>
            </div>
          )}

          {/* Daily Sub-options */}
          {scheduleType === 'Daily' && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-2">
              <label className={`${rowCls} cursor-pointer`}>
                <input type="radio" name="dailyMode" checked={dailyMode === 'everyN'} onChange={() => setDailyMode('everyN')} className="accent-[#FF4800]" />
                <span className="text-xs text-slate-700 dark:text-slate-300">Every</span>
                <SmallNum value={dailyEveryN} onChange={setDailyEveryN} min={1} max={365} />
                <span className="text-xs text-slate-700 dark:text-slate-300">day(s)</span>
              </label>
              <label className={`${rowCls} cursor-pointer`}>
                <input type="radio" name="dailyMode" checked={dailyMode === 'weekday'} onChange={() => setDailyMode('weekday')} className="accent-[#FF4800]" />
                <span className="text-xs text-slate-700 dark:text-slate-300">Every weekday (Mon – Fri)</span>
              </label>
            </div>
          )}

          {/* Weekly Sub-options */}
          {scheduleType === 'Weekly' && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className={rowCls}>
                <span className="text-xs text-slate-600 dark:text-slate-400">Every</span>
                <SmallNum value={weeklyEveryN} onChange={setWeeklyEveryN} min={1} max={52} />
                <span className="text-xs text-slate-600 dark:text-slate-400">week(s) on:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map(day => {
                  const sel = weeklyDays.includes(day);
                  return (
                    <button key={day} type="button"
                      onClick={() => setWeeklyDays(prev =>
                        sel ? (prev.length > 1 ? prev.filter(d => d !== day) : prev) : [...prev, day]
                      )}
                      className={`px-2 py-1 text-[11px] rounded-md font-semibold border transition-all cursor-pointer ${sel
                        ? 'bg-[#FF4800] text-white border-[#FF4800]'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly Sub-options */}
          {scheduleType === 'Monthly' && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <label className={`${rowCls} cursor-pointer flex-wrap`}>
                <input type="radio" name="monthlyMode" checked={monthlyMode === 'day'} onChange={() => setMonthlyMode('day')} className="accent-[#FF4800]" />
                <span className="text-xs text-slate-700 dark:text-slate-300">Day</span>
                <SmallNum value={monthlyDayInterval} onChange={setMonthlyDayInterval} min={1} max={31} />
                <span className="text-xs text-slate-700 dark:text-slate-300">of every</span>
                <SmallNum value={monthlyMonthInterval} onChange={setMonthlyMonthInterval} min={1} max={12} />
                <span className="text-xs text-slate-700 dark:text-slate-300">month(s)</span>
              </label>
              <label className={`${rowCls} cursor-pointer flex-wrap`}>
                <input type="radio" name="monthlyMode" checked={monthlyMode === 'custom'} onChange={() => setMonthlyMode('custom')} className="accent-[#FF4800]" />
                <span className="text-xs text-slate-700 dark:text-slate-300">The</span>
                <SmallSelect value={monthlyCustomWeek} onChange={setMonthlyCustomWeek}>
                  {WEEK_OF_MONTH.map(w => <option key={w} value={w}>{w}</option>)}
                </SmallSelect>
                <SmallSelect value={monthlyCustomDay} onChange={setMonthlyCustomDay}>
                  {DAY_OF_WEEK_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </SmallSelect>
                <span className="text-xs text-slate-700 dark:text-slate-300">of every</span>
                <SmallNum value={monthlyCustomMonth} onChange={setMonthlyCustomMonth} min={1} max={12} />
                <span className="text-xs text-slate-700 dark:text-slate-300">month(s)</span>
              </label>
            </div>
          )}

          {/* Yearly Sub-options */}
          {scheduleType === 'Yearly' && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className={rowCls}>
                <span className="text-xs text-slate-600 dark:text-slate-400">Every</span>
                <SmallNum value={yearlyEveryN} onChange={setYearlyEveryN} min={1} max={10} />
                <span className="text-xs text-slate-600 dark:text-slate-400">year(s)</span>
              </div>
              <label className={`${rowCls} cursor-pointer flex-wrap`}>
                <input type="radio" name="yearlyMode" checked={yearlyMode === 'month'} onChange={() => setYearlyMode('month')} className="accent-[#FF4800]" />
                <span className="text-xs text-slate-700 dark:text-slate-300">Every</span>
                <SmallSelect value={yearlyMonth} onChange={setYearlyMonth}>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </SmallSelect>
                <SmallNum value={yearlyDayOfMonth} onChange={setYearlyDayOfMonth} min={1} max={31} />
              </label>
              <label className={`${rowCls} cursor-pointer flex-wrap`}>
                <input type="radio" name="yearlyMode" checked={yearlyMode === 'custom'} onChange={() => setYearlyMode('custom')} className="accent-[#FF4800]" />
                <span className="text-xs text-slate-700 dark:text-slate-300">The</span>
                <SmallSelect value={yearlyCustomWeek} onChange={setYearlyCustomWeek}>
                  {WEEK_OF_MONTH.map(w => <option key={w} value={w}>{w}</option>)}
                </SmallSelect>
                <SmallSelect value={yearlyCustomDay} onChange={setYearlyCustomDay}>
                  {DAY_OF_WEEK_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </SmallSelect>
                <span className="text-xs text-slate-700 dark:text-slate-300">of</span>
                <SmallSelect value={yearlyCustomMonth} onChange={setYearlyCustomMonth}>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </SmallSelect>
              </label>
            </div>
          )}

          {/* Start Date & Time */}
          <div>
            <label className={labelCls}>Start Date & Time *</label>
            <input type="datetime-local" className={inputCls} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </div>

          {/* Ends */}
          <div className="space-y-1.5">
            <span className={labelCls}>Ends</span>
            <div className="space-y-1.5">
              <label className={`${rowCls} cursor-pointer`}>
                <input type="radio" name="endsMode" checked={endsMode === 'never'} onChange={() => setEndsMode('never')} className="accent-[#FF4800]" />
                <span className="text-xs text-slate-700 dark:text-slate-300">Never</span>
              </label>
              <label className={`${rowCls} cursor-pointer`}>
                <input type="radio" name="endsMode" checked={endsMode === 'after'} onChange={() => setEndsMode('after')} className="accent-[#FF4800]" />
                <span className="text-xs text-slate-700 dark:text-slate-300">After</span>
                <SmallNum value={afterOccurrences} onChange={setAfterOccurrences} min={1} max={999} />
                <span className="text-xs text-slate-700 dark:text-slate-300">occurrence(s)</span>
              </label>
              <label className={`${rowCls} cursor-pointer`}>
                <input type="radio" name="endsMode" checked={endsMode === 'on'} onChange={() => setEndsMode('on')} className="accent-[#FF4800]" />
                <span className="text-xs text-slate-700 dark:text-slate-300">On</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className={`text-xs px-2 py-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] outline-none ${endsMode !== 'on' ? 'opacity-50 pointer-events-none' : ''}`}
                />
              </label>
            </div>
          </div>

          {/* Summary Banner */}
          {summaryText && (
            <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
              <ClockIcon className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
              <span className="font-medium">{summaryText}</span>
            </div>
          )}

          {/* Recipients */}
          <div>
            <label className={labelCls}>Recipients (Comma Separated)</label>
            <input type="text" className={inputCls} value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="admin@company.com, analytics@company.com" />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900 rounded-b-2xl shrink-0">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">Cancel</button>
          <button onClick={onSubmit} disabled={saving} className="px-5 py-2 bg-[#FF4800] hover:bg-[#e03f00] text-white rounded-xl font-semibold text-xs transition shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer">
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Schedule')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
