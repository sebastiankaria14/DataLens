import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Dataset } from '../services/dataset';

interface DatasetHeaderProps {
  dataset: Dataset | null;
  isLoading: boolean;
}

function statusBadgeClasses(status: Dataset['status']): string {
  switch (status) {
    case 'uploaded':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'profiling':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'profiled':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'cleaning':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'cleaned':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

const DatasetHeader: React.FC<DatasetHeaderProps> = ({ dataset, isLoading }) => {
  const navigate = useNavigate();

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button onClick={() => navigate('/dashboard')} className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center shadow-md">
                  <span className="text-white font-bold text-lg">DF</span>
                </div>
                <span className="text-xl font-bold text-gray-900">DataForge</span>
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <Link to="/upload" className="btn-secondary">
                Upload Another
              </Link>
              <Link to="/dashboard" className="btn-primary">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="bg-gradient-to-br from-gray-50 to-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {dataset?.name || (isLoading ? 'Loading…' : 'Dataset')}
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">{dataset?.original_filename || '—'}</span>
                </p>
              </div>
              <div
                className={`inline-flex items-center px-4 py-2 rounded-full border text-sm font-medium shadow-sm ${
                  dataset ? statusBadgeClasses(dataset.status) : 'bg-gray-100 text-gray-800 border-gray-200'
                }`}
              >
                {dataset?.status || 'loading'}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-300"
              >
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rows</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{dataset?.row_count?.toLocaleString() ?? '—'}</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-300"
              >
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Columns</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{dataset?.column_count ?? '—'}</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-300"
              >
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">
                  {dataset?.created_at ? new Date(dataset.created_at).toLocaleDateString() : '—'}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25, duration: 0.3 }}
                className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-300"
              >
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Profiled</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">
                  {dataset?.profiled_at ? new Date(dataset.profiled_at).toLocaleDateString() : '—'}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default DatasetHeader;
