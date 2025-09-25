const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  importFiles: () => ipcRenderer.invoke('import-files'),
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
  selectWatermarkImage: () => ipcRenderer.invoke('select-watermark-image'),
  exportImages: (data) => ipcRenderer.invoke('export-images', data),
  saveTemplate: (templateData) => ipcRenderer.send('save-template', templateData),
  loadTemplates: () => ipcRenderer.invoke('load-templates'),
  deleteTemplate: (templateName) => ipcRenderer.send('delete-template', templateName),
  onTemplateSaved: (callback) => ipcRenderer.on('template-saved', callback),
  onTemplateDeleted: (callback) => ipcRenderer.on('template-deleted', callback)
});