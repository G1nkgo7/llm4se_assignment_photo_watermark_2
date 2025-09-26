const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipcRenderer', {
  importFiles: () => ipcRenderer.invoke('select-images'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectWatermarkImage: () => ipcRenderer.invoke('select-watermark-image'),
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
  saveImage: (dataURL, path) => ipcRenderer.invoke('save-image', dataURL, path),
  saveTemplate: (name, tpl) => ipcRenderer.invoke('save-template', name, tpl),
  getTemplates: () => ipcRenderer.invoke('get-templates'),
  deleteTemplate: (name) => ipcRenderer.invoke('delete-template', name),
  readFolderImages: (folderPath) => ipcRenderer.invoke('select-folder-for-path', folderPath),
  getPreviewDataUrl: (filePath) => ipcRenderer.invoke('get-preview-data-url', filePath),
  getDirPath: (filePath) => ipcRenderer.invoke('get-dir-path', filePath), 
});
