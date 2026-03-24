// Central backend URL config
// DEV  — adb reverse tcp:3000 tcp:3000 → use http://localhost:3000
// PROD — set EXPO_PUBLIC_BACKEND_URL=https://your-app.railway.app in .env
const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export default BACKEND_URL;
