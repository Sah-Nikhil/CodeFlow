import { getOllamaModelName } from '@/lib/loadConfig';

export async function POST(req: Request) {
  try {
    const { code, filename } = await req.json();
    const model = getOllamaModelName();

    const prompt = `
    You are an AI code summarizer. Analyze the following code and summarize:
    - Its purpose in 2–3 lines
    - Key functions/methods and what they do
    - Important imports/exports
    - Any interesting patterns or logic

    Filename: ${filename}
    Code:
    \`\`\`
    ${code}
    \`\`\`
    `;

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(JSON.stringify({ error: text }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      const text = await response.text();
      return new Response(JSON.stringify({ error: 'Invalid JSON from Ollama: ' + text }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ summary: data.response }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
