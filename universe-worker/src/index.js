export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // GET /api/messages - 获取所有留言
      if (path === '/api/messages' && request.method === 'GET') {
        const { results } = await env.universe_messages.prepare(
          'SELECT * FROM messages ORDER BY created_at DESC LIMIT 100'
        ).all();

        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // POST /api/messages - 发布留言
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
        const x = Math.random() * 80 + 10; // 10-90%
        const y = Math.random() * 80 + 10; // 10-90%
        const size = Math.random() * 0.5 + 0.8; // 0.8-1.3

        await env.universe_messages.prepare(
          'INSERT INTO messages (id, nickname, content, x, y, size) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, nickname, content, x, y, size).run();

        return new Response(JSON.stringify({ id, nickname, content, x, y, size }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // DELETE /api/messages/:id - 删除留言（可选，留个后门）
      if (path.startsWith('/api/messages/') && request.method === 'DELETE') {
        const id = path.split('/').pop();
        await env.universe_messages.prepare(
          'DELETE FROM messages WHERE id = ?'
        ).bind(id).run();

        return new Response(JSON.stringify({ success: true }), {
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
