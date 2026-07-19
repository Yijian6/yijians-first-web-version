export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
};

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export async function getAdminToken(adminPassword) {
  if (!adminPassword) throw new Error('ADMIN_PASSWORD is not configured');
  const data = new TextEncoder().encode(adminPassword);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function isAdminPassword(password, adminPassword) {
  return Boolean(adminPassword) && password === adminPassword;
}

export async function isValidAdminToken(token, adminPassword) {
  return Boolean(token) && token === await getAdminToken(adminPassword);
}
