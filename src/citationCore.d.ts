/**
 * Type declarations for citationCore.js
 */

declare module '../js/citationCore.js' {
  export function parseBibtex(bibtexText: string): Record<string, string>;
  export function isolateBibtexEntry(s: string, start: number): string;
  export function collectDependencies(depSet: Set<string>, packageKey: string, citationsData: any): Set<string>;
  export function parseFeatureTags(arr: Array<Record<string, string[]>>): Record<string, string[]>;
  export function parsePackageInput(packageString: string): { name: string; version?: string; features?: string[] };
  export function parsePipFreeze(content: string): Array<{ key: string; version: string }>;
  export function parseCondaEnv(content: string): Array<{ key: string; version: string }>;
  export function getZenodoVersionInfo(conceptDoi: string): Promise<Array<{ version: string; doi: string }>>;
  export function fetchZenodoBibtex(recordId: string): Promise<string>;
  export function validateZenodoDoi(conceptDoi: string): Promise<[number, string]>;
  export function generateAcknowledgment(
    selectedPackages: any[],
    citationsData: any,
    bibtexTable: any,
    includePreamble?: boolean
  ): { acknowledgment: string; featureSentences: string[] };
  export function generateBibtex(
    selectedPackages: any[],
    citationsData: any,
    bibtexTable: any
  ): string;
}

declare module './js/citationCore.js' {
  export function parseBibtex(bibtexText: string): Record<string, string>;
  export function isolateBibtexEntry(s: string, start: number): string;
  export function collectDependencies(depSet: Set<string>, packageKey: string, citationsData: any): Set<string>;
  export function parseFeatureTags(arr: Array<Record<string, string[]>>): Record<string, string[]>;
  export function parsePackageInput(packageString: string): { name: string; version?: string; features?: string[] };
  export function parsePipFreeze(content: string): Array<{ key: string; version: string }>;
  export function parseCondaEnv(content: string): Array<{ key: string; version: string }>;
  export function getZenodoVersionInfo(conceptDoi: string): Promise<Array<{ version: string; doi: string }>>;
  export function fetchZenodoBibtex(recordId: string): Promise<string>;
  export function validateZenodoDoi(conceptDoi: string): Promise<[number, string]>;
  export function generateAcknowledgment(
    selectedPackages: any[],
    citationsData: any,
    bibtexTable: any,
    includePreamble?: boolean
  ): { acknowledgment: string; featureSentences: string[] };
  export function generateBibtex(
    selectedPackages: any[],
    citationsData: any,
    bibtexTable: any
  ): string;
}
