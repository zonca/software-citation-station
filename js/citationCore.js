// citationCore.js - Core functions for software citation
// These functions are shared between the website (software.js) and the CLI tool

// Regular expressions for parsing
const BIBTEX_RE = /@\w*{(?<tag>.*)(?=\,)/gmi;
const LATEX_RE = /(?<command>\\[^\\{]*)\{(?<args>[^\}]*)\}/gmi;

/**
 * Parse a BibTeX string into a dictionary of tags and entries.
 * @param {string} bibtexText - The raw BibTeX text to parse.
 * @returns {Object} A dictionary mapping tags to their full BibTeX entries.
 */
function parseBibtex(bibtexText) {
    let bibtexObj = {};
    let match;
    while ((match = BIBTEX_RE.exec(bibtexText)) != null) {
        bibtexObj[match.groups["tag"]] = isolateBibtexEntry(bibtexText, match.index);
    }
    return bibtexObj;
}

/**
 * Isolate a single BibTeX entry from the text based on closing curly braces.
 * @param {string} s - The full BibTeX text.
 * @param {number} start - The starting index of the entry.
 * @returns {string} The isolated BibTeX entry.
 */
function isolateBibtexEntry(s, start) {
    let braces = 0;
    let cursor = start;
    let notOpened = true;
    while (braces > 0 || notOpened) {
        if (s[cursor] == "{") {
            braces += 1;
            notOpened = false;
        } else if (s[cursor] == "}") {
            braces -= 1;
        }
        cursor += 1;
    }
    return s.slice(start, cursor);
}

/**
 * Recursively collect all dependencies for a given package.
 * @param {Set} depSet - A set to accumulate dependency names (passed by reference).
 * @param {string} packageKey - The package name to resolve dependencies for.
 * @param {Object} citationsData - The citations data object (package name → metadata).
 * @returns {Set} The set of all dependencies (including transitive).
 */
function collectDependencies(depSet, packageKey, citationsData) {
    const pkgData = citationsData[packageKey];
    if (!pkgData) {
        return depSet;
    }
    const newDeps = pkgData.dependencies || [];

    for (let dep of newDeps) {
        if (!depSet.has(dep)) {
            depSet.add(dep);
            collectDependencies(depSet, dep, citationsData);
        }
    }
    return depSet;
}

/**
 * Parse feature tags from the citations data format.
 * @param {Array} arr - Array of feature tag objects, e.g., [{name: "tag"}, ...].
 * @returns {Object} A flat lookup object {name: ["tag1", "tag2", ...]}.
 */
function parseFeatureTags(arr) {
    const out = {};
    for (const item of arr) {
        const k = Object.keys(item)[0];
        out[k] = item[k];
    }
    return out;
}

/**
 * Parse a package input string to extract name, version, and features.
 * Supports formats: "pkg", "pkg==1.0.0", "pkg[feat1,feat2]", "pkg==1.0.0[feat1]".
 * @param {string} packageString - The package string to parse.
 * @returns {Object} An object with {name, version?, features?}.
 */
function parsePackageInput(packageString) {
    const trimmed = packageString.trim();
    
    // Match: name, optional ==version, optional [features]
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:==([^[\]]+))?(?:\[([^\]]+)\])?$/);
    
    if (!match) {
        return { name: trimmed };
    }
    
    const [, name, version, featuresStr] = match;
    const result = { name: name.toLowerCase() };
    
    if (version) {
        result.version = version.trim();
    }
    
    if (featuresStr) {
        result.features = featuresStr.split(',').map(f => f.trim()).filter(Boolean);
    }
    
    return result;
}

/**
 * Parse pip freeze output to extract package names and versions.
 * @param {string} content - The pip freeze output.
 * @returns {Array} Array of {key, version} objects.
 */
function parsePipFreeze(content) {
    const softwares = [];
    const lines = content.split("\n");
    for (let line of lines) {
        line = line.trim();
        if (line === "" || line.startsWith("#")) {
            continue;
        }
        const [key, version] = line.split("==");
        if (key && version) {
            softwares.push({ key: key.toLowerCase(), version: version });
        }
    }
    return softwares;
}

/**
 * Parse conda environment export to extract package names and versions.
 * @param {string} content - The conda env export output.
 * @returns {Array} Array of {key, version} objects.
 */
function parseCondaEnv(content) {
    const softwares = [];
    const lines = content.split("\n");
    let inDeps = false;
    let inPipDeps = false;
    
    for (let line of lines) {
        line = line.trim();
        if (line === "dependencies:") {
            inDeps = true;
            continue;
        }
        if (inPipDeps) {
            if (line.startsWith("- ")) {
                const depLine = line.slice(2);
                const [key, version] = depLine.split("==");
                if (key && version) {
                    softwares.push({ key: key.toLowerCase(), version: version });
                }
            } else {
                inPipDeps = false;
                break;
            }
        } else if (inDeps) {
            if (line === "- pip:") {
                inPipDeps = true;
                continue;
            }
            if (line.startsWith("- ")) {
                const depLine = line.slice(2);
                const [key, version] = depLine.split("=");
                if (key && version) {
                    softwares.push({ key: key.toLowerCase(), version: version });
                }
            } else {
                break;
            }
        }
    }
    return softwares;
}

