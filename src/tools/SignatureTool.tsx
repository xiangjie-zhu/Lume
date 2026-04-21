import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { PenTool, Download, FilePlus, Loader2, Eraser } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { triggerDownload } from '../lib/utils';

export default function SignatureTool() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetPage, setTargetPage] = useState<number>(1);
  const [maxPages, setMaxPages] = useState<number>(1);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const handleApplySignature = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty() || !file) {
      alert("Please upload a PDF and draw a signature.");
      return;
    }
    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      const sigDataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      const sigImageBytes = await fetch(sigDataUrl).then(res => res.arrayBuffer());
      const pngImage = await pdfDoc.embedPng(sigImageBytes);
      
      const pages = pdfDoc.getPages();
      const pageIndex = Math.min(Math.max(1, targetPage), pages.length) - 1;
      const targetPageObj = pages[pageIndex];
      const { width, height } = targetPageObj.getSize();
      
      const pngDims = pngImage.scale(0.5);
      
      targetPageObj.drawImage(pngImage, {
        x: 50,
        y: 50, // Bottom-left padding
        width: pngDims.width,
        height: pngDims.height,
      });

      const pdfBytes = await pdfDoc.save();
      triggerDownload(pdfBytes, `signed-${file.name}`);
    } catch (error) {
      console.error(error);
      alert('Error applying signature.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col pt-10 px-12 pb-8 bg-natural-bg">
      <div className="mb-10">
        <h1 className="font-serif text-3xl mb-3 text-natural-text mt-2">Sign Document</h1>
        <p className="text-natural-dim text-sm">Draw your signature and append it to a document.</p>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-natural-border shadow-[0_4px_12px_rgba(0,0,0,0.02)] p-6 flex flex-col">
            <h3 className="text-[13px] font-medium text-natural-dim uppercase tracking-wide mb-4">1. Select Document</h3>
            {!file ? (
              <label className="flex-1 min-h-[120px] flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-natural-border hover:border-natural-accent bg-natural-bg/50 rounded-xl transition-colors">
                <FilePlus className="w-6 h-6 text-natural-dim mb-2" />
                <span className="text-sm text-natural-text font-medium">Browse PDF</span>
                <input type="file" accept="application/pdf" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                  if (f) {
                    try {
                      const ab = await f.arrayBuffer();
                      const doc = await PDFDocument.load(ab);
                      setMaxPages(doc.getPageCount());
                      setTargetPage(1);
                    } catch(err) { console.error(err); }
                  }
                }} />
              </label>
            ) : (
              <div className="flex items-center justify-between p-4 bg-natural-bg rounded-xl border border-natural-border">
                <span className="font-medium text-sm truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-xs text-red-500 hover:underline">Change</button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-natural-border shadow-[0_4px_12px_rgba(0,0,0,0.02)] p-6 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-medium text-natural-dim uppercase tracking-wide">2. Draw Signature</h3>
              <button onClick={clearSignature} className="text-xs text-natural-dim hover:text-natural-text flex items-center">
                <Eraser className="w-3 h-3 mr-1" /> Clear
              </button>
            </div>
            
            <div className="border border-natural-border rounded-xl bg-gray-50 flex-1 relative overflow-hidden">
              <SignatureCanvas 
                ref={sigCanvas} 
                canvasProps={{ className: 'w-full h-full min-h-[200px] cursor-crosshair' }} 
                penColor="#2C2C26"
              />
              <div className="absolute bottom-4 left-0 w-full flex justify-center pointer-events-none">
                <div className="w-3/4 max-w-sm border-t-2 border-dashed border-gray-300"></div>
              </div>
            </div>
            <p className="text-xs text-center text-natural-dim mt-3">Sign above the line</p>
          </div>
        </div>

        <div className="w-full lg:w-72 flex flex-col gap-4">
          <div className="bg-white p-6 rounded-2xl border border-natural-border shadow-[0_4px_12px_rgba(0,0,0,0.02)] h-full flex flex-col">
            <h3 className="text-[13px] font-medium text-natural-dim uppercase tracking-wide mb-4">3. Finalize</h3>
            <p className="text-sm text-natural-text mb-6">The signature will be appended to the bottom-left corner of the selected page.</p>
            
            <div className="mb-6">
              <label className="block text-xs font-medium text-natural-dim uppercase tracking-wide mb-2">Target Page</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  min={1} 
                  max={maxPages}
                  value={targetPage}
                  onChange={(e) => setTargetPage(parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-2 border border-natural-border rounded-lg text-sm outline-none focus:border-natural-accent"
                  disabled={!file}
                />
                <span className="text-sm text-natural-dim">of {maxPages}</span>
              </div>
            </div>
            
            <div className="mt-auto">
              <button
                onClick={handleApplySignature}
                disabled={!file || isProcessing}
                className={`w-full flex items-center justify-center py-3.5 rounded-xl text-sm font-medium text-white shadow-sm transition-all
                  ${!file 
                    ? 'bg-natural-dim/40 cursor-not-allowed text-natural-text/50' 
                    : 'bg-natural-accent hover:opacity-90 active:scale-[0.99] shadow-[0_4px_12px_rgba(90,90,64,0.3)]'
                  }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <PenTool className="w-4 h-4 mr-2" />
                    Sign Document
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
