# SCS CLI Tool Implementation Plan

**Date:** 2026-04-19  
**Author:** @zonca

---

## Overview

Create a TypeScript CLI tool `scs` (Software Citation Station) with two subcommands:

- **`scs cite [packages...]`** - Generate citations for software packages with Zenodo version fetching
- **`scs show <package>`** - Display detailed package information

### Key Principles

1. **Zero code duplication** - Extract all core logic from `software.js` to `citationCore.js`
2. **Shared core functions** - Both website and CLI use the same core logic
3. **Cache strategy** - Daily refresh after 6 AM UTC (aligned with website's GitHub Actions schedule)
4. **Cache location** - `~/.cache/scs/` (XDG Base Directory specification)
5. **No Zenodo calls for base data** - Fetch from live website, cache locally
6. **Zenodo for versions** - Call Zenodo API for version-specific BibTeX (like the website)

---

## Background

### What Comes From Where

| Data | Source | Example |
|------|--------|---------|
| Package metadata | `citations.json` (website) | name, description, dependencies, zenodo_doi |
| Base BibTeX | `bibtex.bib` (website) | `@article{numpy, ...}` (non-versioned) |
| Feature tags | `citations.json` (website) | `"fitting"` → `["astropy:2022"]` |
| Version list | **Zenodo API** | `["6.0.1", "6.0.0", "5.3.4", ...]` |
| Version-specific BibTeX | **Zenodo API** | `@software{astropy_6.0.1, version={6.0.1}, ...}` |

### Website Refresh Schedule

The website refreshes Zenodo version data **daily at 6:00 AM UTC** via GitHub Actions (`.github/workflows/fetch-zenodo-versions.yml`).

### Cache Strategy

- **Base data** (`citations.json`, `bibtex.bib`): Refresh daily after 6 AM UTC
- **Zenodo version lists**: Refresh daily after 6 AM UTC
- **Zenodo BibTeX**: Fetch live every time (like the website)
- **`--refresh-cache` flag**: Force refresh all cached data

---

## Commit Structure (12 Commits)

### Phase 1: Extract Core Logic (Vanilla JS)

#### Commit 1: Extract `citationCore.js` verbatim

**File:** `js/citationCore.js`

Copy functions exactly as they exist in `software.js`:

- `parseBibtex(bibtexText)` - Parse BibTeX string into tag→entry map
- `collectDependencies(depSet, packageKey)` - Recursive dependency resolution
- `fetchZenodoBibtex(doi)` - Fetch BibTeX from Zenodo API
- `getZenodoVersionInfo(conceptDoi)` - Fetch version list from Zenodo API
- `parseFeatureTags(arr)` - Convert feature_tags array to lookup object
- `parsePackageInput(line)` - Parse package name and version (from `parse_pip_freeze`)

**Goal:** Create the file with minimal changes, just adapting to module exports.

---

#### Commit 2: Refactor `citationCore.js` - Isolate from UI

**Changes:**

- Refactor functions to accept data as parameters (not read from DOM):
  - `collectDependencies(depSet, packageKey, citationsData)`
  - `generateAcknowledgment(selectedPackages, citationsData, bibtexTable, featureSelections, zenodoBibtexMap)`
  - `generateBibtex(selectedPackages, citationsData, bibtexTable, featureSelections, zenodoBibtexMap)`
  - `parsePackageInput(packageString)` - Parse `pkg`, `pkg==version`, `pkg[feat1,feat2]`
- Add JSDoc comments to all exported functions
- Export all functions as ES modules

**New Functions:**

- `generateAcknowledgment()` - Build LaTeX acknowledgment string (extracted from click handler)
- `generateBibtex()` - Collect and format BibTeX entries (extracted from click handler)

---

#### Commit 3: Update `software.js` to use `citationCore.js`

**Changes:**

- Import functions from `citationCore.js`
- Refactor click handler to call extracted functions
- Keep only DOM manipulation in `software.js`

**Goal:** Website continues to work, now using shared core logic.

---

### Phase 2: CLI Infrastructure (TypeScript)

#### Commit 4: Add CLI Dependencies

**File:** `package.json`

```json
{
  "dependencies": {
    "commander": "^11.x"
  },
  "bin": {
    "scs": "./dist/cli/index.js"
  },
  "scripts": {
    "scs": "node dist/cli/index.js"
  }
}
```

---

#### Commit 5: Implement `dataFetcher.ts`

**File:** `src/cli/dataFetcher.ts`

**Functions:**

- `getCacheDir()` - Return `~/.cache/scs/`
- `getCachedDataPath(filename)` - Return path to cached file
- `shouldRefreshCache(fetchedAt: string)` - Check if daily refresh needed (after 6 AM UTC)
- `fetchCitations()` - Fetch from website or return cached
- `fetchBibtex()` - Fetch from website or return cached
- `refreshCache()` - Force refresh all cached data

**Cache Logic:**

```typescript
function shouldRefreshCache(fetchedAt: string): boolean {
  const WEBSITE_REFRESH_HOUR_UTC = 6;
  const fetched = new Date(fetchedAt);
  const now = new Date();
  
  // Same UTC day and fetched after refresh time → don't refresh
  const fetchedDate = fetched.toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  
  if (fetchedDate === today && fetched.getUTCHours() >= WEBSITE_REFRESH_HOUR_UTC) {
    return false; // Fresh enough
  }
  
  // Different day and past refresh time → refresh
  return now.getUTCHours() >= WEBSITE_REFRESH_HOUR_UTC;
}
```

---

#### Commit 6: Implement `zenodoFetcher.ts`

**File:** `src/cli/zenodoFetcher.ts`

**Functions:**

- `getZenodoVersionInfoCached(packageName: string, conceptDoi: string)` - Fetch/cached version list
- `fetchZenodoBibtexLive(recordId: string)` - Fetch BibTeX live (no cache)
- `getVersionDoi(packageName: string, version: string)` - Find DOI for specific version

**Cache Structure:**

```json
{
  "fetchedAt": "2026-04-19T07:30:00Z",
  "versions": [
    {"version": "6.0.1", "doi": "12345678"},
    {"version": "6.0.0", "doi": "12345677"}
  ]
}
```

---

#### Commit 7: Implement `types.ts`

**File:** `src/cli/types.ts`

```typescript
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
}

export interface Citations {
  [packageName: string]: CitationEntry;
}

export interface ZenodoVersion {
  version: string;
  doi: string;
}

export interface CachedVersionData {
  fetchedAt: string;
  versions: ZenodoVersion[];
}

export interface ParsedPackage {
  name: string;
  version?: string;
  features?: string[];
}

export interface CitationOutput {
  packages: string[];
  timestamp: string;
  dependencies: Record<string, string[]>;
  acknowledgments: string;
  bibtex: string;
}
```

---

### Phase 3: CLI Commands

#### Commit 8: Implement `cite.ts`

**File:** `src/cli/commands/cite.ts`

**Command:**

```bash
scs cite [options] [packages...]

Options:
  -d, --dependencies-only    Output only resolved dependencies
  -a, --acknowledgments      Output only LaTeX acknowledgments
  -b, --bibtex              Output only BibTeX entries
  -j, --json                Output as JSON
  -f, --features <features> Comma-separated features (applies to all packages)
  --refresh-cache           Force refresh all cached data
  --help                    Show help
```

**Logic Flow:**

1. Parse package inputs (`numpy`, `scipy==1.17.1`, `astropy[fitting,io]`)
2. Fetch/cached citations data
3. For each package:
   - Resolve dependencies recursively
   - If version specified and package has zenodo_doi:
     - Fetch version list from Zenodo (or cache)
     - Find record DOI for specified version
     - Fetch BibTeX from Zenodo API (live)
   - If features specified:
     - Get feature tags from citations.json
4. Generate output using `generateAcknowledgment()` and `generateBibtex()` from citationCore
5. Format and print output (or JSON)

**Error Handling:**

- Unknown package: Warn and continue
- Version not found: Warn and use base citation
- Network error: Use cached data if available, otherwise error

---

#### Commit 9: Implement `show.ts`

**File:** `src/cli/commands/show.ts`

**Command:**

```bash
scs show <package>

Options:
  --refresh-cache    Force refresh cached data
  --help             Show help
```

**Output:**

```
Package: astropy
Description: The astropy package contains key functionality and common tools...
Category: general
Language: Python
Dependencies: numpy, scipy, matplotlib, python
Tags: astropy:2013, astropy:2018, astropy:2022
Link: https://docs.astropy.org/en/stable/
Attribution: https://www.astropy.org/acknowledging.html
Zenodo DOI: 10.5281/zenodo.4670728
Available Versions: 6.0.1, 6.0.0, 5.3.4, ...
```

---

#### Commit 10: Implement `index.ts`

**File:** `src/cli/index.ts`

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { citeCommand } from './commands/cite.js';
import { showCommand } from './commands/show.js';
import { version } from '../package.json';

const program = new Command();

program
  .name('scs')
  .description('Software Citation Station CLI')
  .version(version);

program.addCommand(citeCommand);
program.addCommand(showCommand);

program.parse();
```

---

### Phase 4: Testing

#### Commit 11: Add `citationCore.test.js`

**File:** `__tests__/citationCore.test.js`

**Test Cases:**

- `parseBibtex()` - Parse various BibTeX formats
- `collectDependencies()` - Recursive dependency resolution
- `generateAcknowledgment()` - LaTeX output formatting
- `generateBibtex()` - BibTeX collection
- `parseFeatureTags()` - Feature tag parsing
- `parsePackageInput()` - Package string parsing

---

#### Commit 12: Add CLI Tests

**Files:**

- `__tests__/cli/cite.test.ts` - Test cite command logic
- `__tests__/cli/show.test.ts` - Test show command
- `__tests__/cli/dataFetcher.test.ts` - Test caching logic
- `__tests__/cli/zenodoFetcher.test.ts` - Test Zenodo wrapper (mocked)

**Test Commands:**

```bash
npm test           # Run all tests
npm test -- core   # Run citationCore tests only
npm test -- cli    # Run CLI tests only
```

---

## File Structure

```
software-citation-station/
├── js/
│   ├── software.js              # Updated to import from citationCore
│   └── citationCore.js          # NEW: Extracted core functions
├── src/
│   └── cli/
│       ├── index.ts             # Entry point
│       ├── types.ts             # Type definitions
│       ├── dataFetcher.ts       # Fetch/cache from website
│       ├── zenodoFetcher.ts     # Zenodo API wrapper
│       └── commands/
│           ├── cite.ts          # cite subcommand
│           └── show.ts          # show subcommand
├── __tests__/
│   ├── citationCore.test.js     # Core function tests
│   └── cli/
│       ├── cite.test.ts
│       ├── show.test.ts
│       ├── dataFetcher.test.ts
│       └── zenodoFetcher.test.ts
├── notes/
│   └── 2026-04-19-scs-cli-tool.md  # This plan
└── package.json                 # Updated with commander + bin
```

---

## Command Reference

### Cite Command

```bash
# Basic usage
scs cite numpy scipy
scs cite astropy==6.0.1
scs cite astropy[fitting,io]
scs cite astropy==6.0.1[fitting]

# Output options
scs cite numpy --dependencies-only
scs cite numpy --acknowledgments
scs cite numpy --bibtex
scs cite numpy --json

# With features
scs cite astropy --features fitting,io

# Cache management
scs cite numpy --refresh-cache
```

### Show Command

```bash
scs show astropy
scs show numpy --refresh-cache
```

### Help

```bash
scs --help
scs cite --help
scs show --help
```

---

## Cache Structure

```
~/.cache/scs/
├── citations.json          # Refreshed daily after 6 AM UTC
├── bibtex.bib              # Refreshed daily after 6 AM UTC
└── zenodo-versions/
    ├── astropy.json        # {fetchedAt, versions: [{version, doi}]}
    ├── scipy.json
    └── ...                 # Refreshed daily after 6 AM UTC
```

---

## Duplication Summary

| Function | Location | Used By |
|----------|----------|---------|
| `parseBibtex` | `citationCore.js` | Website + CLI |
| `collectDependencies` | `citationCore.js` | Website + CLI |
| `generateAcknowledgment` | `citationCore.js` | Website + CLI |
| `generateBibtex` | `citationCore.js` | Website + CLI |
| `fetchZenodoBibtex` | `citationCore.js` | Website + CLI |
| `getZenodoVersionInfo` | `citationCore.js` | Website + CLI |
| `parseFeatureTags` | `citationCore.js` | Website + CLI |
| Cache logic | `dataFetcher.ts` | CLI only |
| DOM rendering | `software.js` | Website only |
| CLI output formatting | `cite.ts` | CLI only |

**Result:** Zero duplication of core logic. All shared functions in `citationCore.js`.

---

## Success Criteria

1. ✅ All 12 commits completed
2. ✅ Zero code duplication between website and CLI
3. ✅ All tests passing
4. ✅ CLI works offline with cached data
5. ✅ Cache refreshes daily after 6 AM UTC
6. ✅ Both `cite` and `show` commands functional
7. ✅ JSON output available for programmatic use
8. ✅ Website continues to work unchanged

---

## Future Enhancements (Out of Scope)

- Export to other citation formats (APA, MLA, Chicago)
- Integration with reference managers (Zotero, Mendeley)
- Batch processing from requirements.txt
- Plugin architecture for custom data sources
