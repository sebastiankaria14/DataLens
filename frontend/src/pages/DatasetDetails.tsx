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

const POLL_MS = 2000;
type ChatMessage = { role: 'assistant' | 'user'; text: string };

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
  const [isLoading, setIsLoading] = useState(true);
  
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

        if ((ds.status === 'profiled' || ds.status === 'cleaned') && !profile) {
          try {
            const p = await datasetService.getDatasetProfile(id);
            if (cancelled) return;
            setProfile(p);
            stopPolling();
          } catch {
            // Profile may not be ready yet
          }
        }

        if (ds.status === 'failed') {
          stopPolling();
          setError('Profiling failed for this dataset.');
        }
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
  }, [id, profile]);

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
        const [ins] = await Promise.all([
          datasetService.getDatasetInsights(id),
          datasetService.getDatasetPreview(id, 40),
        ]);
        if (cancelled) return;
        setInsight(ins);
      } catch (e: any) {
        if (cancelled) return;
        if (e?.response?.data?.detail) {
          setVizError(e.response.data.detail);
        }
      }
    };

    fetchExtras();

    return () => {
      cancelled = true;
    };
  }, [id, profile]);

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
      const data = await datasetService.getColumnVisualization(id as number, column, desiredChart, 20);
      setVizData(data);
      setVizStats(data.stats);
    } catch (e: any) {
      setVizError(e?.response?.data?.detail || 'Could not load visualization data.');
    } finally {
      setVizLoading(false);
    }
  };

  useEffect(() => {
    if (!profile || !selectedColumn) return;
    loadVisualization(selectedColumn, selectedChart);
  }, [profile, selectedColumn, selectedChart]);

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
  const isProfiled = dataset?.status === 'profiled' || dataset?.status === 'cleaned';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <DatasetHeader dataset={dataset} isLoading={isLoading} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-sm">
            {error}
          </div>
        )}

        {isProfiling && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 px-6 py-4 rounded-xl shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Profiling is running in the background. This page updates every {POLL_MS / 1000}s.</span>
            </div>
          </div>
        )}

        {isProfiled && insight && (
          <>
            <DatasetOverview insight={insight} isLoading={!insight} />

            <ActionButtons
              onExploreClick={() => setIsVizOpen(true)}
              onChatClick={() => setIsChatOpen(true)}
              disabled={!profile}
            />

            <ProfilingStats profile={profile} />

            <ColumnsTable profile={profile} />
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
  );
};

export default DatasetDetails;
