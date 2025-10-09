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

// 新增文本水印样式设置的DOM元素
const watermarkFont = document.getElementById("watermark-font");
const watermarkFontSize = document.getElementById("watermark-font-size");
const fontSizeValue = document.getElementById("font-size-value");
const watermarkColor = document.getElementById("watermark-color");
const watermarkBold = document.getElementById("watermark-bold");
const watermarkItalic = document.getElementById("watermark-italic");
const watermarkShadow = document.getElementById("watermark-shadow");
const watermarkStroke = document.getElementById("watermark-stroke");
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
// 存储水印的相对位置（相对于图片尺寸的百分比）
let watermarkRelativePos = { x: 50, y: 50, initiated: false };
let isDragging = false;
// 临时存储当前预览中的绝对位置，用于拖拽操作
let currentWatermarkAbsPos = { x: 50, y: 50 };
let currentImageArea = null; // 存储当前图片的绘制区域信息

// ----------------------
// JPEG 质量、缩放百分比和透明度实时显示
// ----------------------
jpegQuality.addEventListener("input", () => {
  qualityValue.textContent = jpegQuality.value;
});

resizePercentage.addEventListener("input", () => {
  resizeValue.textContent = resizePercentage.value;
});

// 添加透明度值实时更新
watermarkOpacity.addEventListener("input", () => {
  opacityValue.textContent = watermarkOpacity.value;
  drawPreview();
});

watermarkImageOpacity.addEventListener("input", () => {
  imageOpacityValue.textContent = watermarkImageOpacity.value;
});

// 字体大小滑块事件监听器
watermarkFontSize.addEventListener("input", () => {
  fontSizeValue.textContent = watermarkFontSize.value;
  drawPreview();
});

// 缩放百分比事件监听器 - 添加绘制预览的触发
resizePercentage.addEventListener("input", () => {
  resizeValue.textContent = resizePercentage.value;
  drawPreview();
});

// 字体选择事件监听器
watermarkFont.addEventListener("change", drawPreview);

// 字体颜色事件监听器
watermarkColor.addEventListener("input", drawPreview);

// 文本样式复选框事件监听器
watermarkBold.addEventListener("change", drawPreview);
watermarkItalic.addEventListener("change", drawPreview);
watermarkShadow.addEventListener("change", drawPreview);
watermarkStroke.addEventListener("change", drawPreview);

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
window.addEventListener("load", async () => {
  if (outputFormat.value !== ".jpg") {
    jpegQualitySettings.style.display = "none";
  }
  setTimeout(updateFilenamePreview, 50);

  // 加载上次设置
  try {
    const lastSettings = await window.api.getLastSettings();
    if (lastSettings) {
      // 恢复水印文本设置
      if (lastSettings.watermarkText) {
        document.querySelector(
          'input[name="watermark-type"][value="text"]'
        ).checked = true;
        textSettings.style.display = "block";
        imageSettings.style.display = "none";
        if (watermarkText)
          watermarkText.value = lastSettings.watermarkText || "";
        if (watermarkOpacity)
          watermarkOpacity.value = lastSettings.watermarkOpacity || 100;
        if (opacityValue)
          opacityValue.textContent = lastSettings.watermarkOpacity || 100;

        // 恢复字体相关设置
        if (watermarkFont)
          watermarkFont.value = lastSettings.watermarkFont || "Arial";
        if (watermarkFontSize)
          watermarkFontSize.value = lastSettings.watermarkFontSize || 40;
        if (fontSizeValue)
          fontSizeValue.textContent = lastSettings.watermarkFontSize || 40;
        if (watermarkColor)
          watermarkColor.value = lastSettings.watermarkColor || "#ffffff";
        if (watermarkBold)
          watermarkBold.checked = lastSettings.watermarkBold || false;
        if (watermarkItalic)
          watermarkItalic.checked = lastSettings.watermarkItalic || false;
        if (watermarkShadow)
          watermarkShadow.checked = lastSettings.watermarkShadow || false;
        if (watermarkStroke)
          watermarkStroke.checked = lastSettings.watermarkStroke || false;
      }

      // 恢复图片水印设置
      if (lastSettings.watermarkImagePath) {
        document.querySelector(
          'input[name="watermark-type"][value="image"]'
        ).checked = true;
        textSettings.style.display = "none";
        imageSettings.style.display = "block";
        watermarkImagePath = lastSettings.watermarkImagePath;
        if (watermarkImagePathEl)
          watermarkImagePathEl.textContent = lastSettings.watermarkImagePath;
        if (watermarkSize)
          watermarkSize.value = lastSettings.watermarkSize || 20;
        if (sizeValue) sizeValue.textContent = lastSettings.watermarkSize || 20;
        if (watermarkImageOpacity)
          watermarkImageOpacity.value =
            lastSettings.watermarkImageOpacity || 100;
        if (imageOpacityValue)
          imageOpacityValue.textContent =
            lastSettings.watermarkImageOpacity || 100;
      }

      // 恢复输出设置
      if (outputFormat)
        outputFormat.value = lastSettings.outputFormat || ".png";
      if (jpegQuality) jpegQuality.value = lastSettings.jpegQuality || 90;
      if (qualityValue)
        qualityValue.textContent = lastSettings.jpegQuality || 90;
      if (resizePercentage)
        resizePercentage.value = lastSettings.resizePercentage || 100;
      if (resizeValue)
        resizeValue.textContent = lastSettings.resizePercentage || 100;

      // 恢复输出目录
      if (outputDir) outputDir.value = lastSettings.outputDir || "";

      // 更新预览
      if (currentImage) {
        drawPreview();
      }
    }
  } catch (error) {
    console.error("加载上次设置失败:", error);
  }
});

