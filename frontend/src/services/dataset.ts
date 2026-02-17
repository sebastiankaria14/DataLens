import api from './api';

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
  filter_columns?: string[] | null;
  normalize?: boolean;
}

class DatasetService {
  /**
   * Upload a dataset file
   */
  async uploadDataset(file: File): Promise<Dataset> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post<Dataset>('/api/datasets/upload', formData);
    
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
