/**
 * controllers/ai.controller.js
 * ----------------------------
 * Handles all AI integration logic bridging the frontend with Google Gemini.
 * Keeps API keys secure on the backend.
 */

const { GoogleGenAI, Type } = require('@google/genai');

const AI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const RETRYABLE_STATUS_CODES = new Set([429, 500, 503]);
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 12000;

// Initialize Gemini client using backend environment variable
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error) => {
  return error?.code === 'AI_TIMEOUT' || RETRYABLE_STATUS_CODES.has(Number(error?.status));
};

const withTimeout = async (promise, timeoutMs, label) => {
  let timer = null;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const timeoutError = new Error(`${label} timed out after ${timeoutMs}ms`);
          timeoutError.code = 'AI_TIMEOUT';
          reject(timeoutError);
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

  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
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

      const delayMs = attempt * 1200;
      const errorLabel = error.status || error.code || 'unknown';
      console.warn(
        `${label} failed with status ${errorLabel}. Retrying in ${delayMs}ms ` +
        `(attempt ${attempt + 1}/${maxRetries}).`
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
};

const buildFallbackCityReport = (cityName) => ({
  city: cityName,
  country: 'India',
  status: 'Warning',
  threatLevel: 58,
  populationAtRisk: 'Localized pockets under observation',
  environmentalStatus: 'Fallback intelligence mode is active while the live model relay is unavailable.',
  recentIncidents: [
    `Command is monitoring weather-linked disruption signals around ${cityName}.`,
    'Field verification is recommended before high-volume dispatch decisions.',
    'Shelter, water, and medical readiness should remain on standby.',
  ],
  recommendation: `Use Crisis Map and Operations Copilot to validate live conditions in ${cityName} before escalation.`,
  weather: {
    temperature: '29C',
    precipitation: '18%',
    windSpeed: '14 km/h',
    condition: 'Monitored',
    aqi: 96,
  },
});

// ── GET /api/ai/report/:cityName ──────────────────────────────────────────────
// Generates a localized disaster/crisis report and real-time weather data mock
const generateCityReport = async (req, res) => {
  const cityName = req.params.cityName;

  const prompt = `Generate a realistic disaster/crisis report and real-time weather data for the city of ${cityName}. 
  The report should feel like it comes from a high-tech mission control system (ReliefOS). 
  Be specific about local geography and potential climate/crisis risks.
  Include current weather conditions: temperature, precipitation, wind speed, a general condition description, and a simulated Air Quality Index (AQI) value (0-500).`;

  try {
    const response = await generateContentWithRetry(
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              city: { type: Type.STRING },
              country: { type: Type.STRING },
              status: {
                type: Type.STRING,
                enum: ['Critical', 'Warning', 'Stable']
              },
              threatLevel: { type: Type.NUMBER },
              populationAtRisk: { type: Type.STRING },
              environmentalStatus: { type: Type.STRING },
              recentIncidents: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              recommendation: { type: Type.STRING },
              weather: {
                type: Type.OBJECT,
                properties: {
                  temperature: { type: Type.STRING, description: 'e.g. 24C' },
                  precipitation: { type: Type.STRING, description: 'e.g. 15%' },
                  windSpeed: { type: Type.STRING, description: 'e.g. 12 km/h' },
                  condition: { type: Type.STRING, description: 'e.g. Stormy' },
                  aqi: { type: Type.NUMBER, description: 'Air Quality Index 0-500' }
                },
                required: ['temperature', 'precipitation', 'windSpeed', 'condition', 'aqi']
              }
            },
            required: ['city', 'country', 'status', 'threatLevel', 'populationAtRisk', 'environmentalStatus', 'recentIncidents', 'recommendation', 'weather']
          }
        }
      },
      'AI Report generation',
      { maxRetries: 3, timeoutMs: 15000 }
    );

    const report = JSON.parse(response.text || '{}');
    res.json(report);
  } catch (error) {
    console.error('AI Report generation failed:', error);
    if (error.code === 'AI_UNAVAILABLE' || isRetryableError(error)) {
      return res.json(buildFallbackCityReport(cityName));
    }
    res.status(500).json({ message: 'Failed to generate city report' });
  }
};

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────
// Handles conversational queries for the AIAssistant.tsx
const chat = async (req, res) => {
  const { messages } = req.body; // Expects array of { role: 'user' | 'assistant', text: string }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ message: 'Messages array is required' });
  }

  // Define the system instructions context
  const systemInstruction = `You are ReliefOS AI Tactical Assistant. You are an advanced logical core integrated into a disaster response platform. 
Keep your tone analytical, precise, and professional. 
Assist the operator with humanitarian logistics, threat assessment, resource allocation strategies, and environmental data interpretation.
Current System Status: ONLINE. Nodes connected: 8432. Latency: 45ms.`;

  // Format history for the API
  const formattedContents = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.text }]
  }));

  try {
    const response = await generateContentWithRetry(
      {
        contents: formattedContents,
        config: {
          systemInstruction,
        }
      },
      'AI Chat generation',
      { maxRetries: 1, timeoutMs: 6000 }
    );

    res.json({ reply: response.text });
  } catch (error) {
    console.error('AI Chat generation failed:', error);

    // Keep the assistant usable during transient provider saturation.
    if (error.code === 'AI_UNAVAILABLE' || isRetryableError(error)) {
      return res.json({
        reply:
          'ReliefOS AI model routing is temporarily unavailable, but the command relay is still online. ' +
          'Please retry shortly. In the meantime, ask for incident status, shelter guidance, shortage risk, or dispatch support and continue through the protected Operations Copilot.'
      });
    }

    res.status(500).json({ message: 'Failed to generate chat response' });
  }
};

module.exports = { generateCityReport, chat };
