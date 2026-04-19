/**
 * Type definitions for the SCS CLI tool
 */

/**
 * Citation entry from citations.json
 */
export interface CitationEntry {
  tags: string[];
  logo: string;
  language: string[];
  category: string[];
  keywords: string[];
  description: string;
  link: string;
  zenodo_doi: string;
  attribution_link: string;
  custom_citation: string;
  dependencies: string[];
  feature_tags?: Array<Record<string, string[]>>;
  frequently_used?: boolean;
  pypi_name?: string;
  extra_bibtex?: string;
}

/**
 * Citations data structure (package name → metadata)
 */
export interface Citations {
  [packageName: string]: CitationEntry;
}

/**
 * Zenodo version information
 */
export interface ZenodoVersion {
  version: string;
  doi: string;
}

/**
 * Cached version data with timestamp
 */
export interface CachedVersionData {
  fetchedAt: string;
  versions: ZenodoVersion[];
}

/**
 * Parsed package input
 */
export interface ParsedPackage {
  name: string;
  version?: string;
  features?: string[];
}

/**
 * Package selection with resolved Zenodo information
 */
export interface SelectedPackage extends ParsedPackage {
  zenodoBibtex?: string;
  zenodoTag?: string;
}

/**
 * Citation output structure
 */
export interface CitationOutput {
  packages: string[];
  timestamp: string;
  dependencies: Record<string, string[]>;
  acknowledgments: string;
  bibtex: string;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  cacheDir: string;
  websiteRefreshHourUtc: number;
}
