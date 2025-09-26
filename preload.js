const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ipcRenderer", {
  importFiles: () => ipcRenderer.invoke("select-images"),
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  selectWatermarkImage: () => ipcRenderer.invoke("select-watermark-image"),
  selectOutputDir: () => ipcRenderer.invoke("select-output-dir"),
  saveImage: (originalPath, savePath, quality, resize) =>
    ipcRenderer.invoke("save-image", originalPath, savePath, quality, resize),
  saveTemplate: (name, tpl) => ipcRenderer.invoke("save-template", name, tpl),
  exportImages: (files, outputDir, params) =>
    ipcRenderer.invoke("export-images", files, outputDir, params),
  getTemplates: () => ipcRenderer.invoke("get-templates"),
  deleteTemplate: (name) => ipcRenderer.invoke("delete-template", name),
  readFolderImages: (folderPath) =>
    ipcRenderer.invoke("select-folder-for-path", folderPath),
  getPreviewDataUrl: (filePath) =>
    ipcRenderer.invoke("get-preview-data-url", filePath),
  getDirPath: (filePath) => ipcRenderer.invoke("get-dir-path", filePath),
});
