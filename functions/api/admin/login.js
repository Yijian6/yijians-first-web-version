import { corsHeaders, getAdminToken, isAdminPassword, json } from '../../_universe.js';

export function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const adminPassword = context.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return json({ error: 'ADMIN_PASSWORD is not configured' }, { status: 503 });
    }

    if (await isAdminPassword(body.password, adminPassword)) {
      return json({ success: true, token: await getAdminToken(adminPassword) });
    }

    return json({ error: '密码错误' }, { status: 401 });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}
