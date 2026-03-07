import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import datasetService from '../services/dataset';
import type { DatasetProfile, CleaningOptions, CleaningStats } from '../services/dataset';

interface CleaningPanelProps {
  datasetId: number;
  profile: DatasetProfile | null;
  datasetStatus: string;
  onCleaningComplete: () => void;
  onCleaningStart?: () => void;
}

const CleaningPanel: React.FC<CleaningPanelProps> = ({
  datasetId,
  profile,
  datasetStatus,
  onCleaningComplete,
  onCleaningStart,
}) => {
  const [options, setOptions] = useState<CleaningOptions>({
    remove_duplicates: false,
    handle_missing: null,
    remove_outliers: false,
    outlier_method: 'iqr',
    outlier_action: 'remove',
    normalize: false,
    encode_categoricals: false,
    balance_target: null,
    balance_method: 'undersample',
  });

  const [isCleaning, setIsCleaning] = useState(false);
  const [cleaningStats, setCleaningStats] = useState<CleaningStats | null>(
    profile?.cleaning_stats ?? null
  );
  const [cleaningError, setCleaningError] = useState('');
  const [noOpWarning, setNoOpWarning] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'parquet' | 'csv' | 'excel'>('csv');

  const pollRef = useRef<number | null>(null);

  // Sync cleaning stats from profile prop
  useEffect(() => {
    if (profile?.cleaning_stats) setCleaningStats(profile.cleaning_stats);
  }, [profile]);

  // Poll for cleaning completion while in-flight
  useEffect(() => {
    if (!isCleaning) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const s = await datasetService.getCleaningStatus(datasetId);
        if (s.status === 'cleaned') {
          setIsCleaning(false);
          if (s.cleaning_stats) setCleaningStats(s.cleaning_stats);
          onCleaningComplete();
          window.clearInterval(pollRef.current!);
        } else if (s.status === 'failed') {
          setIsCleaning(false);
          setCleaningError(s.cleaning_error || 'Cleaning failed. Please try again.');
          window.clearInterval(pollRef.current!);
        }
      } catch (_) {}
    }, 2000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [isCleaning, datasetId]);

  const handleStartCleaning = async () => {
    // Validate that at least one operation is enabled
    const hasOp =
      options.remove_duplicates ||
      options.handle_missing != null ||
      options.remove_outliers ||
      options.normalize ||
      options.encode_categoricals ||
      (options.balance_target != null && options.balance_target !== '') ||
      (options.filter_columns != null && options.filter_columns.length > 0);

    if (!hasOp) {
      setNoOpWarning(true);
      return;
    }
    setNoOpWarning(false);
    setCleaningError('');
    setIsCleaning(true);
    onCleaningStart?.();
    try {
      await datasetService.cleanDataset(datasetId, options);
    } catch (e: any) {
      setIsCleaning(false);
      setCleaningError(e?.response?.data?.detail || 'Failed to start cleaning.');
    }
  };

  const handleDownload = () => {
    const token = localStorage.getItem('token');
    const url = datasetService.getCleanedDownloadUrl(datasetId, downloadFormat);
    // Use a link with auth header by fetching as blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `dataset_cleaned.${downloadFormat === 'excel' ? 'xlsx' : downloadFormat}`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  };

  const isCleaned = datasetStatus === 'cleaned';
  const missingValues = profile?.missing_values ?? {};
  const totalMissing = Object.values(missingValues).reduce((a, b) => a + b, 0);
  const duplicates = profile?.duplicates ?? 0;
  const rowCount = profile?.row_count ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Clean Dataset
        </h2>
        <p className="text-emerald-100 mt-1 text-sm">
          Configure and apply data cleaning operations to improve dataset quality.
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* Issues Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <IssueCard
            label="Duplicate Rows"
            value={duplicates}
            total={rowCount}
            color={duplicates > 0 ? 'red' : 'green'}
          />
          <IssueCard
            label="Missing Values"
            value={totalMissing}
            total={rowCount * Math.max(Object.keys(missingValues).length, 1)}
            color={totalMissing > 0 ? 'yellow' : 'green'}
          />
          <IssueCard
            label="Quality Score"
            value={profile?.quality_score ?? 0}
            isScore
            color={(profile?.quality_score ?? 0) >= 80 ? 'green' : (profile?.quality_score ?? 0) >= 50 ? 'yellow' : 'red'}
          />
        </div>

        {/* Options */}
        <div className="space-y-5">
          <h3 className="text-lg font-semibold text-gray-800">Cleaning Options</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Duplicates */}
            <ToggleOption
              label="Remove Duplicates"
              description={`${duplicates} duplicate rows detected`}
              checked={options.remove_duplicates ?? false}
              onChange={(v) => setOptions((o) => ({ ...o, remove_duplicates: v }))}
            />

            {/* Missing values */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Handle Missing Values</label>
              <p className="text-xs text-gray-500">{totalMissing} missing cells total</p>
              <select
                className="mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-400 outline-none transition"
                value={options.handle_missing ?? ''}
                onChange={(e) => setOptions((o) => ({ ...o, handle_missing: (e.target.value || null) as any }))}
              >
                <option value="">— No action —</option>
                <option value="drop">Drop rows with nulls</option>
                <option value="fill_mean">Fill with mean</option>
                <option value="fill_median">Fill with median</option>
                <option value="fill_mode">Fill with mode</option>
                <option value="fill_zero">Fill with zero</option>
              </select>
            </div>

            {/* Outliers */}
            <div className="space-y-2">
              <ToggleOption
                label="Handle Outliers"
                description="Detect and handle extreme values"
                checked={options.remove_outliers ?? false}
                onChange={(v) => setOptions((o) => ({ ...o, remove_outliers: v }))}
              />
              {options.remove_outliers && (
                <div className="ml-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Detection</label>
                    <select
                      className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-400 outline-none"
                      value={options.outlier_method}
                      onChange={(e) => setOptions((o) => ({ ...o, outlier_method: e.target.value as any }))}
                    >
                      <option value="iqr">IQR</option>
                      <option value="zscore">Z-Score</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Action</label>
                    <select
                      className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-400 outline-none"
                      value={options.outlier_action}
                      onChange={(e) => setOptions((o) => ({ ...o, outlier_action: e.target.value as any }))}
                    >
                      <option value="remove">Remove rows</option>
                      <option value="cap">Cap values</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Normalize */}
            <ToggleOption
              label="Normalize Numeric Columns"
              description="Min-max scale to [0, 1] range"
              checked={options.normalize ?? false}
              onChange={(v) => setOptions((o) => ({ ...o, normalize: v }))}
            />

            {/* Encode */}
            <ToggleOption
              label="Encode Categorical Columns"
              description="Label-encode low-cardinality string columns"
              checked={options.encode_categoricals ?? false}
              onChange={(v) => setOptions((o) => ({ ...o, encode_categoricals: v }))}
            />
          </div>
        </div>

        {/* Error */}
        {cleaningError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">
            {cleaningError}
          </div>
        )}

        {/* No-op warning */}
        {noOpWarning && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-4 text-sm">
            ⚠️ Please enable at least one cleaning operation before starting.
          </div>
        )}

        {/* Action button — always visible so users can re-clean with new options */}
        <motion.button
          whileHover={{ scale: isCleaning ? 1 : 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStartCleaning}
          disabled={isCleaning}
          className={`w-full py-4 rounded-2xl font-semibold text-white text-lg shadow-lg transition-all duration-300 flex items-center justify-center gap-3 ${
            isCleaning
              ? 'bg-gray-400 cursor-not-allowed'
              : isCleaned
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-xl'
              : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-xl'
          }`}
        >
          {isCleaning ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Cleaning in progress...
            </>
          ) : isCleaned ? (
            <>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Re-clean with New Options
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Start Cleaning
            </>
          )}
        </motion.button>

        {/* Cleaning Results */}
        <AnimatePresence>
          {cleaningStats && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Cleaning Results
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatBox label="Initial Rows" value={cleaningStats.initial_rows?.toLocaleString()} />
                <StatBox label="Final Rows" value={cleaningStats.final_rows?.toLocaleString()} />
                <StatBox label="Rows Removed" value={cleaningStats.rows_removed?.toLocaleString()} highlight />
                <StatBox label="Operations" value={cleaningStats.operations_performed?.length ?? 0} />
              </div>

              {cleaningStats.operations_performed && cleaningStats.operations_performed.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Applied Operations</p>
                  {cleaningStats.operations_performed.map((op, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-emerald-500 mt-0.5">✓</span>
                      <span className="font-mono text-xs bg-gray-200 rounded px-1.5 py-0.5">{op.operation}</span>
                      <span className="text-gray-500">
                        {op.rows_removed != null ? `${op.rows_removed} rows removed` : ''}
                        {op.columns_filled != null ? `${op.columns_filled} columns filled` : ''}
                        {op.normalized_columns != null ? `${Array.isArray(op.normalized_columns) ? op.normalized_columns.length : op.normalized_columns} columns normalized` : ''}
                        {op.encoded_columns != null ? `${Array.isArray(op.encoded_columns) ? op.encoded_columns.length : op.encoded_columns} columns encoded` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Download buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <span className="text-sm font-medium text-gray-700">Download as:</span>
                {(['csv', 'parquet', 'excel'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => { setDownloadFormat(fmt); setTimeout(handleDownload, 50); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all hover:shadow-md capitalize"
                    style={{
                      borderColor: fmt === 'csv' ? '#10b981' : fmt === 'parquet' ? '#6366f1' : '#f59e0b',
                      color: fmt === 'csv' ? '#10b981' : fmt === 'parquet' ? '#6366f1' : '#f59e0b',
                    }}
                  >
                    Download {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Download buttons when dataset is cleaned but stats aren't loaded */}
        {isCleaned && !cleaningStats && (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span className="text-sm font-medium text-gray-700">Download cleaned file:</span>
            {(['csv', 'parquet', 'excel'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => { setDownloadFormat(fmt); setTimeout(handleDownload, 50); }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all hover:shadow-md capitalize"
                style={{
                  borderColor: fmt === 'csv' ? '#10b981' : fmt === 'parquet' ? '#6366f1' : '#f59e0b',
                  color: fmt === 'csv' ? '#10b981' : fmt === 'parquet' ? '#6366f1' : '#f59e0b',
                }}
              >
                Download {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ---- Sub-components ----

interface IssueCardProps {
  label: string;
  value: number;
  total?: number;
  isScore?: boolean;
  color: 'red' | 'yellow' | 'green';
}
const colorMap = {
  red: 'bg-red-50 border-red-200 text-red-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  green: 'bg-green-50 border-green-200 text-green-700',
};

const IssueCard: React.FC<IssueCardProps> = ({ label, value, total, isScore, color }) => (
  <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
    <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
    <p className="text-2xl font-bold mt-1">
      {isScore ? `${value}/100` : value.toLocaleString()}
    </p>
    {total != null && !isScore && (
      <p className="text-xs mt-0.5 opacity-60">{((value / total) * 100).toFixed(1)}% of total</p>
    )}
  </div>
);

interface ToggleOptionProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}
const ToggleOption: React.FC<ToggleOptionProps> = ({ label, description, checked, onChange }) => (
  <label className="flex items-start gap-4 cursor-pointer group p-4 rounded-xl border border-gray-200 hover:border-emerald-300 transition-all">
    <div className="mt-0.5 flex-shrink-0">
      <div
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors duration-200 relative ${
          checked ? 'bg-emerald-500' : 'bg-gray-300'
        }`}
      >
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </div>
    </div>
    <div>
      <p className="text-sm font-semibold text-gray-800">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </div>
  </label>
);

interface StatBoxProps { label: string; value: any; highlight?: boolean; }
const StatBox: React.FC<StatBoxProps> = ({ label, value, highlight }) => (
  <div className={`rounded-xl p-4 text-center ${highlight && Number(value) > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'}`}>
    <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
    <p className={`text-xl font-bold mt-1 ${highlight && Number(value) > 0 ? 'text-orange-600' : 'text-gray-800'}`}>{value}</p>
  </div>
);

export default CleaningPanel;
