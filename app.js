class DitherStudio {
    constructor() {
        this.originalCanvas = document.getElementById('originalCanvas');
        this.previewCanvas = document.getElementById('previewCanvas');
        this.originalCtx = this.originalCanvas.getContext('2d');
        this.previewCtx = this.previewCanvas.getContext('2d');
        
        this.originalImageData = null;
        this.settings = {
            algorithm: 'floyd-steinberg',
            colors: 16,
            brightness: 0,
            gamma: 1.0,
            contrast: 0,
            threshold: 128,
            ditherScale: 1.0,
            grayscale: false,
            format: 'png'
        };
        
        this.isProcessing = false;
        this.comparisonMode = false;
        
        this.initializeEventListeners();
        this.initializeBayerMatrix();
    }
    
    initializeEventListeners() {
        // File upload
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        
        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadZone.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        
        // Controls
        document.getElementById('algorithmSelect').addEventListener('change', this.updateSetting.bind(this));
        document.getElementById('colorCount').addEventListener('input', this.updateSlider.bind(this));
        document.getElementById('grayscaleToggle').addEventListener('change', this.updateSetting.bind(this));
        document.getElementById('brightness').addEventListener('input', this.updateSlider.bind(this));
        document.getElementById('gamma').addEventListener('input', this.updateSlider.bind(this));
        document.getElementById('contrast').addEventListener('input', this.updateSlider.bind(this));
        document.getElementById('threshold').addEventListener('input', this.updateSlider.bind(this));
        document.getElementById('ditherScale').addEventListener('input', this.updateSlider.bind(this));
        document.getElementById('exportFormat').addEventListener('change', this.updateSetting.bind(this));
        
        // Toolbar buttons
        document.getElementById('clearBtn').addEventListener('click', this.clearImage.bind(this));
        document.getElementById('downloadBtn').addEventListener('click', this.downloadImage.bind(this));
        document.getElementById('zoomFit').addEventListener('click', this.zoomFit.bind(this));
        document.getElementById('zoom100').addEventListener('click', this.zoom100.bind(this));
        document.getElementById('toggleComparison').addEventListener('click', this.toggleComparison.bind(this));
    }
    
    initializeBayerMatrix() {
        this.bayerMatrix = [
            [0, 8, 2, 10],
            [12, 4, 14, 6],
            [3, 11, 1, 9],
            [15, 7, 13, 5]
        ];
        
        // Normalize to 0-1 range
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                this.bayerMatrix[i][j] /= 16;
            }
        }
    }
    
    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('uploadZone').classList.add('dragover');
    }
    
    handleDragLeave(e) {
        e.preventDefault();
        document.getElementById('uploadZone').classList.remove('dragover');
    }
    
    handleDrop(e) {
        e.preventDefault();
        document.getElementById('uploadZone').classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.loadImage(files[0]);
        }
    }
    
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.loadImage(file);
        }
    }
    
    loadImage(file) {
        if (!file.type.startsWith('image/')) {
            this.updateStatus('Please select a valid image file', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.setupCanvas(img);
                this.updateStatus('Image loaded successfully', 'ready');
                document.getElementById('uploadZone').style.display = 'none';
                document.getElementById('canvasContainer').style.display = 'flex';
                document.getElementById('clearBtn').disabled = false;
                document.getElementById('downloadBtn').disabled = false;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    setupCanvas(img) {
        const maxWidth = 800;
        const maxHeight = 600;
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
        }
        
        this.originalCanvas.width = width;
        this.originalCanvas.height = height;
        this.previewCanvas.width = width;
        this.previewCanvas.height = height;
        
        this.originalCtx.drawImage(img, 0, 0, width, height);
        this.originalImageData = this.originalCtx.getImageData(0, 0, width, height);
        
        document.getElementById('imageInfo').textContent = 
            `${Math.round(width)}×${Math.round(height)} • ${this.originalImageData.data.length / 4} pixels`;
        
        this.processImage();
    }
    
    updateSlider(e) {
        const id = e.target.id;
        const value = parseFloat(e.target.value);
        
        document.getElementById(id + 'Value').textContent = 
            id === 'gamma' || id === 'ditherScale' ? value.toFixed(1) : value;
        
        this.settings[this.camelCase(id)] = value;
        this.processImage();
    }
    
    updateSetting(e) {
        const id = e.target.id;
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        
        if (id === 'algorithmSelect') {
            this.settings.algorithm = value;
        } else if (id === 'grayscaleToggle') {
            this.settings.grayscale = value;
        } else if (id === 'exportFormat') {
            this.settings.format = value;
        }
        
        this.processImage();
    }
    
    camelCase(str) {
        return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    }
    
    async processImage() {
        if (!this.originalImageData || this.isProcessing) return;
        
        this.isProcessing = true;
        this.showProcessing(true);
        
        const startTime = performance.now();
        
        // Use setTimeout to allow UI to update
        setTimeout(() => {
            try {
                const processedData = this.applyDithering(this.originalImageData);
                this.previewCtx.putImageData(processedData, 0, 0);
                
                const endTime = performance.now();
                document.getElementById('processingTime').textContent = 
                    `Processed in ${Math.round(endTime - startTime)}ms`;
                
                this.updateStatus('Processing complete', 'ready');
            } catch (error) {
                console.error('Processing error:', error);
                this.updateStatus('Processing failed', 'error');
            } finally {
                this.isProcessing = false;
                this.showProcessing(false);
            }
        }, 10);
    }
    
    applyDithering(imageData) {
        const data = new Uint8ClampedArray(imageData.data);
        const width = imageData.width;
        const height = imageData.height;
        
        // Apply brightness, gamma, contrast
        this.applyAdjustments(data);
        
        // Convert to grayscale if needed
        if (this.settings.grayscale) {
            this.convertToGrayscale(data);
        }
        
        // Apply selected dithering algorithm
        switch (this.settings.algorithm) {
            case 'floyd-steinberg':
                this.floydSteinbergDither(data, width, height);
                break;
            case 'bayer':
                this.bayerDither(data, width, height);
                break;
            case 'halftone':
                this.halftoneDither(data, width, height);
                break;
            case 'retro':
                this.retroDither(data, width, height);
                break;
            case 'ascii':
                this.asciiDither(data, width, height);
                break;
            case 'threshold':
                this.thresholdDither(data, width, height);
                break;
            case 'random':
                this.randomDither(data, width, height);
                break;
        }
        
        return new ImageData(data, width, height);
    }
    
    applyAdjustments(data) {
        const brightness = this.settings.brightness / 100;
        const contrast = (this.settings.contrast + 100) / 100;
        const gamma = this.settings.gamma;
        
        for (let i = 0; i < data.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                let value = data[i + c] / 255;
                
                // Brightness
                value += brightness;
                
                // Gamma
                value = Math.pow(Math.max(0, value), 1 / gamma);
                
                // Contrast
                value = (value - 0.5) * contrast + 0.5;
                
                data[i + c] = Math.max(0, Math.min(255, value * 255));
            }
        }
    }
    
    convertToGrayscale(data) {
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = data[i + 1] = data[i + 2] = gray;
        }
    }
    
    quantizeColor(value, levels) {
        return Math.round(value / 255 * (levels - 1)) * (255 / (levels - 1));
    }
    
    floydSteinbergDither(data, width, height) {
        const levels = this.settings.colors;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                for (let c = 0; c < 3; c++) {
                    const oldValue = data[idx + c];
                    const newValue = this.quantizeColor(oldValue, levels);
                    const error = oldValue - newValue;
                    
                    data[idx + c] = newValue;
                    
                    // Distribute error
                    if (x + 1 < width) {
                        data[((y * width) + x + 1) * 4 + c] += error * 7/16;
                    }
                    if (y + 1 < height) {
                        if (x > 0) {
                            data[((y + 1) * width + x - 1) * 4 + c] += error * 3/16;
                        }
                        data[((y + 1) * width + x) * 4 + c] += error * 5/16;
                        if (x + 1 < width) {
                            data[((y + 1) * width + x + 1) * 4 + c] += error * 1/16;
                        }
                    }
                }
            }
        }
    }
    
    bayerDither(data, width, height) {
        const levels = this.settings.colors;
        const scale = this.settings.ditherScale;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const bayerX = Math.floor(x / scale) % 4;
                const bayerY = Math.floor(y / scale) % 4;
                const threshold = this.bayerMatrix[bayerY][bayerX] * 255;
                
                for (let c = 0; c < 3; c++) {
                    const value = data[idx + c] + threshold - 128;
                    data[idx + c] = this.quantizeColor(Math.max(0, Math.min(255, value)), levels);
                }
            }
        }
    }
    
    halftoneDither(data, width, height) {
        const scale = Math.max(2, this.settings.ditherScale * 4);
        
        for (let y = 0; y < height; y += scale) {
            for (let x = 0; x < width; x += scale) {
                // Calculate average brightness in this block
                let totalBrightness = 0;
                let pixelCount = 0;
                
                for (let dy = 0; dy < scale && y + dy < height; dy++) {
                    for (let dx = 0; dx < scale && x + dx < width; dx++) {
                        const idx = ((y + dy) * width + (x + dx)) * 4;
                        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                        totalBrightness += brightness;
                        pixelCount++;
                    }
                }
                
                const avgBrightness = totalBrightness / pixelCount;
                const dotRadius = (1 - avgBrightness / 255) * scale / 2;
                const centerX = scale / 2;
                const centerY = scale / 2;
                
                // Fill the block based on distance from center
                for (let dy = 0; dy < scale && y + dy < height; dy++) {
                    for (let dx = 0; dx < scale && x + dx < width; dx++) {
                        const distance = Math.sqrt((dx - centerX) ** 2 + (dy - centerY) ** 2);
                        const idx = ((y + dy) * width + (x + dx)) * 4;
                        
                        if (distance <= dotRadius) {
                            data[idx] = data[idx + 1] = data[idx + 2] = 0;
                        } else {
                            data[idx] = data[idx + 1] = data[idx + 2] = 255;
                        }
                    }
                }
            }
        }
    }
    
    retroDither(data, width, height) {
        const palette = [
            [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0],
            [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
            [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0],
            [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255]
        ];
        
        for (let i = 0; i < data.length; i += 4) {
            let bestDistance = Infinity;
            let bestColor = palette[0];
            
            for (const color of palette) {
                const distance = Math.sqrt(
                    (data[i] - color[0]) ** 2 +
                    (data[i + 1] - color[1]) ** 2 +
                    (data[i + 2] - color[2]) ** 2
                );
                
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestColor = color;
                }
            }
            
            data[i] = bestColor[0];
            data[i + 1] = bestColor[1];
            data[i + 2] = bestColor[2];
        }
    }
    
    asciiDither(data, width, height) {
        const chars = '@%#*+=-:. ';
        const blockSize = Math.max(4, this.settings.ditherScale * 6);
        
        for (let y = 0; y < height; y += blockSize) {
            for (let x = 0; x < width; x += blockSize) {
                let totalBrightness = 0;
                let pixelCount = 0;
                
                for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
                    for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
                        const idx = ((y + dy) * width + (x + dx)) * 4;
                        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                        totalBrightness += brightness;
                        pixelCount++;
                    }
                }
                
                const avgBrightness = totalBrightness / pixelCount;
                const charIndex = Math.floor((1 - avgBrightness / 255) * (chars.length - 1));
                const intensity = charIndex < chars.length / 2 ? 0 : 255;
                
                for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
                    for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
                        const idx = ((y + dy) * width + (x + dx)) * 4;
                        data[idx] = data[idx + 1] = data[idx + 2] = intensity;
                    }
                }
            }
        }
    }
    
    thresholdDither(data, width, height) {
        const threshold = this.settings.threshold;
        
        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const value = brightness > threshold ? 255 : 0;
            data[i] = data[i + 1] = data[i + 2] = value;
        }
    }
    
    randomDither(data, width, height) {
        const levels = this.settings.colors;
        
        for (let i = 0; i < data.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                const noise = (Math.random() - 0.5) * 50 * this.settings.ditherScale;
                const value = data[i + c] + noise;
                data[i + c] = this.quantizeColor(Math.max(0, Math.min(255, value)), levels);
            }
        }
    }
    
    showProcessing(show) {
        document.getElementById('processingOverlay').style.display = show ? 'flex' : 'none';
    }
    
    updateStatus(message, type = 'ready') {
        const statusElement = document.getElementById('statusText');
        statusElement.textContent = message;
        statusElement.className = `status--${type}`;
    }
    
    clearImage() {
        document.getElementById('uploadZone').style.display = 'flex';
        document.getElementById('canvasContainer').style.display = 'none';
        document.getElementById('clearBtn').disabled = true;
        document.getElementById('downloadBtn').disabled = true;
        document.getElementById('fileInput').value = '';
        this.originalImageData = null;
        this.updateStatus('Ready to dither images');
    }
    
    downloadImage() {
        if (!this.previewCanvas) return;
        
        const link = document.createElement('a');
        const format = this.settings.format;
        const quality = format === 'jpg' ? 0.9 : undefined;
        
        link.download = `dithered-image.${format}`;
        link.href = this.previewCanvas.toDataURL(`image/${format}`, quality);
        link.click();
        
        this.updateStatus(`Downloaded as ${format.toUpperCase()}`);
    }
    
    zoomFit() {
        this.previewCanvas.style.maxWidth = '100%';
        this.previewCanvas.style.maxHeight = '100%';
        this.previewCanvas.style.width = 'auto';
        this.previewCanvas.style.height = 'auto';
        this.originalCanvas.style.maxWidth = '100%';
        this.originalCanvas.style.maxHeight = '100%';
        this.originalCanvas.style.width = 'auto';
        this.originalCanvas.style.height = 'auto';
    }
    
    zoom100() {
        this.previewCanvas.style.maxWidth = 'none';
        this.previewCanvas.style.maxHeight = 'none';
        this.previewCanvas.style.width = `${this.previewCanvas.width}px`;
        this.previewCanvas.style.height = `${this.previewCanvas.height}px`;
        this.originalCanvas.style.maxWidth = 'none';
        this.originalCanvas.style.maxHeight = 'none';
        this.originalCanvas.style.width = `${this.originalCanvas.width}px`;
        this.originalCanvas.style.height = `${this.originalCanvas.height}px`;
    }
    
    toggleComparison() {
        this.comparisonMode = !this.comparisonMode;
        const wrapper = document.querySelector('.canvas-wrapper');
        const button = document.getElementById('toggleComparison');
        
        if (this.comparisonMode) {
            wrapper.classList.add('comparison-mode');
            button.textContent = 'Hide Original';
        } else {
            wrapper.classList.remove('comparison-mode');
            button.textContent = 'Compare';
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new DitherStudio();
});