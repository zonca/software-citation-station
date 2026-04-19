import { Command } from 'commander';
import { parseBibtex } from '../../js/citationCore.js';
import { fetchCitations, refreshCache } from '../dataFetcher.js';
import { getZenodoVersionInfoCached } from '../zenodoFetcher.js';

export const showCommand = new Command('show')
    .description('Display detailed package information')
    .argument('<package>', 'Package name')
    .option('--refresh-cache', 'Force refresh cached data')
    .action(async (packageName: string, options) => {
        if (options.refreshCache) {
            refreshCache();
        }

        const citationsData = await fetchCitations(options.refreshCache);
        const packageKey = Object.keys(citationsData).find(
            key => key.toLowerCase() === packageName.toLowerCase()
        );

        if (!packageKey) {
            console.error(`Error: Package '${packageName}' not found`);
            process.exit(1);
        }

        const pkg = citationsData[packageKey];

        console.log(`Package: ${packageKey}`);
        console.log(`Description: ${pkg.description}`);
        console.log(`Category: ${Array.isArray(pkg.category) ? pkg.category.join(', ') : pkg.category}`);
        console.log(`Language: ${Array.isArray(pkg.language) ? pkg.language.join(', ') : pkg.language}`);
        console.log(`Dependencies: ${pkg.dependencies && pkg.dependencies.length > 0 ? pkg.dependencies.join(', ') : 'None'}`);
        console.log(`Tags: ${pkg.tags.join(', ')}`);
        console.log(`Link: ${pkg.link}`);
        console.log(`Attribution: ${pkg.attribution_link}`);
        console.log(`Zenodo DOI: ${pkg.zenodo_doi || 'None'}`);

        if (pkg.zenodo_doi) {
            try {
                const versionData = await getZenodoVersionInfoCached(packageKey, pkg.zenodo_doi, options.refreshCache);
                const versions = versionData.versions.map(v => v.version).join(', ');
                console.log(`Available Versions: ${versions}`);
            } catch (error) {
                console.log('Available Versions: Unable to fetch');
            }
        }

        if (pkg.feature_tags) {
            const features = Object.keys(pkg.feature_tags).join(', ');
            console.log(`Features: ${features}`);
        }
    });
