/**
 * Your Home Hunter — secure Google Drive document upload
 * Browser POSTs multipart/form-data here; Worker writes into a locked Drive folder.
 * Service-account credentials stay in Worker secrets only.
 */

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif'
]);

/** @type {{ token: string, expiresAt: number } | null} */
let cachedToken = null;

function parseAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin, env) {
  const allowed = parseAllowedOrigins(env);
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function jsonResponse(body, status, origin, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin, env)
    }
  });
}

function isUploadPath(pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';
  return p === '/' || p === '/api/drive/upload';
}

function base64UrlEncode(bytes) {
  let binary = '';
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlEncodeJson(obj) {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

function pemToArrayBuffer(pem) {
  const b64 = String(pem)
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function importPrivateKey(pem) {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function parseServiceAccount(env) {
  const raw = String(env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    if (!sa.client_email || !sa.private_key) return null;
    return sa;
  } catch {
    return null;
  }
}

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const sa = parseServiceAccount(env);
  if (!sa) {
    throw new Error('service_account_not_configured');
  }

  const iat = now;
  const exp = now + 3600;
  const impersonate = String(env.GDRIVE_IMPERSONATE_USER || '').trim();
  const claims = {
    iss: sa.client_email,
    scope: DRIVE_SCOPE,
    aud: TOKEN_URL,
    iat,
    exp
  };
  if (impersonate) claims.sub = impersonate;

  const header = base64UrlEncodeJson({ alg: 'RS256', typ: 'JWT' });
  const payload = base64UrlEncodeJson(claims);
  const unsigned = `${header}.${payload}`;
  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );
  const assertion = `${unsigned}.${base64UrlEncode(signature)}`;

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => '');
    console.error(JSON.stringify({
      event: 'google_token_error',
      status: tokenRes.status,
      detail: detail.slice(0, 500)
    }));
    throw new Error('google_token_failed');
  }

  const tokenJson = await tokenRes.json();
  const accessToken = String(tokenJson.access_token || '');
  if (!accessToken) throw new Error('google_token_missing');

  cachedToken = {
    token: accessToken,
    expiresAt: now + Number(tokenJson.expires_in || 3600)
  };
  return accessToken;
}

function sanitizeFolderLabel(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'Applicant';
}

