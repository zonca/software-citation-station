/**
 * Data fetcher for SCS CLI
 * Fetches citations.json and bibtex.bib from the live website
 * Caches to ~/.cache/scs/ with daily refresh after 6 AM UTC
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Citations, ZenodoVersion } from './types.js';

const CACHE_DIR = path.join(os.homedir(), '.cache', 'scs');
const WEBSITE_BASE_URL = 'https://www.tomwagg.com/software-citation-station';
const WEBSITE_REFRESH_HOUR_UTC = 6;

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  const zenodoDir = path.join(CACHE_DIR, 'zenodo-versions');
  if (!fs.existsSync(zenodoDir)) {
    fs.mkdirSync(zenodoDir, { recursive: true });
  }
}

/**
 * Get path to cached file
 */
function getCachePath(filename: string): string {
  return path.join(CACHE_DIR, filename);
}

/**
 * Get path to cached Zenodo version file
 */
function getZenodoCachePath(packageName: string): string {
  return path.join(CACHE_DIR, 'zenodo-versions', `${packageName}.json`);
}

/**
 * Check if cache should be refreshed based on daily schedule (after 6 AM UTC)
 */
function shouldRefreshCache(fetchedAt: string): boolean {
  const fetched = new Date(fetchedAt);
  const now = new Date();
  
  // Convert to UTC date string (YYYY-MM-DD)
  const fetchedDate = fetched.toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  
  // If same UTC day and fetched after refresh time, don't refresh
  if (fetchedDate === today && fetched.getUTCHours() >= WEBSITE_REFRESH_HOUR_UTC) {
    return false;
  }
  
  // Different day or fetched before refresh time, check if we're past refresh time today
  return now.getUTCHours() >= WEBSITE_REFRESH_HOUR_UTC;
}

/**
 * Read cached file if it exists and is fresh
 */
function readCachedFile(filename: string): string | null {
  const cachePath = getCachePath(filename);
  
  if (!fs.existsSync(cachePath)) {
    return null;
  }
  
  // For JSON files, check freshness
  if (filename.endsWith('.json')) {
    try {
      const content = fs.readFileSync(cachePath, 'utf-8');
      const data = JSON.parse(content);
      
      if (data.fetchedAt && shouldRefreshCache(data.fetchedAt)) {
        return null; // Cache is stale
      }
      
      return content;
    } catch {
      return null; // Invalid JSON, treat as cache miss
    }
  }
  
  return fs.readFileSync(cachePath, 'utf-8');
}

/**
 * Write content to cache file
 */
function writeCachedFile(filename: string, content: string): void {
  ensureCacheDir();
  const cachePath = getCachePath(filename);
  fs.writeFileSync(cachePath, content, 'utf-8');
}

/**
 * Write JSON data to cache with timestamp
 */
function writeJsonCache(filename: string, data: Record<string, unknown>): void {
  const cacheData: Record<string, unknown> = {
    fetchedAt: new Date().toISOString(),
    ...data
  };
  writeCachedFile(filename, JSON.stringify(cacheData, null, 2));
}

/**
 * Fetch citations.json from website or cache
 */
export async function fetchCitations(refreshCache = false): Promise<Citations> {
  ensureCacheDir();
  
  if (!refreshCache) {
    const cached = readCachedFile('citations.json');
    if (cached) {
      return JSON.parse(cached) as Citations;
    }
  }
  
  // Fetch from website
  const url = `${WEBSITE_BASE_URL}/data/citations.json`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch citations.json: HTTP ${response.status}`);
  }
  
  const data = await response.json() as Citations;
  writeCachedFile('citations.json', JSON.stringify(data, null, 2));
  
  return data;
}

/**
 * Fetch bibtex.bib from website or cache
 */
export async function fetchBibtex(refreshCache = false): Promise<string> {
  ensureCacheDir();
  
  if (!refreshCache) {
    const cached = readCachedFile('bibtex.bib');
    if (cached) {
      return cached;
    }
  }
  
  // Fetch from website
  const url = `${WEBSITE_BASE_URL}/data/bibtex.bib`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch bibtex.bib: HTTP ${response.status}`);
  }
  
  const data = await response.text();
  writeCachedFile('bibtex.bib', data);
  
  return data;
}

/**
 * Read cached Zenodo version data
 */
export function readCachedZenodoVersions(packageName: string): { versions: ZenodoVersion[]; fetchedAt: string } | null {
  const cachePath = getZenodoCachePath(packageName);
  
  if (!fs.existsSync(cachePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(cachePath, 'utf-8');
    const data = JSON.parse(content) as { fetchedAt: string; versions: ZenodoVersion[] };
    
    if (data.fetchedAt && shouldRefreshCache(data.fetchedAt)) {
      return null; // Cache is stale
    }
    
    return data;
  } catch {
    return null;
  }
}

/**
 * Write Zenodo version data to cache
 */
export function writeCachedZenodoVersions(packageName: string, versions: ZenodoVersion[]): void {
  ensureCacheDir();
  writeJsonCache(`zenodo-versions/${packageName}.json`, { versions });
}

/**
 * Force refresh all cached data
 */
export async function refreshAllCache(): Promise<void> {
  await fetchCitations(true);
  await fetchBibtex(true);
  // Note: Zenodo versions are refreshed on-demand per package
}
