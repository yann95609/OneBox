// Déclarations TypeScript autonomes pour ONEBOX (Node.js & SQLite)

declare module 'node:sqlite' {
  export interface StatementSyncResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    all(...params: any[]): any[];
    get(...params: any[]): any;
    run(...params: any[]): StatementSyncResult;
  }

  export class DatabaseSync {
    constructor(location: string, options?: { open?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}

declare module 'node:http' {
  export interface IncomingMessage {
    headers: Record<string, string | string[] | undefined>;
    url?: string;
    method?: string;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export interface ServerResponse {
    writeHead(statusCode: number, headers?: Record<string, string | number>): this;
    end(chunk?: any): this;
  }

  export interface Server {
    listen(port: number, host?: string, callback?: () => void): this;
  }

  export function createServer(
    requestListener?: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  ): Server;

  export function get(url: string, callback?: (res: IncomingMessage & { statusCode?: number; headers: Record<string, any> }) => void): any;

  const defaultExport: {
    createServer: typeof createServer;
    get: typeof get;
  };
  export default defaultExport;
}

declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  export function readFileSync(path: string, options?: any): Buffer;
  export function writeFileSync(path: string, data: any, options?: any): void;
  export function unlinkSync(path: string): void;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function statSync(path: string): { size: number };
  export function createReadStream(path: string): any;

  const defaultExport: {
    existsSync: typeof existsSync;
    mkdirSync: typeof mkdirSync;
    readFileSync: typeof readFileSync;
    writeFileSync: typeof writeFileSync;
    unlinkSync: typeof unlinkSync;
    rmSync: typeof rmSync;
    statSync: typeof statSync;
    createReadStream: typeof createReadStream;
  };
  export default defaultExport;
}

declare module 'node:path' {
  export function join(...paths: string[]): string;
  export function dirname(p: string): string;
  export function basename(p: string, ext?: string): string;
  export function extname(p: string): string;
  export function resolve(...paths: string[]): string;

  const defaultExport: {
    join: typeof join;
    dirname: typeof dirname;
    basename: typeof basename;
    extname: typeof extname;
    resolve: typeof resolve;
  };
  export default defaultExport;
}

declare module 'node:crypto' {
  export function randomUUID(): string;
  export function createHash(algorithm: string): {
    update(data: any): any;
    digest(encoding?: string): string;
  };

  const defaultExport: {
    randomUUID: typeof randomUUID;
    createHash: typeof createHash;
  };
  export default defaultExport;
}

declare module 'node:zlib' {
  export function deflateRawSync(buf: Buffer | Uint8Array): Buffer;

  const defaultExport: {
    deflateRawSync: typeof deflateRawSync;
  };
  export default defaultExport;
}

declare module 'node:test' {
  export interface TestContext {
    test(name: string, fn: (t: TestContext) => void | Promise<void>): Promise<void>;
  }
  function test(name: string, fn: (t: TestContext) => void | Promise<void>): Promise<void>;
  export default test;
}

declare module 'node:assert' {
  export function ok(value: any, message?: string): void;
  export function strictEqual(actual: any, expected: any, message?: string): void;
  export function throws(fn: () => any, error?: any, message?: string): void;

  const defaultExport: {
    ok: typeof ok;
    strictEqual: typeof strictEqual;
    throws: typeof throws;
  };
  export default defaultExport;
}

interface Buffer {
  length: number;
  [n: number]: number;
  toString(encoding?: string): string;
  subarray(start?: number, end?: number): Buffer;
  indexOf(value: any, byteOffset?: number): number;
  copy(target: Buffer, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
  writeUInt16LE(value: number, offset: number): number;
  writeUInt32LE(value: number, offset: number): number;
}

declare var Buffer: {
  alloc(size: number): Buffer;
  from(value: any, encoding?: string): Buffer;
  concat(list: Buffer[]): Buffer;
  isBuffer(obj: any): obj is Buffer;
};

declare var process: {
  cwd(): string;
  exit(code?: number): void;
  env: Record<string, string | undefined>;
};

declare var console: {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
};

declare var URL: {
  new (url: string, base?: string): {
    protocol: string;
    hostname: string;
    pathname: string;
    searchParams: {
      get(name: string): string | null;
      append(name: string, value: string): void;
      toString(): string;
    };
    toString(): string;
  };
};

declare var URLSearchParams: {
  new (init?: any): {
    append(name: string, value: string): void;
    toString(): string;
  };
};

declare function setTimeout(callback: (...args: any[]) => void, ms: number): any;
declare function clearTimeout(timeoutId: any): void;
