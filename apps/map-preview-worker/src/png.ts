/**
 * Just enough PNG reading and writing for the map preview: reading CARTO's tiles and the
 * attribution, and writing the finished image. Workers have no canvas, so this works on raw pixels,
 * and uses the runtime's own zlib (`CompressionStream`) for the compressed part of the file.
 *
 * > **Frontend analogy:** like drawing into an `ImageData` and calling `canvas.toBlob()`, with the
 * > `toBlob()` part written out by hand.
 */

/** An image as straight RGBA bytes, four per pixel, row by row from the top left. */
export interface Rgba {
  width: number;
  height: number;
  data: Uint8Array;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** Samples per pixel for each PNG color type: gray, RGB, palette, gray with alpha, RGBA. */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** The header of a PNG file. */
interface Header {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
}

/** The chunks of a PNG file this reads: its header, palette, palette transparency and pixel data. */
interface Chunks {
  header: Header;
  palette: Uint8Array;
  alpha: Uint8Array;
  idat: Uint8Array[];
}

/** Runs bytes through a compression or decompression stream and gives back the result. */
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(bytes).body!.pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Reads the 4-byte big-endian number at offset. */
function u32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
}

/** The header's fields, throwing for an interlaced PNG, which this doesn't read. */
function parseHeader(data: Uint8Array): Header {
  if (data[12] !== 0) throw new Error("Interlaced PNGs aren't supported");
  return { width: u32(data, 0), height: u32(data, 4), bitDepth: data[8]!, colorType: data[9]! };
}

/** Splits a PNG file into the chunks this reads. */
function readChunks(bytes: Uint8Array): Chunks {
  if (SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error("Not a PNG");
  const chunks: Chunks = {
    header: parseHeader(bytes.subarray(16, 29)),
    palette: new Uint8Array(),
    alpha: new Uint8Array(),
    idat: [],
  };
  for (let at = 8; at < bytes.length;) {
    const length = u32(bytes, at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    keepChunk(chunks, type, bytes.subarray(at + 8, at + 8 + length));
    at += length + 12;
  }
  return chunks;
}

/** Keeps a chunk's data when it's one this reads. */
function keepChunk(chunks: Chunks, type: string, data: Uint8Array) {
  if (type === "PLTE") chunks.palette = data;
  if (type === "tRNS") chunks.alpha = data;
  if (type === "IDAT") chunks.idat.push(data);
}

/** Joins byte arrays end to end. */
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** The Paeth predictor from the PNG spec: whichever of left, up and up-left is nearest their sum. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Undoes each filter type in place, given the row above (already unfiltered) and how many bytes
 * back the pixel to the left starts. Each is its own loop, as this runs for every byte of every
 * tile.
 */
const UNFILTER: ((row: Uint8Array, above: Uint8Array, step: number) => void)[] = [
  () => {},
  (row, _above, step) => {
    for (let i = step; i < row.length; i++) row[i] = (row[i]! + row[i - step]!) & 0xff;
  },
  (row, above) => {
    for (let i = 0; i < row.length; i++) row[i] = (row[i]! + above[i]!) & 0xff;
  },
  (row, above, step) => {
    for (let i = 0; i < row.length; i++) {
      row[i] = (row[i]! + (((i >= step ? row[i - step]! : 0) + above[i]!) >> 1)) & 0xff;
    }
  },
  (row, above, step) => {
    for (let i = 0; i < step; i++) row[i] = (row[i]! + above[i]!) & 0xff;
    for (let i = step; i < row.length; i++) {
      row[i] = (row[i]! + paeth(row[i - step]!, above[i]!, above[i - step]!)) & 0xff;
    }
  },
];

/** Undoes one row's filter in place, given the row above it (already unfiltered). */
function unfilterRow(row: Uint8Array, above: Uint8Array, filter: number, step: number) {
  const undo = UNFILTER[filter];
  if (!undo) throw new Error(`Unknown PNG filter ${filter}`);
  undo(row, above, step);
}

/** The unfiltered rows of the image's pixel data, each its packed samples without the filter byte. */
function unfilter(raw: Uint8Array, header: Header): Uint8Array[] {
  const bitsPerPixel = CHANNELS[header.colorType]! * header.bitDepth;
  const stride = Math.ceil((header.width * bitsPerPixel) / 8);
  const step = Math.max(1, bitsPerPixel >> 3);
  const rows: Uint8Array[] = [];
  let above = new Uint8Array(stride);
  for (let y = 0; y < header.height; y++) {
    const start = y * (stride + 1);
    const row = raw.slice(start + 1, start + 1 + stride);
    unfilterRow(row, above, raw[start]!, step);
    rows.push(row);
    above = row;
  }
  return rows;
}

/** The sample at index in a packed row of 1, 2, 4 or 8 bits per sample (16-bit reads its high byte). */
function sampleAt(row: Uint8Array, index: number, bitDepth: number): number {
  if (bitDepth >= 8) return row[(index * bitDepth) >> 3]!;
  const bit = index * bitDepth;
  const max = (1 << bitDepth) - 1;
  return (row[bit >> 3]! >> (8 - bitDepth - (bit & 7))) & max;
}

/** Writes pixel x of a row into out at offset o as RGBA. */
type PixelReader = (row: Uint8Array, x: number, out: Uint8Array, o: number) => void;

/** Scales a gray sample of the bit depth to 0–255. */
function grayAt(row: Uint8Array, index: number, bitDepth: number): number {
  const value = sampleAt(row, index, bitDepth);
  return bitDepth >= 8 ? value : Math.round((value * 255) / ((1 << bitDepth) - 1));
}

/** Reads palette pixels: each sample is an index into the palette and its transparency. */
function paletteReader({ palette, alpha, header }: Chunks): PixelReader {
  return (row, x, out, o) => {
    const i = sampleAt(row, x, header.bitDepth);
    out[o] = palette[i * 3]!;
    out[o + 1] = palette[i * 3 + 1]!;
    out[o + 2] = palette[i * 3 + 2]!;
    out[o + 3] = alpha[i] ?? 255;
  };
}

/** Reads gray pixels, with alpha when the color type has it. */
function grayReader({ header }: Chunks): PixelReader {
  const channels = CHANNELS[header.colorType]!;
  return (row, x, out, o) => {
    const gray = grayAt(row, x * channels, header.bitDepth);
    out.fill(gray, o, o + 3);
    out[o + 3] = channels === 2 ? grayAt(row, x * 2 + 1, header.bitDepth) : 255;
  };
}

/** Reads RGB pixels, with alpha when the color type has it (16-bit reads each sample's high byte). */
function colorReader({ header }: Chunks): PixelReader {
  const channels = CHANNELS[header.colorType]!;
  const bytes = header.bitDepth >> 3;
  return (row, x, out, o) => {
    const at = x * channels * bytes;
    out[o] = row[at]!;
    out[o + 1] = row[at + bytes]!;
    out[o + 2] = row[at + 2 * bytes]!;
    out[o + 3] = channels === 4 ? row[at + 3 * bytes]! : 255;
  };
}

/** The reader for the image's color type. */
function readerFor(chunks: Chunks): PixelReader {
  const type = chunks.header.colorType;
  if (type === 3) return paletteReader(chunks);
  return type === 0 || type === 4 ? grayReader(chunks) : colorReader(chunks);
}

/** Unpacks the rows into RGBA. */
function rowsToRgba(rows: Uint8Array[], chunks: Chunks): Uint8Array {
  const width = chunks.header.width;
  const read = readerFor(chunks);
  const out = new Uint8Array(width * rows.length * 4);
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) read(row, x, out, (y * width + x) * 4);
  });
  return out;
}

