const { GoogleGenAI, Type } = require('@google/genai');

const CACHE = new Map();
const NEWS_API_KEY = process.env.NEWS_API_KEY || process.env.news_api;
const USGS_FEED_URL =
  process.env.USGS_EARTHQUAKE_URL ||
  process.env.usgs_earthquick_url ||
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const AI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const RETRYABLE_STATUS_CODES = new Set([429, 500, 503]);
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const CRISIS_TYPES = {
  natural_disaster: {
    label: 'Natural Disasters',
    query: '(earthquake OR flood OR wildfire OR hurricane OR cyclone OR landslide OR tsunami)',
    keywords: ['earthquake', 'flood', 'wildfire', 'storm', 'cyclone', 'hurricane', 'landslide', 'tsunami', 'eruption'],
  },
  financial_crisis: {
    label: 'Financial Crises',
    query: '(banking crisis OR debt crisis OR market crash OR inflation surge OR recession risk)',
    keywords: ['inflation', 'recession', 'banking', 'debt', 'market crash', 'currency', 'default', 'liquidity'],
  },
  war_conflict: {
    label: 'War / Conflict',
    query: '(war OR armed conflict OR airstrike OR ceasefire OR invasion OR militia)',
    keywords: ['war', 'conflict', 'airstrike', 'invasion', 'militia', 'ceasefire', 'shelling', 'frontline'],
  },
  food_shortage: {
    label: 'Food Shortages',
    query: '(food shortage OR famine risk OR crop failure OR hunger crisis OR grain disruption)',
    keywords: ['food shortage', 'famine', 'hunger', 'crop failure', 'malnutrition', 'grain', 'drought'],
  },
  health_outbreak: {
    label: 'Health Outbreaks',
    query: '(outbreak OR epidemic OR pandemic OR cholera OR dengue OR measles OR public health emergency)',
    keywords: ['outbreak', 'epidemic', 'pandemic', 'cholera', 'dengue', 'measles', 'virus', 'infection'],
  },
  energy_water_crisis: {
    label: 'Energy / Water Crises',
    query: '(power outage OR grid failure OR water shortage OR drought emergency OR reservoir crisis)',
    keywords: ['power outage', 'grid', 'blackout', 'water shortage', 'drought', 'reservoir', 'electricity', 'desalination'],
  },
};

const getCache = (key) => {
  const cached = CACHE.get(key);
  if (!cached || cached.expiresAt < Date.now()) {
    CACHE.delete(key);
    return null;
  }

  return cached.value;
};

const setCache = (key, value, ttlMs) => {
  CACHE.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  return value;
};

const withCache = async (key, ttlMs, factory) => {
  const cached = getCache(key);
  if (cached) {
    return cached;
  }

  const value = await factory();
  return setCache(key, value, ttlMs);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error) =>
  error?.code === 'AI_TIMEOUT' || RETRYABLE_STATUS_CODES.has(Number(error?.status));

