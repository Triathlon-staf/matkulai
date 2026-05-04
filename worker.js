/**
 * EduPattern AI — Cloudflare Worker
 * Proxy ke Groq API agar API key aman di server-side
 *
 * Deploy:
 *   1. Buka https://dash.cloudflare.com → Workers & Pages → Create
 *   2. Paste kode ini
 *   3. Di tab "Settings > Variables", tambahkan Secret:
 *      Nama: GROQ_API_KEY  |  Value: gsk_xxxxxxxxxxxx
 *   4. Deploy → salin URL worker (misal: https://edupattern-chat.xxx.workers.dev)
 *   5. Tempel URL itu ke WORKER_URL di chatbot.html
 */

const ALLOWED_ORIGIN = "*"; // Ganti dengan domain kamu, misal: "https://edupattern.my.id"
const GROQ_API_URL   = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL  = "llama-3.3-70b-versatile"; // atau "mixtral-8x7b-32768"

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }

    // Hanya terima POST ke /chat
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/chat") {
      return corsResponse(
        JSON.stringify({ error: "Not found" }),
        404,
        "application/json"
      );
    }

    // Parse body dari frontend
    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse(
        JSON.stringify({ error: "Invalid JSON" }),
        400,
        "application/json"
      );
    }

    const { messages, model, system } = body;

    if (!messages || !Array.isArray(messages)) {
      return corsResponse(
        JSON.stringify({ error: "Field 'messages' harus berupa array" }),
        400,
        "application/json"
      );
    }

    // Susun payload untuk Groq
    const groqMessages = [];

    // System prompt default (bisa di-override dari frontend)
    const systemPrompt = system ||
      `Kamu adalah EduPattern AI Assistant, asisten akademik cerdas untuk platform EduPattern. 
Kamu membantu mahasiswa dan dosen dengan pertanyaan seputar perkuliahan, jadwal, nilai, tugas, dan hal akademik lainnya.
Jawab dalam Bahasa Indonesia yang ramah, jelas, dan informatif. 
Jika pertanyaan di luar konteks akademik, tetap bantu sebaik mungkin.
Gunakan bullet point atau numbering jika membantu kejelasan jawaban.`;

    groqMessages.push({ role: "system", content: systemPrompt });
    groqMessages.push(...messages);

    // Kirim ke Groq
    let groqRes;
    try {
      groqRes = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model:       model || DEFAULT_MODEL,
          messages:    groqMessages,
          max_tokens:  1024,
          temperature: 0.7,
          stream:      false,
        }),
      });
    } catch (err) {
      return corsResponse(
        JSON.stringify({ error: "Gagal menghubungi Groq API", detail: err.message }),
        502,
        "application/json"
      );
    }

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return corsResponse(
        JSON.stringify({ error: "Groq API error", detail: errText }),
        groqRes.status,
        "application/json"
      );
    }

    const data = await groqRes.json();

    // Kembalikan hanya teks balasan
    const reply = data.choices?.[0]?.message?.content ?? "";
    return corsResponse(
      JSON.stringify({
        reply,
        model:  data.model,
        usage:  data.usage,
      }),
      200,
      "application/json"
    );
  },
};

/* ── Helper CORS ── */
function corsResponse(body, status = 200, contentType = "text/plain") {
  const headers = {
    "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": contentType,
  };
  return new Response(body, { status, headers });
}
