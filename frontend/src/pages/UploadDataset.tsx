import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import datasetService from '../services/dataset';

const UploadDataset: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [uploadedDatasetId, setUploadedDatasetId] = useState<number | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls|json)$/i)) {
      setError('Invalid file type. Please upload CSV, Excel, or JSON files.');
      return;
    }
    
    setSelectedFile(file);
    setError('');
    setSuccess('');
    setUploadedDatasetId(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    setError('');
    setSuccess('');
    setUploadedDatasetId(null);
    
    try {
      // Upload to backend with progress tracking
      const dataset = await datasetService.uploadDataset(selectedFile, (progress) => {
        setUploadProgress(progress);
      });

      setSuccess('Uploaded successfully. Profiling has started in the background.');
      setUploadedDatasetId(dataset.id);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError('Your session expired. Please sign in again, then retry the upload.');
      } else if (err.code === 'ECONNABORTED') {
        setError('Upload timed out. Please try again or use a smaller file.');
      } else if (err.message === 'Network Error') {
        setError('Network error. Please check if the backend server is running.');
      } else {
        setError(err.response?.data?.detail || 'Upload failed. Please try again.');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button onClick={() => navigate('/')} className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">DL</span>
                </div>
                <span className="text-xl font-bold text-slate-900">DataLens</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Upload Dataset</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload your raw dataset for profiling and cleaning
          </p>
        </div>

        {/* Upload Card */}
        <div className="card">
          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
              dragActive
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <svg
              className="mx-auto h-10 w-10 text-slate-300"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="mt-4">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-indigo-600 hover:text-indigo-700 font-medium">
                  Upload a file
                </span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  accept=".csv,.xlsx,.xls,.json"
                  onChange={handleFileInputChange}
                />
              </label>
              <span className="text-gray-600"> or drag and drop</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              CSV, Excel, or JSON files up to 500MB
            </p>
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && uploadProgress > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div 
                  className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mt-4">
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm">
                {success}
              </div>

              {uploadedDatasetId && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => navigate(`/datasets/${uploadedDatasetId}`)}
                    className="btn-primary"
                  >
                    View Profiling
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Upload Button */}
          {!success && (
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="btn-primary"
              >
                {isUploading ? 'Uploading...' : 'Upload & Profile'}
              </button>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-6 card bg-slate-50 border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">What happens next?</h3>
          <ul className="space-y-2">
            {[
              'Your file is converted to Parquet for efficient processing',
              'DuckDB automatically profiles schema, statistics, and distributions',
              'Missing values, outliers, and categorical columns are detected',
              'Large files are processed in chunks — no memory issues',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-xs text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-1" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UploadDataset;
