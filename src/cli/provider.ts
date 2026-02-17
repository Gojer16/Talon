// ─── Provider Management Commands ─────────────────────────────────
// Add/change AI providers and switch models

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { execSync } from 'node:child_process';

interface Provider {
    id: string;
    name: string;
    envVar: string;
    baseUrl: string;
    models: Array<{ id: string; name: string }>;
}

const PROVIDERS: Provider[] = [
    {
        id: 'deepseek',
        name: 'DeepSeek',
        envVar: 'DEEPSEEK_API_KEY',
        baseUrl: 'https://api.deepseek.com',
        models: [
            { id: 'deepseek-chat', name: 'DeepSeek Chat' },
            { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
        ],
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        envVar: 'OPENROUTER_API_KEY',
        baseUrl: 'https://openrouter.ai/api/v1',
        models: [
            { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek Chat v3' },
            { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
            { id: 'google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash' },
            { id: 'openai/gpt-4o', name: 'GPT-4o' },
        ],
    },
];

/**
 * Add or change provider
 */
export async function addProvider(): Promise<void> {
    console.log(chalk.cyan('\n🔧 Add/Change Provider\n'));

    const { providerId } = await inquirer.prompt({
        type: 'list',
        name: 'providerId',
        message: 'Choose provider:',
        choices: PROVIDERS.map(p => ({ name: p.name, value: p.id })),
    });

    const provider = PROVIDERS.find(p => p.id === providerId)!;
    
    // Check if API key already exists
    const envPath = path.join(os.homedir(), '.talon', '.env');
    let existingKey = '';
    
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(new RegExp(`^${provider.envVar}=(.*)$`, 'm'));
        if (match) {
            existingKey = match[1];
        }
    }

    let apiKey: string;
    
    if (existingKey) {
        const { useExisting } = await inquirer.prompt({
            type: 'confirm',
            name: 'useExisting',
            message: `Use existing ${provider.name} API key?`,
            default: true,
        });
        
        if (useExisting) {
            apiKey = existingKey;
        } else {
            const { newKey } = await inquirer.prompt({
                type: 'password',
                name: 'newKey',
                message: `Enter new ${provider.name} API key:`,
            });
            apiKey = newKey;
        }
    } else {
        const { newKey } = await inquirer.prompt({
            type: 'password',
            name: 'newKey',
            message: `Enter ${provider.name} API key:`,
        });
        apiKey = newKey;
    }

    // Update config
    const configPath = path.join(os.homedir(), '.talon', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    config.agent.providers[providerId] = {
        apiKey: `\${${provider.envVar}}`,
        baseUrl: provider.baseUrl,
        models: provider.models.map(m => m.id),
    };

    // Update env
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    const regex = new RegExp(`^${provider.envVar}=.*$`, 'm');
    
    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${provider.envVar}=${apiKey}`);
    } else {
        envContent += `\n${provider.envVar}=${apiKey}\n`;
    }
    
    fs.writeFileSync(envPath, envContent, 'utf-8');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    console.log(chalk.green(`\n✓ Provider ${provider.name} configured`));
    
    // Ask to switch
    const { switchNow } = await inquirer.prompt({
        type: 'confirm',
        name: 'switchNow',
        message: 'Switch to this provider now?',
        default: true,
    });
    
    if (switchNow) {
        const defaultModel = provider.models[0].id;
        config.agent.model = providerId === 'deepseek' ? defaultModel : `${providerId}/${defaultModel}`;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        console.log(chalk.green(`✓ Switched to ${config.agent.model}`));
    }
    
    // Restart gateway
    const { restart } = await inquirer.prompt({
        type: 'confirm',
        name: 'restart',
        message: 'Restart gateway now?',
        default: true,
    });
    
    if (restart) {
        console.log(chalk.dim('\n  Restarting gateway...'));
        try {
            const cliPath = path.join(process.cwd(), 'dist', 'cli', 'index.js');
            execSync(`${process.execPath} ${cliPath} service restart`, { 
                stdio: 'pipe',
                timeout: 10000,
            });
            console.log(chalk.green('  ✓ Gateway restarted\n'));
        } catch (err) {
            console.log(chalk.red('  ✗ Failed to restart gateway'));
            console.log(chalk.yellow('  Run manually: talon service restart\n'));
        }
    } else {
        console.log(chalk.yellow('\n  Remember to restart: talon service restart\n'));
    }
}

/**
 * Switch model
 */
export async function switchModel(): Promise<void> {
    console.log(chalk.cyan('\n🔄 Switch Model\n'));

    const configPath = path.join(os.homedir(), '.talon', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    const providers = Object.keys(config.agent.providers);
    if (providers.length === 0) {
        console.log(chalk.yellow('⚠ No providers configured. Run `talon provider` first\n'));
        return;
    }
    
    const { providerId } = await inquirer.prompt({
        type: 'list',
        name: 'providerId',
        message: 'Choose provider:',
        choices: providers.map(p => ({ name: p, value: p })),
    });
    
    const models = config.agent.providers[providerId].models || [];
    const { modelId } = await inquirer.prompt({
        type: 'list',
        name: 'modelId',
        message: 'Choose model:',
        choices: models.map((m: string) => ({ name: m, value: m })),
    });
    
    // Update model
    config.agent.model = providerId === 'deepseek' ? modelId : `${providerId}/${modelId}`;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    console.log(chalk.green(`\n✓ Switched to ${config.agent.model}`));
    
    // Restart gateway
    const { restart } = await inquirer.prompt({
        type: 'confirm',
        name: 'restart',
        message: 'Restart gateway now?',
        default: true,
    });
    
    if (restart) {
        console.log(chalk.dim('\n  Restarting gateway...'));
        try {
            const cliPath = path.join(process.cwd(), 'dist', 'cli', 'index.js');
            execSync(`${process.execPath} ${cliPath} service restart`, { 
                stdio: 'pipe',
                timeout: 10000,
            });
            console.log(chalk.green('  ✓ Gateway restarted\n'));
        } catch (err) {
            console.log(chalk.red('  ✗ Failed to restart gateway'));
            console.log(chalk.yellow('  Run manually: talon service restart\n'));
        }
    } else {
        console.log(chalk.yellow('\n  Remember to restart: talon service restart\n'));
    }
}
