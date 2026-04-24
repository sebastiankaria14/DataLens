import React from 'react';
import { motion } from 'framer-motion';
import type { DatasetProfile } from '../services/dataset';

interface ColumnsTableProps {
  profile: DatasetProfile | null;
}

const ColumnsTable: React.FC<ColumnsTableProps> = ({ profile }) => {
  if (!profile || !profile.columns) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.9 }}
      className="bg-white rounded-xl border border-slate-200 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-900">Column Details</h3>
        <p className="text-xs text-slate-500 mt-0.5">Schema, types, and null distribution</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Column</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Missing</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Unique</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Object.entries(profile.columns || {}).map(([name, info], idx) => (
              <motion.tr
                key={name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.95 + idx * 0.05 }}
                className="hover:bg-slate-50 transition-colors"
              >
                <td className="px-6 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 bg-sky-500 rounded-full flex-shrink-0"/>
                    <span className="text-sm font-medium text-slate-900">{name}</span>
                  </div>
                </td>
                <td className="px-6 py-3.5 whitespace-nowrap">
                  <span className="badge badge-cyan font-mono text-[11px]">
                    {info?.dtype ?? profile.data_types?.[name] ?? '—'}
                  </span>
                </td>
                <td className="px-6 py-3.5 whitespace-nowrap text-sm text-slate-600 tabular-nums">
                  {info?.null_count ?? profile.missing_values?.[name] ?? 0}
                  {typeof info?.null_percentage === 'number' && (
                    <span className="text-slate-400 ml-1 text-xs">({info.null_percentage}%)</span>
                  )}
                </td>
                <td className="px-6 py-3.5 whitespace-nowrap text-sm text-slate-600 tabular-nums">
                  {info?.unique_count?.toLocaleString() ?? '—'}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default ColumnsTable;
