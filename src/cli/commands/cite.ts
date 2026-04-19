import { Command } from 'commander';
import { parseBibtex, collectDependencies, generateAcknowledgment, generateBibtex, parsePackageInput } from '../../js/citationCore.js';
import { fetchCitations, fetchBibtex, refreshCache } from '../dataFetcher.js';
import { getZenodoVersionInfoCached, getZenodoBibtexInfo } from '../zenodoFetcher.js';
import type { CitationOutput, ZenodoBibtexInfo } from '../types.js';

export const citeCommand = new Command('cite')
    .description('Generate citations for software packages')
    .argument('[packages...]', 'Package names (e.g., numpy, astropy==6.0.1, astropy[fitting,io])')
    .option('-d, --dependencies-only', 'Output only resolved dependencies')
    .option('-a, --acknowledgments', 'Output only LaTeX acknowledgments')
    .option('-b, --bibtex', 'Output only BibTeX entries')
    .option('-j, --json', 'Output as JSON')
    .option('-f, --features <features>', 'Comma-separated features (applies to all packages)')
    .option('--refresh-cache', 'Force refresh all cached data')
    .action(async (packages: string[], options) => {
        if (packages.length === 0) {
            console.error('Error: At least one package name is required');
            process.exit(1);
        }

        if (options.refreshCache) {
            refreshCache();
        }

        const globalFeatures = options.features ? options.features.split(',').map(f => f.trim()) : undefined;
        const parsedPackages = packages.map(p => parsePackageInput(p));

        const citationsData = await fetchCitations(options.refreshCache);
        const bibtexText = await fetchBibtex(options.refreshCache);
        const bibtexTable = parseBibtex(bibtexText);

        const allPackages = new Set<string>();
        const dependencies: Record<string, string[]> = {};
        const zenodoBibtexMap = new Map<string, ZenodoBibtexInfo>();
        const featureSelections: Record<string, string[]> = {};

        for (const pkg of parsedPackages) {
            if (!citationsData[pkg.name]) {
                console.warn(`Warning: Package '${pkg.name}' not found in citations data`);
                continue;
            }

            allPackages.add(pkg.name);

            const deps = collectDependencies(new Set(), pkg.name, citationsData);
            deps.delete(pkg.name);
            dependencies[pkg.name] = Array.from(deps);
            deps.forEach(dep => allPackages.add(dep));

            const features = pkg.features || globalFeatures;
            if (features && features.length > 0) {
                featureSelections[pkg.name] = features;
            }

            if (pkg.version && citationsData[pkg.name].zenodo_doi) {
                const zenodoInfo = await getZenodoBibtexInfo(
                    pkg.name,
                    pkg.version,
                    citationsData[pkg.name].zenodo_doi,
                    options.refreshCache
                );
                if (zenodoInfo) {
                    zenodoBibtexMap.set(pkg.name, zenodoInfo);
                }
            }
        }

        if (options.dependenciesOnly) {
            console.log(JSON.stringify(dependencies, null, 2));
            return;
        }

        const selectedPackages = Array.from(allPackages);
        const acknowledgments = generateAcknowledgment(selectedPackages, citationsData, featureSelections, zenodoBibtexMap);
        const bibtex = generateBibtex(selectedPackages, citationsData, bibtexTable, featureSelections, zenodoBibtexMap);

        if (options.json) {
            const output: CitationOutput = {
                packages: selectedPackages,
                timestamp: new Date().toISOString(),
                dependencies,
                acknowledgments,
                bibtex
            };
            console.log(JSON.stringify(output, null, 2));
        } else if (options.acknowledgments) {
            console.log(acknowledgments);
        } else if (options.bibtex) {
            console.log(bibtex);
        } else {
            console.log('=== Acknowledgments ===');
            console.log(acknowledgments);
            console.log('\n=== BibTeX ===');
            console.log(bibtex);
        }
    });
