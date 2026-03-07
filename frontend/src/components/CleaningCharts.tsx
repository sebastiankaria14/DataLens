import React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';
import type { DatasetProfile } from '../services/dataset';

interface CleaningChartsProps {
  profile: DatasetProfile;
}

const COLORS = {
  before: '#94a3b8',
  after: '#10b981',
  removed: '#f59e0b',
};

const CleaningCharts: React.FC<CleaningChartsProps> = ({ profile }) => {
  const stats = profile.cleaning_stats;
  if (!stats) return null;

  // ---- Missing values before vs after ----
  const missingBefore = profile.missing_values ?? {};
  const missingAfter = stats.null_counts_after ?? {};
  const missingCols = Object.keys(missingBefore).filter((c) => (missingBefore[c] ?? 0) > 0 || (missingAfter[c] ?? 0) > 0);
  const missingData = missingCols.slice(0, 15).map((col) => ({
    col: col.length > 14 ? col.slice(0, 12) + '…' : col,
    before: missingBefore[col] ?? 0,
    after: missingAfter[col] ?? 0,
  }));

  // ---- Row counts ----
  const rowData = [
    { label: 'Before', rows: stats.initial_rows },
    { label: 'After', rows: stats.final_rows },
  ];

  // ---- Operations summary ----
  const opsData = (stats.operations_performed ?? []).map((op) => ({
    name: (op.operation as string).replace(/_/g, ' ').slice(0, 20),
    rows_removed: op.rows_removed ?? op.rows_dropped ?? 0,
  })).filter((op) => op.rows_removed > 0);

  // ---- Outlier detection ----
  const outlierRaw = stats.outlier_detection ?? {};
  const outlierData = Object.entries(outlierRaw)
    .map(([col, info]: [string, any]) => ({
      col: col.length > 14 ? col.slice(0, 12) + '…' : col,
      outliers: info.outlier_count ?? 0,
    }))
    .filter((d) => d.outliers > 0)
    .slice(0, 15);

  const hasCharts = missingData.length > 0 || opsData.length > 0 || outlierData.length > 0;
  if (!hasCharts) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-white rounded-2xl shadow-lg p-8 space-y-10"
    >
      <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
        <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Cleaning Results — Visual Summary
      </h2>

      {/* Row count before/after */}
      <ChartSection title="Rows Before vs After Cleaning">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={rowData} barSize={60}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 13 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: any) => v.toLocaleString()} />
            <Bar dataKey="rows" name="Rows" radius={[6, 6, 0, 0]}>
              {rowData.map((_, i) => (
                <Cell key={i} fill={i === 0 ? COLORS.before : COLORS.after} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Missing values comparison */}
      {missingData.length > 0 && (
        <ChartSection title="Missing Values — Before vs After">
          <ResponsiveContainer width="100%" height={Math.max(220, missingData.length * 30)}>
            <BarChart data={missingData} layout="vertical" barSize={14} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="col" type="category" tick={{ fontSize: 11 }} width={110} />
              <Tooltip />
              <Legend />
              <Bar dataKey="before" name="Before" fill={COLORS.before} radius={[0, 4, 4, 0]} />
              <Bar dataKey="after" name="After" fill={COLORS.after} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      )}

      {/* Outliers per column */}
      {outlierData.length > 0 && (
        <ChartSection title="Outliers Detected per Column (IQR)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={outlierData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="col" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => `${v} outliers`} />
              <Bar dataKey="outliers" name="Outliers" fill="#f97316" radius={[6, 6, 0, 0]}>
                {outlierData.map((_, i) => (
                  <Cell key={i} fill={`hsl(${20 + i * 8}, 85%, 60%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      )}

      {/* Rows removed per operation */}
      {opsData.length > 0 && (
        <ChartSection title="Rows Removed per Operation">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={opsData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => `${v} rows`} />
              <Bar dataKey="rows_removed" name="Rows Removed" fill={COLORS.removed} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      )}
    </motion.div>
  );
};

const ChartSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">{title}</h3>
    {children}
  </div>
);

export default CleaningCharts;
