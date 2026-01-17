import { PNG } from 'pngjs';
import fs from 'fs/promises';
import path from 'path';

class ImageProcessor {
  constructor() {
    this.algorithms = {
      'nearest': this.nearestNeighbor.bind(this),
      'bilinear': this.bilinear.bind(this),
      'bicubic': this.bicubic.bind(this),
      'lanczos': this.lanczos.bind(this)
    };
  }

  async processImage(inputPath, options) {
    const {
      width,
      height,
      scale,
      aspectRatio,
      fit = 'cover',
      algorithm = 'lanczos',
      quality = 0.85
    } = options;

    if (!this.algorithms[algorithm]) {
      throw new Error(`Unknown algorithm: ${algorithm}. Available: ${Object.keys(this.algorithms).join(', ')}`);
    }

    // Read the image file
    const imageBuffer = await fs.readFile(inputPath);
    const png = new PNG();

    return new Promise((resolve, reject) => {
      png.parse(imageBuffer, async (err, data) => {
        if (err) {
          reject(new Error(`Failed to parse PNG: ${err.message}`));
          return;
        }

        try {
          const srcWidth = data.width;
          const srcHeight = data.height;

          // Calculate target dimensions
          const dimensions = this.calculateDimensions(srcWidth, srcHeight, {
            width,
            height,
            scale,
            aspectRatio,
            fit
          });

          // Perform resize using selected algorithm
          const resized = await this.resizeImage(
            data,
            dimensions.width,
            dimensions.height,
            algorithm
          );

          // Encode as PNG
          const output = new PNG({
            width: resized.width,
            height: resized.height
          });
          output.data = resized.data;

          // Get PNG buffer
          const chunks = [];
          output.pack().on('data', chunk => chunks.push(chunk)).on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve({
              buffer,
              width: resized.width,
              height: resized.height,
              format: 'png'
            });
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async resizeImage(sourceData, targetWidth, targetHeight, algorithm) {
    const resizeFunc = this.algorithms[algorithm];
    if (!resizeFunc) {
      throw new Error(`Unknown algorithm: ${algorithm}`);
    }

    return resizeFunc(sourceData, targetWidth, targetHeight);
  }

  nearestNeighbor(sourceData, targetWidth, targetHeight) {
    const srcWidth = sourceData.width;
    const srcHeight = sourceData.height;
    const srcData = sourceData.data;

    const targetData = Buffer.alloc(targetWidth * targetHeight * 4);

    const xRatio = srcWidth / targetWidth;
    const yRatio = srcHeight / targetHeight;

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const srcX = Math.floor(x * xRatio);
        const srcY = Math.floor(y * yRatio);

        const srcIdx = (srcY * srcWidth + srcX) * 4;
        const targetIdx = (y * targetWidth + x) * 4;

        targetData[targetIdx] = srcData[srcIdx];
        targetData[targetIdx + 1] = srcData[srcIdx + 1];
        targetData[targetIdx + 2] = srcData[srcIdx + 2];
        targetData[targetIdx + 3] = srcData[srcIdx + 3];
      }
    }

    return {
      width: targetWidth,
      height: targetHeight,
      data: targetData
    };
  }

  bilinear(sourceData, targetWidth, targetHeight) {
    const srcWidth = sourceData.width;
    const srcHeight = sourceData.height;
    const srcData = sourceData.data;

    const targetData = Buffer.alloc(targetWidth * targetHeight * 4);

    const xRatio = (srcWidth - 1) / (targetWidth - 1 || 1);
    const yRatio = (srcHeight - 1) / (targetHeight - 1 || 1);

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const srcX = x * xRatio;
        const srcY = y * yRatio;

        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = Math.min(x0 + 1, srcWidth - 1);
        const y1 = Math.min(y0 + 1, srcHeight - 1);

        const fx = srcX - x0;
        const fy = srcY - y0;

        const idx00 = (y0 * srcWidth + x0) * 4;
        const idx10 = (y0 * srcWidth + x1) * 4;
        const idx01 = (y1 * srcWidth + x0) * 4;
        const idx11 = (y1 * srcWidth + x1) * 4;

        const targetIdx = (y * targetWidth + x) * 4;

        for (let c = 0; c < 4; c++) {
          const v00 = srcData[idx00 + c];
          const v10 = srcData[idx10 + c];
          const v01 = srcData[idx01 + c];
          const v11 = srcData[idx11 + c];

          const v0 = v00 * (1 - fx) + v10 * fx;
          const v1 = v01 * (1 - fx) + v11 * fx;
          const v = v0 * (1 - fy) + v1 * fy;

          targetData[targetIdx + c] = Math.round(v);
        }
      }
    }

    return {
      width: targetWidth,
      height: targetHeight,
      data: targetData
    };
  }

  bicubic(sourceData, targetWidth, targetHeight) {
    const srcWidth = sourceData.width;
    const srcHeight = sourceData.height;
    const srcData = sourceData.data;

    const targetData = Buffer.alloc(targetWidth * targetHeight * 4);

    const xRatio = (srcWidth - 1) / (targetWidth - 1 || 1);
    const yRatio = (srcHeight - 1) / (targetHeight - 1 || 1);

    const cubicKernel = (t) => {
      const at = Math.abs(t);
      if (at <= 1) {
        return 1 - 2 * at * at + at * at * at;
      } else if (at < 2) {
        return -4 + 8 * at - 5 * at * at + at * at * at;
      }
      return 0;
    };

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const srcX = x * xRatio;
        const srcY = y * yRatio;

        const xi = Math.floor(srcX);
        const yi = Math.floor(srcY);

        const targetIdx = (y * targetWidth + x) * 4;

        for (let c = 0; c < 4; c++) {
          let result = 0;
          let weightSum = 0;

          for (let dy = -1; dy <= 2; dy++) {
            for (let dx = -1; dx <= 2; dx++) {
              const px = Math.min(Math.max(xi + dx, 0), srcWidth - 1);
              const py = Math.min(Math.max(yi + dy, 0), srcHeight - 1);

              const weight = cubicKernel(srcX - px) * cubicKernel(srcY - py);
              const pixelIdx = (py * srcWidth + px) * 4;

              result += srcData[pixelIdx + c] * weight;
              weightSum += weight;
            }
          }

          if (weightSum !== 0) {
            result /= weightSum;
          }

          targetData[targetIdx + c] = Math.max(0, Math.min(255, Math.round(result)));
        }
      }
    }

    return {
      width: targetWidth,
      height: targetHeight,
      data: targetData
    };
  }

