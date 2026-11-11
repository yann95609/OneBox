import zlib from 'node:zlib';

interface ZipEntry {
  name: string;
  data: Buffer;
  crc32: number;
  compressedData: Buffer;
  offset: number;
}

// Table CRC32
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function calculateCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export class SimpleZipBuilder {
  private files: { path: string; data: Buffer }[] = [];

  public addFile(zipPath: string, content: Buffer | string): void {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const normalizedPath = zipPath.replace(/\\/g, '/').replace(/^\/+/, '');
    this.files.push({ path: normalizedPath, data });
  }

  public toBuffer(): Buffer {
    const entries: ZipEntry[] = [];
    const localHeaders: Buffer[] = [];
    let currentOffset = 0;

    for (const file of this.files) {
      const crc = calculateCrc32(file.data);
      const compressed = zlib.deflateRawSync(file.data);
      const pathBuf = Buffer.from(file.path, 'utf8');

      // Local file header (30 bytes + filename)
      const header = Buffer.alloc(30 + pathBuf.length);
      header.writeUInt32LE(0x04034b50, 0); // signature
      header.writeUInt16LE(20, 4);         // version needed (2.0)
      header.writeUInt16LE(0, 6);          // general purpose flag
      header.writeUInt16LE(8, 8);          // compression method (8 = Deflate)
      header.writeUInt16LE(0, 10);         // last mod time
      header.writeUInt16LE(0, 12);         // last mod date
      header.writeUInt32LE(crc, 14);       // crc-32
      header.writeUInt32LE(compressed.length, 18); // compressed size
      header.writeUInt32LE(file.data.length, 22);   // uncompressed size
      header.writeUInt16LE(pathBuf.length, 26);     // filename length
      header.writeUInt16LE(0, 28);                  // extra field length
      pathBuf.copy(header, 30);

      const entry: ZipEntry = {
        name: file.path,
        data: file.data,
        crc32: crc,
        compressedData: compressed,
        offset: currentOffset
      };

      entries.push(entry);
      localHeaders.push(header, compressed);
      currentOffset += header.length + compressed.length;
    }

    // Central directory
    const centralDirectoryParts: Buffer[] = [];
    let centralDirectorySize = 0;

    for (const entry of entries) {
      const pathBuf = Buffer.from(entry.name, 'utf8');
      const cdHeader = Buffer.alloc(46 + pathBuf.length);

      cdHeader.writeUInt32LE(0x02014b50, 0); // signature
      cdHeader.writeUInt16LE(20, 4);         // version made by
      cdHeader.writeUInt16LE(20, 6);         // version needed
      cdHeader.writeUInt16LE(0, 8);          // general purpose
      cdHeader.writeUInt16LE(8, 10);         // compression (Deflate)
      cdHeader.writeUInt16LE(0, 12);         // mod time
      cdHeader.writeUInt16LE(0, 14);         // mod date
      cdHeader.writeUInt32LE(entry.crc32, 16);
      cdHeader.writeUInt32LE(entry.compressedData.length, 20);
      cdHeader.writeUInt32LE(entry.data.length, 24);
      cdHeader.writeUInt16LE(pathBuf.length, 28);
      cdHeader.writeUInt16LE(0, 30);         // extra len
      cdHeader.writeUInt16LE(0, 32);         // comment len
      cdHeader.writeUInt16LE(0, 34);         // disk number start
      cdHeader.writeUInt16LE(0, 36);         // internal file attributes
      cdHeader.writeUInt32LE(0, 38);         // external file attributes
      cdHeader.writeUInt32LE(entry.offset, 42); // relative offset of local header
      pathBuf.copy(cdHeader, 46);

      centralDirectoryParts.push(cdHeader);
      centralDirectorySize += cdHeader.length;
    }

    // End of central directory record (22 bytes)
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // signature
    eocd.writeUInt16LE(0, 4);          // disk number
    eocd.writeUInt16LE(0, 6);          // start disk
    eocd.writeUInt16LE(entries.length, 8);  // entries on disk
    eocd.writeUInt16LE(entries.length, 10); // total entries
    eocd.writeUInt32LE(centralDirectorySize, 12); // size of CD
    eocd.writeUInt32LE(currentOffset, 16);        // offset of start of CD
    eocd.writeUInt16LE(0, 20);                    // comment len

    return Buffer.concat([...localHeaders, ...centralDirectoryParts, eocd]);
  }
}

