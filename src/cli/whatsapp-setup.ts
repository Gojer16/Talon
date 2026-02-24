#!/usr/bin/env node

// ─── WhatsApp QR Setup Command ──────────────────────────────────
// Standalone command to generate and display WhatsApp QR code
// Usage: talon ws-setup or node dist/cli/whatsapp-setup.js

import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';

// Dynamic imports for optional dependencies
let Client: any;
let LocalAuth: any;
let QRCodeTerminal: any;

try {
    const wa = await import('whatsapp-web.js');
    const waDefault = (wa as any).default ?? wa;
    Client = wa.Client ?? waDefault.Client;
    LocalAuth = wa.LocalAuth ?? waDefault.LocalAuth;
} catch {
    console.error(chalk.red('\n❌ whatsapp-web.js not installed!'));
    console.error('Run: npm install whatsapp-web.js qrcode-terminal\n');
    process.exit(1);
}

try {
    const qr = await import('qrcode-terminal');
    QRCodeTerminal = qr.default || qr;
} catch {
    QRCodeTerminal = null;
}

async function setupWhatsApp(): Promise<void> {
    console.log(chalk.cyan('\n╔════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║     📱 Talon WhatsApp QR Code Setup                   ║'));
    console.log(chalk.cyan('╚════════════════════════════════════════════════════════╝\n'));

    if (!Client) {
        console.error(chalk.red('❌ whatsapp-web.js not available'));
        process.exit(1);
    }

    // Load config
    const config = await loadConfig();
    
    if (!config.channels.whatsapp?.enabled) {
        console.error(chalk.yellow('⚠️  WhatsApp is not enabled in config.json'));
        console.error('Add to config.json:');
        console.error(JSON.stringify({
            channels: {
                whatsapp: {
                    enabled: true,
                    allowedUsers: ["your-phone-number"]
                }
            }
        }, null, 2));
        process.exit(1);
    }

    const sessionName = config.channels.whatsapp.sessionName || 'Talon';
    // Keep auth location consistent with WhatsApp channel
    const authDir = path.join(os.homedir(), '.talon', 'auth', 'whatsapp');
    
    console.log(chalk.green('✅ Configuration loaded'));
    console.log(chalk.dim(`   Session: ${sessionName}`));
    console.log(chalk.dim(`   Auth Dir: ${authDir}\n`));
    console.log(chalk.yellow('📖 Instructions:'));
    console.log(chalk.dim('   The QR code will appear below in a few seconds...'));
    console.log(chalk.dim('   Have your WhatsApp phone app ready!\n'));

    // If gateway is running, it may already own the auth session
    try {
        const { isGatewayRunning } = await import('../gateway/process-manager.js');
        const status = await isGatewayRunning();
        if (status.running) {
            console.error(chalk.yellow('⚠️  Talon gateway is running.'));
            console.error(chalk.dim('   It may already be showing the QR code.'));
            console.error(chalk.dim('   Stop it with `talon stop` and run this command again.\n'));
            process.exit(1);
        }
    } catch {
        // If process manager import fails, continue without blocking
    }

    // Detect an existing Chromium lock for this session to avoid crashing
    const sessionDir = path.join(authDir, 'session');
    const lockFiles = [
        path.join(sessionDir, 'SingletonLock'),
        path.join(sessionDir, 'SingletonSocket'),
        path.join(sessionDir, 'SingletonCookie'),
        path.join(sessionDir, 'DevToolsActivePort'),
    ];
    const hasLockFiles = lockFiles.some(filePath => fs.existsSync(filePath));
    if (hasLockFiles) {
        const devtoolsPath = path.join(sessionDir, 'DevToolsActivePort');
        let devtoolsPort: number | null = null;

        try {
            if (fs.existsSync(devtoolsPath)) {
                const content = fs.readFileSync(devtoolsPath, 'utf8');
                const firstLine = content.split('\n')[0]?.trim();
                if (firstLine && /^\d+$/.test(firstLine)) {
                    devtoolsPort = Number(firstLine);
                }
            }
        } catch {
            // Ignore read errors and fall back to lock files only
        }

        const isPortOpen = await new Promise<boolean>((resolve) => {
            if (!devtoolsPort) return resolve(false);
            const socket = net.connect({ host: '127.0.0.1', port: devtoolsPort }, () => {
                socket.end();
                resolve(true);
            });
            socket.on('error', () => resolve(false));
            socket.setTimeout(500, () => {
                socket.destroy();
                resolve(false);
            });
        });

        if (isPortOpen) {
            console.error(chalk.red('❌ WhatsApp browser session is already running.'));
            console.error(chalk.dim(`   Session dir: ${sessionDir}`));
            console.error(chalk.dim('   Close the running browser or stop the Talon gateway, then retry.\n'));
            process.exit(1);
        }

        // Stale lock files: remove and continue
        for (const filePath of lockFiles) {
            try {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch {
                // If we can’t clear a lock, fail safely
                console.error(chalk.red('❌ Found stale WhatsApp browser locks but failed to clear them.'));
                console.error(chalk.dim(`   Session dir: ${sessionDir}`));
                console.error(chalk.dim('   Please remove the lock files and retry.\n'));
                process.exit(1);
            }
        }
    }

    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: authDir,
            sessionId: sessionName,
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
            ],
        },
    });

    let qrDisplayed = false;
    let authenticated = false;

    // QR Code event
    client.on('qr', (qr: string) => {
        if (qrDisplayed) return; // Only show once
        qrDisplayed = true;

        console.log(chalk.yellow('\n📱 Scan this QR code with your WhatsApp phone app:\n'));
        
        if (QRCodeTerminal) {
            QRCodeTerminal.generate(qr, { small: true });
        } else {
            console.log(chalk.dim('QR Code (install qrcode-terminal for better display):'));
            console.log(qr);
        }

        console.log(chalk.cyan('\n📖 Steps:'));
        console.log('   1. Open WhatsApp on your phone');
        console.log('   2. Go to Settings → Linked Devices');
        console.log('   3. Tap "Link a Device"');
        console.log('   4. Scan this QR code\n');
        console.log(chalk.dim('   Waiting for authentication...\n'));
    });

    // Ready event
    client.on('ready', () => {
        authenticated = true;
        console.log(chalk.green('\n✅ WhatsApp authenticated successfully!\n'));
        console.log(chalk.green('╔════════════════════════════════════════════════════════╗'));
        console.log(chalk.green('║     🟢 WhatsApp is now connected and ready!           ║'));
        console.log(chalk.green('╚════════════════════════════════════════════════════════╝\n'));
        
        console.log(chalk.dim('   Session saved to: ' + authDir));
        console.log(chalk.dim('   You can now restart Talon normally\n'));
        
        setTimeout(() => {
            client.destroy();
            process.exit(0);
        }, 2000);
    });

    // Auth failure
    client.on('auth_failure', (msg: string) => {
        console.error(chalk.red('\n❌ Authentication failed:'), msg);
        console.error(chalk.yellow('\nTry deleting the auth folder and running again:'));
        console.error(chalk.dim(`   rm -rf ${authDir}\n`));
        process.exit(1);
    });

    // Disconnected
    client.on('disconnected', (reason: string) => {
        if (!authenticated) {
            console.error(chalk.red('\n❌ Disconnected before authentication:'), reason);
            process.exit(1);
        }
    });

    console.log(chalk.dim('Initializing WhatsApp client...'));
    
    try {
        await client.initialize();
    } catch (err: any) {
        console.error(chalk.red('\n❌ Failed to initialize:'), err.message);
        process.exit(1);
    }

    // Timeout after 2 minutes
    setTimeout(() => {
        if (!authenticated) {
            console.error(chalk.red('\n⏱️  QR code expired. Run the command again to get a new one.\n'));
            client.destroy();
            process.exit(1);
        }
    }, 120000);
}

export { setupWhatsApp };

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n⚠️  Setup cancelled by user\n'));
    process.exit(0);
});

process.on('unhandledRejection', (err) => {
    console.error(chalk.red('\n❌ Unexpected error:'), err);
    process.exit(1);
});

// Run setup only when executed directly (not when imported by CLI)
const isDirectRun = process.argv[1]
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
    setupWhatsApp().catch((err) => {
        console.error(chalk.red('\n❌ Error:'), err.message);
        process.exit(1);
    });
}
