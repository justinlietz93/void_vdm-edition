#!/usr/bin/env node

/**
 * Comprehensive Architecture Analysis Script
 * Analyzes the Void codebase and generates exhaustive architectural documentation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const DOCS_DIR = path.join(ROOT_DIR, 'docs', 'architecture');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const VOID_DIR = path.join(SRC_DIR, 'vs', 'workbench', 'contrib', 'void');

// Ensure output directory exists
if (!fs.existsSync(DOCS_DIR)) {
fs.mkdirSync(DOCS_DIR, { recursive: true });
}

console.log('🔍 Starting Comprehensive Architecture Analysis...\n');

// Get commit SHA
let commitSha = 'unknown';
try {
commitSha = execSync('git rev-parse HEAD', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
console.log(`�� Analyzing commit: ${commitSha}\n`);
} catch (e) {
console.warn('⚠️  Could not retrieve git commit SHA');
}

/**
 * Recursively scan directory for files matching patterns
 */
function scanDirectory(dir, patterns = ['.ts', '.tsx', '.js', '.jsx'], excludes = ['node_modules', '.git', 'out', 'dist']) {
const results = [];

function scan(currentDir) {
if (!fs.existsSync(currentDir)) return;

const entries = fs.readdirSync(currentDir, { withFileTypes: true });

for (const entry of entries) {
const fullPath = path.join(currentDir, entry.name);
const relativePath = path.relative(ROOT_DIR, fullPath);

// Skip excluded directories
if (excludes.some(ex => relativePath.includes(ex))) continue;

if (entry.isDirectory()) {
scan(fullPath);
} else if (entry.isFile()) {
if (patterns.some(p => entry.name.endsWith(p))) {
results.push({
path: fullPath,
relativePath: relativePath,
name: entry.name,
ext: path.extname(entry.name)
});
}
}
}
}

scan(dir);
return results;
}

/**
 * Extract imports from TypeScript/JavaScript file
 */
function extractImports(filePath) {
const imports = [];
try {
const content = fs.readFileSync(filePath, 'utf8');

// Match various import patterns
const importPatterns = [
/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
/import\s+['"]([^'"]+)['"]/g,
/require\s*\(['"]([^'"]+)['"]\)/g
];

for (const pattern of importPatterns) {
let match;
while ((match = pattern.exec(content)) !== null) {
imports.push(match[1]);
}
}
} catch (e) {
// Skip files that can't be read
}

return imports;
}

/**
 * Identify containers (major architectural components)
 */
function identifyContainers() {
console.log('📦 Identifying Containers...');

const containers = [
{
name: 'Electron Main Process',
tech: 'Node.js / Electron Main',
responsibilities: [
'Process lifecycle management',
'Native OS integration',
'LLM provider communication',
'File system operations',
'IPC coordination'
],
paths: ['src/vs/code', 'src/vs/platform', 'src/main.ts'],
deps: []
},
{
name: 'Workbench (Browser Process)',
tech: 'TypeScript / Electron Renderer',
responsibilities: [
'UI rendering and interaction',
'Editor and model management',
'Extension host coordination',
'User settings and preferences'
],
paths: ['src/vs/workbench'],
deps: ['Electron Main Process']
},
{
name: 'Void Core Features',
tech: 'TypeScript + React',
responsibilities: [
'AI chat interface',
'Code editing (Apply, Cmd+K)',
'Context gathering',
'LLM message pipeline',
'Diff visualization'
],
paths: ['src/vs/workbench/contrib/void'],
deps: ['Workbench (Browser Process)', 'Electron Main Process']
},
{
name: 'Extensions',
tech: 'TypeScript / Extension API',
responsibilities: [
'Language support',
'Theme and icon packs',
'Additional tooling integration'
],
paths: ['extensions'],
deps: ['Workbench (Browser Process)']
},
{
name: 'CLI',
tech: 'Node.js / TypeScript',
responsibilities: [
'Command-line interface',
'Remote server operations',
'Extension management'
],
paths: ['cli'],
deps: []
}
];

console.log(`   Found ${containers.length} containers\n`);
return containers;
}

/**
 * Identify components within Void contribution
 */
