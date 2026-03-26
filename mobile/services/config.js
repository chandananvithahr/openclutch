// Central backend URL config
// DEV  — adb reverse tcp:3000 tcp:3000 → use http://localhost:3000
// PROD — set EXPO_PUBLIC_BACKEND_URL=https://your-app.railway.app in .env
const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

// Bootstrap secret — must match AUTH_BOOTSTRAP_SECRET on the backend
// In production, this will be replaced by proper auth (Supabase Auth / OTP)
const AUTH_BOOTSTRAP_SECRET =
  process.env.EXPO_PUBLIC_AUTH_SECRET || '61a31adf3d4d50e55226d0c86e2f7720f6db306dfb430a2029e7019e68e99997';

export default BACKEND_URL;
export { AUTH_BOOTSTRAP_SECRET };
