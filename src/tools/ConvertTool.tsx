import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileImage, FilePlus, Download, Loader2, ArrowRight } from 'lucide-react';
import { triggerDownload, formatBytes } from '../lib/utils';
import { pdfjs } from 'react-pdf';

export default function ConvertTool() {
  const [mode, setMode] = useState<'img2pdf' | 'pdf2img' | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedImages, setExtractedImages] = useState<{ id: number, url: string }[]>([]);

  const handleImagesToPdf = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    try {
      const pdfDoc = await PDFDocument.create();
      for (const img of images) {
        const bytes = await img.arrayBuffer();
        let imageToEmbed;
        if (img.type === 'image/jpeg') {
          imageToEmbed = await pdfDoc.embedJpg(bytes);
        } else if (img.type === 'image/png') {
          imageToEmbed = await pdfDoc.embedPng(bytes);
        } else {
          continue; // Unsupported format for simplified local conversion
        }

        const { width, height } = imageToEmbed.scale(1);
        const page = pdfDoc.addPage([width, height]);
        page.drawImage(imageToEmbed, { x: 0, y: 0, width, height });
      }
      const pdfBytes = await pdfDoc.save();
      triggerDownload(pdfBytes, 'converted-images.pdf');
    } catch (e) {
      console.error(e);
      alert('Error creating PDF from images.');
    } finally {
      setIsProcessing(false);
    }
  };

  const extractPdfToImages = async () => {
    if (!pdfFile) return;
    setIsProcessing(true);
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const urls: { id: number, url: string }[] = [];

      // Extract first 10 pages max to prevent browser crush in preview
      const maxPages = Math.min(pdf.numPages, 10);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // High res
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        urls.push({ id: i, url: canvas.toDataURL('image/png') });
      }
      setExtractedImages(urls);
    } catch (e) {
      console.error(e);
      alert('Error extracting images.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mode) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <h2 className="text-3xl font-serif text-natural-text mb-8">Format Conversions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <button onClick={() => setMode('img2pdf')} className="bg-white p-8 rounded-2xl border border-natural-border shadow-sm hover:shadow-md hover:border-natural-accent/30 transition-all text-left group">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
              <FileImage className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-natural-text mb-2">Image to PDF</h3>
            <p className="text-natural-dim text-sm">Convert JPG/PNG images into a single PDF document.</p>
          </button>
          <button onClick={() => setMode('pdf2img')} className="bg-white p-8 rounded-2xl border border-natural-border shadow-sm hover:shadow-md hover:border-natural-accent/30 transition-all text-left group">
            <div className="w-12 h-12 bg-green-50 text-green-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
              <ArrowRight className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-natural-text mb-2">PDF to Image</h3>
            <p className="text-natural-dim text-sm">Extract high-quality pages from a PDF to PNG format.</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pt-10 px-12 pb-8 bg-natural-bg">
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => { setMode(null); setImages([]); setPdfFile(null); setExtractedImages([]); }} className="p-2 bg-white border border-natural-border rounded-lg hover:bg-black/5">
          <ArrowRight className="w-4 h-4 rotate-180" />
        </button>
        <div>
          <h1 className="font-serif text-2xl text-natural-text">{mode === 'img2pdf' ? 'Images to PDF' : 'Convert PDF to Images'}</h1>
        </div>
      </div>

      {mode === 'img2pdf' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-natural-border p-6 mb-4">
            {images.length === 0 ? (
              <label className="h-full flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-natural-border hover:border-natural-accent rounded-lg transition-colors">
                <FilePlus className="w-10 h-10 text-natural-dim mb-4" />
                <span className="text-natural-text font-medium">Select Images (JPG/PNG)</span>
                <input type="file" multiple accept="image/jpeg, image/png" className="hidden" onChange={(e) => setImages(Array.from(e.target.files || []))} />
              </label>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.map((img, idx) => (
                  <div key={idx} className="aspect-square relative rounded-lg border overflow-hidden bg-gray-50 flex items-center justify-center p-2 text-xs truncate">
                    {img.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button 
            disabled={images.length === 0 || isProcessing}
            onClick={handleImagesToPdf}
            className="w-full py-3.5 bg-natural-accent text-white font-medium rounded-xl shadow focus:outline-none hover:opacity-90 disabled:opacity-50 flex justify-center items-center"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Convert to PDF'}
          </button>
        </div>
      )}

      {mode === 'pdf2img' && (
        <div className="flex-1 flex flex-col min-h-0">
          {!pdfFile ? (
            <label className="flex-1 flex flex-col items-center justify-center bg-white cursor-pointer border border-natural-border hover:border-natural-accent rounded-xl transition-colors">
              <FilePlus className="w-10 h-10 text-natural-dim mb-4" />
              <span className="text-natural-text font-medium">Select PDF File</span>
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files && setPdfFile(e.target.files[0])} />
            </label>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="mb-4 flex items-center justify-between">
                <div className="font-medium truncate max-w-sm">{pdfFile.name}</div>
                <button 
                  onClick={extractPdfToImages}
                  disabled={isProcessing}
                  className="px-6 py-2 bg-natural-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Extract Images (Top 10 max)'}
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-natural-border p-6">
                <div className="grid grid-cols-2 gap-6">
                  {extractedImages.map(img => (
                    <div key={img.id} className="group relative border border-natural-border shadow-sm rounded-lg overflow-hidden bg-gray-50">
                      <img src={img.url} alt={`Page ${img.id}`} className="w-full h-auto" />
                      <a 
                        href={img.url} 
                        download={`page-${img.id}.png`}
                        className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-medium"
                      >
                        <Download className="w-8 h-8 mb-2" />
                        Download PNG
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
