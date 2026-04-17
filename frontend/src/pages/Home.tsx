import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">DL</span>
              </div>
              <span className="text-xl font-bold text-gray-900">DataLens</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-gray-700 hover:text-primary-600 font-medium">
                Sign In
              </Link>
              <Link to="/signup" className="btn-primary">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Prepare ML Datasets
            <span className="block text-primary-600 mt-2">Like a Pro</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Upload, profile, clean, and export production-ready datasets for machine learning.
            Built with DuckDB, Polars, and modern data engineering best practices.
          </p>
          <div className="flex justify-center space-x-4">
            <Link to="/signup" className="btn-primary text-lg px-8 py-3">
              Start Free
            </Link>
            <Link to="/login" className="btn-secondary text-lg px-8 py-3">
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Everything You Need for ML Data Prep
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="card text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Fast Upload</h3>
            <p className="text-gray-600">
              Upload CSV, Excel, or JSON files. Handle large datasets efficiently with chunked processing.
            </p>
          </div>

          <div className="card text-center">
            <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Smart Profiling</h3>
            <p className="text-gray-600">
              Automatic data profiling with DuckDB. Detect schema, missing values, and distributions instantly.
            </p>
          </div>

          <div className="card text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Advanced Cleaning</h3>
            <p className="text-gray-600">
              Remove duplicates, handle outliers, filter categories, and balance datasets for ML training.
            </p>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Upload Dataset</h3>
              <p className="text-sm text-gray-600">
                Drag and drop your raw dataset files (CSV, Excel, JSON)
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Auto Profile</h3>
              <p className="text-sm text-gray-600">
                Get instant insights on data quality and statistics
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Clean & Filter</h3>
              <p className="text-sm text-gray-600">
                Apply transformation rules and cleaning operations
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Export ML-Ready</h3>
              <p className="text-sm text-gray-600">
                Download optimized datasets ready for training
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="card bg-gradient-to-r from-primary-50 to-purple-50">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            Built with Production-Grade Tools
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-primary-600 mb-1">DuckDB</div>
              <div className="text-sm text-gray-600">Analytics Engine</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-600 mb-1">Polars</div>
              <div className="text-sm text-gray-600">Fast DataFrames</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-600 mb-1">PyArrow</div>
              <div className="text-sm text-gray-600">Columnar Data</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-600 mb-1">FastAPI</div>
              <div className="text-sm text-gray-600">High Performance</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-primary-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Prepare Your ML Datasets?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join data scientists and ML engineers using DataLens
          </p>
          <Link to="/signup" className="bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block">
            Get Started for Free
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2026 DataLens. Built for ML Engineers.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
