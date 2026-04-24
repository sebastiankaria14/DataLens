import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="page-shell">
      <nav className="app-navbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2.5 reveal-fade">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-900 shadow-md">
                <span className="text-white font-bold text-sm tracking-tight">DL</span>
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">DataLens</span>
            </div>
            <div className="flex items-center gap-3 reveal-fade">
              <Link to="/login" className="btn-ghost">
                Sign In
              </Link>
              <Link to="/signup" className="btn-primary">
                Start Free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 space-y-12">
        <section className="surface-pane p-8 md:p-10 lg:p-14 reveal-up">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 text-sky-800 px-3 py-1 text-xs font-semibold ring-1 ring-sky-100 mb-5">
                Production-grade data preparation platform
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight">
                Turn raw files into
                <span className="block text-sky-800">ML-ready datasets</span>
              </h1>
              <p className="mt-5 text-base md:text-lg text-slate-600 max-w-2xl">
                DataLens gives teams a reliable workflow to upload, profile, clean, and export high-quality datasets without manual wrangling.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/signup" className="btn-primary px-6">
                  Create Account
                </Link>
                <Link to="/login" className="btn-secondary px-6">
                  Sign In
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {[
                { label: 'Upload formats', value: 'CSV, XLSX, JSON' },
                { label: 'Profiling engine', value: 'DuckDB + Parquet' },
                { label: 'Cleaning runtime', value: 'Polars native' },
                { label: 'Exports', value: 'CSV, Parquet, Excel' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{item.label}</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="reveal-up" style={{ animationDelay: '120ms' }}>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-6">Everything your data team needs</h2>
          <div className="grid md:grid-cols-3 gap-5">
            <article className="card">
              <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
              <h3 className="text-lg font-semibold text-slate-900">Reliable ingestion</h3>
              <p className="text-sm text-slate-600 mt-2">Large file uploads with robust validation and background processing.</p>
            </article>

            <article className="card">
              <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
              <h3 className="text-lg font-semibold text-slate-900">Deep profiling</h3>
              <p className="text-sm text-slate-600 mt-2">Schema detection, quality scoring, missing analysis, and imbalance signals.</p>
            </article>

            <article className="card">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
              <h3 className="text-lg font-semibold text-slate-900">Guided cleaning</h3>
              <p className="text-sm text-slate-600 mt-2">Apply deterministic cleaning and ML preparation workflows with confidence.</p>
            </article>
          </div>
        </section>

        <section className="surface-pane p-7 md:p-10 reveal-up" style={{ animationDelay: '200ms' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">From raw data to ready pipelines</h2>
              <p className="mt-2 text-slate-600">Move through upload, profiling, cleaning, and export in one connected workflow.</p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold text-slate-600">
              {['Upload', 'Profile', 'Clean', 'Export'].map((step, index) => (
                <div key={step} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] text-slate-400">0{index + 1}</p>
                  <p className="mt-0.5">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-sky-900 rounded-2xl px-6 py-10 md:px-10 md:py-12 reveal-up" style={{ animationDelay: '280ms' }}>
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold text-white tracking-tight">Ready to modernize your dataset workflow?</h2>
            <p className="mt-3 text-sky-100">
              Create your workspace and start preparing reproducible, high-quality datasets for model development.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/signup" className="bg-white text-sky-900 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-100 transition-colors">
                Get Started
              </Link>
              <Link to="/login" className="px-5 py-2.5 rounded-xl font-semibold border border-sky-200/40 text-white hover:bg-white/10 transition-colors">
                Sign In
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 bg-white/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-slate-500 flex items-center justify-between">
          <p>© 2026 DataLens</p>
          <p>Built for modern ML data engineering teams</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