// 窗口关闭前保存当前设置
window.addEventListener("beforeunload", async () => {
  try {
    const currentSettings = {
      watermarkType: document.querySelector(
        'input[name="watermark-type"]:checked'
      ).value,
      watermarkText: watermarkText?.value || "",
      watermarkOpacity: parseInt(watermarkOpacity?.value) || 100,

      // 字体相关设置
      watermarkFont: watermarkFont?.value || "Arial",
      watermarkFontSize: parseInt(watermarkFontSize?.value) || 40,
      watermarkColor: watermarkColor?.value || "#ffffff",
      watermarkBold: watermarkBold?.checked || false,
      watermarkItalic: watermarkItalic?.checked || false,
      watermarkShadow: watermarkShadow?.checked || false,
      watermarkStroke: watermarkStroke?.checked || false,

      watermarkImagePath: watermarkImagePath || "",
      watermarkSize: parseInt(watermarkSize?.value) || 20,
      watermarkImageOpacity: parseInt(watermarkImageOpacity?.value) || 100,

      outputFormat: outputFormat?.value || ".png",
      jpegQuality: parseInt(jpegQuality?.value) || 90,
      resizePercentage: parseInt(resizePercentage?.value) || 100,

      outputDir: outputDir?.value || "",
    };

    await window.api.saveCurrentSettings(currentSettings);
  } catch (error) {
    console.error("保存当前设置失败:", error);
  }
});

// ----------------------
// 检查重复图片的通用函数
// ----------------------
function checkForDuplicateFiles(newFiles) {
  const uniqueFiles = [];
  const skippedFiles = [];

  newFiles.forEach((file) => {
    // 规范化文件路径以便于比较（在Windows上忽略大小写）
    const normalizedFilePath = file.toLowerCase();

    // 检查是否已存在于已导入文件中
    const isDuplicate = importedFiles.some(
      (importedFile) => importedFile.toLowerCase() === normalizedFilePath
    );

    if (isDuplicate) {
      skippedFiles.push(file);
    } else {
      uniqueFiles.push(file);
    }
  });

  return { uniqueFiles, skippedFiles };
}

// ----------------------
// 显示跳过的重复图片提示
// ----------------------
function showSkippedFilesAlert(skippedFiles) {
  if (skippedFiles.length > 0) {
    const filenames = skippedFiles.map((file) => {
      // 只显示文件名而不是完整路径
      return file.split(/[/\\]/).pop();
    });

    let message = `跳过了 ${skippedFiles.length} 个重复图片：\n`;
    message += filenames.join("\n");

    showAlert(message);
  }
}

