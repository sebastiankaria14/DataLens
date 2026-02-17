import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/auth';

const Profile: React.FC = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync formData when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setError('');
    setLoading(true);
    
    try {
      const updatedUser = await authService.updateProfile({
        full_name: formData.full_name,
      });
      
      setUser(updatedUser);
      setIsEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const initials = user?.full_name
    ?.split(' ')
    .map((n) => n.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'U';

  const memberSince = 'February 2026';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navbar */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">DF</span>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">DataForge</span>
            </Link>
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/dashboard')} className="btn-secondary text-sm">
                ← Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Manage your account information</p>
        </div>

        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl shadow-sm flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Profile updated successfully!
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl shadow-sm flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            {error}
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Cover / Banner */}
          <div className="h-32 bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-500 relative">
            <div className="absolute inset-0 opacity-20">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                    <circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.5)" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dots)" />
              </svg>
            </div>
          </div>

          <div className="px-8 pb-8">
            {/* Avatar */}
            <div className="-mt-16 mb-6 flex items-end justify-between">
              <div className="w-28 h-28 bg-primary-600 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center">
                <span className="text-white font-bold text-4xl">{initials}</span>
              </div>
              <button
                onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
                disabled={loading}
                className={`${isEditing ? 'btn-primary' : 'btn-secondary'} text-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Saving...' : isEditing ? '✓ Save Changes' : '✎ Edit Profile'}
              </button>
            </div>

            {/* Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Full Name</label>
                {isEditing ? (
                  <input
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className="input-field"
                  />
                ) : (
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{user?.full_name || '—'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Email Address</label>
                <p className="text-lg text-gray-900 dark:text-white">{user?.email || '—'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Member Since</label>
                <p className="text-lg text-gray-900 dark:text-white">{memberSince}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Account Status</label>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 text-sm font-medium">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 rounded-2xl p-6 border border-blue-100 dark:border-blue-800 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
              </div>
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Datasets</div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">0</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total uploaded</div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-800 rounded-2xl p-6 border border-green-100 dark:border-green-800 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Cleaned</div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">0</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Datasets cleaned</div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 rounded-2xl p-6 border border-purple-100 dark:border-purple-800 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Days Active</div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">1</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Since signup</div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-red-200 dark:border-red-800 p-6">
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">Danger Zone</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Permanently delete your account and all associated datasets. This action cannot be undone.
          </p>
          <button className="px-4 py-2 bg-red-50 text-red-700 border border-red-300 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
