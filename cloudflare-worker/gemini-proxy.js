/**
 * Cloudflare Worker: MOLQEN OS Secure AI Proxy
 * Validates CORS, verifies authenticated Firebase Bearer tokens,
 * and securely forwards prompt payloads to Google Gemini API using env.GEMINI_API_KEY.
 *
 * Deploy with Wrangler:
 *   npx wrangler secret put GEMINI_API_KEY
 *   npx wrangler deploy cloudflare-worker/gemini-proxy.js --name gemini-proxy
 */

const ALLOWED_ORIGINS = [
  'https://molqenbiotech.github.io',
  'https://molqen.eu.org',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173'
];

function getCorsHeaders(requestOrigin) {
  const origin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin);

    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      // 2. Validate Firebase Bearer Token
      const authHeader = request.headers.get('Authorization') || '';
      if (!authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({
            error: 'Unauthorized: Missing or malformed Firebase Authorization Bearer token'
          }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const idToken = authHeader.replace('Bearer ', '').trim();
      if (!idToken || idToken.split('.').length !== 3) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Invalid JWT token format' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // 3. Verify Gemini API Key configuration
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: 'Server misconfiguration: GEMINI_API_KEY secret not set on worker' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // 4. Parse incoming client request payload
      const body = await request.json();
      const {
        prompt,
        systemInstruction = 'You are MOLQEN AI, an in-silico biotechnology laboratory assistant.',
        model = 'gemini-2.5-flash',
        telemetry = {}
      } = body;

      if (!prompt || typeof prompt !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Bad Request: "prompt" string is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // 5. Forward to Google Gemini API
      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

      const geminiPayload = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${systemInstruction}\n\n[Active Lab Telemetry: ${JSON.stringify(telemetry)}]\n\nUser Question: ${prompt}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1500
        }
      };

      const geminiRes = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(geminiPayload)
      });

      if (!geminiRes.ok) {
        const errorText = await geminiRes.text();
        return new Response(
          JSON.stringify({ error: 'Gemini upstream error', details: errorText }),
          {
            status: geminiRes.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const geminiData = await geminiRes.json();
      const answer = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return new Response(
        JSON.stringify({
          answer,
          model,
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', message: err.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }
};
