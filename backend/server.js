const express = require('express');
const cors = require('cors');
require('dotenv').config();

// NOTE: node-fetch removed — using Node 18+ native fetch (works on Vercel + VS Code)

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/search', (req, res) => {
  res.status(405).json({
    error: 'Method Not Allowed',
    hint: 'Use POST /api/search with { "query": "...", "persona": {...} } in the request body',
    example: {
      query: 'AI tools',
      persona: { id: 'student', label: 'Student', context: '...' }
    }
  });
});

// ─── BLACKLIST: removed linkedin.com so job seekers get results ───────────────
const BLACKLISTED_DOMAINS = [
  'facebook.com', 'reddit.com', 'twitter.com', 'x.com',
  'instagram.com', 'tiktok.com', 'pinterest.com', 'quora.com',
  'youtube.com',
  // linkedin.com REMOVED — job seekers need linkedin.com/jobs results
];

function isBlacklisted(url = '') {
  return BLACKLISTED_DOMAINS.some(d => url.toLowerCase().includes(d));
}

// ─── CLASSIFIER: added academic, career and dev domains as known resources ────
function classifyUrl(url = '', title = '', snippet = '') {
  const text = `${url} ${title} ${snippet}`.toLowerCase();
  const domain = url.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];

  // ── KNOWN TOOL / RESOURCE DOMAINS ──
  const knownToolDomains = [
    // Design / Creative tools
    'canva.com', 'runway.ml', 'midjourney.com', 'openai.com', 'stability.ai',
    'adobe.com', 'figma.com', 'notion.so', 'airtable.com', 'zapier.com',
    'huggingface.co', 'replicate.com', 'leonardo.ai', 'ideogram.ai',
    'firefly.adobe.com', 'bing.com', 'copilot.microsoft.com',
    'nightcafe.studio', 'craiyon.com', 'dreamstudio.ai', 'perchance.org',
    'picsart.com', 'fotor.com', 'pixlr.com', 'remove.bg', 'cleanup.pictures',
    // Developer tools
    'github.com', 'stackoverflow.com', 'npmjs.com', 'pypi.org',
    'devdocs.io', 'readthedocs.io', 'replit.com', 'codepen.io',
    'vercel.com', 'netlify.com', 'heroku.com', 'railway.app',
    // Academic sources
    'arxiv.org', 'pubmed.ncbi.nlm.nih.gov', 'scholar.google.com',
    'researchgate.net', 'semanticscholar.org', 'jstor.org',
    'springer.com', 'nature.com', 'ieee.org', 'acm.org', 'sciencedirect.com',
    'doaj.org', 'ncbi.nlm.nih.gov', 'biorxiv.org', 'ssrn.com',
    // Career / Job platforms
    'indeed.com', 'glassdoor.com', 'linkedin.com', 'internshala.com',
    'naukri.com', 'wellfound.com', 'levels.fyi', 'handshake.com',
    'simplyhired.com', 'ziprecruiter.com', 'monster.com', 'shine.com',
    // Education platforms
    'khanacademy.org', 'coursera.org', 'edx.org', 'udemy.com',
    'teacherspayteachers.com', 'quizlet.com', 'kahoot.com',
    'duolingo.com', 'brilliant.org',
  ];
  if (knownToolDomains.some(d => domain.includes(d))) return 'tool';

  // ── STRONG TOOL SIGNALS ──
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

  return 'neutral';
}

// ─── QUERY ENHANCER: fixed researcher/jobseeker — removed "tool" keyword ──────
function enhanceQuery(query, personaId) {
  const base = {
    student: `${query} free beginner`,
    researcher: `${query} academic paper study`,
    developer: `${query} github documentation api`,
    professional: `${query} enterprise platform`,
    entrepreneur: `${query} startup saas`,
    creative: `${query} free design`,
    educator: `${query} free classroom teaching`,
    jobseeker: `${query} job internship apply`,
  };
  return (base[personaId] || query) + ' -reddit -facebook -quora -medium';
}

