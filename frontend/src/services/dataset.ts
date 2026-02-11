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
