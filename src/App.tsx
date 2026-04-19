import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Layers, 
  Droplet, 
  Settings2,
  BookOpen,
  GripHorizontal,
  Image as ImageIcon,
  PenTool,
  Menu
} from 'lucide-react';
import MergeTool from './tools/MergeTool'; // We'll move MergeTool to its own file or keep it inline. Let's move it to a file. Ah wait, it's currently inline.
import OrganizeTool from './tools/OrganizeTool';
import ConvertTool from './tools/ConvertTool';
import SignatureTool from './tools/SignatureTool';
import ReaderTool from './tools/ReaderTool';
import { WatermarkTool, MergeTool as InlineMergeTool } from './tools/LegacyTools'; // I'll extract inline tools to a LegacyTools file

// --- Types ---
type Tool = 'reader' | 'merge' | 'organize' | 'convert' | 'watermark' | 'signature';

function WindowControls() {
  return (
    <div className="flex items-center space-x-2 px-4 py-3">
      <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] shadow-sm" />
      <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] shadow-sm" />
      <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29] shadow-sm" />
    </div>
  );
}

function Sidebar({ currentTool, setCurrentTool, show, setShow }: { currentTool: Tool, setCurrentTool: (t: Tool) => void, show: boolean, setShow: (show: boolean) => void }) {
  const categories = [
    {
      label: 'Read & View',
      tools: [
        { id: 'reader', icon: BookOpen, label: 'PDF Reader' },
      ]
    },
    {
      label: 'Edit & Modify',
      tools: [
        { id: 'merge', icon: Layers, label: 'Merge PDFs' },
        { id: 'organize', icon: GripHorizontal, label: 'Organize Pages' },
      ]
    },
    {
      label: 'Format & Convert',
      tools: [
        { id: 'convert', icon: ImageIcon, label: 'Convert Format' },
      ]
    },
    {
      label: 'Security & Auth',
      tools: [
        { id: 'signature', icon: PenTool, label: 'Sign Document' },
        { id: 'watermark', icon: Droplet, label: 'Watermark' },
      ]
    }
  ] as const;

  return (
    <motion.div 
      initial={false}
      animate={{ width: show ? 240 : 0, opacity: show ? 1 : 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 35, mass: 0.8 }}
      className={`bg-natural-sidebar flex flex-col h-full shrink-0 overflow-hidden z-20 relative border-transparent ${show ? 'border-r border-natural-border' : ''}`}
    >
      <div className="w-[240px] flex flex-col h-full shrink-0">
        <WindowControls />
        
        <div className="font-serif italic text-2xl mb-6 px-4 flex items-center justify-between gap-2 text-natural-text mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-natural-accent rounded-full"></div>
            Aura PDF
          </div>
          <button 
            onClick={() => setShow(false)}
            className="p-1.5 rounded-md hover:bg-black/5 text-natural-dim hover:text-natural-text transition-colors"
            title="Hide Sidebar"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
        {categories.map((category, idx) => (
          <div key={idx} className="mb-6">
            <p className="text-[11px] uppercase tracking-[0.1em] text-natural-dim mb-3 pl-1 font-semibold">{category.label}</p>
            <nav className="space-y-1">
              {category.tools.map((tool) => {
                const Icon = tool.icon;
                const isActive = currentTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => setCurrentTool(tool.id as Tool)}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 ${
                      isActive 
                        ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-natural-text font-medium' 
                        : 'text-natural-dim hover:text-natural-text hover:bg-black/5'
                    }`}
                  >
                    <Icon className="w-[16px] h-[16px]" />
                    <span>{tool.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
      <div className="p-4 pl-7 pb-6 mt-auto">
        <div className="flex items-center space-x-2.5 text-natural-dim opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
          <Settings2 className="w-[18px] h-[18px]" />
          <span className="text-sm">Settings</span>
        </div>
      </div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [currentTool, setCurrentTool] = useState<Tool>('reader');
  const [showSidebar, setShowSidebar] = useState(true);

  return (
    <div className="h-screen w-full font-sans overflow-hidden bg-natural-bg flex items-center justify-center p-4 md:p-8">
      {/* Main Natural Window Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-[1200px] h-full max-h-[85vh] min-h-[600px] bg-natural-bg rounded-2xl shadow-[0_12px_48px_rgba(0,0,0,0.1)] border border-natural-border flex overflow-hidden relative"
      >
        <Sidebar currentTool={currentTool} setCurrentTool={setCurrentTool} show={showSidebar} setShow={setShowSidebar} />
        
        <main className="flex-1 relative bg-natural-bg h-full flex flex-col min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTool}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {currentTool === 'reader' && <ReaderTool globalSidebarHidden={!showSidebar} onOpenGlobalSidebar={() => setShowSidebar(true)} />}
              {currentTool === 'merge' && <InlineMergeTool />}
              {currentTool === 'organize' && <OrganizeTool />}
              {currentTool === 'convert' && <ConvertTool />}
              {currentTool === 'signature' && <SignatureTool />}
              {currentTool === 'watermark' && <WatermarkTool />}
            </motion.div>
          </AnimatePresence>
        </main>
      </motion.div>
    </div>
  );
}

