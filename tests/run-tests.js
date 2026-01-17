import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import createServer from '../src/server.js';
import { createTestImage } from './test-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, 'temp');

let server;
let testsPassed = 0;
let testsFailed = 0;

async function setupTests() {
  await fs.mkdir(testDir, { recursive: true });
  const { server: s } = createServer({ port: 3001 });
  server = s;
  await new Promise(resolve => setTimeout(resolve, 100));
}

async function cleanupTests() {
  return new Promise(resolve => {
    server.close(() => {
      fs.rm(testDir, { recursive: true, force: true }).then(resolve);
    });
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  ${error.message}`);
    testsFailed++;
  }
}

async function testBasicResize() {
  const buffer = await createTestImage(100, 100, 'rgb');
  await fs.writeFile(path.join(testDir, 'test.png'), buffer);

  const form = new FormData();
  form.append('image', new File([buffer], 'test.png', { type: 'image/png' }));

  const response = await fetch('http://localhost:3001/resize?width=50&algorithm=lanczos', {
    method: 'POST',
    body: form
  });

  if (response.status !== 200) throw new Error(`Status: ${response.status}`);
  if (response.headers.get('X-Resized-Width') !== '50') throw new Error('Width mismatch');

  const result = await response.blob();
  if (result.size === 0) throw new Error('Empty response');
}

async function testMultipleAlgorithms() {
  const buffer = await createTestImage(200, 200, 'gradient');
  const algorithms = ['nearest', 'bilinear', 'bicubic', 'lanczos'];

  for (const algo of algorithms) {
    const form = new FormData();
    form.append('image', new File([buffer], 'test.png', { type: 'image/png' }));

    const response = await fetch(`http://localhost:3001/resize?width=100&algorithm=${algo}`, {
      method: 'POST',
      body: form
    });

    if (response.status !== 200) throw new Error(`${algo} failed: ${response.status}`);
    if (response.headers.get('X-Algorithm') !== algo) throw new Error(`Algorithm header mismatch for ${algo}`);

    const result = await response.blob();
    if (result.size === 0) throw new Error(`${algo} returned empty`);
  }
}

async function testAspectRatio() {
  const buffer = await createTestImage(200, 100, 'solid');
  const form = new FormData();
  form.append('image', new File([buffer], 'test.png', { type: 'image/png' }));

  const response = await fetch('http://localhost:3001/resize?width=400&aspectRatio=2&fit=contain', {
    method: 'POST',
    body: form
  });

  if (response.status !== 200) throw new Error(`Status: ${response.status}`);

  const width = parseInt(response.headers.get('X-Resized-Width'), 10);
  const height = parseInt(response.headers.get('X-Resized-Height'), 10);

  if (width / height !== 2) throw new Error(`Aspect ratio not preserved: ${width}/${height}`);
}

async function testFitModes() {
  const buffer = await createTestImage(100, 200, 'solid');
  const modes = ['cover', 'contain', 'fill'];

  for (const mode of modes) {
    const form = new FormData();
    form.append('image', new File([buffer], 'test.png', { type: 'image/png' }));

    const response = await fetch(`http://localhost:3001/resize?width=150&height=150&fit=${mode}`, {
      method: 'POST',
      body: form
    });

    if (response.status !== 200) throw new Error(`${mode} failed: ${response.status}`);
    const result = await response.blob();
    if (result.size === 0) throw new Error(`${mode} returned empty`);
  }
}

async function testScale() {
  const buffer = await createTestImage(100, 100, 'rgb');
  const form = new FormData();
  form.append('image', new File([buffer], 'test.png', { type: 'image/png' }));

  const response = await fetch('http://localhost:3001/resize?scale=2.5', {
    method: 'POST',
    body: form
  });

  if (response.status !== 200) throw new Error(`Status: ${response.status}`);

  const width = parseInt(response.headers.get('X-Resized-Width'), 10);
  const height = parseInt(response.headers.get('X-Resized-Height'), 10);

  if (width !== 250 || height !== 250) throw new Error(`Scale not applied: ${width}x${height}`);
}

async function testValidation() {
  const buffer = await createTestImage(100, 100, 'solid');
  const form = new FormData();
  form.append('image', new File([buffer], 'test.png', { type: 'image/png' }));

  const response = await fetch('http://localhost:3001/resize?width=-100', {
    method: 'POST',
    body: form
  });

  if (response.status !== 400) throw new Error('Invalid width should return 400');

  const error = await response.json();
  if (!error.messages || error.messages.length === 0) throw new Error('No validation error message');
}

async function testHealth() {
  const response = await fetch('http://localhost:3001/health');
  if (response.status !== 200) throw new Error(`Health check failed: ${response.status}`);

  const data = await response.json();
  if (data.status !== 'ok') throw new Error('Health status not ok');
}

async function testWithoutImage() {
  const response = await fetch('http://localhost:3001/resize?width=100', {
    method: 'POST'
  });

  if (response.status !== 400) throw new Error('Missing image should return 400');

  const error = await response.json();
  if (!error.error) throw new Error('No error message');
}

async function testQualityParameter() {
  const buffer = await createTestImage(100, 100, 'gradient');
  const form = new FormData();
  form.append('image', new File([buffer], 'test.png', { type: 'image/png' }));

  const response = await fetch('http://localhost:3001/resize?width=50&quality=0.5', {
    method: 'POST',
    body: form
  });

  if (response.status !== 200) throw new Error(`Status: ${response.status}`);
  const result = await response.blob();
  if (result.size === 0) throw new Error('Empty response');
}

async function runTests() {
  console.log('Setting up tests...\n');
  await setupTests();

  console.log('Running tests:\n');

  await test('Basic resize', testBasicResize);
  await test('Multiple algorithms', testMultipleAlgorithms);
  await test('Aspect ratio preservation', testAspectRatio);
  await test('Fit modes (cover, contain, fill)', testFitModes);
  await test('Scale parameter', testScale);
  await test('Input validation', testValidation);
  await test('Health check', testHealth);
  await test('Missing image error', testWithoutImage);
  await test('Quality parameter', testQualityParameter);

  console.log(`\n${testsPassed} passed, ${testsFailed} failed\n`);

  await cleanupTests();

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
