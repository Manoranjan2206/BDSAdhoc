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
    ? `Edit Schedule – ${schedule.reportName || 'Report'}`
    : 'Create New Schedule';

  // Robust category matching
  let initialCategory = '';
  if (isEdit && schedule.categoryName) {
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

  const [formData, setFormData] = useState({
    category: initialCategory,
    reportId: initialReportId,
    reportName: initialReportName,
    scheduleName: isEdit ? (schedule.name || '') : '',
    enabled: isEdit ? !!schedule.enabled : true,
    type: schedule?.scheduleType || 'Hourly',
    startsOn: schedule?.startTime || toLocalInputValue(),
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

  const handleWeeklyToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      weeklyDays: prev.weeklyDays.includes(day)
        ? prev.weeklyDays.filter(d => d !== day)
        : [...prev.weeklyDays, day]
    }));
  };

  const onSubmit = async () => {
    if (!formData.reportId || !formData.scheduleName.trim()) {
      alert('Please select a report and enter a schedule name.');
      return;
    }

    const payload = {
      Name: formData.scheduleName.trim(),
      Description: formData.reportName,
      ItemType: 'Schedule',
      ItemId: formData.reportId,
      ExportType: formData.format,
      StartTime: new Date(formData.startsOn).toISOString(),
      NeverEnd: formData.endsMode === 'never',
      EndAfterOccurrence: formData.endsMode === 'after' ? Number(formData.afterOccurrences) : 0,
      Enabled: formData.enabled,
      // Include email attachment flag expected by Bold Reports API
      IsEmailAttachment: !!formData.isEmailAttachment,
      ExternalRecipientsList: formData.recipients.split(',').map(e => e.trim()).filter(Boolean),
      ScheduleType: formData.type,
    };
    if (formData.type === 'Hourly') {
      payload.HourlySchedule = { ScheduleInterval: formData.hourlyInterval };
    }
    if (formData.endsMode === 'on' && formData.endDate) {
      payload.EndDate = new Date(formData.endDate).toISOString();
    }
    // Remove undefined fields just in case
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    try {
      // Support both `id` and `Id` coming from server; prefer id-like fields
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

      alert(isEdit ? 'Updated!' : 'Created!');
      // Let parent refresh schedules without reloading the whole app
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      console.error('Schedule save error:', err);
      alert(`Failed to save: ${err?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-5 flex justify-between items-center">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-2xl">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Report Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category *</label>
              <select className="w-full border rounded px-3 py-2" value={formData.category} onChange={(e) => handleCategoryChange(e.target.value)}>
                <option value="">Select Category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Report *</label>
              <select className="w-full border rounded px-3 py-2" value={formData.reportId} onChange={(e) => handleReportChange(e.target.value)} disabled={!formData.category}>
                <option value="">{formData.category ? 'Select Report' : 'Select Category First'}</option>
                {(reportsByCategory[formData.category] || []).map(r => <option key={r.Id} value={r.Id}>{r.Name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Schedule Name *</label>
            <input type="text" className="w-full border rounded px-3 py-2" value={formData.scheduleName} onChange={(e) => setFormData(prev => ({ ...prev, scheduleName: e.target.value }))} placeholder="e.g. Daily Sales Report" />
          </div>

          {/* Frequency */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select className="w-full border rounded px-3 py-2" value={formData.type} onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}>
                <option>Hourly</option>
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
                <option>Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Starts on *</label>
              <input type="datetime-local" className="w-full border rounded px-3 py-2" value={formData.startsOn} onChange={(e) => setFormData(prev => ({ ...prev, startsOn: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ends</label>
              <select className="w-full border rounded px-3 py-2" value={formData.endsMode} onChange={(e) => setFormData(prev => ({ ...prev, endsMode: e.target.value }))}>
                <option value="never">Never</option>
                <option value="after">After Occurrences</option>
                <option value="on">On Date</option>
              </select>
            </div>
          </div>

          {/* Conditional fields... (keep your logic) */}

          {/* Delivery */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Export Format</label>
              <select className="w-full border rounded px-3 py-2" value={formData.format} onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value }))}>
                <option>Pdf</option>
                <option>Word</option>
                <option>Excel</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Recipients</label>
              <input type="text" className="w-full border rounded px-3 py-2" value={formData.recipients} onChange={(e) => setFormData(prev => ({ ...prev, recipients: e.target.value }))} placeholder="email1@example.com, email2@example.com" />
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={formData.isEmailAttachment} onChange={(e) => setFormData(prev => ({ ...prev, isEmailAttachment: e.target.checked }))} />
                <span className="text-sm">Send as email attachment</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-5 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 border rounded">Cancel</button>
          <button onClick={onSubmit} className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded">{isEdit ? 'Update' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Schedules() {
  const { getSchedules, getReports, invalidate } = useData();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(VIEW_MODES.CARD);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [categories, setCategories] = useState([]);
  const [reportsByCategory, setReportsByCategory] = useState({});
  const [runningId, setRunningId] = useState(null);

  const reloadSchedules = async () => {
    try {
      // Invalidate cached schedules (DataContext) so we fetch fresh data
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
        const list = await getSchedules();
        setSchedules(Array.isArray(list) ? list : []);

        let tree = await getReports();
        // Handle null/undefined tree
        if (!tree) {
          tree = [];
        } else if (!Array.isArray(tree)) {
          // Try to extract Categories from wrapped response
          tree = (tree.Categories || tree.categories || []);
        }
        
        const cat = [];
        const map = {};
        
        // Ensure tree is an array before iterating
        if (Array.isArray(tree)) {
          tree.forEach(c => {
            const name = (c.Name || c.name || '').trim();
            if (name) {
              cat.push(name);
              map[name] = (c.Reports || c.reports || []).map(r => ({ Id: r.Id || r.id, Name: r.Name || r.name })).filter(r => r.Id);
            }
          });
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
  }, [getSchedules, getReports]);

  const handleRunNow = async (id) => {
    setRunningId(id);
    try {
      await schedulesAPI.runNow(id);
      alert('Report triggered!');
    } catch {
      alert('Failed.');
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this schedule?')) return;
    try {
      await schedulesAPI.delete(id);
      // Invalidate cache and reload fresh schedules
      invalidate && invalidate('schedules');
      await reloadSchedules();
      alert('Deleted.');
    } catch (err) {
      console.error('Delete schedule failed:', err);
      alert('Failed to delete schedule.');
    }
  };

  const renderCard = (s) => (
    <div key={s.id} className="bg-white rounded-xl shadow-md border overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 text-white">
        <h3 className="font-bold text-lg">{s.name || 'Untitled'}</h3>
        <p className="text-sm opacity-90">{s.reportName}</p>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${s.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            {s.enabled ? 'Active' : 'Paused'}
          </span>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
            {mapExportType(s.exportType)}
          </span>
        </div>
        <p className="text-sm text-gray-600">
          Next Run: {s.nextSchedule ? new Date(s.nextSchedule).toLocaleString() : '—'}
        </p>
      </div>
      <div className="bg-gray-50 px-4 py-3 flex justify-between items-center">
        <button
          onClick={() => handleRunNow(s.id)}
          disabled={runningId === s.id}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <PlayIcon className="w-4 h-4" />
          {runningId === s.id ? 'Running...' : 'Run Now'}
        </button>
        <div className="flex gap-2">
          <button onClick={() => { setEditingSchedule(s); setShowModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
            <PencilIcon className="w-5 h-5" />
          </button>
          <button onClick={() => handleDelete(s.name || s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6 rounded-xl overflow-hidden border border-indigo-100">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 text-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Scheduled Reports</h1>
            <p className="opacity-90">Manage, execute, and monitor your automated report deliveries</p>
          </div>
          <button
            onClick={() => { setEditingSchedule(null); setShowModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium border border-white/20"
          >
            <PlusIcon className="w-5 h-5" />
            Create New
          </button>
        </div>
      </div>

      <div className="flex justify-end mb-4 gap-2">
        <button onClick={() => setViewMode(VIEW_MODES.CARD)} className={`p-2 rounded ${viewMode === VIEW_MODES.CARD ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600'}`}><Squares2X2Icon className="w-5 h-5" /></button>
        <button onClick={() => setViewMode(VIEW_MODES.LIST)} className={`p-2 rounded ${viewMode === VIEW_MODES.LIST ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600'}`}><ViewColumnsIcon className="w-5 h-5" /></button>
        <button onClick={() => setViewMode(VIEW_MODES.TABLE)} className={`p-2 rounded ${viewMode === VIEW_MODES.TABLE ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600'}`}><TableCellsIcon className="w-5 h-5" /></button>
      </div>

      {loading ? <p className="text-center">Loading...</p> : 
       schedules.length === 0 ? <p className="text-center text-gray-500">No schedules yet.</p> :
       viewMode === VIEW_MODES.CARD ? 
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {schedules.map(renderCard)}
         </div> :
       viewMode === VIEW_MODES.LIST ?
         <div className="space-y-4">
           {schedules.map(s => (
             <div key={s.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
               <div>
                 <h3 className="font-semibold">{s.name}</h3>
                 <p className="text-sm text-gray-600">{s.reportName} • Next: {new Date(s.nextSchedule).toLocaleString()}</p>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => handleRunNow(s.id)} className="px-4 py-2 bg-green-600 text-white rounded">Run Now</button>
                 <button onClick={() => { setEditingSchedule(s); setShowModal(true); }}><PencilIcon className="w-5 h-5 text-blue-600" /></button>
               </div>
             </div>
           ))}
         </div> :
         <table className="w-full border-collapse">
           <thead>
             <tr className="bg-gray-100">
               <th className="p-3 text-left">Name</th>
               <th className="p-3 text-left">Report</th>
               <th className="p-3 text-left">Next Run</th>
               <th className="p-3 text-left">Status</th>
               <th className="p-3 text-center">Actions</th>
             </tr>
           </thead>
           <tbody>
             {schedules.map(s => (
               <tr key={s.id} className="border-b hover:bg-gray-50">
                 <td className="p-3">{s.name}</td>
                 <td className="p-3">{s.reportName}</td>
                 <td className="p-3">{new Date(s.nextSchedule).toLocaleString()}</td>
                 <td className="p-3">{s.enabled ? 'Active' : 'Paused'}</td>
                 <td className="p-3 text-center">
                   <button onClick={() => handleRunNow(s.id)} className="text-green-600 mr-3">Run</button>
                   <button onClick={() => { setEditingSchedule(s); setShowModal(true); }} className="text-blue-600">Edit</button>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
      }

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