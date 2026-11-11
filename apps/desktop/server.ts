/// <reference path="../../types/globals.d.ts" />
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { OneBoxDatabase } from '../../packages/data/db.ts';
import { FileManager } from '../../packages/storage/fileManager.ts';
import { SearchEngine } from '../../packages/search/engine.ts';
import { ExportManager } from '../../packages/storage/exportManager.ts';
import { RestoreManager } from '../../packages/storage/restoreManager.ts';
import { isValidUrl, normalizeUrl, sanitizeTitle, detectMimeType, isImageMimeType, fetchLinkMetadata } from '../../packages/core/validation.ts';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3845;
const db = new OneBoxDatabase();
const fileManager = new FileManager();
const searchEngine = new SearchEngine(db);
const exportManager = new ExportManager(db);
const restoreManager = new RestoreManager(db);

const PUBLIC_DIR = path.join(process.cwd(), 'apps', 'desktop', 'public');
const ASSETS_DIR = path.join(process.cwd(), 'assets');

// Parser simple pour multipart/form-data ou JSON
function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', err => reject(err));
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseMultipart(body: Buffer, boundary: string): { fields: Record<string, string>; file?: { filename: string; mimeType: string; data: Buffer } } {
  const result: { fields: Record<string, string>; file?: { filename: string; mimeType: string; data: Buffer } } = { fields: {} };
  const boundaryBuf = Buffer.from(`--${boundary}`);
  let start = body.indexOf(boundaryBuf);

  while (start !== -1) {
    const nextStart = body.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (nextStart === -1) break;

    const part = body.subarray(start + boundaryBuf.length, nextStart);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd !== -1) {
      const headerStr = part.subarray(0, headerEnd).toString('utf8');
      const content = part.subarray(headerEnd + 4, part.length - 2); // strip trailing \r\n

      const nameMatch = headerStr.match(/name="([^"]+)"/);
      const filenameMatch = headerStr.match(/filename="([^"]+)"/);
      const mimeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

      if (nameMatch) {
        const fieldName = nameMatch[1];
        if (filenameMatch) {
          result.file = {
            filename: filenameMatch[1],
            mimeType: mimeMatch ? mimeMatch[1] : detectMimeType(filenameMatch[1]),
            data: content
          };
        } else {
          result.fields[fieldName] = content.toString('utf8');
        }
      }
    }
    start = nextStart;
  }
  return result;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method?.toUpperCase();

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  try {
    // --- API ROUTES ---

    // 1. Lister / Rechercher des éléments
    if (pathname === '/api/items' && method === 'GET') {
      const q = parsedUrl.searchParams.get('q') || undefined;
      const type = (parsedUrl.searchParams.get('type') || 'all') as any;
      const tagId = parsedUrl.searchParams.get('tagId') || undefined;
      const isTrash = parsedUrl.searchParams.get('trash') === 'true';
      const unclassifiedOnly = parsedUrl.searchParams.get('unclassified') === 'true';
      const favoritesOnly = parsedUrl.searchParams.get('favorites') === 'true';
      const dateFrom = parsedUrl.searchParams.get('dateFrom') || undefined;
      const dateTo = parsedUrl.searchParams.get('dateTo') || undefined;
      const sortBy = (parsedUrl.searchParams.get('sortBy') || undefined) as any;

      const results = searchEngine.search({
        query: q,
        type,
        tagId,
        isTrash,
        unclassifiedOnly,
        favoritesOnly,
        dateFrom,
        dateTo,
        sortBy
      });
      return sendJson(res, 200, { items: results, count: results.length });
    }

    // 1.b Charger des exemples de découverte (Section 6.1)
    if (pathname === '/api/items/seed' && method === 'POST') {
      const tagTuto = db.createTag('Découverte', '#0066FF');
      const tagProjet = db.createTag('Projet', '#10B981');

      const sample1 = db.createItem({
        type: 'note',
        title: 'Bienvenue dans ONEBOX ! 🚀',
        description: 'Exemple de note Markdown pour découvrir les fonctionnalités',
        source: 'Guide de bienvenue',
        note: {
          format: 'markdown',
          body_text: '### Félicitations !\nVous utilisez désormais **ONEBOX**, votre espace numérique personnel.\n\n- **Recherche instantanée** : Tapez `Ctrl + K` pour chercher.\n- **Respect de la vie privée** : Aucune donnée ne quitte votre ordinateur.\n- **Exportation** : Sauvegardez tout en format ouvert (JSON/Markdown) à tout moment.\n\nVous pouvez modifier cette note ou la placer en corbeille.'
        },
        tagIds: [tagTuto.id]
      });

      const sample2 = db.createItem({
        type: 'link',
        title: 'Documentation officielle ONEBOX',
        description: 'Retrouvez toutes les spécifications du cahier des charges et l\'architecture',
        source: 'Web',
        link: {
          url: 'https://github.com/onebox/onebox',
          normalized_url: 'https://github.com/onebox/onebox',
          fetched_title: 'ONEBOX Documentation'
        },
        tagIds: [tagTuto.id, tagProjet.id]
      });

      return sendJson(res, 201, { success: true, count: 2 });
    }

    // 2. Détail d'un élément
    if (pathname.startsWith('/api/items/') && method === 'GET' && !pathname.includes('/trash') && !pathname.includes('/restore')) {
      const id = pathname.replace('/api/items/', '');
      const item = db.getItemById(id);
      if (!item) return sendJson(res, 404, { error: 'Élément introuvable' });
      return sendJson(res, 200, item);
    }

    // 3. Créer une note
    if (pathname === '/api/items/note' && method === 'POST') {
      const body = await readRequestBody(req);
      const json = JSON.parse(body.toString('utf8') || '{}');
      if (!json.body_text && !json.title) {
        return sendJson(res, 400, { error: 'La note doit contenir au moins un titre ou du texte' });
      }

      const title = sanitizeTitle(json.title || (json.body_text ? json.body_text.slice(0, 30) : 'Nouvelle note'));
      const item = db.createItem({
        type: 'note',
        title,
        description: json.description || null,
        source: 'Saisie utilisateur',
        note: {
          body_text: json.body_text || '',
          format: json.format || 'markdown'
        },
        tagIds: Array.isArray(json.tagIds) ? json.tagIds : []
      });
      return sendJson(res, 201, item);
    }

    // 4. Enregistrer un lien
    if (pathname === '/api/items/link' && method === 'POST') {
      const body = await readRequestBody(req);
      const json = JSON.parse(body.toString('utf8') || '{}');
      if (!json.url || !isValidUrl(json.url)) {
        return sendJson(res, 400, { error: 'Veuillez saisir une URL valide (http:// ou https://)' });
      }

      const norm = normalizeUrl(json.url);
      const host = new URL(norm).hostname;

      let fetchedTitle = json.title || null;
      let fetchedDescription = json.description || null;

      // Récupération automatique du titre et de la description de la page si non fournis
      if (!fetchedTitle || !fetchedDescription) {
        const meta = await fetchLinkMetadata(norm);
        if (!fetchedTitle && meta.title) fetchedTitle = meta.title;
        if (!fetchedDescription && meta.description) fetchedDescription = meta.description;
      }

      const title = sanitizeTitle(fetchedTitle || host, host);

      const item = db.createItem({
        type: 'link',
        title,
        description: fetchedDescription,
        source: 'Web',
        link: {
          url: json.url,
          normalized_url: norm,
          fetched_title: fetchedTitle,
          fetched_description: fetchedDescription,
          preview_image: json.preview_image || null
        },
        tagIds: Array.isArray(json.tagIds) ? json.tagIds : []
      });
      return sendJson(res, 201, item);
    }

    // 5. Importer fichier ou image
    if (pathname === '/api/items/file' && method === 'POST') {
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
      const body = await readRequestBody(req);

      let filename = 'document_sans_nom.bin';
      let fileData: Buffer = Buffer.alloc(0);
      let mimeType = 'application/octet-stream';
      let tagIds: string[] = [];
      let customTitle = '';

      if (boundaryMatch) {
        const parsed = parseMultipart(body, boundaryMatch[1]);
        if (!parsed.file) {
          return sendJson(res, 400, { error: 'Aucun fichier détecté dans la requête' });
        }
        filename = parsed.file.filename;
        fileData = parsed.file.data;
        mimeType = parsed.file.mimeType;
        if (parsed.fields.tagIds) {
          try { tagIds = JSON.parse(parsed.fields.tagIds); } catch {}
        }
        if (parsed.fields.title) {
          customTitle = parsed.fields.title;
        }
      } else {
        return sendJson(res, 400, { error: 'Requête multipart requise' });
      }

      const saved = fileManager.saveBuffer(filename, fileData);
      const isImg = isImageMimeType(mimeType);
      const type = isImg ? 'image' : 'file';
      const title = sanitizeTitle(customTitle || saved.displayName, saved.displayName);

      const item = db.createItem({
        type,
        title,
        description: `${saved.displayName} • ${Math.round(saved.sizeBytes / 1024)} Ko`,
        source: 'Import local',
        file: {
          display_name: saved.displayName,
          storage_path: saved.storagePath,
          mime_type: saved.mimeType,
          size_bytes: saved.sizeBytes,
          checksum: saved.checksum,
          import_mode: 'copy'
        },
        tagIds
      });
      return sendJson(res, 201, item);
    }

    // 6. Mettre à jour un élément
    if (pathname.startsWith('/api/items/') && method === 'PUT') {
      const id = pathname.replace('/api/items/', '');
      const body = await readRequestBody(req);
      const json = JSON.parse(body.toString('utf8') || '{}');

      const updated = db.updateItem(id, {
        title: json.title,
        description: json.description,
        favorite: json.favorite,
        noteBody: json.noteBody,
        tagIds: json.tagIds
      });
      if (!updated) return sendJson(res, 404, { error: 'Élément introuvable' });
      return sendJson(res, 200, updated);
    }

    // 7. Mise en corbeille (Soft Delete)
    if (pathname.match(/^\/api\/items\/[^/]+\/trash$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const success = db.softDeleteItem(id);
      return sendJson(res, 200, { success });
    }

    // 7.b Duplication d'un élément (comme dans Bear / Obsidian / Apple Notes)
    if (pathname.match(/^\/api\/items\/[^/]+\/duplicate$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const duplicated = db.duplicateItem(id);
      if (!duplicated) return sendJson(res, 404, { error: 'Élément introuvable' });
      return sendJson(res, 201, duplicated);
    }

    // 8. Restauration de la corbeille
    if (pathname.match(/^\/api\/items\/[^/]+\/restore$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const success = db.restoreItem(id);
      return sendJson(res, 200, { success });
    }

    // 8.b Vider la corbeille définitivement
    if (pathname === '/api/trash/empty' && method === 'POST') {
      const { count, filePathsToDelete } = db.emptyTrash();
      for (const filePath of filePathsToDelete) {
        fileManager.deletePhysicalFile(filePath);
      }
      return sendJson(res, 200, { success: true, count });
    }

    // 9. Suppression définitive (Hard Delete)
    if (pathname.startsWith('/api/items/') && method === 'DELETE') {
      const id = pathname.replace('/api/items/', '');
      const { success, filePathsToDelete } = db.hardDeleteItem(id);
      if (success) {
        for (const filePath of filePathsToDelete) {
          fileManager.deletePhysicalFile(filePath);
        }
      }
      return sendJson(res, 200, { success });
    }

    // 10. Tags API
    if (pathname === '/api/tags' && method === 'GET') {
      return sendJson(res, 200, { tags: db.getTags() });
    }
    if (pathname === '/api/tags' && method === 'POST') {
      const body = await readRequestBody(req);
      const json = JSON.parse(body.toString('utf8') || '{}');
      if (!json.name || json.name.trim().length === 0) {
        return sendJson(res, 400, { error: 'Le nom du tag est obligatoire' });
      }
      const tag = db.createTag(json.name, json.color);
      return sendJson(res, 201, tag);
    }
    if (pathname.startsWith('/api/tags/') && method === 'PUT') {
      const id = pathname.replace('/api/tags/', '');
      const body = await readRequestBody(req);
      const json = JSON.parse(body.toString('utf8') || '{}');
      const success = db.renameTag(id, json.name);
      return sendJson(res, 200, { success });
    }
    if (pathname.startsWith('/api/tags/') && method === 'DELETE') {
      const id = pathname.replace('/api/tags/', '');
      const success = db.deleteTag(id);
      return sendJson(res, 200, { success });
    }

    // 11. Sauvegarde et Export ZIP complet
    if (pathname === '/api/export/zip' && method === 'GET') {
      const zipBuffer = exportManager.generateFullExportZip();
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="onebox_export_${Date.now()}.zip"`,
        'Content-Length': zipBuffer.length
      });
      res.end(zipBuffer);
      return;
    }

    // 11.b Restauration d'une sauvegarde JSON (Section 5.6)
    if (pathname === '/api/restore' && method === 'POST') {
      const body = await readRequestBody(req);
      const json = JSON.parse(body.toString('utf8') || '{}');
      const restoreResult = restoreManager.restoreFromJson(json);
      return sendJson(res, restoreResult.success ? 200 : 400, restoreResult);
    }

    // 12. Paramètres de l'application
    if (pathname === '/api/settings' && method === 'GET') {
      return sendJson(res, 200, {
        language: db.getSetting('language', 'fr'),
        theme: db.getSetting('theme', 'dark'),
        storagePath: fileManager.getStorageDirectory(),
        version: '1.0.0-MVP'
      });
    }
    if (pathname === '/api/settings' && method === 'POST') {
      const body = await readRequestBody(req);
      const json = JSON.parse(body.toString('utf8') || '{}');
      if (json.language) db.setSetting('language', json.language);
      if (json.theme) db.setSetting('theme', json.theme);
      return sendJson(res, 200, { success: true });
    }

    // 13. Servir les pièces jointes physiques pour prévisualisation
    if (pathname.startsWith('/api/attachments/') && method === 'GET') {
      const itemId = pathname.replace('/api/attachments/', '');
      const item = db.getItemById(itemId);
      if (item && item.file && fs.existsSync(item.file.storage_path)) {
        res.writeHead(200, {
          'Content-Type': item.file.mime_type,
          'Content-Length': item.file.size_bytes
        });
        fs.createReadStream(item.file.storage_path).pipe(res);
        return;
      }
      return sendJson(res, 404, { error: 'Fichier introuvable sur le disque' });
    }

    // 14. Servir le logo officiel (icône cube)
    if (pathname === '/assets/logo.png' || pathname === '/assets/logo.jpg') {
      const ext = pathname.endsWith('.png') ? 'png' : 'jpg';
      let logoPath = path.join(ASSETS_DIR, `logo.${ext}`);
      if (!fs.existsSync(logoPath)) {
        logoPath = path.join(ASSETS_DIR, 'logo.png');
      }
      if (fs.existsSync(logoPath)) {
        const isPng = logoPath.endsWith('.png');
        res.writeHead(200, { 'Content-Type': isPng ? 'image/png' : 'image/jpeg' });
        fs.createReadStream(logoPath).pipe(res);
        return;
      }
    }

    // 15. Servir l'application Frontend SPA
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
      };
      res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'text/plain' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    sendJson(res, 404, { error: 'Ressource introuvable' });
  } catch (err: any) {
    console.error('Erreur serveur:', err);
    sendJson(res, 500, { error: 'Erreur interne du serveur', details: err?.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`========================================`);
  console.log(`  ONEBOX démarré avec succès !`);
  console.log(`  Interface disponible sur : http://localhost:${PORT}`);
  console.log(`  Stockage local : SQLite WAL + FTS5`);
  console.log(`========================================`);
});
