import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import datasetService from '../services/dataset';
import type { Dataset } from '../services/dataset';

interface Activity {
  id: string;
  type: 'upload' | 'profile' | 'clean' | 'download' | 'login';
  title: string;
  description: string;
  timestamp: Date;
  datasetId?: number;
}

const iconMap = {
  upload: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
  ),
  profile: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  ),
  clean: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
  ),
  download: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  ),
  login: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
  ),
};

const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
  upload: { bg: 'bg-blue-100', text: 'text-blue-600', ring: 'ring-blue-200' },
  profile: { bg: 'bg-green-100', text: 'text-green-600', ring: 'ring-green-200' },
  clean: { bg: 'bg-purple-100', text: 'text-purple-600', ring: 'ring-purple-200' },
  download: { bg: 'bg-yellow-100', text: 'text-yellow-600', ring: 'ring-yellow-200' },
  login: { bg: 'bg-gray-100', text: 'text-gray-600', ring: 'ring-gray-200' },
};

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildActivities(datasets: Dataset[]): Activity[] {
  const events: Activity[] = [];
  for (const ds of datasets) {
    const name = ds.name || ds.original_filename;
    events.push({
      id: `upload-${ds.id}`,
      type: 'upload',
      title: 'Dataset uploaded',
      description: `"${name}" was uploaded (${datasetService.formatFileSize(ds.file_size)})`,
      timestamp: new Date(ds.created_at),
      datasetId: ds.id,
    });
    if (ds.profiled_at) {
      events.push({
        id: `profile-${ds.id}`,
        type: 'profile',
        title: 'Profiling completed',
        description: `"${name}" was profiled${ds.row_count ? ` — ${ds.row_count.toLocaleString()} rows` : ''}`,
        timestamp: new Date(ds.profiled_at),
        datasetId: ds.id,
      });
    }
    if (ds.cleaned_at) {
      events.push({
        id: `clean-${ds.id}`,
        type: 'clean',
        title: 'Cleaning completed',
        description: `"${name}" was cleaned and is ready for ML`,
        timestamp: new Date(ds.cleaned_at),
        datasetId: ds.id,
      });
    }
  }
  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

const Activities: React.FC = () => {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    datasetService.getDatasets().then((data) => {
      if (!cancelled) setDatasets(data);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const activities = buildActivities(datasets);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEvents = activities.filter((a) => a.timestamp >= today);
  const earlierEvents = activities.filter((a) => a.timestamp < today);

  const uploadCount = datasets.length;
  const profiledCount = datasets.filter((d) => d.profiled_at || ['profiled', 'cleaning', 'cleaned'].includes(d.status)).length;
  const cleanedCount = datasets.filter((d) => d.status === 'cleaned').length;

  const renderActivity = (activity: Activity, showRing = true) => {
    const c = colorMap[activity.type] || colorMap.login;
    const content = (
      <div className={`flex items-start gap-4 p-4 rounded-xl transition-colors ${activity.datasetId ? 'hover:bg-gray-50 cursor-pointer' : ''}`}>
        <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0 ${showRing ? `ring-2 ${c.ring}` : ''} ${c.text}`}>
          {iconMap[activity.type]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{activity.title}</p>
          <p className="text-sm text-gray-500 truncate">{activity.description}</p>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0 mt-1">{formatRelative(activity.timestamp)}</span>
      </div>
    );
    return activity.datasetId ? (
      <Link key={activity.id} to={`/datasets/${activity.datasetId}`}>{content}</Link>
    ) : (
      <div key={activity.id}>{content}</div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">DL</span>
              </div>
              <span className="text-xl font-bold text-gray-900">DataLens</span>
            </Link>
            <button onClick={() => navigate('/dashboard')} className="btn-secondary text-sm">
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Activities</h1>
            <p className="mt-1 text-gray-600">Your recent actions and events</p>
          </div>
          {!loading && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-medium border border-primary-200">
              {activities.length} event{activities.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200 p-6">
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">Loading activities…</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No activities yet</h3>
              <p className="text-gray-500 mb-6">Upload your first dataset to start seeing activity here</p>
              <Link to="/upload" className="btn-primary inline-block">Upload Dataset</Link>
            </div>
          ) : (
            <>
              {todayEvents.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Today</h3>
                  <div className="space-y-1">{todayEvents.map((a) => renderActivity(a, true))}</div>
                </div>
              )}
              {earlierEvents.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Earlier</h3>
                  <div className="space-y-1">{earlierEvents.map((a) => renderActivity(a, false))}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Activity Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-5 border border-blue-100 shadow-sm">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-3">
              {iconMap.upload}
            </div>
            <div className="text-2xl font-bold text-gray-900">{loading ? '—' : uploadCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Uploads</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-white rounded-2xl p-5 border border-green-100 shadow-sm">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center text-green-600 mb-3">
              {iconMap.profile}
            </div>
            <div className="text-2xl font-bold text-gray-900">{loading ? '—' : profiledCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Profiled</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl p-5 border border-purple-100 shadow-sm">
            <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-3">
              {iconMap.clean}
            </div>
            <div className="text-2xl font-bold text-gray-900">{loading ? '—' : cleanedCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Cleaned</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Activities;

