import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Activity {
  id: number;
  type: 'upload' | 'profile' | 'clean' | 'download' | 'login';
  title: string;
  description: string;
  time: string;
  icon: React.ReactNode;
  color: string;
}

const iconMap = {
  upload: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
  ),
  profile: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  ),
  clean: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
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

const Activities: React.FC = () => {
  const navigate = useNavigate();

  // Placeholder activities – in production these would come from an API
  const activities: Activity[] = [
    {
      id: 1,
      type: 'login',
      title: 'Signed in',
      description: 'You signed into your account',
      time: 'Just now',
      icon: iconMap.login,
      color: 'login',
    },
  ];

  const today = activities;
  const earlier: Activity[] = [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">DF</span>
              </div>
              <span className="text-xl font-bold text-gray-900">DataForge</span>
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
          <div className="hidden md:flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-medium border border-primary-200">
              {activities.length} event{activities.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200 p-6">
          {activities.length === 0 ? (
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
              {/* Today */}
              {today.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Today</h3>
                  <div className="space-y-1">
                    {today.map((activity) => {
                      const c = colorMap[activity.color] || colorMap.login;
                      return (
                        <div key={activity.id} className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors group">
                          <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0 ring-2 ${c.ring} ${c.text}`}>
                            {activity.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{activity.title}</p>
                            <p className="text-sm text-gray-500">{activity.description}</p>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0 mt-1">{activity.time}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Earlier */}
              {earlier.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Earlier</h3>
                  <div className="space-y-1">
                    {earlier.map((activity) => {
                      const c = colorMap[activity.color] || colorMap.login;
                      return (
                        <div key={activity.id} className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors">
                          <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0 ${c.text}`}>
                            {activity.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{activity.title}</p>
                            <p className="text-sm text-gray-500">{activity.description}</p>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0 mt-1">{activity.time}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Activity Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Uploads', value: '0', icon: iconMap.upload, color: 'blue' },
            { label: 'Profiled', value: '0', icon: iconMap.profile, color: 'green' },
            { label: 'Cleaned', value: '0', icon: iconMap.clean, color: 'purple' },
            { label: 'Downloads', value: '0', icon: iconMap.download, color: 'yellow' },
          ].map((s) => (
            <div key={s.label} className={`bg-gradient-to-br from-${s.color}-50 to-white rounded-2xl p-5 border border-${s.color}-100 shadow-sm`}>
              <div className={`w-9 h-9 bg-${s.color}-100 rounded-xl flex items-center justify-center text-${s.color}-600 mb-3`}>
                {s.icon}
              </div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Activities;
