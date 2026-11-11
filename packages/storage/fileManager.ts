import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { detectMimeType } from '../core/validation.ts';

export class FileManager {
  private baseStorageDir: string;

  constructor(customStorageDir?: string) {
    this.baseStorageDir = customStorageDir || path.join(process.cwd(), 'data', 'attachments');
    if (!fs.existsSync(this.baseStorageDir)) {
      fs.mkdirSync(this.baseStorageDir, { recursive: true });
    }
  }

  public getStorageDirectory(): string {
    return this.baseStorageDir;
  }

  public calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('error', err => reject(err));
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  public calculateBufferChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  public fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  public saveBuffer(fileName: string, buffer: Buffer): {
    displayName: string;
    storagePath: string;
    sizeBytes: number;
    mimeType: string;
    checksum: string;
  } {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    const safeBase = base.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const finalFileName = `${safeBase}_${uniqueSuffix}${ext}`;
    const destination = path.join(this.baseStorageDir, finalFileName);

    fs.writeFileSync(destination, buffer);

    const checksum = this.calculateBufferChecksum(buffer);
    const mimeType = detectMimeType(fileName);

    return {
      displayName: fileName,
      storagePath: destination,
      sizeBytes: buffer.length,
      mimeType,
      checksum
    };
  }

  public copyLocalFile(sourcePath: string): {
    displayName: string;
    storagePath: string;
    sizeBytes: number;
    mimeType: string;
    checksum: string;
  } {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Le fichier source est inaccessible ou introuvable : ${sourcePath}`);
    }

    const buffer = fs.readFileSync(sourcePath);
    const fileName = path.basename(sourcePath);
    return this.saveBuffer(fileName, buffer);
  }

  public referenceLocalFile(sourcePath: string): {
    displayName: string;
    storagePath: string;
    sizeBytes: number;
    mimeType: string;
    checksum: string;
  } {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Le fichier source est inaccessible ou introuvable : ${sourcePath}`);
    }

    const stat = fs.statSync(sourcePath);
    const buffer = fs.readFileSync(sourcePath);
    const checksum = this.calculateBufferChecksum(buffer);
    const fileName = path.basename(sourcePath);
    const mimeType = detectMimeType(fileName);

    return {
      displayName: fileName,
      storagePath: sourcePath,
      sizeBytes: stat.size,
      mimeType,
      checksum
    };
  }

  public deletePhysicalFile(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        // Only delete if it's within our managed storage dir to protect user original files
        const normalizedStorage = path.resolve(this.baseStorageDir);
        const normalizedTarget = path.resolve(filePath);
        if (normalizedTarget.startsWith(normalizedStorage)) {
          fs.unlinkSync(filePath);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  // Détection des fichiers manquants ou inaccessibles (Section 5.4)
  public checkFileHealth(filePath: string, expectedChecksum?: string): {
    exists: boolean;
    accessible: boolean;
    sizeBytes?: number;
    checksumMatches?: boolean;
  } {
    try {
      if (!fs.existsSync(filePath)) {
        return { exists: false, accessible: false };
      }
      const stat = fs.statSync(filePath);
      let checksumMatches = undefined;
      if (expectedChecksum) {
        const buffer = fs.readFileSync(filePath);
        const currentChecksum = this.calculateBufferChecksum(buffer);
        checksumMatches = currentChecksum === expectedChecksum;
      }
      return {
        exists: true,
        accessible: true,
        sizeBytes: stat.size,
        checksumMatches
      };
    } catch {
      return { exists: false, accessible: false };
    }
  }
}

