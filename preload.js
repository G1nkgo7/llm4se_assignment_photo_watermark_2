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
  getFolderForPath: (folderPath) =>
    ipcRenderer.invoke("select-folder-for-path", folderPath),
  getPreviewDataUrl: (filePath) =>
    ipcRenderer.invoke("get-preview-data-url", filePath),
  getDirPath: (filePath) => ipcRenderer.invoke("get-dir-path", filePath),
  getImageMetadata: (filePath) =>
    ipcRenderer.invoke("get-image-metadata", filePath),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  getDefaultTemplate: () => ipcRenderer.invoke("get-default-template"),
  // 新增：保存预览图片的方法
  savePreviewImage: (imageData, savePath) =>
    ipcRenderer.invoke("save-preview-image", imageData, savePath),
});
