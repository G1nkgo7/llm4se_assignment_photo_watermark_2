let importedFiles = [];
let currentImageIndex = 0;
let outputDir = '';
let watermarkImagePath = null;

// DOM元素
const importBtn = document.getElementById('import-btn');
const importFolderBtn = document.getElementById('import-folder-btn');
const exportBtn = document.getElementById('export-btn');
const imageThumbnails = document.getElementById('image-thumbnails');
const previewContainer = document.getElementById('preview-container');
const previewImage = document.getElementById('preview-image');
const noPreview = document.getElementById('no-preview');
const watermarkText = document.getElementById('watermark-text');
const watermarkOpacity = document.getElementById('watermark-opacity');
const opacityValue = document.getElementById('opacity-value');
const watermarkSize = document.getElementById('watermark-size');
const sizeValue = document.getElementById('size-value');
const watermarkImageOpacity = document.getElementById('watermark-image-opacity');
const imageOpacityValue = document.getElementById('image-opacity-value');
const watermarkTypeRadios = document.querySelectorAll('input[name="watermark-type"]');
const textSettings = document.getElementById('text-settings');
const imageSettings = document.getElementById('image-settings');
const selectWatermarkBtn = document.getElementById('select-watermark-btn');
const watermarkImagePathEl = document.getElementById('watermark-image-path');
const selectOutputBtn = document.getElementById('select-output-btn');
const outputDirEl = document.getElementById('output-dir');
const outputFormat = document.getElementById('output-format');
const filePrefix = document.getElementById('file-prefix');
const fileSuffix = document.getElementById('file-suffix');
const saveTemplateBtn = document.getElementById('save-template-btn');
const templateNameInput = document.getElementById('template-name');
const templatesList = document.getElementById('templates-list');

// 水印位置
let watermarkPos = { x: 50, y: 50 };
let isDragging = false;

// ----------------------
// 点击导入图片
// ----------------------
importBtn.addEventListener('click', async () => {
  const files = await window.ipcRenderer.importFiles();
  if (files && files.length) {
    importedFiles.push(...files);
    currentImageIndex = importedFiles.length - files.length;
    renderImageThumbnails();
    drawPreview();
  }
});

// 批量导入文件夹
importFolderBtn.addEventListener('click', async () => {
  try {
    const files = await window.ipcRenderer.selectFolder();
    if (files === null) return;
    if (!Array.isArray(files)) throw new Error('返回值不是数组');
    if (files.length === 0) {
      alert('所选文件夹中未找到图片文件');
      return;
    }
    importedFiles.push(...files);
    currentImageIndex = importedFiles.length - files.length;
    renderImageThumbnails();
    try { drawPreview(); } catch (err) { console.error('drawPreview 出错:', err); }
  } catch (error) {
    console.error('导入文件夹时出错:', error);
    alert('导入文件夹失败，请重试');
  }
});

// ----------------------
// 拖拽导入（整个窗口悬浮）
// ----------------------
let isDragOverWindow = false;

