import Jimp from 'jimp';

class ImageProcessor {
  constructor() {
    this.algorithms = {
      'nearest': Jimp.RESIZE_NEAREST_NEIGHBOR,
      'bilinear': Jimp.RESIZE_BILINEAR,
      'bicubic': Jimp.RESIZE_BICUBIC,
      'lanczos': Jimp.RESIZE_BEZIER
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

    const image = await Jimp.read(inputPath);
    const srcWidth = image.bitmap.width;
    const srcHeight = image.bitmap.height;

    const dimensions = this.calculateDimensions(srcWidth, srcHeight, {
      width,
      height,
      scale,
      aspectRatio,
      fit
    });

    const algo = this.algorithms[algorithm];
    image.resize(dimensions.width, dimensions.height, { mode: algo });

    const buffer = await new Promise((resolve, reject) => {
      image.getBuffer('image/png', (err, buf) => {
        if (err) reject(err);
        else resolve(buf);
      });
    });

    return {
      buffer,
      width: dimensions.width,
      height: dimensions.height,
      format: 'png'
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
