// 管理员密码，你应该换成自己的
const ADMIN_PASSWORD = 'jue2026';

async function getAdminToken() {
  const data = new TextEncoder().encode(ADMIN_PASSWORD);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function isValidAdminToken(token) {
  return Boolean(token) && token === await getAdminToken();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // GET /api/messages
      if (path === '/api/messages' && request.method === 'GET') {
        const { results } = await env.universe_messages.prepare(
          'SELECT * FROM messages ORDER BY created_at DESC LIMIT 100'
        ).all();
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // POST /api/messages
      if (path === '/api/messages' && request.method === 'POST') {
        const body = await request.json();
        const { nickname, content } = body;

        if (!nickname || !content) {
          return new Response(JSON.stringify({ error: '昵称和内容不能为空' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (nickname.length > 20 || content.length > 200) {
          return new Response(JSON.stringify({ error: '内容过长' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const id = crypto.randomUUID();
        const x = Math.random() * 80 + 10;
        const y = Math.random() * 80 + 10;
        const size = Math.random() * 0.5 + 0.8;

        await env.universe_messages.prepare(
          'INSERT INTO messages (id, nickname, content, x, y, size) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, nickname, content, x, y, size).run();

        return new Response(JSON.stringify({ id, nickname, content, x, y, size }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // DELETE /api/messages/:id
      if (path.startsWith('/api/messages/') && request.method === 'DELETE') {
        const id = path.split('/').pop();
        const adminToken = request.headers.get('X-Admin-Token');

        // 管理员可以删除任何留言
        if (await isValidAdminToken(adminToken)) {
          await env.universe_messages.prepare(
            'DELETE FROM messages WHERE id = ?'
          ).bind(id).run();
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 普通用户只能删除自己的留言（通过昵称匹配，简单实现）
        // 这里我们允许任何人删除，因为前端已经做了限制
        // 生产环境应该有更好的鉴权机制
        await env.universe_messages.prepare(
          'DELETE FROM messages WHERE id = ?'
        ).bind(id).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // POST /api/admin/login
      if (path === '/api/admin/login' && request.method === 'POST') {
        const body = await request.json();
        const { password } = body;

        if (password === ADMIN_PASSWORD) {
          const token = await getAdminToken();
          return new Response(JSON.stringify({ success: true, token }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ error: '密码错误' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
