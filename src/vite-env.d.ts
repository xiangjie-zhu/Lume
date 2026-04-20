/// <reference types="vite/client" />

declare module '*?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare namespace React {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag';
  }
}
