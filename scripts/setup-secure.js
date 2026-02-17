#!/usr/bin/env node

/**
 * Setup script for secure Talon configuration
 * Creates ~/.talon/.env and ~/.talon/config.json with proper security
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const TALON_HOME = path.join(os.homedir(), '.talon');

function question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function main() {
    console.log('\n🔐 Talon Secure Setup\n');
    console.log('This will create your secure configuration files.\n');
    console.log('Your secrets will be stored in ~/.talon/.env (never committed)');
    console.log('Your config will be in ~/.talon/config.json (never committed)\n');

    // Create directories
    const dirs = [
        TALON_HOME,
        path.join(TALON_HOME, 'sessions'),
        path.join(TALON_HOME, 'logs'),
        path.join(TALON_HOME, 'workspace'),
    ];

    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✓ Created ${dir}`);
        }
    }

    // Check if already configured
    const envPath = path.join(TALON_HOME, '.env');
    const configPath = path.join(TALON_HOME, 'config.json');

    if (fs.existsSync(envPath) || fs.existsSync(configPath)) {
        const overwrite = await question('⚠️  Configuration already exists. Overwrite? (yes/no): ');
        if (overwrite.toLowerCase() !== 'yes') {
            console.log('Setup cancelled.\n');
            rl.close();
            return;
        }
    }

    // Collect configuration
    console.log('\n--- LLM Provider Configuration ---\n');
    
    const deepseekKey = await question('DeepSeek API Key (or press Enter to skip): ');
    const openrouterKey = await question('OpenRouter API Key (or press Enter to skip): ');
    
    console.log('\n--- Channel Configuration ---\n');
    
    const telegramToken = await question('Telegram Bot Token (or press Enter to skip): ');
    
    console.log('\n--- WhatsApp Configuration ---\n');
    console.log('Enter your phone number in international format (no + or spaces)');
    console.log('Example: 584128449024 for +58 412-844-9024');
    const whatsappNumber = await question('WhatsApp Phone Number (or press Enter to skip): ');

    // Create .env file
    const envContent = `# ─── Talon Environment Variables ─────────────────────────
# This file contains secrets - NEVER commit it to Git!
# Location: ~/.talon/.env

${deepseekKey ? `DEEPSEEK_API_KEY=${deepseekKey}` : '# DEEPSEEK_API_KEY=sk-your-key-here'}
${openrouterKey ? `OPENROUTER_API_KEY=${openrouterKey}` : '# OPENROUTER_API_KEY=sk-or-your-key-here'}
${telegramToken ? `TELEGRAM_BOT_TOKEN=${telegramToken}` : '# TELEGRAM_BOT_TOKEN=123456:ABC-your-token'}
${whatsappNumber ? `WHATSAPP_PHONE_NUMBER=${whatsappNumber}` : '# WHATSAPP_PHONE_NUMBER=584128449024'}
`;

    fs.writeFileSync(envPath, envContent);
    console.log(`\n✓ Created ${envPath}`);

    // Determine which provider to use as default
    let defaultProvider = 'deepseek';
    let defaultModel = 'deepseek/deepseek-chat';
    
    if (!deepseekKey && openrouterKey) {
        defaultProvider = 'openrouter';
        defaultModel = 'openrouter/deepseek/deepseek-chat';
    }

    // Create config.json
    const configContent = {
        _comment: "Talon Configuration - SAFE to customize, NEVER commit real values",
        _security: "Use ${ENV_VAR} syntax for secrets - they will be loaded from ~/.talon/.env",
        gateway: {
            host: "127.0.0.1",
            port: 19789,
            auth: {
                mode: "none",
                token: "${TALON_TOKEN}"
            }
        },
        agent: {
            model: defaultModel,
            providers: {
                ...(deepseekKey ? {
                    deepseek: {
                        apiKey: "${DEEPSEEK_API_KEY}",
                        models: ["deepseek-chat", "deepseek-reasoner"]
                    }
                } : {}),
                ...(openrouterKey ? {
                    openrouter: {
                        apiKey: "${OPENROUTER_API_KEY}",
                        models: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o-mini"]
                    }
                } : {})
            },
            maxIterations: 10,
            thinkingLevel: "medium"
        },
        channels: {
            cli: {
                enabled: true
            },
            telegram: {
                enabled: !!telegramToken,
                botToken: "${TELEGRAM_BOT_TOKEN}",
                allowedUsers: [],
                groupActivation: "mention"
            },
            whatsapp: {
                enabled: !!whatsappNumber,
                allowedUsers: whatsappNumber ? ["${WHATSAPP_PHONE_NUMBER}"] : [],
                allowedGroups: [],
                groupActivation: "mention"
            }
        },
        tools: {
            files: {
                enabled: true,
                allowedPaths: ["~/"]
            },
            shell: {
                enabled: true,
                confirmDestructive: true
            },
            browser: {
                enabled: true,
                headless: true
            }
        },
        memory: {
            enabled: true,
            compaction: {
                enabled: true,
                keepRecentMessages: 10
            }
        }
    };

    fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
    console.log(`✓ Created ${configPath}`);

    // Set restrictive permissions on .env
    try {
        fs.chmodSync(envPath, 0o600); // Only owner can read/write
        console.log('✓ Set secure permissions on .env (600)');
    } catch {
        console.log('⚠️  Could not set permissions (Windows?)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Setup Complete!');
    console.log('='.repeat(60) + '\n');
    
    console.log('Your configuration files:');
    console.log(`  ~/.talon/.env           - Secrets (API keys, tokens)`);
    console.log(`  ~/.talon/config.json    - Configuration`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Review the config: cat ~/.talon/config.json');
    console.log('  2. Start Talon:        npm start');
    console.log('  3. For WhatsApp:       Scan QR code with your phone');
    console.log('');
    console.log('🔐 Security Notes:');
    console.log('  • These files are automatically gitignored');
    console.log('  • NEVER commit ~/.talon/ directory');
    console.log('  • Read docs/SECURITY.md for more info');
    console.log('');

    rl.close();
}

main().catch(err => {
    console.error('Setup failed:', err);
    process.exit(1);
});
