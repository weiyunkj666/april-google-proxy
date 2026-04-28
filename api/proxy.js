const UPSTREAM = 'https://beian.bce.baidu.com';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 可选：尽量靠近上游，按你 Vercel 账号可用区域调整
export const preferredRegion = 'hkg1';

const REQ_REMOVE = [
  'host',
  'content-length',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'cf-connecting-ip',
  'cf-ipcountry',
  'x-forwarded-for',
  'x-real-ip',
];

const RESP_REMOVE = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

function buildCorsHeaders(request) {
  const origin = request.headers.get('origin') || '*';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':
      request.headers.get('access-control-request-headers') || '*',
    'Vary': 'Origin, Access-Control-Request-Headers',
  };
}

async function handle(request) {
  const cors = buildCorsHeaders(request);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: cors,
    });
  }

  const src = new URL(request.url);

  // 本地健康检查，避免监控把上游异常误判成你站点挂了
  if (src.pathname === '/healthz') {
    return new Response('ok', {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        ...cors,
      },
    });
  }

  const dst = new URL(src.pathname + src.search, UPSTREAM);

  const headers = new Headers(request.headers);
  for (const key of REQ_REMOVE) headers.delete(key);

  const method = request.method.toUpperCase();
  const init = {
    method,
    headers,
    redirect: 'manual',
    cache: 'no-store',
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }

  let resp;
  try {
    resp = await fetch(dst.toString(), init);
  } catch (err) {
    return new Response(
      `upstream fetch failed: ${err?.message || String(err)}`,
      {
        status: 502,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          ...cors,
        },
      }
    );
  }

  const outHeaders = new Headers(resp.headers);
  for (const key of RESP_REMOVE) outHeaders.delete(key);

  for (const [k, v] of Object.entries(cors)) {
    outHeaders.set(k, v);
  }

  outHeaders.set('x-proxy-upstream', dst.origin);
  outHeaders.set('x-proxy-status', String(resp.status));

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: outHeaders,
  });
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
