# Image Resizer - Technical Caveats & Implementation Notes

## Environment & Dependencies
- **Node.js:** 18+ (tested on v23.11.1)
- **Image codec:** pngjs (pure JavaScript PNG encoder/decoder)
- **No external binaries:** All pixel manipulation in native JavaScript
- **No compiled native modules:** Pure npm dependencies only

## Resizing Algorithms

### Implementation Details
All algorithms implemented as pure JavaScript pixel manipulation:

1. **Nearest Neighbor** - O(1) per pixel, fastest, visible pixelation on upscaling
2. **Bilinear** - 4-pixel interpolation, moderate quality/speed tradeoff
3. **Bicubic** - 16-pixel cubic convolution kernel, high quality
4. **Lanczos3** - Sinc function windowing with 3-lobe radius, best quality but slowest

### Lanczos Implementation Note
The Lanczos3 implementation is a custom pure-JavaScript approximation using sinc function windowing. It matches the mathematical principles of true Lanczos but is not byte-for-byte identical to reference implementations like ImageMagick's. Quality is visually equivalent for most use cases.

## Image Format Constraints
- **Input:** PNG only (pngjs limitation)
- **Output:** PNG only (8-bit RGBA)
- **JPEG/WebP:** Not supported - no format conversion capability
- **Workaround:** Convert images to PNG externally before processing

## Memory & Performance
- **Memory-based:** Entire image loaded into memory during processing
- **Practical limit:** ~2000x2000px per image (varies with available RAM)
- **Large images:** Will cause memory pressure and increased GC pauses
- **No streaming:** Cannot process images larger than available heap
- **Single-threaded:** Sequential processing only, no parallelization

## Dimension Calculation Edge Cases
- **Both width & height specified:** Image scaled and cropped (fit mode determines behavior)
- **Only width OR height specified:** Other dimension calculated to preserve aspect ratio
- **Neither specified:** Scale parameter or aspectRatio must be provided
- **Scale without dimensions:** Scales from original dimensions
- **aspectRatio parameter:** Only used when fitting to calculate missing dimension

## Fit Modes Behavior
- **cover:** Scales to cover box, crops excess (default)
- **contain:** Scales to fit in box, letterboxes with white background
- **fill:** Stretches to exact dimensions (ignores aspect ratio)

## API Contract
- **Request body:** multipart/form-data with "image" field
- **Alternative:** ?url=http://... to fetch and resize remote image
- **Response:** PNG binary (Content-Type: image/png)
- **Error format:** JSON with descriptive error message and HTTP status

## Known Limitations
1. PNG-only I/O - no automatic format detection or conversion
2. Memory-bound - not suitable for batch processing large images
3. No progressive output - client waits for complete processing
4. No caching layer - repeated requests re-process
5. Single-process - no horizontal scaling within Node
6. No timeout enforcement - very large images may hang indefinitely

## Hot Reload
Supports `node --watch src/index.js` via npm dev script (Node 18.11+). State is completely stateless so reload is safe.

## Configuration
- **PORT:** Configurable via environment variable (default: 3000)
- **Binds to:** 0.0.0.0 (all interfaces)
- **CORS:** Not configured - add if needed for cross-origin requests
