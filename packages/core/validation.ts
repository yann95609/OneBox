export function isValidUrl(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeUrl(input: string): string {
  try {
    const url = new URL(input.trim());
    // Lowercase host, preserve path and query
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return input.trim();
  }
}

export function sanitizeTitle(input?: string | null, fallback = 'Sans titre'): string {
  if (!input || input.trim().length === 0) {
    return fallback;
  }
  const trimmed = input.trim();
  return trimmed.length > 255 ? trimmed.slice(0, 252) + '...' : trimmed;
}

export function getUtcTimestamp(): string {
  return new Date().toISOString();
}

export function detectMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'pdf':
      return 'application/pdf';
    case 'txt':
      return 'text/plain';
    case 'md':
      return 'text/markdown';
    case 'json':
      return 'application/json';
    case 'csv':
      return 'text/csv';
    case 'zip':
      return 'application/zip';
    case 'doc':
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'application/octet-stream';
  }
}

export function isImageMimeType(mime: string): boolean {
  return mime.startsWith('image/');
}

export async function fetchLinkMetadata(url: string): Promise<{ title?: string; description?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OneBox/1.0 (Desktop Local Knowledge Base)' }
    });
    clearTimeout(timer);
    if (!res.ok) return {};

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);

    return {
      title: titleMatch ? titleMatch[1].trim() : undefined,
      description: descMatch ? descMatch[1].trim() : undefined
    };
  } catch {
    return {};
  }
}


