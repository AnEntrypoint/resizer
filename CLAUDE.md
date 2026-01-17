# Image Resizer - Technical Caveats

## System
- Node.js 18+ (tested on v23.11.1)
- Pure JS image processing via Jimp library
- No native binaries or external tools required

## Implementation Choices

### Image Resizing Algorithms
Uses Jimp v0.22.10 which provides:
- `RESIZE_NEAREST_NEIGHBOR` - fastest, pixelated
- `RESIZE_BILINEAR` - balanced quality/speed
- `RESIZE_BICUBIC` - high quality
- `RESIZE_BEZIER` - highest quality (mapped to "lanczos")

Note: True Lanczos not available in Jimp; Bezier provides best quality alternative.

### Architecture
- Express server with Multer for file uploads
- Memory-based file storage (no disk writes for uploads)
- Temporary file cleanup after processing
- FormData requires Buffer.from(new Uint8Array(arrayBuffer)) for proper conversion

### Testing
- Integration tests generate real PNG images
- Validates: dimensions, fit modes, scaling, aspect ratio
- All 36 test cases pass (9 scenarios × 4 algorithms)
- Output images verified as valid PNG with correct dimensions

## Known Limitations
- Jimp's RESIZE_BEZIER used as lanczos equivalent (high quality alternative)
- Max reasonable image size ~2000x2000px (memory-based processing)
- No streaming - entire image loaded into memory
- No batch processing (sequential requests)

## Hot Reload
Can add with `node --watch src/index.js` but currently uses manual npm scripts.

## Port Configuration
- Default: 3000 (configurable via PORT env var)
- Server listens on all interfaces (0.0.0.0)
- No CORS headers currently set
