let importedFiles = [];
let currentImageIndex = 0;
let outputDir = "";
let watermarkImagePath = null;
let thumbnailCache = {};

// DOM元素
const importBtn = document.getElementById("import-btn");
const importFolderBtn = document.getElementById("import-folder-btn");
const exportBtn = document.getElementById("export-btn");
const imageThumbnails = document.getElementById("image-thumbnails");
const previewContainer = document.getElementById("preview-container");
const filenamePreview = document.getElementById("filename-preview");

// Canvas 相关的 DOM 元素和上下文 (从 index.html 移动过来)
const previewCanvas = document.getElementById("preview-canvas");
const noPreview = document.getElementById("no-preview");
const ctx = previewCanvas.getContext("2d"); // 获取 Canvas 上下文

const watermarkText = document.getElementById("watermark-text");
const watermarkOpacity = document.getElementById("watermark-opacity");
const opacityValue = document.getElementById("opacity-value");
const watermarkSize = document.getElementById("watermark-size");
const sizeValue = document.getElementById("size-value");
const watermarkImageOpacity = document.getElementById(
  "watermark-image-opacity"
);
const imageOpacityValue = document.getElementById("image-opacity-value");
const watermarkTypeRadios = document.querySelectorAll(
  'input[name="watermark-type"]'
);
const textSettings = document.getElementById("text-settings");
const imageSettings = document.getElementById("image-settings");
const selectWatermarkBtn = document.getElementById("select-watermark-btn");
const watermarkImagePathEl = document.getElementById("watermark-image-path");
const selectOutputBtn = document.getElementById("select-output-btn");
const outputDirEl = document.getElementById("output-dir");
const outputFormat = document.getElementById("output-format");
const filePrefix = document.getElementById("file-prefix");
const fileSuffix = document.getElementById("file-suffix");
const jpegQualitySettings = document.getElementById("jpeg-quality-settings");
const jpegQuality = document.getElementById("jpeg-quality");
const qualityValue = document.getElementById("quality-value");
const resizePercentage = document.getElementById("resize-percentage");
const resizeValue = document.getElementById("resize-value");

const saveTemplateBtn = document.getElementById("save-template-btn");
const templateNameInput = document.getElementById("template-name");
const templatesList = document.getElementById("templates-list");

// 【新增】自定义弹窗 DOM 元素
const customAlertOverlay = document.getElementById("custom-alert-overlay");
const customAlertMessage = document.getElementById("custom-alert-message");
const customAlertClose = document.getElementById("custom-alert-close");

// 水印位置和拖拽状态 (从 index.html 移动过来)
let watermarkPos = { x: 50, y: 50 };
let isDragging = false;

// ----------------------
// JPEG 质量和缩放百分比实时显示
// ----------------------
jpegQuality.addEventListener("input", () => {
  qualityValue.textContent = jpegQuality.value;
});

resizePercentage.addEventListener("input", () => {
  resizeValue.textContent = resizePercentage.value;
});

// ----------------------
// 格式切换时显示/隐藏 JPEG 质量设置
// ----------------------
outputFormat.addEventListener("change", () => {
  if (outputFormat.value === ".jpg") {
    jpegQualitySettings.style.display = "block";
  } else {
    jpegQualitySettings.style.display = "none";
  }
  updateFilenamePreview();
});

// 初始化时检查一次
window.addEventListener("load", () => {
  if (outputFormat.value !== ".jpg") {
    jpegQualitySettings.style.display = "none";
  }
  setTimeout(updateFilenamePreview, 50);
});

// ----------------------
// 点击导入图片
// ----------------------
importBtn.addEventListener("click", async () => {
  const files = await window.ipcRenderer.importFiles();
  if (files && files.length) {
    importedFiles.push(...files);
    currentImageIndex = importedFiles.length - files.length;
    renderImageThumbnails();
    drawPreview(); // 直接调用
    updateFilenamePreview();
  }
});

