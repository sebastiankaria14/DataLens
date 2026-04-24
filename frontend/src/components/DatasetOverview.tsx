import React from 'react';
import { motion } from 'framer-motion';
import type { DatasetInsight } from '../services/dataset';

interface DatasetOverviewProps {
  insight: DatasetInsight | null;
  isLoading: boolean;
}

const DatasetOverview: React.FC<DatasetOverviewProps> = ({ insight, isLoading }) => {
  if (isLoading || !insight) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-3"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  const qualityScore = insight.quality_score ?? 0;
  const scoreColor =
    qualityScore >= 80
      ? 'text-green-600'
      : qualityScore >= 60
      ? 'text-yellow-600'
      : 'text-red-600';

  const strokeColor =
    qualityScore >= 80
      ? '#10b981'
      : qualityScore >= 60
      ? '#eab308'
      : '#ef4444';

  // Generate intelligent insights
  const insights: string[] = [];
  
  if (insight.row_count && insight.row_count > 10000) {
    insights.push('Large-scale dataset detected');
  } else if (insight.row_count && insight.row_count < 1000) {
    insights.push('Small dataset; consider augmentation strategies');
  }

  if (insight.duplicates && insight.duplicates > 0) {
    insights.push('Contains duplicate records');
  }

  if (insight.missing_rate && insight.missing_rate > 0.1) {
    insights.push('Significant missing values detected');
  }

  if (insight.imbalance_warnings && insight.imbalance_warnings.length > 0) {
    const severe = insight.imbalance_warnings.some(w => w.severity === 'SEVERE');
    insights.push(severe ? 'Severe class imbalance' : 'Moderate class imbalance');
  }

  const hasNumericCols = insight.columns?.some(c => {
    const dtype = (c.dtype || '').toUpperCase();
    return dtype.includes('INT') || dtype.includes('FLOAT') || dtype.includes('DOUBLE');
  });

  const hasCategoricalCols = insight.columns?.some(c => c.is_categorical);

  if (hasNumericCols && hasCategoricalCols) {
    insights.push('Suitable for regression and classification');
  } else if (hasNumericCols) {
    insights.push('Suitable for regression tasks');
  } else if (hasCategoricalCols) {
    insights.push('Suitable for classification tasks');
  }

  if (insights.length === 0) {
    insights.push('Dataset quality looks production-ready');
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="surface-pane p-6 hover:shadow-xl transition-shadow duration-300"
    >
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight mb-3">Dataset Overview</h2>

          {/* Domain + ML project type banner */}
          {(insight.domain || (insight.suitable_for && insight.suitable_for.length > 0)) && (
            <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-start gap-4">
              {insight.domain && insight.domain !== 'General' && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Domain</p>
                          <span className="badge badge-cyan text-sm font-semibold px-3 py-1">
                    {insight.domain_icon} {insight.domain}
                  </span>
                </div>
              )}
              {insight.suitable_for && insight.suitable_for.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Suitable For</p>
                  <div className="flex flex-wrap gap-2">
                    {insight.suitable_for.map((sf, i) => (
                      <span
                        key={i}
                        title={`Confidence: ${sf.confidence}`}
                        className={`badge text-sm px-3 py-1 ${
                          sf.confidence === 'High'
                            ? 'badge-green'
                            : 'badge-yellow'
                        }`}
                      >
                        {sf.icon} {sf.type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {insight.ai_description && (
            <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-start gap-2.5">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Summary</span>
                  <p className="text-slate-700 text-sm leading-relaxed mt-1">{insight.ai_description}</p>
                </div>
              </div>
            </div>
          )}
          <p className="text-slate-600 text-sm leading-relaxed mb-4">{insight.summary}</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {insights.slice(0, 3).map((ins, idx) => (
              <motion.span
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
                className="badge badge-blue"
              >
                {ins}
              </motion.span>
            ))}
          </div>

          {insight.recommendations && insight.recommendations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recommendations</h3>
              <div className="flex flex-wrap gap-2">
                {insight.recommendations.slice(0, 3).map((rec, idx) => (
                  <span
                    key={idx}
                    className="badge badge-gray text-[11px] leading-snug"
                  >
                    {rec}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          <div className="relative w-32 h-32">
            <svg className="transform -rotate-90 w-32 h-32">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="#e5e7eb"
                strokeWidth="8"
                fill="transparent"
              />
              <motion.circle
                cx="64"
                cy="64"
                r="56"
                stroke={strokeColor}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - qualityScore / 100)}`}
                strokeLinecap="round"
                initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - qualityScore / 100) }}
                transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${scoreColor}`}>{qualityScore}</span>
              <span className="text-xs text-gray-500 font-medium">Quality</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DatasetOverview;
