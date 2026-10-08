import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlayIcon,
  TrashIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { reportsAPI, schedulesAPI, downloadFile } from '../services/apiService';
import { authService } from '../services/authService';
import { toLocalInputValue } from '../utils/dateUtils';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanScheduleName(name) {
  if (!name) return '';
  return String(name).replace(/^(AlphaCorp|BetaSolutions|GammaIndustries|DeltaEnterprises)_/i, '').trim();
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportScheduleDrawer({
  isOpen,
  onClose,
  report,
  mode = 'schedule', // 'export' | 'schedule'
  onScheduleSaved,
}) {
  const currentUser = useMemo(() => {
    const u = authService.getUser();
    return u?.user || u;
  }, []);

  const isExportMode = mode === 'export';

  // ── Export state ──
  const [exportType, setExportType] = useState('PDF');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // ── Schedule meta ──
  const [existingSchedule, setExistingSchedule] = useState(null);
  const [scheduleName, setScheduleName] = useState('');

  // ── Schedule type ──
  const [scheduleType, setScheduleType] = useState('Daily');

  // ── Hourly (inputs instead of dropdown) ──
  const [hourlyHours, setHourlyHours] = useState(1);
  const [hourlyMinutes, setHourlyMinutes] = useState(0);

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

  // ── Start Date & Time ──
  const [startsOn, setStartsOn] = useState(() => toLocalInputValue());

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

          if (s.exportType) {
            setExportType(mapExportType(s.exportType));
          }

          const rawType = s.scheduleType || s.recurrenceType || 'Daily';
          const matchedType = SCHEDULE_TYPES.find(t => t.toLowerCase() === rawType.toLowerCase()) || 'Daily';
          setScheduleType(matchedType);

          if (s.hourlySchedule?.scheduleInterval) {
            const [h, m] = String(s.hourlySchedule.scheduleInterval).split(':').map(Number);
            setHourlyHours(isNaN(h) ? 1 : h);
            setHourlyMinutes(isNaN(m) ? 0 : m);
          }

          if (s.dailySchedule) {
            const ds = s.dailySchedule;
            if (ds.recurrenceType === 'EveryWeekday' || ds.everyWeekday) {
              setDailyMode('weekday');
            } else {
              setDailyMode('everyN');
              setDailyEveryN(ds.everyNdays || 1);
            }
          }

          if (s.weeklySchedule) {
            const ws = s.weeklySchedule;
            setWeeklyEveryN(ws.recurrenceWeeks || 1);
            if (Array.isArray(ws.recurrenceDays) && ws.recurrenceDays.length > 0) {
              setWeeklyDays(ws.recurrenceDays);
            }
          }

          if (s.monthlySchedule) {
            const ms = s.monthlySchedule;
            if (ms.recurrenceType === 'CustomRecurrence' || ms.customRecurrence) {
              const cr = ms.customRecurrence || {};
              setMonthlyMode('custom');
              setMonthlyCustomWeek(cr.weekOfMonth || 'first');
              setMonthlyCustomDay(cr.dayOfWeek || 'Monday');
              setMonthlyCustomMonth(cr.monthInterval || 1);
            } else {
              const dr = ms.dayRecurrence || {};
              setMonthlyMode('day');
              setMonthlyDayInterval(dr.dayInterval || 1);
              setMonthlyMonthInterval(dr.monthInterval || 1);
            }
          }

          if (s.yearlySchedule) {
            const ys = s.yearlySchedule;
            setYearlyEveryN(ys.yearInterval || 1);
            if (ys.recurrenceType === 'CustomRecurrence' || ys.customRecurrence) {
              const cr = ys.customRecurrence || {};
              setYearlyMode('custom');
              setYearlyCustomWeek(cr.weekOfMonth || 'first');
              setYearlyCustomDay(cr.dayOfWeek || 'Monday');
              setYearlyCustomMonth(cr.monthOfYear || 'January');
            } else {
              const mr = ys.monthRecurrence || {};
              setYearlyMode('month');
              setYearlyMonth(mr.monthOfYear || 'January');
              setYearlyDayOfMonth(mr.dayOfMonth || 1);
            }
          }

          if (s.startTime || s.startDate) {
            setStartsOn(toLocalInputValue(s.startTime || s.startDate));
          } else {
            setStartsOn(toLocalInputValue());
          }

          if (s.neverEnd !== undefined) {
            setEndsMode(s.neverEnd ? 'never' : (s.endAfterOccurrence > 0 ? 'after' : 'on'));
          }
          if (s.endAfterOccurrence) setAfterOccurrences(s.endAfterOccurrence);
          if (s.endDate) setEndDate(s.endDate.slice(0, 10));

          if (s.emailTemplate?.subject) setEmailSubject(s.emailTemplate.subject);
          else setEmailSubject(`${reportName} Report`);

          if (Array.isArray(s.externalRecipientsList) && s.externalRecipientsList.length > 0) {
            setRecipients(s.externalRecipientsList.join(', '));
          } else {
            setRecipients(currentUser?.email || '');
          }
        } else {
          setExistingSchedule(null);
          resetForm();
        }
      } catch (err) {
        console.warn('Could not load schedule for report:', err);
        setExistingSchedule(null);
        resetForm();
      }
    };

    checkSchedule();
  }, [isOpen, reportId, reportName, currentUser]);

  function resetForm() {
    setScheduleName(`${reportName} Schedule`);
    setExportType('PDF');
    setScheduleType('Daily');
    setHourlyHours(1);
    setHourlyMinutes(0);
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
    setStartsOn(toLocalInputValue());
    setEndsMode('never');
    setAfterOccurrences(1);
    setEndDate('');
    setEmailSubject(`${reportName} Report`);
    setRecipients(currentUser?.email || '');
  }

  // ── Handle Export ──
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
            if (typeof vo.exportReport === 'function') {
              vo.exportReport(exportType);
              setExporting(false);
              onClose();
              return;
            }
          }
        } catch (e) {
          console.warn('Viewer export fallback:', e);
        }
      }
      const { blob, filename } = await reportsAPI.exportReportV3({
        reportId,
        reportName,
        serverPath: resolvedServerPath,
        exportType,
        filterParameters: {},
      });
      downloadFile(blob, filename || `${reportName}.${exportType.toLowerCase()}`);
      onClose();
    } catch (err) {
      setExportError(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  // ── Save / Update schedule ──
  const handleSaveSchedule = async () => {
    if (!reportId) return;
    setSavingSchedule(true);
    setScheduleMessage(null);

    try {
      const recipientList = recipients.split(/[,\n]/).map(r => r.trim()).filter(Boolean);
      if (recipientList.length === 0 && currentUser?.email) recipientList.push(currentUser.email);

      const computedHourlyInterval = `${String(Math.max(0, Math.min(23, Number(hourlyHours) || 0))).padStart(2, '0')}:${String(Math.max(0, Math.min(59, Number(hourlyMinutes) || 0))).padStart(2, '0')}`;
      const safeHourlyInterval = computedHourlyInterval === '00:00' ? '01:00' : computedHourlyInterval;

      const payload = {
        ItemId: reportId,
        ItemType: 'Report',
        Name: scheduleName.trim() || `${reportName} Schedule`,
        Description: `Automated ${scheduleType} dispatch of ${reportName}`,
        ScheduleType: scheduleType,
        ExportType: exportCodeToKey(exportType),
        StartTime: startsOn ? new Date(startsOn).toISOString() : new Date().toISOString(),
        NeverEnd: endsMode === 'never',
        EndAfterOccurrence: endsMode === 'after' ? Number(afterOccurrences) : 0,
        Enabled: true,
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

      const scheduleId = existingSchedule?.id || existingSchedule?.Id || existingSchedule?.name || existingSchedule?.Name;
      const isEdit = !!(existingSchedule && scheduleId);
      if (isEdit) {
        await schedulesAPI.update(scheduleId, payload);
      } else {
        await schedulesAPI.create(payload);
      }

      const summary = buildSummary({
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

      // Close drawer immediately & notify parent
      onClose();
      if (onScheduleSaved) {
        onScheduleSaved({
          name: payload.Name,
          reportName,
          isEdit,
          summary,
        });
      }
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
      setTimeout(() => {
        setScheduleMessage(null);
        onClose();
      }, 1200);
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
      setScheduleMessage({ type: 'success', text: 'Execution triggered!' });
      setTimeout(() => setScheduleMessage(null), 3000);
    } catch {
      setScheduleMessage({ type: 'error', text: 'Failed to run schedule.' });
    } finally {
      setRunningNow(false);
    }
  };

  if (!isOpen || !report) return null;

  // ── Shared sub-components ──

  const inputCls = 'w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] focus:border-[#FF4800] outline-none';
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
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {isExportMode ? `Export ${reportName}` : reportName}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {report.categoryName || 'Reports'}
                </span>
                {!isExportMode && existingSchedule && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Scheduled
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Error / Status banner */}
            {scheduleMessage && !isExportMode && (
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

            {/* ════ EXPORT MODE (Only Export Type Selection) ════ */}
            {isExportMode ? (
              <div className="space-y-4 pt-1">
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Choose export format to download.</p>
                </div>

                <div className="space-y-1">
                  <NLabel>Export Format</NLabel>
                  <ExportFormatRow />
                </div>

                {exportError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
                    <ExclamationCircleIcon className="w-4 h-4 shrink-0" />
                    <span>{exportError}</span>
                  </div>
                )}
              </div>
            ) : (
              /* ════ SCHEDULE MODE (Full Recurrence Configuration) ════ */
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Schedule Report</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Configure automated email deliveries</p>
                </div>

                <div className="space-y-3.5">

                  {/* Schedule Name */}
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
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${scheduleType === t
                            ? 'bg-[#FF4800] text-white border-[#FF4800]'
                            : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-[#FF4800] hover:text-[#FF4800]'
                          }`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Hourly sub-options (Inputs) ── */}
                  {scheduleType === 'Hourly' && (
                    <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                      <NLabel>Repeat Every</NLabel>
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

                  {/* ── Monthly sub-options ── */}
                  {scheduleType === 'Monthly' && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-2.5">
                      <label className={`${rowCls} cursor-pointer flex-wrap`}>
                        <input type="radio" name="monthlyMode" checked={monthlyMode === 'day'} onChange={() => setMonthlyMode('day')}
                          className="accent-[#FF4800]" />
                        <span className="text-xs text-slate-700 dark:text-slate-300">Day</span>
                        <SmallNum value={monthlyDayInterval} onChange={setMonthlyDayInterval} min={1} max={31} />
                        <span className="text-xs text-slate-700 dark:text-slate-300">of every</span>
                        <SmallNum value={monthlyMonthInterval} onChange={setMonthlyMonthInterval} min={1} max={12} />
                        <span className="text-xs text-slate-700 dark:text-slate-300">month(s)</span>
                      </label>
                      <label className={`${rowCls} cursor-pointer flex-wrap`}>
                        <input type="radio" name="monthlyMode" checked={monthlyMode === 'custom'} onChange={() => setMonthlyMode('custom')}
                          className="accent-[#FF4800]" />
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

                  {/* ── Yearly sub-options ── */}
                  {scheduleType === 'Yearly' && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-2.5">
                      <div className={rowCls}>
                        <span className="text-xs text-slate-600 dark:text-slate-400">Every</span>
                        <SmallNum value={yearlyEveryN} onChange={setYearlyEveryN} min={1} max={10} />
                        <span className="text-xs text-slate-600 dark:text-slate-400">year(s)</span>
                      </div>
                      <label className={`${rowCls} cursor-pointer flex-wrap`}>
                        <input type="radio" name="yearlyMode" checked={yearlyMode === 'month'} onChange={() => setYearlyMode('month')}
                          className="accent-[#FF4800]" />
                        <span className="text-xs text-slate-700 dark:text-slate-300">Every</span>
                        <SmallSelect value={yearlyMonth} onChange={setYearlyMonth}>
                          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </SmallSelect>
                        <SmallNum value={yearlyDayOfMonth} onChange={setYearlyDayOfMonth} min={1} max={31} />
                      </label>
                      <label className={`${rowCls} cursor-pointer flex-wrap`}>
                        <input type="radio" name="yearlyMode" checked={yearlyMode === 'custom'} onChange={() => setYearlyMode('custom')}
                          className="accent-[#FF4800]" />
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

                  {/* ── Start Date & Time ── */}
                  <div className="space-y-1">
                    <NLabel>Start Date & Time *</NLabel>
                    <input
                      type="datetime-local"
                      value={startsOn}
                      onChange={e => setStartsOn(e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  {/* ── Ends ── */}
                  <div className="space-y-1.5">
                    <NLabel>Ends</NLabel>
                    <div className="space-y-1.5">
                      <label className={`${rowCls} cursor-pointer`}>
                        <input type="radio" name="endsMode" checked={endsMode === 'never'} onChange={() => setEndsMode('never')}
                          className="accent-[#FF4800]" />
                        <span className="text-xs text-slate-700 dark:text-slate-300">Never</span>
                      </label>
                      <label className={`${rowCls} cursor-pointer`}>
                        <input type="radio" name="endsMode" checked={endsMode === 'after'} onChange={() => setEndsMode('after')}
                          className="accent-[#FF4800]" />
                        <span className="text-xs text-slate-700 dark:text-slate-300">After</span>
                        <SmallNum value={afterOccurrences} onChange={setAfterOccurrences} min={1} max={999} />
                        <span className="text-xs text-slate-700 dark:text-slate-300">occurrence(s)</span>
                      </label>
                      <label className={`${rowCls} cursor-pointer`}>
                        <input type="radio" name="endsMode" checked={endsMode === 'on'} onChange={() => setEndsMode('on')}
                          className="accent-[#FF4800]" />
                        <span className="text-xs text-slate-700 dark:text-slate-300">On</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                          className={`text-xs px-2 py-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] outline-none ${endsMode !== 'on' ? 'opacity-50 pointer-events-none' : ''}`}
                        />
                      </label>
                    </div>
                  </div>

                  {/* ── Live Recurrence Summary Banner ── */}
                  {summaryText && (
                    <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
                      <ClockIcon className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                      <span className="font-medium">{summaryText}</span>
                    </div>
                  )}

                  {/* ── Email Template ── */}
                  <div className="space-y-1">
                    <NLabel>Subject</NLabel>
                    <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                      placeholder={`${reportName} Report`}
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-1">
                    <NLabel>External Recipients</NLabel>
                    <input type="text" value={recipients} onChange={e => setRecipients(e.target.value)}
                      placeholder="alice@corp.com, bob@corp.com"
                      className={inputCls}
                    />
                    <p className="text-[10px] text-slate-400">Separate multiple emails with commas</p>
                  </div>

                </div>
              </div>
            )}

          </div>

          {/* ── Footer ── */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between gap-2 shrink-0">
            {isExportMode ? (
              <>
                <div />
                <div className="flex items-center gap-2">
                  <button type="button" onClick={onClose}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button type="button" onClick={handleExport} disabled={exporting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer">
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                    {exporting ? 'Exporting…' : `Download ${exportType}`}
                  </button>
                </div>
              </>
            ) : (
              <>
                {existingSchedule ? (
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={handleRunNow} disabled={runningNow}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer">
                      <PlayIcon className="w-3.5 h-3.5" />
                      {runningNow ? 'Running…' : 'Run Now'}
                    </button>
                    <button type="button" onClick={handleDeleteSchedule} disabled={deletingSchedule}
                      className="p-1.5 text-xs font-semibold text-rose-500 border border-rose-200 dark:border-rose-800/40 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Delete schedule">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button type="button" onClick={onClose}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button type="button" onClick={handleSaveSchedule} disabled={savingSchedule}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#FF4800] hover:bg-[#e03f00] rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer">
                    {savingSchedule ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : (
                      existingSchedule ? 'Update Schedule' : 'Create Schedule'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
