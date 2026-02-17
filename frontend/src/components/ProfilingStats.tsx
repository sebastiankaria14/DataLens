import React from 'react';
import { motion } from 'framer-motion';
import type { DatasetProfile } from '../services/dataset';

interface ProfilingStatsProps {
  profile: DatasetProfile | null;
}

const ProfilingStats: React.FC<ProfilingStatsProps> = ({ profile }) => {
  if (!profile) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-gray-900">📈 Profiling Statistics</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.65, duration: 0.3 }}
          className="p-5 bg-gradient-to-br from-green-50 to-white rounded-xl shadow-sm border border-green-100 hover:shadow-md transition-shadow"
        >
          <div className="text-xs font-semibold text-green-700 uppercase tracking-wide">Quality Score</div>
          <div className="text-3xl font-bold text-green-900 mt-2">{profile.quality_score ?? '—'}</div>
          <div className="text-xs text-green-600 mt-1">Out of 100</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.3 }}
          className="p-5 bg-gradient-to-br from-blue-50 to-white rounded-xl shadow-sm border border-blue-100 hover:shadow-md transition-shadow"
        >
          <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Duplicates</div>
          <div className="text-3xl font-bold text-blue-900 mt-2">{profile.duplicates?.toLocaleString()}</div>
          <div className="text-xs text-blue-600 mt-1">Duplicate rows</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.75, duration: 0.3 }}
          className="p-5 bg-gradient-to-br from-purple-50 to-white rounded-xl shadow-sm border border-purple-100 hover:shadow-md transition-shadow"
        >
          <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Memory Usage</div>
          <div className="text-3xl font-bold text-purple-900 mt-2">{profile.memory_usage}</div>
          <div className="text-xs text-purple-600 mt-1">Estimated size</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.3 }}
          className="p-5 bg-gradient-to-br from-yellow-50 to-white rounded-xl shadow-sm border border-yellow-100 hover:shadow-md transition-shadow"
        >
          <div className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Columns</div>
          <div className="text-3xl font-bold text-yellow-900 mt-2">{profile.column_count}</div>
          <div className="text-xs text-yellow-600 mt-1">Total features</div>
        </motion.div>
      </div>

      {Array.isArray((profile as any).imbalance_warnings) && (profile as any).imbalance_warnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          className="bg-gradient-to-br from-yellow-50 to-white border border-yellow-200 rounded-xl p-5 shadow-sm"
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Imbalance Warnings</h3>
              <ul className="list-disc ml-5 text-sm text-yellow-800 space-y-1">
                {(profile as any).imbalance_warnings.map((w: any, idx: number) => (
                  <li key={idx}>{w?.message || `${w?.column}: ${w?.severity}`}</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ProfilingStats;