async function handleDrop(e) {
  e.preventDefault();
  previewContainer.classList.remove('drag-over');
  isDragOverWindow = false;

  const items = e.dataTransfer.items;
  if (!items) return;

  const imageFiles = [];

  async function traverseFileTree(entry) {
    return new Promise(resolve => {
      if (entry.isFile) {
        entry.file(file => {
          if (/\.(jpg|jpeg|png|bmp|tiff)$/i.test(file.name)) {
            imageFiles.push(file.path);
          }
          resolve();
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        dirReader.readEntries(async entries => {
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
    } else if (item.kind === 'file') {
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
  drawPreview();
}

// 监听整个窗口拖拽
window.addEventListener('dragover', e => {
  e.preventDefault();
  if (!isDragOverWindow) {
    previewContainer.classList.add('drag-over');
    isDragOverWindow = true;
  }
});

window.addEventListener('dragleave', e => {
  e.preventDefault();
  // 仅当鼠标离开窗口边界才取消高亮
  if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
    previewContainer.classList.remove('drag-over');
    isDragOverWindow = false;
  }
});

window.addEventListener('drop', handleDrop);

// ----------------------
// 渲染缩略图
// ----------------------
function renderImageThumbnails() {
  imageThumbnails.innerHTML = '';
  importedFiles.forEach((file, index) => {
    const div = document.createElement('div');
    div.className = 'thumbnail' + (index === currentImageIndex ? ' active' : '');
    div.innerHTML = `
      <img src="${file}" />
      <div class="filename">${file.split(/[/\\]/).pop()}</div>
    `;
    div.addEventListener('click', () => {
      currentImageIndex = index;
      drawPreview();
      renderImageThumbnails();
    });
    imageThumbnails.appendChild(div);
  });
}

// ----------------------
// Canvas实时预览
// ----------------------
function drawPreview() {
  if (!importedFiles[currentImageIndex]) {
    previewImage.style.display = 'none';
    noPreview.style.display = 'block';
    return;
  }

  previewImage.style.display = 'block';
  noPreview.style.display = 'none';

  const img = new Image();
  img.src = importedFiles[currentImageIndex];

  img.onload = () => {
    try {
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const wmType = document.querySelector('input[name="watermark-type"]:checked').value;
      if (wmType === 'text' && watermarkText.value) {
        ctx.globalAlpha = watermarkOpacity.value / 100;
        ctx.fillStyle = '#ffffff';
        ctx.font = '40px sans-serif';
        ctx.fillText(watermarkText.value, watermarkPos.x, watermarkPos.y);
        ctx.globalAlpha = 1.0;
      } else if (wmType === 'image' && watermarkImagePath) {
        const wmImg = new Image();
        wmImg.src = watermarkImagePath;
        wmImg.onload = () => {
          const scale = watermarkSize.value / 100;
          const w = wmImg.width * scale;
          const h = wmImg.height * scale;
          ctx.globalAlpha = watermarkImageOpacity.value / 100;
          ctx.drawImage(wmImg, watermarkPos.x, watermarkPos.y, w, h);
          ctx.globalAlpha = 1.0;
          previewImage.src = tempCanvas.toDataURL('image/png');
        };
        wmImg.onerror = () => console.warn('水印图片加载失败:', watermarkImagePath);
        return;
      }

      previewImage.src = tempCanvas.toDataURL('image/png');
    } catch (err) {
      console.error('drawPreview 内部异常:', err);
    }
  };

  img.onerror = () => {
    console.error('图片加载失败:', importedFiles[currentImageIndex]);
  };
}

// ----------------------
// 水印拖拽
// ----------------------
previewImage.addEventListener('mousedown', e => {
  const rect = previewImage.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (Math.abs(x - watermarkPos.x) < 100 && Math.abs(y - watermarkPos.y) < 50) {
    isDragging = true;
  }
});

previewImage.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const rect = previewImage.getBoundingClientRect();
  watermarkPos.x = e.clientX - rect.left;
  watermarkPos.y = e.clientY - rect.top;
  drawPreview();
});

previewImage.addEventListener('mouseup', e => { isDragging = false; });
previewImage.addEventListener('mouseleave', e => { isDragging = false; });

// ----------------------
// 水印控件绑定
// ----------------------
[watermarkText, watermarkOpacity, watermarkSize, watermarkImageOpacity].forEach(el => {
  el.addEventListener('input', () => {
    if (el === watermarkOpacity) opacityValue.textContent = el.value;
    if (el === watermarkSize) sizeValue.textContent = el.value;
    if (el === watermarkImageOpacity) imageOpacityValue.textContent = el.value;
    drawPreview();
  });
});

watermarkTypeRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'text') {
      textSettings.style.display = 'block';
      imageSettings.style.display = 'none';
    } else {
      textSettings.style.display = 'none';
      imageSettings.style.display = 'block';
    }
    drawPreview();
  });
});

