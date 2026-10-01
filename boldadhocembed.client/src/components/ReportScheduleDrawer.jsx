import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EnvelopeIcon,
  PlayIcon,
  TrashIcon,
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { reportsAPI, schedulesAPI, downloadFile } from '../services/apiService';
import { authService } from '../services/authService';

const EXPORT_FORMATS = [
  { id: 'PDF', label: 'PDF', ext: '.pdf', icon: '📄', desc: 'Standard printable document' },
  { id: 'Excel', label: 'Excel', ext: '.xlsx', icon: '📊', desc: 'Formatted spreadsheet with calculations' },
  { id: 'CSV', label: 'CSV', ext: '.csv', icon: '📋', desc: 'Raw tabular data for analysis' },
  { id: 'Word', label: 'Word', ext: '.docx', icon: '📝', desc: 'Editable document format' },
  { id: 'HTML', label: 'HTML', ext: '.html', icon: '🌐', desc: 'Self-contained interactive webpage' },
  { id: 'PPT', label: 'PPT', ext: '.pptx', icon: '📊', desc: 'Presentation slides' },
];

const RECURRENCE_OPTIONS = [
  { id: 'Daily (weekdays)', label: 'Daily (Weekdays: Mon - Fri)' },
  { id: 'Daily', label: 'Daily (Every day)' },
  { id: 'Weekly', label: 'Weekly' },
  { id: 'Monthly', label: 'Monthly' },
  { id: 'Hourly', label: 'Hourly' },
];

const WEEKDAYS_LIST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function cleanScheduleName(name) {
  if (!name) return '';
  return String(name).replace(/^(AlphaCorp|BetaSolutions|GammaIndustries|DeltaEnterprises)_/i, '').trim();
}

function toLocalInputValue(date = new Date()) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
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

