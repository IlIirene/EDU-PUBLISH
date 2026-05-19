/// <reference types="@cloudflare/workers-types" />

interface Env {
  AI_SUMMARY_API_KEY?: string;
  AI_SUMMARY_API_URL?: string;
  AI_SUMMARY_MODEL?: string;
}

interface AiSummaryRequest {
  date: string;       // YYYY-MM-DD
  schoolSlug: string;
}

interface AiSummaryResponse {
  ok: boolean;
  summary?: string;
  error?: string;
  source: 'llm' | 'conclusion' | 'empty';
}

// Validate date format YYYY-MM-DD
function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: AiSummaryRequest;
  try {
    body = (await request.json()) as AiSummaryRequest;
  } catch {
    return Response.json(
      { ok: false, error: 'Invalid request body' } satisfies AiSummaryResponse,
      { status: 400 }
    );
  }

  const { date, schoolSlug } = body;

  if (!date || !isValidDateKey(date)) {
    return Response.json(
      { ok: false, error: 'Invalid date format, expected YYYY-MM-DD' } satisfies AiSummaryResponse,
      { status: 400 }
    );
  }

  if (!schoolSlug || typeof schoolSlug !== 'string') {
    return Response.json(
      { ok: false, error: 'schoolSlug is required' } satisfies AiSummaryResponse,
      { status: 400 }
    );
  }

  // Try to fetch conclusion data
  let conclusionMarkdown = '';
  try {
    const conclusionRes = await fetch(
      `${new URL(request.url).origin}/generated/content-data.json`,
      { cf: { cacheTtl: 300 } }
    );
    if (conclusionRes.ok) {
      const data = (await conclusionRes.json()) as {
        conclusionBySchool?: Record<string, {
          byDate?: Record<string, { markdown?: string }>;
        }>;
      };
      const schoolData = data.conclusionBySchool?.[schoolSlug];
      const dateData = schoolData?.byDate?.[date];
      conclusionMarkdown = dateData?.markdown || '';
    }
  } catch {
    // Silently fail, will try LLM next
  }

  // If we have an API key, try LLM enhancement
  if (env.AI_SUMMARY_API_KEY && env.AI_SUMMARY_API_URL) {
    try {
      const prompt = conclusionMarkdown
        ? `以下是${date}的通知摘要，请将其提炼为一篇精炼的每日总结（200-300字），突出最重要的信息和截止日期：\n\n${conclusionMarkdown}`
        : `请生成${date}的每日总结。目前没有找到该日期的通知记录。`;

      const llmRes = await fetch(env.AI_SUMMARY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.AI_SUMMARY_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.AI_SUMMARY_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: '你是一个学校通知总结助手。请用中文回复，简洁专业。' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 600,
          temperature: 0.5,
        }),
      });

      if (llmRes.ok) {
        const llmData = (await llmRes.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const summary = llmData.choices?.[0]?.message?.content || '';
        if (summary) {
          return Response.json({
            ok: true,
            summary,
            source: 'llm',
          } satisfies AiSummaryResponse);
        }
      }
    } catch {
      // LLM failed, fall back to conclusion
    }
  }

  // Fallback: return raw conclusion data
  if (conclusionMarkdown) {
    return Response.json({
      ok: true,
      summary: conclusionMarkdown,
      source: 'conclusion',
    } satisfies AiSummaryResponse);
  }

  return Response.json({
    ok: true,
    summary: '',
    source: 'empty',
  } satisfies AiSummaryResponse);
};
