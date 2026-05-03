/**
 * EduPattern AI — Cloudflare Worker Proxy
 * 
 * Deploy ke: https://dash.cloudflare.com → Workers & Pages → Create Worker
 * Tambah Secret: Settings → Variables → Add variable (encrypt)
 *   - Name  : ANTHROPIC_API_KEY
 *   - Value : sk-ant-xxxxxxxxxxxxxxxx
 *
 * Setelah deploy, URL worker akan seperti:
 *   https://edupattern-proxy.YOUR-SUBDOMAIN.workers.dev
 *
 * Ganti PROXY_URL di dashboard_mahasiswa.html & dashboard_dosen.html
 * dengan URL worker kamu.
 */

const ALLOWED_ORIGIN = "https://fuad-ai.triathlon.my.id";
// ⚠️ Untuk keamanan lebih, ganti * dengan domain GitHub Pages kamu:
// const ALLOWED_ORIGIN = "https://username.github.io";

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Hanya terima POST
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: corsHeaders(),
      });
    }

    // Pastikan API key sudah di-set di Worker Secrets
    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key belum dikonfigurasi di Worker Secrets" }),
        { status: 500, headers: corsHeaders() }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Request body tidak valid" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    // Whitelist model yang boleh dipakai (cegah abuse)
    const ALLOWED_MODELS = ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"];
    if (!ALLOWED_MODELS.includes(body.model)) {
      return new Response(JSON.stringify({ error: "Model tidak diizinkan" }), {
        status: 403,
        headers: corsHeaders(),
      });
    }

    // Batasi max_tokens agar tidak boros (max 2000)
    body.max_tokens = Math.min(body.max_tokens || 1000, 2000);

    try {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      const data = await upstream.json();
      return new Response(JSON.stringify(data), {
        status: upstream.status,
        headers: corsHeaders(),
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Gagal menghubungi Anthropic API" }), {
        status: 502,
        headers: corsHeaders(),
      });
    }
  },
};

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
