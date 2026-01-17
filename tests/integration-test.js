import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import createServer from '../src/server.js';
import { createTestImage, validateImageBuffer } from './test-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, 'output');
let server;

async function setup() {
  await fs.mkdir(outputDir, { recursive: true });
  const { server: s } = createServer({ port: 3001 });
  server = s;
  await new Promise(r => setTimeout(r, 100));
}

async function cleanup() {
  return new Promise(resolve => {
    server.close(() => resolve());
  });
}

async function runFullTest() {
  console.log('Setting up integration test...\n');
  await setup();

  console.log('Creating test images...');
  const solidImage = await createTestImage(1024, 768, 'solid');
  const rgbImage = await createTestImage(800, 600, 'rgb');
  const gradientImage = await createTestImage(1200, 900, 'gradient');

  console.log('Validating test image generation...');
  validateImageBuffer(solidImage);
  validateImageBuffer(rgbImage);
  validateImageBuffer(gradientImage);
  console.log('✓ Test images valid\n');

  const testCases = [
    { name: 'Width only', image: solidImage, params: '?width=400' },
    { name: 'Width + height', image: solidImage, params: '?width=400&height=300' },
    { name: 'Scale 0.5x', image: solidImage, params: '?scale=0.5' },
    { name: 'Scale 2x', image: solidImage, params: '?scale=2' },
    { name: 'Aspect ratio 16:9', image: solidImage, params: '?width=800&aspectRatio=1.777&fit=contain' },
    { name: 'Fit cover', image: rgbImage, params: '?width=400&height=400&fit=cover' },
    { name: 'Fit contain', image: rgbImage, params: '?width=400&height=400&fit=contain' },
    { name: 'Fit fill', image: rgbImage, params: '?width=400&height=400&fit=fill' },
  ];

  const algorithms = ['nearest', 'bilinear', 'bicubic', 'lanczos'];

  console.log('Testing all algorithms with various parameters...\n');

  for (const testCase of testCases) {
    for (const algo of algorithms) {
      try {
        const form = new FormData();
        form.append('image', new Blob([testCase.image], { type: 'image/png' }), 'test.png');

        const response = await fetch(
          `http://localhost:3001/resize${testCase.params}&algorithm=${algo}`,
          { method: 'POST', body: form }
        );

        if (response.status !== 200) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 100)}`);
        }

        const blob = await response.blob();
        if (blob.size === 0) throw new Error('Empty response');

        const width = response.headers.get('X-Resized-Width');
        const height = response.headers.get('X-Resized-Height');
        const returnedAlgo = response.headers.get('X-Algorithm');

        if (returnedAlgo !== algo) {
          throw new Error(`Algorithm mismatch: ${returnedAlgo} vs ${algo}`);
        }

        const filename = `${testCase.name.replace(/\s+/g, '-')}-${algo}.png`;
        const arrayBuf = await blob.arrayBuffer();
        await fs.writeFile(path.join(outputDir, filename), Buffer.from(arrayBuf));

        console.log(`✓ ${testCase.name} (${algo}): ${width}×${height}`);
      } catch (error) {
        console.log(`✗ ${testCase.name} (${algo}): ${error.message}`);
      }
    }
  }

  console.log('\nTesting gradient image with all algorithms...');
  for (const algo of algorithms) {
    try {
      const form = new FormData();
      form.append('image', new Blob([gradientImage], { type: 'image/png' }), 'test.png');

      const response = await fetch(
        `http://localhost:3001/resize?width=400&height=400&algorithm=${algo}`,
        { method: 'POST', body: form }
      );

      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const buffer = Buffer.from(await blob.arrayBuffer());
      validateImageBuffer(buffer);

      await fs.writeFile(path.join(outputDir, `gradient-${algo}.png`), buffer);
      console.log(`✓ Gradient ${algo}: ${blob.size} bytes`);
    } catch (error) {
      console.log(`✗ Gradient ${algo}: ${error.message}`);
    }
  }

  console.log('\nTesting validation...');
  try {
    const response = await fetch('http://localhost:3001/resize?width=-100', {
      method: 'POST'
    });
    if (response.status === 400) {
      console.log('✓ Invalid width rejected');
    }
  } catch (error) {
    console.log('✗ Validation test failed:', error.message);
  }

  console.log('\nTesting health endpoint...');
  try {
    const response = await fetch('http://localhost:3001/health');
    if (response.status === 200) {
      const data = await response.json();
      if (data.status === 'ok') {
        console.log('✓ Health check passed');
      }
    }
  } catch (error) {
    console.log('✗ Health check failed:', error.message);
  }

  console.log(`\nOutput images saved to: ${outputDir}`);
  console.log('All tests completed!\n');

  await cleanup();
}

runFullTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
