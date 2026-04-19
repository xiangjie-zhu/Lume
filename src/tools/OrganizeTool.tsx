import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, degrees } from 'pdf-lib';
import { FileText, RotateCw, Trash2, Download, Loader2, Grip, CheckCircle2 } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { triggerDownload } from '../lib/utils';

interface PageData {
  id: string;
  originalIndex: number;
  rotation: number;
  deleted: boolean;
}

function SortablePage({ 
  page, 
  file, 
  onRotate, 
  onDelete 
}: { 
  page: PageData, 
  file: File, 
  onRotate: (id: string) => void, 
  onDelete: (id: string) => void 
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  if (page.deleted) return null;

  return (
    <div ref={setNodeRef} style={style} className={`relative group ${isDragging ? 'opacity-70 scale-105 shadow-xl' : ''}`}>
      <div className="bg-white p-2 rounded-xl border border-natural-border shadow-sm hover:shadow-md transition-all">
        <div {...attributes} {...listeners} className="absolute top-2 left-2 p-1.5 bg-black/5 rounded-md cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Grip className="w-4 h-4 text-natural-dim" />
        </div>
        
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button onClick={() => onRotate(page.id)} className="p-1.5 bg-white shadow border border-natural-border rounded-md hover:text-blue-500">
            <RotateCw className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(page.id)} className="p-1.5 bg-white shadow border border-natural-border rounded-md hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-hidden rounded-lg bg-gray-50 flex items-center justify-center pointer-events-none" style={{ transform: `rotate(${page.rotation}deg)`, transition: 'transform 0.3s ease' }}>
          <Document file={file}>
            <Page pageNumber={page.originalIndex + 1} width={160} renderTextLayer={false} renderAnnotationLayer={false} />
          </Document>
        </div>
        <div className="text-center mt-2 text-xs font-medium text-natural-dim">
          Page {page.originalIndex + 1}
        </div>
      </div>
    </div>
  );
}

export default function OrganizeTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    const initialPages = Array.from({ length: numPages }, (_, i) => ({
      id: `page-${i}`,
      originalIndex: i,
      rotation: 0,
      deleted: false,
    }));
    setPages(initialPages);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setPages((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleRotate = (id: string) => {
    setPages(pages.map(p => p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p));
  };

  const handleDelete = (id: string) => {
    setPages(pages.map(p => p.id === id ? { ...p, deleted: true } : p));
  };

  const handleSave = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const newPdf = await PDFDocument.create();
      
      const activePages = pages.filter(p => !p.deleted);
      const indices = activePages.map(p => p.originalIndex);
      
      const copiedPages = await newPdf.copyPages(pdfDoc, indices);
      
      copiedPages.forEach((page, idx) => {
        const rotation = activePages[idx].rotation;
        if (rotation !== 0) {
          page.setRotation(degrees(page.getRotation().angle + rotation));
        }
        newPdf.addPage(page);
      });

      const pdfBytes = await newPdf.save();
      triggerDownload(pdfBytes, `organized-${file.name}`);
    } catch (error) {
      console.error(error);
      alert("Error saving PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <label className="cursor-pointer border-2 border-dashed border-natural-border hover:border-natural-accent bg-white/40 p-12 rounded-3xl text-center transition-all">
          <div className="w-16 h-16 bg-natural-sidebar rounded-full flex items-center justify-center mx-auto mb-4">
            <Grip className="w-8 h-8 text-natural-accent" />
          </div>
          <h2 className="text-xl font-serif text-natural-text mb-2">Organize Pages</h2>
          <p className="text-natural-dim text-sm mb-6">Reorder, delete, and rotate PDF pages easily.</p>
          <span className="bg-natural-accent text-white px-6 py-2.5 rounded-lg text-sm font-medium">Select PDF File</span>
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files && setFile(e.target.files[0])} />
        </label>
      </div>
    );
  }

  const activePages = pages.filter(p => !p.deleted);

  return (
    <div className="h-full flex flex-col pt-8 px-10 pb-8 bg-natural-bg">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl mb-2 text-natural-text">Organize Pages</h1>
          <p className="text-natural-dim text-sm">Drag to reorder, use hover tools to rotate or delete.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setFile(null)} className="px-4 py-2 rounded-lg border border-natural-border text-sm font-medium hover:bg-black/5 transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isProcessing || activePages.length === 0}
            className="flex items-center px-4 py-2 rounded-lg bg-natural-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Save PDF
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Hidden Document renderer to extract pages */}
        <div className="hidden">
          <Document file={file} onLoadSuccess={onDocumentLoadSuccess} />
        </div>

        {pages.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={pages.map(p => p.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 p-4">
                {pages.map((page) => (
                  <SortablePage 
                    key={page.id} 
                    page={page} 
                    file={file} 
                    onRotate={handleRotate} 
                    onDelete={handleDelete} 
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="flex justify-center items-center h-full text-natural-dim">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading document pages...
          </div>
        )}
      </div>
    </div>
  );
}
