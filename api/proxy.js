const UPSTREAM = 'https://beian.bce.baidu.com';

export const runtime = 'edge'; // 想用 Node.js 可删掉这行
export const dynamic = 'force-dynamic';

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':
      request.headers.get('access-control-request-headers') || '*',
  };
}

async function handle(request) {
  // 处理预检
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }

  const src = new URL(request.url);
  const dst = new URL(UPSTREAM);

  // 保留原始路径和查询参数
  dst.pathname = src.pathname;
  dst.search = src.search;

  // 复制原始请求头
  const headers = new Headers(request.headers);

  // 这些让 fetch 自己处理
  headers.delete('host');
  headers.delete('content-length');

  // 删掉一些没必要透传的头
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ipcountry');
  headers.delete('x-forwarded-for');
  headers.delete('x-real-ip');

  const method = request.method.toUpperCase();

  const init = {
    method,
    headers,
    redirect: 'manual',
    cache: 'no-store',
  };

  // GET/HEAD 不能带 body，其它方法保留原 body
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = request.body;
  }

  const resp = await fetch(dst.toString(), init);

  const outHeaders = new Headers(resp.headers);
  outHeaders.set('Access-Control-Allow-Origin', '*');
  outHeaders.set('Access-Control-Allow-Credentials', 'true');

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