export default function ReportScheduleDrawer({
  isOpen,
  onClose,
  report,
  onViewReport,
  isViewerOpen = false,
}) {
  const currentUser = useMemo(() => {
    const u = authService.getUser();
    return u?.user || u;
  }, []);

  // Dynamic Parameter states
  const [paramValues, setParamValues] = useState({});
  const [reportParams, setReportParams] = useState([]);
  const [paramsLoading, setParamsLoading] = useState(false);

  // Full Schedule configuration states
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [scheduleType, setScheduleType] = useState('Daily (weekdays)');
  const [hourlyInterval, setHourlyInterval] = useState('01:00');
  const [weeklyDays, setWeeklyDays] = useState(['Monday']);
  const [startsOn, setStartsOn] = useState(toLocalInputValue());
  const [endsMode, setEndsMode] = useState('never'); // 'never' | 'after' | 'on'
  const [afterOccurrences, setAfterOccurrences] = useState(1);
  const [endDate, setEndDate] = useState('');
  const [isEmailAttachment, setIsEmailAttachment] = useState(true);
  const [emailSubject, setEmailSubject] = useState('');
  const [recipients, setRecipients] = useState('');

  // Status & action states
  const [existingSchedule, setExistingSchedule] = useState(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState(null);
  const [runningNow, setRunningNow] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState(false);

  // Export states
  const [exportType, setExportType] = useState('PDF');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const reportId = report?.id || report?.Id || report?.ReportId;
  const reportName = report?.name || report?.Name || 'Report';

  // Initialize drawer data when opened or report changes
  useEffect(() => {
    if (!isOpen || !reportId) return;

    setScheduleMessage(null);
    setExportError(null);

    // Fetch existing schedule for this report
    const checkSchedule = async () => {
      try {
        const res = await schedulesAPI.getScheduleByReport(reportId);
        if (res && res.exists && res.schedule) {
          const sched = res.schedule;
          setExistingSchedule(sched);
          setIsScheduled(true);
          setScheduleName(cleanScheduleName(sched.name || sched.scheduleName || `${reportName} Schedule`));
          setIsEnabled(sched.enabled !== undefined ? !!sched.enabled : true);
          setScheduleType(sched.recurrenceType || sched.scheduleType || 'Daily (weekdays)');
          setStartsOn(sched.startDate || sched.startTime ? toLocalInputValue(sched.startDate || sched.startTime) : toLocalInputValue());
          setEndsMode(sched.neverEnd ? 'never' : (sched.endAfterOccurrence > 0 ? 'after' : (sched.endDate ? 'on' : 'never')));
          setAfterOccurrences(sched.endAfterOccurrence || 1);
          setEndDate(sched.endDate ? toLocalInputValue(sched.endDate) : '');
          setHourlyInterval(sched.hourlySchedule?.scheduleInterval || '01:00');
          if (sched.weeklySchedule?.recurrenceDays?.length) {
            setWeeklyDays(sched.weeklySchedule.recurrenceDays);
          }
          setIsEmailAttachment(sched.isEmailAttachment !== undefined ? !!sched.isEmailAttachment : true);
          setEmailSubject(`${reportName} Report`);
          if (sched.exportType) {
            setExportType(mapExportType(sched.exportType));
          }
          if (sched.externalRecipientsList?.length) {
            setRecipients(sched.externalRecipientsList.join(', '));
          } else {
            setRecipients(currentUser?.email || '');
          }
        } else {
          setExistingSchedule(null);
          setIsScheduled(false);
          setScheduleName(`${reportName} Schedule`);
          setIsEnabled(true);
          setScheduleType('Daily (weekdays)');
          setStartsOn(toLocalInputValue());
          setEndsMode('never');
          setAfterOccurrences(1);
          setEndDate('');
          setHourlyInterval('01:00');
          setWeeklyDays(['Monday']);
          setIsEmailAttachment(true);
          setEmailSubject(`${reportName} Report`);
          setRecipients(currentUser?.email || '');
        }
      } catch (err) {
        console.warn('Could not query existing schedule for report:', err);
        setExistingSchedule(null);
        setIsScheduled(false);
        setScheduleName(`${reportName} Schedule`);
        setRecipients(currentUser?.email || '');
      }
    };

    // Fetch dynamic report parameters via v5.0 API
    const loadParameters = async () => {
      setParamsLoading(true);
      try {
        const data = await reportsAPI.getParameters(reportId);
        if (Array.isArray(data)) {
          setReportParams(data);
          const initialVals = {};
          data.forEach((p) => {
            const val = p.DefaultValue ?? p.Values?.[0] ?? p.Value ?? '';
            initialVals[p.Name] = val;
          });
          setParamValues(initialVals);
        } else if (data && typeof data === 'object' && Array.isArray(data.Parameters)) {
          setReportParams(data.Parameters);
          const initialVals = {};
          data.Parameters.forEach((p) => {
            const val = p.DefaultValue ?? p.Values?.[0] ?? p.Value ?? '';
            initialVals[p.Name] = val;
          });
          setParamValues(initialVals);
        } else {
          setReportParams([]);
        }
      } catch (err) {
        console.warn('Parameters API call note:', err.message);
        setReportParams([]);
      } finally {
        setParamsLoading(false);
      }
    };

    checkSchedule();
    loadParameters();
  }, [isOpen, reportId, reportName, currentUser]);

  // Handle cascading parameter change
  const handleParamChange = async (name, value) => {
    const updated = { ...paramValues, [name]: value };
    setParamValues(updated);

    // Check if this parameter cascades
    const paramMeta = reportParams.find((p) => p.Name === name);
    if (paramMeta?.IsCascading || paramMeta?.HasCascadingDependency) {
      try {
        const filterPayload = {};
        Object.entries(updated).forEach(([k, v]) => {
          if (v !== '' && v !== null && v !== undefined) {
            filterPayload[k] = Array.isArray(v) ? v : [String(v)];
          }
        });
        const cascadeResult = await reportsAPI.getCascadingParameters(reportId, filterPayload);
        if (cascadeResult && Array.isArray(cascadeResult)) {
          setReportParams((prev) =>
            prev.map((p) => {
              const matched = cascadeResult.find((c) => c.Name === p.Name);
              return matched ? { ...p, ...matched } : p;
            })
          );
        }
      } catch (e) {
        console.warn('Cascading parameter update failed:', e);
      }
    }
  };

  // Schedule save / update
  const handleSaveSchedule = async () => {
    if (!reportId) return;
    setSavingSchedule(true);
    setScheduleMessage(null);

    try {
      const recipientList = recipients
        .split(/[,\n]/)
        .map((r) => r.trim())
        .filter(Boolean);

      if (recipientList.length === 0 && currentUser?.email) {
        recipientList.push(currentUser.email);
      }

      const payload = {
        ItemId: reportId,
        ItemType: 'Report',
        Name: scheduleName.trim() || `${reportName} Schedule`,
        ScheduleName: scheduleName.trim() || `${reportName} Schedule`,
        Description: `Automated ${scheduleType} dispatch of ${reportName}`,
        ScheduleType: scheduleType,
        ExportType: exportCodeToKey(exportType),
        StartTime: startsOn ? new Date(startsOn).toISOString() : new Date().toISOString(),
        NeverEnd: endsMode === 'never',
        EndAfterOccurrence: endsMode === 'after' ? Number(afterOccurrences) : 0,
        Enabled: isEnabled,
        IsEmailAttachment: !!isEmailAttachment,
        ExternalRecipientsList: recipientList,
      };

      if (scheduleType === 'Hourly') {
        payload.HourlySchedule = { ScheduleInterval: hourlyInterval || '01:00' };
      } else if (scheduleType === 'Weekly') {
        payload.WeeklySchedule = {
          RecurrenceWeeks: 1,
          RecurrenceDays: weeklyDays.length > 0 ? weeklyDays : ['Monday']
        };
      } else if (scheduleType === 'Monthly') {
        payload.MonthlySchedule = {
          RecurrenceType: 'DayRecurrence',
          DayRecurrence: {
            DayInterval: 1,
            MonthInterval: 1
          }
        };
      } else {
        payload.DailySchedule = {
          RecurrenceType: scheduleType === 'Daily (weekdays)' ? 'EveryWeekday' : 'EveryNdays',
          EveryNdays: 1,
          EveryWeekday: scheduleType === 'Daily (weekdays)'
        };
      }

      if (endsMode === 'on' && endDate) {
        payload.EndDate = new Date(endDate).toISOString();
      }

      const scheduleId = existingSchedule?.id || existingSchedule?.Id || existingSchedule?.name || existingSchedule?.Name;
      if (existingSchedule && scheduleId) {
        await schedulesAPI.update(scheduleId, payload);
      } else {
        await schedulesAPI.create(payload);
      }

      setScheduleMessage({ type: 'success', text: existingSchedule ? 'Schedule updated successfully!' : 'Schedule saved successfully!' });
      setTimeout(() => setScheduleMessage(null), 4000);

      // Refresh schedule status
      const res = await schedulesAPI.getScheduleByReport(reportId);
      if (res?.exists) {
        setExistingSchedule(res.schedule);
      }
    } catch (err) {
      console.error('Save schedule failed:', err);
      setScheduleMessage({ type: 'error', text: err.message || 'Failed to save schedule.' });
    } finally {
      setSavingSchedule(false);
    }
  };

  // Delete existing schedule
  const handleDeleteSchedule = async () => {
    const scheduleId = existingSchedule?.id || existingSchedule?.Id || existingSchedule?.name || existingSchedule?.Name;
    if (!scheduleId) return;
    setDeletingSchedule(true);
    try {
      await schedulesAPI.delete(scheduleId);
      setExistingSchedule(null);
      setIsScheduled(false);
      setScheduleMessage({ type: 'success', text: 'Schedule removed successfully.' });
      setTimeout(() => setScheduleMessage(null), 3000);
    } catch (err) {
      console.error('Delete schedule failed:', err);
      setScheduleMessage({ type: 'error', text: 'Failed to delete schedule.' });
    } finally {
      setDeletingSchedule(false);
    }
  };

  // Run schedule now
  const handleRunNow = async () => {
    const scheduleId = existingSchedule?.id || existingSchedule?.Id || existingSchedule?.name || existingSchedule?.Name;
    if (!scheduleId) return;
    setRunningNow(true);
    try {
      await schedulesAPI.runNow(scheduleId);
      setScheduleMessage({ type: 'success', text: 'Report schedule triggered! Emails will be sent.' });
      setTimeout(() => setScheduleMessage(null), 4000);
    } catch (err) {
      console.error('Run now failed:', err);
      setScheduleMessage({ type: 'error', text: 'Failed to trigger schedule execution.' });
    } finally {
      setRunningNow(false);
    }
  };

  // Export report v3
  const handleExport = async () => {
    if (!reportId) return;
    setExporting(true);
    setExportError(null);

    try {
      const filterParameters = {};
      Object.entries(paramValues).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) {
          filterParameters[k] = Array.isArray(v) ? v.map(String) : [String(v)];
        }
      });

      const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId);
      let resolvedServerPath = undefined;
      if (!isGuid) {
        resolvedServerPath = report?.serverPath || (report?.serverCategory ? `/${report.serverCategory}/${report.serverReportName || report.name}` : undefined);
      }

      // 1. If report viewer is active in DOM, try native viewer export first
      if (window.$) {
        try {
          const $viewer = window.$('[data-role="boldreportviewer"], .e-reportviewer, div[id*="report-viewer"], div[id*="viewer"]').first();
          if ($viewer && $viewer.data('boldReportViewer')) {
            const viewerObj = $viewer.data('boldReportViewer');
            if (typeof viewerObj.exportReport === 'function') {
              viewerObj.exportReport(exportType);
              setExporting(false);
              return;
            }
          }
        } catch (e) {
          console.warn('Active viewer export attempt failed, falling back to server API export:', e);
        }
      }

      // 2. Fall back to backend Export Report With Filters API
      const { blob, filename } = await reportsAPI.exportReportV3({
        reportId: reportId,
        reportName: reportName,
        serverPath: resolvedServerPath,
        exportType: exportType,
        filterParameters,
      });

      downloadFile(blob, filename || `${reportName}.${exportType.toLowerCase()}`);
    } catch (err) {
      console.error('Export error:', err);
      setExportError(err.message || 'Export failed. Please check report parameters.');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen || !report) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] transition-opacity"
        />

        {/* Slide-out Drawer Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative w-full max-w-[440px] bg-white dark:bg-[#181c2c] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <div className="min-w-0 pr-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {reportName}
              </h2>
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
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Close drawer"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body - Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 divide-y divide-slate-100 dark:divide-slate-800/60">
            {/* Status notifications */}
            {scheduleMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  scheduleMessage.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {scheduleMessage.type === 'success' ? (
                  <CheckCircleIcon className="w-4 h-4 shrink-0 text-emerald-500" />
                ) : (
                  <ExclamationCircleIcon className="w-4 h-4 shrink-0 text-rose-500" />
                )}
                <span>{scheduleMessage.text}</span>
              </motion.div>
            )}

            {/* SECTION 1: Report Parameters */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <AdjustmentsHorizontalIcon className="w-3.5 h-3.5 text-[#FF4800]" />
                  Filter Parameters
                </label>
                {paramsLoading && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <ArrowPathIcon className="w-3 h-3 animate-spin" /> Loading...
                  </span>
                )}
              </div>

              {reportParams && reportParams.length > 0 ? (
                <div className="space-y-3">
                  {reportParams.map((param) => {
                    const options = (param.ValidValues || param.Values || param.AvailableValues || []).map((v) =>
                      typeof v === 'object' ? { label: v.Label || v.Name || v.Value, value: v.Value } : { label: String(v), value: v }
                    );

                    return (
                      <div key={param.Name} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {param.Prompt || param.Name}
                          </label>
                          {param.Nullable && (
                            <span className="text-[10px] text-slate-400">Optional</span>
                          )}
                        </div>

                        {options.length > 0 ? (
                          <select
                            value={paramValues[param.Name] ?? ''}
                            onChange={(e) => handleParamChange(param.Name, e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] focus:border-[#FF4800] outline-none"
                          >
                            {param.Nullable && <option value="">-- None --</option>}
                            {options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : param.DataType === 'DateTime' || param.Type === 'DateTime' ? (
                          <input
                            type="date"
                            value={paramValues[param.Name] ?? ''}
                            onChange={(e) => handleParamChange(param.Name, e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] focus:border-[#FF4800] outline-none"
                          />
                        ) : (
                          <input
                            type="text"
                            value={paramValues[param.Name] ?? ''}
                            onChange={(e) => handleParamChange(param.Name, e.target.value)}
                            placeholder={`Enter ${param.Prompt || param.Name}`}
                            className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] focus:border-[#FF4800] outline-none"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 rounded-xl text-center">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Standard report dataset filters applied automatically.
                  </p>
                </div>
              )}
            </div>

            {/* SECTION 2: Schedule Configuration (Full parity with Schedules.jsx) */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-white">
                    Schedule Report
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Configure automated email deliveries
                  </p>
                </div>
                {/* Modern iOS-style Toggle Switch */}
                <button
                  type="button"
                  onClick={() => setIsScheduled(!isScheduled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isScheduled ? 'bg-[#183955]' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                  role="switch"
                  aria-checked={isScheduled}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isScheduled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Collapsible full schedule settings */}
              <AnimatePresence>
                {isScheduled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3.5 pt-2"
                  >
                    {/* Schedule Name */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Schedule Name *
                      </label>
                      <input
                        type="text"
                        value={scheduleName}
                        onChange={(e) => setScheduleName(e.target.value)}
                        placeholder="e.g. Weekly Executive Performance Email"
                        className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] focus:border-[#FF4800] outline-none"
                      />
                    </div>

                    {/* Frequency Dropdown */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Frequency
                      </label>
                      <select
                        value={scheduleType}
                        onChange={(e) => setScheduleType(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] focus:border-[#FF4800] outline-none"
                      >
                        {RECURRENCE_OPTIONS.map((rec) => (
                          <option key={rec.id} value={rec.id}>
                            {rec.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Hourly Interval sub-option */}
                    {scheduleType === 'Hourly' && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Hourly Interval
                        </label>
                        <select
                          value={hourlyInterval}
                          onChange={(e) => setHourlyInterval(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] focus:border-[#FF4800] outline-none"
                        >
                          <option value="00:15">Every 15 minutes</option>
                          <option value="00:30">Every 30 minutes</option>
                          <option value="01:00">Every 1 hour</option>
                          <option value="02:00">Every 2 hours</option>
                          <option value="04:00">Every 4 hours</option>
                          <option value="08:00">Every 8 hours</option>
                          <option value="12:00">Every 12 hours</option>
                        </select>
                      </div>
                    )}

                    {/* Weekly Days sub-option */}
                    {scheduleType === 'Weekly' && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Recurrence Days
                        </label>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {WEEKDAYS_LIST.map((day) => {
                            const active = weeklyDays.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  setWeeklyDays((prev) =>
                                    active ? prev.filter((d) => d !== day) : [...prev, day]
                                  );
                                }}
                                className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                                  active
                                    ? 'bg-[#183955] text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                {day.slice(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Start Date & Time */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Start Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={startsOn}
                        onChange={(e) => setStartsOn(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] focus:border-[#FF4800] outline-none"
                      />
                    </div>

                    {/* End Condition */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Ends Condition
                      </label>
                      <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg text-center">
                        <button
                          type="button"
                          onClick={() => setEndsMode('never')}
                          className={`py-1 text-[11px] font-semibold rounded-md transition ${
                            endsMode === 'never'
                              ? 'bg-white dark:bg-slate-700 text-[#FF4800] shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Never
                        </button>
                        <button
                          type="button"
                          onClick={() => setEndsMode('after')}
                          className={`py-1 text-[11px] font-semibold rounded-md transition ${
                            endsMode === 'after'
                              ? 'bg-white dark:bg-slate-700 text-[#FF4800] shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          After Occurrences
                        </button>
                        <button
                          type="button"
                          onClick={() => setEndsMode('on')}
                          className={`py-1 text-[11px] font-semibold rounded-md transition ${
                            endsMode === 'on'
                              ? 'bg-white dark:bg-slate-700 text-[#FF4800] shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          End Date
                        </button>
                      </div>
                      {endsMode === 'after' && (
                        <div className="pt-1 flex items-center gap-2">
                          <span className="text-[11px] text-slate-500">End after</span>
                          <input
                            type="number"
                            min="1"
                            max="999"
                            value={afterOccurrences}
                            onChange={(e) => setAfterOccurrences(e.target.value)}
                            className="w-20 text-xs px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white text-center focus:ring-1 focus:ring-[#FF4800] outline-none"
                          />
                          <span className="text-[11px] text-slate-500">occurrences</span>
                        </div>
                      )}
                      {endsMode === 'on' && (
                        <div className="pt-1">
                          <input
                            type="datetime-local"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] focus:border-[#FF4800] outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {/* Email Subject */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Email Subject
                      </label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Report Email Subject"
                        className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] focus:border-[#FF4800] outline-none"
                      />
                    </div>

                    {/* Addresses */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Recipients (Comma or Newline Separated)
                      </label>
                      <textarea
                        rows={2}
                        value={recipients}
                        onChange={(e) => setRecipients(e.target.value)}
                        placeholder="admin@company.com, analytics@company.com"
                        className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FF4800] focus:border-[#FF4800] outline-none resize-none"
                      />
                    </div>

                    {/* Delivery Options Checkboxes */}
                    <div className="flex flex-col gap-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isEmailAttachment}
                          onChange={(e) => setIsEmailAttachment(e.target.checked)}
                          className="w-4 h-4 rounded text-[#FF4800] focus:ring-[#FF4800] accent-[#FF4800]"
                        />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Attach Exported File to Email</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => setIsEnabled(e.target.checked)}
                          className="w-4 h-4 rounded text-[#FF4800] focus:ring-[#FF4800] accent-[#FF4800]"
                        />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Enable Schedule Active Delivery</span>
                      </label>
                    </div>

                    {/* Schedule action toolbar */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleSaveSchedule}
                        disabled={savingSchedule}
                        className="flex-1 py-2.5 px-3 text-xs font-semibold text-white bg-[#183955] hover:bg-[#122b40] rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        {savingSchedule ? (
                          <>
                            <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <CalendarDaysIcon className="w-3.5 h-3.5" />
                            <span>{existingSchedule ? 'Update Schedule' : 'Save Schedule'}</span>
                          </>
                        )}
                      </button>

                      {existingSchedule && (
                        <>
                          <button
                            type="button"
                            onClick={handleRunNow}
                            disabled={runningNow}
                            className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-emerald-600 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 transition-colors"
                            title="Run Schedule Now"
                          >
                            <PlayIcon className={`w-3.5 h-3.5 ${runningNow ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteSchedule}
                            disabled={deletingSchedule}
                            className="p-2.5 text-slate-400 hover:text-rose-600 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 transition-colors"
                            title="Delete Schedule"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* SECTION 3: REPORT OPTIONS / Export (Hidden when viewer is already open) */}
            {!isViewerOpen && (
              <div className="space-y-3 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    REPORT OPTIONS
                  </span>
                  <span className="text-[10px] text-slate-400">Bold Reports v5.0 Export</span>
                </div>

                {/* Format pills */}
                <div className="grid grid-cols-6 gap-1">
                  {EXPORT_FORMATS.map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setExportType(fmt.id)}
                      className={`py-2 px-1 rounded-xl text-center border transition-all flex flex-col items-center gap-0.5 ${
                        exportType === fmt.id
                          ? 'bg-orange-50 dark:bg-orange-950/40 border-[#FF4800] text-[#FF4800] font-bold shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-sm">{fmt.icon}</span>
                      <span className="text-[10px]">{fmt.label}</span>
                    </button>
                  ))}
                </div>

                {exportError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-600 dark:text-rose-300 space-y-2">
                    <div className="font-medium">{exportError}</div>
                    {onViewReport && (
                      <button
                        type="button"
                        onClick={() => onViewReport(report)}
                        className="w-full py-1.5 px-3 text-xs font-semibold bg-[#FF4800] hover:bg-[#e03f00] text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <EyeIcon className="w-3.5 h-3.5" />
                        <span>Open in Report Viewer to Export</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Export button */}
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full py-2.5 px-4 text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                >
                  {exporting ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin text-[#FF4800]" />
                      <span>Generating {exportType} export...</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownTrayIcon className="w-4 h-4 text-[#FF4800]" />
                      <span>Export {exportType}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className={`py-2.5 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors shadow-2xs ${
                isViewerOpen ? 'w-full' : ''
              }`}
            >
              Close
            </button>

            {!isViewerOpen && onViewReport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewReport(report);
                }}
                className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-gradient-to-r from-[#FF4800] to-[#E03E00] hover:brightness-105 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                <EyeIcon className="w-4 h-4" />
                <span>View Full Report</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
