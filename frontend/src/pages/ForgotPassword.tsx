import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import authService from '../services/auth';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await authService.forgotPassword({ email });
      setSuccess('Password reset instructions have been sent to your email.');
      setEmail('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-shell flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">DataLens</h1>
          <p className="text-slate-600">Reset your password</p>
        </div>

        {/* Forgot Password Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="surface-pane p-7 sm:p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Forgot Password</h2>
          <p className="text-slate-600 text-sm mb-6">
            Enter your email address and we'll send you instructions to reset your password.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? 'Sending...' : 'Send Reset Instructions'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <Link
              to="/login"
              className="block text-sm text-sky-700 hover:text-sky-800 font-medium"
            >
              ← Back to Sign In
            </Link>
            <p className="text-sm text-slate-600">
              Don't have an account?{' '}
              <Link to="/signup" className="text-sky-700 hover:text-sky-800 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </motion.div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-slate-500">
          Need help? Contact support@datalens.example.com
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