// 批量导入文件夹
importFolderBtn.addEventListener("click", async () => {
  try {
    const files = await window.ipcRenderer.selectFolder();
    if (files === null) return;
    if (!Array.isArray(files)) throw new Error("返回值不是数组");
    if (files.length === 0) {
      showAlert("所选文件夹中未找到图片文件");
      return;
    }
    importedFiles.push(...files);
    currentImageIndex = importedFiles.length - files.length;
    renderImageThumbnails();
    try {
      drawPreview();
    } catch (error) {
      console.error("drawPreview 出错:", error);
    } // 直接调用
    updateFilenamePreview();
  } catch (error) {
    console.error("导入文件夹时出错:", error);
    showAlert("导入文件夹失败，请重试");
  }
});

// ----------------------
// 拖拽导入（整个窗口悬浮）
// ----------------------
let isDragOverWindow = false;

async function handleDrop(e) {
  e.preventDefault();
  previewContainer.classList.remove("drag-over");
  isDragOverWindow = false;

  const items = e.dataTransfer.items;
  if (!items) return;

  const imageFiles = [];

  async function traverseFileTree(entry) {
    return new Promise((resolve) => {
      if (entry.isFile) {
        entry.file((file) => {
          if (/\.(jpg|jpeg|png|bmp|tiff)$/i.test(file.name)) {
            imageFiles.push(file.path);
          }
          resolve();
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        dirReader.readEntries(async (entries) => {
          for (const e of entries) {
            await traverseFileTree(e);
          }
          resolve();
        });
      }
    });
  }

  const promises = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      promises.push(traverseFileTree(entry));
    } else if (item.kind === "file") {
      const file = item.getAsFile();
      if (file && /\.(jpg|jpeg|png|bmp|tiff)$/i.test(file.name)) {
        imageFiles.push(file.path);
      }
    }
  }

  await Promise.all(promises);

  if (!imageFiles.length) return;

  importedFiles.push(...imageFiles);
  currentImageIndex = importedFiles.length - imageFiles.length;
  renderImageThumbnails();
  drawPreview(); // 直接调用
}

// 监听整个窗口拖拽
window.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (!isDragOverWindow) {
    previewContainer.classList.add("drag-over");
    isDragOverWindow = true;
  }
});

window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  // 仅当鼠标离开窗口边界才取消高亮
  if (
    e.clientX <= 0 ||
    e.clientY <= 0 ||
    e.clientX >= window.innerWidth ||
    e.clientY >= window.innerHeight
  ) {
    previewContainer.classList.remove("drag-over");
    isDragOverWindow = false;
  }
});

window.addEventListener("drop", handleDrop);

// ----------------------
// 渲染缩略图
// ----------------------
function renderImageThumbnails() {
  imageThumbnails.innerHTML = "";
  importedFiles.forEach(async (file, index) => {
    // 【核心改动 1】：检查缓存
    let dataUrl = thumbnailCache[file];

    if (!dataUrl) {
      // 缓存中没有，才调用 IPC 异步获取
      dataUrl = await window.ipcRenderer.getPreviewDataUrl(file);
      if (dataUrl) {
        // 【核心改动 2】：存入缓存
        thumbnailCache[file] = dataUrl;
      }
    }

    const div = document.createElement("div");
    div.className =
      "thumbnail" + (index === currentImageIndex ? " active" : "");

    // 如果获取失败，设置一个透明像素占位符
    const imgSrc =
      dataUrl ||
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    div.innerHTML = `
      <img src="${imgSrc}" />
      <div class="filename">${file.split(/[/\\]/).pop()}</div>
    `;
    div.addEventListener("click", () => {
      selectImage(index);
    });
    imageThumbnails.appendChild(div);
  });
}

// ----------------------
// Canvas水印实时预览 & 图片切换 (从 index.html 移动过来)
// ----------------------

