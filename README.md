# ReliefOS AI

Live disaster operations dashboard with:
- Live earthquake monitoring map (USGS feed)
- City-level risk/weather intel (OpenWeather + Google Geocoding)
- Crisis media stream (NewsAPI)
- SOS, resources, analytics, and AI assistant modules

## Run Locally

Prerequisites:
- Node.js 18+
- MongoDB (local or cloud)

1. Install frontend dependencies:
   `npm install`
2. Install backend dependencies:
   `npm --prefix backend install`
3. Create backend env:
   - copy `backend/.env.example` -> `backend/.env`
   - fill the API keys (see below)
4. Create frontend env:
   - copy `.env.example` -> `.env`
   - set `VITE_API_URL=http://localhost:5000/api`
5. Start backend:
   `npm --prefix backend run dev`
6. Start frontend:
   `npm run dev`

Frontend runs on `http://localhost:3000` and backend on `http://localhost:5000`.

## Deploy On Vercel

For the deployed auth flow to work, add these server-side environment variables in your Vercel project settings:
- `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_URL`

Recommended values:
- `MONGO_URI`: your MongoDB Atlas connection string
- `JWT_SECRET`: a long random secret used to sign auth tokens
- `CLIENT_URL`: your production site URL, for example `https://your-project.vercel.app`

Optional frontend env:
- `VITE_API_URL`
  Leave this unset when the frontend and API are deployed in the same Vercel project. The app will call `/api` on the current origin automatically.

## API Keys For Real Data

Add these in `backend/.env`:
- `WEATHER_API_KEY` (OpenWeather)
- `NEWS_API_KEY` (NewsAPI)
- `GOOGLE_MAPS_API_KEY` (Google Geocoding API enabled)
- `USGS_EARTHQUAKE_URL` (optional override, defaults to USGS all-day feed)

Notes:
- USGS is public and works without a key by default.
- Weather/news/geocoding will gracefully degrade if keys are missing.
- API keys stay on backend only, not in frontend env.

## New Intel Source Endpoint

`GET /api/intel/sources`

Returns source readiness:
- `weatherEnabled`
- `newsEnabled`
- `geocodingEnabled`
- `usgsFeedUrl`
- `mode` (`live` or `partial`)
