# DataForge Frontend

React + TypeScript frontend for the DataForge ML Dataset Preparation Platform.

## Features

✅ **Secure Authentication System**
- JWT-based login/signup
- Password reset flow
- Protected routes
- Auto-logout on token expiration

✅ **Modern UI/UX**
- Tailwind CSS styling
- Responsive design
- Clean dashboard interface
- Drag-and-drop file upload

✅ **Type-Safe Architecture**
- Full TypeScript coverage
- Proper type definitions
- Context-based state management

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router v6
- Axios
- Recharts

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── components/      # Reusable UI components
│   ├── Navbar.tsx
│   └── ProtectedRoute.tsx
├── pages/          # Page components
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── ForgotPassword.tsx
│   ├── Dashboard.tsx
│   └── UploadDataset.tsx
├── services/       # API services
│   ├── api.ts
│   └── auth.ts
├── context/        # React context
│   └── AuthContext.tsx
├── App.tsx         # Main app with routing
└── main.tsx        # Entry point
```

## Available Routes

- `/login` - Login page
- `/signup` - Registration page
- `/forgot-password` - Password reset
- `/dashboard` - Main dashboard (protected)
- `/upload` - Upload dataset (protected)

## Environment Variables

Create `.env` file:

```env
VITE_API_URL=http://localhost:8000
```

## Development

The app is configured to work with a FastAPI backend running on port 8000.

### API Integration

All API calls go through the centralized Axios instance in `services/api.ts`:
- Automatic JWT token attachment
- Response interceptors for error handling
- Auto-redirect on 401 errors

### Authentication Flow

1. User logs in → receives JWT token
2. Token stored in localStorage
3. Token attached to all API requests
4. Protected routes check authentication
5. Expired tokens trigger auto-logout

## Production Build

```bash
npm run build
npm run preview  # Preview production build
```

## Code Quality

- ESLint configured
- TypeScript strict mode
- Component-level comments
- Consistent code style