async function drawPreview() {
  if (!importedFiles[currentImageIndex]) {
    // 如果没有图片，则显示提示
    noPreview.style.display = "block";
    return;
  } else {
    noPreview.style.display = "none";
  }

  // 核心修改：异步获取图片的 Base64 数据 URL
  const file = importedFiles[currentImageIndex];
  // 假设 window.ipcRenderer.getPreviewDataUrl 负责将图片（包括tiff）转换为 Base64/DataURL
  const dataUrl = await window.ipcRenderer.getPreviewDataUrl(file);

  if (!dataUrl) {
    console.error("无法加载或转换图片:", file);
    noPreview.style.display = "block"; // 加载失败也显示无预览
    return;
  }

  const img = new Image();
  img.src = dataUrl; // 使用 Base64 数据 URL 作为源

  img.onload = () => {
    // 调整 Canvas 尺寸以匹配图片
    previewCanvas.width = img.width;
    previewCanvas.height = img.height;
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.drawImage(img, 0, 0);

    const wmType = document.querySelector(
      'input[name="watermark-type"]:checked'
    ).value;
    if (wmType === "text" && watermarkText.value) {
      // 文本水印
      ctx.globalAlpha = watermarkOpacity.value / 100;
      ctx.fillStyle = "#ffffff";
      ctx.font = "40px sans-serif";
      ctx.fillText(watermarkText.value, watermarkPos.x, watermarkPos.y);
      ctx.globalAlpha = 1.0;
    } else if (wmType === "image" && watermarkImagePath) {
      // 图片水印
      const wmImg = new Image();
      wmImg.src = watermarkImagePath;
      wmImg.onload = () => {
        const scale = watermarkSize.value / 100;
        const w = wmImg.width * scale;
        const h = wmImg.height * scale;
        ctx.globalAlpha = watermarkImageOpacity.value / 100;
        ctx.drawImage(wmImg, watermarkPos.x, watermarkPos.y, w, h);
        ctx.globalAlpha = 1.0;
      };
    }
  };
}

// 绑定文件名预览的实时更新
[filePrefix, fileSuffix, outputFormat].forEach((el) => {
  el.addEventListener("input", updateFilenamePreview);
  el.addEventListener("change", updateFilenamePreview); // 针对 select 元素
});

function selectImage(index) {
  if (index < 0 || index >= importedFiles.length) return;
  currentImageIndex = index;
  renderImageThumbnails();
  drawPreview();
  updateFilenamePreview();
}

// ----------------------
// 绑定输入变化刷新 (从 index.html 移动过来)
// ----------------------
[watermarkText, watermarkOpacity, watermarkSize, watermarkImageOpacity].forEach(
  (el) => {
    el.addEventListener("input", drawPreview);
  }
);

// ----------------------
// 水印拖拽 (从 index.html 移动过来)
// ----------------------
previewCanvas.addEventListener("mousedown", (e) => {
  const rect = previewCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  // 简单判断点击范围（可优化）
  if (Math.abs(x - watermarkPos.x) < 100 && Math.abs(y - watermarkPos.y) < 50) {
    isDragging = true;
  }
});

previewCanvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const rect = previewCanvas.getBoundingClientRect();
  watermarkPos.x = e.clientX - rect.left;
  watermarkPos.y = e.clientY - rect.top;
  drawPreview();
});

previewCanvas.addEventListener("mouseup", (e) => {
  isDragging = false;
});

previewCanvas.addEventListener("mouseleave", (e) => {
  isDragging = false;
});

// ----------------------
// 选择水印图片
// ----------------------
selectWatermarkBtn.addEventListener("click", async () => {
  const file = await window.ipcRenderer.selectWatermarkImage();
  if (file) {
    watermarkImagePath = file;
    watermarkImagePathEl.textContent = file;
    drawPreview();
  }
});

