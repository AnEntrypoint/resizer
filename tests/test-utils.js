import Jimp from 'jimp';

export async function createTestImage(width, height, type = 'solid') {
  const image = await Jimp.create(width, height, 0xccccccff);

  switch (type) {
    case 'solid': {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          image.setPixelColor(0xFF5733FF, x, y);
        }
      }
      break;
    }

    case 'rgb': {
      const thirdW = Math.floor(width / 3);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let color;
          if (x < thirdW) color = 0xFF0000FF;
          else if (x < 2 * thirdW) color = 0x00FF00FF;
          else color = 0x0000FFFF;
          image.setPixelColor(color, x, y);
        }
      }
      break;
    }

    case 'gradient': {
      for (let y = 0; y < height; y++) {
        const ratio = y / height;
        const r = Math.round(255 * (1 - ratio));
        const g = Math.round(255 * ratio);
        const b = Math.round(255 * ratio);
        const color = (r << 24 | g << 16 | b << 8 | 0xFF) >>> 0;
        for (let x = 0; x < width; x++) {
          image.setPixelColor(color, x, y);
        }
      }
      break;
    }

    case 'checkerboard': {
      const squareSize = Math.max(1, Math.floor(width / 8));
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const color = ((Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0) ? 0xFFFFFFFF : 0x000000FF;
          image.setPixelColor(color, x, y);
        }
      }
      break;
    }

    case 'circle': {
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 3;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          const color = dist <= radius ? 0xFF5733FF : 0xFFFFFFFF;
          image.setPixelColor(color, x, y);
        }
      }
      break;
    }

    default:
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          image.setPixelColor(0xCCCCCCFF, x, y);
        }
      }
  }

  return new Promise((resolve, reject) => {
    image.getBuffer('image/png', (err, buffer) => {
      if (err) reject(err);
      else resolve(buffer);
    });
  });
}

export async function createTestImageWithText(width, height, text = 'Test') {
  const image = await Jimp.create(width, height, 0xFFFFFFFF);
  return new Promise((resolve, reject) => {
    image.getBuffer('image/png', (err, buffer) => {
      if (err) reject(err);
      else resolve(buffer);
    });
  });
}

export function validateImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Not a valid buffer');
  }

  if (buffer.length === 0) {
    throw new Error('Empty buffer');
  }

  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error('Invalid PNG signature');
  }

  return true;
}
