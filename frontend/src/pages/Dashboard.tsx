import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import datasetService from '../services/dataset';
import type { Dataset } from '../services/dataset';

const Dashboard: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    setShowProfileMenu(false);
    logout();
    navigate('/login');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load datasets from API
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await datasetService.getDatasets();
        if (!cancelled) setDatasets(data);
      } catch (_) {
        // silently ignore; user sees empty state
      } finally {
        if (!cancelled) setDatasetsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Computed stats
  const totalRows = datasets.reduce((acc, d) => acc + (d.row_count ?? 0), 0);
  const cleanedCount = datasets.filter((d) => d.status === 'cleaned').length;
  const totalStorageMB = datasets.reduce((acc, d) => acc + (d.file_size ?? 0), 0) / (1024 * 1024);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">DF</span>
                </div>
                <span className="text-xl font-bold text-slate-900">DataForge</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/upload" className="btn-primary">
                Upload Dataset
              </Link>
              
              {/* Profile Dropdown */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-2 hover:bg-slate-100 rounded-lg p-2 transition-colors"
                >
                  <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">{user?.full_name?.charAt(0)?.toUpperCase() || 'U'}</span>
                  </div>
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-900">{user?.full_name || 'User Account'}</p>
                      <p className="text-xs text-slate-400">{user?.email || 'user@example.com'}</p>
                    </div>
                    
                    <Link
                      to="/profile"
                      className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <svg className="w-4 h-4 mr-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile
                    </Link>
                    
                    <Link
                      to="/activities"
                      className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <svg className="w-4 h-4 mr-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Activities
                    </Link>
                    
                    <Link
                      to="/notifications"
                      className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <svg className="w-4 h-4 mr-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      Notifications
                      <span className="ml-auto bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">3</span>
                    </Link>
                    
                    <Link
                      to="/settings"
                      className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <svg className="w-4 h-4 mr-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
                    </Link>
                    
                    <div className="border-t border-slate-100 mt-2 pt-2">
                      <button
                        onClick={handleSignOut}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Welcome back, {user?.full_name?.split(' ')[0] || 'there'}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Here's an overview of your datasets
              </p>
            </div>
            <div className="hidden md:block">
              <div className="text-right">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Today</div>
                <div className="text-sm font-semibold text-slate-700">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link to="/upload" className="card hover:border-indigo-200 transition-colors group">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Upload Dataset</h3>
                <p className="text-sm text-slate-500">CSV, Excel, or JSON files</p>
              </div>
            </div>
          </Link>

          <div className="card">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Profile Data</h3>
                <p className="text-sm text-slate-500">Auto-analyze statistics</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Clean & Filter</h3>
                <p className="text-sm text-slate-500">Remove outliers, duplicates</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="stat-label">Total Datasets</div>
            <div className="stat-value">
              {datasetsLoading ? '—' : datasets.length}
            </div>
            <div className="stat-sub">
              {datasets.length === 0 ? 'Upload your first dataset' : 'Across all projects'}
            </div>
          </div>
          
          <div className="card">
            <div className="stat-label">Total Rows</div>
            <div className="stat-value">
              {datasetsLoading ? '—' : totalRows.toLocaleString()}
            </div>
            <div className="stat-sub">Across all datasets</div>
          </div>
          
          <div className="card">
            <div className="stat-label">Cleaned</div>
            <div className="stat-value">
              {datasetsLoading ? '—' : cleanedCount}
            </div>
            <div className="stat-sub">Ready for ML</div>
          </div>
          
          <div className="card">
            <div className="stat-label">Storage Used</div>
            <div className="stat-value">
              {datasetsLoading ? '—' : `${totalStorageMB.toFixed(1)} MB`}
            </div>
            <div className="stat-sub">Uploaded files</div>
          </div>
        </div>

        {/* Recent Datasets or Empty State */}
        {datasetsLoading ? (
          <div className="card text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Loading datasets…</p>
          </div>
        ) : datasets.length === 0 ? (
          <div className="card text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No datasets yet</h3>
            <p className="text-slate-500 text-sm mb-6">
              Upload your first dataset to get started with data preparation
            </p>
            <Link to="/upload" className="btn-primary inline-block">
              Upload Dataset
            </Link>
          </div>
        ) : (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Your Datasets</h2>
              <Link to="/upload" className="btn-primary text-sm">+ New Dataset</Link>
            </div>
            <div className="space-y-3">
              {datasets.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((ds) => {
                const statusColor: Record<string, string> = {
                  uploaded: 'badge badge-blue',
                  profiling: 'badge badge-yellow',
                  profiled: 'badge badge-green',
                  cleaning: 'badge badge-yellow',
                  cleaned: 'badge badge-green',
                  failed: 'badge badge-red',
                };
                return (
                  <Link
                    key={ds.id}
                    to={`/datasets/${ds.id}`}
                    className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                        <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">{ds.name || ds.original_filename}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {ds.row_count ? `${ds.row_count.toLocaleString()} rows` : 'Profiling…'}
                          {ds.column_count ? ` · ${ds.column_count} cols` : ''}
                          {' · '}
                          {datasetService.formatFileSize(ds.file_size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
                      <span className={statusColor[ds.status] ?? 'badge badge-gray'}>
                        {ds.status}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(ds.created_at).toLocaleDateString()}
                      </span>
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Getting Started Guide */}
        <div className="mt-8 card">
          <h2 className="text-base font-semibold text-slate-900 mb-6">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-3">
                1
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">Upload</h3>
              <p className="text-xs text-slate-500">
                Upload CSV, Excel, or JSON files. Large files handled efficiently with DuckDB.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-3">
                2
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">Profile</h3>
              <p className="text-xs text-slate-500">
                Automatic profiling detects schema, missing values, and distributions.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-3">
                3
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">Clean</h3>
              <p className="text-xs text-slate-500">
                Apply filters, remove duplicates, handle outliers, and balance classes.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-3">
                4
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">Export</h3>
              <p className="text-xs text-slate-500">
                Download ML-ready datasets in Parquet or CSV format.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
