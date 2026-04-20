import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';

const HISTORY_KEY = 'lume_history_metadata';
const MAX_HISTORY = 12;

export interface RecentFileMeta {
  id: string;
  name: string;
  size: number;
  timestamp: number;
}

// Ensure localforage config for better performance (IndexedDB preferred)
localforage.config({
  name: 'LumeWorkspace',
  storeName: 'pdf_files',
  description: 'Stores recent PDF files for Lume app'
});

export const saveToHistory = async (file: File): Promise<RecentFileMeta> => {
  const metaList = await getHistory();
  
  // Check if already exists (heuristic by name and size)
  const existingIndex = metaList.findIndex(m => m.name === file.name && m.size === file.size);
  let meta: RecentFileMeta;
  
  if (existingIndex >= 0) {
    meta = metaList[existingIndex];
    meta.timestamp = Date.now();
    // Move to front
    metaList.splice(existingIndex, 1);
    metaList.unshift(meta);
  } else {
    const id = uuidv4();
    meta = { id, name: file.name, size: file.size, timestamp: Date.now() };
    
    // Save actual file data as ArrayBuffer
    const fileData = await file.arrayBuffer();
    await localforage.setItem(`file_${id}`, fileData);
    
    metaList.unshift(meta);
  }
  
  // Prune old history
  if (metaList.length > MAX_HISTORY) {
    const toRemove = metaList.slice(MAX_HISTORY);
    for (const oldMeta of toRemove) {
      await localforage.removeItem(`file_${oldMeta.id}`);
    }
    metaList.length = MAX_HISTORY; // truncate
  }
  
  await localforage.setItem(HISTORY_KEY, metaList);
  window.dispatchEvent(new CustomEvent('lume-history-updated'));
  return meta;
};

export const getHistory = async (): Promise<RecentFileMeta[]> => {
  return (await localforage.getItem<RecentFileMeta[]>(HISTORY_KEY)) || [];
};

export const loadFileFromHistory = async (meta: RecentFileMeta): Promise<File | null> => {
  try {
    const data = await localforage.getItem<ArrayBuffer>(`file_${meta.id}`);
    if (!data) return null;
    return new File([data], meta.name, { type: 'application/pdf' });
  } catch (err) {
    console.error('Failed to load file from history:', err);
    return null;
  }
};

export const clearHistory = async (): Promise<void> => {
  const metaList = await getHistory();
  for (const meta of metaList) {
    await localforage.removeItem(`file_${meta.id}`);
  }
  await localforage.removeItem(HISTORY_KEY);
  window.dispatchEvent(new CustomEvent('lume-history-updated'));
};
