import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] bg-slate-900 flex-col justify-between p-12 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">DataLens</span>
        </div>
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">ML dataset preparation,<br />built for engineers.</h2>
            <p className="mt-4 text-slate-400 text-sm leading-relaxed max-w-sm">Profile, clean, and export production-ready datasets without writing a single line of data-wrangling code.</p>
          </div>
          <div className="space-y-4">
            {([['Zero-copy profiling','DuckDB queries files directly from disk'],['Smart auto-cleaning','Fills, deduplicates, and normalises automatically'],['ML-ready exports','Parquet, CSV, and train/test splits on demand']] as const).map(([l,s])=>(
              <div key={l} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5"><div className="w-2 h-2 rounded-full bg-indigo-400"/></div>
                <div><p className="text-sm font-medium text-slate-200">{l}</p><p className="text-xs text-slate-500">{s}</p></div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-slate-600">© 2026 DataLens</p>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-slate-50">
        <motion.div initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.4,ease:'easeOut' }} className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/></svg></div>
            <span className="font-semibold text-slate-900">DataLens</span>
          </div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
            <p className="text-sm text-slate-500 mt-1">Welcome back. Enter your credentials to continue.</p>
          </div>
          {error && (
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">{error}</motion.div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input id="email" name="email" type="email" autoComplete="username" required value={formData.email} onChange={handleChange} className="input-field" placeholder="you@company.com" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
                <Link to="/forgot-password" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Forgot password?</Link>
              </div>
              <input id="password" name="password" type="password" autoComplete="current-password" required value={formData.password} onChange={handleChange} className="input-field" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 mt-2">
              {isLoading ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Signing in…</>) : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">No account?{' '}<Link to="/signup" className="text-indigo-600 hover:text-indigo-700 font-medium">Create one</Link></p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
