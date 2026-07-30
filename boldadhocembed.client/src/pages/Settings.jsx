import React, { useState, useEffect } from 'react';
import {
  CogIcon,
  ServerIcon,
  AdjustmentsHorizontalIcon,
  BellIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { reportsAPI } from '../services/apiService';
import dashboardsAPI from '../services/dashboardService';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [reportsSettings, setReportsSettings] = useState(null);
  const [biSettings, setBiSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // General Settings States
  const [notificationConfig, setNotificationConfig] = useState(() => {
    const saved = localStorage.getItem('settings_notifications');
    return saved ? JSON.parse(saved) : {
      newReports: true,
      failures: true,
      accessChanges: false
    };
  });
  const [appTheme, setAppTheme] = useState(() => {
    return localStorage.getItem('settings_theme') || 'System Default';
  });
  const [defaultFormat, setDefaultFormat] = useState(() => {
    return localStorage.getItem('settings_default_format') || 'PDF';
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const [repConfig, biConfig] = await Promise.all([
          reportsAPI.getViewerSettings().catch(() => null),
          dashboardsAPI.getEmbedConfig('new').catch(() => null)
        ]);
        setReportsSettings(repConfig);
        setBiSettings(biConfig);
      } catch (err) {
        console.error('Failed to load settings configs', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const handleThemeChange = () => {
      setAppTheme(localStorage.getItem('settings_theme') || 'System Default');
    };
    window.addEventListener('theme-changed', handleThemeChange);
    return () => {
      window.removeEventListener('theme-changed', handleThemeChange);
    };
  }, []);

  const handleSavePreferences = () => {
    localStorage.setItem('settings_notifications', JSON.stringify(notificationConfig));
    localStorage.setItem('settings_theme', appTheme);
    localStorage.setItem('settings_default_format', defaultFormat);

    // Dispatch custom event to notify other parts of the app (like App.jsx) of theme changes
    window.dispatchEvent(new Event('theme-changed'));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const tabs = [
    { id: 'general', name: 'General Preferences', icon: AdjustmentsHorizontalIcon },
    { id: 'reports', name: 'Report Server Config', icon: ServerIcon },
    { id: 'dashboards', name: 'BI Dashboard Config', icon: CogIcon }
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 font-inter p-6">
      {/* Page Header */}
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your application preferences and integration server details.
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-indigo-600"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">Loading settings...</p>
        </div>
      ) : (
        <div className="flex-1 flex gap-6 min-h-0">
          {/* Settings Sidebar */}
          <div className="w-64 bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-3 flex flex-col gap-1.5 h-fit flex-shrink-0 shadow-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white border border-transparent'
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.name}
                </button>
              );
            })}
          </div>

          {/* Settings Content Area */}
          <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-sm flex flex-col min-h-0 overflow-y-auto">
            {activeTab === 'general' && (
              <div className="p-8 space-y-8">
                {/* Application Customization */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Customization</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Customize format and display configuration settings.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                        Default Report Export Format
                      </label>
                      <select
                        value={defaultFormat}
                        onChange={(e) => setDefaultFormat(e.target.value)}
                        className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-gray-200"
                      >
                        <option>PDF</option>
                        <option>Excel</option>
                        <option>HTML</option>
                        <option>CSV</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                        Application Theme
                      </label>
                      <select
                        value={appTheme}
                        onChange={(e) => setAppTheme(e.target.value)}
                        className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-gray-200"
                      >
                        <option>System Default</option>
                        <option>Light Theme</option>
                        <option>Dark Theme</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Notifications Panel */}
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <BellIcon className="w-5 h-5 text-indigo-500" />
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Notifications Preferences</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Toggle automated notifications rules.</p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationConfig.newReports}
                        onChange={(e) => setNotificationConfig(prev => ({ ...prev, newReports: e.target.checked }))}
                        className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Email notifications for new report additions
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationConfig.failures}
                        onChange={(e) => setNotificationConfig(prev => ({ ...prev, failures: e.target.checked }))}
                        className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Email notifications for scheduled delivery task failures
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationConfig.accessChanges}
                        onChange={(e) => setNotificationConfig(prev => ({ ...prev, accessChanges: e.target.checked }))}
                        className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Email notifications for workspace security updates
                      </span>
                    </label>
                  </div>
                </div>

                {savedSuccess && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-900/50 text-sm font-medium">
                    <CheckCircleIcon className="w-4 h-4" />
                    Preferences saved successfully!
                  </div>
                )}
                <button
                  onClick={handleSavePreferences}
                  className="e-primary modern-btn"
                >
                  {savedSuccess ? 'Saved!' : 'Save Preferences'}
                </button>
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Bold Reports Configuration</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Embed integration credentials and endpoints for Bold Reports.</p>
                  </div>
                  {reportsSettings ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50">
                      <CheckCircleIcon className="w-4 h-4" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50">
                      <ExclamationCircleIcon className="w-4 h-4" /> Config Missing
                    </span>
                  )}
                </div>

                {reportsSettings ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Server URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={reportsSettings.serverUrl || ''}
                          className="flex-1 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 outline-none"
                        />
                        <button
                          onClick={() => handleCopy(reportsSettings.serverUrl, 'rep-serverUrl')}
                          className="p-2 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500"
                        >
                          {copiedField === 'rep-serverUrl' ? (
                            <ClipboardDocumentCheckIcon className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <ClipboardDocumentIcon className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Site Identifier</label>
                        <input
                          type="text"
                          readOnly
                          value={reportsSettings.reportsSiteIdentifier || 'site/b1159702'}
                          className="w-full border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Service URL</label>
                        <input
                          type="text"
                          readOnly
                          value={reportsSettings.serviceUrl || ''}
                          className="w-full border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Integration Token</label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          readOnly
                          value={reportsSettings.token || ''}
                          className="flex-1 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 outline-none"
                        />
                        <button
                          onClick={() => handleCopy(reportsSettings.token, 'rep-token')}
                          className="p-2 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500"
                        >
                          {copiedField === 'rep-token' ? (
                            <ClipboardDocumentCheckIcon className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <ClipboardDocumentIcon className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ExclamationCircleIcon className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Configuration Not Found</p>
                    <p className="text-xs text-gray-500">No settings found on the server. Please check your appsettings.json file configuration.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'dashboards' && (
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Bold BI Configuration</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Embed integration credentials and endpoints for Bold BI.</p>
                  </div>
                  {biSettings ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50">
                      <CheckCircleIcon className="w-4 h-4" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50">
                      <ExclamationCircleIcon className="w-4 h-4" /> Config Missing
                    </span>
                  )}
                </div>

                {biSettings ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Server URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={biSettings.serverUrl || ''}
                          className="flex-1 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 outline-none"
                        />
                        <button
                          onClick={() => handleCopy(biSettings.serverUrl, 'bi-serverUrl')}
                          className="p-2 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500"
                        >
                          {copiedField === 'bi-serverUrl' ? (
                            <ClipboardDocumentCheckIcon className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <ClipboardDocumentIcon className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Site Identifier</label>
                        <input
                          type="text"
                          readOnly
                          value={biSettings.siteIdentifier || ''}
                          className="w-full border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Environment Type</label>
                        <input
                          type="text"
                          readOnly
                          value={biSettings.environment || ''}
                          className="w-full border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">User Email Address</label>
                      <input
                        type="text"
                        readOnly
                        value={biSettings.userEmail || ''}
                        className="w-full border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No settings configuration found on the server. Please check your appsettings.json file configuration.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
