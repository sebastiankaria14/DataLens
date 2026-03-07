import api from './api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Dataset {
  id: number;
  name: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  status: 'uploaded' | 'profiling' | 'profiled' | 'cleaning' | 'cleaned' | 'failed';
  row_count?: number;
  column_count?: number;
  created_at: string;
  updated_at: string;
  profiled_at?: string;
  cleaned_at?: string;
}

export interface DatasetProfile {
  row_count: number;
  column_count: number;
  columns: Record<string, any>;
  missing_values: Record<string, number>;
  duplicates: number;
  memory_usage: string;
  quality_score?: number;
  data_types?: Record<string, string>;
  imbalance_warnings?: Array<{ column: string; severity: string; imbalance_ratio?: number; message: string }>;
  cleaning_stats?: CleaningStats;
  ml_preparation?: MLPrepStats;
}

export interface DatasetInsight {
  summary: string;
  ai_description?: string;
  quality_score?: number;
  row_count?: number;
  column_count?: number;
  duplicates?: number;
  missing_rate?: number;
  columns?: Array<{ name: string; dtype?: string; null_percentage?: number; unique_count?: number; is_categorical?: boolean }>;
  imbalance_warnings?: Array<{ column: string; severity: string; imbalance_ratio?: number; message: string }>;
  recommendations?: string[];
  domain?: string;
  domain_icon?: string;
  suitable_for?: Array<{ type: string; icon: string; confidence: string }>;
}

export interface DatasetPreview {
  columns: Array<{ name: string; dtype: string }>;
  rows: Array<Record<string, any>>;
  row_count?: number;
  column_count?: number;
}

export interface VisualizationStats {
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  q25?: number;
  q75?: number;
}

export interface VisualizationData {
  chart_type: 'histogram' | 'bar' | 'box';
  column: string;
  column_type: 'numeric' | 'categorical';
  data: Array<Record<string, any>>;
  stats?: VisualizationStats;
}

export interface AIResponse {
  answer: string;
  related_columns?: string[];
  recommendations?: string[];
}

export interface CleaningOptions {
  remove_duplicates?: boolean;
  handle_missing?: 'drop' | 'fill_mean' | 'fill_median' | 'fill_mode' | null;
  remove_outliers?: boolean;
  outlier_method?: 'iqr' | 'zscore';
  outlier_action?: 'remove' | 'cap';
  filter_columns?: string[] | null;
  normalize?: boolean;
  missing_strategy_map?: Record<string, string> | null;
  convert_types?: Record<string, string> | null;
  encode_categoricals?: boolean;
  balance_target?: string | null;
  balance_method?: 'undersample' | 'oversample';
}

export interface CleaningStats {
  initial_rows: number;
  initial_columns: number;
  final_rows: number;
  final_columns: number;
  rows_removed: number;
  operations_performed: Array<Record<string, any>>;
  outlier_detection?: Record<string, any>;
  null_counts_after?: Record<string, number>;
}

export interface CleaningStatus {
  dataset_id: number;
  status: string;
  cleaned_at?: string;
  cleaning_stats?: CleaningStats;
  cleaning_error?: string;
}

export interface MLReadiness {
  dataset_quality_score: number;
  ml_readiness_score: number;
  score_breakdown: Record<string, number>;
  issues_remaining: string[];
  recommendations: string[];
  low_variance_features: string[];
  high_missing_columns: string[];
  severe_imbalance: boolean;
}

export interface FeatureSuggestions {
  drop_columns: string[];
  normalize_columns: string[];
  encode_columns: string[];
  create_features: Array<{ column: string; suggestion: string; description: string }>;
  correlated_pairs: Array<{ col1: string; col2: string; correlation: number; suggestion: string }>;
}

export interface ModelInfo {
  name: string;
  library: string;
  notes: string;
}

export interface ModelRecommendations {
  task: 'classification' | 'regression';
  models: ModelInfo[];
}

export interface MLAnalysis {
  ml_readiness: MLReadiness;
  feature_suggestions: FeatureSuggestions;
  target_columns: string[];
  model_recommendations: ModelRecommendations;
}

export interface MLPrepOptions {
  target_column?: string | null;
  test_size?: number;
  normalize?: boolean;
  encode?: boolean;
}