/**
 * Fetch version list from Zenodo API for a given concept DOI.
 * Returns an array of {version, doi} objects sorted by version (newest first).
 * 
 * @param {string} conceptDoi - The concept DOI (e.g., "10.5281/zenodo.1234567").
 * @returns {Promise<Array>} Array of {version, doi} objects.
 */
async function getZenodoVersionInfo(conceptDoi) {
    const PAGE_SIZE = 25;
    const MAX_PAGE_COUNT = 40;
    const baseUrl = `https://zenodo.org/api/records?q=conceptdoi:"${conceptDoi}"&all_versions=true&size=${PAGE_SIZE}`;
    
    const versionCandidates = [];
    const versionsSeen = new Set();
    let expectedVersions = 100000; // Start with large number to enter loop
    let nBadVersions = 0;
    let page = 1;
    
    while (versionCandidates.length + nBadVersions < expectedVersions) {
        const url = `${baseUrl}&page=${page}`;
        
        if (page > MAX_PAGE_COUNT) {
            console.warn(`Exceeded ${MAX_PAGE_COUNT} pages of results for concept DOI ${conceptDoi}. Stopping to avoid rate limiting.`);
            break;
        }
        
        const response = await fetch(url);
        
        // Handle rate limiting (429)
        if (response.status === 429) {
            const rateLimitResetHeader = response.headers.get('x-ratelimit-reset');
            let waitTime = 60000; // Default 60 seconds
            if (rateLimitResetHeader) {
                const resetTimeInMilliseconds = parseInt(rateLimitResetHeader, 10) * 1000;
                const currentTime = Date.now();
                waitTime = Math.max(0, resetTimeInMilliseconds - currentTime);
            }
            console.warn(`Received 429 Too Many Requests. Retrying after ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        expectedVersions = data.hits.total;
        
        for (const hit of data.hits.hits) {
            const version = hit.metadata.version;
            if (!versionsSeen.has(version) && version !== undefined) {
                versionCandidates.push({ version: version, doi: String(hit.id) });
                versionsSeen.add(version);
            } else {
                nBadVersions += 1;
            }
        }
        page += 1;
    }
    
    // Sort by version (newest first) - using localeCompare for string comparison
    // The TypeScript version uses semver, but we keep it simple here for vanilla JS
    versionCandidates.sort((a, b) => b.version.localeCompare(a.version));
    
    return versionCandidates;
}

/**
 * Fetch BibTeX entry from Zenodo API for a specific record.
 * 
 * @param {string} recordId - The Zenodo record ID (numeric string).
 * @returns {Promise<string>} The BibTeX entry as a string.
 */
async function fetchZenodoBibtex(recordId) {
    const url = `https://zenodo.org/api/records/${recordId}`;
    
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/x-bibtex'
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return await response.text();
}

/**
 * Validate a Zenodo DOI and return the number of versions found.
 * If a specific version DOI is entered, attempts to find the concept DOI.
 * 
 * @param {string} conceptDoi - The DOI to validate.
 * @returns {Promise<[number, string]>} Tuple of [versionCount, conceptDoi].
 */
async function validateZenodoDoi(conceptDoi) {
    if (conceptDoi === "") {
        return [-1, conceptDoi];
    }
    
    const PAGE_SIZE = 100;
    const url = `https://zenodo.org/api/records?q=conceptdoi:"${conceptDoi}"&all_versions=true&size=${PAGE_SIZE}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // If no results, maybe user entered a specific version DOI
    if (data.hits.hits.length === 0) {
        const searchUrl = `https://zenodo.org/api/records?q=doi:"${conceptDoi}"&all_versions=true&size=${PAGE_SIZE}`;
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) {
            throw new Error(`HTTP error! Status: ${searchResponse.status}`);
        }
        const searchData = await searchResponse.json();
        
        if (searchData.hits.hits.length === 1) {
            // Found one result, retry with its concept DOI
            return await validateZenodoDoi(searchData.hits.hits[0].conceptdoi);
        } else {
            return [0, conceptDoi];
        }
    }
    
    return [data.hits.total, conceptDoi];
}

// Export functions for use in other modules (ES modules)
export {
    parseBibtex,
    isolateBibtexEntry,
    collectDependencies,
    parseFeatureTags,
    parsePackageInput,
    parsePipFreeze,
    parseCondaEnv,
    getZenodoVersionInfo,
    fetchZenodoBibtex,
    validateZenodoDoi
};