// ----------------------
// 点击导入图片
// ----------------------
importBtn.addEventListener("click", async () => {
  const files = await window.ipcRenderer.importFiles();
  if (files && files.length) {
    const { uniqueFiles, skippedFiles } = checkForDuplicateFiles(files);

    if (uniqueFiles.length > 0) {
      importedFiles.push(...uniqueFiles);
      currentImageIndex = importedFiles.length - uniqueFiles.length;
      renderImageThumbnails();
      drawPreview(); // 直接调用
      updateFilenamePreview();
    }

    // 显示跳过的重复图片提示
    showSkippedFilesAlert(skippedFiles);
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

    const { uniqueFiles, skippedFiles } = checkForDuplicateFiles(files);

    if (uniqueFiles.length > 0) {
      importedFiles.push(...uniqueFiles);
      currentImageIndex = importedFiles.length - uniqueFiles.length;
      renderImageThumbnails();
      try {
        drawPreview();
      } catch (error) {
        console.error("drawPreview 出错:", error);
      } // 直接调用
      updateFilenamePreview();
    } else {
      showAlert("所选文件夹中的图片已全部导入");
    }

    // 显示跳过的重复图片提示
    showSkippedFilesAlert(skippedFiles);
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
          if (/\.(jpg|jpeg|png|tiff)$/i.test(file.name)) {
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
      if (file && /\.(jpg|jpeg|png|tiff)$/i.test(file.name)) {
        imageFiles.push(file.path);
      }
    }
  }

  await Promise.all(promises);

  if (!imageFiles.length) return;

  const { uniqueFiles, skippedFiles } = checkForDuplicateFiles(imageFiles);

  if (uniqueFiles.length > 0) {
    importedFiles.push(...uniqueFiles);
    currentImageIndex = importedFiles.length - uniqueFiles.length;
    renderImageThumbnails();
    drawPreview(); // 直接调用
    updateFilenamePreview();
  }

  // 显示跳过的重复图片提示
  showSkippedFilesAlert(skippedFiles);
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
// 删除单张图片
// ----------------------
function deleteImage(index) {
  // 从导入文件数组中删除指定索引的图片
  importedFiles.splice(index, 1);

  // 从缓存中删除对应的缩略图
  const fileToRemove = importedFiles[index];
  if (fileToRemove && thumbnailCache[fileToRemove]) {
    delete thumbnailCache[fileToRemove];
  }

  // 如果删除的是当前选中的图片，需要重新选择
  if (index === currentImageIndex) {
    // 如果还有图片，选择第一张或最后一张
    if (importedFiles.length > 0) {
      // 如果删除的是最后一张，选择新的最后一张
      currentImageIndex = Math.min(index, importedFiles.length - 1);
    } else {
      currentImageIndex = -1;
      // 确保预览区域显示"请导入图片以预览"提示
      noPreview.style.display = "block";
      // 显式清除Canvas内容
      if (ctx) {
        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      }
      // 隐藏Canvas以确保残留图像不显示
      previewCanvas.style.display = "none";
    }
  } else if (index < currentImageIndex) {
    // 如果删除的是当前选中图片之前的图片，调整索引
    currentImageIndex--;
    // 确保Canvas可见
    previewCanvas.style.display = "block";
  }

  // 重新渲染缩略图和预览
  renderImageThumbnails();
  drawPreview();
  updateFilenamePreview();
}

// ----------------------
// 删除全部图片
// ----------------------
function deleteAllImages() {
  // 清空导入文件数组和缓存
  importedFiles = [];
  thumbnailCache = {};
  currentImageIndex = -1;

  // 确保预览区域显示"请导入图片以预览"提示
  noPreview.style.display = "block";

  // 清除Canvas上的图片内容
  if (previewCanvas && ctx) {
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  }

  // 隐藏Canvas以确保残留图像不显示
  previewCanvas.style.display = "none";

  // 重新渲染缩略图和预览
  renderImageThumbnails();
  drawPreview();
  updateFilenamePreview();
}

// ----------------------
// 渲染缩略图
// ----------------------
function renderImageThumbnails() {
  imageThumbnails.innerHTML = "";

  // 先移除已存在的删除全部按钮
  const existingBtn =
    imageThumbnails.parentNode.querySelector(".delete-all-btn");
  if (existingBtn) {
    imageThumbnails.parentNode.removeChild(existingBtn);
  }

  // 如果有图片，显示删除全部按钮
  if (importedFiles.length > 0) {
    const deleteAllBtn = document.createElement("button");
    deleteAllBtn.className = "btn-secondary delete-all-btn";
    deleteAllBtn.textContent = "删除全部";
    deleteAllBtn.style.width = "100%";
    deleteAllBtn.style.marginBottom = "10px";
    deleteAllBtn.addEventListener("click", () => {
      showConfirm("确定要删除所有已导入的图片吗？", () => {
        deleteAllImages();
      });
    });
    imageThumbnails.parentNode.insertBefore(deleteAllBtn, imageThumbnails);
  }

  // 创建所有缩略图元素（同步创建，确保顺序一致）
  const thumbnailElements = [];
  importedFiles.forEach((file, index) => {
    const div = document.createElement("div");
    div.className =
      "thumbnail" + (index === currentImageIndex ? " active" : "");
    div.dataset.index = index;

    // 如果获取失败，设置一个透明像素占位符
    const imgSrc =
      thumbnailCache[file] ||
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    // 创建图片元素并设置draggable="false"
    const img = document.createElement("img");
    img.src = imgSrc;
    img.draggable = false;
    div.appendChild(img);

    // 创建删除按钮
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = "&times;";
    deleteBtn.title = "删除此图片";
    // 阻止冒泡，避免触发缩略图的点击事件
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteImage(index);
    });
    div.appendChild(deleteBtn);

    // 创建文件名元素
    const filenameDiv = document.createElement("div");
    filenameDiv.className = "filename";
    filenameDiv.textContent = file.split(/[\\/]/).pop();
    div.appendChild(filenameDiv);

    div.addEventListener("click", () => {
      selectImage(index);
    });

    thumbnailElements.push(div);
  });

  // 一次性添加所有缩略图到容器（确保顺序）
  thumbnailElements.forEach((div) => {
    imageThumbnails.appendChild(div);
  });

  // 异步加载缺失的缩略图数据（不影响顺序）
  importedFiles.forEach(async (file, index) => {
    // 检查缓存
    if (!thumbnailCache[file]) {
      // 缓存中没有，才调用 IPC 异步获取
      const dataUrl = await window.ipcRenderer.getPreviewDataUrl(file);
      if (dataUrl) {
        // 存入缓存
        thumbnailCache[file] = dataUrl;

        // 更新已创建的缩略图
        const thumbnails = imageThumbnails.querySelectorAll(".thumbnail");
        const thumbnail = thumbnails[index];
        if (thumbnail) {
          const img = thumbnail.querySelector("img");
          if (img) {
            img.src = dataUrl;
          }
        }
      }
    }
  });
}

