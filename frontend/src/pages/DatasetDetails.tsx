import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import datasetService from '../services/dataset';
import type { Dataset, DatasetProfile } from '../services/dataset';

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

const POLL_MS = 2000;

const DatasetDetails: React.FC = () => {
  const navigate = useNavigate();
  const { datasetId } = useParams();

  const id = useMemo(() => {
    const parsed = Number(datasetId);
    return Number.isFinite(parsed) ? parsed : NaN;
  }, [datasetId]);

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

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

        // Fetch profiling results when ready.
        if ((ds.status === 'profiled' || ds.status === 'cleaned') && !profile) {
          try {
            const p = await datasetService.getDatasetProfile(id);
            if (cancelled) return;
            setProfile(p);
            stopPolling();
          } catch {
            // Profile may not be ready yet (backend returns 400) – keep polling.
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

    // Initial fetch and start polling.
    fetchOnce();
    pollTimerRef.current = window.setInterval(fetchOnce, POLL_MS);

    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button onClick={() => navigate('/dashboard')} className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dataset Details</h1>
          <p className="mt-2 text-gray-600">Track profiling progress and view results.</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
        )}

        <div className="card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-gray-500">Dataset</div>
              <div className="text-xl font-semibold text-gray-900">
                {dataset?.name || (isLoading ? 'Loading…' : '—')}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                Original file: <span className="font-medium">{dataset?.original_filename || '—'}</span>
              </div>
            </div>
            <div className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-medium ${dataset ? statusBadgeClasses(dataset.status) : 'bg-gray-100 text-gray-800 border-gray-200'}`}>
              {dataset?.status || 'loading'}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Rows</div>
              <div className="text-lg font-semibold text-gray-900">{dataset?.row_count ?? '—'}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Columns</div>
              <div className="text-lg font-semibold text-gray-900">{dataset?.column_count ?? '—'}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Created</div>
              <div className="text-lg font-semibold text-gray-900">
                {dataset?.created_at ? new Date(dataset.created_at).toLocaleString() : '—'}
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Profiled</div>
              <div className="text-lg font-semibold text-gray-900">
                {dataset?.profiled_at ? new Date(dataset.profiled_at).toLocaleString() : '—'}
              </div>
            </div>
          </div>

          {dataset?.status === 'profiling' && (
            <div className="mt-6 bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-lg">
              Profiling is running in the background. This page updates every {POLL_MS / 1000}s.
            </div>
          )}

          {dataset?.status === 'uploaded' && (
            <div className="mt-6 bg-gray-50 border border-gray-200 text-gray-800 px-4 py-3 rounded-lg">
              Upload complete. Profiling should start momentarily.
            </div>
          )}

          {profile && (
            <div className="mt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Profiling Results</h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-xs text-green-700">Quality Score</div>
                  <div className="text-2xl font-bold text-green-900">{profile.quality_score ?? '—'}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-500">Duplicates</div>
                  <div className="text-2xl font-bold text-gray-900">{profile.duplicates}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-500">Memory Estimate</div>
                  <div className="text-2xl font-bold text-gray-900">{profile.memory_usage}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-500">Columns</div>
                  <div className="text-2xl font-bold text-gray-900">{profile.column_count}</div>
                </div>
              </div>

              <div className="mt-6 card bg-white border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Columns</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Missing</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unique</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.entries(profile.columns || {}).map(([name, info]) => (
                        <tr key={name}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{name}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{info?.dtype ?? profile.data_types?.[name] ?? '—'}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {info?.null_count ?? profile.missing_values?.[name] ?? 0}
                            {typeof info?.null_percentage === 'number' ? ` (${info.null_percentage}%)` : ''}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">{info?.unique_count ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {Array.isArray((profile as any).imbalance_warnings) && (profile as any).imbalance_warnings.length > 0 && (
                <div className="mt-6 bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-lg">
                  <div className="font-semibold mb-2">Imbalance Warnings</div>
                  <ul className="list-disc ml-5 text-sm space-y-1">
                    {(profile as any).imbalance_warnings.map((w: any, idx: number) => (
                      <li key={idx}>{w?.message || `${w?.column}: ${w?.severity}`}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatasetDetails;