// ----------------------
// 选择水印图片
// ----------------------
selectWatermarkBtn.addEventListener('click', async () => {
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
selectOutputBtn.addEventListener('click', async () => {
  const dir = await window.ipcRenderer.selectOutputDir();
  if (dir) {
    outputDir = dir;
    outputDirEl.textContent = dir;
  }
});

// ----------------------
// 导出图片
// ----------------------
exportBtn.addEventListener('click', async () => {
  if (!importedFiles.length || !outputDir) {
    alert('请导入图片并选择输出目录！');
    return;
  }

  for (let i = 0; i < importedFiles.length; i++) {
    const img = new Image();
    img.src = importedFiles[i];
    await new Promise(resolve => {
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        const tctx = tempCanvas.getContext('2d');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        tctx.drawImage(img, 0, 0);

        const wmType = document.querySelector('input[name="watermark-type"]:checked').value;
        if (wmType === 'text' && watermarkText.value) {
          tctx.globalAlpha = watermarkOpacity.value / 100;
          tctx.fillStyle = '#ffffff';
          tctx.font = '40px sans-serif';
          tctx.fillText(watermarkText.value, watermarkPos.x, watermarkPos.y);
          tctx.globalAlpha = 1.0;
        } else if (wmType === 'image' && watermarkImagePath) {
          const wmImg = new Image();
          wmImg.src = watermarkImagePath;
          wmImg.onload = () => {
            const scale = watermarkSize.value / 100;
            const w = wmImg.width * scale;
            const h = wmImg.height * scale;
            tctx.globalAlpha = watermarkImageOpacity.value / 100;
            tctx.drawImage(wmImg, watermarkPos.x, watermarkPos.y, w, h);
            tctx.globalAlpha = 1.0;
            saveImage(tempCanvas, importedFiles[i]);
            resolve();
          };
          return;
        }
        saveImage(tempCanvas, importedFiles[i]);
        resolve();
      };
    });
  }

  alert('导出完成！');
});

function saveImage(canvasEl, originalPath) {
  const format = outputFormat.value || '.png';
  const prefix = filePrefix.value || '';
  const suffix = fileSuffix.value || '';
  const filename = originalPath.split(/[/\\]/).pop();
  const baseName = filename.replace(/\.[^/.]+$/, '');
  const outName = `${prefix}${baseName}${suffix}${format}`;
  const dataURL = canvasEl.toDataURL('image/png');
  window.ipcRenderer.saveImage(dataURL, `${outputDir}/${outName}`);
}

// ----------------------
// 模板管理
// ----------------------
saveTemplateBtn.addEventListener('click', () => {
  const name = templateNameInput.value.trim();
  if (!name) return alert('请输入模板名称');
  const template = {
    type: document.querySelector('input[name="watermark-type"]:checked').value,
    text: watermarkText.value,
    opacity: watermarkOpacity.value,
    imgPath: watermarkImagePath,
    imgOpacity: watermarkImageOpacity.value,
    imgSize: watermarkSize.value,
    pos: { ...watermarkPos }
  };
  window.ipcRenderer.saveTemplate(name, template);
  loadTemplates();
});

function loadTemplates() {
  window.ipcRenderer.getTemplates().then(templates => {
    templatesList.innerHTML = '';
    if (!templates || Object.keys(templates).length === 0) {
      templatesList.innerHTML = '<p>无保存的模板</p>';
      return;
    }
    Object.entries(templates).forEach(([name, tpl]) => {
      const div = document.createElement('div');
      div.className = 'template-item';
      div.innerHTML = `
        <span>${name}</span>
        <button data-name="${name}">删除</button>
      `;
      div.addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
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
  document.querySelector(`input[name="watermark-type"][value="${tpl.type}"]`).checked = true;
  watermarkText.value = tpl.text || '';
  watermarkOpacity.value = tpl.opacity || 50;
  watermarkImagePath = tpl.imgPath || null;
  watermarkImageOpacity.value = tpl.imgOpacity || 50;
  watermarkSize.value = tpl.imgSize || 20;
  watermarkPos = { ...tpl.pos } || { x: 50, y: 50 };
  drawPreview();
  watermarkTypeRadios.forEach(r => r.dispatchEvent(new Event('change')));
}

// 初始化
loadTemplates();
