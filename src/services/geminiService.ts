import { fetchLocationIntel, LocationIntelReport } from './api';

export interface CityReport extends LocationIntelReport {}

export async function generateCityReport(
  cityName: string,
  coordinates?: [number, number]
): Promise<CityReport> {
  try {
    const reportData = await fetchLocationIntel({
      label: cityName,
      lat: coordinates?.[0],
      lng: coordinates?.[1],
    });
    return reportData as CityReport;
  } catch (error) {
    console.error('Failed to fetch city report from backend:', error);
    return {
      city: cityName,
      country: 'Unknown',
      status: 'Stable',
      threatLevel: 10,
      populationAtRisk: 'Telemetry unavailable',
      environmentalStatus: 'Live intelligence feed is temporarily unavailable.',
      recentIncidents: ['No live incident data could be retrieved.'],
      recommendation: 'Retry the live feed and verify backend connectivity.',
      weather: {
        temperature: 'N/A',
        precipitation: '0 mm',
        windSpeed: '0 km/h',
        condition: 'Unavailable',
        aqi: 50,
      },
      coordinates: {
        lat: coordinates?.[0] || 0,
        lng: coordinates?.[1] || 0,
      },
      headlines: [],
      stats: {
        nearbyEarthquakes: 0,
        strongestMagnitude: 0,
      },
      mapUrl: 'https://www.google.com/maps',
    };
  }
}