// ----------------------
// 选择输出目录
// ----------------------
selectOutputBtn.addEventListener("click", async () => {
  const dir = await window.ipcRenderer.selectOutputDir();
  if (dir) {
    // 1. 如果有导入图片，执行检查
    if (importedFiles.length > 0) {
      // 必须使用 await 等待异步检查结果
      if (await isExportingToSourceDirectory(dir, importedFiles)) {
        showAlert("输出目录不能是原图所在的文件夹！请选择新的目录。");
        // 如果冲突，则不更新 outputDir，禁止选择该目录
        return;
      }
    }

    // 2. 检查通过或没有导入图片时，设置目录
    outputDir = dir;
    outputDirEl.textContent = dir;
  }
});

// ----------------------
// 导出图片
// ----------------------
// ----------------------
// 【新增】检查是否导出到源文件夹的异步函数
// ----------------------

/**
 * 检查输出目录是否与任何一张导入图片的原目录相同
 * 使用 IPC 调用 main 进程的 path.dirname() 来安全地获取目录。
 * @param {string} outputDir - 用户选择的输出目录
 * @param {string[]} importedFiles - 所有导入文件的路径数组
 * @returns {Promise<boolean>} - 如果有冲突返回 true，否则返回 false
 */
async function isExportingToSourceDirectory(outputDir, importedFiles) {
  // 规范化输出目录：去除末尾的斜杠，并转换为小写进行不区分大小写的比较
  const normalizedOutputDir = outputDir.replace(/[/\\]+$/, "").toLowerCase();

  for (const filePath of importedFiles) {
    // 异步调用 IPC 方法获取文件所在的目录
    const sourceDir = await window.ipcRenderer.getDirPath(filePath);
    // 规范化源目录
    const normalizedSourceDir = sourceDir.replace(/[/\\]+$/, "").toLowerCase();
    if (normalizedSourceDir === normalizedOutputDir) {
      //  showAlert(`检查文件 ${normalizedSourceDir} 所在目录：${normalizedOutputDir}`);
      return true; // 发现冲突
    }
  }
  return false; // 没有发现冲突
}
// renderer.js (新增函数)

/**
 * 根据当前设置和选中的图片，更新文件名预览
 */
function updateFilenamePreview() {
  if (!importedFiles.length) {
    filenamePreview.textContent = "文件名预览: 请导入图片";
    return;
  }

  // 获取当前选中图片的基本名称
  const originalPath = importedFiles[currentImageIndex];
  const filename = originalPath.split(/[/\\]/).pop();
  const baseName = filename.replace(/\.[^/.]+$/, "");

  const format = outputFormat.value || ".png";
  const rawPrefix = filePrefix.value.trim();
  const rawSuffix = fileSuffix.value.trim();

  // 构建前缀和后缀，如果非空则加下划线
  const pre = rawPrefix ? `${rawPrefix}_` : "";
  const suf = rawSuffix ? `_${rawSuffix}` : "";

  // 组合文件名
  const outName = `${pre}${baseName}${suf}${format}`;

  filenamePreview.textContent = `文件名预览: ${outName}`;
}

function showAlert(message) {
  customAlertMessage.textContent = message;
  customAlertOverlay.style.display = "flex";
}

// 绑定关闭事件
customAlertClose.addEventListener("click", () => {
  customAlertOverlay.style.display = "none";
});

// ----------------------
// 导出图片 (关键修改：替换 alert，并在 finally 中恢复)
// ----------------------
// renderer.js
exportBtn.addEventListener("click", async () => {
  if (!importedFiles.length) {
    showAlert("请导入图片！");
    return;
  }

  if (!outputDir) {
    showAlert("请选择输出目录！");
    return;
  }

  if (await isExportingToSourceDirectory(outputDir, importedFiles)) {
    showAlert("输出目录不能是原图所在的文件夹！");
    return;
  }

  const exportParams = {
    format: outputFormat.value,
    quality: outputFormat.value === ".jpg" ? parseInt(jpegQuality.value) : 100,
    resize: parseInt(resizePercentage.value),
    prefix: filePrefix.value.trim(),
    suffix: fileSuffix.value.trim(),
    wmType: document.querySelector('input[name="watermark-type"]:checked').value,
    wmText: watermarkText.value,
    wmOpacity: watermarkOpacity.value,
    wmImgPath: watermarkImagePath,
    wmImgOpacity: watermarkImageOpacity.value,
    wmSize: watermarkSize.value,
    wmPos: watermarkPos,
  };

  try {
    await window.ipcRenderer.exportImages(importedFiles, outputDir, exportParams);
    showAlert("导出完成！");
  } catch (err) {
    console.error("导出失败:", err);
    showAlert("导出失败，请查看控制台。");
  }
});


