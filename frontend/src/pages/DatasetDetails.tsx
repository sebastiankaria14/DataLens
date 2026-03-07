import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import datasetService from '../services/dataset';
import type {
  Dataset,
  DatasetInsight,
  DatasetProfile,
  VisualizationData,
  VisualizationStats,
} from '../services/dataset';
import DatasetHeader from '../components/DatasetHeader';
import DatasetOverview from '../components/DatasetOverview';
import ActionButtons from '../components/ActionButtons';
import VisualizationWorkspace from '../components/VisualizationWorkspace';
import ChatWorkspace from '../components/ChatWorkspace';
import ProfilingStats from '../components/ProfilingStats';
import ColumnsTable from '../components/ColumnsTable';
import CleaningPanel from '../components/CleaningPanel';
import MLPanel from '../components/MLPanel';
import CleaningCharts from '../components/CleaningCharts';

const POLL_MS = 2000;
type ChatMessage = { role: 'assistant' | 'user'; text: string };
type Section = 'profile' | 'clean' | 'ml';

const DatasetDetails: React.FC = () => {
  const { datasetId } = useParams();

  const id = useMemo(() => {
    const parsed = Number(datasetId);
    return Number.isFinite(parsed) ? parsed : NaN;
  }, [datasetId]);

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [insight, setInsight] = useState<DatasetInsight | null>(null);
  const [error, setError] = useState<string>('');
  const [insightError, setInsightError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>('profile');
  
  // Workspace states
  const [isVizOpen, setIsVizOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Visualization states
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedChart, setSelectedChart] = useState<'histogram' | 'bar' | 'box'>('histogram');
  const [vizData, setVizData] = useState<VisualizationData | null>(null);
  const [vizStats, setVizStats] = useState<VisualizationStats | undefined>(undefined);
  const [vizError, setVizError] = useState<string>('');
  const [vizLoading, setVizLoading] = useState<boolean>(false);
  
  // AI chat states
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Hello! I\'m your dataset assistant. Ask me anything about your data.' },
  ]);
  const [aiInput, setAiInput] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setError('Invalid dataset id.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const stopPolling = () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const fetchOnce = async () => {
      try {
        const ds = await datasetService.getDataset(id);
        if (cancelled) return;
        setDataset(ds);
        setError('');

        const done = ds.status === 'profiled' || ds.status === 'cleaned';

        if (done) {
          try {
            const p = await datasetService.getDatasetProfile(id);
            if (cancelled) return;
            setProfile(p);
            stopPolling();
          } catch (profileErr: any) {
            console.error('Failed to load profile:', profileErr);
            const errMsg = profileErr?.response?.data?.detail || 'Failed to load dataset profile';
            setError(`Profile Error: ${errMsg}.`);
            stopPolling();
          }
        } else if (ds.status === 'failed') {
          stopPolling();
          setError('Profiling failed for this dataset.');
        }
        // Keep polling while 'uploaded', 'profiling', or 'cleaning'
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.response?.data?.detail || 'Failed to load dataset.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchOnce();
    pollTimerRef.current = window.setInterval(fetchOnce, POLL_MS);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [id]); // Remove profile from dependencies to prevent re-polling

  const columnNames = useMemo(() => Object.keys(profile?.columns || {}), [profile]);

  const resolveColumnType = (col: string): 'numeric' | 'categorical' => {
    const dtype = (profile?.columns as any)?.[col]?.dtype || profile?.data_types?.[col] || '';
    const upper = (dtype || '').toString().toUpperCase();
    if (upper.includes('INT') || upper.includes('DOUBLE') || upper.includes('FLOAT') || upper.includes('DECIMAL') || upper.includes('REAL')) {
      return 'numeric';
    }
    return 'categorical';
  };

  useEffect(() => {
    if (columnNames.length && !selectedColumn) {
      const first = columnNames[0];
      setSelectedColumn(first);
      const type = resolveColumnType(first);
      setSelectedChart(type === 'numeric' ? 'histogram' : 'bar');
    }
  }, [columnNames]);

  useEffect(() => {
    if (!selectedColumn) return;
    const type = resolveColumnType(selectedColumn);
    if (type === 'categorical' && selectedChart !== 'bar') {
      setSelectedChart('bar');
    }
    if (type === 'numeric' && selectedChart === 'bar') {
      setSelectedChart('histogram');
    }
  }, [selectedColumn]);

  useEffect(() => {
    if (!profile || !Number.isFinite(id)) return;
    let cancelled = false;

    const fetchExtras = async () => {
      try {
        // Only fetch insights, removed preview fetch to reduce initial load
        const ins = await datasetService.getDatasetInsights(id);
        if (cancelled) return;
        setInsight(ins);
        setInsightError('');
      } catch (e: any) {
        if (cancelled) return;
        // Show error but create a fallback insight so page content still renders
        const errorMsg = e?.response?.data?.detail || 'Failed to load dataset insights';
        console.error('Failed to load insights:', e);
        setInsightError(errorMsg);
        setInsight({
          summary: 'Unable to generate insights summary.',
          quality_score: profile?.quality_score,
          row_count: dataset?.row_count,
          column_count: dataset?.column_count,
        });
      }
    };

    fetchExtras();

    return () => {
      cancelled = true;
    };
  }, [id, profile, dataset]);

  const loadVisualization = async (column: string, chartType: 'histogram' | 'bar' | 'box') => {
    if (!Number.isFinite(id) || !column) return;
    setVizLoading(true);
    setVizError('');
    try {
      const colType = resolveColumnType(column);
      let desiredChart: 'histogram' | 'bar' | 'box' = chartType;
      if (desiredChart === 'box' && colType !== 'numeric') {
        desiredChart = 'bar';
      }
      const data = await datasetService.getColumnVisualization(id as number, column, desiredChart, 15);
      setVizData(data);
      setVizStats(data.stats);
    } catch (e: any) {
      setVizError(e?.response?.data?.detail || 'Could not load visualization data.');
    } finally {
      setVizLoading(false);
    }
  };

  // Lazy-load visualization only when workspace is opened
  useEffect(() => {
    if (!profile || !selectedColumn || !isVizOpen) return;
    loadVisualization(selectedColumn, selectedChart);
  }, [profile, selectedColumn, selectedChart, isVizOpen]);

  const handleAskAI = async (question?: string) => {
    const prompt = (question ?? aiInput).trim();
    if (!prompt || !Number.isFinite(id)) return;
    setAiInput('');
    setAiLoading(true);
    setAiMessages((prev) => [...prev, { role: 'user', text: prompt }]);
    try {
      const response = await datasetService.askDatasetAI(id as number, prompt);
      setAiMessages((prev) => [...prev, { role: 'assistant', text: response.answer }]);
    } catch (e: any) {
      setAiMessages((prev) => [...prev, { role: 'assistant', text: e?.response?.data?.detail || 'I could not answer that right now.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  const isProfiling = dataset?.status === 'profiling' || dataset?.status === 'uploaded';
  const isCleaning = dataset?.status === 'cleaning';
  const isProfiled = dataset?.status === 'profiled' || dataset?.status === 'cleaned';

  // Handler: called when cleaning is triggered — update status locally + restart polling
  const handleCleaningStart = () => {
    setDataset(prev => prev ? { ...prev, status: 'cleaning' } : prev);
    // Restart polling if it has stopped
    if (!pollTimerRef.current) {
      const fetchOnce = async () => {
        try {
          const ds = await datasetService.getDataset(id);
          setDataset(ds);
          if (ds.status === 'profiled' || ds.status === 'cleaned') {
            try {
              const p = await datasetService.getDatasetProfile(id);
              setProfile(p);
            } catch (_) {}
            if (pollTimerRef.current) {
              window.clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
          } else if (ds.status === 'failed') {
            if (pollTimerRef.current) {
              window.clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
          }
        } catch (_) {}
      };
      pollTimerRef.current = window.setInterval(fetchOnce, POLL_MS);
    }
  };

  // Handler: after cleaning completes, re-fetch profile to get updated stats
  const handleCleaningComplete = async () => {
    if (!Number.isFinite(id)) return;
    try {
      const [ds, p] = await Promise.all([
        datasetService.getDataset(id),
        datasetService.getDatasetProfile(id),
      ]);
      setDataset(ds);
      setProfile(p);
    } catch (_) {}
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <DatasetHeader dataset={dataset} isLoading={isLoading} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Errors */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-sm">
            {error}
          </div>
        )}

        {insightError && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-4 rounded-xl shadow-sm">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-medium">Could not load full insights</p>
                <p className="text-sm mt-1">{insightError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Status banners */}
        {isProfiling && (
          <div className="bg-slate-50 border border-slate-200 text-slate-700 px-6 py-4 rounded-xl">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Profiling in progress — updates every {POLL_MS / 1000}s.</span>
            </div>
          </div>
        )}

        {isCleaning && (
          <div className="bg-slate-50 border border-slate-200 text-slate-700 px-6 py-4 rounded-xl">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Cleaning in progress — this page will refresh automatically.</span>
            </div>
          </div>
        )}

        {/* Main content once profiled / cleaned */}
        {isProfiled && insight && (
          <>
            <DatasetOverview insight={insight} isLoading={!insight} />

            {/* Section tab bar */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="flex overflow-x-auto">
                {([
                  { key: 'profile', label: 'Profile & Explore' },
                  { key: 'clean',   label: 'Clean Dataset' },
                  { key: 'ml',      label: 'ML Preparation' },
                ] as { key: Section; label: string }[]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveSection(tab.key)}
                    className={`flex-1 min-w-[140px] px-6 py-4 text-sm font-semibold transition-all whitespace-nowrap ${
                      activeSection === tab.key
                        ? 'border-b-2 border-indigo-500 text-indigo-600 bg-indigo-50'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile section */}
            {activeSection === 'profile' && (
              <>
                <ActionButtons
                  onExploreClick={() => setIsVizOpen(true)}
                  onChatClick={() => setIsChatOpen(true)}
                  disabled={!profile}
                />
                <ProfilingStats profile={profile} />
                <ColumnsTable profile={profile} />
              </>
            )}

            {/* Clean section */}
            {activeSection === 'clean' && (
              <>
                <CleaningPanel
                  datasetId={id}
                  profile={profile}
                  datasetStatus={dataset?.status ?? ''}
                  onCleaningComplete={handleCleaningComplete}
                  onCleaningStart={handleCleaningStart}
                />
                {profile?.cleaning_stats && (
                  <CleaningCharts profile={profile} />
                )}
              </>
            )}

            {/* ML section */}
            {activeSection === 'ml' && (
              <MLPanel
                datasetId={id}
                datasetStatus={dataset?.status ?? ''}
                onPrepareComplete={handleCleaningComplete}
              />
            )}
          </>
        )}
      </div>

      <VisualizationWorkspace
        isOpen={isVizOpen}
        onClose={() => setIsVizOpen(false)}
        columnNames={columnNames}
        selectedColumn={selectedColumn}
        onColumnChange={setSelectedColumn}
        selectedChart={selectedChart}
        onChartChange={(chart) => setSelectedChart(chart as any)}
        vizData={vizData}
        vizStats={vizStats}
        vizLoading={vizLoading}
        vizError={vizError}
        resolveColumnType={resolveColumnType}
      />

      <ChatWorkspace
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={aiMessages}
        input={aiInput}
        onInputChange={setAiInput}
        onSend={handleAskAI}
        isLoading={aiLoading}
        datasetName={dataset?.name || 'Dataset'}
        rowCount={dataset?.row_count}
        columnCount={dataset?.column_count}
      />
    </div>
  );};

export default DatasetDetails;
