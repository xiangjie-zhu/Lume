import React, { useEffect, useState } from 'react';
import { getHistory, RecentFileMeta, loadFileFromHistory, clearHistory } from '../lib/storage';
import { FileText, Plus, Clock, FilePlus2, SplitSquareHorizontal, Layers, PenTool, Droplet, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns'; // Wait, let's just make a simple distance function or use built-in Intl, avoiding date-fns to save dependencies

// Fallback relative time formatter
const formatRelativeTime = (timestamp: number) => {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`;
  return new Date(timestamp).toLocaleDateString();
}

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface HomeDashboardProps {
  onOpenFile: (file: File) => void;
  onNewReader: () => void;
  onNavigate: (toolId: string) => void;
}

export default function HomeDashboard({ onOpenFile, onNewReader, onNavigate }: HomeDashboardProps) {
  const [history, setHistory] = useState<RecentFileMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    const h = await getHistory();
    setHistory(h);
    setLoading(false);
  };

  const handleClearHistory = async () => {
    await clearHistory();
    setHistory([]);
  };

  const handleOpenRecent = async (meta: RecentFileMeta) => {
    setOpeningId(meta.id);
    const file = await loadFileFromHistory(meta);
    setOpeningId(null);
    if (file) {
      onOpenFile(file);
    } else {
      alert("This file is no longer available in local storage.");
      loadHistory(); // refresh
    }
  };

  const quickActions = [
    { id: 'reader', icon: FilePlus2, label: 'Open Document', desc: 'Read, annotate, and search', onClick: onNewReader },
    { id: 'merge', icon: Layers, label: 'Merge', desc: 'Combine multiple files', onClick: () => onNavigate('merge') },
    { id: 'organize', icon: SplitSquareHorizontal, label: 'Organize', desc: 'Extract & reorder pages', onClick: () => onNavigate('organize') },
    { id: 'signature', icon: PenTool, label: 'Sign', desc: 'Add signatures visually', onClick: () => onNavigate('signature') },
  ];

  return (
    <div className="w-full h-full overflow-y-auto bg-natural-bg p-8 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header Intro */}
        <div className="space-y-2">
          <h1 className="text-3xl font-serif text-natural-text">Good to see you</h1>
          <p className="text-natural-dim">Welcome to Lume, your calm space for reading and working with documents.</p>
        </div>

        {/* Quick Actions */}
        <section>
          <h2 className="text-sm font-semibold tracking-wider uppercase text-natural-dim mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map(action => {
              const Icon = action.icon;
              return (
                <button 
                  key={action.id}
                  onClick={action.onClick}
                  className="flex flex-col text-left p-5 bg-white border border-natural-border rounded-2xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-0.5 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-natural-bg flex items-center justify-center mb-4 group-hover:bg-natural-accent group-hover:text-white transition-colors">
                    <Icon className="w-5 h-5 text-natural-text group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="font-medium text-natural-text mb-1">{action.label}</h3>
                  <p className="text-xs text-natural-dim">{action.desc}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Recent Files */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-wider uppercase text-natural-dim flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Documents
            </h2>
            {history.length > 0 && (
              <button 
                onClick={handleClearHistory}
                className="text-xs text-natural-dim hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="text-sm text-natural-dim py-8 text-center bg-white border border-natural-border rounded-2xl border-dashed">
              Loading recent documents...
            </div>
          ) : history.length === 0 ? (
            <div className="text-sm text-natural-dim py-12 text-center bg-white border border-natural-border rounded-2xl border-dashed flex flex-col items-center justify-center">
              <FileText className="w-8 h-8 text-natural-dim/50 mb-3" />
              <p>No recent documents</p>
              <p className="text-xs mt-1 opacity-70">Files you open will appear here for quick access.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map(file => (
                <button
                  key={file.id}
                  onClick={() => handleOpenRecent(file)}
                  disabled={openingId === file.id}
                  className="flex items-start text-left p-4 bg-white border border-natural-border rounded-xl hover:shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-all group relative overflow-hidden"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#f9f3ec] shrink-0 flex items-center justify-center mr-3">
                    <FileText className="w-5 h-5 text-natural-accent" />
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="font-medium text-natural-text text-sm truncate mb-0.5" title={file.name}>{file.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-natural-dim">
                      <span>{formatRelativeTime(file.timestamp)}</span>
                      <span>•</span>
                      <span>{formatSize(file.size)}</span>
                    </div>
                  </div>
                  {openingId === file.id && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-natural-accent border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