app.post('/api/search', async (req, res) => {
  const { query, persona } = req.body;
  if (!query || !persona) return res.status(400).json({ error: 'query and persona are required' });

  const TAVILY_KEY = process.env.TAVILY_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  if (!TAVILY_KEY) {
    return res.status(500).json({ error: 'TAVILY_API_KEY is missing. Add it in your .env file or Vercel environment variables.' });
  }
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is missing. Add it in your .env file or Vercel environment variables.' });
  }

  try {
    const enhancedQuery = enhanceQuery(query, persona.id);
    console.log(`\n[Search] Query: "${query}" → Enhanced: "${enhancedQuery}" | Persona: ${persona.id}`);

    // STEP 1 — Fetch from Tavily (native fetch, 8s timeout for Vercel)
    let tavilyRes;
    try {
      tavilyRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TAVILY_KEY}`,
        },
        body: JSON.stringify({
          query: enhancedQuery,
          max_results: 25,
          search_depth: 'basic',
          include_answer: false,
          include_raw_content: false,
        }),
        signal: AbortSignal.timeout(30000),
      });
    } catch (tavilyErr) {
      console.error('[Tavily Fetch Error]', tavilyErr.message);
      return res.status(500).json({
        error: `Tavily request failed: ${tavilyErr.message}`,
        hint: 'Check that TAVILY_API_KEY is set correctly in Vercel environment variables and redeploy.',
      });
    }

    if (!tavilyRes.ok) {
      const err = await tavilyRes.text();
      console.error('[Tavily API Error]', tavilyRes.status, err);
      return res.status(500).json({
        error: `Tavily API error ${tavilyRes.status}: ${err}`,
        hint: tavilyRes.status === 401
          ? 'Invalid TAVILY_API_KEY — check it in Vercel environment variables.'
          : tavilyRes.status === 429
            ? 'Tavily rate limit hit — free tier allows 1000 searches/month.'
            : 'Tavily API error — check Vercel function logs.',
      });
    }

    const tavilyData = await tavilyRes.json();
    const rawResults = tavilyData.results || [];

    if (rawResults.length === 0) {
      return res.json({ results: [], query, persona: persona.id, totalFetched: 0 });
    }

    // STEP 2 — Filter blacklisted domains
    const filtered = rawResults.filter(r => !isBlacklisted(r.url));
    console.log(`[Filter] Removed ${rawResults.length - filtered.length} blacklisted results. Remaining: ${filtered.length}`);

    if (filtered.length === 0) {
      return res.json({ results: [], query, persona: persona.id, totalFetched: rawResults.length });
    }

    // STEP 3 — Classify
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

    // ─── STEP 4 — UNIVERSAL Gemini ranking prompt ─────────────────────────────
    const rankingPrompt = `You are a search result re-ranking engine. Rank the top 10 results for a "${persona.label}" who searched: "${query}".

PERSONA: ${persona.label}
PERSONA NEEDS: ${persona.context}

UNIVERSAL SCORING RULES (apply for ALL query types, ALL personas):

1. Score based on how useful the result is FOR THIS SPECIFIC PERSONA — not just topic relevance.
   Examples of persona-aware thinking:
   - Student searching "research papers" → free/open-access papers score highest (arXiv, PubMed free), paywalled sites score low
   - Student searching "internship" → free job boards, beginner-friendly career guides score highest
   - Job seeker searching "AI tools" → tools that help with resume/portfolio score highest
   - Developer searching "design" → CSS libraries, code-based design tools, GitHub repos score highest
   - Researcher searching "image generator" → academic/research-grade tools, papers about the topic score highest
   Always interpret the query through the lens of what THIS persona actually needs.

2. BLOG HARD LIMIT — include a maximum of 2 blog/article results in your output.
   - If you have more than 2 blogs, drop the lowest-scoring ones entirely
   - The 2 blogs you keep must be genuinely exceptional for this persona
   - All blogs MUST be ranked 9th or 10th — never in the top 8

3. Score distribution:
   - type="tool" strongly matching persona needs: 0.85–1.0
   - type="tool" partially matching: 0.72–0.85
   - type="neutral" (docs, academic, official, wiki, job boards) matching persona: 0.75–0.95
   - type="blog" (max 2 total): 0.20–0.42, always 9th or 10th position
   - SPREAD scores — top result must be 0.88+, bottom blog under 0.40
   - Do NOT cluster everything at 0.55 — differentiate clearly

4. personaSnippet: one sentence explaining why this result helps THIS specific persona.
   Good examples:
   - Student + arXiv paper: "Free open-access paper, no subscription needed."
   - Job seeker + resume builder: "Free resume templates you can edit and download instantly."
   - Developer + GitHub repo: "Open-source library with full docs and code examples."
   - Researcher + journal: "Peer-reviewed study directly relevant to your research query."

RESULTS TO RANK:
${JSON.stringify(classified, null, 2)}

Return JSON with a "results" array. Each item: index, personaSnippet, relevanceScore, tags (2–3 from: tool, free, premium, open-source, tutorial, academic, official, blog, beginner, advanced, documentation, community).`;

    // STEP 5 — Call Gemini (native fetch, 8s timeout for Vercel)
    let geminiRes;
    try {
      geminiRes = await fetch(
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
                        index: { type: 'INTEGER' },
                        personaSnippet: { type: 'STRING' },
                        relevanceScore: { type: 'NUMBER' },
                        tags: { type: 'ARRAY', items: { type: 'STRING' } },
                      },
                      required: ['index', 'personaSnippet', 'relevanceScore', 'tags'],
                    },
                  },
                },
                required: ['results'],
              },
            },
          }),
          signal: AbortSignal.timeout(40000),
        }
      );
    } catch (geminiErr) {
      console.error('[Gemini Fetch Error]', geminiErr.message);
      return res.status(500).json({
        error: `Gemini request failed: ${geminiErr.message}`,
        hint: 'Check that GEMINI_API_KEY is set correctly in Vercel environment variables and redeploy.',
      });
    }

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('[Gemini API Error]', geminiRes.status, err);
      return res.status(500).json({
        error: `Gemini API error ${geminiRes.status}: ${err}`,
        hint: geminiRes.status === 400
          ? 'Invalid GEMINI_API_KEY — check it in Vercel environment variables.'
          : 'Gemini API error — check Vercel function logs.',
      });
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
        relevanceScore: r.type === 'tool' ? 0.85 : r.type === 'blog' ? 0.25 : 0.65,
        tags: r.type === 'tool' ? ['tool'] : r.type === 'blog' ? ['blog'] : ['neutral'],
      }));
    }

    // ─── STEP 6 — POST-PROCESSING: universal persona boosts + hard 2-blog cap ──
    reranked = reranked.map((r) => {
      const original = filtered[r.index];
      if (!original) return null;

      const type = classifyUrl(original.url, original.title, original.content || '');
      const text = `${original.title} ${original.content || ''}`.toLowerCase();
      const mentionsFree = /free|no cost|open.source|gratis|free tier|free plan/i.test(text);
      let score = r.relevanceScore;

      // ── Hard floor/cap by type (applies to ALL personas) ──
      if (type === 'blog') score = Math.min(score, 0.42);
      if (type === 'tool') score = Math.max(score, 0.72);

      // ── Persona-specific boosts (work for ANY query topic) ──
      if (persona.id === 'student') {
        if (mentionsFree && type === 'tool') score = Math.max(score, 0.90);
        if (/arxiv|biorxiv|doaj|unpaywall|pmc|pubmed|open.*access/i.test(text)) score = Math.max(score, 0.85);
        if (type === 'neutral' && /tutorial|beginner|intro|guide|learn|course|free/i.test(text)) score = Math.max(score, 0.78);
        if (type === 'blog') score = Math.min(score, 0.38);
      }

      if (persona.id === 'researcher') {
        if (/arxiv\.org|pubmed|scholar\.google|researchgate|springer|nature\.com|jstor|ieee\.org|acm\.org|semanticscholar|sciencedirect|biorxiv|ssrn/.test(original.url)) score = Math.max(score, 0.92);
        if (type === 'neutral') score = Math.max(score, 0.72);
        if (type === 'blog') score = Math.min(score, 0.30);
      }

      if (persona.id === 'jobseeker') {
        if (/indeed\.com|glassdoor|linkedin\.com|internshala|naukri|wellfound|levels\.fyi|handshake|simplyhired|ziprecruiter|monster\.com|shine\.com/.test(original.url)) score = Math.max(score, 0.92);
        if (/resume|cv|cover.letter|interview|internship|job.board|career|placement/i.test(text) && type !== 'blog') score = Math.max(score, 0.80);
        if (mentionsFree && type === 'tool') score = Math.max(score, 0.85);
      }

      if (persona.id === 'developer') {
        if (/github\.com|stackoverflow\.com|developer\.|docs\.|npmjs\.com|pypi\.org|devdocs|mdn|readthedocs|replit\.com|codepen\.io/.test(original.url)) score = Math.max(score, 0.92);
        if (type === 'neutral') score = Math.max(score, 0.70);
        if (type === 'blog') score = Math.min(score, 0.35);
      }

      if (persona.id === 'educator') {
        if (/\.edu\/|khanacademy|coursera|edx|teacherspayteachers|quizlet|kahoot|google.*classroom|brilliant\.org/.test(original.url)) score = Math.max(score, 0.90);
        if (mentionsFree && type === 'tool') score = Math.max(score, 0.85);
      }

      if (persona.id === 'creative') {
        if (/figma|canva|dribbble|behance|unsplash|adobe|coolors|fontpair|mobbin|pexels|freepik/.test(original.url)) score = Math.max(score, 0.90);
        if (mentionsFree && type === 'tool') score = Math.max(score, 0.85);
      }

      if (persona.id === 'entrepreneur') {
        if (type === 'tool' && mentionsFree) score = Math.max(score, 0.85);
        if (/producthunt|indiehackers|ycombinator|crunchbase/.test(original.url)) score = Math.max(score, 0.80);
        if (type === 'blog') score = Math.min(score, 0.38);
      }

      if (persona.id === 'professional') {
        if (type === 'tool') score = Math.max(score, 0.78);
        if (type === 'blog') score = Math.min(score, 0.35);
      }

      return { ...r, relevanceScore: parseFloat(score.toFixed(2)), _type: type };
    }).filter(Boolean);

    // Sort by score descending
    reranked.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // ── HARD ENFORCE: max 2 blogs, always at the bottom ──
    const nonBlogs = reranked.filter(r => r._type !== 'blog');
    const blogs = reranked.filter(r => r._type === 'blog').slice(0, 2);
    reranked = [...nonBlogs.slice(0, 8), ...blogs];

    const highRelevanceCount = reranked.filter(r => r.relevanceScore >= 0.75).length;

    // STEP 7 — Build final response
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
        resultType: r._type || 'neutral',
        tags: r.tags || [],
      };
    });

    console.log(`[Done] Top: "${finalResults[0]?.title}" (${finalResults[0]?.relevanceScore}) | High-relevance: ${highRelevanceCount} | Blogs: ${blogs.length}`);
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
    res.status(500).json({
      error: err.message,
      hint: 'Check Vercel function logs for details.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Smart Search backend running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});