/**
 * Show command for SCS CLI
 * Displays detailed information about a package
 */

import { Command } from 'commander';
import { fetchCitations, refreshAllCache } from '../dataFetcher.js';
import { getZenodoVersionInfoCached } from '../zenodoFetcher.js';

export const showCommand = new Command('show')
  .description('Display detailed information about a package')
  .argument('<package>', 'Package name (e.g., numpy, astropy)')
  .option('--refresh-cache', 'Force refresh cached data')
  .action(async (packageName: string, options: any) => {
    try {
      // Handle refresh cache
      if (options.refreshCache) {
        console.error('Refreshing cache...');
        await refreshAllCache();
      }
      
      // Fetch citations data
      const citations = await fetchCitations(options.refreshCache);
      
      // Check if package exists
      if (!citations[packageName]) {
        console.error(`Error: Package "${packageName}" not found`);
        console.error('Use "scs cite" to see available packages or check the spelling.');
        process.exit(1);
      }
      
      const pkgData = citations[packageName];
      
      // Display package information
      console.log(`Package: ${packageName}`);
      console.log(`Description: ${pkgData.description}`);
      console.log(`Category: ${Array.isArray(pkgData.category) ? pkgData.category.join(', ') : pkgData.category}`);
      console.log(`Language: ${Array.isArray(pkgData.language) ? pkgData.language.join(', ') : pkgData.language}`);
      console.log(`Dependencies: ${pkgData.dependencies.length > 0 ? pkgData.dependencies.join(', ') : '(none)'}`);
      console.log(`Tags: ${pkgData.tags.join(', ')}`);
      console.log(`Link: ${pkgData.link}`);
      console.log(`Attribution: ${pkgData.attribution_link}`);
      console.log(`Zenodo DOI: ${pkgData.zenodo_doi || '(none)'}`);
      
      // Fetch and display available versions if Zenodo DOI exists
      if (pkgData.zenodo_doi) {
        try {
          const versions = await getZenodoVersionInfoCached(
            packageName,
            pkgData.zenodo_doi,
            options.refreshCache
          );
          
          if (versions.length > 0) {
            const versionStrings = versions.slice(0, 10).map((v: { version: string }) => v.version);
            console.log(`Available Versions: ${versionStrings.join(', ')}${versions.length > 10 ? '...' : ''}`);
            if (versions.length > 10) {
              console.log(`  (showing 10 of ${versions.length} versions)`);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`Available Versions: (failed to fetch: ${message})`);
        }
      }
      
      // Display feature tags if available
      if (pkgData.feature_tags && pkgData.feature_tags.length > 0) {
        console.log('Features:');
        for (const feature of pkgData.feature_tags) {
          const featureName = Object.keys(feature)[0];
          const featureTags = feature[featureName];
          console.log(`  - ${featureName}: ${featureTags.join(', ')}`);
        }
      }
      
      // Display extra info if available
      if (pkgData.extra_bibtex) {
        console.log('Extra BibTeX: (available)');
      }
      
      if (pkgData.custom_citation) {
        console.log('Custom Citation: (available)');
      }
      
      if (pkgData.frequently_used) {
        console.log('Frequently Used: Yes');
      }
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });
