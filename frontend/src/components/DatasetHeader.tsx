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
      return 'badge badge-gray';
    case 'profiling':
      return 'badge badge-blue';
    case 'profiled':
      return 'badge badge-green';
    case 'cleaning':
      return 'badge badge-yellow';
    case 'cleaned':
      return 'badge badge-green';
    case 'failed':
      return 'badge badge-red';
    default:
      return 'badge badge-gray';
  }
}

const DatasetHeader: React.FC<DatasetHeaderProps> = ({ dataset, isLoading }) => {
  const navigate = useNavigate();

  return (
    <>
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button onClick={() => navigate('/dashboard')} className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">DL</span>
                </div>
                <span className="text-xl font-bold text-slate-900">DataLens</span>
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

      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {dataset?.name || (isLoading ? 'Loading…' : 'Dataset')}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {dataset?.original_filename || '—'}
                </p>
              </div>
              <div className={dataset ? statusBadgeClasses(dataset.status) : 'badge badge-gray'}>
                {dataset?.status || 'loading'}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="p-4 bg-white rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors"
              >
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Rows</div>
                <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{dataset?.row_count?.toLocaleString() ?? '—'}</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="p-4 bg-white rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors"
              >
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Columns</div>
                <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{dataset?.column_count ?? '—'}</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="p-4 bg-white rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors"
              >
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Created</div>
                <div className="text-sm font-semibold text-slate-900 mt-1">
                  {dataset?.created_at ? new Date(dataset.created_at).toLocaleDateString() : '—'}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25, duration: 0.3 }}
                className="p-4 bg-white rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors"
              >
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Profiled</div>
                <div className="text-sm font-semibold text-slate-900 mt-1">
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
