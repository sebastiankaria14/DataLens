import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { CorrelationData, VisualizationData, VisualizationStats } from '../services/dataset';
import datasetService from '../services/dataset';

const CHART_COLORS = ['#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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
  const [activeTab, setActiveTab] = useState<'single' | 'scatter' | 'heatmap'>('single');
  const [scatterCol2, setScatterCol2] = useState<string>('');
  const [scatterData, setScatterData] = useState<Array<{ x: number; y: number }>>([]);
  const [scatterLoading, setScatterLoading] = useState(false);
  const [scatterError, setScatterError] = useState('');
  const [corrData, setCorrData] = useState<CorrelationData | null>(null);
  const [corrLoading, setCorrLoading] = useState(false);
  const [corrError, setCorrError] = useState('');

  const numericCols = useMemo(
    () => columnNames.filter((c) => resolveColumnType(c) === 'numeric'),
    [columnNames, resolveColumnType],
  );

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

  useEffect(() => {
    if (!selectedColumn || numericCols.length < 2) {
      setScatterCol2('');
      return;
    }

    const fallback = numericCols.find((c) => c !== selectedColumn) || '';
    if (!scatterCol2 || scatterCol2 === selectedColumn || !numericCols.includes(scatterCol2)) {
      setScatterCol2(fallback);
    }
  }, [selectedColumn, scatterCol2, numericCols]);

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'scatter' && selectedColumn && scatterCol2) {
      void loadScatter(selectedColumn, scatterCol2);
    }
    if (activeTab === 'heatmap' && !corrData) {
      void loadCorrelation();
    }
  }, [activeTab, corrData, isOpen, loadCorrelation, loadScatter, scatterCol2, selectedColumn]);

  const handleExportPng = useCallback(() => {
    const chart = document.querySelector('.viz-echart canvas') as HTMLCanvasElement | null;
    if (!chart) return;

    const link = document.createElement('a');
    link.download = `chart_${selectedColumn || 'export'}.png`;
    link.href = chart.toDataURL('image/png');
    link.click();
  }, [selectedColumn]);

  const singleChartOptions = useMemo(() => {
    const colType = selectedColumn ? resolveColumnType(selectedColumn) : 'numeric';
    return colType === 'numeric'
      ? [
          { value: 'histogram', label: 'Histogram' },
          { value: 'line', label: 'Line / Density' },
          { value: 'box', label: 'Box Plot' },
        ]
      : [
          { value: 'bar', label: 'Bar Chart' },
          { value: 'pie', label: 'Pie Chart' },
        ];
  }, [resolveColumnType, selectedColumn]);

  const notAvailable = (msg: string) => (
    <div className="flex flex-col items-center justify-center h-72 gap-3">
      <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold">!</div>
      <p className="text-sm text-amber-700 text-center max-w-md">{msg}</p>
    </div>
  );

  const getSingleChartOption = (): EChartsOption | null => {
    if (!vizData) return null;

    if (vizData.chart_type === 'histogram') {
      const labels = (vizData.data || []).map((d) => `${Number(d.bin_start).toFixed(2)} to ${Number(d.bin_end).toFixed(2)}`);
      const counts = (vizData.data || []).map((d) => d.count ?? 0);

      if (selectedChart === 'line') {
        return {
          color: [CHART_COLORS[0]],
          tooltip: { trigger: 'axis' },
          grid: { left: 40, right: 20, top: 20, bottom: 70 },
          xAxis: { type: 'category', data: labels, axisLabel: { rotate: 30, fontSize: 11 } },
          yAxis: { type: 'value', minInterval: 1 },
          series: [{ type: 'line', smooth: true, data: counts, areaStyle: { opacity: 0.12 } }],
        };
      }

      return {
        color: [CHART_COLORS[0]],
        tooltip: { trigger: 'axis' },
        grid: { left: 40, right: 20, top: 20, bottom: 70 },
        xAxis: { type: 'category', data: labels, axisLabel: { rotate: 30, fontSize: 11 } },
        yAxis: { type: 'value', minInterval: 1 },
        series: [{ type: 'bar', data: counts, barMaxWidth: 26, itemStyle: { borderRadius: [4, 4, 0, 0] } }],
      };
    }

    if (vizData.chart_type === 'bar') {
      const categories = (vizData.data || []).map((d) => String(d.category));
      const counts = (vizData.data || []).map((d) => d.count ?? 0);

      if (selectedChart === 'pie') {
        return {
          color: CHART_COLORS,
          tooltip: { trigger: 'item' },
          legend: { bottom: 0, type: 'scroll' },
          series: [
            {
              type: 'pie',
              radius: ['32%', '68%'],
              center: ['50%', '44%'],
              itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 1 },
              label: { formatter: '{b}: {d}%' },
              data: categories.map((cat, i) => ({ name: cat, value: counts[i] })),
            },
          ],
        };
      }

      return {
        color: [CHART_COLORS[1]],
        tooltip: { trigger: 'axis' },
        grid: { left: 40, right: 20, top: 20, bottom: 90 },
        xAxis: { type: 'category', data: categories, axisLabel: { rotate: 35, fontSize: 11 } },
        yAxis: { type: 'value', minInterval: 1 },
        series: [{ type: 'bar', data: counts, barMaxWidth: 34, itemStyle: { borderRadius: [6, 6, 0, 0] } }],
      };
    }

    if (vizData.chart_type === 'box') {
      if (!vizStats || vizStats.min === undefined || vizStats.q25 === undefined || vizStats.median === undefined || vizStats.q75 === undefined || vizStats.max === undefined) {
        return null;
      }

      return {
        color: [CHART_COLORS[2]],
        tooltip: { trigger: 'item' },
        grid: { left: 50, right: 30, top: 30, bottom: 40 },
        xAxis: { type: 'category', data: [selectedColumn || 'Value'] },
        yAxis: { type: 'value' },
        series: [
          {
            type: 'boxplot',
            data: [[vizStats.min, vizStats.q25, vizStats.median, vizStats.q75, vizStats.max]],
            itemStyle: { borderWidth: 1.4 },
          },
        ],
      };
    }

    return null;
  };

  const scatterOption: EChartsOption = {
    color: [CHART_COLORS[0]],
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const point = params.value as [number, number];
        return `${selectedColumn}: ${Number(point[0]).toFixed(4)}<br/>${scatterCol2}: ${Number(point[1]).toFixed(4)}`;
      },
    },
    grid: { left: 50, right: 20, top: 20, bottom: 50 },
    xAxis: { type: 'value', name: selectedColumn, nameLocation: 'middle', nameGap: 28 },
    yAxis: { type: 'value', name: scatterCol2, nameLocation: 'middle', nameGap: 36 },
    series: [
      {
        type: 'scatter',
        data: scatterData.map((p) => [p.x, p.y]),
        symbolSize: 8,
        itemStyle: { opacity: 0.65 },
      },
    ],
  };

  const heatmapOption: EChartsOption | null = useMemo(() => {
    if (!corrData || corrData.columns.length === 0) return null;

    const cells: Array<[number, number, number]> = [];
    for (let i = 0; i < corrData.columns.length; i += 1) {
      for (let j = 0; j < corrData.columns.length; j += 1) {
        cells.push([j, i, Number((corrData.matrix?.[i]?.[j] ?? 0).toFixed(4))]);
      }
    }

    return {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const [x, y, v] = params.value as [number, number, number];
          return `${corrData.columns[y]} x ${corrData.columns[x]}<br/>Correlation: ${v}`;
        },
      },
      grid: { left: 90, right: 20, top: 40, bottom: 70 },
      xAxis: {
        type: 'category',
        data: corrData.columns,
        axisLabel: { rotate: 35, fontSize: 10 },
        splitArea: { show: true },
      },
      yAxis: {
        type: 'category',
        data: corrData.columns,
        axisLabel: { fontSize: 10 },
        splitArea: { show: true },
      },
      visualMap: {
        min: -1,
        max: 1,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        calculable: true,
        inRange: { color: ['#1d4ed8', '#dbeafe', '#fef3c7', '#b91c1c'] },
      },
      series: [{ type: 'heatmap', data: cells, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 10 } } }],
    };
  }, [corrData]);

  const showStats = vizStats && vizStats.mean !== undefined && activeTab === 'single' && vizData?.chart_type !== 'box';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 top-14 bg-gray-50 rounded-t-3xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Visualization Workspace</h2>
                <p className="text-xs text-gray-500">ECharts rendering for cleaner and more consistent chart UI</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPng}
                  className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                >
                  Export PNG
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <span className="text-gray-600 text-sm">x</span>
                </button>
              </div>
            </div>

            <div className="bg-white border-b border-gray-200 px-6 flex gap-1 shrink-0">
              {[{ key: 'single', label: 'Column Analysis' }, { key: 'scatter', label: 'Scatter Plot' }, { key: 'heatmap', label: 'Correlation Heatmap' }].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as 'single' | 'scatter' | 'heatmap')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-sky-700 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-6xl mx-auto space-y-6">
                {activeTab === 'single' && (
                  <>
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Column</label>
                          <select
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                            value={selectedColumn}
                            onChange={(e) => onColumnChange(e.target.value)}
                          >
                            <option value="" disabled>Select column</option>
                            {columnNames.map((n) => (
                              <option key={n} value={n}>{n} ({resolveColumnType(n)})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Chart Type</label>
                          <select
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                            value={selectedChart}
                            onChange={(e) => onChartChange(e.target.value)}
                          >
                            {singleChartOptions.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 min-h-[430px]">
                      {vizLoading && <div className="h-[380px] flex items-center justify-center text-gray-500">Loading chart...</div>}
                      {!vizLoading && vizError && notAvailable(vizError)}
                      {!vizLoading && !vizError && !vizData && notAvailable('Select a column to begin.')}
                      {!vizLoading && !vizError && vizData && (
                        <ReactECharts className="viz-echart" option={getSingleChartOption() || {}} style={{ height: 390 }} notMerge lazyUpdate />
                      )}
                    </div>

                    {showStats && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                          <div className="text-xs font-bold text-blue-700 uppercase tracking-wide">Mean</div>
                          <div className="text-xl font-bold text-gray-900 mt-0.5">{vizStats?.mean !== undefined ? vizStats.mean.toFixed(3) : '-'}</div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Median</div>
                          <div className="text-xl font-bold text-gray-900 mt-0.5">{vizStats?.median !== undefined ? vizStats.median.toFixed(3) : '-'}</div>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                          <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">Std Dev</div>
                          <div className="text-xl font-bold text-gray-900 mt-0.5">{vizStats?.std !== undefined ? vizStats.std.toFixed(3) : '-'}</div>
                        </div>
                        <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-3">
                          <div className="text-xs font-bold text-cyan-700 uppercase tracking-wide">Range</div>
                          <div className="text-xl font-bold text-gray-900 mt-0.5">{vizStats?.min !== undefined && vizStats?.max !== undefined ? (vizStats.max - vizStats.min).toFixed(3) : '-'}</div>
                        </div>
                      </motion.div>
                    )}
                  </>
                )}

                {activeTab === 'scatter' && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 min-h-[430px]">
                    {numericCols.length < 2 ? (
                      notAvailable('You need at least 2 numeric columns to create a scatter plot.')
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">X Axis (Column 1)</label>
                            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" value={selectedColumn} onChange={(e) => onColumnChange(e.target.value)}>
                              {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Y Axis (Column 2)</label>
                            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" value={scatterCol2} onChange={(e) => setScatterCol2(e.target.value)}>
                              {numericCols.filter((c) => c !== selectedColumn).map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                        <button
                          onClick={() => void loadScatter(selectedColumn, scatterCol2)}
                          disabled={!selectedColumn || !scatterCol2 || selectedColumn === scatterCol2 || scatterLoading}
                          className="px-5 py-2 bg-sky-700 hover:bg-sky-800 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {scatterLoading ? 'Loading...' : 'Plot Scatter'}
                        </button>
                        {scatterError && <p className="text-red-500 text-sm">{scatterError}</p>}
                        {!scatterError && scatterData.length > 0 && (
                          <>
                            <ReactECharts className="viz-echart" option={scatterOption} style={{ height: 380 }} notMerge lazyUpdate />
                            <p className="text-xs text-gray-400 text-right">{scatterData.length.toLocaleString()} points sampled</p>
                          </>
                        )}
                        {!scatterError && !scatterLoading && scatterData.length === 0 && (
                          <div className="h-[320px] flex items-center justify-center text-gray-400 text-sm">Select two numeric columns and click Plot Scatter</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'heatmap' && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 min-h-[430px]">
                    {corrLoading && <div className="h-[380px] flex items-center justify-center text-gray-500">Computing correlations...</div>}
                    {!corrLoading && corrError && <p className="text-red-500 text-sm">{corrError}</p>}
                    {!corrLoading && !corrError && !heatmapOption && notAvailable('Not enough numeric columns to build a correlation heatmap (need at least 2).')}
                    {!corrLoading && !corrError && heatmapOption && (
                      <ReactECharts className="viz-echart" option={heatmapOption} style={{ height: 420 }} notMerge lazyUpdate />
                    )}
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
