import React, { useState } from 'react';
import { motion } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { 
  FileText, 
  Layers, 
  Droplet, 
  Settings2,
  BookOpen,
  GripHorizontal,
  Image as ImageIcon,
  PenTool,
  Menu,
  Home,
  X,
  Plus
} from 'lucide-react';
import OrganizeTool from './tools/OrganizeTool';
import ConvertTool from './tools/ConvertTool';
import SignatureTool from './tools/SignatureTool';
import ReaderTool from './tools/ReaderTool';
import { WatermarkTool, MergeTool as InlineMergeTool } from './tools/LegacyTools'; 
import HomeDashboard from './components/HomeDashboard';

// --- Types ---
export type Tool = 'home' | 'reader' | 'merge' | 'organize' | 'convert' | 'watermark' | 'signature';

export interface TabInfo {
  id: string;
  tool: Tool;
  title: string;
  file?: File;
}

const getToolName = (tool: Tool) => {
  switch(tool) {
    case 'home': return 'Home';
    case 'reader': return 'Reader';
    case 'merge': return 'Merge';
    case 'organize': return 'Organize Pages';
    case 'convert': return 'Convert Format';
    case 'signature': return 'Signature';
    case 'watermark': return 'Watermark';
    default: return 'New Tab';
  }
}

function Sidebar({ onNewTab, show, setShow }: { onNewTab: (t: Tool) => void, show: boolean, setShow: (show: boolean) => void }) {
  const categories = [
    {
      label: 'Main Tools',
      tools: [
        { id: 'home', icon: Home, label: 'Home Dashboard' },
        { id: 'reader', icon: BookOpen, label: 'Reader' },
      ]
    },
    {
      label: 'Edit & Modify',
      tools: [
        { id: 'merge', icon: Layers, label: 'Merge' },
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
        <div
          className="h-[38px] shrink-0"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />

        <div className="font-serif italic text-2xl mb-6 px-4 flex items-center justify-between gap-2 text-natural-text mt-2">
          <span className="mb-0.5 tracking-wide select-none">Lume</span>
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
                return (
                  <button
                    key={tool.id}
                    onClick={() => onNewTab(tool.id as Tool)}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 text-natural-dim hover:text-natural-text hover:bg-black/5"
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
  const [tabs, setTabs] = useState<TabInfo[]>([{ id: 'home_main', tool: 'home', title: 'Home Dashboard' }]);
  const [activeTabId, setActiveTabId] = useState<string>('home_main');
  const [showSidebar, setShowSidebar] = useState(true);

  const handleNewTab = (tool: Tool, overrideFile?: File) => {
    // If asking for home, just switch to it if it exists
    if (tool === 'home') {
      const homeTab = tabs.find(t => t.tool === 'home');
      if (homeTab) {
        setActiveTabId(homeTab.id);
        return;
      }
    }
    // For single-instance tools try focusing first to avoid clutter
    if (['merge', 'organize', 'convert', 'signature', 'watermark'].includes(tool)) {
      const existing = tabs.find(t => t.tool === tool);
      if (existing && !overrideFile) {
        setActiveTabId(existing.id);
        return;
      }
    }

    const id = uuidv4();
    const title = overrideFile ? overrideFile.name : getToolName(tool);
    setTabs(prev => [...prev, { id, tool, title, file: overrideFile }]);
    setActiveTabId(id);
  };

  const closeTab = (id: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== id);
      if (newTabs.length === 0) {
        // Keep at least Home open
        const homeId = uuidv4();
        newTabs.push({ id: homeId, tool: 'home', title: 'Home Dashboard' });
        setActiveTabId(homeId);
      } else if (activeTabId === id) {
        // Go to previous tab
        const idx = prev.findIndex(t => t.id === id);
        if (idx > 0) setActiveTabId(newTabs[idx - 1].id);
        else setActiveTabId(newTabs[0].id);
      }
      return newTabs;
    });
  };

  const updateTabTitle = (id: string, title: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, title } : t));
  };

  const updateTabFile = (id: string, file: File) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, file } : t));
  };

  return (
    <div className="h-screen w-full font-sans overflow-hidden bg-natural-bg">
      <div className="w-full h-full bg-natural-bg flex relative">
        <Sidebar onNewTab={handleNewTab} show={showSidebar} setShow={setShowSidebar} />
        
        <main className="flex-1 relative bg-natural-bg h-full flex flex-col min-w-0">
          
          {/* Global Tab Bar */}
          <div className="flex items-center bg-[#f8f9fa] border-b border-natural-border px-2 pt-2 overflow-x-auto no-scrollbar shrink-0 min-h-[44px]">
            {!showSidebar && (
              <button 
                onClick={() => setShowSidebar(true)} 
                className="p-1.5 mr-2 mb-1.5 rounded hover:bg-black/5 flex-shrink-0 text-natural-dim hover:text-natural-text transition-colors"
                title="Open Sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}
            <div className="flex gap-1 items-end h-full mt-auto">
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`group flex items-center gap-2 px-3 pb-1.5 pt-2 min-w-[140px] max-w-[200px] border-r border-t border-l rounded-t-xl transition-colors select-none ${
                    activeTabId === tab.id 
                      ? 'bg-natural-bg border-natural-border shadow-[0_-2px_6px_rgba(0,0,0,0.02)] text-natural-text z-10 relative'
                      : 'bg-transparent border-transparent text-natural-dim hover:bg-black/5 hover:text-natural-text cursor-pointer'
                  }`}
                  style={{ marginBottom: activeTabId === tab.id ? -1 : 0 }} 
                >
                  <div className="truncate flex-1 text-[13px] font-medium text-center">{tab.title}</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                    className={`p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-all ${activeTabId === tab.id ? 'opacity-100' : ''}`}
                    title="Close Tab"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button 
                onClick={() => handleNewTab('home')} 
                className="p-1.5 mb-1.5 ml-1 rounded-lg hover:bg-black/5 text-natural-dim flex-shrink-0"
                title="New Tab"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative bg-natural-bg min-h-0">
            {tabs.map(tab => (
              <div 
                key={tab.id} 
                className="absolute inset-0"
                style={{
                  display: activeTabId === tab.id ? 'flex' : 'none',
                  zIndex: activeTabId === tab.id ? 10 : 0,
                  flexDirection: 'column'
                }}
              >
                {/* We render the active tool or preserve state */}
                {tab.tool === 'home' && (
                  <HomeDashboard 
                    onOpenFile={(f) => handleNewTab('reader', f)} 
                    onNewReader={() => handleNewTab('reader')}
                    onNavigate={(t) => handleNewTab(t as Tool)}
                  />
                )}
                {tab.tool === 'reader' && (
                  <ReaderTool 
                    initialFile={tab.file} 
                    onFileLoaded={(title, f) => {
                      updateTabTitle(tab.id, title);
                      if (f) updateTabFile(tab.id, f);
                    }} 
                  />
                )}
                {tab.tool === 'merge' && <InlineMergeTool />}
                {tab.tool === 'organize' && <OrganizeTool />}
                {tab.tool === 'convert' && <ConvertTool />}
                {tab.tool === 'signature' && <SignatureTool />}
                {tab.tool === 'watermark' && <WatermarkTool />}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

