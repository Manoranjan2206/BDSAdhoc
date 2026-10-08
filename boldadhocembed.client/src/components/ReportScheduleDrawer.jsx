import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlayIcon,
  TrashIcon,
  ArrowPathIcon,
  ChevronUpDownIcon,
} from '@heroicons/react/24/outline';
import { reportsAPI, schedulesAPI, downloadFile } from '../services/apiService';
import { authService } from '../services/authService';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPORT_FORMATS = [
  { id: 'PDF',   label: 'PDF',   ext: '.pdf',  icon: '📄' },
  { id: 'Excel', label: 'Excel', ext: '.xlsx', icon: '📊' },
  { id: 'CSV',   label: 'CSV',   ext: '.csv',  icon: '📋' },
  { id: 'Word',  label: 'Word',  ext: '.docx', icon: '📝' },
  { id: 'HTML',  label: 'HTML',  ext: '.html', icon: '🌐' },
  { id: 'PPT',   label: 'PPT',   ext: '.pptx', icon: '🎞' },
];

const SCHEDULE_TYPES = ['Hourly', 'Daily', 'Weekly', 'Monthly', 'Yearly'];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEK_OF_MONTH = ['first', 'second', 'third', 'fourth', 'last'];

const DAY_OF_WEEK_OPTIONS = ['day', 'weekday', ...WEEKDAYS];

// Generate time options rounded to every 5 minutes: 00:05 … 23:55
const TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      if (h === 0 && m === 0) continue; // skip 00:00
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const val = `${hh}:${mm}`;
      const ampm = h < 12 ? 'AM' : 'PM';
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      opts.push({ value: val, label: `${String(displayH).padStart(2, '0')}:${mm} ${ampm}` });
    }
  }
  return opts;
})();

// Generate hourly interval options: 00:05 up to 23:55
const HOURLY_INTERVAL_OPTIONS = (() => {
  const opts = [];
  const intervals = [
    ['00:05', 'Every 5 minutes'],
    ['00:10', 'Every 10 minutes'],
    ['00:15', 'Every 15 minutes'],
    ['00:20', 'Every 20 minutes'],
    ['00:30', 'Every 30 minutes'],
    ['00:45', 'Every 45 minutes'],
    ['01:00', 'Every 1 hour'],
    ['01:30', 'Every 1.5 hours'],
    ['02:00', 'Every 2 hours'],
    ['03:00', 'Every 3 hours'],
    ['04:00', 'Every 4 hours'],
    ['06:00', 'Every 6 hours'],
    ['08:00', 'Every 8 hours'],
    ['12:00', 'Every 12 hours'],
  ];
  intervals.forEach(([value, label]) => opts.push({ value, label }));
  return opts;
})();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanScheduleName(name) {
  if (!name) return '';
  return String(name).replace(/^(AlphaCorp|BetaSolutions|GammaIndustries|DeltaEnterprises)_/i, '').trim();
}

