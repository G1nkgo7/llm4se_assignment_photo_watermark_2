// 全局变量
let importedFiles = [];
let currentImageIndex = -1;
let watermarkImagePath = null;
let outputDir = null;

// DOM元素
const importBtn = document.getElementById('import-btn');
const exportBtn = document.getElementById('export-btn');
const imageThumbnails = document.getElementById('image-thumbnails');
const previewImage = document.getElementById('preview-image');
const noPreview = document.getElementById('no-preview');
const watermarkTypeRadios = document.querySelectorAll('input[name="watermark-type"]');
const textSettings = document.getElementById('text-settings');
const imageSettings = document.getElementById('image-settings');
const watermarkText = document.getElementById('watermark-text');
const watermarkOpacity = document.getElementById('watermark-opacity');
const opacityValue = document.getElementById('opacity-value');
const selectWatermarkBtn = document.getElementById('select-watermark-btn');
const watermarkImagePathEl = document.getElementById('watermark-image-path');
const watermarkSize = document.getElementById('watermark-size');
const sizeValue = document.getElementById('size-value');
const watermarkImageOpacity = document.getElementById('watermark-image-opacity');
const imageOpacityValue = document.getElementById('image-opacity-value');
const selectOutputBtn = document.getElementById('select-output-btn');
const outputDirEl = document.getElementById('output-dir');
const outputFormat = document.getElementById('output-format');
const filePrefix = document.getElementById('file-prefix');
const fileSuffix = document.getElementById('file-suffix');
const templateName = document.getElementById('template-name');
const saveTemplateBtn = document.getElementById('save-template-btn');
const templatesList = document.getElementById('templates-list');

// 事件监听器
importBtn.addEventListener('click', importFiles);
exportBtn.addEventListener('click', exportImages);

watermarkTypeRadios.forEach(radio => {
  radio.addEventListener('change', toggleWatermarkSettings);
});

watermarkOpacity.addEventListener('input', updateOpacityValue);
watermarkSize.addEventListener('input', updateSizeValue);
watermarkImageOpacity.addEventListener('input', updateImageOpacityValue);

selectWatermarkBtn.addEventListener('click', selectWatermarkImage);
selectOutputBtn.addEventListener('click', selectOutputDirectory);

saveTemplateBtn.addEventListener('click', saveTemplate);

// 加载模板列表
loadTemplatesList();

// 初始化时更新透明度显示
updateOpacityValue();
updateSizeValue();
updateImageOpacityValue();

// 函数定义
async function importFiles() {
  try {
    const files = await window.electron.importFiles();
    if (files.length > 0) {
      importedFiles = files;
      renderImageThumbnails();
      if (importedFiles.length > 0) {
        selectImage(0);
      }
    }
  } catch (error) {
    console.error('导入文件失败:', error);
  }
}

function renderImageThumbnails() {
  imageThumbnails.innerHTML = '';
  importedFiles.forEach((file, index) => {
    const thumbnail = document.createElement('div');
    thumbnail.className = `thumbnail ${index === currentImageIndex ? 'active' : ''}`;
    thumbnail.dataset.index = index;
    
    const img = document.createElement('img');
    img.src = file;
    img.alt = file;
    
    const filename = document.createElement('div');
    filename.className = 'filename';
    filename.textContent = getFileName(file);
    
    thumbnail.appendChild(img);
    thumbnail.appendChild(filename);
    
    thumbnail.addEventListener('click', () => {
      selectImage(index);
    });
    
    imageThumbnails.appendChild(thumbnail);
  });
}

function selectImage(index) {
  if (index >= 0 && index < importedFiles.length) {
    currentImageIndex = index;
    previewImage.src = importedFiles[index];
    previewImage.style.display = 'block';
    noPreview.style.display = 'none';
    renderImageThumbnails(); // 更新缩略图选中状态
  }
}

function toggleWatermarkSettings() {
  const selectedType = document.querySelector('input[name="watermark-type"]:checked').value;
  textSettings.style.display = selectedType === 'text' ? 'block' : 'none';
  imageSettings.style.display = selectedType === 'image' ? 'block' : 'none';
}

function updateOpacityValue() {
  opacityValue.textContent = watermarkOpacity.value;
}

function updateSizeValue() {
  sizeValue.textContent = watermarkSize.value;
}

function updateImageOpacityValue() {
  imageOpacityValue.textContent = watermarkImageOpacity.value;
}

async function selectWatermarkImage() {
  try {
    const path = await window.electron.selectWatermarkImage();
    if (path) {
      watermarkImagePath = path;
      watermarkImagePathEl.textContent = getFileName(path);
    }
  } catch (error) {
    console.error('选择水印图片失败:', error);
  }
}

