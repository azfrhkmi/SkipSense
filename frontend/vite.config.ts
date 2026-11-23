import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Check if mkcert certificates exist in ../certificates
const certDir = path.resolve(__dirname, '../certificates');
const certFile = path.join(certDir, 'cert.pem');
const keyFile = path.join(certDir, 'key.pem');

let httpsConfig: { cert: Buffer; key: Buffer } | undefined = undefined;
if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
  httpsConfig = {
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: httpsConfig,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
});

