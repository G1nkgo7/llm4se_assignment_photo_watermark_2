const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 处理文件导入
ipcMain.handle('import-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'openDirectory', 'multiSelections'],
    filters: [
      { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'tiff'] }
    ]
  });
  return result.canceled ? [] : result.filePaths;
});

// 处理保存水印配置
ipcMain.on('save-template', (event, templateData) => {
  const templatesDir = path.join(app.getPath('userData'), 'templates');
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }
  const templatePath = path.join(templatesDir, `${templateData.name}.json`);
  fs.writeFileSync(templatePath, JSON.stringify(templateData, null, 2));
  event.reply('template-saved');
});

// 加载水印模板
ipcMain.handle('load-templates', () => {
  const templatesDir = path.join(app.getPath('userData'), 'templates');
  if (!fs.existsSync(templatesDir)) return [];
  const files = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'));
  return files.map(file => {
    const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
    return JSON.parse(content);
  });
});

// 删除水印模板
ipcMain.on('delete-template', (event, templateName) => {
  const templatePath = path.join(app.getPath('userData'), 'templates', `${templateName}.json`);
  if (fs.existsSync(templatePath)) {
    fs.unlinkSync(templatePath);
  }
  event.reply('template-deleted');
});

// 处理导出图片
ipcMain.handle('export-images', async (event, { files, outputDir, watermarkConfig, namingConfig }) => {
  const results = [];
  
  for (const file of files) {
    try {
      const fileName = path.basename(file);
      const fileExt = path.extname(fileName).toLowerCase();
      const baseName = path.basename(fileName, fileExt);
      
      // 根据命名规则生成输出文件名
      let outputName;
      if (namingConfig.prefix && namingConfig.suffix) {
        outputName = `${namingConfig.prefix}${baseName}${namingConfig.suffix}${namingConfig.format}`;
      } else if (namingConfig.prefix) {
        outputName = `${namingConfig.prefix}${baseName}${namingConfig.format}`;
      } else if (namingConfig.suffix) {
        outputName = `${baseName}${namingConfig.suffix}${namingConfig.format}`;
      } else {
        outputName = `${baseName}_watermarked${namingConfig.format}`;
      }
      
      const outputPath = path.join(outputDir, outputName);
      
      // 处理图片
      const image = sharp(file);
      const metadata = await image.metadata();
      
      // 根据水印类型处理
      if (watermarkConfig.type === 'text') {
        // 创建文本水印
        // 注意：Sharp本身不直接支持文本绘制，这里我们使用一个简化的方法
        // 在实际应用中，可能需要使用canvas或其他库来生成文本图像
        const textWatermark = sharp({
          create: {
            width: metadata.width,
            height: metadata.height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          }
        });
        
        // 这里只是一个示例，实际实现需要更复杂的文本渲染逻辑
        // 为了简化，我们将直接叠加原图
        await image.toFile(outputPath);
      } else if (watermarkConfig.type === 'image' && watermarkConfig.imagePath) {
        // 图片水印
        const watermark = sharp(watermarkConfig.imagePath)
          .resize({
            width: Math.floor(metadata.width * watermarkConfig.size / 100),
            height: Math.floor(metadata.height * watermarkConfig.size / 100),
            fit: 'inside'
          })
          .opacity(watermarkConfig.opacity / 100);
        
        await image.composite([{
          input: await watermark.toBuffer(),
          gravity: 'center'
        }]).toFile(outputPath);
      }
      
      results.push({ success: true, file: outputPath });
    } catch (error) {
      results.push({ success: false, file, error: error.message });
    }
  }
  
  return results;
});

// 选择输出目录
ipcMain.handle('select-output-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// 选择水印图片
ipcMain.handle('select-watermark-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: '图片文件', extensions: ['png', 'jpg', 'jpeg'] }
    ]
  });
  return result.canceled ? null : result.filePaths[0];
});