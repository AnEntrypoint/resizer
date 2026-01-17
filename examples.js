// Image Resizer API Examples
// Run with: node examples.js

import fs from 'fs/promises';
import axios from 'axios';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function example1_BasicResize() {
  console.log('\n=== Example 1: Basic Resize by Width ===');
  console.log('Resizing image to 400px width');

  const imageBuffer = await fs.readFile('/path/to/image.jpg');
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer]), 'image.jpg');

  const response = await fetch(`${BASE_URL}/resize?width=400`, {
    method: 'POST',
    body: formData
  });

  const output = await response.blob();
  console.log(`✓ Resized: ${response.headers.get('X-Resized-Width')}x${response.headers.get('X-Resized-Height')}`);
  await fs.writeFile('output_400w.png', Buffer.from(await output.arrayBuffer()));
}

async function example2_AspectRatioPreservation() {
  console.log('\n=== Example 2: Aspect Ratio Preservation ===');
  console.log('Resizing to 800px width, maintaining 16:9 aspect ratio with contain');

  const imageBuffer = await fs.readFile('/path/to/image.jpg');
  const form = new FormData();
  form.append('image', new Blob([imageBuffer]), 'image.jpg');

  const response = await fetch(
    `${BASE_URL}/resize?width=800&aspectRatio=1.777&fit=contain`,
    { method: 'POST', body: form }
  );

  const output = await response.blob();
  console.log(`✓ Result: ${response.headers.get('X-Resized-Width')}x${response.headers.get('X-Resized-Height')}`);
  await fs.writeFile('output_16-9.png', Buffer.from(await output.arrayBuffer()));
}

async function example3_AlgorithmComparison() {
  console.log('\n=== Example 3: Compare All Algorithms ===');
  console.log('Resizing same image with all 4 algorithms for quality comparison\n');

  const imageBuffer = await fs.readFile('/path/to/image.jpg');
  const algorithms = ['nearest', 'bilinear', 'bicubic', 'lanczos'];

  for (const algo of algorithms) {
    const form = new FormData();
    form.append('image', new Blob([imageBuffer]), 'image.jpg');

    const response = await fetch(
      `${BASE_URL}/resize?width=300&height=300&fit=cover&algorithm=${algo}`,
      { method: 'POST', body: form }
    );

    const output = await response.blob();
    await fs.writeFile(`output_${algo}.png`, Buffer.from(await output.arrayBuffer()));
    console.log(`✓ ${algo.padEnd(10)}: ${output.size} bytes`);
  }
}

async function example4_RemoteImageResize() {
  console.log('\n=== Example 4: Resize Remote Image ===');
  console.log('Resizing image from URL without downloading first');

  const imageUrl = 'https://example.com/image.jpg';
  const response = await fetch(
    `${BASE_URL}/resize?url=${encodeURIComponent(imageUrl)}&width=400&algorithm=lanczos`,
    { method: 'POST' }
  );

  if (response.ok) {
    const output = await response.blob();
    await fs.writeFile('output_remote.png', Buffer.from(await output.arrayBuffer()));
    console.log(`✓ Downloaded and resized: ${response.headers.get('X-Resized-Width')}x${response.headers.get('X-Resized-Height')}`);
  }
}

async function example5_AxiosMultipart() {
  console.log('\n=== Example 5: Using Axios for Upload ===');
  console.log('Alternative: using axios instead of fetch');

  const imageBuffer = await fs.readFile('/path/to/image.jpg');
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer]), 'image.jpg');

  try {
    const response = await axios.post(`${BASE_URL}/resize?width=400`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    const output = Buffer.from(response.data);
    await fs.writeFile('output_axios.png', output);
    console.log(`✓ Resized via axios: ${response.headers['x-resized-width']}x${response.headers['x-resized-height']}`);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

async function example6_BatchProcessing() {
  console.log('\n=== Example 6: Batch Processing Multiple Images ===');
  console.log('Processing multiple images with sequential requests\n');

  const images = [
    { path: '/path/to/image1.jpg', width: 300 },
    { path: '/path/to/image2.jpg', width: 400 },
    { path: '/path/to/image3.jpg', width: 500 }
  ];

  for (const img of images) {
    try {
      const buffer = await fs.readFile(img.path);
      const form = new FormData();
      form.append('image', new Blob([buffer]), 'image.jpg');

      const response = await fetch(
        `${BASE_URL}/resize?width=${img.width}&algorithm=bicubic`,
        { method: 'POST', body: form }
      );

      const output = await response.blob();
      const filename = img.path.split('/').pop().replace(/\.\w+$/, '');
      await fs.writeFile(`output_${filename}_${img.width}w.png`, Buffer.from(await output.arrayBuffer()));
      console.log(`✓ ${filename}: ${img.width}px`);
    } catch (error) {
      console.error(`✗ ${img.path}: ${error.message}`);
    }
  }
}

async function example7_FitModes() {
  console.log('\n=== Example 7: Different Fit Modes ===');
  console.log('Same source image, different fit modes\n');

  const imageBuffer = await fs.readFile('/path/to/image.jpg');
  const modes = [
    { fit: 'cover', desc: 'Crop to fill 400x400' },
    { fit: 'contain', desc: 'Letterbox to fit 400x400' },
    { fit: 'fill', desc: 'Stretch to exact 400x400' }
  ];

  for (const mode of modes) {
    const form = new FormData();
    form.append('image', new Blob([imageBuffer]), 'image.jpg');

    const response = await fetch(
      `${BASE_URL}/resize?width=400&height=400&fit=${mode.fit}`,
      { method: 'POST', body: form }
    );

    const output = await response.blob();
    await fs.writeFile(`output_fit-${mode.fit}.png`, Buffer.from(await output.arrayBuffer()));
    console.log(`✓ ${mode.desc}: ${response.headers.get('X-Resized-Width')}x${response.headers.get('X-Resized-Height')}`);
  }
}

async function example8_ScalingFactor() {
  console.log('\n=== Example 8: Scaling Factor ===');
  console.log('Using scale parameter instead of fixed dimensions\n');

  const imageBuffer = await fs.readFile('/path/to/image.jpg');
  const scales = [0.25, 0.5, 1.0, 2.0];

  for (const scale of scales) {
    const form = new FormData();
    form.append('image', new Blob([imageBuffer]), 'image.jpg');

    const response = await fetch(
      `${BASE_URL}/resize?scale=${scale}&algorithm=lanczos`,
      { method: 'POST', body: form }
    );

    const output = await response.blob();
    await fs.writeFile(`output_scale-${scale}x.png`, Buffer.from(await output.arrayBuffer()));
    console.log(`✓ ${scale}x: ${response.headers.get('X-Resized-Width')}x${response.headers.get('X-Resized-Height')}`);
  }
}

async function example9_HealthCheck() {
  console.log('\n=== Example 9: Health Check ===');
  console.log('Verify server is running\n');

  const response = await fetch(`${BASE_URL}/health`);
  const data = await response.json();
  console.log(`✓ Server status: ${data.status}`);
  console.log(`✓ Timestamp: ${data.timestamp}`);
}

async function runAllExamples() {
  console.log('Image Resizer API Examples\n');
  console.log('IMPORTANT: Replace /path/to/image.jpg with actual paths or use test files\n');

  try {
    await example9_HealthCheck();
    console.log('\n(Skipping file-dependent examples that require actual image files)');
    console.log('\nTo run full examples:');
    console.log('1. Place test images in project directory');
    console.log('2. Update paths in examples.js');
    console.log('3. Run: node examples.js');
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nMake sure server is running: PORT=3000 npm start');
  }
}

runAllExamples();
