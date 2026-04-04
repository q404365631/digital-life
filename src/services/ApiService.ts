import * as http from 'http';
import * as https from 'https';
import * as vscode from 'vscode';
import { RealWeather, ISSData, NEOData } from '../types';

/** HTTPS GET with redirect support (Node.js — no fetch API) */
function httpsGetJson(url: string, maxRedirects = 3): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      // Follow redirects (301, 302, 307, 308)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) { reject(new Error('Too many redirects')); return; }
        httpsGetJson(res.headers.location, maxRedirects - 1).then(resolve, reject);
        return;
      }
      let body = '';
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(`Invalid JSON from ${url}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/** HTTP GET with JSON parsing (for APIs that don't support HTTPS) */
function httpGetJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(`Invalid JSON from ${url}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/** Get fallback coordinates from VS Code locale */
function getFallbackCoords(): { lat: string; lon: string } {
  const lang = vscode.env.language;
  if (lang.startsWith('ja')) return { lat: '35.68', lon: '139.69' }; // Tokyo
  if (lang.startsWith('ko')) return { lat: '37.57', lon: '126.98' }; // Seoul
  if (lang.startsWith('zh')) return { lat: '31.23', lon: '121.47' }; // Shanghai
  return { lat: '37.77', lon: '-122.42' }; // San Francisco (default)
}

const CAT_FACTS_FALLBACK = [
  '\uD83D\uDC31 Cats sleep 12-16 hours a day',
  '\uD83D\uDC31 A group of cats is called a clowder',
  '\uD83D\uDC31 Cats have over 20 vocalizations',
  '\uD83D\uDC31 A cat\'s purr vibrates at 25-150 Hz',
  '\uD83D\uDC31 Cats can rotate their ears 180\u00B0',
  '\uD83D\uDC31 Cats spend 30-50% of their day grooming',
  '\uD83D\uDC31 A cat can jump up to 6x its length',
  '\uD83D\uDC31 Cats have 230 bones (humans have 206)',
  '\uD83D\uDC31 The oldest known cat lived to 38 years',
  '\uD83D\uDC31 Cats can\'t taste sweetness',
  '\uD83D\uDC31 A cat\'s nose print is unique like a fingerprint',
  '\uD83D\uDC31 Cats have 3 eyelids',
  '\uD83D\uDC31 A cat\'s brain is 90% similar to a human\'s',
  '\uD83D\uDC31 Cats can hear ultrasonic sounds',
  '\uD83D\uDC31 Nikola Tesla was inspired to study electricity by his cat',
  '\uD83D\uDC31 The first cat in space was French, named F\u00E9licette',
  '\uD83D\uDC31 Cats can dream just like humans',
  '\uD83D\uDC31 A cat\'s whiskers are as wide as its body',
  '\uD83D\uDC31 Ancient Egyptians shaved their eyebrows when their cat died',
  '\uD83D\uDC31 Cats can run up to 48 km/h',
];
// Japanese cat facts for ja locale
const CAT_FACTS_JA = [
  '\uD83D\uDC31 \u732B\u306F1\u65E512\u301C16\u6642\u9593\u5BDD\u308B',
  '\uD83D\uDC31 \u732B\u306E\u96C6\u56E3\u306F\u300C\u30AF\u30E9\u30A6\u30C0\u30FC\u300D\u3068\u547C\u3070\u308C\u308B',
  '\uD83D\uDC31 \u732B\u306F20\u7A2E\u985E\u4EE5\u4E0A\u306E\u9CE3\u304D\u58F0\u3092\u4F7F\u3044\u5206\u3051\u308B',
  '\uD83D\uDC31 \u732B\u306E\u30B4\u30ED\u30B4\u30ED\u306F25\u301C150Hz\u3067\u632F\u52D5\u3059\u308B',
  '\uD83D\uDC31 \u732B\u306F\u8033\u3092180\u00B0\u56DE\u8EE2\u3067\u304D\u308B',
  '\uD83D\uDC31 \u732B\u306F1\u65E5\u306E30\u301C50%\u3092\u6BDB\u3065\u304F\u308D\u3044\u306B\u4F7F\u3046',
  '\uD83D\uDC31 \u732B\u306F\u4F53\u9577\u306E6\u500D\u30B8\u30E3\u30F3\u30D7\u3067\u304D\u308B',
  '\uD83D\uDC31 \u732B\u306E\u9AA8\u306F230\u672C\uFF08\u4EBA\u9593\u306F206\u672C\uFF09',
  '\uD83D\uDC31 \u6700\u9577\u5BFF\u306E\u732B\u306F38\u6B73\u307E\u3067\u751F\u304D\u305F',
  '\uD83D\uDC31 \u732B\u306F\u7518\u5473\u3092\u611F\u3058\u3089\u308C\u306A\u3044',
  '\uD83D\uDC31 \u732B\u306E\u9F3B\u7D0B\u306F\u6307\u7D0B\u306E\u3088\u3046\u306B\u4E00\u5339\u4E00\u5339\u9055\u3046',
  '\uD83D\uDC31 \u732B\u306B\u306F\u307E\u3076\u305F\u304C3\u3064\u3042\u308B',
  '\uD83D\uDC31 \u732B\u306E\u8133\u306F\u4EBA\u9593\u306E\u8133\u306890%\u985E\u4F3C\u3057\u3066\u3044\u308B',
  '\uD83D\uDC31 \u732B\u306F\u8D85\u97F3\u6CE2\u3092\u805E\u304D\u53D6\u308C\u308B',
  '\uD83D\uDC31 \u30C6\u30B9\u30E9\u306F\u98FC\u3044\u732B\u306B\u89E6\u767A\u3055\u308C\u3066\u96FB\u6C17\u306E\u7814\u7A76\u3092\u59CB\u3081\u305F',
  '\uD83D\uDC31 \u5B87\u5B99\u306B\u884C\u3063\u305F\u6700\u521D\u306E\u732B\u306F\u30D5\u30E9\u30F3\u30B9\u306E\u30D5\u30A7\u30EA\u30BB\u30C3\u30C8',
  '\uD83D\uDC31 \u732B\u3082\u4EBA\u9593\u3068\u540C\u3058\u3088\u3046\u306B\u5922\u3092\u898B\u308B',
  '\uD83D\uDC31 \u732B\u306E\u30D2\u30B2\u306E\u5E45\u306F\u4F53\u306E\u5E45\u3068\u307B\u307C\u540C\u3058',
  '\uD83D\uDC31 \u53E4\u4EE3\u30A8\u30B8\u30D7\u30C8\u3067\u306F\u732B\u304C\u6B7B\u306C\u3068\u98FC\u3044\u4E3B\u306F\u7709\u3092\u5243\u3063\u305F',
  '\uD83D\uDC31 \u732B\u306F\u6642\u901F48km\u3067\u8D70\u308C\u308B',
];

export class ApiService {
  private readonly outputChannel: vscode.OutputChannel;
  private userLat = 0;
  private userLon = 0;
  private catFactCache: string[] = [];

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /** Fetch geo-location from ipinfo.io, caching the result. Falls back to locale-based coords. */
  async fetchGeoLocation(): Promise<{ lat: number; lon: number }> {
    if (this.userLat !== 0 || this.userLon !== 0) {
      return { lat: this.userLat, lon: this.userLon };
    }

    try {
      const geo = await httpsGetJson('https://ipinfo.io/json') as { loc?: string };
      if (geo.loc) {
        [this.userLat, this.userLon] = geo.loc.split(',').map(Number);
      } else {
        const fb = getFallbackCoords();
        this.userLat = Number(fb.lat);
        this.userLon = Number(fb.lon);
      }
    } catch (geoErr) {
      this.outputChannel.appendLine(`[Digital Life] Geo lookup failed: ${geoErr}, using fallback`);
      const fb = getFallbackCoords();
      this.userLat = Number(fb.lat);
      this.userLon = Number(fb.lon);
    }

    return { lat: this.userLat, lon: this.userLon };
  }

  async fetchRealWeather(): Promise<RealWeather | null> {
    try {
      // Try to get location from ipinfo.io, fall back to locale-based coords
      let lat: string;
      let lon: string;
      try {
        const geo = await httpsGetJson('https://ipinfo.io/json') as { loc?: string };
        if (geo.loc) {
          [lat, lon] = geo.loc.split(',');
        } else {
          const fb = getFallbackCoords();
          lat = fb.lat; lon = fb.lon;
        }
      } catch (geoErr) {
        this.outputChannel.appendLine(`[Digital Life] Geo lookup failed: ${geoErr}, using fallback`);
        const fb = getFallbackCoords();
        lat = fb.lat; lon = fb.lon;
      }

      // Fetch current weather from Open-Meteo
      const data = await httpsGetJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
      ) as { current_weather?: { weathercode: number } };
      const code = data.current_weather?.weathercode ?? -1;

      // WMO weather codes -> our simplified weather types
      let rw: RealWeather;
      if (code <= 1) rw = 'clear';
      else if (code <= 3) rw = 'cloudy';
      else if (code <= 49) rw = 'fog';
      else if (code <= 69) rw = 'rain';
      else if (code <= 79) rw = 'snow';
      else if (code <= 99) rw = 'rain'; // thunderstorm -> rain
      else rw = null;

      this.outputChannel.appendLine(`[Digital Life] Real weather: ${rw} (code ${code}, lat=${lat}, lon=${lon})`);
      return rw;
    } catch (err) {
      this.outputChannel.appendLine(`[Digital Life] Weather fetch failed: ${err}`);
      return null;
    }
  }

  async fetchISSLocation(): Promise<ISSData | null> {
    try {
      // Get user location if not cached
      const { lat: uLat, lon: uLon } = await this.fetchGeoLocation();

      const data = await httpGetJson('http://api.open-notify.org/iss-now.json') as {
        iss_position?: { latitude: string; longitude: string };
      };

      if (data.iss_position) {
        const issLat = Number(data.iss_position.latitude);
        const issLon = Number(data.iss_position.longitude);

        // Check if ISS is within ~20 degrees of user (roughly overhead region)
        const dLat = Math.abs(issLat - uLat);
        const dLon = Math.abs(issLon - uLon);
        const visible = dLat < 20 && dLon < 20;

        if (visible) {
          this.outputChannel.appendLine(`[Digital Life] ISS overhead! lat=${issLat}, lon=${issLon}`);
        }
        return { visible, lat: issLat, lon: issLon };
      }
      return null;
    } catch (err) {
      this.outputChannel.appendLine(`[Digital Life] ISS fetch failed: ${err}`);
      return null;
    }
  }

  async fetchNEOData(): Promise<NEOData | null> {
    try {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const data = await httpsGetJson(
        `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=DEMO_KEY`
      ) as { element_count?: number };

      const count = data.element_count ?? 0;
      this.outputChannel.appendLine(`[Digital Life] NEO: ${count} near-Earth asteroids today`);
      return { count };
    } catch (err) {
      this.outputChannel.appendLine(`[Digital Life] NEO fetch failed: ${err}`);
      return null;
    }
  }

  async fetchCatFact(speechLang: string): Promise<string | null> {
    // Try to fetch from API, fall back to local facts
    try {
      if (this.catFactCache.length === 0) {
        const data = await httpsGetJson('https://catfact.ninja/facts?limit=10') as {
          data?: { fact: string }[];
        };
        if (data.data && data.data.length > 0) {
          this.catFactCache = data.data.map(d => `\uD83D\uDC31 ${d.fact}`);
        }
      }
    } catch {
      // API failed, use fallback
    }

    let fact: string;
    if (this.catFactCache.length > 0) {
      fact = this.catFactCache.pop()!;
    } else {
      // Use locale-appropriate fallback
      const facts = speechLang === 'ja' ? CAT_FACTS_JA : CAT_FACTS_FALLBACK;
      fact = facts[Math.floor(Math.random() * facts.length)];
    }

    // Truncate long facts for speech bubble
    if (fact.length > 60) {
      fact = fact.slice(0, 57) + '...';
    }

    return fact;
  }
}
