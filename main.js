try {
  // 仅在开发环境启用
  require("electron-reloader")(module);
} catch (_) {}

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp"); // 确保已安装
const Jimp = require("jimp");

// 定义模板和设置存储文件路径
const TEMPLATES_FILE = path.join(app.getPath('userData'), 'templates.json');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

// 初始化模板对象
let templates = {};
let lastSettings = {};

// 默认设置
const DEFAULT_SETTINGS = {
  watermarkType: 'text',
  watermarkText: 'Watermark',
  watermarkOpacity: '50',
  watermarkImageOpacity: '50',
  watermarkSize: '20',
  watermarkFont: 'Arial',
  watermarkFontSize: '40',
  watermarkColor: '#ffffff',
  watermarkRotation: '0',
  watermarkPos: { x: 50, y: 50, initiated: false }
};

// 从文件加载模板
function loadTemplatesFromFile() {
  try {
    if (fs.existsSync(TEMPLATES_FILE)) {
      const data = fs.readFileSync(TEMPLATES_FILE, 'utf8');
      templates = JSON.parse(data);
    }
  } catch (err) {
    console.error('加载模板失败:', err);
    templates = {};
  }
}

// 保存模板到文件
function saveTemplatesToFile() {
  try {
    // 确保目录存在
    const dir = path.dirname(TEMPLATES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
  } catch (err) {
    console.error('保存模板失败:', err);
  }
}

// 从文件加载设置
function loadSettingsFromFile() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      lastSettings = JSON.parse(data);
    }
  } catch (err) {
    console.error('加载设置失败:', err);
    lastSettings = {};
  }
}

// 保存设置到文件
function saveSettingsToFile(settings) {
  try {
    // 确保目录存在
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('保存设置失败:', err);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile("index.html");
}
// ----------------------
// 【新增】获取文件目录
// ----------------------
ipcMain.handle("get-dir-path", (event, filePath) => {
  // 使用 Node.js 的 path 模块安全地获取目录名
  return path.dirname(filePath);
});

// 获取图片元数据
ipcMain.handle("get-image-metadata", async (event, filePath) => {
  try {
    const metadata = await sharp(filePath).metadata();
    return metadata;
  } catch (err) {
    console.error("获取图片元数据失败:", err);
    // 对于BMP等可能不被sharp完全支持的格式，返回基本信息
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    return {
      format: ext.substring(1), // 返回文件扩展名（不带点）
      size: stats.size, // 文件大小（字节）
      width: 0, // 未知宽度
      height: 0, // 未知高度
    };
    // 不再抛出错误，而是返回基本信息，确保图片能正常导入
  }
});

ipcMain.handle("get-preview-data-url", async (event, filePath) => {
  try {
    // 使用sharp库处理所有图片格式，包括BMP
    const buffer = await sharp(filePath)
      .resize(800) // 限制预览尺寸以优化性能
      .png() // 转换为PNG格式进行预览
      .toBuffer();
    const base64 = buffer.toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch (err) {
    console.error("图片处理失败:", err);
    // 如果sharp处理失败，尝试直接读取（针对简单格式）
    try {
      const data = fs.readFileSync(filePath).toString("base64");
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = "image/jpeg";
      if (ext === ".png") mimeType = "image/png";
      if (ext === ".bmp") mimeType = "image/bmp";
      return `data:${mimeType};base64,${data}`;
    } catch (e) {
      console.error("直接读取图片也失败:", e);
      return null;
    }
  }
});

// ----------------------
// 图片选择
// ----------------------
ipcMain.handle("select-images", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "tiff"] }],
  });
  return result.canceled ? [] : result.filePaths;
});

// 添加批量导入文件夹的处理程序
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "选择要导入的文件夹",
  });

  if (result.canceled) {
    return null; // 取消选择返回 null
  }

  if (!result.filePaths.length) {
    return []; // 理论上不会出现，但保险处理
  }

  const folderPath = result.filePaths[0];
  const validImageExtensions = [".jpg", ".jpeg", ".png", ".tiff"];
  const imageFiles = [];

  function processDir(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    files.forEach((file) => {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        processDir(fullPath);
      } else if (
        validImageExtensions.some((ext) =>
          file.name.toLowerCase().endsWith(ext)
        )
      ) {
        imageFiles.push(fullPath);
      }
    });
  }

  processDir(folderPath);

  return imageFiles.length ? imageFiles : []; // 空文件夹返回 []
});

