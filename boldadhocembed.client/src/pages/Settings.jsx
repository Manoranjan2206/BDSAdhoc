import { BellIcon, LockClosedIcon, CogIcon, UserIcon } from '@heroicons/react/24/outline';

export default function Settings() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your application preferences and configurations
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Account Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <UserIcon className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Account Settings
              </h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                defaultValue="Admin User"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                defaultValue="admin@boldreports.com"
                className="w-full"
              />
            </div>
            <button className="btn-primary">Save Changes</button>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <LockClosedIcon className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Security
              </h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                Change Password
              </label>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Current Password"
                  className="w-full"
                />
                <input
                  type="password"
                  placeholder="New Password"
                  className="w-full"
                />
                <input
                  type="password"
                  placeholder="Confirm New Password"
                  className="w-full"
                />
              </div>
            </div>
            <button className="btn-primary">Update Password</button>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <BellIcon className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Notifications
              </h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span className="text-gray-700 dark:text-gray-300">
                Email notifications for new reports
              </span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span className="text-gray-700 dark:text-gray-300">
                Email notifications for scheduled report failures
              </span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="w-4 h-4" />
              <span className="text-gray-700 dark:text-gray-300">
                Email notifications for user access changes
              </span>
            </label>
            <button className="btn-primary">Save Preferences</button>
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <CogIcon className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                System Configuration
              </h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Report Format
              </label>
              <select className="w-full">
                <option>PDF</option>
                <option>Excel</option>
                <option>HTML</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Session Timeout (minutes)
              </label>
              <input
                type="number"
                defaultValue="30"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Application Theme
              </label>
              <select className="w-full">
                <option>System Default</option>
                <option>Light</option>
                <option>Dark</option>
              </select>
            </div>
            <button className="btn-primary">Save Configuration</button>
          </div>
        </div>
      </div>
    </div>
  );
}
