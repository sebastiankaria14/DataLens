# DataForge - ML Dataset Preparation Platform

A production-grade web application for preparing and cleaning datasets for machine learning workflows.

## 🚀 Features

- **Secure Authentication**: JWT-based signup, login, and password reset
- **Dataset Upload**: Support for CSV, Excel, and JSON files
- **Intelligent Profiling**: Automatic schema detection and statistics using DuckDB
- **Efficient Processing**: Chunked processing for large datasets without memory issues
- **Clean UI**: Modern, responsive interface built with Tailwind CSS
- **Type-Safe**: Full TypeScript implementation

## 📁 Project Structure

```
dataforge/
├── frontend/           # React + TypeScript frontend
│   ├── src/
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   ├── context/      # React context providers
│   │   ├── App.tsx       # Main app with routing
│   │   └── main.tsx      # Entry point
│   ├── public/
│   ├── .env              # Environment variables
│   └── package.json
└── backend/            # FastAPI backend (coming next)
```

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Recharts** - Data visualization

### Backend (Next Phase)
- **FastAPI** - High-performance Python API framework
- **DuckDB** - Embedded analytics engine
- **Polars** - Fast DataFrame library
- **PyArrow** - Columnar data processing
- **JWT** - Token-based authentication
- **Pydantic** - Data validation

## 🏃‍♂️ Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+ (for backend, coming next)

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open browser**:
   Navigate to `http://localhost:5173`

### Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:8000
```

## 📱 Available Pages

### Public Routes
- `/login` - User login
- `/signup` - New user registration
- `/forgot-password` - Password reset request

### Protected Routes (Require Authentication)
- `/dashboard` - Main dashboard with stats and quick actions
- `/upload` - Dataset upload interface

## 🔐 Authentication Flow

1. **Signup**: Users create an account with email, password, and full name
2. **Login**: Users authenticate and receive a JWT token
3. **Token Storage**: JWT stored in localStorage
4. **Auto-Logout**: Expired tokens trigger automatic redirect to login
5. **Protected Routes**: Unauthorized access redirects to login page

## 🎨 UI Components

### Custom Tailwind Classes
- `.btn-primary` - Primary action buttons
- `.btn-secondary` - Secondary action buttons
- `.input-field` - Form input fields
- `.card` - Card container with shadow

### Color Scheme
- Primary: Blue (#3b82f6)
- Background: Gray-50 (#f9fafb)
- Text: Gray-900 (#111827)

## 🧩 Component Architecture

### Context Providers
- **AuthProvider**: Manages global authentication state
  - User object
  - Login/Signup/Logout methods
  - Loading states

### Services
- **api.ts**: Axios instance with request/response interceptors
- **auth.ts**: Authentication API calls and token management

### Components
- **ProtectedRoute**: HOC for route protection
- **Navbar**: Navigation bar with user menu

## 📊 Planned Features (Backend Integration)

### Dataset Processing Pipeline
1. **Upload** → File saved to storage
2. **Convert** → CSV/Excel → Parquet
3. **Profile** → DuckDB statistical analysis
4. **Clean** → Apply transformation rules
5. **Export** → Download ML-ready dataset

### DuckDB Features
- Direct file querying (no data loading)
- Columnar execution
- Parallel processing
- Efficient aggregations

### Data Engineering Best Practices
- ✅ Chunked processing (no full data in memory)
- ✅ Early Parquet conversion
- ✅ Lazy execution
- ✅ Metadata caching
- ✅ Streaming exports

## 🔧 Development

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Type Checking
```bash
npm run type-check
```

## 🐛 Error Handling

- **401 Unauthorized**: Auto-logout and redirect to login
- **Network Errors**: User-friendly error messages
- **Form Validation**: Client-side validation before API calls
- **File Upload**: Type and size validation

## 📝 Code Quality

- **TypeScript**: Strict mode enabled
- **ESLint**: Code linting
- **Component Comments**: JSDoc-style documentation
- **Consistent Naming**: Camel case for variables, Pascal case for components

## 🚀 Next Steps

### Backend Development
1. Set up FastAPI project structure
2. Implement authentication endpoints
3. Create dataset upload handler
4. Build DuckDB profiling service
5. Implement data cleaning pipeline
6. Add export functionality

### Additional Features
- Dataset list view
- Real-time profiling progress
- Advanced filtering options
- Data visualization charts
- Export format selection
- User settings page

## 📄 License

This project is built for educational and portfolio purposes.

## 👨‍💻 Author

Built as a production-grade demonstration of full-stack and data engineering skills.

---

**Status**: ✅ Frontend Complete | ⏳ Backend In Progress