ipcMain.handle("select-folder-for-path", async (event, folderPath) => {
  const validExt = [".jpg", ".jpeg", ".png", ".tiff"];
  const imageFiles = [];

  function processDir(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    files.forEach((file) => {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) processDir(fullPath);
      else if (validExt.some((ext) => file.name.toLowerCase().endsWith(ext))) {
        imageFiles.push(fullPath);
      }
    });
  }

  processDir(folderPath);
  return imageFiles;
});

// 拖拽文件夹递归读取图片
ipcMain.handle("read-folder-images", async (event, folderPath) => {
  const validExt = [".jpg", ".jpeg", ".png", ".tiff"];
  const imageFiles = [];

  function readDir(dir) {
    try {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      files.forEach((file) => {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) readDir(fullPath);
        else if (
          validExt.some((ext) => file.name.toLowerCase().endsWith(ext))
        ) {
          imageFiles.push(fullPath);
        }
      });
    } catch (err) {
      console.error("读取目录失败:", dir, err);
    }
  }

  readDir(folderPath);
  return imageFiles; // 空数组也返回
});

ipcMain.handle("select-watermark-image", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "PNG", extensions: ["png"] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("select-output-dir", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("export-images", async (event, files, outputDir, params) => {
  const results = [];
  for (const file of files) {
    try {
      let image;
      try {
        // 尝试直接用 sharp 打开
        image = sharp(file);
        await image.metadata(); // 验证文件格式是否可读
      } catch (err) {
        // 如果是 BMP 文件且 sharp 无法读取，则自动转为 PNG 再继续
        if (path.extname(file).toLowerCase() === ".bmp") {
          console.warn("检测到不支持的 BMP，使用 Jimp 转换：", file);
          const tempPath = file + ".tmp.png";
          try {
            const bmp = await Jimp.read(file);
            await bmp.writeAsync(tempPath);
            image = sharp(tempPath);
          } catch (e) {
            console.error("Jimp 转换 BMP 失败:", e);
            throw e;
          } finally {
            // ✅ 延迟删除临时文件，确保文件被 Sharp 打开后再清理
            setTimeout(() => {
              fs.unlink(tempPath, (err) => {
                if (err)
                  console.warn("删除临时文件失败:", tempPath, err.message);
                else console.log("已删除临时文件:", tempPath);
              });
            }, 3000); // 给 Sharp 一点时间读取完成
          }
        } else {
          throw err; // 其他类型错误照常处理
        }
      }

      // 获取元数据（宽高等）
      const metadata = await image.metadata();
      let finalWidth = metadata.width;
      let finalHeight = metadata.height;

      // 缩放
      if (params.resize && params.resize !== 100) {
        image = image.resize({
          width: Math.round((metadata.width * params.resize) / 100),
        });
        // 重新获取缩放后的元数据
        const resizedMetadata = await image.metadata();
        finalWidth = resizedMetadata.width;
        finalHeight = resizedMetadata.height;
      }

      // 文字水印
      if (params.wmType === "text" && params.wmText) {
        // 设置字体样式
        let fontWeight = params.wmBold ? "bold" : "normal";
        let fontStyle = params.wmItalic ? "italic" : "normal";
        let fontSize = params.wmFontSize || 40;
        let fontFamily = params.wmFont || "sans-serif";

        // 获取水印相对位置
        const watermarkRelPos = params.watermarkRelativePos;

        // 计算绝对中心点坐标 - 与renderer.js中的calculateWatermarkPosition函数保持一致
        let centerAbsX = Math.round((watermarkRelPos.x / 100) * finalWidth);
        let centerAbsY = Math.round((watermarkRelPos.y / 100) * finalHeight);

        // 对于文本水印，我们也需要确保它不会超出图片边界
        // 但由于文本水印是基于中心点定位的，我们需要进行特殊处理
        // 注：这里简化处理，实际项目中可能需要根据文本的实际尺寸进行更精确的计算
        // 为了与预览拖拽逻辑保持一致，我们添加了与图片水印类似的边缘处理注释

        // 获取旋转角度（默认为0）
        const rotation = parseInt(params.wmRotation) || 0;
        
        // 创建文本元素的属性，添加旋转支持
        let textAttrs = `
          x="${centerAbsX}"
          y="${centerAbsY}"
          font-size="${fontSize}"
          font-family="${fontFamily}"
          font-weight="${fontWeight}"
          font-style="${fontStyle}"
          fill="${params.wmColor || "#ffffff"}"
          opacity="${params.wmOpacity / 100}"
          text-anchor="middle"
          dominant-baseline="middle"`;
        
        // 如果有旋转角度，添加transform属性
        if (rotation !== 0) {
          textAttrs += `\n          transform="rotate(${rotation} ${centerAbsX} ${centerAbsY})"`;
        }

        // 构建SVG内容
        let svgContent = `<svg width="${finalWidth}" height="${finalHeight}">`;

        // 如果需要描边效果，先添加描边的文本
        if (params.wmStroke) {
          // 为描边文本创建不带fill的属性
          const strokeAttrs = textAttrs.replace(/fill="[^"]*"\s*/, "");
          svgContent += `
            <text${strokeAttrs}
              fill="none"
              stroke="rgba(0, 0, 0, 0.7)"
              stroke-width="1">
              ${params.wmText}
            </text>`;
        }

        // 添加填充的文本（带或不带阴影）
        if (params.wmShadow) {
          svgContent += `
            <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
              <feOffset dx="2" dy="2" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.5"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>`;
          svgContent += `
            <text${textAttrs} filter="url(#dropShadow)">
              ${params.wmText}
            </text>`;
        } else {
          svgContent += `
            <text${textAttrs}>
              ${params.wmText}
            </text>`;
        }

        svgContent += "</svg>";

        image = image.composite([{ input: Buffer.from(svgContent) }]);
      }

      // 图片水印
      if (params.wmType === "image" && params.wmImgPath) {
        try {
          // 获取水印相对位置
          const watermarkRelPos = params.watermarkRelativePos;
          // 获取旋转角度
          const rotation = parseInt(params.wmRotation) || 0;

          // 【修正点】根据最终图片宽度和百分比计算水印宽度
          const watermarkSizePercentage = params.wmSize;
          const wmWidth = Math.round(
            finalWidth * (watermarkSizePercentage / 100)
          );

          // 准备水印图层：加载水印图片并缩放到计算出的像素宽度
          let watermarkImage = sharp(params.wmImgPath).resize(wmWidth, null);

          // 如果有旋转角度，应用旋转变换
          if (rotation !== 0) {
            // 使用sharp的rotate方法应用旋转
            watermarkImage = watermarkImage.rotate(rotation, {
              background: { r: 0, g: 0, b: 0, alpha: 0 } // 透明背景
            });
          }

          // 获取水印图层缩放后的实际尺寸
          const wmMetadata = await watermarkImage.metadata();
          const scaledWidth = wmMetadata.width;
          const scaledHeight = wmMetadata.height;

          // 调整水印图片大小并转换为Buffer
          const wm = await watermarkImage.png().toBuffer();

          // 确保与预览拖拽逻辑完全一致
          // 根据相对位置直接计算左上角坐标 - 与renderer.js中的calculateWatermarkPosition函数保持一致
          // 注意：对于旋转后的图片，需要计算旋转后的中心点位置
          const centerX = Math.round((watermarkRelPos.x / 100) * finalWidth);
          const centerY = Math.round((watermarkRelPos.y / 100) * finalHeight);
          
          // 计算左上角坐标
          let adjustedLeft = centerX - scaledWidth / 2;
          let adjustedTop = centerY - scaledHeight / 2;

          // 改进边缘校正逻辑，确保水印不超出图片边界
          // 与renderer.js中的拖拽边界逻辑保持一致
          // 第一步：确保左上角坐标不小于0
          adjustedLeft = Math.max(0, adjustedLeft);
          adjustedTop = Math.max(0, adjustedTop);

          // 第二步：确保水印不会超出右边缘和下边缘
          // 与renderer.js中的拖拽边界逻辑完全匹配，使用-1允许水印几乎到达边缘
          if (adjustedLeft + scaledWidth > finalWidth) {
            adjustedLeft = finalWidth - scaledWidth - 1;
          }
          if (adjustedTop + scaledHeight > finalHeight) {
            adjustedTop = finalHeight - scaledHeight - 1;
          }

          // 第三步：最后再次确保不小于0，防止极端情况下出现负值
          adjustedLeft = Math.max(0, adjustedLeft);
          adjustedTop = Math.max(0, adjustedTop);

          // 使用Sharp的composite直接应用水印，而不是通过SVG
          image = image.composite([
            {
              input: wm,
              left: adjustedLeft,
              top: adjustedTop,
              // 确保应用透明度
              opacity: params.wmImgOpacity / 100,
            },
          ]);
        } catch (err) {
          console.error("处理水印图片时出错:", err);
        }
      }

      // 输出文件名
      console.log("处理文件:", file);
      console.log("水印类型:", params.wmType);

      // 如果当前是 BMP 转换生成的临时 PNG，去掉 ".tmp.png"
      let originalFilePath = file;
      if (file.endsWith(".tmp.png")) {
        originalFilePath = file.replace(/\.tmp\.png$/, "");
      }

      // 获取原始文件名（去掉扩展名）
      const filename = path.basename(
        originalFilePath,
        path.extname(originalFilePath)
      );

      // 确定输出格式（加上点号）
      let format = params.format || "";
      if (format && !format.startsWith(".")) format = "." + format;

      // 生成输出文件名
      const outName = `${params.prefix ? params.prefix + "_" : ""}${filename}${
        params.suffix ? "_" + params.suffix : ""
      }${format}`;

      // 拼接输出路径
      const outPath = path.join(outputDir, outName);

      console.log("输出路径:", outPath);

      try {
        if (params.format === ".jpg") {
          await image.jpeg({ quality: params.quality }).toFile(outPath);
        } else {
          await image.toFile(outPath);
        }
        console.log("文件保存成功:", outPath);
        results.push({ file, outPath, success: true });
      } catch (saveError) {
        console.error("文件保存失败:", outPath, "错误:", saveError);
        results.push({
          file,
          outPath,
          error: saveError.message,
          success: false,
        });
      }
    } catch (err) {
      results.push({ file, error: err.message, success: false });
    }
  }
  return results;
});

// ----------------------
// 保存预览图片 (直接从预览画布导出)
// ----------------------
ipcMain.handle(
  "save-preview-image",
  async (event, imageData, savePath) => {
    try {
      // 移除data URL前缀
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      
      // 解码base64数据
      const buffer = Buffer.from(base64Data, "base64");
      
      // 确保目录存在
      const dir = path.dirname(savePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // 写入文件
      fs.writeFileSync(savePath, buffer);
      console.log("预览图片保存成功:", savePath);
      return true;
    } catch (error) {
      console.error("保存预览图片失败:", error);
      return false;
    }
  }
);

// ----------------------
// 保存图片
// ----------------------
ipcMain.handle(
  "save-image",
  async (event, originalPath, savePath, quality, resize) => {
    try {
      let image = sharp(originalPath);

      // 获取源信息
      const metadata = await image.metadata();

      // 缩放
      const resizeValue = parseInt(resize);
      if (resizeValue !== 100) {
        const newWidth = Math.round(metadata.width * (resizeValue / 100));
        image = image.resize(newWidth, null);
      }

      // 输出格式
      let ext = path.extname(savePath).toLowerCase();
      if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
        // 强制转 jpg
        savePath = savePath + ".jpg";
        ext = ".jpg";
      }

      if (ext === ".jpg" || ext === ".jpeg") {
        image = image.jpeg({ quality: quality || 80 });
      } else if (ext === ".png") {
        image = image.png();
      }

      await image.toFile(savePath);
      return true;
    } catch (err) {
      console.error("保存/处理图片失败:", err);
      return false;
    }
  }
);

// ----------------------
// 模板管理
// ----------------------
ipcMain.handle("save-template", (event, name, template) => {
  templates[name] = template;
  saveTemplatesToFile(); // 保存到文件
  return true;
});

ipcMain.handle("get-templates", () => {
  return templates;
});

ipcMain.handle("delete-template", (event, name) => {
  delete templates[name];
  saveTemplatesToFile(); // 保存到文件
  return true;
});

// 添加设置相关的IPC处理器
ipcMain.handle('save-settings', (event, settings) => {
  lastSettings = settings;
  saveSettingsToFile(settings);
  return true;
});

ipcMain.handle('get-settings', () => {
  // 如果没有上次的设置，返回默认设置
  if (Object.keys(lastSettings).length === 0) {
    return DEFAULT_SETTINGS;
  }
  return lastSettings;
});

ipcMain.handle('get-default-template', () => {
  return DEFAULT_SETTINGS;
});

// ----------------------
app.whenReady().then(() => {
  loadTemplatesFromFile(); // 应用启动时加载模板
  loadSettingsFromFile(); // 应用启动时加载设置
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