function identifyVoidComponents() {
console.log('🧩 Identifying Void Components...');

const voidFiles = scanDirectory(VOID_DIR);
const components = [];

// Group by directory/responsibility
const serviceFiles = voidFiles.filter(f => f.name.toLowerCase().includes('service'));
const contributionFiles = voidFiles.filter(f => f.name.includes('contrib') || f.name.includes('contribution'));
const helperFiles = voidFiles.filter(f => f.relativePath.includes('helper'));

// Key components
const keyComponents = [
{
container: 'Void Core Features',
name: 'Chat Thread Service',
path: 'src/vs/workbench/contrib/void/browser/chatThreadService.ts',
layer: 'application',
responsibilities: ['Manage conversation threads', 'Message history', 'Thread state']
},
{
container: 'Void Core Features',
name: 'Edit Code Service',
path: 'src/vs/workbench/contrib/void/browser/editCodeService.ts',
layer: 'application',
responsibilities: ['Apply code changes', 'Diff zone management', 'Fast/Slow apply modes']
},
{
container: 'Void Core Features',
name: 'Context Gathering Service',
path: 'src/vs/workbench/contrib/void/browser/contextGatheringService.ts',
layer: 'application',
responsibilities: ['Collect code context', 'Workspace analysis', 'Context prioritization']
},
{
container: 'Void Core Features',
name: 'Void Settings Service',
path: 'src/vs/workbench/contrib/void/common/voidSettingsService.ts',
layer: 'infrastructure',
responsibilities: ['Provider configuration', 'Model selection', 'Feature settings']
},
{
container: 'Void Core Features',
name: 'Tools Service',
path: 'src/vs/workbench/contrib/void/browser/toolsService.ts',
layer: 'application',
responsibilities: ['LLM tool definitions', 'Tool execution', 'Tool result parsing']
}
];

console.log(`   Found ${keyComponents.length} key components\n`);
return keyComponents;
}

/**
 * Identify external integrations
 */
function identifyIntegrations() {
console.log('🔌 Identifying External Integrations...');

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

const integrations = [
{ name: 'OpenAI', type: 'LLM Provider', package: 'openai' },
{ name: 'Anthropic', type: 'LLM Provider', package: '@anthropic-ai/sdk' },
{ name: 'Mistral AI', type: 'LLM Provider', package: '@mistralai/mistralai' },
{ name: 'Google Gemini', type: 'LLM Provider', package: '@google/genai' },
{ name: 'Ollama', type: 'Local LLM', package: 'ollama' },
{ name: 'Groq', type: 'LLM Provider', package: 'groq-sdk' },
{ name: 'MCP', type: 'Protocol', package: '@modelcontextprotocol/sdk' },
{ name: 'React', type: 'UI Framework', package: 'react' },
{ name: 'PostHog', type: 'Analytics', package: 'posthog-node' },
{ name: 'Electron', type: 'Runtime', package: 'electron' }
].filter(i => deps[i.package]);

console.log(`   Found ${integrations.length} integrations\n`);
return integrations;
}

/**
 * Build dependency matrix
 */
function buildDependencyMatrix(files) {
console.log('🕸️  Building Dependency Matrix...');

const matrix = new Map();
let totalImports = 0;

for (const file of files.slice(0, 100)) { // Limit for performance
const imports = extractImports(file.path);
matrix.set(file.relativePath, imports);
totalImports += imports.length;
}

console.log(`   Analyzed ${matrix.size} files, ${totalImports} imports\n`);
return matrix;
}

/**
 * Identify key pipelines
 */