/** Reads a PNG file into RGBA pixels. Interlaced PNGs aren't supported. */
export async function decodePng(bytes: Uint8Array): Promise<Rgba> {
  const chunks = readChunks(bytes);
  const raw = await pipe(concat(chunks.idat), new DecompressionStream("deflate"));
  const rows = unfilter(raw, chunks.header);
  return {
    width: chunks.header.width,
    height: chunks.header.height,
    data: rowsToRgba(rows, chunks),
  };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** The CRC-32 of the bytes, as PNG chunks end with. */
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** One PNG chunk: its length, type, data and CRC. */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(
    Array.from(type, (ch) => ch.charCodeAt(0)),
    4,
  );
  out.set(data, 8);
  view.setUint32(data.length + 8, crc32(out.subarray(4, data.length + 8)));
  return out;
}

/**
 * The RGB pixels (three bytes each) as PNG rows, each with the "Up" filter, which keeps the long
 * runs of one color on a map small once compressed.
 */
function filterRows(rgb: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width * 3;
  const out = new Uint8Array((stride + 1) * height);
  // The first row has nothing above it, so it's left unfiltered (filter 0).
  out.set(rgb.subarray(0, stride), 1);
  for (let y = 1; y < height; y++) upFilterRow(rgb, out, y, stride);
  return out;
}

/** Writes row y with the "Up" filter (2): each byte less the one above it. */
function upFilterRow(rgb: Uint8Array, out: Uint8Array, y: number, stride: number) {
  const at = y * (stride + 1);
  out[at] = 2;
  for (let i = 0; i < stride; i++) {
    out[at + 1 + i] = (rgb[y * stride + i]! - rgb[(y - 1) * stride + i]!) & 0xff;
  }
}

/** Writes RGB pixels, three bytes each, as a PNG file. */
export async function encodePng(
  rgb: Uint8Array,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8);
  const idat = await pipe(filterRows(rgb, width, height), new CompressionStream("deflate"));
  return concat([
    new Uint8Array(SIGNATURE),
    chunk("IHDR", header),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array()),
  ]);
}
