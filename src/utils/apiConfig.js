/**
 * Novaira V2 Admin - Unified API Gateway Client
 * Automatically connects to high-speed local backend (port 5000) during local testing,
 * and seamlessly routes to production Render backend when hosted.
 */

export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:5000';
    }
  }
  return import.meta.env.VITE_API_URL || 'https://admin-v2-backend.onrender.com';
};

export const ADMIN_API_KEY = 'Novaira002@#';

export const getApiHeaders = (extraHeaders = {}) => ({
  'Content-Type': 'application/json',
  'x-admin-key': ADMIN_API_KEY,
  'Authorization': `Bearer ${ADMIN_API_KEY}`,
  ...extraHeaders
});
