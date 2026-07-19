import { corsHeaders, json } from '../../_universe.js';

export function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestDelete(context) {
  try {
    await context.env.universe_messages.prepare(
      'DELETE FROM messages WHERE id = ?'
    ).bind(context.params.id).run();

    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}