async function selectOutputDirectory() {
  try {
    const dir = await window.electron.selectOutputDir();
    if (dir) {
      outputDir = dir;
      outputDirEl.textContent = dir;
    }
  } catch (error) {
    console.error('选择输出目录失败:', error);
  }
}

async function exportImages() {
  if (importedFiles.length === 0) {
    alert('请先导入图片');
    return;
  }
  
  if (!outputDir) {
    const dir = await window.electron.selectOutputDir();
    if (!dir) return;
    outputDir = dir;
    outputDirEl.textContent = dir;
  }
  
  const watermarkConfig = {
    type: document.querySelector('input[name="watermark-type"]:checked').value,
    text: watermarkText.value,
    opacity: parseInt(watermarkOpacity.value),
    imagePath: watermarkImagePath,
    size: parseInt(watermarkSize.value),
    imageOpacity: parseInt(watermarkImageOpacity.value)
  };
  
  const namingConfig = {
    prefix: filePrefix.value,
    suffix: fileSuffix.value,
    format: outputFormat.value
  };
  
  try {
    const results = await window.electron.exportImages({
      files: importedFiles,
      outputDir,
      watermarkConfig,
      namingConfig
    });
    
    const successCount = results.filter(r => r.success).length;
    alert(`导出完成！成功导出 ${successCount}/${results.length} 张图片`);
  } catch (error) {
    console.error('导出图片失败:', error);
    alert('导出图片失败，请重试');
  }
}

function saveTemplate() {
  const name = templateName.value.trim();
  if (!name) {
    alert('请输入模板名称');
    return;
  }
  
  const templateData = {
    name,
    watermarkConfig: {
      type: document.querySelector('input[name="watermark-type"]:checked').value,
      text: watermarkText.value,
      opacity: parseInt(watermarkOpacity.value),
      size: parseInt(watermarkSize.value),
      imageOpacity: parseInt(watermarkImageOpacity.value)
    },
    exportConfig: {
      format: outputFormat.value,
      prefix: filePrefix.value,
      suffix: fileSuffix.value
    }
  };
  
  window.electron.saveTemplate(templateData);
  templateName.value = '';
  loadTemplatesList();
}

async function loadTemplatesList() {
  try {
    const templates = await window.electron.loadTemplates();
    
    if (templates.length === 0) {
      templatesList.innerHTML = '<p>无保存的模板</p>';
      return;
    }
    
    templatesList.innerHTML = '';
    templates.forEach(template => {
      const templateItem = document.createElement('div');
      templateItem.className = 'template-item';
      
      const templateName = document.createElement('span');
      templateName.textContent = template.name;
      templateName.addEventListener('click', () => {
        loadTemplate(template);
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '×';
      deleteBtn.title = '删除模板';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTemplate(template.name);
      });
      
      templateItem.appendChild(templateName);
      templateItem.appendChild(deleteBtn);
      templatesList.appendChild(templateItem);
    });
  } catch (error) {
    console.error('加载模板失败:', error);
  }
}

function loadTemplate(template) {
  // 加载水印配置
  if (template.watermarkConfig) {
    const config = template.watermarkConfig;
    document.querySelector(`input[name="watermark-type"][value="${config.type}"]`).checked = true;
    toggleWatermarkSettings();
    
    if (watermarkText) watermarkText.value = config.text || '';
    if (watermarkOpacity) watermarkOpacity.value = config.opacity || 50;
    if (watermarkSize) watermarkSize.value = config.size || 20;
    if (watermarkImageOpacity) watermarkImageOpacity.value = config.imageOpacity || 50;
    
    updateOpacityValue();
    updateSizeValue();
    updateImageOpacityValue();
  }
  
  // 加载导出配置
  if (template.exportConfig) {
    const config = template.exportConfig;
    if (outputFormat) outputFormat.value = config.format || '.jpg';
    if (filePrefix) filePrefix.value = config.prefix || '';
    if (fileSuffix) fileSuffix.value = config.suffix || '';
  }
}

function deleteTemplate(name) {
  if (confirm(`确定要删除模板 "${name}" 吗？`)) {
    window.electron.deleteTemplate(name);
    loadTemplatesList();
  }
}

function getFileName(path) {
  const parts = path.split('\\');
  return parts[parts.length - 1];
}

// 监听模板保存和删除事件
window.electron.onTemplateSaved(() => {
  loadTemplatesList();
});

window.electron.onTemplateDeleted(() => {
  loadTemplatesList();
});