export interface MLPrepStats {
  initial_rows: number;
  initial_columns: number;
  train_rows: number;
  test_rows: number;
  split_ratio: string;
  train_path: string;
  test_path: string;
  target_column?: string;
  normalized_columns?: string[];
  encoded_columns?: string[];
}

class DatasetService {
  /**
   * Upload a dataset file with progress tracking
   */
  async uploadDataset(file: File, onProgress?: (progress: number) => void): Promise<Dataset> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post<Dataset>('/api/datasets/upload', formData, {
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    
    return response.data;
  }

  /**
   * Get all datasets for the current user
   */
  async getDatasets(skip = 0, limit = 100): Promise<Dataset[]> {
    const response = await api.get<Dataset[]>('/api/datasets/', {
      params: { skip, limit },
    });
    return response.data;
  }

  /**
   * Get a specific dataset by ID
   */
  async getDataset(id: number): Promise<Dataset> {
    const response = await api.get<Dataset>(`/api/datasets/${id}`);
    return response.data;
  }

  /**
   * Get dataset profile/statistics
   */
  async getDatasetProfile(id: number): Promise<DatasetProfile> {
    const response = await api.get<DatasetProfile>(`/api/datasets/${id}/profile`);
    return response.data;
  }

  /**
   * Get a small preview of dataset rows for visualization.
   */
  async getDatasetPreview(id: number, limit = 50): Promise<DatasetPreview> {
    const response = await api.get<DatasetPreview>(`/api/datasets/${id}/preview`, { params: { limit } });
    return response.data;
  }

  /**
   * Get summary insights for the dataset.
   */
  async getDatasetInsights(id: number): Promise<DatasetInsight> {
    const response = await api.get<DatasetInsight>(`/api/datasets/${id}/insights`);
    return response.data;
  }

  /**
   * Fetch visualization data (histogram/bar/box) for a column.
   */
  async getColumnVisualization(id: number, column: string, chartType: 'histogram' | 'bar' | 'box' | 'auto' = 'auto', bins = 20): Promise<VisualizationData> {
    const response = await api.get<VisualizationData>(`/api/datasets/${id}/visualization`, {
      params: { column, chart_type: chartType, bins },
    });
    return response.data;
  }

  /**
   * Lightweight AI-style answer about the dataset using profiling context.
   */
  async askDatasetAI(id: number, question: string): Promise<AIResponse> {
    const response = await api.post<AIResponse>(`/api/datasets/${id}/ai`, { question });
    return response.data;
  }

  /**
   * Clean dataset with specified options
   */
  async cleanDataset(id: number, options: CleaningOptions): Promise<{ message: string; dataset_id: number }> {
    const response = await api.post(`/api/datasets/${id}/clean`, options);
    return response.data;
  }

  /**
   * Delete a dataset
   */
  async deleteDataset(id: number): Promise<void> {
    await api.delete(`/api/datasets/${id}`);
  }

  /**
   * Download a dataset
   */
  async downloadDataset(id: number): Promise<Blob> {
    const response = await api.get(`/api/datasets/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  /**
   * Get cleaning status for a dataset
   */
  async getCleaningStatus(id: number): Promise<CleaningStatus> {
    const response = await api.get<CleaningStatus>(`/api/datasets/${id}/clean/status`);
    return response.data;
  }

  /**
   * Returns an absolute URL for downloading the cleaned dataset.
   * The caller is responsible for attaching the Authorization header.
   */
  getCleanedDownloadUrl(id: number, format: string): string {
    return `${API_BASE_URL}/api/datasets/${id}/download-cleaned?format=${format}`;
  }

  /**
   * Run ML analysis on a dataset (readiness, feature suggestions, model recommendations)
   */
  async getMLAnalysis(id: number): Promise<MLAnalysis> {
    const response = await api.get<MLAnalysis>(`/api/datasets/${id}/ml-analysis`);
    return response.data;
  }

  /**
   * Prepare the dataset for ML (encode, normalize, split train/test)
   */
  async prepareML(id: number, opts: MLPrepOptions): Promise<{ message: string; dataset_id: number }> {
    const response = await api.post(`/api/datasets/${id}/prepare-ml`, opts);
    return response.data;
  }

  /**
   * Helper to format file size
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

const datasetService = new DatasetService();
export default datasetService;
