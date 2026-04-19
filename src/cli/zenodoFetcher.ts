/**
 * Zenodo fetcher for SCS CLI
 * Fetches version lists and BibTeX from Zenodo API
 * Uses citationCore.js for core logic, adds caching
 */

/// <reference path="../citationCore.d.ts" />

import { readCachedZenodoVersions, writeCachedZenodoVersions } from './dataFetcher.js';
import { ZenodoVersion } from './types.js';

// Import core functions from citationCore.js
// We need to use dynamic import for ES modules from TypeScript
let citationCore: any = null;

async function getCitationCore() {
  if (!citationCore) {
    // @ts-expect-error - dynamic import of JS module
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    citationCore = await import('../js/citationCore.js');
  }
  return citationCore;
}

/**
 * Fetch version list from Zenodo API with caching
 * @param packageName - Package name for cache key
 * @param conceptDoi - Zenodo concept DOI
 * @param refreshCache - Force refresh cache
 */
export async function getZenodoVersionInfoCached(
  packageName: string,
  conceptDoi: string,
  refreshCache = false
): Promise<ZenodoVersion[]> {
  if (!refreshCache) {
    const cached = readCachedZenodoVersions(packageName);
    if (cached) {
      return cached.versions;
    }
  }
  
  // Fetch from Zenodo API using core function
  const core = await getCitationCore();
  const versions = await core.getZenodoVersionInfo(conceptDoi);
  
  // Cache the results
  writeCachedZenodoVersions(packageName, versions);
  
  return versions;
}

/**
 * Fetch BibTeX from Zenodo API for a specific record
 * This is NOT cached - always fetches live like the website
 * @param recordId - Zenodo record ID
 */
export async function fetchZenodoBibtexLive(recordId: string): Promise<string> {
  const core = await getCitationCore();
  const bibtex = await core.fetchZenodoBibtex(recordId);
  
  // Replace the tag with package_version format
  // The core function returns raw BibTeX, we need to update the tag
  return bibtex;
}

/**
 * Find the record DOI for a specific version
 * @param versions - List of available versions
 * @param version - Version string to find
 */
export function findVersionDoi(versions: ZenodoVersion[], version: string): string | null {
  for (const v of versions) {
    // Try exact match first
    if (v.version === version) {
      return v.doi;
    }
    // Try with 'v' prefix (common variation)
    if (v.version === `v${version}` || `v${v.version}` === version) {
      return v.doi;
    }
  }
  return null;
}

/**
 * Get version-specific BibTeX for a package
 * @param packageName - Package name
 * @param conceptDoi - Zenodo concept DOI
 * @param version - Specific version requested
 * @param refreshCache - Force refresh cache
 */
export async function getVersionSpecificBibtex(
  packageName: string,
  conceptDoi: string,
  version: string,
  refreshCache = false
): Promise<{ bibtex: string; tag: string } | null> {
  // Get version list
  const versions = await getZenodoVersionInfoCached(packageName, conceptDoi, refreshCache);
  
  // Find the record DOI for the requested version
  const recordDoi = findVersionDoi(versions, version);
  if (!recordDoi) {
    return null;
  }
  
  // Fetch BibTeX
  let bibtex = await fetchZenodoBibtexLive(recordDoi);
  
  // Replace the tag with package_version format
  const newTag = `${packageName}_${version}`;
  const bibtexRe = /@\w*{(?<tag>.*)(?=\,)/gmi;
  bibtex = bibtex.replace(bibtexRe, `@software{${newTag}`);
  
  return { bibtex, tag: newTag };
}
