import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import datasetService from '../services/dataset';
import type { MLAnalysis, MLPrepOptions } from '../services/dataset';

interface MLPanelProps {
  datasetId: number;
  datasetStatus: string;
  onPrepareComplete?: () => void;
}

const MLPanel: React.FC<MLPanelProps> = ({ datasetId, datasetStatus, onPrepareComplete }) => {
  const [mlData, setMlData] = useState<MLAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareSuccess, setPrepareSuccess] = useState(false);
  const [prepareError, setPrepareError] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [testSize, setTestSize] = useState(0.2);
  const [activeTab, setActiveTab] = useState<'readiness' | 'features' | 'models' | 'prepare'>('readiness');

  const isReady = ['profiled', 'cleaned'].includes(datasetStatus);

  const loadAnalysis = async () => {
    if (!isReady) return;
    setLoading(true);
    setError('');
    try {
      const data = await datasetService.getMLAnalysis(datasetId);
      if (!data || typeof data !== 'object') throw new Error('Invalid response from server.');
      setMlData(data);
      if ((data.target_columns?.length ?? 0) > 0) setSelectedTarget(data.target_columns[0]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? JSON.stringify(d)).join('; ')
        : detail || e?.message || 'Failed to load ML analysis.';
      console.error('[MLPanel] loadAnalysis error:', e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalysis();
  }, [datasetId, datasetStatus]);

  const handlePrepareML = async () => {
    setIsPreparing(true);
    setPrepareError('');
    setPrepareSuccess(false);
    try {
      const opts: MLPrepOptions = {
        target_column: selectedTarget || null,
        test_size: testSize,
        normalize: true,
        encode: true,
      };
      await datasetService.prepareML(datasetId, opts);
      setPrepareSuccess(true);
      onPrepareComplete?.();
    } catch (e: any) {
      setPrepareError(e?.response?.data?.detail || 'ML preparation failed.');
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-white rounded-2xl shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-8 py-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          ML Preparation
        </h2>
        <p className="text-purple-100 mt-1 text-sm">
          ML readiness analysis, feature engineering suggestions, and auto dataset preparation.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {(['readiness', 'features', 'models', 'prepare'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3.5 text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-purple-500 text-purple-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'readiness' ? 'ML Readiness' : tab === 'features' ? 'Features' : tab === 'models' ? 'Models' : 'Prepare'}
          </button>
        ))}
      </div>

      <div className="p-8">
        {!isReady && (
          <div className="text-center text-gray-400 py-10">
            <p className="text-lg font-medium">Dataset must be profiled first.</p>
          </div>
        )}

        {isReady && loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isReady && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 space-y-3">
            <p className="text-red-700 text-sm font-medium">{error}</p>
            <button
              onClick={() => loadAnalysis()}
              className="text-sm font-semibold text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        )}

        {isReady && !loading && mlData && (
          <AnimatePresence mode="wait">
            {activeTab === 'readiness' && (
              <motion.div key="readiness" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                {/* Score Ring */}
                <div className="flex flex-col sm:flex-row items-center gap-8">
                  <ScoreRing
                    label="ML Readiness"
                    score={mlData.ml_readiness.ml_readiness_score}
                    color="#8b5cf6"
                  />
                  <ScoreRing
                    label="Data Quality"
                    score={mlData.ml_readiness.dataset_quality_score}
                    color="#10b981"
                  />
                  <div className="flex-1 space-y-3">
                    <h4 className="font-semibold text-gray-700">Score Breakdown</h4>
                    {Object.entries(mlData.ml_readiness.score_breakdown).map(([k, v]) => (
                      <BreakdownBar key={k} label={k.replace(/_/g, ' ')} value={v} max={25} />
                    ))}
                  </div>
                </div>

                {mlData.ml_readiness.issues_remaining.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                    <h4 className="font-semibold text-yellow-800 mb-2">Issues Remaining</h4>
                    <ul className="space-y-1">
                      {mlData.ml_readiness.issues_remaining.map((issue, i) => (
                        <li key={i} className="text-sm text-yellow-700 flex gap-2"><span>⚠</span>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                  <h4 className="font-semibold text-purple-800 mb-2">Recommendations</h4>
                  <ul className="space-y-1">
                    {mlData.ml_readiness.recommendations.map((r, i) => (
                      <li key={i} className="text-sm text-purple-700 flex gap-2"><span>→</span>{r}</li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}

            {activeTab === 'features' && (
              <motion.div key="features" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                <SuggestionList
                  title="Columns to Drop"
                  icon="🗑"
                  items={mlData.feature_suggestions.drop_columns || []}
                  badge="badge-red"
                  emptyText="No columns flagged for dropping."
                />
                <SuggestionList
                  title="Normalize These Columns"
                  icon="📐"
                  items={mlData.feature_suggestions.normalize_columns || []}
                  badge="badge-blue"
                  emptyText="No numeric columns require normalization."
                />
                <SuggestionList
                  title="Encode These Columns"
                  icon="🔤"
                  items={mlData.feature_suggestions.encode_columns || []}
                  badge="badge-green"
                  emptyText="No categorical columns require encoding."
                />
                {(mlData.feature_suggestions.create_features || []).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">💡 Feature Creation Ideas</h4>
                    {mlData.feature_suggestions.create_features.map((f, i) => (
                      <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 mb-2">
                        <strong>{f.column}</strong>: {f.description}
                      </div>
                    ))}
                  </div>
                )}
                {(mlData.feature_suggestions.correlated_pairs || []).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">🔗 Highly Correlated Pairs</h4>
                    {mlData.feature_suggestions.correlated_pairs.map((p, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-700 mb-2">
                        <span className="font-mono bg-gray-200 px-1 rounded">{p.col1}</span>
                        {' ↔ '}
                        <span className="font-mono bg-gray-200 px-1 rounded">{p.col2}</span>
                        <span className="ml-2 text-gray-500">({p.correlation})</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'models' && (
              <motion.div key="models" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    mlData.model_recommendations.task === 'classification'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {mlData.model_recommendations.task}
                  </span>
                  <p className="text-sm text-gray-500">
                    Detected target: <strong>{mlData.target_columns[0] ?? 'none detected'}</strong>
                  </p>
                </div>
                <div className="space-y-3">
                  {mlData.model_recommendations.models.map((model, i) => (
                    <div
                      key={i}
                      className="border border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{model.name}</h4>
                          <code className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded mt-1 inline-block">
                            {model.library}
                          </code>
                        </div>
                        <span className="text-lg">{i === 0 ? '⭐' : ''}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">{model.notes}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'prepare' && (
              <motion.div key="prepare" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <p className="text-sm text-gray-600">
                  Auto-prepare your dataset for ML: normalize numerics, encode categoricals, and generate
                  train/test split files saved as Parquet.
                </p>

                {/* Target column */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Target Column</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-purple-400 outline-none"
                    value={selectedTarget}
                    onChange={(e) => setSelectedTarget(e.target.value)}
                  >
                    <option value="">— None (unsupervised) —</option>
                    {mlData.target_columns.map((tc) => (
                      <option key={tc} value={tc}>{tc}</option>
                    ))}
                  </select>
                </div>

                {/* Test size */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                    Test Split: {Math.round(testSize * 100)}%
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={40}
                    step={5}
                    value={testSize * 100}
                    onChange={(e) => setTestSize(Number(e.target.value) / 100)}
                    className="w-full accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>10% test</span><span>40% test</span>
                  </div>
                </div>

                {prepareError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">{prepareError}</div>
                )}
                {prepareSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-5 py-4 text-sm">
                    ✓ ML preparation started. Train/test files will be saved to <code>processed/ml_ready/</code>.
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: isPreparing ? 1 : 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePrepareML}
                  disabled={isPreparing}
                  className={`w-full py-4 rounded-2xl font-semibold text-white text-lg shadow-lg transition-all flex items-center justify-center gap-3 ${
                    isPreparing
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-violet-500 to-purple-600 hover:shadow-xl'
                  }`}
                >
                  {isPreparing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Preparing...
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Auto Prepare for ML
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};

// ---- Sub-components ----

const ScoreRing: React.FC<{ label: string; score: number; color: string }> = ({ label, score, color }) => {
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="110" height="110" className="-rotate-90">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="55" cy="55" r={radius} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="-mt-16 text-center">
        <p className="text-2xl font-bold text-gray-800">{Math.round(score)}</p>
        <p className="text-xs text-gray-500">/100</p>
      </div>
      <p className="text-sm font-semibold text-gray-600 mt-12">{label}</p>
    </div>
  );
};

const BreakdownBar: React.FC<{ label: string; value: number; max: number }> = ({ label, value, max }) => (
  <div>
    <div className="flex justify-between text-xs text-gray-600 mb-0.5">
      <span className="capitalize">{label}</span>
      <span>{value.toFixed(1)}</span>
    </div>
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
      />
    </div>
  </div>
);

const SuggestionList: React.FC<{
  title: string; icon: string; items: string[]; badge: string; emptyText: string
}> = ({ title, icon, items, emptyText }) => (
  <div>
    <h4 className="text-sm font-semibold text-gray-700 mb-2">{icon} {title}</h4>
    {items.length === 0 ? (
      <p className="text-xs text-gray-400 italic">{emptyText}</p>
    ) : (
      <div className="flex flex-wrap gap-2">
        {items.map((col) => (
          <span key={col} className="px-3 py-1 bg-gray-100 border border-gray-200 rounded-full text-xs font-mono text-gray-700">
            {col}
          </span>
        ))}
      </div>
    )}
  </div>
);

export default MLPanel;
