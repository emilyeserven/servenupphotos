import { crc32 } from "@portfolio/lib/crc32";

/** One file to put in a zip: its path inside the zip, such as `folder/manifest.json`, and its text. */
export interface ZipEntry {
  path: string;
  text: string;
}

/** Little-endian bytes of 16- and 32-bit numbers, in the order given. */
function numbers(...fields: [value: number, size: 2 | 4][]): number[] {
  return fields.flatMap(([value, size]) =>
    Array.from({ length: size }, (_, i) => (value >>> (8 * i)) & 0xff),
  );
}

/** A file's fields that its local header and its central directory entry both keep. */
function commonFields(crc: number, size: number, nameLength: number): [number, 2 | 4][] {
  // Version 2.0, UTF-8 names, stored (not compressed), no date (1980-01-01).
  return [
    [20, 2],
    [0x0800, 2],
    [0, 2],
    [0, 2],
    [0x21, 2],
    [crc, 4],
    [size, 4],
    [size, 4],
    [nameLength, 2],
    [0, 2],
  ];
}

/**
 * A zip of text files, stored without compression, built in the browser so it downloads from a
 * `blob:` link (no `crypto.subtle` or other API that needs HTTPS).
 */
export function zipFiles(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const local: number[] = [];
  const central: number[] = [];
  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const data = encoder.encode(entry.text);
    const fields = commonFields(crc32(data), data.length, name.length);
    const offset = local.length;
    local.push(...numbers([0x04034b50, 4], ...fields), ...name, ...data);
    central.push(
      ...numbers([0x02014b50, 4], [20, 2], ...fields, [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]),
      ...name,
    );
  }
  const end = numbers(
    [0x06054b50, 4],
    [0, 2],
    [0, 2],
    [entries.length, 2],
    [entries.length, 2],
    [central.length, 4],
    [local.length, 4],
    [0, 2],
  );
  return new Uint8Array([...local, ...central, ...end]);
}
