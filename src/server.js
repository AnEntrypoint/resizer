import express from 'express';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import imageProcessor from './image-processor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ storage: multer.memoryStorage() });

export function createServer(config = {}) {
  const app = express();
  const {
    port = 3000,
    maxFileSize = 50 * 1024 * 1024,
    tempDir = '/tmp/resizer'
  } = config;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.post('/resize', upload.single('image'), async (req, res) => {
    try {
      if (!req.file && !req.query.url) {
        return res.status(400).json({
          error: 'Missing image',
          message: 'Provide either image file upload or url parameter'
        });
      }

      const options = parseResizeOptions(req);
      const validationErrors = imageProcessor.validateOptions(options);

      if (validationErrors.length > 0) {
        return res.status(400).json({
          error: 'Invalid parameters',
          messages: validationErrors
        });
      }

      let imagePath;

      if (req.file) {
        imagePath = await saveTemporaryFile(req.file.buffer);
      } else if (req.query.url) {
        imagePath = await downloadImage(req.query.url, tempDir);
      }

      const result = await imageProcessor.processImage(imagePath, options);
      await cleanup(imagePath);

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('X-Resized-Width', result.width);
      res.setHeader('X-Resized-Height', result.height);
      res.setHeader('X-Algorithm', options.algorithm || 'lanczos');
      res.send(result.buffer);
    } catch (error) {
      console.error('Resize error:', error);
      res.status(500).json({
        error: 'Processing failed',
        message: error.message
      });
    }
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api-docs', (req, res) => {
    res.type('text/markdown');
    res.send(getApiDocs());
  });

  app.use(express.static(path.join(__dirname, '../public')));

  const server = app.listen(port, () => {
    console.log(`Image Resizer listening on http://localhost:${port}`);
    console.log(`API docs at http://localhost:${port}/api-docs`);
  });

  return {
    app,
    server,
    close: () => new Promise(resolve => server.close(resolve))
  };
}

function parseResizeOptions(req) {
  const params = req.query;
  const options = {};

  if (params.width) options.width = parseInt(params.width, 10);
  if (params.height) options.height = parseInt(params.height, 10);
  if (params.scale) options.scale = parseFloat(params.scale);
  if (params.aspectRatio) options.aspectRatio = parseFloat(params.aspectRatio);
  if (params.fit) options.fit = params.fit;
  if (params.algorithm) options.algorithm = params.algorithm;
  if (params.quality) options.quality = parseFloat(params.quality);

  return options;
}

async function saveTemporaryFile(buffer) {
  const tempDir = '/tmp/resizer';
  await fs.mkdir(tempDir, { recursive: true });
  const filename = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const filepath = path.join(tempDir, filename);
  await fs.writeFile(filepath, buffer);
  return filepath;
}

async function downloadImage(url, tempDir) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    await fs.mkdir(tempDir, { recursive: true });
    const filename = `remote-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const filepath = path.join(tempDir, filename);
    await fs.writeFile(filepath, response.data);
    return filepath;
  } catch (error) {
    throw new Error(`Failed to download image: ${error.message}`);
  }
}

async function cleanup(filepath) {
  try {
    await fs.unlink(filepath);
  } catch (error) {
    console.warn(`Failed to cleanup ${filepath}:`, error.message);
  }
}

function getApiDocs() {
  return `# Image Resizer API

## Overview
High-performance image resizing server with multiple algorithms for optimal quality.

## Endpoints

### POST /resize
Resize an image with various algorithms and fit modes.

#### Parameters

**Upload**
- \`image\`: Form data file (image file upload)

**Query Parameters**
- \`width\`: integer - Target width in pixels
- \`height\`: integer - Target height in pixels
- \`scale\`: float - Scale factor (0.1 to 10.0)
- \`aspectRatio\`: float - Target aspect ratio (width/height)
- \`fit\`: string - Fit mode: \`cover\`, \`contain\`, \`fill\` (default: \`cover\`)
- \`algorithm\`: string - Resizing algorithm: \`nearest\`, \`bilinear\`, \`bicubic\`, \`lanczos\` (default: \`lanczos\`)
- \`quality\`: float - Quality level 0-1 (default: 0.85)
- \`url\`: string - Remote image URL (alternative to upload)

#### Examples

**Basic resize by width**
\`\`\`bash
curl -X POST -F "image=@photo.jpg" \\
  "http://localhost:3000/resize?width=400&algorithm=lanczos" \\
  -o resized.png
\`\`\`

**Resize with aspect ratio**
\`\`\`bash
curl -X POST -F "image=@photo.jpg" \\
  "http://localhost:3000/resize?width=800&aspectRatio=16/9" \\
  -o resized.png
\`\`\`

**Remote image resize**
\`\`\`bash
curl -X POST \\
  "http://localhost:3000/resize?url=https://example.com/image.jpg&width=400" \\
  -o resized.png
\`\`\`

**Test different algorithms**
\`\`\`bash
curl -X POST -F "image=@photo.jpg" \\
  "http://localhost:3000/resize?width=200&algorithm=nearest" \\
  -o nearest.png

curl -X POST -F "image=@photo.jpg" \\
  "http://localhost:3000/resize?width=200&algorithm=bilinear" \\
  -o bilinear.png

curl -X POST -F "image=@photo.jpg" \\
  "http://localhost:3000/resize?width=200&algorithm=bicubic" \\
  -o bicubic.png

curl -X POST -F "image=@photo.jpg" \\
  "http://localhost:3000/resize?width=200&algorithm=lanczos" \\
  -o lanczos.png
\`\`\`

#### Response

**Success (200)**
Returns the resized image as PNG with headers:
- \`Content-Type: image/png\`
- \`X-Resized-Width\`: Output width
- \`X-Resized-Height\`: Output height
- \`X-Algorithm\`: Algorithm used

**Error (400)**
\`\`\`json
{
  "error": "Invalid parameters",
  "messages": ["width must be a positive number"]
}
\`\`\`

### GET /health
Health check endpoint.

**Response (200)**
\`\`\`json
{
  "status": "ok",
  "timestamp": "2026-01-17T12:00:00.000Z"
}
\`\`\`

## Algorithm Comparison

- **nearest**: Fastest, pixelated output. Use for thumbnails or artistic effect
- **bilinear**: Good balance of speed and quality. Use for general purpose
- **bicubic**: Higher quality, slower. Use when quality matters
- **lanczos**: Highest quality (default). Use for professional results

## Fit Modes

- **cover**: Scale to fill target dimensions, crop if necessary (default)
- **contain**: Scale to fit inside target dimensions, letterbox if necessary
- **fill**: Stretch to exact target dimensions

## Best Practices

1. **Algorithm Selection**
   - Use \`lanczos\` for high-quality images (default)
   - Use \`bicubic\` for fast processing
   - Use \`bilinear\` for web thumbnails
   - Use \`nearest\` only for pixel art

2. **Quality**
   - Set \`quality=1\` for lossless (PNG)
   - Quality parameter optimizes compression level

3. **Aspect Ratio**
   - Provide either width/height or aspectRatio, not both
   - Use \`fit=contain\` to preserve aspect ratio with padding
   - Use \`fit=cover\` to crop to exact dimensions

4. **Performance**
   - Resize on demand rather than pre-resizing all variants
   - Use CDN or caching for repeated requests
   - Keep dimensions reasonable (avoid extreme upscaling)
`;
}

export default createServer;
