const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── FIX 1: HARD BLACKLIST ────────────────────────────────────────────────────
// These domains are NEVER useful as direct tool results. Block them completely.
const BLACKLISTED_DOMAINS = [
  'facebook.com', 'reddit.com', 'twitter.com', 'x.com',
  'instagram.com', 'tiktok.com', 'pinterest.com', 'quora.com',
  'linkedin.com', 'youtube.com',
];

function isBlacklisted(url = '') {
  return BLACKLISTED_DOMAINS.some(d => url.toLowerCase().includes(d));
}

// ─── FIX 2: MUCH STRONGER CLASSIFIER ─────────────────────────────────────────
// Old classifier was too loose — blogs were slipping through as 'neutral'.
// Now: if it's not clearly a TOOL homepage/product page, it's a blog.
function classifyUrl(url = '', title = '', snippet = '') {
  const text = `${url} ${title} ${snippet}`.toLowerCase();
  const domain = url.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];

  // ── KNOWN TOOL DOMAINS (direct match) ──
  const knownToolDomains = [
    'canva.com', 'runway.ml', 'midjourney.com', 'openai.com', 'stability.ai',
    'adobe.com', 'figma.com', 'notion.so', 'airtable.com', 'zapier.com',
    'huggingface.co', 'replicate.com', 'leonardo.ai', 'ideogram.ai',
    'firefly.adobe.com', 'bing.com', 'copilot.microsoft.com',
    'nightcafe.studio', 'craiyon.com', 'dreamstudio.ai', 'perchance.org',
    'picsart.com', 'fotor.com', 'pixlr.com', 'remove.bg', 'cleanup.pictures',
  ];
  if (knownToolDomains.some(d => domain.includes(d))) return 'tool';

  // ── STRONG TOOL SIGNALS (product pages) ──
  const toolUrlSignals = ['/pricing', '/features', '/product', '/app', '/studio', '/dashboard', '/playground', '/generate'];
  const toolTextSignals = ['try for free', 'sign up free', 'get started free', 'free plan', 'no credit card', 'create an account', 'start for free', 'free tier', 'free credits'];

  const hasToolUrl = toolUrlSignals.some(p => url.toLowerCase().includes(p));
  const hasToolText = toolTextSignals.some(p => text.includes(p));

  if (hasToolUrl || hasToolText) return 'tool';

  // ── STRONG BLOG SIGNALS ──
  const blogDomains = [
    'medium.com', 'substack.com', 'wordpress.com', 'blogspot.com',
    'techcrunch.com', 'theverge.com', 'wired.com', 'forbes.com',
    'towardsdatascience.com', 'analyticsvidhya.com', 'hackernoon.com',
    'makeuseof.com', 'pcmag.com', 'lifewire.com', 'zdnet.com', 'cnet.com',
    'mashable.com', 'businessinsider.com', 'geekflare.com', 'zapier.com/blog',
  ];
  const blogUrlSignals = ['/blog/', '/article/', '/post/', '/news/', '/guide/', '/best-', '/top-', '/review', '/vs-'];
  const blogTitleSignals = ['top 10', 'top 5', '10 best', '15 best', 'best free', 'roundup', 'list of', 'alternatives to', 'vs ', ' vs'];

  const isBlogDomain = blogDomains.some(d => text.includes(d));
  const isBlogUrl = blogUrlSignals.some(p => url.toLowerCase().includes(p));
  const isBlogTitle = blogTitleSignals.some(p => title.toLowerCase().includes(p));

  if (isBlogDomain || (isBlogUrl && !hasToolUrl) || isBlogTitle) return 'blog';

  // Default: neutral (could be docs, wikipedia, academic, etc.)
  return 'neutral';
}

