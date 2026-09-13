#!/usr/bin/env bun
import { join, parse } from "node:path";

interface ConfigFile {
  urls: string[];
}

const CONFIG_DIR = "./config";
const RESULT_DIR = "./prefixes";

/**
 * Fetches network prefixes from a URL, filtering out comments and blank lines.
 */
async function fetchPrefixes(url: string): Promise<string[]> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status} ${response.statusText})`);
  }

  const text = await response.text();

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * Reads a YAML file, fetches prefixes from its "urls" array, and saves to <filename>.txt.
 */
async function processConfigFile(filePath: string): Promise<void> {
  const file = Bun.file(filePath);
  const baseName = parse(filePath).name; // '1.yaml' -> '1'
  const outputPath = join(RESULT_DIR, `${baseName}.txt`);  // '1.txt'

  console.log(`Processing ${filePath}...`);

  const fileContent = await file.text();
  const config = Bun.YAML.parse(fileContent) as ConfigFile;

  if (!config || !Array.isArray(config.urls) || config.urls.length === 0) {
    console.warn(`Skipping ${filePath}: No "urls" array found or array is empty.`);
    return;
  }

  // Fetch all URL targets concurrently
  const prefixArrays = await Promise.all(config.urls.map(fetchPrefixes));
  const combinedPrefixes = prefixArrays.flat();

  // Write directly using Bun's native file API
  await Bun.write(outputPath, combinedPrefixes.join("\n"));
  console.log(`Saved ${combinedPrefixes.length} prefixes to ${outputPath}`);
}

// Main Execution
try {
  // Use Bun's Glob to match both .yaml and .yml files
  const glob = new Bun.Glob("**/*.{yaml,yml}");
  const yamlFiles: string[] = [];

  for await (const file of glob.scan({ cwd: CONFIG_DIR })) {
    yamlFiles.push(join(CONFIG_DIR, file));
  }

  if (yamlFiles.length === 0) {
    console.log(`No YAML files found in ${CONFIG_DIR}`);
  } else {
    await Promise.all(yamlFiles.map(processConfigFile));
    console.log("All files processed successfully.");
  }
} catch (error) {
  console.error("Execution failed:", error);
  process.exit(1);
}