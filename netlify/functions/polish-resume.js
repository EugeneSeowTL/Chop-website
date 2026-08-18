// netlify/functions/polish-resume.js
// Receives resume text from the browser, calls Gemini using the secret
// GEMINI_API_KEY environment variable, and returns the rewritten version.
// The key never touches the browser — it only ever lives on Netlify's servers.

exports.handler = async function (event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let resumeText;
  try {
    const body = JSON.parse(event.body || '{}');
    resumeText = (body.resumeText || '').trim();
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request body' }),
    };
  }

  if (!resumeText) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No resume text provided' }),
    };
  }

  // Basic length guard so a single request can't run away with the free tier quota
  if (resumeText.length > 12000) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Resume text is too long (max ~12,000 characters).' }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is not configured (missing API key).' }),
    };
  }

  const prompt = `You are an expert resume editor. Rewrite the resume text below so it reads naturally and professionally: use strong action verbs, tighten wordy phrasing, remove filler, and keep it sounding like a real person — not a generic template. 

Rules:
- Keep every real fact, number, job title, company name, and date exactly as given. Do not invent achievements, metrics, or experience.
- Keep the same overall structure (same sections, same order, same bullet-style formatting) unless it's clearly broken.
- Do not add a header, sign-off, or commentary — return only the rewritten resume text itself.

Resume text to rewrite:
"""
${resumeText}
"""`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Gemini API error:', resp.status, errText);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'The AI service failed to respond. Please try again.' }),
      };
    }

    const data = await resp.json();
    const polished =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';

    if (!polished.trim()) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'The AI returned an empty response. Please try again.' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polished: polished.trim() }),
    };
  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unexpected server error. Please try again.' }),
    };
  }
};