// renderer.js (替换 saveImage 函数)

function saveImage(canvasEl, originalPath, exportParams) {
  // 从参数中获取格式、质量和缩放百分比
  const { format, quality, resize } = exportParams;

  const rawPrefix = filePrefix.value.trim();
  const rawSuffix = fileSuffix.value.trim();

  // 核心逻辑：如果前缀不为空，则加上下划线并放在末尾；否则为空字符串
  const pre = rawPrefix ? `${rawPrefix}_` : "";

  // 核心逻辑：如果后缀不为空，则加上下划线并放在开头；否则为空字符串
  const suf = rawSuffix ? `_${rawSuffix}` : "";

  const filename = originalPath.split(/[/\\]/).pop();
  const baseName = filename.replace(/\.[^/.]+$/, "");

  // 组合：前缀 + 文件名本体 + 后缀 + 格式
  const outName = `${pre}${baseName}${suf}${format}`;

  // ----------------------------------------------------
  // 关键修改：不再使用 canvas.toDataURL，而是将所有参数发送给 main.js
  // ----------------------------------------------------
  window.ipcRenderer.saveImage(
    originalPath, // 传递原图路径 (main.js 将使用 sharp 来处理)
    `${outputDir}/${outName}`, // 目标保存路径
    quality, // JPEG 质量
    resize // 缩放百分比
  );
}

// ----------------------
// 模板管理
// ----------------------
saveTemplateBtn.addEventListener("click", () => {
  const name = templateNameInput.value.trim();
  if (!name) return showAlert("请输入模板名称");
  const template = {
    type: document.querySelector('input[name="watermark-type"]:checked').value,
    text: watermarkText.value,
    opacity: watermarkOpacity.value,
    imgPath: watermarkImagePath,
    imgOpacity: watermarkImageOpacity.value,
    imgSize: watermarkSize.value,
    pos: { ...watermarkPos },
  };
  window.ipcRenderer.saveTemplate(name, template);
  loadTemplates();
});

function loadTemplates() {
  window.ipcRenderer.getTemplates().then((templates) => {
    templatesList.innerHTML = "";
    if (!templates || Object.keys(templates).length === 0) {
      templatesList.innerHTML = "<p>无保存的模板</p>";
      return;
    }
    Object.entries(templates).forEach(([name, tpl]) => {
      const div = document.createElement("div");
      div.className = "template-item";
      div.innerHTML = `
        <span>${name}</span>
        <button data-name="${name}">删除</button>
      `;
      div.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
          window.ipcRenderer.deleteTemplate(name);
          loadTemplates();
        } else {
          applyTemplate(tpl);
        }
      });
      templatesList.appendChild(div);
    });
  });
}

function applyTemplate(tpl) {
  if (!tpl) return;
  document.querySelector(
    `input[name="watermark-type"][value="${tpl.type}"]`
  ).checked = true;
  watermarkText.value = tpl.text || "";
  watermarkOpacity.value = tpl.opacity || 50;
  watermarkImagePath = tpl.imgPath || null;
  watermarkImageOpacity.value = tpl.imgOpacity || 50;
  watermarkSize.value = tpl.imgSize || 20;
  watermarkPos = { ...tpl.pos } || { x: 50, y: 50 };
  drawPreview();
  watermarkTypeRadios.forEach((r) => r.dispatchEvent(new Event("change")));
}

// 初始化
loadTemplates();
