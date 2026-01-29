import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Performance monitoring
import { reportWebVitals } from './utils/reportWebVitals';

// Error reporting (optional - can be configured with services like Sentry)
// import * as Sentry from '@sentry/react';

// Initialize error reporting if configured
// if (process.env.REACT_APP_SENTRY_DSN) {
//   Sentry.init({
//     dsn: process.env.REACT_APP_SENTRY_DSN,
//     environment: process.env.NODE_ENV,
//     integrations: [
//       new Sentry.BrowserTracing(),
//     ],
//     tracesSampleRate: 0.1,
//   });
// }

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Performance monitoring
reportWebVitals((metric) => {
  // Log performance metrics
  console.log('Web Vitals:', metric);
  
  // Send to analytics service if configured
  // if (process.env.REACT_APP_ANALYTICS_ID) {
  //   // Send to Google Analytics, etc.
  // }
});