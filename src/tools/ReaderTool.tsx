import React, { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { FileText, Loader2, ZoomIn, ZoomOut, Search, Moon, Sun, ChevronLeft, ChevronRight, Edit3, Underline as UnderlineIcon, Download, Undo2, Redo2, MessageSquare, PanelRightOpen, PanelRightClose, PanelLeftOpen, PanelLeftClose, Trash2, X, ChevronUp, ChevronDown, Image as ImageIcon, ChevronDown as DropdownIcon, Menu } from 'lucide-react';
import { motion } from 'motion/react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { toPng, toJpeg } from 'html-to-image';
import { triggerDownload } from '../lib/utils';
import { saveToHistory } from '../lib/storage';

interface Annotation {
  id: string;
  pageNumber: number;
  type: 'highlight' | 'underline' | 'note';
  color: { r: number; g: number; b: number };
  rects: { x: number; y: number; w: number; h: number }[];
  content?: string;
  timestamp: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  rects: { x: number; y: number; w: number; h: number }[];
  isSelection: boolean;
  pageNumber: number;
  editAnnotationId?: string;
  editAnnotationColor?: { r: number; g: number; b: number };
}

export default function ReaderTool({ 
  initialFile, 
  onFileLoaded 
}: { 
  initialFile?: File; 
  onFileLoaded?: (title: string, file?: File) => void 
}) {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [darkMode, setDarkMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [totalMatches, setTotalMatches] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  
  // Annotation state
  const [annotationColor, setAnnotationColor] = useState({ r: 0.984, g: 0.890, b: 0.631 }); // Default Soft Amber
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [showThumbnailsPanel, setShowThumbnailsPanel] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragState, setDragState] = useState<{ id: string; startX: number; startY: number; initialRect: { x: number; y: number; w: number; h: number } } | null>(null);

  React.useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setShowExportMenu(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  React.useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragState.startX) / scale;
      const dy = (e.clientY - dragState.startY) / scale;
      
      setAnnotations(prev => prev.map(ann => {
        if (ann.id !== dragState.id) return ann;
        return {
          ...ann,
          rects: [{
             ...ann.rects[0],
             x: dragState.initialRect.x + dx,
             y: dragState.initialRect.y + dy,
          }],
        };
      }));
    };

    const handleMouseUp = () => setDragState(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, scale]);

  // Watch search text to debounce and reset match counts
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchText]);

  // Observer to update page number based on scroll position
  React.useEffect(() => {
    if (!numPages) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
          const pageNum = parseInt(entry.target.getAttribute('data-page-number') || '1', 10);
          setPageNumber(pageNum);
        }
      });
    }, { threshold: 0.3 });

    const pageElements = document.querySelectorAll('.pdf-page-wrapper');
    pageElements.forEach(p => observer.observe(p));

    return () => observer.disconnect();
  }, [numPages, scale]);

  // Effect to scan for search highlights and update total matches
  React.useEffect(() => {
    if (!debouncedSearch) {
      setTotalMatches(0);
      setCurrentMatchIndex(0);
      return;
    }
    
    const container = document.getElementById('pdf-scroll-container');
    if (!container) return;

    let timeoutInfo: NodeJS.Timeout;
    const countMatches = () => {
      const marks = document.querySelectorAll('mark.pdf-search-mark');
      setTotalMatches(marks.length);
      if (marks.length > 0 && currentMatchIndex === 0) {
        setCurrentMatchIndex(1);
      }
    };

    // Keep checking DOM periodically while exploring new pdf pages or right after a search
    setTimeout(countMatches, 100);
    const observer = new MutationObserver(() => {
       clearTimeout(timeoutInfo);
       timeoutInfo = setTimeout(countMatches, 300);
    });
    observer.observe(container, { childList: true, subtree: true });

    return () => {
       observer.disconnect();
       clearTimeout(timeoutInfo);
    };
  }, [debouncedSearch]);

  // Effect to style and scroll to current active match
  React.useEffect(() => {
     if (totalMatches === 0 || currentMatchIndex === 0) return;
     const marks = document.querySelectorAll('mark.pdf-search-mark');
     marks.forEach((m, i) => {
        if (i === currentMatchIndex - 1) {
           m.className = 'pdf-search-mark bg-[#EED284] text-[#2C2C26] ring-2 ring-[#CFA956] z-10 rounded-sm transition-all shadow-sm';
        } else {
           m.className = 'pdf-search-mark bg-[#FBE3A1]/80 text-[#2C2C26] rounded-sm transition-all';
        }
     });
  }, [currentMatchIndex, totalMatches]);

  const handleNextMatch = () => {
    const marks = document.querySelectorAll('mark.pdf-search-mark');
    if (marks.length === 0) return;
    const nextIdx = currentMatchIndex >= marks.length ? 1 : currentMatchIndex + 1;
    setCurrentMatchIndex(nextIdx);
    marks[nextIdx - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handlePrevMatch = () => {
    const marks = document.querySelectorAll('mark.pdf-search-mark');
    if (marks.length === 0) return;
    const prevIdx = currentMatchIndex <= 1 ? marks.length : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIdx);
    marks[prevIdx - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const onNotePointerDown = (e: React.PointerEvent, id: string, rect: { x: number; y: number; w: number; h: number }) => {
    if (e.button !== 0) return; // Only left click for drag
    e.stopPropagation();
    setDragState({ id, startX: e.clientX, startY: e.clientY, initialRect: { ...rect } });
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPageNumber(1);
      setAnnotations([]); // Reset on new file
      setRedoStack([]); // Reset redo stack
      
      // Save to history automatically
      await saveToHistory(selected);
      if (onFileLoaded) {
        onFileLoaded(selected.name, selected);
      }
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    
    // Add a slight delay for the thumbnails/pages to mount
    setTimeout(() => {
      document.getElementById('pdf-scroll-container')?.scrollTo({ top: 0, behavior: 'instant' });
    }, 100);
  };

  const handleContextMenu = (e: React.MouseEvent, pageNum: number, pageElement: HTMLElement) => {
    e.preventDefault();
    const selection = window.getSelection();
    const isCollapsed = !selection || selection.isCollapsed;

    if (!pageElement) {
      setContextMenu(null);
      return;
    }

    const pageRect = pageElement.getBoundingClientRect();
    let pageRects = [];
    
    if (!isCollapsed) {
      const range = selection.getRangeAt(0);
      const rects = Array.from(range.getClientRects());
      pageRects = rects.map(rect => ({
        x: (rect.left - pageRect.left) / scale,
        y: (rect.top - pageRect.top) / scale,
        w: rect.width / scale,
        h: rect.height / scale,
      }));
    } else {
      // Create a point coordinate for a sticky note
      pageRects = [{
        x: (e.clientX - pageRect.left) / scale,
        y: (e.clientY - pageRect.top) / scale,
        w: 24 / scale, // Save as PDF space relative length
        h: 24 / scale,
      }];
    }

    if (pageRects.length > 0) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        rects: pageRects,
        isSelection: !isCollapsed,
        pageNumber: pageNum
      });
    }
  };

  const applyAnnotationFromMenu = (type: 'highlight' | 'underline' | 'note') => {
    if (!contextMenu) return;

    const newAnnotation: Annotation = {
      id: Math.random().toString(),
      pageNumber: contextMenu.pageNumber,
      type,
      color: annotationColor,
      rects: contextMenu.rects,
      timestamp: Date.now(),
      content: '', // Empty comment initially
    };
    
    setAnnotations(prev => [...prev, newAnnotation]);
    setRedoStack([]);
    setContextMenu(null);
    window.getSelection()?.removeAllRanges();
    
    // Automatically open comments panel if they might want to leave a note
    if (type === 'note' || type === 'highlight') {
      setShowCommentsPanel(true);
    }
  };

  const updateAnnotationContent = (id: string, content: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, content } : a));
  };
  
  const updateAnnotationColor = (id: string, color: {r: number, g: number, b: number}) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, color } : a));
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  };

  const handleUndo = () => {
    if (annotations.length === 0) return;
    const lastAnnotation = annotations[annotations.length - 1];
    setAnnotations(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastAnnotation]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const annotationToRestore = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setAnnotations(prev => [...prev, annotationToRestore]);
  };

  const handleSaveAnnotatedPdf = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (const ann of annotations) {
        const page = pages[ann.pageNumber - 1];
        if (!page) continue;
        
        const { height: pageHeight } = page.getSize();

        for (const rect of ann.rects) {
          // pdf-lib's origin (0,0) is bottom-left, while browser DOM is top-left
          const pdfX = rect.x;
          const pdfY = pageHeight - (rect.y + rect.h);
          const pdfW = rect.w;
          const pdfH = rect.h;

          if (ann.type === 'highlight') {
            page.drawRectangle({
              x: pdfX,
              y: pdfY,
              width: pdfW,
              height: pdfH,
              color: rgb(ann.color.r, ann.color.g, ann.color.b),
              opacity: 0.4,
            });
          } else if (ann.type === 'underline') {
            page.drawLine({
              start: { x: pdfX, y: pdfY },
              end: { x: pdfX + pdfW, y: pdfY },
              color: rgb(ann.color.r, ann.color.g, ann.color.b),
              thickness: 1.5,
            });
          } else if (ann.type === 'note') {
            // Draw a small icon/square for the note
            page.drawRectangle({
              x: pdfX,
              y: pdfY + pdfH - 20, // Adjust Y for icon representation
              width: 20,
              height: 20,
              color: rgb(ann.color.r, ann.color.g, ann.color.b),
            });
          }
        }
        
        // Render text label for note type or any annotation with text
        if (ann.content && ann.rects.length > 0) {
          const firstRect = ann.rects[0];
          const pdfX = firstRect.x;
          const pdfY = pageHeight - (firstRect.y + firstRect.h);
          
          const textPreview = ann.content.substring(0, 100) + (ann.content.length > 100 ? '...' : '');
          page.drawText(textPreview, {
            x: pdfX + (ann.type === 'note' ? 24 : 0),
            y: pdfY - 12,
            size: 10,
            font: helveticaFont,
            color: rgb(0, 0, 0),
            opacity: 0.8
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      triggerDownload(pdfBytes, `annotated-${file.name}`, 'application/pdf');
    } catch (err) {
      console.error(err);
      alert('Error saving PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportImage = async (format: 'png' | 'jpeg') => {
    const pageNode = document.getElementById(`page-${pageNumber}`);
    if (!pageNode) return;
    setIsProcessing(true);
    try {
      let dataUrl: string;
      if (format === 'png') {
        dataUrl = await toPng(pageNode, { quality: 1.0, pixelRatio: 2, skipFonts: true });
      } else {
        dataUrl = await toJpeg(pageNode, { quality: 0.95, pixelRatio: 2, skipFonts: true, backgroundColor: darkMode ? '#1e1e1e' : '#ffffff' });
      }
      
      const link = document.createElement('a');
      link.download = `${file?.name?.replace('.pdf','') || 'document'}_page_${pageNumber}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-natural-bg p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-natural-sidebar rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-natural-accent" />
          </div>
          <h2 className="text-xl font-serif text-natural-text mb-2">Reader</h2>
          <p className="text-natural-dim text-sm mb-6">Open a document to read, search, and annotate.</p>
          <label className="cursor-pointer bg-natural-accent text-white px-6 py-3 rounded-xl hover:opacity-90 transition-opacity inline-flex items-center shadow-sm">
            Open File
            <input type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
          </label>
        </div>
      </div>
    );
  }

  const currentAnnotations = annotations.filter(a => a.pageNumber === pageNumber);

  return (
    <div className={`h-full flex flex-col transition-colors duration-300 ${darkMode ? 'bg-[#1e1e1e] text-gray-200' : 'bg-natural-bg text-natural-text'}`}>
      <div className={`flex flex-col gap-2 p-4 border-b ${darkMode ? 'border-gray-800 bg-[#252525]' : 'border-natural-border bg-white/50 backdrop-blur-md'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowThumbnailsPanel(!showThumbnailsPanel)} 
              className={`p-2 rounded-lg flex items-center transition-colors hidden md:flex ${showThumbnailsPanel ? (darkMode ? 'bg-gray-800 text-gray-200' : 'bg-black/5 text-natural-text') : 'hover:bg-black/5'}`}
              title="Toggle Thumbnails Sidebar"
            >
              {showThumbnailsPanel ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            <span className="font-medium text-sm truncate max-w-[200px]">{file.name}</span>
            <div className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-black/5 text-natural-dim'}`}>
              {pageNumber} / {numPages || '-'}
            </div>
          </div>
          
            <div className="flex items-center gap-2 mr-auto">
              <div className={`flex items-center rounded-lg border overflow-hidden transition-colors ${darkMode ? 'border-gray-700 bg-[#1e1e1e]' : 'border-natural-border bg-white'}`}>
                
                {/* Match Counter prefix */}
                {debouncedSearch && totalMatches > 0 && (
                  <div className={`flex items-center justify-center px-2 py-1.5 text-xs font-medium border-r min-w-[50px] ${darkMode ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {currentMatchIndex} / {totalMatches}
                  </div>
                )}
                {debouncedSearch && totalMatches === 0 && (
                  <div className={`flex items-center justify-center px-2 py-1.5 text-xs font-medium border-r min-w-[50px] ${darkMode ? 'bg-gray-800 text-red-400 border-gray-700' : 'bg-red-50 text-red-500 border-gray-200'}`}>
                    0 / 0
                  </div>
                )}

                {/* Input Area */}
                <div className="flex items-center px-2 py-1.5 relative">
                  <Search className="w-4 h-4 mr-1.5 opacity-50" />
                  <input 
                    type="text" 
                    placeholder="Find text..." 
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      setCurrentMatchIndex(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (e.shiftKey) handlePrevMatch();
                        else handleNextMatch();
                      }
                    }}
                    className="bg-transparent border-none outline-none text-sm w-36 focus:w-48 transition-all font-medium"
                  />
                </div>

                {/* Navigation Arrows */}
                {debouncedSearch && totalMatches > 0 && (
                  <div className="flex items-center pr-1 gap-0.5">
                    <button onClick={handlePrevMatch} className="p-1 hover:bg-black/5 rounded transition-colors" title="Previous match (Shift+Enter)">
                      <ChevronUp className="w-3.5 h-3.5 opacity-70" />
                    </button>
                    <button onClick={handleNextMatch} className="p-1 hover:bg-black/5 rounded transition-colors" title="Next match (Enter)">
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Edit History & Zoom */}
            <div className="flex items-center gap-1 mx-2">
              <button 
                onClick={handleUndo} 
                disabled={annotations.length === 0}
                className="p-1.5 rounded-lg hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Undo"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button 
                onClick={handleRedo} 
                disabled={redoStack.length === 0}
                className="p-1.5 rounded-lg hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Redo"
              >
                <Redo2 className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-gray-300 mx-2"></div>

              <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-2 rounded-lg hover:bg-black/5">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="p-2 rounded-lg hover:bg-black/5">
                <ZoomIn className="w-4 h-4" />
              </button>
              
              <div className="w-px h-4 bg-gray-300 mx-2"></div>
              
              <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg hover:bg-black/5">
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowCommentsPanel(!showCommentsPanel)} 
                className={`p-2 rounded-lg flex items-center transition-colors ${showCommentsPanel ? 'bg-natural-accent text-white shadow-sm' : 'hover:bg-black/5'}`}
                title="Comments Panel"
              >
                {showCommentsPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              </button>

            <div className="relative ml-2">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }}
                disabled={isProcessing}
                className={`bg-natural-accent hover:opacity-90 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center shadow-sm disabled:opacity-50 transition-colors`}
                title="Save Options"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Download className="w-4 h-4 mr-1.5" />}
                Save
                <DropdownIcon className="w-3 h-3 ml-1.5 opacity-70" />
              </button>
              
              {showExportMenu && (
                <div className={`absolute top-full mt-2 right-0 w-52 rounded-xl shadow-lg border p-1.5 z-50 flex flex-col gap-1 overflow-hidden ${darkMode ? 'bg-[#2a2a2a] border-gray-700' : 'bg-white border-natural-border'}`}>
                  {annotations.length > 0 && (
                    <>
                      <button 
                        onClick={() => { setShowExportMenu(false); handleSaveAnnotatedPdf(); }}
                        className={`flex items-center w-full px-3 py-2 text-sm rounded-lg transition-colors font-medium ${darkMode ? 'hover:bg-[#3a3a3a] text-natural-accent' : 'hover:bg-natural-sidebar text-natural-text'}`}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Save with Annotations
                      </button>
                      <div className={`w-full h-px ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} my-0.5`} />
                    </>
                  )}
                  <div className={`px-2 pt-1 pb-0.5 text-[10px] uppercase tracking-wider font-bold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Export Page As</div>
                  <button 
                    onClick={() => { setShowExportMenu(false); handleExportImage('png'); }}
                    className={`flex items-center w-full px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? 'hover:bg-[#3a3a3a] text-gray-200' : 'hover:bg-natural-bg text-natural-text'}`}
                  >
                    <ImageIcon className="w-4 h-4 mr-2 opacity-70" />
                    Export PNG
                  </button>
                  <button 
                    onClick={() => { setShowExportMenu(false); handleExportImage('jpeg'); }}
                    className={`flex items-center w-full px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? 'hover:bg-[#3a3a3a] text-gray-200' : 'hover:bg-natural-bg text-natural-text'}`}
                  >
                    <ImageIcon className="w-4 h-4 mr-2 opacity-70" />
                    Export JPEG
                  </button>
                </div>
              )}
            </div>

            <button 
              onClick={() => {
                setFile(null);
                if (onFileLoaded) onFileLoaded('Reader', undefined);
              }} 
              className={`p-2 rounded-lg ml-1 transition-colors text-sm font-medium ${darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-natural-dim hover:bg-black/5 hover:text-natural-text'}`}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex relative">
        {/* Thumbnails Sidebar */}
        <motion.div 
          initial={false}
          animate={{ width: showThumbnailsPanel ? 192 : 0, opacity: showThumbnailsPanel ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 35, mass: 0.8 }}
          className={`h-full overflow-hidden flex flex-col shrink-0 border-transparent ${darkMode ? 'bg-[#2a2a2a]' : 'bg-natural-sidebar/30'} ${showThumbnailsPanel ? 'border-r border-natural-border' : ''} ${darkMode && showThumbnailsPanel ? '!border-gray-800' : ''}`}
        >
          <div className="w-48 p-4 h-full overflow-y-auto flex flex-col">
            <div className="text-xs uppercase tracking-wider mb-4 opacity-50 font-bold">Thumbnails</div>
            <div className="space-y-4">
              {Array.from(new Array(numPages || 0), (el, index) => (
                <button 
                  key={`thumb_${index + 1}`}
                  onClick={() => {
                    setPageNumber(index + 1);
                    document.getElementById(`page-${index + 1}`)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`w-full shrink-0 aspect-[1/1.4] bg-white rounded shadow-sm border-2 overflow-hidden transition-all ${pageNumber === index + 1 ? 'border-natural-accent scale-105' : 'border-transparent'}`}
                >
                  <Document file={file}>
                    <Page pageNumber={index + 1} width={150} renderTextLayer={false} renderAnnotationLayer={false} />
                  </Document>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="flex-1 overflow-auto flex flex-col items-center p-8 relative scroll-smooth" id="pdf-scroll-container">
           <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(err) => {
              console.error('[Lume] PDF load error:', err);
              (window as any).__lumePdfError = { message: err?.message, name: err?.name };
            }}
            loading={<div className="flex items-center gap-2 mt-20"><Loader2 className="animate-spin w-5 h-5"/> Loading PDF...</div>}
           >
             <div className="flex flex-col items-center gap-8 pb-32">
               {Array.from(new Array(numPages || 0), (el, index) => {
                 const currentPNum = index + 1;
                 const pageAnnotations = annotations.filter(a => a.pageNumber === currentPNum);
                 
                 return (
                   <div 
                     key={`page_${currentPNum}`}
                     id={`page-${currentPNum}`}
                     data-page-number={currentPNum}
                     onContextMenu={(e) => handleContextMenu(e, currentPNum, e.currentTarget)}
                     onClick={(e) => {
                       const selection = window.getSelection();
                       if (selection && !selection.isCollapsed) return;
                       
                       const pageRect = e.currentTarget.getBoundingClientRect();
                       const clickX = (e.clientX - pageRect.left) / scale;
                       const clickY = (e.clientY - pageRect.top) / scale;
                       
                       let clickedAnnotation = null;
                       for (const ann of pageAnnotations) {
                         for (const r of ann.rects) {
                           const tolerance = 4 / scale;
                           if (
                             clickX >= r.x - tolerance && clickX <= r.x + r.w + tolerance && 
                             clickY >= r.y - tolerance && clickY <= r.y + r.h + tolerance
                           ) {
                             clickedAnnotation = ann;
                             break;
                           }
                         }
                         if (clickedAnnotation) break;
                       }

                       if (clickedAnnotation) {
                         e.stopPropagation();
                         setContextMenu({
                           x: e.clientX,
                           y: e.clientY,
                           rects: [],
                           isSelection: false,
                           pageNumber: currentPNum,
                           editAnnotationId: clickedAnnotation.id,
                           editAnnotationColor: clickedAnnotation.color
                         });
                       }
                     }}
                     className={`relative cursor-text pdf-page-wrapper`}
                   >
                     <Page 
                      pageNumber={currentPNum} 
                      scale={scale} 
                      className={`shadow-xl transition-all ${darkMode ? 'invert hue-rotate-180' : ''}`}
                      customTextRenderer={({ str }) => {
                        if (debouncedSearch && str.toLowerCase().includes(debouncedSearch.toLowerCase())) {
                          const regex = new RegExp(`(${debouncedSearch.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
                          return str.replace(regex, '<mark class="pdf-search-mark bg-[#FBE3A1]/80 text-[#2C2C26] rounded-sm transition-all">$1</mark>');
                        }
                        return str;
                      }}
                    />
                    {/* Overlay Annotations for this page */}
                    {pageAnnotations.map(ann => (
                      <React.Fragment key={ann.id}>
                        {ann.rects.map((r, i) => (
                          <div
                            key={`${ann.id}-${i}`}
                            onPointerDown={(e) => ann.type === 'note' ? onNotePointerDown(e, ann.id, r) : undefined}
                            onContextMenu={(e) => { if (ann.type === 'note') { e.preventDefault(); e.stopPropagation(); } }}
                            style={{
                              position: 'absolute',
                              left: `${r.x * scale}px`,
                              top: `${r.y * scale}px`,
                              width: `${r.w * scale}px`,
                              height: `${r.h * scale}px`,
                              backgroundColor: ann.type === 'highlight' ? `rgba(${Math.round(ann.color.r * 255)}, ${Math.round(ann.color.g * 255)}, ${Math.round(ann.color.b * 255)}, 0.4)` : 'transparent',
                              borderBottom: ann.type === 'underline' ? `2px solid rgb(${Math.round(ann.color.r * 255)}, ${Math.round(ann.color.g * 255)}, ${Math.round(ann.color.b * 255)})` : 'none',
                              pointerEvents: 'auto', // Changed to auto to intercept clicks
                              cursor: ann.type === 'note' ? (dragState?.id === ann.id ? 'grabbing' : 'grab') : 'pointer',
                              zIndex: ann.type === 'note' ? (dragState?.id === ann.id ? 30 : 20) : 10,
                              mixBlendMode: ann.type === 'note' ? 'normal' : 'multiply'
                            }}
                          >
                            {ann.type === 'note' && (
                               <MessageSquare 
                                 className="w-full h-full drop-shadow-md" 
                                 style={{ color: `rgb(${Math.round(ann.color.r * 255)}, ${Math.round(ann.color.g * 255)}, ${Math.round(ann.color.b * 255)})`, fill: `rgb(${Math.round(ann.color.r * 255)}, ${Math.round(ann.color.g * 255)}, ${Math.round(ann.color.b * 255)})` }} 
                               />
                            )}
                          </div>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                 )
               })}
             </div>
           </Document>

          {/* Floating Navigation Controls */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-lg z-30">
            <button 
              disabled={pageNumber <= 1} 
              onClick={() => {
                const prev = pageNumber - 1;
                setPageNumber(prev);
                document.getElementById(`page-${prev}`)?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="p-1 hover:bg-white/20 rounded disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium px-2">Page {pageNumber} of {numPages}</span>
            <button 
              disabled={pageNumber >= (numPages || 1)} 
              onClick={() => {
                const next = pageNumber + 1;
                setPageNumber(next);
                document.getElementById(`page-${next}`)?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="p-1 hover:bg-white/20 rounded disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right Comments Sidebar Panel */}
        <div className={`absolute right-0 top-0 h-full w-80 flex flex-col shadow-[-4px_0_20px_rgba(0,0,0,0.06)] z-40 transition-transform duration-300 ease-in-out border-l ${darkMode ? 'border-gray-800 bg-[#252525]/95 backdrop-blur-xl' : 'border-natural-border bg-white/95 backdrop-blur-xl'} ${showCommentsPanel ? 'translate-x-0' : 'translate-x-[105%]'}`}>
           <div className={`p-4 border-b flex items-center justify-between sticky top-0 z-10 ${darkMode ? 'border-gray-800' : 'border-natural-border/50'}`}>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 opacity-70" />
                <span className="font-medium text-sm">Comments</span>
                <span className="text-xs bg-natural-sidebar px-2 py-0.5 rounded-full ml-1">{annotations.length}</span>
              </div>
              <button 
                onClick={() => setShowCommentsPanel(false)}
                className="p-1.5 hover:bg-black/5 rounded-md transition-colors text-natural-dim hover:text-natural-text"
                title="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {annotations.length === 0 ? (
                   <div className="text-center text-sm text-natural-dim mt-10">
                     No comments yet. Right-click anywhere in the PDF to add one.
                   </div>
                 ) : (
                   annotations.map((ann) => (
                     <div key={ann.id} className={`group p-3 rounded-xl border transition-all hover:shadow-sm ${darkMode ? 'border-gray-700 bg-[#1e1e1e]' : 'border-natural-border/60 bg-natural-bg/50'}`}>
                       <div className="flex items-center justify-between mb-2">
                         <div className="flex items-center gap-2 text-xs font-medium opacity-70">
                            {ann.type === 'highlight' && <Edit3 className="w-3.5 h-3.5" />}
                            {ann.type === 'underline' && <UnderlineIcon className="w-3.5 h-3.5" />}
                            {ann.type === 'note' && <MessageSquare className="w-3.5 h-3.5" />}
                            <span className="capitalize">{ann.type}</span> 
                            <span>• Page {ann.pageNumber}</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: `rgb(${ann.color.r*255},${ann.color.g*255},${ann.color.b*255})` }}></div>
                           <button onClick={() => deleteAnnotation(ann.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 text-red-500 rounded transition duration-200">
                              <Trash2 className="w-3.5 h-3.5" />
                           </button>
                         </div>
                       </div>
                       <textarea 
                          value={ann.content || ''}
                          onChange={(e) => updateAnnotationContent(ann.id, e.target.value)}
                          placeholder="Add a comment..."
                          className={`w-full text-sm resize-none bg-transparent outline-none min-h-[60px] ${darkMode ? 'text-gray-200 placeholder-gray-600' : 'text-natural-text placeholder-natural-dim'}`}
                       />
                       <div className="text-[10px] text-right opacity-40 mt-1">
                          {new Date(ann.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </div>
                     </div>
                   ))
                 )}
              </div>
           </div>
      </div>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div 
          className="fixed z-[9999] bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-natural-border p-2 min-w-[160px] flex flex-col gap-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.editAnnotationId ? (
            <>
              <div className="flex items-center justify-center gap-3 px-2 py-2 mb-1 border-b border-natural-border/60">
                {[
                  { r: 0.984, g: 0.890, b: 0.631, hex: '#FBE3A1' }, // Soft Amber
                  { r: 0.706, g: 0.839, b: 0.757, hex: '#B4D6C1' }, // Sage Green
                  { r: 0.886, g: 0.749, b: 0.788, hex: '#E2BFC9' }, // Dusty Rose
                  { r: 0.663, g: 0.761, b: 0.831, hex: '#A9C2D4' }  // Muted Blue
                ].map(color => (
                  <button
                    key={color.hex}
                    onClick={() => {
                      updateAnnotationColor(contextMenu.editAnnotationId!, color);
                      setContextMenu({ ...contextMenu, editAnnotationColor: color });
                    }}
                    className="w-5 h-5 rounded-full border-[3px] transition-transform hover:scale-110 active:scale-95"
                    style={{ 
                      backgroundColor: color.hex, 
                      borderColor: contextMenu.editAnnotationColor?.r === color.r ? '#5A5A40' : 'transparent' 
                    }}
                  />
                ))}
              </div>
              <button 
                onClick={() => {
                  deleteAnnotation(contextMenu.editAnnotationId!);
                  setContextMenu(null);
                }}
                className="flex items-center w-full px-2.5 py-2 text-sm hover:bg-red-50 text-red-500 rounded-lg font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2.5 opacity-70" /> Delete Annotation
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-3 px-2 py-2 mb-1 border-b border-natural-border/60">
                {[
                  { r: 0.984, g: 0.890, b: 0.631, hex: '#FBE3A1' }, // Soft Amber (Default)
                  { r: 0.706, g: 0.839, b: 0.757, hex: '#B4D6C1' }, // Sage Green
                  { r: 0.886, g: 0.749, b: 0.788, hex: '#E2BFC9' }, // Dusty Rose
                  { r: 0.663, g: 0.761, b: 0.831, hex: '#A9C2D4' }  // Muted Blue
                ].map(color => (
                  <button
                    key={color.hex}
                    onClick={() => setAnnotationColor(color)}
                    className="w-5 h-5 rounded-full border-[3px] transition-transform hover:scale-110 active:scale-95"
                    style={{ 
                      backgroundColor: color.hex, 
                      borderColor: annotationColor.r === color.r ? '#5A5A40' : 'transparent' 
                    }}
                  />
                ))}
              </div>
              {contextMenu.isSelection ? (
                <>
                  <button 
                    onClick={() => applyAnnotationFromMenu('highlight')}
                    className="flex items-center w-full px-2.5 py-2 text-sm hover:bg-natural-bg rounded-lg text-natural-text font-medium transition-colors"
                  >
                    <Edit3 className="w-4 h-4 mr-2.5 opacity-70" /> Highlight
                  </button>
                  <button 
                    onClick={() => applyAnnotationFromMenu('underline')}
                    className="flex items-center w-full px-2.5 py-2 text-sm hover:bg-natural-bg rounded-lg text-natural-text font-medium transition-colors"
                  >
                    <UnderlineIcon className="w-4 h-4 mr-2.5 opacity-70" /> Underline
                  </button>
                  <div className="w-full h-px bg-natural-border/50 my-0.5"></div>
                  <button 
                    onClick={() => applyAnnotationFromMenu('note')}
                    className="flex items-center w-full px-2.5 py-2 text-sm hover:bg-natural-bg rounded-lg text-natural-text font-medium transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 mr-2.5 opacity-70" /> Add Comment to Selection
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => applyAnnotationFromMenu('note')}
                  className="flex items-center w-full px-2.5 py-2 text-sm hover:bg-natural-bg rounded-lg text-natural-text font-medium transition-colors"
                >
                  <MessageSquare className="w-4 h-4 mr-2.5 opacity-70" /> Drop Sticky Note
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
