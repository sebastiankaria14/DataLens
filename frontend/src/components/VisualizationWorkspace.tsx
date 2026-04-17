import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { CorrelationData, VisualizationData, VisualizationStats } from '../services/dataset';
import datasetService from '../services/dataset';

// ── Color palette ──────────────────────────────────────────────────────────
const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

function corrColor(v: number): string {
  const c = Math.max(-1, Math.min(1, v));
  if (c >= 0) {
    return `rgb(${Math.round(249 - 29 * c)},${Math.round(250 - 212 * c)},${Math.round(251 - 213 * c)})`;
  }
  const t = -c;
  return `rgb(${Math.round(249 - 219 * t)},${Math.round(250 - 186 * t)},${Math.round(251 - 76 * t)})`;
}

// ── Props ───────────────────────────────────────────────────────────────────
interface VisualizationWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  datasetId: number;
  columnNames: string[];
  selectedColumn: string;
  onColumnChange: (col: string) => void;
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
  datasetId,
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
  // ── local state for multi-col charts ──────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'single' | 'scatter' | 'heatmap'>('single');
  const [scatterCol2, setScatterCol2] = useState<string>('');
  const [scatterData, setScatterData] = useState<Array<{ x: number; y: number }>>([]);
  const [scatterLoading, setScatterLoading] = useState(false);
  const [scatterError, setScatterError] = useState('');
  const [corrData, setCorrData] = useState<CorrelationData | null>(null);
  const [corrLoading, setCorrLoading] = useState(false);
  const [corrError, setCorrError] = useState('');
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const numericCols = columnNames.filter((c) => resolveColumnType(c) === 'numeric');

  // ── load scatter ─────────────────────────────────────────────────────────
  const loadScatter = useCallback(async (col1: string, col2: string) => {
    if (!col1 || !col2 || col1 === col2) return;
    setScatterLoading(true);
    setScatterError('');
    try {
      const res = await datasetService.getScatterData(datasetId, col1, col2, 500);
      setScatterData(res.data);
    } catch (e: any) {
      setScatterError(e?.response?.data?.detail || 'Could not load scatter data.');
    } finally {
      setScatterLoading(false);
    }
  }, [datasetId]);

  // ── load correlation heatmap ──────────────────────────────────────────────
  const loadCorrelation = useCallback(async () => {
    setCorrLoading(true);
    setCorrError('');
    try {
      const res = await datasetService.getCorrelationMatrix(datasetId);
      setCorrData(res);
    } catch (e: any) {
      setCorrError(e?.response?.data?.detail || 'Could not load correlation data.');
    } finally {
      setCorrLoading(false);
    }
  }, [datasetId]);

  // initialise second scatter column
  useEffect(() => {
    if (numericCols.length >= 2 && !scatterCol2) setScatterCol2(numericCols[1]);
  }, [numericCols.length]);

  // auto-load scatter / heatmap when tab becomes active
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'scatter' && selectedColumn && scatterCol2) loadScatter(selectedColumn, scatterCol2);
    if (activeTab === 'heatmap' && !corrData) loadCorrelation();
  }, [activeTab, isOpen]);

  // ── Export PNG ────────────────────────────────────────────────────────────
  const handleExportPng = useCallback(() => {
    if (!chartContainerRef.current) return;
    const svg = chartContainerRef.current.querySelector('svg');
    if (!svg) return;

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const { width, height } = svg.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = `chart_${selectedColumn || 'export'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  }, [selectedColumn]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const formatBinLabel = (item: any) => {
    if (item?.bin_start === undefined || item?.bin_end === undefined) return 'bin';
    const start = Number(item.bin_start);
    const end = Number(item.bin_end);
    if (Number.isNaN(start) || Number.isNaN(end)) return 'bin';
    return `${start.toFixed(2)}–${end.toFixed(2)}`;
  };

  // ── box plot ─────────────────────────────────────────────────────────────
  const renderBoxPlot = () => {
    if (!vizStats || vizStats.min === undefined || vizStats.max === undefined) {
      return <NotAvailable msg="Not enough numeric data to draw a box plot." />;
    }
    const range = vizStats.max - vizStats.min || 1;
    const scale = (v?: number) => v === undefined ? 0 : Math.max(0, Math.min(100, ((v - vizStats.min!) / range) * 100));
    return (
      <div className="px-6 py-8 bg-gray-50 rounded-xl border border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-6">Five-number summary — {selectedColumn}</p>
        <div className="relative h-14 mb-8">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-300" />
          {/* whiskers */}
          <div className="absolute h-6 w-0.5 bg-gray-500" style={{ left: `${scale(vizStats.min)}%`, top: '12px' }} />
          <div className="absolute h-0.5 bg-gray-400" style={{ left: `${scale(vizStats.min)}%`, width: `${scale(vizStats.q25) - scale(vizStats.min)}%`, top: '24px' }} />
          <div className="absolute h-6 w-0.5 bg-gray-500" style={{ left: `${scale(vizStats.max)}%`, top: '12px' }} />
          <div className="absolute h-0.5 bg-gray-400" style={{ left: `${scale(vizStats.q75)}%`, width: `${scale(vizStats.max) - scale(vizStats.q75)}%`, top: '24px' }} />
          {/* IQR box */}
          <div
            className="absolute h-10 bg-blue-100 border-2 border-blue-500 rounded"
            style={{ left: `${scale(vizStats.q25)}%`, width: `${Math.max(2, scale(vizStats.q75) - scale(vizStats.q25))}%`, top: '9px' }}
          />
          {/* median line */}
          <div className="absolute h-12 w-0.5 bg-blue-700" style={{ left: `${scale(vizStats.median)}%`, top: '7px' }} />
        </div>
        <div className="grid grid-cols-5 gap-3 text-xs text-center">
          {[
            { label: 'Min', val: vizStats.min },
            { label: 'Q1', val: vizStats.q25 },
            { label: 'Median', val: vizStats.median },
            { label: 'Q3', val: vizStats.q75 },
            { label: 'Max', val: vizStats.max },
          ].map(({ label, val }) => (
            <div key={label} className="bg-white rounded-lg border border-gray-200 py-2">
              <div className="font-semibold text-gray-500">{label}</div>
              <div className="text-gray-900 font-bold mt-0.5">{val !== undefined ? val.toFixed(2) : '—'}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── "not available" banner ────────────────────────────────────────────────
  const NotAvailable = ({ msg }: { msg: string }) => (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
        <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-sm text-amber-700 font-medium text-center max-w-xs">{msg}</p>
    </div>
  );

  // ── single-column chart renderer ─────────────────────────────────────────
  const renderSingleChart = () => {
    if (vizLoading) return (
      <div className="flex items-center justify-center h-72">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      </div>
    );

    // Friendly "not available" for type mismatches instead of red error
    if (vizError) {
      const isTypeMismatch = vizError.toLowerCase().includes('only available for numeric') ||
                              vizError.toLowerCase().includes('only available for categorical');
      if (isTypeMismatch) {
        const colType = resolveColumnType(selectedColumn);
        return (
          <NotAvailable msg={`This chart type requires a ${colType === 'numeric' ? 'categorical' : 'numeric'} column. "${selectedColumn}" is ${colType}. Please choose a different chart or column.`} />
        );
      }
      return (
        <div className="flex flex-col items-center justify-center h-72 gap-3">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-600 text-sm text-center max-w-sm">{vizError}</p>
        </div>
      );
    }

    if (!vizData) return (
      <div className="flex items-center justify-center h-72">
        <p className="text-gray-400 text-sm">Select a column to begin</p>
      </div>
    );

    // histogram
    if (vizData.chart_type === 'histogram') {
      const histData = (vizData.data || []).map((d) => ({ label: formatBinLabel(d), count: d.count ?? 0 }));
      if (selectedChart === 'line') {
        return (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={histData} margin={{ top: 16, right: 24, bottom: 64, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" interval={Math.max(0, Math.floor(histData.length / 8) - 1)} angle={-25} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        );
      }
      return (
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={histData} margin={{ top: 16, right: 24, bottom: 64, left: 16 }} barCategoryGap={0}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="label" interval={Math.max(0, Math.floor(histData.length / 8) - 1)} angle={-25} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} stroke="#2563eb" strokeWidth={0.5} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // bar / pie
    if (vizData.chart_type === 'bar') {
      const barData = (vizData.data || []).map((d) => ({ category: d.category, count: d.count }));
      if (selectedChart === 'pie') {
        return (
          <ResponsiveContainer width="100%" height={380}>
            <PieChart>
              <Pie data={barData} dataKey="count" nameKey="category" cx="50%" cy="45%" outerRadius={140} label={(props) => `${props.name} (${((props.percent ?? 0) * 100).toFixed(1)}%)`} labelLine>
                {barData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      }
      return (
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={barData} margin={{ top: 16, right: 24, bottom: 80, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="category" interval={0} angle={-30} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {barData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // box
    if (vizData.chart_type === 'box') return renderBoxPlot();

    return null;
  };

  // ── scatter renderer ──────────────────────────────────────────────────────
  const renderScatter = () => {
    const numColsForScatter = numericCols.filter((c) => c !== selectedColumn);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">X Axis (Column 1)</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white"
              value={selectedColumn}
              onChange={(e) => onColumnChange(e.target.value)}
            >
              {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Y Axis (Column 2)</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white"
              value={scatterCol2}
              onChange={(e) => setScatterCol2(e.target.value)}
            >
              {numColsForScatter.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={() => loadScatter(selectedColumn, scatterCol2)}
          disabled={!selectedColumn || !scatterCol2 || selectedColumn === scatterCol2 || scatterLoading}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {scatterLoading ? 'Loading…' : 'Plot Scatter'}
        </button>
        {scatterError && <p className="text-red-500 text-sm">{scatterError}</p>}
        {scatterData.length > 0 && (
          <div ref={chartContainerRef}>
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="x" name={selectedColumn} tick={{ fontSize: 11 }} label={{ value: selectedColumn, position: 'insideBottom', offset: -8, fontSize: 12 }} />
                <YAxis dataKey="y" name={scatterCol2} tick={{ fontSize: 11 }} label={{ value: scatterCol2, angle: -90, position: 'insideLeft', fontSize: 12 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }} formatter={(v, name) => [typeof v === 'number' ? v.toFixed(4) : v, name]} />
                <Scatter data={scatterData} fill="#3b82f6" opacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 text-right mt-1">{scatterData.length.toLocaleString()} points sampled</p>
          </div>
        )}
        {scatterData.length === 0 && !scatterLoading && !scatterError && (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Select two numeric columns and click Plot Scatter</div>
        )}
      </div>
    );
  };

  // ── correlation heatmap renderer ──────────────────────────────────────────
  const renderHeatmap = () => {
    if (corrLoading) return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Computing correlations…</p>
        </div>
      </div>
    );
    if (corrError) return <p className="text-red-500 text-sm p-4">{corrError}</p>;
    if (!corrData || corrData.columns.length === 0) return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <NotAvailable msg="Not enough numeric columns to build a correlation heatmap (need at least 2)." />
        <button onClick={loadCorrelation} className="text-indigo-600 text-sm hover:underline">Retry</button>
      </div>
    );
    const { columns, matrix } = corrData;
    const cellSize = Math.max(40, Math.min(72, Math.floor(560 / columns.length)));
    return (
      <div className="overflow-auto">
        <p className="text-xs text-gray-400 mb-3">Pearson correlation — hover a cell to inspect</p>
        <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${columns.length}, ${cellSize}px)` }} className="text-xs font-medium">
          {/* header row */}
          <div />
          {columns.map((c) => (
            <div key={c} title={c} className="text-center text-gray-500 pb-1 truncate" style={{ width: cellSize, fontSize: 10 }}>{c}</div>
          ))}
          {/* rows */}
          {columns.map((rowCol, i) => (
            <React.Fragment key={rowCol}>
              <div className="text-gray-600 flex items-center pr-2 truncate" style={{ fontSize: 10 }}>{rowCol}</div>
              {columns.map((_, j) => {
                const val = matrix[i]?.[j] ?? 0;
                return (
                  <div
                    key={j}
                    title={`${rowCol} × ${columns[j]}: ${val.toFixed(3)}`}
                    className="flex items-center justify-center rounded font-semibold transition-transform hover:scale-105 cursor-default"
                    style={{ width: cellSize, height: cellSize, background: corrColor(val), fontSize: 10, color: Math.abs(val) > 0.5 ? '#1e3a5f' : '#374151' }}
                  >
                    {val.toFixed(2)}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
          <div className="flex gap-0.5">
            {[-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((v) => (
              <div key={v} className="w-6 h-4 rounded-sm" style={{ background: corrColor(v) }} />
            ))}
          </div>
          <span>-1 (negative)</span>
          <span className="ml-auto">+1 (positive)</span>
        </div>
      </div>
    );
  };

  // ── chart type options ───────────────────────────────────────────────────
  const colType = selectedColumn ? resolveColumnType(selectedColumn) : 'numeric';
  const singleChartOptions = colType === 'numeric'
    ? [{ value: 'histogram', label: 'Histogram' }, { value: 'line', label: 'Line / Density' }, { value: 'box', label: 'Box Plot' }]
    : [{ value: 'bar', label: 'Bar Chart' }, { value: 'pie', label: 'Pie Chart' }];

  // ── stats footer ─────────────────────────────────────────────────────────
  const showStats = vizStats && vizStats.mean !== undefined && activeTab === 'single' && vizData?.chart_type !== 'box';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 top-14 bg-gray-50 rounded-t-3xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-lg">📊</div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">Visualization Workspace</h2>
                  <p className="text-xs text-gray-500">Explore distributions, scatter, and correlations</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPng}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-gray-900 text-xs font-medium rounded-lg transition-colors shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export PNG
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-6 flex gap-1 shrink-0">
              {([
                { key: 'single', label: 'Column Analysis' },
                { key: 'scatter', label: 'Scatter Plot' },
                { key: 'heatmap', label: 'Correlation Heatmap' },
              ] as { key: typeof activeTab; label: string }[]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === t.key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-6xl mx-auto space-y-6">

                {/* ── SINGLE COLUMN ── */}
                {activeTab === 'single' && (
                  <>
                    {/* Controls */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Column</label>
                          <select
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                            value={selectedColumn}
                            onChange={(e) => onColumnChange(e.target.value)}
                          >
                            <option value="" disabled>Select column</option>
                            {columnNames.map((n) => (
                              <option key={n} value={n}>{n}  ({resolveColumnType(n)})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Chart Type</label>
                          <select
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                            value={selectedChart}
                            onChange={(e) => onChartChange(e.target.value)}
                          >
                            {singleChartOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5" ref={chartContainerRef}>
                      {renderSingleChart()}
                    </div>

                    {/* Stats bar */}
                    {showStats && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Mean', val: vizStats!.mean, color: 'blue' },
                          { label: 'Median', val: vizStats!.median, color: 'green' },
                          { label: 'Std Dev', val: vizStats!.std, color: 'amber' },
                          { label: 'Range', val: vizStats!.min !== undefined && vizStats!.max !== undefined ? vizStats!.max! - vizStats!.min! : undefined, color: 'purple' },
                        ].map(({ label, val, color }) => (
                          <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-3`}>
                            <div className={`text-xs font-bold text-${color}-600 uppercase tracking-wide`}>{label}</div>
                            <div className="text-xl font-bold text-gray-900 mt-0.5">{val !== undefined ? val.toFixed(3) : '—'}</div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </>
                )}

                {/* ── SCATTER ── */}
                {activeTab === 'scatter' && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    {numericCols.length < 2
                      ? <NotAvailable msg="You need at least 2 numeric columns to create a scatter plot." />
                      : renderScatter()
                    }
                  </div>
                )}

                {/* ── HEATMAP ── */}
                {activeTab === 'heatmap' && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    {renderHeatmap()}
                  </div>
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

