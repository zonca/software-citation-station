/**
 * Cite command for SCS CLI
 * Generates citations for software packages
 */

/// <reference path="../../citationCore.d.ts" />

import { Command, Option } from 'commander';
import { fetchCitations, fetchBibtex, refreshAllCache } from '../dataFetcher.js';
import { getZenodoVersionInfoCached, getVersionSpecificBibtex } from '../zenodoFetcher.js';
import { CitationEntry, ParsedPackage, SelectedPackage } from '../types.js';

// Import core functions dynamically
let citationCore: any = null;

async function getCitationCore() {
  if (!citationCore) {
    // @ts-expect-error - dynamic import of JS module
    citationCore = await import('../../js/citationCore.js');
  }
  return citationCore;
}

export const citeCommand = new Command('cite')
  .description('Generate citations for software packages')
  .argument('[packages...]', 'Package names (e.g., numpy, scipy==1.17.1, astropy[fitting])')
  .option('-d, --dependencies-only', 'Output only resolved dependencies')
  .option('-a, --acknowledgments', 'Output only LaTeX acknowledgments')
  .option('-b, --bibtex', 'Output only BibTeX entries')
  .option('-j, --json', 'Output as JSON')
  .option('-f, --features <features>', 'Comma-separated features (applies to all packages)')
  .option('--refresh-cache', 'Force refresh all cached data')
  .action(async (packages: string[], options: any) => {
    try {
      // Handle refresh cache
      if (options.refreshCache) {
        console.error('Refreshing cache...');
        await refreshAllCache();
      }
      
      // Check if packages were provided
      if (packages.length === 0) {
        console.error('Error: No packages specified');
        console.error('Usage: scs cite [options] <package1> [package2...]');
        console.error('Example: scs cite numpy scipy==1.17.1');
        process.exit(1);
      }
      
      // Fetch data
      const citations = await fetchCitations(options.refreshCache);
      const bibtexText = await fetchBibtex(options.refreshCache);
      const core = await getCitationCore();
      const bibtexTable = core.parseBibtex(bibtexText);
      
      // Parse package inputs
      const parsedPackages: ParsedPackage[] = packages.map(pkg => {
        const parsed = core.parsePackageInput(pkg);
        // Add global features if specified
        if (options.features) {
          const globalFeatures = options.features.split(',').map((f: string) => f.trim());
          parsed.features = [...new Set([...(parsed.features || []), ...globalFeatures])];
        }
        return parsed;
      });
      
      // Validate packages and resolve dependencies
      const selectedPackages: SelectedPackage[] = [];
      const warnings: string[] = [];
      
      for (const pkg of parsedPackages) {
        if (!citations[pkg.name]) {
          warnings.push(`Warning: Unknown package "${pkg.name}", skipping`);
          continue;
        }
        
        const pkgData: CitationEntry = citations[pkg.name];
        const selected: SelectedPackage = { ...pkg };
        
        // Handle version-specific citation
        if (pkg.version && pkgData.zenodo_doi) {
          const versionInfo = await getVersionSpecificBibtex(
            pkg.name,
            pkgData.zenodo_doi,
            pkg.version,
            options.refreshCache
          );
          
          if (versionInfo) {
            selected.zenodoBibtex = versionInfo.bibtex;
            selected.zenodoTag = versionInfo.tag;
          } else {
            warnings.push(`Warning: Version ${pkg.version} not found for ${pkg.name}, using base citation`);
          }
        } else if (pkg.version && !pkgData.zenodo_doi) {
          warnings.push(`Warning: ${pkg.name} has no Zenodo DOI, version ${pkg.version} ignored`);
        }
        
        selectedPackages.push(selected);
      }
      
      // Print warnings
      for (const warning of warnings) {
        console.error(warning);
      }
      
      if (selectedPackages.length === 0) {
        console.error('Error: No valid packages to cite');
        process.exit(1);
      }
      
      // Resolve dependencies for each package
      const dependencies: Record<string, string[]> = {};
      for (const pkg of selectedPackages) {
        const depSet = core.collectDependencies(new Set<string>(), pkg.name, citations);
        dependencies[pkg.name] = Array.from(depSet);
      }
      
      // Generate output
      const ackResult = core.generateAcknowledgment(selectedPackages, citations, bibtexTable, true);
      const bibtex = core.generateBibtex(selectedPackages, citations, bibtexTable);
      
      // Format output based on flags
      if (options.json) {
        // JSON output
        const output = {
          packages: packages,
          timestamp: new Date().toISOString(),
          dependencies,
          acknowledgments: ackResult.acknowledgment,
          bibtex
        };
        console.log(JSON.stringify(output, null, 2));
      } else if (options.dependenciesOnly) {
        // Dependencies only
        for (const [pkg, deps] of Object.entries(dependencies)) {
          if (deps.length === 0) {
            console.log(`${pkg}: (no dependencies)`);
          } else {
            console.log(`${pkg}:`);
            for (const dep of deps) {
              console.log(`  └─ ${dep}`);
            }
          }
        }
      } else if (options.acknowledgments) {
        // Acknowledgments only
        console.log(ackResult.acknowledgment);
      } else if (options.bibtex) {
        // BibTeX only
        console.log(bibtex);
      } else {
        // Default: show all three sections
        console.log('=== Resolved Dependencies ===');
        for (const [pkg, deps] of Object.entries(dependencies)) {
          if (deps.length === 0) {
            console.log(`${pkg}: (no dependencies)`);
          } else {
            console.log(`${pkg}:`);
            for (const dep of deps) {
              console.log(`  └─ ${dep}`);
            }
          }
        }
        
        console.log('\n=== Acknowledgments ===');
        console.log(ackResult.acknowledgment);
        
        console.log('\n=== BibTeX ===');
        console.log(bibtex);
      }
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });
