import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'edge', // 使用 Edge Runtime
};

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, ''); // 去掉 /api 前缀
    const target = `https://shijian.lyxmb.com/api${path}${url.search}`;

    // 转发请求
    const response = await fetch(target, {
      method: req.method,
      headers: req.headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
    });

    const resHeaders = new Headers(response.headers);
    // 去掉 Vercel 不允许的一些 headers
    resHeaders.delete('content-encoding');
    resHeaders.delete('content-length');

    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || '未知错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
