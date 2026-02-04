// Type declaration for optional Three.js dependency
// This allows the import to work even if three.js is not installed
declare module 'three' {
  const content: any;
  export = content;
}
