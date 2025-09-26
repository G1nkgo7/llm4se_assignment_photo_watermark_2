const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp'); // 确保已安装

let templates = {}; // 模板存储

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
}
// ----------------------
// 【新增】获取文件目录
// ----------------------
ipcMain.handle('get-dir-path', (event, filePath) => {
  // 使用 Node.js 的 path 模块安全地获取目录名
  return path.dirname(filePath);
});


ipcMain.handle('get-preview-data-url', async (event, filePath) => {
  // 检查是否为Tiff，如果不是，可以直接返回原始路径或进行简单读取
  if (!filePath.toLowerCase().endsWith('.tiff') && !filePath.toLowerCase().endsWith('.tif')) {
    // 对于原生支持的图片，可以直接返回数据URL
    try {
        const data = fs.readFileSync(filePath).toString('base64');
        const mimeType = path.extname(filePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg'; // 简化处理
        return `data:${mimeType};base64,${data}`;
    } catch (e) {
        console.error('读取原生图片失败:', e);
        return null;
    }
  }

  // Tiff 转换
  try {
    const buffer = await sharp(filePath)
      .resize(800) // 可选：限制预览尺寸以优化性能
      .png() // 转换为 PNG 格式
      .toBuffer();
    const base64 = buffer.toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (err) {
    console.error('Tiff 转换失败:', err);
    return null;
  }
});

// ----------------------
// 图片选择
// ----------------------
ipcMain.handle('select-images', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'tiff'] }
    ]
  });
  return result.canceled ? [] : result.filePaths;
});

// 添加批量导入文件夹的处理程序
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: '选择要导入的文件夹'
  });

  if (result.canceled) {
    return null; // 取消选择返回 null
  }

  if (!result.filePaths.length) {
    return []; // 理论上不会出现，但保险处理
  }

  const folderPath = result.filePaths[0];
  const validImageExtensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff'];
  const imageFiles = [];

  function processDir(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    files.forEach(file => {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        processDir(fullPath);
      } else if (validImageExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
        imageFiles.push(fullPath);
      }
    });
  }

  processDir(folderPath);

  return imageFiles.length ? imageFiles : []; // 空文件夹返回 []
});

ipcMain.handle('select-folder-for-path', async (event, folderPath) => {
  const validExt = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff'];
  const imageFiles = [];

  function processDir(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    files.forEach(file => {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) processDir(fullPath);
      else if (validExt.some(ext => file.name.toLowerCase().endsWith(ext))) {
        imageFiles.push(fullPath);
      }
    });
  }

  processDir(folderPath);
  return imageFiles;
});


// 拖拽文件夹递归读取图片
ipcMain.handle('read-folder-images', async (event, folderPath) => {
  const validExt = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff'];
  const imageFiles = [];

  function readDir(dir) {
    try {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      files.forEach(file => {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) readDir(fullPath);
        else if (validExt.some(ext => file.name.toLowerCase().endsWith(ext))) {
          imageFiles.push(fullPath);
        }
      });
    } catch (err) {
      console.error('读取目录失败:', dir, err);
    }
  }

  readDir(folderPath);
  return imageFiles; // 空数组也返回
});


ipcMain.handle('select-watermark-image', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PNG', extensions: ['png'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-output-dir', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// ----------------------
// 保存图片
// ----------------------
ipcMain.handle('save-image', async (event, dataURL, savePath) => {
  try {
    const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(savePath, buffer);
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
});

// ----------------------
// 模板管理
// ----------------------
ipcMain.handle('save-template', (event, name, template) => {
  templates[name] = template;
  return true;
});

ipcMain.handle('get-templates', () => {
  return templates;
});

ipcMain.handle('delete-template', (event, name) => {
  delete templates[name];
  return true;
});

// ----------------------
app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
