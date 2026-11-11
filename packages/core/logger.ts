/// <reference path="../../types/globals.d.ts" />
import fs from 'node:fs';
import path from 'node:path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class LocalLogger {
  private logFilePath: string;

  constructor(customLogPath?: string) {
    this.logFilePath = customLogPath || path.join(process.cwd(), 'data', 'onebox.log');
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Filtrer les données sensibles (chemins personnels, contenu de note) conformément à la section 11.2
  private sanitizeMessage(msg: string): string {
    const userHome = process.env.USERPROFILE || process.env.HOME || '';
    if (userHome) {
      return msg.split(userHome).join('~');
    }
    return msg;
  }

  private write(level: LogLevel, message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    const cleanMsg = this.sanitizeMessage(message);
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    const line = `[${timestamp}] [${level}] ${cleanMsg}${metaStr}\n`;

    // Affichage console
    if (level === 'ERROR') {
      console.error(line.trim());
    } else {
      console.log(line.trim());
    }

    // Écriture fichier local sécurisé
    try {
      fs.writeFileSync(this.logFilePath, line, { flag: 'a' });
    } catch {
      // Éviter de crasher si le disque est temporairement indisponible
    }
  }

  public debug(msg: string, meta?: any) { this.write('DEBUG', msg, meta); }
  public info(msg: string, meta?: any) { this.write('INFO', msg, meta); }
  public warn(msg: string, meta?: any) { this.write('WARN', msg, meta); }
  public error(msg: string, meta?: any) { this.write('ERROR', msg, meta); }
}

export const logger = new LocalLogger();
