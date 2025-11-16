import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { initWebVitals } from "./lib/webVitals";

// Register Service Worker only in production
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const swUrl = new URL('/sw.js', import.meta.url);
  
  if (swUrl.protocol === 'https:' || location.hostname === 'localhost') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(swUrl)
        .then((registration) => {
          console.log('ServiceWorker registration successful:', registration);
        })
        .catch((error) => {
          console.warn('ServiceWorker registration failed:', error);
        });
    });
  }
}

// Initialize Web Vitals tracking
if (typeof window !== 'undefined') {
  initWebVitals();
}

createRoot(document.getElementById("root")!).render(<App />);