const withTimeout = async (promise, timeoutMs, label) => {
  let timer = null;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(`${label} timed out after ${timeoutMs}ms`);
          error.code = 'AI_TIMEOUT';
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const generateContentWithRetry = async (payload, label, options = {}) => {
  if (!ai) {
    const error = new Error('GEMINI_API_KEY is not configured');
    error.code = 'AI_UNAVAILABLE';
    throw error;
  }

  const maxRetries = options.maxRetries ?? 2;
  const timeoutMs = options.timeoutMs ?? 15000;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await withTimeout(
        ai.models.generateContent({
          model: AI_MODEL,
          ...payload,
        }),
        timeoutMs,
        label
      );
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }

      await sleep(attempt * 1000);
    }
  }

  throw lastError;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const fetchJson = async (url, options = {}, timeoutMs = 7000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Request failed (${response.status}): ${text.slice(0, 180)}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const classifyArticle = (article) => {
  const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
  let bestType = 'natural_disaster';
  let bestScore = 0;

  Object.entries(CRISIS_TYPES).forEach(([type, config]) => {
    const score = config.keywords.reduce((sum, keyword) => {
      return sum + (text.includes(keyword.toLowerCase()) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestType = type;
      bestScore = score;
    }
  });

  return {
    type: bestType,
    confidence: clamp(bestScore / 4, 0.2, 0.98),
  };
};

const normalizeArticle = (article, index, fallbackType) => {
  const classification = classifyArticle(article);
  return {
    id: `${article.url || article.title || fallbackType}-${index}`,
    title: article.title || 'Untitled crisis update',
    description: article.description || article.content || 'No summary available.',
    source: article.source?.name || 'Unknown source',
    url: article.url || '',
    publishedAt: article.publishedAt || new Date().toISOString(),
    imageUrl: article.urlToImage || null,
    classification: classification.type || fallbackType,
    confidence: classification.confidence,
  };
};

const fetchNewsFeed = async (type, limit = 5) => {
  if (!NEWS_API_KEY) {
    return [];
  }

  const config = CRISIS_TYPES[type];
  const cacheKey = `global-news:${type}:${limit}`;

  return withCache(cacheKey, 5 * 60 * 1000, async () => {
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set('q', config.query);
    url.searchParams.set('language', 'en');
    url.searchParams.set('searchIn', 'title,description');
    url.searchParams.set('sortBy', 'publishedAt');
    url.searchParams.set('pageSize', String(limit));

    const result = await fetchJson(
      url.toString(),
      {
        headers: {
          'X-Api-Key': NEWS_API_KEY,
        },
      },
      6000
    );

    return (result.articles || []).map((article, index) => normalizeArticle(article, index, type));
  });
};

const fetchEarthquakeMetric = async () => {
  const feed = await fetchJson(USGS_FEED_URL, {}, 6000);
  const earthquakes = (feed.features || []).map((feature) => Number(feature.properties?.mag || 0));
  const strongest = earthquakes.reduce((max, magnitude) => Math.max(max, magnitude), 0);
  const severeCount = earthquakes.filter((magnitude) => magnitude >= 5).length;

  return {
    metrics: [
      { label: '24h Quakes', value: String(earthquakes.length) },
      { label: 'Strongest', value: strongest > 0 ? `M${strongest.toFixed(1)}` : 'N/A' },
      { label: 'Severe Events', value: String(severeCount) },
    ],
    signalScore: clamp(severeCount * 12 + strongest * 7, 8, 92),
    source: { provider: 'USGS', label: 'Earthquake feed', url: USGS_FEED_URL },
  };
};

const fetchWorldBankIndicator = async (indicator, fallbackLabel, cacheKey) => {
  return withCache(cacheKey, 12 * 60 * 60 * 1000, async () => {
    const url = `https://api.worldbank.org/v2/country/WLD/indicator/${indicator}?format=json&per_page=8`;
    const data = await fetchJson(url, {}, 5000);
    const series = Array.isArray(data?.[1]) ? data[1] : [];
    const latest = series.find((item) => item && item.value !== null && item.value !== undefined);

    return {
      label: fallbackLabel,
      year: latest?.date || 'latest',
      value: typeof latest?.value === 'number' ? latest.value : null,
    };
  });
};

const fetchCovidMetric = async () => {
  const data = await withCache('global-covid', 30 * 60 * 1000, async () => {
    return fetchJson('https://disease.sh/v3/covid-19/all', {}, 5000);
  });

  return {
    metrics: [
      { label: 'Active Cases', value: Number(data.active || 0).toLocaleString() },
      { label: 'Critical Cases', value: Number(data.critical || 0).toLocaleString() },
      { label: 'Today Cases', value: Number(data.todayCases || 0).toLocaleString() },
    ],
    signalScore: clamp((Number(data.todayCases || 0) / 5000) + (Number(data.critical || 0) / 2000), 12, 85),
    source: { provider: 'disease.sh', label: 'Global outbreak tracker', url: 'https://disease.sh/' },
  };
};

const fetchMetricBundle = async (type) => {
  try {
    if (type === 'natural_disaster') {
      return await fetchEarthquakeMetric();
    }

    if (type === 'financial_crisis') {
      const [inflation, growth] = await Promise.all([
        fetchWorldBankIndicator('FP.CPI.TOTL.ZG', 'Global Inflation', 'wb:inflation'),
        fetchWorldBankIndicator('NY.GDP.MKTP.KD.ZG', 'Global GDP Growth', 'wb:gdp-growth'),
      ]);

      const inflationValue = Number(inflation.value || 0);
      const growthValue = Number(growth.value || 0);
      return {
        metrics: [
          { label: inflation.label, value: inflation.value === null ? 'N/A' : `${inflationValue.toFixed(1)}%` },
          { label: growth.label, value: growth.value === null ? 'N/A' : `${growthValue.toFixed(1)}%` },
          { label: 'Reference Year', value: inflation.year },
        ],
        signalScore: clamp(inflationValue * 6 + Math.max(0, -growthValue) * 14, 10, 88),
        source: { provider: 'World Bank', label: 'Macroeconomic indicators', url: 'https://api.worldbank.org/' },
      };
    }

    if (type === 'food_shortage') {
      const undernourishment = await fetchWorldBankIndicator('SN.ITK.DEFC.ZS', 'Undernourishment', 'wb:undernourishment');
      const value = Number(undernourishment.value || 0);
      return {
        metrics: [
          { label: undernourishment.label, value: undernourishment.value === null ? 'N/A' : `${value.toFixed(1)}%` },
          { label: 'Reference Year', value: undernourishment.year },
        ],
        signalScore: clamp(value * 5, 8, 82),
        source: { provider: 'World Bank', label: 'Food security indicator', url: 'https://api.worldbank.org/' },
      };
    }

    if (type === 'health_outbreak') {
      return await fetchCovidMetric();
    }

    if (type === 'energy_water_crisis') {
      const [electricity, water] = await Promise.all([
        fetchWorldBankIndicator('EG.ELC.ACCS.ZS', 'Electricity Access', 'wb:electricity'),
        fetchWorldBankIndicator('SH.H2O.BASW.ZS', 'Basic Drinking Water', 'wb:water'),
      ]);
      const electricityValue = Number(electricity.value || 0);
      const waterValue = Number(water.value || 0);
      return {
        metrics: [
          { label: electricity.label, value: electricity.value === null ? 'N/A' : `${electricityValue.toFixed(1)}%` },
          { label: water.label, value: water.value === null ? 'N/A' : `${waterValue.toFixed(1)}%` },
          { label: 'Reference Year', value: electricity.year },
        ],
        signalScore: clamp((100 - electricityValue) * 0.8 + (100 - waterValue) * 0.8, 8, 80),
        source: { provider: 'World Bank', label: 'Infrastructure access indicators', url: 'https://api.worldbank.org/' },
      };
    }
  } catch (error) {
    console.warn(`Metric bundle fetch failed for ${type}:`, error.message);
  }

  return {
    metrics: [],
    signalScore: 0,
    source: null,
  };
};

const toSeverity = (score) => {
  if (score >= 70) return 'Critical';
  if (score >= 40) return 'Warning';
  return 'Stable';
};

const buildBaseCard = (type, articles, metricBundle) => {
  const confidenceBoost = articles.reduce((sum, article) => sum + Number(article.confidence || 0), 0) * 8;
  const score = clamp(metricBundle.signalScore + articles.length * 6 + confidenceBoost, 8, 95);
  const severity = toSeverity(score);
  const topSignals = [
    ...articles.slice(0, 2).map((article) => article.title),
    ...metricBundle.metrics.slice(0, 2).map((metric) => `${metric.label}: ${metric.value}`),
  ].slice(0, 4);

  return {
    type,
    label: CRISIS_TYPES[type].label,
    severity,
    score: Math.round(score),
    summary: articles[0]?.description || `${CRISIS_TYPES[type].label} monitoring is active with multi-source watch conditions.`,
    executiveSummary: `${CRISIS_TYPES[type].label} monitoring is active.`,
    classification: type,
    topSignals,
    preventionRecommendations: [],
    responseActions: [],
    metrics: metricBundle.metrics,
    articles,
    sources: [
      ...(metricBundle.source ? [metricBundle.source] : []),
      ...(articles.length > 0 ? [{ provider: 'NewsAPI', label: 'Global news stream', url: 'https://newsapi.org/' }] : []),
    ],
  };
};

const buildFallbackInsightForCard = (card) => {
  return {
    executiveSummary: `${card.label} is currently ${card.severity.toLowerCase()} with a score of ${card.score}/100.`,
    topSignals: card.topSignals.length > 0 ? card.topSignals : [`No dominant ${card.label.toLowerCase()} signal is currently available.`],
    preventionRecommendations: [
      `Expand early-warning monitoring for ${card.label.toLowerCase()} hotspots and cross-border spillover risks.`,
      'Pre-stage coordination with government, NGO, and infrastructure operators before escalation.',
    ],
    responseActions: [
      'Refresh executive situation reports and verify the top exposed regions with field partners.',
      'Prioritize surge logistics, communications, and public guidance for the highest-risk clusters.',
    ],
  };
};

const buildFallbackExecutiveSummary = (cards) => {
  const sorted = [...cards].sort((a, b) => b.score - a.score);
  const top = sorted[0];

  return {
    headline: top ? `${top.label} is the leading global watch area.` : 'Global crisis monitoring is active.',
    summary: top
      ? `ReliefOS AI is tracking ${cards.length} crisis lanes. ${top.label} currently carries the highest composite risk score at ${top.score}/100.`
      : 'ReliefOS AI is monitoring multiple crisis lanes with partial live signals.',
    watchwords: sorted.slice(0, 3).map((card) => card.label),
    preventionFocus: top
      ? `Prevention focus should center on ${top.label.toLowerCase()} exposure reduction and supply-chain resilience.`
      : 'Prevention focus should center on cross-sector resilience and early warning.',
    responseFocus: top
      ? `Response focus should center on ${top.label.toLowerCase()} coordination, high-risk population protection, and executive alerting.`
      : 'Response focus should center on validating signals and preparing surge actions.',
  };
};

const generateAIInsights = async (cards) => {
  const payload = cards.map((card) => ({
    type: card.type,
    label: card.label,
    severity: card.severity,
    score: card.score,
    metrics: card.metrics,
    topSignals: card.topSignals,
    headlines: card.articles.slice(0, 3).map((article) => ({
      title: article.title,
      source: article.source,
      classification: article.classification,
    })),
  }));

  const response = await generateContentWithRetry(
    {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                'You are ReliefOS AI operating as a universal crisis intelligence platform.',
                'Summarize the following global crisis lanes for executives.',
                'Keep language concise, high-signal, and action-oriented.',
                `Data: ${JSON.stringify(payload)}`,
              ].join('\n'),
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                summary: { type: Type.STRING },
                watchwords: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                preventionFocus: { type: Type.STRING },
                responseFocus: { type: Type.STRING },
              },
              required: ['headline', 'summary', 'watchwords', 'preventionFocus', 'responseFocus'],
            },
            cards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  executiveSummary: { type: Type.STRING },
                  topSignals: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  preventionRecommendations: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  responseActions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['type', 'executiveSummary', 'topSignals', 'preventionRecommendations', 'responseActions'],
              },
            },
          },
          required: ['executiveSummary', 'cards'],
        },
      },
    },
    'Global crisis AI synthesis',
    { maxRetries: 1, timeoutMs: 7000 }
  );

  return JSON.parse(response.text || '{}');
};

