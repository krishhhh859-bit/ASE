const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const width = 240;
const height = 240;

// Create raw uncompressed image buffer (RGBA)
const buffer = Buffer.alloc(height * (1 + width * 4));

// Draw a dark rounded badge with mint-cyan accent border and "ASE" text pattern
for (let y = 0; y < height; y++) {
  let offset = y * (1 + width * 4);
  buffer[offset++] = 0; // Filter type 0 (None)
  
  for (let x = 0; x < width; x++) {
    // Distance from center
    const dx = x - width / 2;
    const dy = y - height / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= 110 && dist >= 104) {
      // Mint cyan border
      buffer[offset++] = 0;   // R
      buffer[offset++] = 245; // G
      buffer[offset++] = 160; // B
      buffer[offset++] = 255; // A
    } else if (dist < 104) {
      // Dark sleek charcoal fill
      buffer[offset++] = 16;  // R
      buffer[offset++] = 24;  // G
      buffer[offset++] = 40;  // B
      buffer[offset++] = 255; // A
    } else {
      // Transparent outside
      buffer[offset++] = 0;
      buffer[offset++] = 0;
      buffer[offset++] = 0;
      buffer[offset++] = 0;
    }
  }
}

// Simple CRC32 function for PNG chunks
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crc.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// PNG Signature
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// IHDR Chunk
const ihdrData = Buffer.alloc(13);
ihdrData.writeUInt32BE(width, 0);
ihdrData.writeUInt32BE(height, 4);
ihdrData.writeUInt8(8, 8); // 8-bit depth
ihdrData.writeUInt8(6, 9); // RGBA color type
ihdrData.writeUInt8(0, 10);
ihdrData.writeUInt8(0, 11);
ihdrData.writeUInt8(0, 12);
const ihdr = makeChunk('IHDR', ihdrData);

// IDAT Chunk
const compressed = zlib.deflateSync(buffer);
const idat = makeChunk('IDAT', compressed);

// IEND Chunk
const iend = makeChunk('IEND', Buffer.alloc(0));

const png = Buffer.concat([signature, ihdr, idat, iend]);
const assetsDir = path.join(__dirname, 'public', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

fs.writeFileSync(path.join(assetsDir, 'ase-logo.png'), png);
console.log('Generated placeholder PNG logo at public/assets/ase-logo.png');

// Also create SVG version for fallback
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
  <defs>
    <linearGradient id="aseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f5a0" />
      <stop offset="100%" stop-color="#00d9f5" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="240" height="240" rx="36" fill="#101828" stroke="url(#aseGrad)" stroke-width="3" filter="url(#glow)"/>
  <circle cx="120" cy="120" r="88" fill="none" stroke="rgba(0, 245, 160, 0.25)" stroke-width="2" stroke-dasharray="6 4" />
  <path d="M 80 75 L 60 120 L 80 165" fill="none" stroke="#00f5a0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 160 75 L 180 120 L 160 165" fill="none" stroke="#00d9f5" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="120" y="132" font-family="'JetBrains Mono', 'Inter', monospace, sans-serif" font-size="42" font-weight="900" fill="url(#aseGrad)" text-anchor="middle" letter-spacing="2">ASE</text>
  <text x="120" y="156" font-family="'Inter', sans-serif" font-size="10" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="3">NMIT CLUB</text>
  <text x="120" y="196" font-family="'Inter', sans-serif" font-size="8.5" font-weight="600" fill="#64748b" text-anchor="middle">[PLACEHOLDER LOGO]</text>
</svg>`;

fs.writeFileSync(path.join(assetsDir, 'ase-logo.svg'), svgContent, 'utf8');
console.log('Generated placeholder SVG logo at public/assets/ase-logo.svg');
