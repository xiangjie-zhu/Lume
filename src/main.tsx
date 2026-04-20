import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { pdfjs } from 'react-pdf';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