/** Get current time rounded up to the nearest 5-minute slot, as HH:MM */
function getCurrentTimeRounded() {
  const now = new Date();
  const totalMin = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil(totalMin / 5) * 5;
  const h = Math.floor(rounded / 60) % 24;
  const m = rounded % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Convert a time string (HH:MM) to an ISO datetime string using today's date */
function timeToISO(timeStr) {
  if (!timeStr) return new Date().toISOString();
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function mapExportType(value) {
  const nameMap = { Pdf: 'PDF', Word: 'Word', Excel: 'Excel', CSV: 'CSV', HTML: 'HTML', PPT: 'PPT', Image: 'Image', Xml: 'XML' };
  const codeMap = { '1': 'Excel', '2': 'HTML', '3': 'PDF', '4': 'Word', '5': 'Image', '6': 'PPT', '7': 'CSV', '8': 'XML' };
  if (value == null) return 'PDF';
  const key = String(value);
  return nameMap[key] || codeMap[key] || key;
}

function exportCodeToKey(type) {
  const keyMap = { PDF: 'Pdf', Excel: 'Excel', CSV: 'Csv', Word: 'Word', HTML: 'Html', PPT: 'Ppt', Image: 'Image', XML: 'Xml' };
  return keyMap[type] || type || 'Pdf';
}

/** Build a human-readable recurrence summary */
function buildSummary({ scheduleType, hourlyInterval, dailyMode, dailyEveryN,
  weeklyEveryN, weeklyDays, monthlyMode, monthlyDayInterval, monthlyMonthInterval,
  monthlyCustomWeek, monthlyCustomDay, monthlyCustomMonth,
  yearlyEveryN, yearlyMode, yearlyMonth, yearlyDayOfMonth,
  yearlyCustomWeek, yearlyCustomDay, startsOnTime }) {

  const timeLabel = TIME_OPTIONS.find(o => o.value === startsOnTime)?.label ?? startsOnTime;

  if (scheduleType === 'Hourly') {
    const intLabel = HOURLY_INTERVAL_OPTIONS.find(o => o.value === hourlyInterval)?.label ?? hourlyInterval;
    return `${intLabel}, starting at ${timeLabel}`;
  }
  if (scheduleType === 'Daily') {
    if (dailyMode === 'weekday') return `Every weekday (Mon-Fri), at ${timeLabel}`;
    return `Every ${dailyEveryN} day(s), at ${timeLabel}`;
  }
  if (scheduleType === 'Weekly') {
    const days = weeklyDays.length ? weeklyDays.map(d => d.slice(0, 3)).join(', ') : '—';
    return `Every ${weeklyEveryN} week(s) on ${days}, at ${timeLabel}`;
  }
  if (scheduleType === 'Monthly') {
    if (monthlyMode === 'day') return `Day ${monthlyDayInterval} of every ${monthlyMonthInterval} month(s), at ${timeLabel}`;
    return `The ${monthlyCustomWeek} ${monthlyCustomDay} of every ${monthlyCustomMonth} month(s), at ${timeLabel}`;
  }
  if (scheduleType === 'Yearly') {
    if (yearlyMode === 'month') return `${yearlyMonth} ${yearlyDayOfMonth}, every ${yearlyEveryN} year(s), at ${timeLabel}`;
    return `The ${yearlyCustomWeek} ${yearlyCustomDay} of ${yearlyMonth}, every ${yearlyEveryN} year(s), at ${timeLabel}`;
  }
  return '';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportScheduleDrawer({
  isOpen,
  onClose,
  report,
  onViewReport,
  isViewerOpen = false,
  initialTab = 'view',
}) {
  const currentUser = useMemo(() => {
    const u = authService.getUser();
    return u?.user || u;
  }, []);

  const [activeTab, setActiveTab] = useState(initialTab);

  // ── Export state ──
  const [exportType, setExportType] = useState('PDF');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // ── Schedule meta ──
  const [existingSchedule, setExistingSchedule] = useState(null);
  const [scheduleName, setScheduleName] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);

  // ── Schedule type ──
  const [scheduleType, setScheduleType] = useState('Daily');

  // ── Hourly ──
  const [hourlyInterval, setHourlyInterval] = useState('01:00');

  // ── Daily ──
  const [dailyMode, setDailyMode] = useState('everyN'); // 'everyN' | 'weekday'
  const [dailyEveryN, setDailyEveryN] = useState(1);

  // ── Weekly ──
  const [weeklyEveryN, setWeeklyEveryN] = useState(1);
  const [weeklyDays, setWeeklyDays] = useState(['Monday']);

  // ── Monthly ──
  const [monthlyMode, setMonthlyMode] = useState('day'); // 'day' | 'custom'
  const [monthlyDayInterval, setMonthlyDayInterval] = useState(1);
  const [monthlyMonthInterval, setMonthlyMonthInterval] = useState(1);
  const [monthlyCustomWeek, setMonthlyCustomWeek] = useState('first');
  const [monthlyCustomDay, setMonthlyCustomDay] = useState('Monday');
  const [monthlyCustomMonth, setMonthlyCustomMonth] = useState(1);

  // ── Yearly ──
  const [yearlyEveryN, setYearlyEveryN] = useState(1);
  const [yearlyMode, setYearlyMode] = useState('month'); // 'month' | 'custom'
  const [yearlyMonth, setYearlyMonth] = useState('January');
  const [yearlyDayOfMonth, setYearlyDayOfMonth] = useState(1);
  const [yearlyCustomWeek, setYearlyCustomWeek] = useState('first');
  const [yearlyCustomDay, setYearlyCustomDay] = useState('Monday');
  const [yearlyCustomMonth, setYearlyCustomMonth] = useState('January');

  // ── Start time (time-only) ──
  const [startsOnTime, setStartsOnTime] = useState(getCurrentTimeRounded);

  // ── Ends ──
  const [endsMode, setEndsMode] = useState('never');
  const [afterOccurrences, setAfterOccurrences] = useState(1);
  const [endDate, setEndDate] = useState('');

  // ── Email ──
  const [emailSubject, setEmailSubject] = useState('');
  const [recipients, setRecipients] = useState('');

  // ── Action state ──
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState(null);
  const [runningNow, setRunningNow] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState(false);

  const reportId = report?.id || report?.Id || report?.ReportId;
  const reportName = report?.name || report?.Name || 'Report';

  // Sync tab when drawer opens
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab || 'view');
  }, [isOpen, initialTab]);

  // Load existing schedule on open
  useEffect(() => {
    if (!isOpen || !reportId) return;
    setScheduleMessage(null);
    setExportError(null);

    const checkSchedule = async () => {
      try {
        const res = await schedulesAPI.getScheduleByReport(reportId);
        if (res?.exists && res.schedule) {
          const s = res.schedule;
          setExistingSchedule(s);
          setScheduleName(cleanScheduleName(s.name || s.scheduleName || `${reportName} Schedule`));
          setIsEnabled(s.enabled !== undefined ? !!s.enabled : true);

          const st = s.recurrenceType || s.scheduleType || 'Daily';
          setScheduleType(st);

          // Hourly
          if (s.hourlySchedule?.scheduleInterval) setHourlyInterval(s.hourlySchedule.scheduleInterval);

          // Daily
          if (s.dailySchedule) {
            if (s.dailySchedule.everyWeekday) setDailyMode('weekday');
            else { setDailyMode('everyN'); setDailyEveryN(s.dailySchedule.everyNdays || 1); }
          }

          // Weekly
          if (s.weeklySchedule) {
            setWeeklyEveryN(s.weeklySchedule.recurrenceWeeks || 1);
            if (s.weeklySchedule.recurrenceDays?.length) setWeeklyDays(s.weeklySchedule.recurrenceDays);
          }

          // Monthly
          if (s.monthlySchedule) {
            const ms = s.monthlySchedule;
            if (ms.recurrenceType === 'CustomRecurrence' && ms.customRecurrence) {
              setMonthlyMode('custom');
              setMonthlyCustomWeek(ms.customRecurrence.weekOfMonth || 'first');
              setMonthlyCustomDay(ms.customRecurrence.dayOfWeek || 'Monday');
              setMonthlyCustomMonth(ms.customRecurrence.monthInterval || 1);
            } else if (ms.dayRecurrence) {
              setMonthlyMode('day');
              setMonthlyDayInterval(ms.dayRecurrence.dayInterval || 1);
              setMonthlyMonthInterval(ms.dayRecurrence.monthInterval || 1);
            }
          }

          // Yearly
          if (s.yearlySchedule) {
            const ys = s.yearlySchedule;
            setYearlyEveryN(ys.yearInterval || 1);
            if (ys.recurrenceType === 'CustomRecurrence' && ys.customRecurrence) {
              setYearlyMode('custom');
              setYearlyCustomWeek(ys.customRecurrence.weekOfMonth || 'first');
              setYearlyCustomDay(ys.customRecurrence.dayOfWeek || 'Monday');
              setYearlyCustomMonth(ys.customRecurrence.monthOfYear || 'January');
            } else if (ys.monthRecurrence) {
              setYearlyMode('month');
              setYearlyMonth(ys.monthRecurrence.monthOfYear || 'January');
              setYearlyDayOfMonth(ys.monthRecurrence.dayOfMonth || 1);
            }
          }

          // Start time
          const rawStart = s.startDate || s.startTime;
          if (rawStart) {
            const d = new Date(rawStart);
            if (!isNaN(d.getTime())) {
              const h = String(d.getHours()).padStart(2, '0');
              const m5 = Math.round(d.getMinutes() / 5) * 5 % 60;
              const m = String(m5).padStart(2, '0');
              setStartsOnTime(`${h}:${m}`);
            }
          }

          setEndsMode(s.neverEnd ? 'never' : s.endAfterOccurrence > 0 ? 'after' : s.endDate ? 'on' : 'never');
          setAfterOccurrences(s.endAfterOccurrence || 1);
          setEndDate(s.endDate ? s.endDate.slice(0, 10) : '');

          if (s.exportType) setExportType(mapExportType(s.exportType));
          setEmailSubject(`${reportName} Report`);
          setRecipients(s.externalRecipientsList?.length ? s.externalRecipientsList.join(', ') : (currentUser?.email || ''));
        } else {
          resetScheduleDefaults();
        }
      } catch {
        resetScheduleDefaults();
      }
    };

    checkSchedule();
  }, [isOpen, reportId, reportName, currentUser]);

  function resetScheduleDefaults() {
    setExistingSchedule(null);
    setScheduleName(`${reportName} Schedule`);
    setIsEnabled(true);
    setScheduleType('Daily');
    setHourlyInterval('01:00');
    setDailyMode('everyN');
    setDailyEveryN(1);
    setWeeklyEveryN(1);
    setWeeklyDays(['Monday']);
    setMonthlyMode('day');
    setMonthlyDayInterval(1);
    setMonthlyMonthInterval(1);
    setMonthlyCustomWeek('first');
    setMonthlyCustomDay('Monday');
    setMonthlyCustomMonth(1);
    setYearlyEveryN(1);
    setYearlyMode('month');
    setYearlyMonth('January');
    setYearlyDayOfMonth(1);
    setYearlyCustomWeek('first');
    setYearlyCustomDay('Monday');
    setYearlyCustomMonth('January');
    setStartsOnTime(getCurrentTimeRounded());
    setEndsMode('never');
    setAfterOccurrences(1);
    setEndDate('');
    setEmailSubject(`${reportName} Report`);
    setRecipients(currentUser?.email || '');
  }

  // ── Save / Update schedule ──
  const handleSaveSchedule = async () => {
    if (!reportId) return;
    setSavingSchedule(true);
    setScheduleMessage(null);

    try {
      const recipientList = recipients.split(/[,\n]/).map(r => r.trim()).filter(Boolean);
      if (recipientList.length === 0 && currentUser?.email) recipientList.push(currentUser.email);

      const payload = {
        ItemId: reportId,
        ItemType: 'Report',
        Name: scheduleName.trim() || `${reportName} Schedule`,
        Description: `Automated ${scheduleType} dispatch of ${reportName}`,
        ScheduleType: scheduleType,
        ExportType: exportCodeToKey(exportType),
        StartTime: timeToISO(startsOnTime),
        NeverEnd: endsMode === 'never',
        EndAfterOccurrence: endsMode === 'after' ? Number(afterOccurrences) : 0,
        Enabled: isEnabled,
        IsEmailAttachment: true,
        ExternalRecipientsList: recipientList,
        EmailTemplate: {
          Subject: emailSubject || `${reportName} Report`,
          EmailContent: '',
        },
      };

      if (endsMode === 'on' && endDate) {
        payload.EndDate = new Date(endDate).toISOString();
      }

      if (scheduleType === 'Hourly') {
        payload.HourlySchedule = { ScheduleInterval: hourlyInterval };
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

      const scheduleId = existingSchedule?.id || existingSchedule?.Id || existingSchedule?.name || existingSchedule?.Name;
      if (existingSchedule && scheduleId) {
        await schedulesAPI.update(scheduleId, payload);
      } else {
        await schedulesAPI.create(payload);
      }

      setScheduleMessage({ type: 'success', text: existingSchedule ? 'Schedule updated!' : 'Schedule created!' });
      setTimeout(() => { setScheduleMessage(null); onClose(); }, 2000);

      const res = await schedulesAPI.getScheduleByReport(reportId);
      if (res?.exists) setExistingSchedule(res.schedule);
    } catch (err) {
      console.error('Save schedule failed:', err);
      setScheduleMessage({ type: 'error', text: err.message || 'Failed to save schedule.' });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async () => {
    const id = existingSchedule?.id || existingSchedule?.Id || existingSchedule?.name || existingSchedule?.Name;
    if (!id) return;
    setDeletingSchedule(true);
    try {
      await schedulesAPI.delete(id);
      setExistingSchedule(null);
      setScheduleMessage({ type: 'success', text: 'Schedule removed.' });
      setTimeout(() => setScheduleMessage(null), 3000);
    } catch {
      setScheduleMessage({ type: 'error', text: 'Failed to delete schedule.' });
    } finally {
      setDeletingSchedule(false);
    }
  };

  const handleRunNow = async () => {
    const id = existingSchedule?.id || existingSchedule?.Id || existingSchedule?.name || existingSchedule?.Name;
    if (!id) return;
    setRunningNow(true);
    try {
      await schedulesAPI.runNow(id);
      setScheduleMessage({ type: 'success', text: 'Schedule triggered! Emails will be sent shortly.' });
      setTimeout(() => setScheduleMessage(null), 4000);
    } catch {
      setScheduleMessage({ type: 'error', text: 'Failed to trigger schedule.' });
    } finally {
      setRunningNow(false);
    }
  };

  const handleExport = async () => {
    if (!reportId) return;
    setExporting(true);
    setExportError(null);
    try {
      const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId);
      let resolvedServerPath;
      if (!isGuid) {
        resolvedServerPath = report?.serverPath || (report?.serverCategory
          ? `/${report.serverCategory}/${report.serverReportName || report.name}` : undefined);
      }
      if (window.$) {
        try {
          const $v = window.$('[data-role="boldreportviewer"], .e-reportviewer, div[id*="report-viewer"], div[id*="viewer"]').first();
          if ($v?.data('boldReportViewer')) {
            const vo = $v.data('boldReportViewer');
            if (typeof vo.exportReport === 'function') { vo.exportReport(exportType); setExporting(false); return; }
          }
        } catch (e) { console.warn('Viewer export fallback:', e); }
      }
      const { blob, filename } = await reportsAPI.exportReportV3({
        reportId, reportName, serverPath: resolvedServerPath, exportType, filterParameters: {},
      });
      downloadFile(blob, filename || `${reportName}.${exportType.toLowerCase()}`);
    } catch (err) {
      setExportError(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen || !report) return null;

  // ── Shared sub-components ──

  const inputCls = 'w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] focus:border-[#FF4800] outline-none';
  const selectCls = inputCls;
  const labelCls = 'text-[11px] font-semibold text-slate-700 dark:text-slate-300';
  const rowCls = 'flex items-center gap-2';

  function NLabel({ children }) {
    return <span className={labelCls}>{children}</span>;
  }
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

  // Export format tile row
  const ExportFormatRow = () => (
    <div className="grid grid-cols-6 gap-1">
      {EXPORT_FORMATS.map(fmt => (
        <button key={fmt.id} type="button" onClick={() => setExportType(fmt.id)}
          className={`py-2 px-1 rounded-xl text-center border transition-all flex flex-col items-center gap-0.5 cursor-pointer ${exportType === fmt.id
            ? 'bg-orange-50 dark:bg-orange-950/40 border-[#FF4800] text-[#FF4800] font-bold shadow-sm'
            : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
          }`}>
          <span className="text-sm">{fmt.icon}</span>
          <span className="text-[10px]">{fmt.label}</span>
        </button>
      ))}
    </div>
  );

  // Recurrence summary banner
  const summaryText = buildSummary({
    scheduleType, hourlyInterval, dailyMode, dailyEveryN,
    weeklyEveryN, weeklyDays, monthlyMode, monthlyDayInterval, monthlyMonthInterval,
    monthlyCustomWeek, monthlyCustomDay, monthlyCustomMonth,
    yearlyEveryN, yearlyMode, yearlyMonth, yearlyDayOfMonth,
    yearlyCustomWeek, yearlyCustomDay, startsOnTime,
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100000] overflow-hidden flex justify-end">
        {/* Backdrop */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px]"
        />

        {/* Panel */}
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative w-full max-w-[460px] bg-white dark:bg-[#181c2c] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full z-10 overflow-hidden"
        >
          {/* ── Header ── */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <div className="min-w-0 pr-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">{reportName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {report.categoryName || 'Reports'}
                </span>
                {existingSchedule && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Scheduled
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* ── Tab bar ── */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181c2c] shrink-0">
            {[
              { id: 'view', icon: <EyeIcon className="w-3.5 h-3.5" />, label: 'View' },
              { id: 'export', icon: <ArrowDownTrayIcon className="w-3.5 h-3.5" />, label: 'Export' },
              { id: 'schedule', icon: <ClockIcon className="w-3.5 h-3.5" />, label: 'Schedule' },
            ].map(tab => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${activeTab === tab.id
                  ? 'border-[#FF4800] text-[#FF4800]'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Status banner */}
            {scheduleMessage && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${scheduleMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 border border-rose-200 dark:border-rose-800'
                }`}>
                {scheduleMessage.type === 'success'
                  ? <CheckCircleIcon className="w-4 h-4 shrink-0 text-emerald-500" />
                  : <ExclamationCircleIcon className="w-4 h-4 shrink-0 text-rose-500" />}
                <span>{scheduleMessage.text}</span>
              </motion.div>
            )}

            {/* ════ EXPORT TAB ════ */}
            {activeTab === 'export' && (
              <div className="space-y-4">
                <p className="text-[11px] text-slate-400">Choose export format to download.</p>
                <ExportFormatRow />
                {exportError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-600 dark:text-rose-300">
                    {exportError}
                  </div>
                )}
              </div>
            )}

            {/* ════ SCHEDULE TAB ════ */}
            {activeTab === 'schedule' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Schedule Report</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Configure automated email deliveries</p>
                </div>

                <div className="space-y-3.5">

                  {/* Schedule Name + Export Format */}
                  <div className="space-y-1">
                    <NLabel>Schedule Name *</NLabel>
                    <input type="text" value={scheduleName} onChange={e => setScheduleName(e.target.value)}
                      placeholder="e.g. Weekly Executive Report"
                      className={inputCls}
                    />
                  </div>

                  {/* Export Format (compact, inline) */}
                  <div className="space-y-1">
                    <NLabel>Export Format</NLabel>
                    <ExportFormatRow />
                  </div>

                  {/* ── Frequency type ── */}
                  <div className="space-y-1">
                    <NLabel>Frequency</NLabel>
                    <div className="flex gap-1 flex-wrap">
                      {SCHEDULE_TYPES.map(t => (
                        <button key={t} type="button" onClick={() => setScheduleType(t)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${scheduleType === t
                            ? 'bg-[#FF4800] text-white border-[#FF4800]'
                            : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-[#FF4800] hover:text-[#FF4800]'
                          }`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Hourly sub-options ── */}
                  {scheduleType === 'Hourly' && (
                    <div className="space-y-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                      <NLabel>Repeat Interval</NLabel>
                      <select value={hourlyInterval} onChange={e => setHourlyInterval(e.target.value)} className={selectCls}>
                        {HOURLY_INTERVAL_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* ── Daily sub-options ── */}
                  {scheduleType === 'Daily' && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-2">
                      <label className={`${rowCls} cursor-pointer`}>
                        <input type="radio" name="dailyMode" checked={dailyMode === 'everyN'} onChange={() => setDailyMode('everyN')}
                          className="accent-[#FF4800]" />
                        <span className="text-xs text-slate-700 dark:text-slate-300">Every</span>
                        <SmallNum value={dailyEveryN} onChange={setDailyEveryN} min={1} max={365} />
                        <span className="text-xs text-slate-700 dark:text-slate-300">day(s)</span>
                      </label>
                      <label className={`${rowCls} cursor-pointer`}>
                        <input type="radio" name="dailyMode" checked={dailyMode === 'weekday'} onChange={() => setDailyMode('weekday')}
                          className="accent-[#FF4800]" />
                        <span className="text-xs text-slate-700 dark:text-slate-300">Every weekday (Mon – Fri)</span>
                      </label>
                    </div>
                  )}

                  {/* ── Weekly sub-options ── */}
                  {scheduleType === 'Weekly' && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className={rowCls}>
                        <span className="text-xs text-slate-600 dark:text-slate-400">Every</span>
                        <SmallNum value={weeklyEveryN} onChange={setWeeklyEveryN} min={1} max={52} />
                        <span className="text-xs text-slate-600 dark:text-slate-400">week(s) on:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAYS.map(day => {
                          const active = weeklyDays.includes(day);
                          return (
                            <button key={day} type="button"
                              onClick={() => setWeeklyDays(prev => active ? prev.filter(d => d !== day) : [...prev, day])}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors border ${active
                                ? 'bg-[#183955] text-white border-[#183955]'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#FF4800] hover:text-[#FF4800]'
                              }`}>
                              {day.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Monthly sub-options ── */}
                  {scheduleType === 'Monthly' && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-2.5">
                      {/* Day N of every M months */}
                      <label className={`${rowCls} cursor-pointer flex-wrap`}>
                        <input type="radio" name="monthlyMode" checked={monthlyMode === 'day'} onChange={() => setMonthlyMode('day')}
                          className="accent-[#FF4800]" />
                        <span className="text-xs text-slate-700 dark:text-slate-300">Day</span>
                        <SmallNum value={monthlyDayInterval} onChange={setMonthlyDayInterval} min={1} max={31} />
                        <span className="text-xs text-slate-700 dark:text-slate-300">of every</span>
                        <SmallNum value={monthlyMonthInterval} onChange={setMonthlyMonthInterval} min={1} max={12} />
                        <span className="text-xs text-slate-700 dark:text-slate-300">month(s)</span>
                      </label>
                      {/* The [week] [day] of every M months */}
                      <label className={`${rowCls} cursor-pointer flex-wrap`}>
                        <input type="radio" name="monthlyMode" checked={monthlyMode === 'custom'} onChange={() => setMonthlyMode('custom')}
                          className="accent-[#FF4800]" />
                        <span className="text-xs text-slate-700 dark:text-slate-300">The</span>
                        <SmallSelect value={monthlyCustomWeek} onChange={setMonthlyCustomWeek} className="w-24">
                          {WEEK_OF_MONTH.map(w => <option key={w} value={w}>{w}</option>)}
                        </SmallSelect>
                        <SmallSelect value={monthlyCustomDay} onChange={setMonthlyCustomDay} className="w-28">
                          {DAY_OF_WEEK_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        </SmallSelect>
                        <span className="text-xs text-slate-700 dark:text-slate-300">of every</span>
                        <SmallNum value={monthlyCustomMonth} onChange={setMonthlyCustomMonth} min={1} max={12} />
                        <span className="text-xs text-slate-700 dark:text-slate-300">month(s)</span>
                      </label>
                    </div>
                  )}

                  {/* ── Yearly sub-options ── */}
                  {scheduleType === 'Yearly' && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className={rowCls}>
                        <span className="text-xs text-slate-600 dark:text-slate-400">Every</span>
                        <SmallNum value={yearlyEveryN} onChange={setYearlyEveryN} min={1} max={10} />
                        <span className="text-xs text-slate-600 dark:text-slate-400">year(s)</span>
                      </div>
                      {/* Month + Day */}
                      <label className={`${rowCls} cursor-pointer flex-wrap`}>
                        <input type="radio" name="yearlyMode" checked={yearlyMode === 'month'} onChange={() => setYearlyMode('month')}
                          className="accent-[#FF4800]" />
                        <SmallSelect value={yearlyMonth} onChange={setYearlyMonth} className="w-28">
                          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </SmallSelect>
                        <SmallNum value={yearlyDayOfMonth} onChange={setYearlyDayOfMonth} min={1} max={31} />
                      </label>
                      {/* Custom week/day of month */}
                      <label className={`${rowCls} cursor-pointer flex-wrap`}>
                        <input type="radio" name="yearlyMode" checked={yearlyMode === 'custom'} onChange={() => setYearlyMode('custom')}
                          className="accent-[#FF4800]" />
                        <span className="text-xs text-slate-700 dark:text-slate-300">The</span>
                        <SmallSelect value={yearlyCustomWeek} onChange={setYearlyCustomWeek} className="w-24">
                          {WEEK_OF_MONTH.map(w => <option key={w} value={w}>{w}</option>)}
                        </SmallSelect>
                        <SmallSelect value={yearlyCustomDay} onChange={setYearlyCustomDay} className="w-28">
                          {DAY_OF_WEEK_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        </SmallSelect>
                        <span className="text-xs text-slate-700 dark:text-slate-300">of</span>
                        <SmallSelect value={yearlyCustomMonth} onChange={setYearlyCustomMonth} className="w-28">
                          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </SmallSelect>
                      </label>
                    </div>
                  )}

                  {/* ── Start Time (time only, 5-min steps) ── */}
                  <div className="space-y-1">
                    <NLabel>Start Time</NLabel>
                    <select value={startsOnTime} onChange={e => setStartsOnTime(e.target.value)} className={selectCls}>
                      {TIME_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* ── Recurrence summary ── */}
                  {summaryText && (
                    <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/30 text-[11px] text-indigo-700 dark:text-indigo-300 flex items-start gap-2">
                      <ClockIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>Occurs {summaryText}</span>
                    </div>
                  )}

                  {/* ── Ends condition ── */}
                  <div className="space-y-1.5">
                    <NLabel>Ends</NLabel>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg text-center">
                      {[
                        { id: 'never', label: 'Never' },
                        { id: 'after', label: 'After' },
                        { id: 'on', label: 'End Date' },
                      ].map(opt => (
                        <button key={opt.id} type="button" onClick={() => setEndsMode(opt.id)}
                          className={`py-1 text-[11px] font-semibold rounded-md transition ${endsMode === opt.id
                            ? 'bg-white dark:bg-slate-700 text-[#FF4800] shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400'
                          }`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {endsMode === 'after' && (
                      <div className={`pt-1 ${rowCls}`}>
                        <span className="text-[11px] text-slate-500">End after</span>
                        <SmallNum value={afterOccurrences} onChange={setAfterOccurrences} min={1} max={999} />
                        <span className="text-[11px] text-slate-500">occurrences</span>
                      </div>
                    )}
                    {endsMode === 'on' && (
                      <div className="pt-1">
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
                      </div>
                    )}
                  </div>

                  {/* ── Email Subject ── */}
                  <div className="space-y-1">
                    <NLabel>Email Subject</NLabel>
                    <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                      placeholder="Report Email Subject" className={inputCls} />
                  </div>

                  {/* ── Recipients ── */}
                  <div className="space-y-1">
                    <NLabel>Recipients</NLabel>
                    <textarea rows={2} value={recipients} onChange={e => setRecipients(e.target.value)}
                      placeholder="admin@company.com, manager@company.com"
                      className={`${inputCls} resize-none`} />
                  </div>

                  {/* ── Quick actions for existing schedule ── */}
                  {existingSchedule && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-medium text-slate-500">Quick Actions:</span>
                      <button type="button" onClick={handleRunNow} disabled={runningNow}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5">
                        <PlayIcon className={`w-3.5 h-3.5 text-emerald-500 ${runningNow ? 'animate-spin' : ''}`} />
                        Run Now
                      </button>
                      <button type="button" onClick={handleDeleteSchedule} disabled={deletingSchedule}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 rounded-lg transition-colors flex items-center gap-1.5">
                        <TrashIcon className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center gap-3 shrink-0">
            <button type="button" onClick={onClose}
              className="py-2.5 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors shadow-2xs cursor-pointer">
              Cancel
            </button>

            {activeTab === 'view' && (
              <button type="button" onClick={() => { onClose(); if (onViewReport) onViewReport(report); }}
                className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-gradient-to-r from-[#FF4800] to-[#E03E00] hover:brightness-105 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer">
                <EyeIcon className="w-4 h-4" /> View Report
              </button>
            )}

            {activeTab === 'export' && (
              <button type="button" onClick={handleExport} disabled={exporting}
                className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-gradient-to-r from-[#FF4800] to-[#E03E00] hover:brightness-105 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                {exporting
                  ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /><span>Generating {exportType}...</span></>
                  : <><ArrowDownTrayIcon className="w-4 h-4" /><span>Export as {exportType}</span></>}
              </button>
            )}

            {activeTab === 'schedule' && (
              <button type="button" onClick={handleSaveSchedule} disabled={savingSchedule}
                className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-gradient-to-r from-[#FF4800] to-[#E03E00] hover:brightness-105 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                {savingSchedule
                  ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /><span>Saving...</span></>
                  : <><ClockIcon className="w-4 h-4" /><span>{existingSchedule ? 'Update Schedule' : 'Schedule Report'}</span></>}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
