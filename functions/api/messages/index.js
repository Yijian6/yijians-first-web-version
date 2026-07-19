import { corsHeaders, json } from '../../_universe.js';

export function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  try {
    const { results } = await context.env.universe_messages.prepare(
      'SELECT * FROM messages ORDER BY created_at DESC LIMIT 100'
    ).all();

    return json(results);
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const nickname = (body.nickname || '').trim();
    const content = (body.content || '').trim();

    if (!nickname || !content) {
      return json({ error: '昵称和内容不能为空' }, { status: 400 });
    }

    if (nickname.length > 20 || content.length > 200) {
      return json({ error: '内容过长' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const x = Math.random() * 80 + 10;
    const y = Math.random() * 80 + 10;
    const size = Math.random() * 0.5 + 0.8;

    await context.env.universe_messages.prepare(
      'INSERT INTO messages (id, nickname, content, x, y, size) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, nickname, content, x, y, size).run();

    return json({ id, nickname, content, x, y, size }, { status: 201 });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}