// ----------------------
// Canvas水印实时预览 & 图片切换 (从 index.html 移动过来)
// ----------------------

// 旋转相关变量
let watermarkRotation = 0; // 存储水印旋转角度
const watermarkRotationSlider = document.getElementById('watermark-rotation');
const watermarkRotationInput = document.getElementById('watermark-rotation-input');

async function drawPreview() {
  if (!importedFiles[currentImageIndex]) {
    // 如果没有图片，则显示提示
    noPreview.style.display = "block";
    // 确保Canvas隐藏
    previewCanvas.style.display = "none";
    return;
  } else {
    noPreview.style.display = "none";
    // 确保Canvas可见
    previewCanvas.style.display = "block";
  }

  // 获取原始图片的元数据（尺寸信息）
  try {
    const metadata = await window.ipcRenderer.getImageMetadata(
      importedFiles[currentImageIndex]
    );
    originalImageDimensions = {
      width: metadata.width || 800, // 默认值以避免计算问题
      height: metadata.height || 600
    };
  } catch (err) {
    console.error("获取图片元数据失败:", err);
    // 出错时使用默认尺寸
    originalImageDimensions = { width: 800, height: 600 };
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
    // 设置预览容器为固定尺寸（适应窗口大小）
    const containerWidth = previewContainer.clientWidth;
    const containerHeight = previewContainer.clientHeight;

    // 考虑15px的padding，计算可用空间
    const padding = 15;
    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;

    // 固定Canvas尺寸为预览容器的尺寸
    previewCanvas.width = containerWidth;
    previewCanvas.height = containerHeight;

    // 清除画布
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    // 计算缩放比例，保持图片的原始宽高比
    const imgRatio = img.width / img.height;
    const containerRatio = availableWidth / availableHeight;

    let drawWidth, drawHeight;

    if (containerRatio > imgRatio) {
      // 容器更宽，按高度缩放
      drawHeight = Math.min(img.height, availableHeight);
      drawWidth = drawHeight * imgRatio;
    } else {
      // 容器更高，按宽度缩放
      drawWidth = Math.min(img.width, availableWidth);
      drawHeight = drawWidth / imgRatio;
    }

    // 应用用户设置的缩放百分比
    const resizePercent = parseInt(resizePercentage.value) / 100;
    drawWidth = Math.round(drawWidth * resizePercent);
    drawHeight = Math.round(drawHeight * resizePercent);

    // 计算居中位置（考虑padding）
    const x = padding + (availableWidth - drawWidth) / 2;
    const y = padding + (availableHeight - drawHeight) / 2;

    // 保存当前图片的绘制区域信息
    currentImageArea = {
      x: x,
      y: y,
      width: drawWidth,
      height: drawHeight,
    };

    // 绘制缩放后的图片（居中显示）
    ctx.drawImage(img, x, y, drawWidth, drawHeight);

    // 计算水印的绝对位置（基于相对位置）
    function calculateWatermarkPosition() {
      // 如果是初始状态，将水印放在图片中心
      if (
        (watermarkRelativePos.x === 50 && watermarkRelativePos.y === 50) ||
        !watermarkRelativePos.initiated
      ) {
        return {
          x: x + drawWidth / 2,
          y: y + drawHeight / 2,
        };
      }
      // 否则，根据相对位置计算绝对位置
      return {
        x: x + (watermarkRelativePos.x / 100) * drawWidth,
        y: y + (watermarkRelativePos.y / 100) * drawHeight,
      };
    }

    // 获取当前水印的绝对位置
    currentWatermarkAbsPos = calculateWatermarkPosition();

    // 标记为已初始化
    if (!watermarkRelativePos.initiated) {
      watermarkRelativePos.initiated = true;
    }

    const wmType = document.querySelector(
      'input[name="watermark-type"]:checked'
    ).value;
    if (wmType === "text" && watermarkText.value) {
      // 文本水印
      ctx.globalAlpha = watermarkOpacity.value / 100;

      // 设置字体样式 - 考虑缩放百分比
      let fontWeight = watermarkBold.checked ? "bold" : "normal";
      let fontStyle = watermarkItalic.checked ? "italic" : "normal";
      const baseFontSize = parseInt(watermarkFontSize.value);
      // 直接使用之前定义的resizePercent变量
      // 根据缩放百分比调整字体大小
      const fontSize = Math.round(baseFontSize * resizePercent) + "px";
      let fontFamily = watermarkFont.value;
      ctx.font = `${fontWeight} ${fontStyle} ${fontSize} ${fontFamily}`;

      // 设置字体颜色
      ctx.fillStyle = watermarkColor.value;

      // 确保文本水印不会超出图片边界
      // 测量文本宽度和高度
      const textMetrics = ctx.measureText(watermarkText.value);
      const textWidth = textMetrics.width;
      
      // 获取更准确的文本高度 - 使用TextMetrics API
      // actualBoundingBoxAscent和actualBoundingBoxDescent提供更精确的文本边界
      const textHeight = (textMetrics.actualBoundingBoxAscent || 0) + (textMetrics.actualBoundingBoxDescent || 0);
      
      // 为了兼容性，如果浏览器不支持actualBoundingBox属性，回退到使用字体大小估算
      const safeTextHeight = Math.max(textHeight, parseInt(fontSize));

      // 计算文本的实际绘制位置，确保不超出图片边界
      // 重新计算水印位置以适应缩放后的图片
      let drawX = x + (watermarkRelativePos.x / 100) * drawWidth;
      let drawY = y + (watermarkRelativePos.y / 100) * drawHeight;

      // 检查并修正水平边界
      if (drawX < currentImageArea.x) drawX = currentImageArea.x;
      if (drawX + textWidth > currentImageArea.x + currentImageArea.width) {
        drawX = currentImageArea.x + currentImageArea.width - textWidth;
      }

      // 检查并修正垂直边界
      // 获取文本基线到顶部和底部的距离
      const ascent = textMetrics.actualBoundingBoxAscent || safeTextHeight * 0.8; // 文本顶部到基线的距离
      const descent = textMetrics.actualBoundingBoxDescent || safeTextHeight * 0.2; // 文本底部到基线的距离
      
      // 计算文本的总高度，用于旋转中心点计算和边界检查
      const totalTextHeight = ascent + descent;
      
      // 确保顶部完全对齐
      if (drawY - ascent < currentImageArea.y) {
        drawY = currentImageArea.y + ascent; // 调整基线位置，使文本顶部刚好接触图片顶部
      }
      
      // 确保底部完全对齐 - 关键修复：使用总高度来计算底部边界
      if (drawY + descent > currentImageArea.y + currentImageArea.height) {
        drawY = currentImageArea.y + currentImageArea.height - descent; // 调整基线位置，使文本底部刚好接触图片底部
      }

      // 应用旋转
      if (watermarkRotation !== 0) {
        // 保存当前状态
        ctx.save();
        
        // 计算旋转中心点（文本的中心点）
        const centerX = drawX + textWidth / 2;
        const centerY = drawY - ascent + totalTextHeight / 2; // 使用总高度计算视觉中心点，确保旋转时保持对齐
        
        // 应用旋转变换
        ctx.translate(centerX, centerY);
        ctx.rotate((watermarkRotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);
      }

      // 应用阴影效果
      if (watermarkShadow.checked) {
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      // 应用描边效果
      if (watermarkStroke.checked) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
        ctx.lineWidth = 1;
        ctx.strokeText(watermarkText.value, drawX, drawY);
      }

      // 填充文本
      ctx.fillText(watermarkText.value, drawX, drawY);
      
      // 如果应用了旋转，恢复状态
      if (watermarkRotation !== 0) {
        ctx.restore();
      }

      // 重置阴影设置
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.globalAlpha = 1.0;
    } else if (wmType === "image" && watermarkImagePath) {
        // 图片水印
        const wmImg = new Image();
        wmImg.src = watermarkImagePath;
        wmImg.onload = () => {
          // 根据当前预览图片宽度和百分比计算水印宽度，已考虑缩放百分比
          const watermarkSizePercentage = parseInt(watermarkSize.value);
          const w = Math.round(currentImageArea.width * (watermarkSizePercentage / 100));
          // 保持宽高比
          const aspectRatio = wmImg.width / wmImg.height;
          const h = Math.round(w / aspectRatio);

          // 确保图片水印不会超出图片边界
          // 重新计算水印位置以适应缩放后的图片
          let drawX = x + (watermarkRelativePos.x / 100) * drawWidth;
          let drawY = y + (watermarkRelativePos.y / 100) * drawHeight;

          // 【修正点】改进边缘检查逻辑，让水印能够真正抵达图片边缘
          // 检查并修正水平边界
          if (drawX < currentImageArea.x) drawX = currentImageArea.x;
          if (drawX + w > currentImageArea.x + currentImageArea.width) {
            drawX = currentImageArea.x + currentImageArea.width - w;
          }

          // 检查并修正垂直边界
          if (drawY < currentImageArea.y) drawY = currentImageArea.y;
          if (drawY + h > currentImageArea.y + currentImageArea.height) {
            drawY = currentImageArea.y + currentImageArea.height - h;
          }

          ctx.globalAlpha = watermarkImageOpacity.value / 100;
          
          // 应用旋转
          if (watermarkRotation !== 0) {
            // 保存当前状态
            ctx.save();
            
            // 计算旋转中心点（图片的中心点）
            const centerX = drawX + w / 2;
            const centerY = drawY + h / 2;
            
            // 应用旋转变换
            ctx.translate(centerX, centerY);
            ctx.rotate((watermarkRotation * Math.PI) / 180);
            ctx.translate(-centerX, -centerY);
          }
          
          ctx.drawImage(wmImg, drawX, drawY, w, h);
          
          // 如果应用了旋转，恢复状态
          if (watermarkRotation !== 0) {
            ctx.restore();
          }
          
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
[watermarkText, watermarkOpacity, watermarkSize, watermarkImageOpacity, watermarkRotationSlider, watermarkRotationInput].forEach(
  (el) => {
    if (el) {
      el.addEventListener("input", drawPreview);
    }
  }
);

// 设置旋转角度的联动更新
if (watermarkRotationSlider && watermarkRotationInput) {
  watermarkRotationSlider.addEventListener('input', function() {
    watermarkRotation = parseInt(this.value);
    watermarkRotationInput.value = watermarkRotation;
  });
  
  watermarkRotationInput.addEventListener('input', function() {
    let value = parseInt(this.value);
    // 确保值在有效范围内
    if (isNaN(value)) value = 0;
    if (value < 0) value = 0;
    if (value > 359) value = 359;
    
    watermarkRotation = value;
    watermarkRotationSlider.value = watermarkRotation;
  });
}

// ----------------------
// 水印预设位置功能
// ----------------------
document.addEventListener('DOMContentLoaded', function() {
  const presetButtons = document.querySelectorAll('.preset-btn');
  presetButtons.forEach(button => {
    button.addEventListener('click', function() {
      const position = this.getAttribute('data-position').split(',');
      const x = parseFloat(position[0]);
      const y = parseFloat(position[1]);
      
      // 如果有当前图片区域信息，计算并更新绝对位置
      if (currentImageArea && originalImageDimensions.width > 0 && originalImageDimensions.height > 0) {
        // 根据原始图片尺寸计算预览中的绝对位置
        const scaleX = currentImageArea.width / originalImageDimensions.width;
        const scaleY = currentImageArea.height / originalImageDimensions.height;
        
        // 获取水印的实际尺寸
        const { width: wmWidth } = getWatermarkDimensions();
        
        // 计算相对于预览区域的绝对位置
        let previewX, previewY;
        
        // 对于水平居中位置（x=50%），确保水印真正居中
        if (x === 50) {
          // 计算水印中心点在预览中的水平位置
          const centerX = currentImageArea.x + (currentImageArea.width / 2);
          // 计算水印左上角的位置（中心点减去水印宽度的一半）
          previewX = centerX - (wmWidth / 2);
        } else {
          // 对于非居中位置，保持原有计算
          previewX = currentImageArea.x + (x / 100) * currentImageArea.width;
        }
        
        previewY = currentImageArea.y + (y / 100) * currentImageArea.height;
        
        // 更新当前预览中的绝对位置
        currentWatermarkAbsPos.x = previewX;
        currentWatermarkAbsPos.y = previewY;
        
        // 重新计算相对位置百分比 - 基于原始图片尺寸
        const scaleToOriginalX = originalImageDimensions.width / currentImageArea.width;
        const originalX = (previewX - currentImageArea.x) * scaleToOriginalX;
        const originalY = (previewY - currentImageArea.y) * scaleToOriginalX;
        
        // 更新相对位置百分比
        watermarkRelativePos.x = (originalX / originalImageDimensions.width) * 100;
        watermarkRelativePos.y = (originalY / originalImageDimensions.height) * 100;
      }
      
      // 重新绘制预览
      drawPreview();
    });
  });
});

// ----------------------
// 水印拖拽 (从 index.html 移动过来)
// ----------------------
let originalImageDimensions = { width: 0, height: 0 }; // 存储原始图片尺寸
// 获取水印的实际尺寸
function getWatermarkDimensions() {
  const wmType = document.querySelector(
    'input[name="watermark-type"]:checked'
  ).value;

  if (wmType === "text" && watermarkText.value) {
    // 为文本水印创建一个临时画布来测量文本大小
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.font = "40px sans-serif";
    const metrics = tempCtx.measureText(watermarkText.value);
    // 使用更精确的文本高度估算，考虑到文本基线的问题
    // 对于40px的字体，实际高度大约是字体大小的1.2倍
    const textHeight = 48; // 比之前的50稍小，以确保可以到底部
    return {
      width: metrics.width,
      height: textHeight,
    };
  } else if (wmType === "image" && watermarkImagePath) {
    // 对于图片水印，使用实际的图片尺寸
    // 注意：这种方式不是100%准确，因为图片可能还没有加载完成
    // 在实际应用中，可能需要在图片加载完成后缓存尺寸信息
    try {
      const img = new Image();
      img.src = watermarkImagePath;
      const scale = parseInt(watermarkSize.value) / 100;
      return {
        width: img.width * scale,
        height: img.height * scale,
      };
    } catch (e) {
      // 如果获取尺寸失败，使用默认值
      const scale = parseInt(watermarkSize.value) / 100;
      return {
        width: 150 * scale,
        height: 100 * scale,
      };
    }
  }

  // 默认尺寸
  return { width: 100, height: 50 };
}

previewCanvas.addEventListener("mousedown", (e) => {
  const rect = previewCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // 获取水印的实际尺寸
  const { width: hitboxWidth, height: hitboxHeight } = getWatermarkDimensions();

  // 检查点击是否在水印范围内
  if (
    Math.abs(x - currentWatermarkAbsPos.x) < hitboxWidth &&
    Math.abs(y - currentWatermarkAbsPos.y) < hitboxHeight
  ) {
    isDragging = true;
  }
});

previewCanvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const rect = previewCanvas.getBoundingClientRect();

  // 计算鼠标在画布上的绝对位置
  const newX = e.clientX - rect.left;
  const newY = e.clientY - rect.top;

  // 确保当前有图片区域信息
  if (currentImageArea) {
    // 获取水印的实际尺寸
    const { width: wmWidth, height: wmHeight } = getWatermarkDimensions();

    // 【修正点】改进边界限制逻辑，让水印能够真正抵达图片的四周边缘
    // 上部分不超过图片顶部
    // 下部分不超过图片底部
    // 左右同理
    const limitedX = Math.max(
      currentImageArea.x,
      Math.min(newX, currentImageArea.x + currentImageArea.width - 1) // 修改为-1允许水印几乎到达右边缘
    );
    
    // 对于文本水印和图片水印采用统一的Y轴边界处理
    const limitedY = Math.max(
      currentImageArea.y,
      Math.min(newY, currentImageArea.y + currentImageArea.height - 1) // 修改为-1允许水印几乎到达下边缘
    );

    // 更新当前预览中的绝对位置
    currentWatermarkAbsPos.x = limitedX;
    currentWatermarkAbsPos.y = limitedY;

    // 计算并更新相对位置（百分比）- 基于原始图片尺寸
    // 1. 将预览中的坐标转换为原图坐标
    const scaleX = originalImageDimensions.width / currentImageArea.width;
    const scaleY = originalImageDimensions.height / currentImageArea.height;
    const originalX = (limitedX - currentImageArea.x) * scaleX;
    const originalY = (limitedY - currentImageArea.y) * scaleY;
    
    // 2. 计算相对于原始图片的百分比
    watermarkRelativePos.x = (originalX / originalImageDimensions.width) * 100;
    watermarkRelativePos.y = (originalY / originalImageDimensions.height) * 100;
  } else {
    // 如果没有图片区域信息，使用默认的边界限制
    const padding = 15;
    const availableWidth = previewCanvas.width - padding * 2;
    const availableHeight = previewCanvas.height - padding * 2;

    currentWatermarkAbsPos.x = Math.max(
      padding,
      Math.min(newX, padding + availableWidth)
    );
    currentWatermarkAbsPos.y = Math.max(
      padding,
      Math.min(newY, padding + availableHeight)
    );
  }

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

// 创建showConfirm函数处理确认对话框
function showConfirm(message, onConfirm) {
  // 使用现有的自定义提示框结构，但添加确认逻辑
  customAlertMessage.textContent = message;
  customAlertOverlay.style.display = "flex";

  // 临时保存原来的关闭处理函数
  const originalOnClose = customAlertClose.onclick;

  // 设置新的关闭处理，只有点击确定才执行确认回调
  customAlertClose.onclick = function () {
    customAlertOverlay.style.display = "none";
    // 恢复原来的关闭处理函数
    customAlertClose.onclick = originalOnClose;
    // 执行确认回调
    if (onConfirm && typeof onConfirm === "function") {
      onConfirm();
    }
  };
}

// 绑定默认关闭事件
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

  // 确保导出时水印位置的计算与预览时保持一致
  // 如果有当前图片区域信息，需要调整水印位置以匹配原始图片尺寸
  let exportWmPos = { ...watermarkRelativePos };

  // 检查是否存在当前图片区域信息
  if (currentImageArea && importedFiles[currentImageIndex]) {
    try {
      // 获取原始图片的元数据
      const metadata = await window.ipcRenderer.getImageMetadata(
        importedFiles[currentImageIndex]
      );

      // 获取当前水印类型
      const wmType = document.querySelector('input[name="watermark-type"]:checked').value;
      
      // 基础绝对位置计算
      let x = Math.round((watermarkRelativePos.x / 100) * metadata.width);
      let y = Math.round((watermarkRelativePos.y / 100) * metadata.height);
      
      if (wmType === "text" && watermarkText.value) {
        // 获取字体大小并转换为与原始图片相匹配的尺寸
        const fontSize = parseInt(watermarkFontSize.value || 40);
        
        // 计算预览图与原始图的比例
        const previewToOriginalRatio = metadata.width / currentImageArea.width;
        const scaledFontSize = Math.round(fontSize * previewToOriginalRatio);
        
        // 测量文本宽度（需要创建临时画布）
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        let fontWeight = watermarkBold.checked ? 'bold' : 'normal';
        let fontStyle = watermarkItalic.checked ? 'italic' : 'normal';
        tempCtx.font = `${fontWeight} ${fontStyle} ${fontSize}px ${watermarkFont.value}`;
        const textMetrics = tempCtx.measureText(watermarkText.value);
        const textWidth = textMetrics.width * previewToOriginalRatio;
        const textHeight = scaledFontSize;
        
        // 调整垂直位置以匹配预览中的视觉效果（考虑文本基线）
        y += Math.round(scaledFontSize * 0.3); // 文本基线调整因子
        
        // 应用与预览完全相同的边界检查逻辑
        // 检查并修正水平边界
        if (x < 0) x = 0;
        if (x + textWidth > metadata.width) {
          x = metadata.width - textWidth;
        }
        
        // 检查并修正垂直边界
        if (y - textHeight < 0) y = textHeight;
        if (y > metadata.height) y = metadata.height;
      }

      exportWmPos = {
        x: x,
        y: y,
      };
    } catch (err) {
      console.error("计算导出水印位置时出错:", err);
      // 出错时使用原始位置
    }
  }

  const exportParams = {
    format: outputFormat.value,
    quality: outputFormat.value === ".jpg" ? parseInt(jpegQuality.value) : 100,
    resize: parseInt(resizePercentage.value),
    prefix: filePrefix.value.trim(),
    suffix: fileSuffix.value.trim(),
    wmType: document.querySelector('input[name="watermark-type"]:checked')
      .value,
    wmText: watermarkText.value,
    wmOpacity: watermarkOpacity.value,
    wmImgPath: watermarkImagePath,
    wmImgOpacity: watermarkImageOpacity.value,
    wmSize: watermarkSize.value,
    wmPos: exportWmPos,
    // 添加水印相对位置，用于main.js中正确计算中心点
    watermarkRelativePos: watermarkRelativePos,
    // 新增文本水印样式设置
    wmFont: watermarkFont?.value || "Arial",
    wmFontSize: parseInt(watermarkFontSize?.value) || 40,
    wmColor: watermarkColor?.value || "#ffffff",
    wmBold: watermarkBold?.checked || false,
    wmItalic: watermarkItalic?.checked || false,
    wmShadow: watermarkShadow?.checked || false,
    wmStroke: watermarkStroke?.checked || false,
  };

  try {
    console.log(
      "准备导出图片:",
      importedFiles.length,
      "张图片到目录:",
      outputDir
    );
    console.log("导出参数:", exportParams);

    const results = await window.ipcRenderer.exportImages(
      importedFiles,
      outputDir,
      exportParams
    );

    console.log("导出结果:", results);
    // 检查是否所有图片都成功导出
    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    if (failedCount > 0) {
      const errors = results
        .filter((r) => !r.success)
        .map((r) => `${r.file}: ${r.error || "未知错误"}`)
        .join("\n");
      console.error("导出失败的图片:", errors);
      showAlert(
        `导出完成，成功: ${successCount}张，失败: ${failedCount}张\n\n失败原因:\n${errors}`
      );
    } else {
      showAlert(`导出完成！成功导出 ${successCount} 张图片`);
    }
  } catch (err) {
    console.error("导出失败:", err);
    showAlert(`导出失败，请查看控制台:\n${err.message || "未知错误"}`);
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
    pos: { ...watermarkRelativePos },
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
  watermarkRelativePos = { ...tpl.pos } || { x: 50, y: 50, initiated: false };
  drawPreview();
  watermarkTypeRadios.forEach((r) => r.dispatchEvent(new Event("change")));
}

// 初始化
loadTemplates();

// 添加窗口大小变化事件监听器，使图片自适应窗口大小
window.addEventListener("resize", () => {
  // 当窗口大小改变时，重新绘制预览
  if (importedFiles.length > 0) {
    drawPreview();
  }
});

// 添加水印类型切换的事件监听器
watermarkTypeRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (radio.value === "text") {
      textSettings.style.display = "block";
      imageSettings.style.display = "none";
    } else if (radio.value === "image") {
      textSettings.style.display = "none";
      imageSettings.style.display = "block";
    }
    drawPreview();
  });
});