function sanitizeFileName(name) {
  const base = String(name || 'file').trim() || 'file';
  return base
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

function guessMime(file) {
  const type = String(file.type || '').toLowerCase().trim();
  if (type && ALLOWED_MIME.has(type)) return type === 'image/jpg' ? 'image/jpeg' : type;
  const name = String(file.name || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.heic')) return 'image/heic';
  if (name.endsWith('.heif')) return 'image/heif';
  if (name.endsWith('.gif')) return 'image/gif';
  return '';
}

async function createFolder(accessToken, parentId, name) {
  const res = await fetch(`${DRIVE_FILES}?supportsAllDrives=true&fields=id,name,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(JSON.stringify({
      event: 'drive_folder_error',
      status: res.status,
      detail: detail.slice(0, 500)
    }));
    throw new Error('drive_folder_failed');
  }
  return res.json();
}

async function uploadFile(accessToken, parentId, fileName, mimeType, bytes) {
  const boundary = `yhh_${crypto.randomUUID().replace(/-/g, '')}`;
  const metadata = JSON.stringify({
    name: fileName,
    parents: [parentId]
  });

  const preamble = new TextEncoder().encode(
    `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
  );
  const closing = new TextEncoder().encode(`\r\n--${boundary}--`);
  const body = new Blob([preamble, bytes, closing]);

  const res = await fetch(
    `${DRIVE_UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(JSON.stringify({
      event: 'drive_upload_error',
      status: res.status,
      fileName,
      detail: detail.slice(0, 500)
    }));
    throw new Error('drive_upload_failed');
  }
  return res.json();
}

/**
 * Collect uploadable files from multipart form.
 * Field name = docKey (e.g. licence, payslips). Multiple files allowed per key.
 */
function collectUploads(form) {
  const uploads = [];
  let totalBytes = 0;

  for (const [key, value] of form.entries()) {
    if (key === 'folderLabel' || key === 'email' || key === 'pageUrl') continue;
    if (!(value instanceof File)) continue;
    if (!value.size) continue;

    const docKey = sanitizeFileName(key).replace(/\.+/g, '') || 'document';
    const mimeType = guessMime(value);
    if (!mimeType) {
      throw new Error(`unsupported_type:${value.name}`);
    }
    if (value.size > MAX_FILE_BYTES) {
      throw new Error(`file_too_large:${value.name}`);
    }
    totalBytes += value.size;
    if (uploads.length >= MAX_FILES) {
      throw new Error('too_many_files');
    }
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error('payload_too_large');
    }

    uploads.push({
      docKey,
      file: value,
      mimeType,
      driveFileName: `${docKey}__${sanitizeFileName(value.name)}`
    });
  }

  return uploads;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      const allowed = parseAllowedOrigins(env);
      if (origin && !allowed.includes(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    if (request.method !== 'POST' || !isUploadPath(url.pathname)) {
      return jsonResponse({ ok: false, error: 'not_found' }, 404, origin, env);
    }

    const allowed = parseAllowedOrigins(env);
    if (origin && !allowed.includes(origin)) {
      return jsonResponse({ ok: false, error: 'forbidden' }, 403, origin, env);
    }

    const parentId = String(env.GDRIVE_PARENT_FOLDER_ID || '').trim();
    if (!parentId) {
      return jsonResponse({ ok: false, error: 'drive_not_configured' }, 503, origin, env);
    }
    if (!parseServiceAccount(env)) {
      return jsonResponse({ ok: false, error: 'service_account_not_configured' }, 503, origin, env);
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_multipart' }, 400, origin, env);
    }

    const folderLabel = sanitizeFolderLabel(form.get('folderLabel'));
    let uploads;
    try {
      uploads = collectUploads(form);
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (msg.startsWith('unsupported_type:')) {
        return jsonResponse({ ok: false, error: 'unsupported_type', file: msg.slice(17) }, 400, origin, env);
      }
      if (msg.startsWith('file_too_large:')) {
        return jsonResponse({ ok: false, error: 'file_too_large', file: msg.slice(14) }, 413, origin, env);
      }
      if (msg === 'too_many_files') {
        return jsonResponse({ ok: false, error: 'too_many_files' }, 400, origin, env);
      }
      if (msg === 'payload_too_large') {
        return jsonResponse({ ok: false, error: 'payload_too_large' }, 413, origin, env);
      }
      return jsonResponse({ ok: false, error: 'bad_request' }, 400, origin, env);
    }

    if (!uploads.length) {
      return jsonResponse({ ok: false, error: 'no_files' }, 400, origin, env);
    }

    let accessToken;
    try {
      accessToken = await getAccessToken(env);
    } catch (err) {
      const code = String(err && err.message ? err.message : 'auth_failed');
      return jsonResponse({ ok: false, error: code }, 502, origin, env);
    }

    let folder;
    try {
      folder = await createFolder(accessToken, parentId, folderLabel);
    } catch {
      return jsonResponse({ ok: false, error: 'drive_folder_failed' }, 502, origin, env);
    }

    const uploaded = [];
    for (const item of uploads) {
      try {
        const bytes = new Uint8Array(await item.file.arrayBuffer());
        const created = await uploadFile(
          accessToken,
          folder.id,
          item.driveFileName,
          item.mimeType,
          bytes
        );
        uploaded.push({
          id: created.id,
          name: created.name,
          docKey: item.docKey,
          mimeType: created.mimeType || item.mimeType,
          size: Number(created.size || item.file.size || 0),
          webViewLink: created.webViewLink || ''
        });
      } catch {
        return jsonResponse({
          ok: false,
          error: 'drive_upload_failed',
          folderId: folder.id,
          folderUrl: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`,
          uploaded
        }, 502, origin, env);
      }
    }

    console.log(JSON.stringify({
      event: 'drive_upload_ok',
      folderId: folder.id,
      folderLabel,
      fileCount: uploaded.length
    }));

    return jsonResponse({
      ok: true,
      folderId: folder.id,
      folderName: folder.name || folderLabel,
      folderUrl: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`,
      files: uploaded
    }, 200, origin, env);
  }
};
