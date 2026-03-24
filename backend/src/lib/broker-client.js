// Broker HTTP client — kiteconnectjs pattern
// Axios instance with interceptors: auth header injection, token expiry detection,
// unified error mapping, request timeout. Used by zerodha + angelone routes.

'use strict';

const axios = require('axios');
const { withRetry } = require('./retry');

// Error types matching Kite Connect taxonomy
const ERROR_TYPES = {
  TokenException: 'TOKEN_EXPIRED',
  NetworkException: 'NETWORK_ERROR',
  GeneralException: 'BROKER_ERROR',
  DataException: 'DATA_ERROR',
  OrderException: 'ORDER_ERROR',
};

function createBrokerClient({ baseURL, timeout = 10000, getAccessToken, onTokenExpiry, broker }) {
  const instance = axios.create({ baseURL, timeout });

  // Request interceptor — inject auth header (kiteconnectjs pattern)
  instance.interceptors.request.use(request => {
    const token = getAccessToken?.();
    if (token) {
      request.headers['Authorization'] = `token ${token}`;
    }
    return request;
  });

  // Response interceptor — unwrap data envelope + map errors (kiteconnectjs pattern)
  instance.interceptors.response.use(
    response => {
      const ct = response.headers['content-type'] || '';
      if (ct.includes('application/json')) {
        // Broker API error inside 2xx response
        if (response.data?.error_type) {
          const err = new Error(response.data.message || 'Broker error');
          err.code = ERROR_TYPES[response.data.error_type] || 'BROKER_ERROR';
          err.status = 400;
          throw err;
        }
        // Unwrap nested data envelope if present
        return response.data?.data ?? response.data;
      }
      return response.data;
    },
    error => {
      const err = new Error('Unknown broker error');
      err.status = error.response?.status || 500;

      if (error.response?.data?.error_type) {
        const type = error.response.data.error_type;
        err.message = error.response.data.message || type;
        err.code = ERROR_TYPES[type] || 'BROKER_ERROR';

        // Token expired → trigger refresh hook (kiteconnectjs session_expiry_hook)
        if (type === 'TokenException' && onTokenExpiry) {
          onTokenExpiry();
        }
      } else if (error.request) {
        err.message = `No response from ${broker} (${error.code})`;
        err.code = 'NETWORK_ERROR';
      } else {
        err.message = error.message;
        err.code = 'GENERAL_ERROR';
      }

      return Promise.reject(err);
    }
  );

  // Wrap calls with retry (skip retry on auth errors)
  const retryOptions = {
    maxRetries: 3,
    shouldRetry: err => err.code !== 'TOKEN_EXPIRED' && err.status !== 401,
  };

  return {
    get: (url, config) => withRetry(() => instance.get(url, config), retryOptions),
    post: (url, data, config) => withRetry(() => instance.post(url, data, config), retryOptions),
    put: (url, data, config) => withRetry(() => instance.put(url, data, config), retryOptions),
    delete: (url, config) => withRetry(() => instance.delete(url, config), retryOptions),
  };
}

module.exports = { createBrokerClient };
