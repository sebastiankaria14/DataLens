import React from 'react';
import { motion } from 'framer-motion';

interface ActionButtonsProps {
  onExploreClick: () => void;
  onChatClick: () => void;
  disabled?: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ onExploreClick, onChatClick, disabled = false }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="grid grid-cols-1 md:grid-cols-2 gap-6"
    >
      <motion.button
        whileHover={{ scale: disabled ? 1 : 1.02, y: disabled ? 0 : -2 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        onClick={onExploreClick}
        disabled={disabled}
        className={`group relative overflow-hidden rounded-2xl p-8 text-left shadow-lg transition-all duration-300 ${
          disabled
            ? 'bg-gray-100 cursor-not-allowed opacity-60'
            : 'bg-gradient-to-br from-sky-700 to-sky-800 hover:shadow-2xl cursor-pointer'
        }`}
      >
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              disabled ? 'bg-gray-300' : 'bg-white/20 backdrop-blur-sm'
            }`}>
              <svg className={`w-6 h-6 ${disabled ? 'text-gray-500' : 'text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className={`text-2xl font-bold ${disabled ? 'text-gray-600' : 'text-white'}`}>Explore & Visualize</h3>
          </div>
          <p className={`text-sm ${disabled ? 'text-gray-500' : 'text-blue-100'}`}>
            Interactive charts and column distributions. Analyze patterns with histogram, box plots, and bar charts.
          </p>
          <div className={`mt-4 inline-flex items-center space-x-2 text-sm font-medium ${
            disabled ? 'text-gray-500' : 'text-white'
          }`}>
            <span>Open Workspace</span>
            <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        {!disabled && (
          <div className="absolute inset-0 bg-gradient-to-br from-sky-300/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}
      </motion.button>

      <motion.button
        whileHover={{ scale: disabled ? 1 : 1.02, y: disabled ? 0 : -2 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        onClick={onChatClick}
        disabled={disabled}
        className={`group relative overflow-hidden rounded-2xl p-8 text-left shadow-lg transition-all duration-300 ${
          disabled
            ? 'bg-gray-100 cursor-not-allowed opacity-60'
            : 'bg-gradient-to-br from-slate-800 to-slate-900 hover:shadow-2xl cursor-pointer'
        }`}
      >
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              disabled ? 'bg-gray-300' : 'bg-white/20 backdrop-blur-sm'
            }`}>
              <svg className={`w-6 h-6 ${disabled ? 'text-gray-500' : 'text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className={`text-2xl font-bold ${disabled ? 'text-gray-600' : 'text-white'}`}>Chat With Dataset</h3>
          </div>
          <p className={`text-sm ${disabled ? 'text-gray-500' : 'text-slate-300'}`}>
            Ask questions about your data. Get instant insights, recommendations, and ML guidance.
          </p>
          <div className={`mt-4 inline-flex items-center space-x-2 text-sm font-medium ${
            disabled ? 'text-gray-500' : 'text-white'
          }`}>
            <span>Start Conversation</span>
            <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        {!disabled && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}
      </motion.button>
    </motion.div>
  );
};

export default ActionButtons;