// ─── FIX 3: SMARTER QUERY ENHANCEMENT ────────────────────────────────────────
// Add "site:*.io OR site:*.com -reddit -facebook" style hints via text
function enhanceQuery(query, personaId) {
  const base = {
    student:      `${query} free tool`,
    researcher:   `${query} research academic tool`,
    developer:    `${query} api github documentation`,
    professional: `${query} enterprise platform`,
    entrepreneur: `${query} startup tool pricing`,
    creative:     `${query} free design tool`,
    educator:     `${query} free for teachers tool`,
    jobseeker:    `${query} career tool free`,
  };
  // Append exclusions to push Tavily away from social/blog results
  const enhanced = (base[personaId] || query) + ' -reddit -facebook -quora -medium';
  return enhanced;
}

app.post('/api/search', async (req, res) => {
  const { query, persona } = req.body;
  if (!query || !persona) return res.status(400).json({ error: 'query and persona are required' });

  const TAVILY_KEY = process.env.TAVILY_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  if (!TAVILY_KEY || !GEMINI_KEY) {
    return res.status(500).json({ error: 'API keys not configured. Check your .env file.' });
  }

  try {
    const enhancedQuery = enhanceQuery(query, persona.id);
    console.log(`\n[Search] Query: "${query}" → Enhanced: "${enhancedQuery}" | Persona: ${persona.id}`);

    // STEP 1 — Fetch from Tavily (ask for more so we have room to filter)
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TAVILY_KEY}` },
      body: JSON.stringify({
        query: enhancedQuery,
        max_results: 25,
        search_depth: 'basic',
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!tavilyRes.ok) {
      const err = await tavilyRes.text();
      throw new Error(`Tavily error ${tavilyRes.status}: ${err}`);
    }

    const tavilyData = await tavilyRes.json();
    const rawResults = tavilyData.results || [];

    if (rawResults.length === 0) {
      return res.json({ results: [], query, persona: persona.id, totalFetched: 0 });
    }

    // STEP 2 — FILTER OUT blacklisted domains BEFORE sending to Gemini
    const filtered = rawResults.filter(r => !isBlacklisted(r.url));
    console.log(`[Filter] Removed ${rawResults.length - filtered.length} blacklisted results. Remaining: ${filtered.length}`);

    if (filtered.length === 0) {
      return res.json({ results: [], query, persona: persona.id, totalFetched: rawResults.length });
    }

    // STEP 3 — Classify remaining results
    const classified = filtered.map((r, i) => ({
      index: i,
      type: classifyUrl(r.url, r.title, r.content || ''),
      title: r.title,
      url: r.url,
      snippet: r.content?.slice(0, 350) || '',
    }));

    const toolCount = classified.filter(r => r.type === 'tool').length;
    const blogCount = classified.filter(r => r.type === 'blog').length;
    const neutralCount = classified.filter(r => r.type === 'neutral').length;
    console.log(`[Classify] Tools: ${toolCount} | Blogs: ${blogCount} | Neutral: ${neutralCount}`);

    const isToolQuery = /tool|app|software|platform|generator|maker|editor|builder|website/i.test(query);

    // STEP 4 — Gemini re-ranking prompt
    const rankingPrompt = `You are a search result re-ranking engine. Rank the top 10 results for a "${persona.label}" who searched: "${query}".

PERSONA NEEDS: ${persona.context}

STRICT SCORING RULES:
${isToolQuery
  ? `- This is a TOOL query. Actual product/tool websites MUST score 0.80–1.0.
- Blog articles (type="blog") MUST score 0.05–0.35 and rank at the BOTTOM or be excluded.
- If a blog is about the topic but is not a tool itself, it is LOW priority.`
  : `- Score by how directly useful the result is for the persona's actual needs.`}
- type="tool" with free tier mentioned: score 0.88–1.0 (especially for Student persona).
- type="tool" without free tier: score 0.75–0.90.
- type="neutral" (docs, academic, wiki): score 0.45–0.70.
- type="blog": score 0.05–0.35 maximum. Always rank below tools and neutral.
- SPREAD scores — do not cluster everything at the same value. Top result must be 0.85+, bottom must be under 0.40.
- personaSnippet: one sentence explaining WHY this helps this specific persona. Mention "free" if the tool has a free tier.

RESULTS TO RANK:
${JSON.stringify(classified, null, 2)}

Return JSON with a "results" array. Each item needs: index, personaSnippet, relevanceScore, tags (2–3 from: tool, free, premium, open-source, tutorial, academic, official, blog, beginner, advanced, documentation, community).`;

    // STEP 5 — Call Gemini
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: rankingPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                results: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      index:          { type: 'INTEGER' },
                      personaSnippet: { type: 'STRING' },
                      relevanceScore: { type: 'NUMBER' },
                      tags:           { type: 'ARRAY', items: { type: 'STRING' } },
                    },
                    required: ['index', 'personaSnippet', 'relevanceScore', 'tags'],
                  },
                },
              },
              required: ['results'],
            },
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      throw new Error(`Gemini error ${geminiRes.status}: ${err}`);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let reranked = [];
    try {
      const parsed = JSON.parse(rawText);
      reranked = parsed.results || [];
      if (reranked.length === 0) throw new Error('Empty results from Gemini');
      console.log(`✅ Gemini ranked ${reranked.length} results`);
    } catch (parseError) {
      console.warn('⚠️ Gemini parse failed, using smart fallback:', parseError.message);
      reranked = classified.slice(0, 10).map((r) => ({
        index: r.index,
        personaSnippet: `Relevant result for ${persona.label}.`,
        relevanceScore: r.type === 'tool' ? 0.85 : r.type === 'blog' ? 0.20 : 0.55,
        tags: r.type === 'tool' ? ['tool'] : r.type === 'blog' ? ['blog'] : ['neutral'],
      }));
    }

    // STEP 6 — Post-process: enforce hard score rules regardless of what Gemini returned
    reranked = reranked.map((r) => {
      const original = filtered[r.index];  // ← use filtered[], not rawResults[]
      if (!original) return null;

      const type = classifyUrl(original.url, original.title, original.content || '');
      let score = r.relevanceScore;

      // Hard rules — these override Gemini
      if (isToolQuery && type === 'blog') {
        score = Math.min(score, 0.35);  // blogs hard-capped at 35% for tool queries
      }
      if (type === 'tool') {
        score = Math.max(score, 0.75);  // tool pages always at least 75%
      }

      // Student bonus for free tools
      const mentionsFree = /free|no cost|open.source|gratis/i.test(`${original.title} ${original.content}`);
      if (persona.id === 'student' && mentionsFree && type === 'tool') {
        score = Math.min(Math.max(score, 0.88), 1.0);
      }

      return { ...r, relevanceScore: parseFloat(score.toFixed(2)), _type: type };
    }).filter(Boolean);  // remove nulls from missing indices

    // STEP 7 — Sort, slice top 10, assign ranks
    reranked.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const highRelevanceCount = reranked.filter(r => r.relevanceScore >= 0.75).length;

    const finalResults = reranked.slice(0, 10).map((r, i) => {
      const original = filtered[r.index] || {};
      return {
        rank: i + 1,
        title: original.title || 'Unknown Title',
        url: original.url || '#',
        displayUrl: (original.url || '').replace(/^https?:\/\//, '').split('/')[0],
        originalSnippet: original.content?.slice(0, 250) || '',
        personaSnippet: r.personaSnippet || '',
        relevanceScore: r.relevanceScore,
        resultType: r._type || 'neutral',  // expose type to frontend
        tags: r.tags || [],
      };
    });

    console.log(`[Done] Top: "${finalResults[0]?.title}" (${finalResults[0]?.relevanceScore}) | High-relevance: ${highRelevanceCount}`);
    res.json({
      results: finalResults,
      query,
      persona: persona.id,
      totalFetched: rawResults.length,
      afterFilter: filtered.length,
      highRelevanceCount,
    });

  } catch (err) {
    console.error('[Search Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Smart Search backend running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});