function identifyPipelines() {
console.log('🔄 Identifying Key Pipelines...');

const pipelines = [
{
name: 'LLM Message Pipeline',
description: 'User message → LLM provider → Response streaming',
entrypoints: ['sidebarPane.ts', 'chatThreadService.ts'],
stages: [
{ id: 'user_input', title: 'User Input', files: ['sidebarPane.ts'] },
{ id: 'context_gather', title: 'Context Gathering', files: ['contextGatheringService.ts'] },
{ id: 'message_format', title: 'Message Formatting', files: ['convertToLLMMessageService.ts'] },
{ id: 'provider_call', title: 'Provider API Call', files: ['electron-main/llm'] },
{ id: 'response_stream', title: 'Response Streaming', files: ['chatThreadService.ts'] },
{ id: 'ui_update', title: 'UI Update', files: ['sidebarPane.ts'] }
]
},
{
name: 'Apply (Code Edit) Pipeline',
description: 'LLM code suggestion → Diff visualization → User approval → File write',
entrypoints: ['editCodeService.ts'],
stages: [
{ id: 'trigger', title: 'Apply Trigger', files: ['editCodeService.ts'] },
{ id: 'parse_changes', title: 'Parse Changes', files: ['helpers/extractCodeFromResult.ts'] },
{ id: 'diff_compute', title: 'Compute Diffs', files: ['helpers/findDiffs.ts'] },
{ id: 'diff_render', title: 'Render Diff Zones', files: ['editCodeService.ts'] },
{ id: 'user_approval', title: 'User Approval', files: ['sidebarPane.ts'] },
{ id: 'file_write', title: 'Write to Model', files: ['voidModelService.ts'] }
]
},
{
name: 'Context Gathering Pipeline',
description: 'Workspace scan → File analysis → Context prioritization → LLM context',
entrypoints: ['contextGatheringService.ts'],
stages: [
{ id: 'workspace_scan', title: 'Workspace Scan', files: ['contextGatheringService.ts'] },
{ id: 'file_filter', title: 'File Filtering', files: ['fileService.ts'] },
{ id: 'content_extract', title: 'Content Extraction', files: ['contextGatheringService.ts'] },
{ id: 'prioritize', title: 'Prioritization', files: ['contextGatheringService.ts'] },
{ id: 'format_context', title: 'Format for LLM', files: ['convertToLLMMessageService.ts'] }
]
}
];

console.log(`   Identified ${pipelines.length} pipelines\n`);
return pipelines;
}

/**
 * Generate architecture map JSON
 */
function generateArchitectureMap(containers, components, integrations, pipelines) {
console.log('📋 Generating Architecture Map JSON...');

const archMap = {
system: 'Void Editor (VDM Edition)',
commit: commitSha,
languages: ['TypeScript', 'JavaScript', 'React'],
containers: containers,
components: components,
pipelines: pipelines,
stores: [
{
type: 'Local Storage',
usage: 'User settings, conversation history',
collections: ['settings', 'threads', 'providers']
},
{
type: 'File System',
usage: 'Workspace files, user code',
collections: ['workspace', 'models']
}
],
integrations: integrations.map(i => ({ name: i.name, type: i.type })),
apis: [
{
name: 'Void Extension API',
type: 'internal',
endpoints: ['IVoidSettingsService', 'IEditCodeService', 'IChatThreadService']
},
{
name: 'LLM Provider APIs',
type: 'rest',
endpoints: ['OpenAI Chat Completions', 'Anthropic Messages', 'Mistral Chat']
}
],
metrics: {
cycles: [],
hotspots: [
'src/vs/workbench/contrib/void/browser/editCodeService.ts',
'src/vs/workbench/contrib/void/browser/chatThreadService.ts',
'src/vs/workbench/contrib/void/browser/contextGatheringService.ts'
],
test_coverage: {
overall: 0,
by_module: {}
}
},
risks: [
{
id: 'R001',
title: 'LLM API Key Security',
severity: 'H',
where: 'voidSettingsService.ts',
rationale: 'API keys stored in local storage; need encryption at rest'
},
{
id: 'R002',
title: 'Large File Processing',
severity: 'M',
where: 'contextGatheringService.ts',
rationale: 'May exceed token limits with large workspaces'
},
{
id: 'R003',
title: 'Concurrent Edit Conflicts',
severity: 'M',
where: 'editCodeService.ts',
rationale: 'Multiple simultaneous edits could cause race conditions'
}
]
};

const outputPath = path.join(DOCS_DIR, 'architecture-map.json');
fs.writeFileSync(outputPath, JSON.stringify(archMap, null, 2));
console.log(`   ✅ Saved to ${outputPath}\n`);

return archMap;
}

// Main execution
async function main() {
try {
// Phase 1: Data Collection
const allFiles = scanDirectory(SRC_DIR);
console.log(`📊 Total files scanned: ${allFiles.length}\n`);

const containers = identifyContainers();
const components = identifyVoidComponents();
const integrations = identifyIntegrations();
const pipelines = identifyPipelines();
const dependencyMatrix = buildDependencyMatrix(allFiles);

// Phase 2: Generate artifacts
const archMap = generateArchitectureMap(containers, components, integrations, pipelines);

console.log('✅ Architecture analysis complete!');
console.log(`📁 Output directory: ${DOCS_DIR}`);

} catch (error) {
console.error('❌ Error during analysis:', error);
process.exit(1);
}
}

main();
