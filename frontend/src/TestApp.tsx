function TestApp() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl p-12 max-w-md">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">DataLens</h1>
        <p className="text-lg text-gray-600 mb-6">Dataset Analysis & Preparation Platform</p>
        <div className="space-y-3">
          <div className="bg-blue-100 border border-blue-300 text-blue-800 px-4 py-3 rounded-lg">
            ✅ React is working
          </div>
          <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-lg">
            ✅ Tailwind CSS is working
          </div>
          <div className="bg-purple-100 border border-purple-300 text-purple-800 px-4 py-3 rounded-lg">
            ✅ Vite dev server is running
          </div>
        </div>
        <button className="mt-6 w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
          Everything is working!
        </button>
      </div>
    </div>
  );
}

export default TestApp;
