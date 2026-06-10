// COLOR_USAGE_EXAMPLES.jsx
// Practical examples of how to use the color palette in React components

import React, { useState } from 'react';

// Example 1: Primary Navigation Header
export const PrimaryHeader = () => {
  return (
    <header className="bg-primary-400 text-primary-25 px-6 py-4 shadow-md">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Bold BI Dashboard</h1>
        <nav className="flex gap-4">
          <a href="#" className="hover:text-secondary-yellow transition-colors">Home</a>
          <a href="#" className="hover:text-secondary-yellow transition-colors">Reports</a>
          <a href="#" className="hover:text-secondary-yellow transition-colors">Dashboards</a>
        </nav>
      </div>
    </header>
  );
};

// Example 2: Status Badges
export const StatusBadges = () => {
  const statuses = [
    { label: 'Active', color: 'badge-success' },
    { label: 'Pending', color: 'badge-warning' },
    { label: 'Error', color: 'badge-danger' },
    { label: 'Info', color: 'badge-info' },
    { label: 'Brand', color: 'badge-brand' },
  ];

  return (
    <div className="p-6 bg-neutral-50">
      <h2 className="text-primary-400 font-bold mb-4">Status Indicators</h2>
      <div className="flex gap-3 flex-wrap">
        {statuses.map(status => (
          <span key={status.label} className={status.color}>
            {status.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// Example 3: Alert Messages
export const AlertMessages = () => {
  return (
    <div className="space-y-4 p-6">
      {/* Success Alert */}
      <div className="bg-secondary-green bg-opacity-10 border-l-4 border-secondary-green p-4 rounded">
        <p className="text-secondary-green font-bold">Success</p>
        <p className="text-neutral-700">Report exported successfully</p>
      </div>

      {/* Error Alert */}
      <div className="bg-secondary-red bg-opacity-10 border-l-4 border-secondary-red p-4 rounded">
        <p className="text-secondary-red font-bold">Error</p>
        <p className="text-neutral-700">Failed to load dashboard</p>
      </div>

      {/* Warning Alert */}
      <div className="bg-secondary-yellow bg-opacity-10 border-l-4 border-secondary-yellow p-4 rounded">
        <p className="text-secondary-yellow font-bold">Warning</p>
        <p className="text-neutral-700">This action cannot be undone</p>
      </div>

      {/* Info Alert */}
      <div className="bg-secondary-blue bg-opacity-10 border-l-4 border-secondary-blue p-4 rounded">
        <p className="text-secondary-blue font-bold">Information</p>
        <p className="text-neutral-700">New features are now available</p>
      </div>
    </div>
  );
};

// Example 4: Button Group
export const ButtonGroup = () => {
  return (
    <div className="p-6 bg-neutral-50 space-y-4">
      <div className="flex gap-3 flex-wrap">
        <button className="btn-primary">Primary Action</button>
        <button className="btn-brand">Brand Orange</button>
        <button className="btn-secondary-green">Confirm</button>
        <button className="btn-secondary-red">Delete</button>
        <button className="btn-secondary-blue">Learn More</button>
      </div>
      
      <div className="flex gap-3 flex-wrap">
        <button className="btn-outline">Cancel</button>
        <button className="btn-secondary">Secondary</button>
      </div>
    </div>
  );
};

// Example 5: Card with Primary Accent
export const DashboardCard = ({ title, status, data }) => {
  return (
    <div className="card-primary">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-primary-400 font-bold text-lg">{title}</h3>
        <span className={`badge-${status.toLowerCase()}`}>
          {status}
        </span>
      </div>
      <div className="text-2xl font-bold text-neutral-700 mb-2">
        {data}
      </div>
      <p className="text-neutral-400">Last updated: Today</p>
    </div>
  );
};

// Example 6: Table with Row Highlighting
export const DataTable = () => {
  const rows = [
    { id: 1, name: 'Report 1', status: 'Active', value: 95 },
    { id: 2, name: 'Report 2', status: 'Pending', value: 73 },
    { id: 3, name: 'Report 3', status: 'Error', value: 0 },
    { id: 4, name: 'Report 4', status: 'Active', value: 88 },
  ];

  const getStatusColor = (status) => {
    switch(status) {
      case 'Active': return 'bg-secondary-green bg-opacity-10 text-secondary-green';
      case 'Pending': return 'bg-secondary-yellow bg-opacity-10 text-secondary-yellow';
      case 'Error': return 'bg-secondary-red bg-opacity-10 text-secondary-red';
      default: return 'bg-neutral-100 text-neutral-700';
    }
  };

  return (
    <div className="card">
      <h2 className="text-primary-400 font-bold mb-4">Reports Overview</h2>
      <table className="w-full">
        <thead className="border-b-2 border-neutral-200">
          <tr className="text-neutral-600">
            <th className="text-left py-2">Name</th>
            <th className="text-left py-2">Status</th>
            <th className="text-right py-2">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
              <td className="py-3 text-neutral-700">{row.name}</td>
              <td className="py-3">
                <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(row.status)}`}>
                  {row.status}
                </span>
              </td>
              <td className="py-3 text-right text-neutral-700 font-bold">{row.value}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Example 7: Sidebar Navigation
export const Sidebar = () => {
  const [activeItem, setActiveItem] = useState('dashboard');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '??' },
    { id: 'reports', label: 'Reports', icon: '??' },
    { id: 'analytics', label: 'Analytics', icon: '??' },
    { id: 'settings', label: 'Settings', icon: '??' },
  ];

  return (
    <aside className="bg-primary-400 text-primary-25 w-64 p-6 min-h-screen">
      <h2 className="text-2xl font-bold mb-8">Bold BI</h2>
      <nav className="space-y-2">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveItem(item.id)}
            className={`w-full text-left px-4 py-3 rounded transition-colors ${
              activeItem === item.id
                ? 'bg-primary-600 text-brand-orange'
                : 'hover:bg-primary-600 hover:text-secondary-yellow'
            }`}
          >
            <span className="mr-2">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
};

// Example 8: Form with Validation
export const FormExample = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Please enter a valid email');
    } else {
      setError('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card max-w-md">
      <h3 className="text-primary-400 font-bold mb-4">Subscribe</h3>
      
      <div className="mb-4">
        <label className="block text-neutral-700 font-medium mb-2">
          Email Address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`w-full border-2 rounded px-3 py-2 focus:outline-none transition-colors ${
            error
              ? 'border-secondary-red focus:ring-secondary-red'
              : 'border-neutral-200 focus:ring-primary-400 focus:border-primary-400'
          }`}
          placeholder="your@email.com"
        />
      </div>

      {error && (
        <p className="text-secondary-red text-sm mb-4">{error}</p>
      )}

      <button type="submit" className="btn-primary w-full">
        Subscribe
      </button>
    </form>
  );
};

// Example 9: Progress Indicator
export const ProgressIndicator = () => {
  return (
    <div className="card space-y-6">
      <h3 className="text-primary-400 font-bold">Progress Tracking</h3>

      {/* Success Progress */}
      <div>
        <label className="text-neutral-700 font-medium mb-2 block">
          <span>Processing</span>
          <span className="float-right text-secondary-green">100%</span>
        </label>
        <div className="w-full bg-neutral-200 rounded-full h-2">
          <div className="bg-secondary-green h-2 rounded-full w-full"></div>
        </div>
      </div>

      {/* In Progress */}
      <div>
        <label className="text-neutral-700 font-medium mb-2 block">
          <span>Uploading</span>
          <span className="float-right text-secondary-yellow">75%</span>
        </label>
        <div className="w-full bg-neutral-200 rounded-full h-2">
          <div className="bg-secondary-yellow h-2 rounded-full w-3/4"></div>
        </div>
      </div>

      {/* Not Started */}
      <div>
        <label className="text-neutral-700 font-medium mb-2 block">
          <span>Queue Position</span>
          <span className="float-right text-secondary-blue">25%</span>
        </label>
        <div className="w-full bg-neutral-200 rounded-full h-2">
          <div className="bg-secondary-blue h-2 rounded-full w-1/4"></div>
        </div>
      </div>
    </div>
  );
};

// Example 10: Filter/Tag Component
export const TagFilter = () => {
  const [selectedTags, setSelectedTags] = useState(['Active']);

  const tags = ['Active', 'Archived', 'Premium', 'Public', 'Private'];

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  return (
    <div className="card">
      <h3 className="text-primary-400 font-bold mb-4">Filter By Tags</h3>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`px-4 py-2 rounded-full transition-all ${
              selectedTags.includes(tag)
                ? 'bg-primary-400 text-primary-25'
                : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};

export default {
  PrimaryHeader,
  StatusBadges,
  AlertMessages,
  ButtonGroup,
  DashboardCard,
  DataTable,
  Sidebar,
  FormExample,
  ProgressIndicator,
  TagFilter,
};