const buildGlobalOverview = async () => {
  const typeEntries = Object.keys(CRISIS_TYPES);
  const settledDatasets = await Promise.allSettled(
    typeEntries.map(async (type) => {
      const [articlesResult, metricResult] = await Promise.allSettled([
        fetchNewsFeed(type, 4),
        fetchMetricBundle(type),
      ]);

      const articles = articlesResult.status === 'fulfilled' ? articlesResult.value : [];
      const metricBundle =
        metricResult.status === 'fulfilled'
          ? metricResult.value
          : {
              metrics: [],
              signalScore: 0,
              source: null,
            };

      return {
        card: buildBaseCard(type, articles, metricBundle),
        degraded:
          articlesResult.status === 'rejected' ||
          metricResult.status === 'rejected' ||
          metricBundle.metrics.length === 0,
      };
    })
  );

  const datasets = settledDatasets
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value.card);
  const degradedCount = settledDatasets
    .filter((result) => result.status === 'fulfilled')
    .filter((result) => result.value.degraded).length;
  const sourceFailures = settledDatasets.filter((result) => result.status === 'rejected').length;

  let executiveSummary = buildFallbackExecutiveSummary(datasets);
  try {
    const aiInsights = await generateAIInsights(datasets);
    const insightMap = new Map(
      (Array.isArray(aiInsights.cards) ? aiInsights.cards : []).map((card) => [card.type, card])
    );

    datasets.forEach((card) => {
      const aiCard = insightMap.get(card.type);
      const fallback = buildFallbackInsightForCard(card);
      card.executiveSummary = aiCard?.executiveSummary || fallback.executiveSummary;
      card.topSignals = Array.isArray(aiCard?.topSignals) && aiCard.topSignals.length > 0 ? aiCard.topSignals : fallback.topSignals;
      card.preventionRecommendations =
        Array.isArray(aiCard?.preventionRecommendations) && aiCard.preventionRecommendations.length > 0
          ? aiCard.preventionRecommendations
          : fallback.preventionRecommendations;
      card.responseActions =
        Array.isArray(aiCard?.responseActions) && aiCard.responseActions.length > 0
          ? aiCard.responseActions
          : fallback.responseActions;
    });

    if (aiInsights.executiveSummary) {
      executiveSummary = {
        ...executiveSummary,
        ...aiInsights.executiveSummary,
      };
    }
  } catch (error) {
    console.warn('Global crisis AI fallback engaged:', error.message);
    datasets.forEach((card) => {
      const fallback = buildFallbackInsightForCard(card);
      card.executiveSummary = fallback.executiveSummary;
      card.topSignals = fallback.topSignals;
      card.preventionRecommendations = fallback.preventionRecommendations;
      card.responseActions = fallback.responseActions;
    });
  }

  const sortedCards = [...datasets].sort((a, b) => b.score - a.score);
  return {
    updatedAt: new Date().toISOString(),
    executiveSummary,
    cards: sortedCards,
    sourceStatus: {
      newsApiEnabled: Boolean(NEWS_API_KEY),
      aiEnabled: Boolean(ai),
      usgsEnabled: true,
      worldBankEnabled: true,
      outbreakEnabled: true,
      mode: NEWS_API_KEY && degradedCount === 0 && sourceFailures === 0 ? 'live' : 'partial',
    },
  };
};

const getGlobalOverview = async (_req, res) => {
  try {
    const overview = await withCache('global-overview', 5 * 60 * 1000, buildGlobalOverview);
    res.json(overview);
  } catch (error) {
    console.error('Global crisis overview error:', error);
    res.status(500).json({ message: 'Failed to fetch global crisis overview' });
  }
};

module.exports = {
  buildGlobalOverview,
  getGlobalOverview,
};
