const fetch = require('node-fetch');

const KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
let cachedKevSet = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch the CISA KEV catalog and return a Set of CVE IDs.
 * Results are cached for 24 hours.
 *
 * @returns {Promise<Set<string>>} Set of CVE IDs on the KEV list
 */
async function getKevSet() {
  const now = Date.now();
  if (cachedKevSet && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedKevSet;
  }

  try {
    const response = await fetch(KEV_URL);
    if (!response.ok) {
      console.warn(`KEV catalog fetch failed: ${response.status}`);
      return cachedKevSet || new Set();
    }
    const data = await response.json();
    const cves = (data.vulnerabilities || []).map(v => v.cveID);
    cachedKevSet = new Set(cves);
    cacheTimestamp = now;
    return cachedKevSet;
  } catch (err) {
    console.warn(`KEV catalog fetch error: ${err.message}`);
    return cachedKevSet || new Set();
  }
}

/**
 * For testing: inject a pre-built KEV set instead of fetching.
 * @param {Set<string>} kevSet
 */
function setKevCache(kevSet) {
  cachedKevSet = kevSet;
  cacheTimestamp = Date.now();
}

module.exports = { getKevSet, setKevCache };
