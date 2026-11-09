/**
 * Your Home Hunter — form submit proxy
 * Browser POSTs { flow, data, pageUrl? } here; Worker forwards to Activepieces.
 * Webhook URLs live in Worker secrets only.
 */

const MAX_BODY_BYTES = 28 * 1024 * 1024; // ~28 MB (ID docs as base64)

const FLOW_SECRET_KEYS = {
  wishlist: 'AP_WEBHOOK_WISHLIST',
  introCall: 'AP_WEBHOOK_INTROCALL',
  consult: 'AP_WEBHOOK_CONSULT',
  inspector: 'AP_WEBHOOK_INSPECTOR',
  inspectionBooking: 'AP_WEBHOOK_INSPECTIONBOOKING',
  tenancyApplication: 'AP_WEBHOOK_TENANCYAPPLICATION',
  serviceAgreement: 'AP_WEBHOOK_SERVICEAGREEMENT'
};

/** Optional Activepieces header-auth tokens (header name: Authentication). */
const FLOW_AUTH_SECRET_KEYS = {
  wishlist: 'AP_WEBHOOK_WISHLIST_AUTH',
  introCall: 'AP_WEBHOOK_INTROCALL_AUTH',
  consult: 'AP_WEBHOOK_CONSULT_AUTH',
  inspector: 'AP_WEBHOOK_INSPECTOR_AUTH',
  inspectionBooking: 'AP_WEBHOOK_INSPECTIONBOOKING_AUTH',
  tenancyApplication: 'AP_WEBHOOK_TENANCYAPPLICATION_AUTH',
  serviceAgreement: 'AP_WEBHOOK_SERVICEAGREEMENT_AUTH'
};

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

function isSubmitPath(pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';
  return p === '/' || p === '/api/submit';
}

/** Resolve visitor country from Cloudflare edge geo (same idea as Zoho Forms IP lookup). */
function userCountryFromRequest(request) {
  const code = String(
    request.cf?.country || request.headers.get('CF-IPCountry') || ''
  ).trim().toUpperCase();
  if (!code || code === 'XX' || code === 'T1') return '';
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
    return name || code;
  } catch {
    return code;
  }
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

    if (request.method !== 'POST' || !isSubmitPath(url.pathname)) {
      return jsonResponse({ ok: false }, 404, origin, env);
    }

    const allowed = parseAllowedOrigins(env);
    if (origin && !allowed.includes(origin)) {
      return jsonResponse({ ok: false }, 403, origin, env);
    }

    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false }, 413, origin, env);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false }, 400, origin, env);
    }

    const flow = String(body?.flow || '').trim();
    const secretKey = FLOW_SECRET_KEYS[flow];
    if (!secretKey) {
      return jsonResponse({ ok: false }, 400, origin, env);
    }

    const webhookUrl = String(env[secretKey] || '').trim();
    if (!webhookUrl) {
      // Flow exists but webhook secret not set — client must not show success.
      return jsonResponse({ ok: false, skipped: true, error: 'webhook_not_configured' }, 503, origin, env);
    }

    // Activepieces webhook mappings expect form fields on the JSON body root
    // (trigger.body.firstName), not nested under .data.
    const formData =
      body.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? body.data
        : {};
    const payload = {
      ...formData,
      // Always set from CF IP geo (do not trust client spoof of userCountry)
      userCountry: userCountryFromRequest(request),
      flow,
      source: 'yourhomehunter.com.au',
      pageUrl: typeof body.pageUrl === 'string' ? body.pageUrl : '',
      submittedAt: new Date().toISOString()
    };

    const upstreamHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
    const authKey = FLOW_AUTH_SECRET_KEYS[flow];
    const authToken = authKey ? String(env[authKey] || '').trim() : '';
    if (authToken) {
      upstreamHeaders.Authentication = authToken;
    }

    let upstream;
    try {
      upstream = await fetch(webhookUrl, {
        method: 'POST',
        headers: upstreamHeaders,
        body: JSON.stringify(payload)
      });
    } catch {
      return jsonResponse({ ok: false }, 502, origin, env);
    }

    if (!upstream.ok) {
      return jsonResponse({ ok: false }, 502, origin, env);
    }

    return jsonResponse({ ok: true }, 200, origin, env);
  }
};
