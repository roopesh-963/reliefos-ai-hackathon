const CACHE = new Map();
const DEFAULT_NEWS_QUERY = '(earthquake OR flood OR wildfire OR storm OR cyclone OR hurricane OR landslide OR evacuation OR disaster)';
const CRISIS_KEYWORDS = [
  'earthquake',
  'quake',
  'tremor',
  'flood',
  'wildfire',
  'cyclone',
  'hurricane',
  'typhoon',
  'tornado',
  'landslide',
  'evacuation',
  'disaster',
  'emergency',
  'aftershock',
  'tsunami',
  'eruption',
  'volcanic',
  'severe weather',
];
const USGS_FEED_URL =
  process.env.USGS_EARTHQUAKE_URL ||
  process.env.usgs_earthquick_url ||
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || process.env.Weather_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY || process.env.news_api;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.google_map_api;

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

const fetchJson = async (url, options = {}, timeoutMs = 9000) => {
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
      throw new Error(`Request failed (${response.status}): ${text.slice(0, 200)}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const toRadians = (value) => (value * Math.PI) / 180;

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatTemperature = (value) => `${Math.round(value)}C`;
const formatWind = (value) => `${Math.round(value * 3.6)} km/h`;
const formatPrecipitation = (rainAmount) => `${Math.round(rainAmount)} mm`;

const mapOpenWeatherAqi = (aqiValue) => {
  // OpenWeather returns 1..5. Convert to a more familiar 0..500 scale.
  const mapping = {
    1: 35,
    2: 75,
    3: 125,
    4: 180,
    5: 250,
  };

  return mapping[aqiValue] || 50;
};

const toMarkerType = (magnitude) => {
  if (magnitude >= 6) {
    return 'critical';
  }

  if (magnitude >= 4.5) {
    return 'warning';
  }

  return 'stable';
};

const extractCountry = (components = []) => {
  return components.find((component) => component.types?.includes('country'))?.long_name || 'Unknown';
};

const extractLocality = (components = []) => {
  const preferredTypes = [
    'locality',
    'administrative_area_level_2',
    'administrative_area_level_1',
    'postal_town',
    'sublocality',
  ];

  for (const type of preferredTypes) {
    const match = components.find((component) => component.types?.includes(type));
    if (match) {
      return match.long_name;
    }
  }

  return null;
};

const normalizeEarthquakeFeature = (feature) => {
  const [longitude, latitude, depth = 0] = feature.geometry?.coordinates || [0, 0, 0];
  const magnitude = Number(feature.properties?.mag || 0);
  const place = feature.properties?.place || 'Unspecified seismic event';

  return {
    id: feature.id,
    label: place,
    position: [latitude, longitude],
    type: toMarkerType(magnitude),
    role: 'city',
    magnitude,
    depthKm: depth,
    occurredAt: feature.properties?.time,
    sourceUrl: feature.properties?.url,
    tsunami: Boolean(feature.properties?.tsunami),
    significance: feature.properties?.sig || 0,
  };
};

const fetchEarthquakes = async () => {
  return withCache('usgs:all_day', 60 * 1000, async () => {
    const feed = await fetchJson(USGS_FEED_URL);
    return (feed.features || [])
      .map(normalizeEarthquakeFeature)
      .sort((a, b) => (b.magnitude || 0) - (a.magnitude || 0));
  });
};

const filterNewsArticles = (articles, options = {}) => {
  const contextTerms = (options.contextTerms || [])
    .map((term) => String(term || '').trim().toLowerCase())
    .filter((term) => term.length >= 3);
  const crisisTerms = (options.crisisTerms || CRISIS_KEYWORDS).map((term) => term.toLowerCase());

  return articles.filter((article) => {
    const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
    const matchesCrisis = crisisTerms.some((term) => text.includes(term));
    const matchesContext = contextTerms.length === 0 || contextTerms.some((term) => text.includes(term));
    return matchesCrisis && matchesContext;
  });
};

const fetchCrisisNews = async (query, limit = 6, options = {}) => {
  if (!NEWS_API_KEY) {
    return [];
  }

  const cacheKey = `news:${query}:${limit}:${JSON.stringify(options)}`;
  return withCache(cacheKey, 5 * 60 * 1000, async () => {
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set('q', query);
    url.searchParams.set('language', 'en');
    url.searchParams.set('searchIn', 'title,description');
    url.searchParams.set('sortBy', options.sortBy || 'publishedAt');
    url.searchParams.set('pageSize', String(Math.max(limit * 3, limit)));

    const result = await fetchJson(
      url.toString(),
      {
        headers: {
          'X-Api-Key': NEWS_API_KEY,
        },
      },
      9000
    );

    const normalized = (result.articles || []).map((article, index) => ({
      id: `${article.url || article.title || 'article'}-${index}`,
      title: article.title,
      description: article.description || article.content || '',
      source: article.source?.name || 'Unknown source',
      url: article.url,
      imageUrl: article.urlToImage,
      publishedAt: article.publishedAt,
    }));

    return filterNewsArticles(normalized, options).slice(0, limit);
  });
};

const geocodeByLabel = async (label) => {
  if (!GOOGLE_MAPS_API_KEY || !label) {
    return null;
  }

  const cacheKey = `geocode:${label.toLowerCase()}`;
  return withCache(cacheKey, 24 * 60 * 60 * 1000, async () => {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', label);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

    const result = await fetchJson(url.toString(), {}, 9000);
    const location = result.results?.[0];
    if (!location) {
      return null;
    }

    return {
      label: location.formatted_address,
      city: extractLocality(location.address_components) || label,
      country: extractCountry(location.address_components),
      lat: location.geometry.location.lat,
      lng: location.geometry.location.lng,
    };
  });
};

const reverseGeocode = async (lat, lng) => {
  if (!GOOGLE_MAPS_API_KEY || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  const cacheKey = `reverse:${lat.toFixed(3)}:${lng.toFixed(3)}`;
  return withCache(cacheKey, 24 * 60 * 60 * 1000, async () => {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

    const result = await fetchJson(url.toString(), {}, 9000);
    const location = result.results?.[0];
    if (!location) {
      return null;
    }

    return {
      label: location.formatted_address,
      city: extractLocality(location.address_components) || location.formatted_address,
      country: extractCountry(location.address_components),
      lat,
      lng,
    };
  });
};

const fetchWeather = async (lat, lng) => {
  if (!WEATHER_API_KEY) {
    return null;
  }

  const cacheKey = `weather:${lat.toFixed(3)}:${lng.toFixed(3)}`;
  return withCache(cacheKey, 10 * 60 * 1000, async () => {
    const weatherUrl = new URL('https://api.openweathermap.org/data/2.5/weather');
    weatherUrl.searchParams.set('lat', String(lat));
    weatherUrl.searchParams.set('lon', String(lng));
    weatherUrl.searchParams.set('units', 'metric');
    weatherUrl.searchParams.set('appid', WEATHER_API_KEY);

    const aqiUrl = new URL('https://api.openweathermap.org/data/2.5/air_pollution');
    aqiUrl.searchParams.set('lat', String(lat));
    aqiUrl.searchParams.set('lon', String(lng));
    aqiUrl.searchParams.set('appid', WEATHER_API_KEY);

    const [weather, airQuality] = await Promise.all([
      fetchJson(weatherUrl.toString(), {}, 9000),
      fetchJson(aqiUrl.toString(), {}, 9000).catch(() => null),
    ]);

    const rainVolume = weather.rain?.['1h'] || weather.rain?.['3h'] || 0;
    const aqi = mapOpenWeatherAqi(airQuality?.list?.[0]?.main?.aqi);

    return {
      temperature: formatTemperature(weather.main?.temp || 0),
      precipitation: formatPrecipitation(rainVolume),
      windSpeed: formatWind(weather.wind?.speed || 0),
      condition: weather.weather?.[0]?.main || 'Unknown',
      aqi,
      humidity: weather.main?.humidity || null,
      pressure: weather.main?.pressure || null,
    };
  });
};

const deriveThreatLevel = ({ strongestMagnitude, nearbyEarthquakes, headlinesCount, aqi, windSpeedKmh }) => {
  const quakeSignal = strongestMagnitude >= 6 ? 55 : strongestMagnitude >= 5 ? 40 : strongestMagnitude >= 4 ? 28 : strongestMagnitude > 0 ? 16 : 0;
  const nearbySignal = clamp(nearbyEarthquakes * 6, 0, 18);
  const mediaSignal = clamp(headlinesCount * 6, 0, 18);
  const aqiSignal = clamp((aqi - 35) / 5, 0, 16);
  const windSignal = clamp((windSpeedKmh - 20) / 3, 0, 12);

  return clamp(Math.round(quakeSignal + nearbySignal + mediaSignal + aqiSignal + windSignal), 5, 95);
};

const buildPopulationAtRisk = (threatLevel, headlinesCount) => {
  if (threatLevel >= 75) {
    return 'High-risk urban corridor';
  }

  if (threatLevel >= 50 || headlinesCount >= 3) {
    return 'Elevated community exposure';
  }

  return 'Localized disruption risk';
};

const buildEnvironmentalStatus = (label, weather, strongestMagnitude, nearbyCount) => {
  const quakeFragment =
    strongestMagnitude > 0
      ? `Recent seismic activity near ${label} includes a strongest magnitude of ${strongestMagnitude.toFixed(1)} with ${nearbyCount} nearby events in the last 24 hours.`
      : `No major earthquakes were captured near ${label} in the latest 24-hour feed.`;

  if (!weather) {
    return `${quakeFragment} Live weather telemetry is currently unavailable.`;
  }

  return `${quakeFragment} Current conditions are ${weather.condition.toLowerCase()}, ${weather.temperature}, winds ${weather.windSpeed}, and AQI ${weather.aqi}.`;
};

const buildRecommendation = (status, weather, nearbyEarthquakes, headlines) => {
  if (status === 'Critical') {
    return 'Escalate monitoring, pre-stage rescue logistics, validate shelter readiness, and issue public advisories through local command channels.';
  }

  if (nearbyEarthquakes > 0) {
    return 'Keep field teams on alert, inspect critical infrastructure routes, and maintain rapid assessment crews near likely impact zones.';
  }

  if (weather && weather.aqi >= 125) {
    return 'Advise responders to use respiratory protection, limit prolonged outdoor staging, and rotate teams through cleaner air corridors where available.';
  }

  if (headlines.length > 0) {
    return 'Track media-confirmed incident developments, validate source credibility, and coordinate updates with local authorities before dispatch changes.';
  }

  return 'Maintain routine monitoring and keep reconnaissance assets available for rapid deployment if new signals emerge.';
};

const buildRecentIncidents = (nearbyEarthquakes, headlines) => {
  const incidents = [
    ...nearbyEarthquakes.slice(0, 3).map((quake) => `M${quake.magnitude.toFixed(1)} earthquake detected near ${quake.label}.`),
    ...headlines.slice(0, 3).map((headline) => headline.title),
  ];

  return incidents.slice(0, 6);
};

const resolveLocationContext = async ({ label, lat, lng }) => {
  const numericLat = Number(lat);
  const numericLng = Number(lng);

  if (!Number.isNaN(numericLat) && !Number.isNaN(numericLng)) {
    const reverse = await reverseGeocode(numericLat, numericLng);
    return reverse || {
      label: label || `${numericLat.toFixed(2)}, ${numericLng.toFixed(2)}`,
      city: label || 'Selected location',
      country: 'Unknown',
      lat: numericLat,
      lng: numericLng,
    };
  }

  const geocoded = await geocodeByLabel(label);
  if (geocoded) {
    return geocoded;
  }

  throw new Error('Unable to resolve the requested location.');
};

const getOverview = async (_req, res) => {
  try {
    const [earthquakes, headlines] = await Promise.all([
      fetchEarthquakes(),
      fetchCrisisNews(DEFAULT_NEWS_QUERY, 6, { sortBy: 'publishedAt' }),
    ]);

    const markers = earthquakes.slice(0, 30);
    const criticalEarthquakes = earthquakes.filter((quake) => quake.type === 'critical').length;
    const warningEarthquakes = earthquakes.filter((quake) => quake.type === 'warning').length;
    const maxMagnitude = earthquakes[0]?.magnitude || 0;

    res.json({
      updatedAt: new Date().toISOString(),
      markers,
      headlines,
      summary: {
        activeEarthquakes: earthquakes.length,
        criticalEarthquakes,
        warningEarthquakes,
        crisisArticles: headlines.length,
        maxMagnitude: Number(maxMagnitude.toFixed(1)),
      },
    });
  } catch (error) {
    console.error('Intel overview error:', error);
    res.status(500).json({ message: 'Failed to fetch crisis overview' });
  }
};

const getSourceStatus = (_req, res) => {
  const weatherEnabled = Boolean(WEATHER_API_KEY);
  const newsEnabled = Boolean(NEWS_API_KEY);
  const geocodingEnabled = Boolean(GOOGLE_MAPS_API_KEY);
  const mode = weatherEnabled && newsEnabled && geocodingEnabled ? 'live' : 'partial';

  res.json({
    weatherEnabled,
    newsEnabled,
    geocodingEnabled,
    usgsFeedUrl: USGS_FEED_URL,
    mode,
  });
};

const getLocationReport = async (req, res) => {
  try {
    const label = req.query.label || req.params.label;
    const location = await resolveLocationContext({
      label,
      lat: req.query.lat,
      lng: req.query.lng,
    });

    const [earthquakes, weather, headlines] = await Promise.all([
      fetchEarthquakes(),
      fetchWeather(location.lat, location.lng),
      fetchCrisisNews(`"${location.city}"`, 5, {
        contextTerms: [location.city, label].filter(Boolean),
        sortBy: 'relevancy',
      }).catch(() => []),
    ]);

    const nearbyEarthquakes = earthquakes
      .map((quake) => ({
        ...quake,
        distanceKm: haversineKm(location.lat, location.lng, quake.position[0], quake.position[1]),
      }))
      .filter((quake) => quake.distanceKm <= 500)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const strongestMagnitude = nearbyEarthquakes[0]?.magnitude || 0;
    const windSpeedKmh = weather ? Number(weather.windSpeed.replace(/[^\d.-]/g, '')) : 0;
    const threatLevel = deriveThreatLevel({
      strongestMagnitude,
      nearbyEarthquakes: nearbyEarthquakes.length,
      headlinesCount: headlines.length,
      aqi: weather?.aqi || 50,
      windSpeedKmh,
    });
    const status = threatLevel >= 70 ? 'Critical' : threatLevel >= 40 ? 'Warning' : 'Stable';

    res.json({
      city: location.city,
      country: location.country,
      status,
      threatLevel,
      populationAtRisk: buildPopulationAtRisk(threatLevel, headlines.length),
      environmentalStatus: buildEnvironmentalStatus(location.city, weather, strongestMagnitude, nearbyEarthquakes.length),
      recentIncidents: buildRecentIncidents(nearbyEarthquakes, headlines),
      recommendation: buildRecommendation(status, weather, nearbyEarthquakes.length, headlines),
      weather: weather || {
        temperature: 'N/A',
        precipitation: '0 mm',
        windSpeed: '0 km/h',
        condition: 'Unavailable',
        aqi: 50,
      },
      coordinates: {
        lat: location.lat,
        lng: location.lng,
      },
      headlines,
      stats: {
        nearbyEarthquakes: nearbyEarthquakes.length,
        strongestMagnitude,
      },
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`,
    });
  } catch (error) {
    console.error('Location intel error:', error);
    res.status(500).json({ message: 'Failed to fetch location intelligence' });
  }
};

module.exports = {
  getOverview,
  getSourceStatus,
  getLocationReport,
};
