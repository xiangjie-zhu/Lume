import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Download, 
  FilePlus,
  Loader2,
  X
} from 'lucide-react';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { triggerDownload, formatBytes, LocalFile } from '../lib/utils';

export function MergeTool() {
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = (newFiles: File[]) => {
    const pdfFiles = newFiles.filter(f => f.type === 'application/pdf');
    const localFiles = pdfFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      previewUrl: URL.createObjectURL(file)
    }));
    setFiles(prev => [...prev, ...localFiles]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    setIsProcessing(true);
    
    try {
      const mergedPdf = await PDFDocument.create();
      
      for (const { file } of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }
      
      const pdfBytes = await mergedPdf.save();
      triggerDownload(pdfBytes, 'merged-document.pdf');
    } catch (error) {
      console.error("Error merging PDFs:", error);
      alert("Failed to merge PDFs. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col pt-10 px-12 pb-8 bg-natural-bg">
      <div className="mb-10">
        <h1 className="font-serif text-3xl mb-3 text-natural-text mt-2">Merge PDFs</h1>
        <p className="text-natural-dim text-sm">Combine multiple PDF documents into one single file.</p>
      </div>

      <div className="flex-1 flex flex-col max-h-full min-h-0">
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
          className={`flex-shrink-0 w-full rounded-2xl border border-dashed transition-all duration-300 flex flex-col items-center justify-center bg-white/40
            ${isDragOver ? 'border-natural-accent bg-natural-accent/5 scale-[1.01]' : 'border-natural-border hover:border-natural-accent/40'}
            ${files.length > 0 ? 'h-32 mb-6' : 'flex-1 mb-8'}`}
        >
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className={`p-4 rounded-full mb-4 ${isDragOver ? 'bg-natural-accent/10 text-natural-accent' : 'bg-black/5 text-natural-dim'}`}>
              <FilePlus className="w-8 h-8" />
            </div>
            <p className="text-natural-text font-medium mb-1">
              Drag &amp; drop PDF files here
            </p>
            <p className="text-natural-dim text-[13px] mb-4">or</p>
            <label className="cursor-pointer bg-white px-5 py-2.5 rounded-lg border border-natural-border shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-sm font-medium text-natural-text hover:bg-natural-bg transition-colors">
              Browse Files
              <input 
                type="file" 
                multiple 
                accept="application/pdf" 
                className="hidden" 
                onChange={(e) => handleFiles(Array.from(e.target.files || []))}
              />
            </label>
          </div>
        </div>

        {files.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-col bg-white rounded-2xl border border-natural-border shadow-[0_10px_30px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="px-6 py-4 border-b border-natural-border flex items-center justify-between bg-natural-sidebar/30">
              <span className="text-[13px] font-medium text-natural-text">{files.length} document{files.length !== 1 ? 's' : ''} added</span>
              <button 
                onClick={() => setFiles([])}
                className="text-xs text-natural-dim hover:text-natural-accent transition-colors flex items-center"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Clear All
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-white">
              <div className="space-y-3">
                <AnimatePresence>
                  {files.map((file, index) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-between p-4 bg-white rounded-xl border border-natural-border hover:border-natural-accent/30 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:-translate-y-0.5 transition-all group"
                    >
                      <div className="flex items-center space-x-4 overflow-hidden">
                        <div className="w-10 h-10 rounded-lg bg-natural-sidebar flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-natural-accent" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-[13px] font-medium text-natural-text truncate">{file.file.name}</p>
                          <p className="text-[11px] text-natural-dim mt-0.5">{formatBytes(file.file.size)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end min-w-[80px]">
                        <span className="text-[11px] text-natural-dim mr-3 py-1 px-2 border border-natural-border bg-white rounded-md">
                          #{index + 1}
                        </span>
                        <button
                          onClick={() => removeFile(file.id)}
                          className="p-1.5 text-natural-dim hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-natural-border">
              <button
                onClick={handleMerge}
                disabled={files.length < 2 || isProcessing}
                className={`w-full flex items-center justify-center py-3.5 rounded-xl text-sm font-medium text-white shadow-sm transition-all
                  ${files.length < 2 
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
                    <MergeIcon className="w-4 h-4 mr-2" />
                    Merge Document{files.length > 2 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MergeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m8 6 4-4 4 4"/><path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22"/><path d="m20 22-5-5"/>
    </svg>
  );
}

export function WatermarkTool() {
  const [file, setFile] = useState<LocalFile | null>(null);
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = (uploadedFile: File | undefined) => {
    if (!uploadedFile || uploadedFile.type !== 'application/pdf') return;
    setFile({
      id: Math.random().toString(36).substring(7),
      file: uploadedFile,
      previewUrl: URL.createObjectURL(uploadedFile)
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleWatermark = async () => {
    if (!file || !watermarkText) return;
    setIsProcessing(true);
    
    try {
      const arrayBuffer = await file.file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      
      for (const page of pages) {
        const { width, height } = page.getSize();
        page.drawText(watermarkText, {
          x: width / 4,
          y: height / 4,
          size: 60,
          color: rgb(0.5, 0.5, 0.5),
          opacity: 0.3,
          rotate: degrees(45),
        });
      }
      
      const pdfBytes = await pdfDoc.save();
      triggerDownload(pdfBytes, `watermarked-${file.file.name}`);
    } catch (error) {
      console.error("Error adding watermark:", error);
      alert("Failed to process PDF. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col pt-10 px-12 pb-8 bg-natural-bg">
      <div className="mb-10">
        <h1 className="font-serif text-3xl mb-3 text-natural-text mt-2">Watermark</h1>
        <p className="text-natural-dim text-sm">Add text watermarks to your PDF documents.</p>
      </div>

      <div className="flex-1 flex flex-col max-h-full min-h-0 space-y-6">
        {!file ? (
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            className={`flex-1 w-full rounded-2xl border border-dashed transition-all duration-300 flex flex-col items-center justify-center bg-white/40
              ${isDragOver ? 'border-natural-accent bg-natural-accent/5 scale-[1.01]' : 'border-natural-border hover:border-natural-accent/40'}`}
          >
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className={`p-4 rounded-full mb-4 ${isDragOver ? 'bg-natural-accent/10 text-natural-accent' : 'bg-black/5 text-natural-dim'}`}>
                <FilePlus className="w-8 h-8" />
              </div>
              <p className="text-natural-text font-medium mb-1">
                Drag &amp; drop a PDF file here
              </p>
              <p className="text-natural-dim text-[13px] mb-4">or</p>
              <label className="cursor-pointer bg-white px-5 py-2.5 rounded-lg border border-natural-border shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-sm font-medium text-natural-text hover:bg-natural-bg transition-colors">
                Browse Files
                <input 
                  type="file" 
                  accept="application/pdf" 
                  className="hidden" 
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col space-y-6">
            <div className="p-5 bg-white rounded-2xl border border-natural-border shadow-[0_4px_12px_rgba(0,0,0,0.02)] flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-natural-sidebar flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-natural-accent" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-natural-text">{file.file.name}</p>
                  <p className="text-[12px] text-natural-dim mt-0.5">{formatBytes(file.file.size)}</p>
                </div>
              </div>
              <button 
                onClick={() => setFile(null)}
                className="p-2 text-natural-dim hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-natural-border shadow-[0_4px_12px_rgba(0,0,0,0.02)] p-8 flex flex-col flex-1">
              <h3 className="text-[15px] font-medium text-natural-text mb-6">Configuration</h3>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-[13px] font-medium text-natural-dim mb-2 uppercase tracking-wide">Watermark Text</label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="Enter watermark text..."
                    className="w-full px-4 py-3.5 bg-natural-bg border border-natural-border rounded-xl focus:outline-none focus:ring-1 focus:ring-natural-accent focus:border-natural-accent transition-all text-[14px] font-medium text-natural-text"
                  />
                </div>
              </div>

              <div className="mt-auto">
                <button
                  onClick={handleWatermark}
                  disabled={!watermarkText || isProcessing}
                  className={`w-full flex items-center justify-center py-3.5 rounded-xl text-sm font-medium text-white shadow-sm transition-all
                    ${!watermarkText 
                      ? 'bg-natural-dim/40 cursor-not-allowed text-natural-text/50' 
                      : 'bg-natural-accent hover:opacity-90 active:scale-[0.99] shadow-[0_4px_12px_rgba(90,90,64,0.3)]'
                    }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Applying Watermark...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Apply & Download
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
