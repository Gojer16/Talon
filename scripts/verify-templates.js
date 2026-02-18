#!/usr/bin/env node
// ─── Template System Verification ─────────────────────────────────
// Verifies that templates have frontmatter and user files don't

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEMPLATE_DIR = path.resolve(process.cwd(), 'templates/workspace');
const USER_WORKSPACE = path.join(os.homedir(), '.talon/workspace');

console.log('🔍 Template System Verification\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Check templates have frontmatter
console.log('📋 Checking templates have frontmatter...\n');

const templateFiles = fs.readdirSync(TEMPLATE_DIR)
    .filter(f => f.endsWith('.md'));

let templatesPassed = 0;
let templatesFailed = 0;

for (const file of templateFiles) {
    const content = fs.readFileSync(path.join(TEMPLATE_DIR, file), 'utf-8');
    const hasFrontmatter = content.startsWith('---');
    
    if (hasFrontmatter) {
        console.log(`   ✅ ${file} - has frontmatter`);
        templatesPassed++;
    } else {
        console.log(`   ❌ ${file} - missing frontmatter`);
        templatesFailed++;
    }
}

console.log('');

// Check user workspace files don't have frontmatter (if they exist)
if (fs.existsSync(USER_WORKSPACE)) {
    console.log('📁 Checking user workspace files...\n');
    
    const userFiles = fs.readdirSync(USER_WORKSPACE)
        .filter(f => f.endsWith('.md'));
    
    let userPassed = 0;
    let userFailed = 0;
    
    for (const file of userFiles) {
        const content = fs.readFileSync(path.join(USER_WORKSPACE, file), 'utf-8');
        const hasFrontmatter = content.startsWith('---');
        
        if (!hasFrontmatter) {
            console.log(`   ✅ ${file} - no frontmatter (correct)`);
            userPassed++;
        } else {
            console.log(`   ⚠️  ${file} - has frontmatter (will be stripped on next copy)`);
            userFailed++;
        }
    }
    
    console.log('');
    console.log(`User workspace: ${userPassed} correct, ${userFailed} with frontmatter`);
} else {
    console.log('📁 User workspace not found (will be created on first run)\n');
}

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('📊 Summary:\n');
console.log(`   Templates: ${templatesPassed} passed, ${templatesFailed} failed`);

if (templatesFailed === 0) {
    console.log('\n✅ All templates have frontmatter!');
    process.exit(0);
} else {
    console.log('\n❌ Some templates are missing frontmatter');
    process.exit(1);
}
