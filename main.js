try {
  // 仅在开发环境启用
  require("electron-reloader")(module);
} catch (_) {}

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp"); // 确保已安装

let templates = {}; // 模板存储

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

ipcMain.handle("get-preview-data-url", async (event, filePath) => {
  // 检查是否为Tiff，如果不是，可以直接返回原始路径或进行简单读取
  if (
    !filePath.toLowerCase().endsWith(".tiff") &&
    !filePath.toLowerCase().endsWith(".tif")
  ) {
    // 对于原生支持的图片，可以直接返回数据URL
    try {
      const data = fs.readFileSync(filePath).toString("base64");
      const mimeType =
        path.extname(filePath).toLowerCase() === ".png"
          ? "image/png"
          : "image/jpeg"; // 简化处理
      return `data:${mimeType};base64,${data}`;
    } catch (e) {
      console.error("读取原生图片失败:", e);
      return null;
    }
  }

  // Tiff 转换
  try {
    const buffer = await sharp(filePath)
      .resize(800) // 可选：限制预览尺寸以优化性能
      .png() // 转换为 PNG 格式
      .toBuffer();
    const base64 = buffer.toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch (err) {
    console.error("Tiff 转换失败:", err);
    return null;
  }
});

// ----------------------
// 图片选择
// ----------------------
ipcMain.handle("select-images", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Images", extensions: ["jpg", "jpeg", "png", "bmp", "tiff"] },
    ],
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
  const validImageExtensions = [".jpg", ".jpeg", ".png", ".bmp", ".tiff"];
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
  const validExt = [".jpg", ".jpeg", ".png", ".bmp", ".tiff"];
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
  const validExt = [".jpg", ".jpeg", ".png", ".bmp", ".tiff"];
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
      let image = sharp(file);

      // 获取元数据（宽高等）
      const metadata = await image.metadata();

      // 缩放
      if (params.resize && params.resize !== 100) {
        image = image.resize({
          width: Math.round((metadata.width * params.resize) / 100),
        });
      }

      // 文字水印
      if (params.wmType === "text" && params.wmText) {
        const svg = `
          <svg width="${metadata.width}" height="${metadata.height}">
            <text x="${params.wmPos.x}" y="${params.wmPos.y}"
              font-size="40" font-family="sans-serif" fill="#ffffff" opacity="${params.wmOpacity / 100}">
              ${params.wmText}
            </text>
          </svg>`;
        image = image.composite([{ input: Buffer.from(svg) }]);
      }

      // 图片水印
      if (params.wmType === "image" && params.wmImgPath) {
        try {
          // 获取水印图片的元数据
          const wmMetadata = await sharp(params.wmImgPath).metadata();
          // 计算水印图片的缩放后的尺寸
          const scale = params.wmSize / 100;
          const scaledWidth = Math.round(wmMetadata.width * scale);
          const scaledHeight = Math.round(wmMetadata.height * scale);
          
          // 调整水印图片大小并应用透明度
          const wm = await sharp(params.wmImgPath)
            .resize({ width: scaledWidth, height: scaledHeight })
            .png()
            .toBuffer();
            
          // 创建一个临时的SVG来应用透明度
          const svgWithOpacity = `
            <svg width="${metadata.width}" height="${metadata.height}">
              <image x="${params.wmPos.x}" y="${params.wmPos.y}" 
                width="${scaledWidth}" height="${scaledHeight}" 
                href="data:image/png;base64,${wm.toString('base64')}" 
                opacity="${params.wmImgOpacity / 100}"/>
            </svg>`;
          
          image = image.composite([{ input: Buffer.from(svgWithOpacity) }]);
        } catch (err) {
          console.error('处理水印图片时出错:', err);
        }
      }

      // 输出文件名
      const filename = path.basename(file, path.extname(file));
      const outName = `${params.prefix ? params.prefix + "_" : ""}${filename}${
        params.suffix ? "_" + params.suffix : ""
      }${params.format}`;
      const outPath = path.join(outputDir, outName);

      if (params.format === ".jpg") {
        await image.jpeg({ quality: params.quality }).toFile(outPath);
      } else {
        await image.toFile(outPath);
      }

      results.push({ file, outPath, success: true });
    } catch (err) {
      results.push({ file, error: err.message, success: false });
    }
  }
  return results;
});


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
  return true;
});

ipcMain.handle("get-templates", () => {
  return templates;
});

ipcMain.handle("delete-template", (event, name) => {
  delete templates[name];
  return true;
});

// ----------------------
app.whenReady().then(() => {
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
