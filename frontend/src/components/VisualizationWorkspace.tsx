import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { VisualizationData, VisualizationStats } from '../services/dataset';

interface VisualizationWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  columnNames: string[];
  selectedColumn: string;
  onColumnChange: (column: string) => void;
  selectedChart: string;
  onChartChange: (chart: string) => void;
  vizData: VisualizationData | null;
  vizStats: VisualizationStats | undefined;
  vizLoading: boolean;
  vizError: string;
  resolveColumnType: (col: string) => 'numeric' | 'categorical';
}

const VisualizationWorkspace: React.FC<VisualizationWorkspaceProps> = ({
  isOpen,
  onClose,
  columnNames,
  selectedColumn,
  onColumnChange,
  selectedChart,
  onChartChange,
  vizData,
  vizStats,
  vizLoading,
  vizError,
  resolveColumnType,
}) => {
  const formatBinLabel = (item: any) => {
    if (item?.bin_start === undefined || item?.bin_end === undefined) return 'bin';
    const start = Number(item.bin_start);
    const end = Number(item.bin_end);
    if (Number.isNaN(start) || Number.isNaN(end)) return 'bin';
    return `${start.toFixed(2)} – ${end.toFixed(2)}`;
  };

  const renderBoxPlot = () => {
    if (!vizStats || vizStats.min === undefined || vizStats.max === undefined) {
      return <div className="text-sm text-gray-600">Not enough numeric data to draw a box plot.</div>;
    }

    const range = vizStats.max - vizStats.min || 1;
    const scale = (value?: number) => {
      if (value === undefined) return 0;
      return Math.max(0, Math.min(100, ((value - vizStats.min!) / range) * 100));
    };

    return (
      <div className="px-6 py-8 bg-gray-50 rounded-xl border border-gray-200">
        <div className="text-sm font-semibold text-gray-700 mb-4">Five-number summary</div>
        <div className="relative h-12 mb-6">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-300" />
          <div
            className="absolute h-8 bg-blue-100 border-2 border-blue-500 rounded"
            style={{ left: `${scale(vizStats.q25)}%`, width: `${Math.max(2, scale(vizStats.q75) - scale(vizStats.q25))}%`, top: '8px' }}
          />
          <div className="absolute h-10 w-0.5 bg-blue-700" style={{ left: `${scale(vizStats.median)}%`, top: '7px' }} />
          <div className="absolute h-6 w-0.5 bg-gray-700" style={{ left: `${scale(vizStats.min)}%`, top: '9px' }} />
          <div className="absolute h-6 w-0.5 bg-gray-700" style={{ left: `${scale(vizStats.max)}%`, top: '9px' }} />
        </div>
        <div className="grid grid-cols-5 gap-3 text-xs">
          <div className="text-center">
            <div className="font-semibold text-gray-600">Min</div>
            <div className="text-gray-900 mt-1">{vizStats.min.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-600">Q1</div>
            <div className="text-gray-900 mt-1">{vizStats.q25?.toFixed(2) ?? '—'}</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-600">Median</div>
            <div className="text-gray-900 mt-1">{vizStats.median?.toFixed(2) ?? '—'}</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-600">Q3</div>
            <div className="text-gray-900 mt-1">{vizStats.q75?.toFixed(2) ?? '—'}</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-600">Max</div>
            <div className="text-gray-900 mt-1">{vizStats.max.toFixed(2)}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderVisualization = () => {
    if (vizLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading visualization…</p>
          </div>
        </div>
      );
    }

    if (vizError) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-700">{vizError}</p>
          </div>
        </div>
      );
    }

    if (!vizData) {
      return (
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Select a column to visualize</p>
        </div>
      );
    }

    if (vizData.chart_type === 'histogram') {
      const histData = (vizData.data || []).map((d, idx) => ({ label: formatBinLabel(d), count: d.count ?? 0, idx }));
      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={histData} margin={{ top: 20, right: 30, bottom: 60, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" interval={Math.max(0, Math.floor(histData.length / 8) - 1)} angle={-25} textAnchor="end" height={80} tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (vizData.chart_type === 'bar') {
      const barData = (vizData.data || []).map((d) => ({ category: d.category, count: d.count }));
      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={barData} margin={{ top: 20, right: 30, bottom: 80, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="category" interval={0} angle={-30} textAnchor="end" height={100} tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
            <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (vizData.chart_type === 'box') {
      return renderBoxPlot();
    }

    return <div className="text-center text-gray-500 h-96 flex items-center justify-center">Select a chart type</div>;
  };

  const columnType = selectedColumn ? resolveColumnType(selectedColumn) : 'numeric';
  const availableCharts = columnType === 'numeric'
    ? [
        { value: 'histogram', label: 'Histogram' },
        { value: 'box', label: 'Box Plot' },
      ]
    : [{ value: 'bar', label: 'Bar Chart' }];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 top-20 bg-white rounded-t-3xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">📊 Visualization Workspace</h2>
                <p className="text-sm text-gray-600 mt-1">Explore column distributions and patterns</p>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Column
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      value={selectedColumn}
                      onChange={(e) => onColumnChange(e.target.value)}
                    >
                      <option value="" disabled>
                        Select column
                      </option>
                      {columnNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Chart Type
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      value={selectedChart}
                      onChange={(e) => onChartChange(e.target.value)}
                    >
                      {availableCharts.map((chart) => (
                        <option key={chart.value} value={chart.value}>
                          {chart.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Actions
                    </label>
                    <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2.5 rounded-lg text-sm transition-colors">
                      Export PNG
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  {renderVisualization()}
                </div>

                {vizStats && vizData?.chart_type !== 'box' && vizStats.mean !== undefined && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4"
                  >
                    <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-4 border border-blue-100">
                      <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Mean</div>
                      <div className="text-2xl font-bold text-gray-900 mt-1">{vizStats.mean.toFixed(2)}</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-white rounded-xl p-4 border border-green-100">
                      <div className="text-xs font-semibold text-green-600 uppercase tracking-wide">Median</div>
                      <div className="text-2xl font-bold text-gray-900 mt-1">{vizStats.median?.toFixed(2) ?? '—'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-50 to-white rounded-xl p-4 border border-yellow-100">
                      <div className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">Std Dev</div>
                      <div className="text-2xl font-bold text-gray-900 mt-1">{vizStats.std?.toFixed(2) ?? '—'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl p-4 border border-purple-100">
                      <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Range</div>
                      <div className="text-2xl font-bold text-gray-900 mt-1">
                        {vizStats.min !== undefined && vizStats.max !== undefined
                          ? (vizStats.max - vizStats.min).toFixed(2)
                          : '—'}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default VisualizationWorkspace;