  lanczos(sourceData, targetWidth, targetHeight) {
    const srcWidth = sourceData.width;
    const srcHeight = sourceData.height;
    const srcData = sourceData.data;

    const targetData = Buffer.alloc(targetWidth * targetHeight * 4);

    const xRatio = (srcWidth - 1) / (targetWidth - 1 || 1);
    const yRatio = (srcHeight - 1) / (targetHeight - 1 || 1);

    const LANCZOS_SIZE = 3;

    const sinc = (x) => {
      if (x === 0) return 1;
      const pi = Math.PI;
      return Math.sin(pi * x) / (pi * x);
    };

    const lanczosKernel = (t) => {
      const at = Math.abs(t);
      if (at === 0) return 1;
      if (at < LANCZOS_SIZE) {
        return sinc(t) * sinc(t / LANCZOS_SIZE);
      }
      return 0;
    };

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const srcX = x * xRatio;
        const srcY = y * yRatio;

        const xi = Math.floor(srcX);
        const yi = Math.floor(srcY);

        const targetIdx = (y * targetWidth + x) * 4;

        for (let c = 0; c < 4; c++) {
          let result = 0;
          let weightSum = 0;

          for (let dy = -LANCZOS_SIZE + 1; dy <= LANCZOS_SIZE; dy++) {
            for (let dx = -LANCZOS_SIZE + 1; dx <= LANCZOS_SIZE; dx++) {
              const px = Math.min(Math.max(xi + dx, 0), srcWidth - 1);
              const py = Math.min(Math.max(yi + dy, 0), srcHeight - 1);

              const weight = lanczosKernel(srcX - px) * lanczosKernel(srcY - py);
              const pixelIdx = (py * srcWidth + px) * 4;

              result += srcData[pixelIdx + c] * weight;
              weightSum += weight;
            }
          }

          if (weightSum !== 0) {
            result /= weightSum;
          }

          targetData[targetIdx + c] = Math.max(0, Math.min(255, Math.round(result)));
        }
      }
    }

    return {
      width: targetWidth,
      height: targetHeight,
      data: targetData
    };
  }

  calculateDimensions(srcWidth, srcHeight, options) {
    const { width, height, scale, aspectRatio, fit } = options;
    let targetWidth = width;
    let targetHeight = height;

    if (scale) {
      targetWidth = Math.round(srcWidth * scale);
      targetHeight = Math.round(srcHeight * scale);
    }

    if (aspectRatio && targetWidth && !targetHeight) {
      targetHeight = Math.round(targetWidth / aspectRatio);
    } else if (aspectRatio && targetHeight && !targetWidth) {
      targetWidth = Math.round(targetHeight * aspectRatio);
    }

    if (!targetWidth) targetWidth = srcWidth;
    if (!targetHeight) targetHeight = srcHeight;

    const hasBothDimensions = width && height;

    if (hasBothDimensions && fit === 'cover') {
      return this.fitCover(srcWidth, srcHeight, targetWidth, targetHeight);
    } else if (hasBothDimensions && fit === 'contain') {
      return this.fitContain(srcWidth, srcHeight, targetWidth, targetHeight);
    } else if (fit === 'fill') {
      return { width: targetWidth, height: targetHeight };
    }

    return { width: targetWidth, height: targetHeight };
  }

  fitCover(srcWidth, srcHeight, targetWidth, targetHeight) {
    const srcAspect = srcWidth / srcHeight;
    const targetAspect = targetWidth / targetHeight;

    if (srcAspect > targetAspect) {
      return { width: Math.round(targetHeight * srcAspect), height: targetHeight };
    } else {
      return { width: targetWidth, height: Math.round(targetWidth / srcAspect) };
    }
  }

  fitContain(srcWidth, srcHeight, targetWidth, targetHeight) {
    const srcAspect = srcWidth / srcHeight;
    const targetAspect = targetWidth / targetHeight;

    if (srcAspect > targetAspect) {
      return { width: targetWidth, height: Math.round(targetWidth / srcAspect) };
    } else {
      return { width: Math.round(targetHeight * srcAspect), height: targetHeight };
    }
  }

  validateOptions(options) {
    const errors = [];

    if (options.width !== undefined && (typeof options.width !== 'number' || options.width <= 0)) {
      errors.push('width must be a positive number');
    }

    if (options.height !== undefined && (typeof options.height !== 'number' || options.height <= 0)) {
      errors.push('height must be a positive number');
    }

    if (options.scale !== undefined && (typeof options.scale !== 'number' || options.scale <= 0)) {
      errors.push('scale must be a positive number');
    }

    if (options.aspectRatio !== undefined && (typeof options.aspectRatio !== 'number' || options.aspectRatio <= 0)) {
      errors.push('aspectRatio must be a positive number');
    }

    if (options.fit && !['cover', 'contain', 'fill'].includes(options.fit)) {
      errors.push('fit must be one of: cover, contain, fill');
    }

    if (options.algorithm && !this.algorithms[options.algorithm]) {
      errors.push(`algorithm must be one of: ${Object.keys(this.algorithms).join(', ')}`);
    }

    if (options.quality !== undefined && (typeof options.quality !== 'number' || options.quality < 0 || options.quality > 1)) {
      errors.push('quality must be a number between 0 and 1');
    }

    return errors;
  }
}

export default new ImageProcessor();
