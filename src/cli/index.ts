#!/usr/bin/env node

// ─── Talon CLI ────────────────────────────────────────────────────
// Entry point for `talon setup`, `talon start`, `talon health`, `talon status`

import fs from 'node:fs';
import { runWizard } from './wizard.js';

const command = process.argv[2];
const flags = process.argv.slice(3);

async function main(): Promise<void> {
    switch (command) {
        case 'setup':
        case 'onboard':
        case 'init': {
            await runWizard();
            break;
        }

        case 'ws-setup':
        case 'ws:setup':
        case 'whatsapp-setup':
        case 'whatsapp': {
            // Import and run WhatsApp setup
            const { setupWhatsApp } = await import('./whatsapp-setup.js');
            await setupWhatsApp();
            break;
        }

        case 'gateway':
        case 'start':
        case 'dashboard': {
            const isDaemon = flags.includes('--daemon') || flags.includes('-d');
            const isGatewayOnly = command === 'gateway';
            const isDashboard = command === 'dashboard';
            const forceStart = flags.includes('--force') || flags.includes('-f');

            // Check for running gateway using new process manager
            const { isGatewayRunning } = await import('../gateway/process-manager.js');
            const status = await isGatewayRunning();

            if (isDashboard) {
                console.log('🦅 Talon Dashboard');
                console.log('Checking gateway status...');
            }

            if (status.running && !forceStart && !isDashboard) {
                console.log(`⚠️  Talon gateway already running`);
                console.log(`   PID: ${status.pid}`);
                console.log(`   Version: ${status.version || 'unknown'}`);
                console.log(`   Uptime: ${Math.round(status.uptime || 0)}s`);
                console.log('');
                console.log('   Run `talon stop` first, or use `talon restart`');
                console.log('   Or use `--force` to stop and restart');
                process.exit(1);
            }

            if (forceStart && status.running) {
                console.log('🔄 Force restart requested, stopping old gateway...');
                const { stopGateway } = await import('../gateway/process-manager.js');
                const result = await stopGateway(true);
                if (!result.success) {
                    console.log(`❌ Failed to stop old gateway: ${result.message}`);
                    process.exit(1);
                }
                console.log('✓ Old gateway stopped');
                // Wait a moment for port to be freed
                await new Promise(r => setTimeout(r, 1000));
            }

            // If dashboard command and gateway not running, start it
            if (isDashboard && !status.running) {
                console.log('Gateway: not running');
                console.log('Starting gateway...');
                
                // Start gateway in background
                const { spawn } = await import('node:child_process');
                const gatewayProcess = spawn(process.argv[0], [process.argv[1], 'gateway'], {
                    detached: true,
                    stdio: 'ignore'
                });
                gatewayProcess.unref();
                
                // Wait for health check
                console.log('Waiting for health check...');
                let healthy = false;
                for (let i = 0; i < 30; i++) {
                    await new Promise(r => setTimeout(r, 1000));
                    try {
                        const res = await fetch('http://127.0.0.1:19789/api/health', {
                            signal: AbortSignal.timeout(2000),
                        });
                        if (res.ok) {
                            healthy = true;
                            break;
                        }
                    } catch {
                        // Keep waiting
                    }
                }
                
                if (!healthy) {
                    console.log('❌ Gateway failed to start');
                    process.exit(1);
                }
                
                console.log('Health: OK');
            } else if (isDashboard && status.running) {
                console.log(`Gateway: running (pid ${status.pid})`);
            }

            // If dashboard command, open browser and exit
            if (isDashboard) {
                const url = 'http://127.0.0.1:19789';
                console.log(`Dashboard: ${url}`);
                console.log('Opening browser...');
                
                // Open browser
                const { exec } = await import('node:child_process');
                const platform = process.platform;
                let openCmd: string;
                
                if (platform === 'darwin') {
                    openCmd = `open "${url}"`;
                } else if (platform === 'win32') {
                    openCmd = `start "${url}"`;
                } else {
                    openCmd = `xdg-open "${url}"`;
                }
                
                exec(openCmd, (err) => {
                    if (err) {
                        console.log(`⚠️  Could not open browser automatically`);
                        console.log(`   Please open: ${url}`);
                    } else {
                        console.log('✓ Dashboard opened');
                    }
                    process.exit(0);
                });
                
                // Wait for browser to open
                await new Promise(r => setTimeout(r, 2000));
                process.exit(0);
            }

            if (isDaemon || isGatewayOnly) {
                // Suppress logs in daemon mode
                process.env.LOG_LEVEL = 'silent';
                // Disable CLI channel
                process.env.TALON_CLI_ENABLED = 'false';
            }

            // Import and boot the gateway (it runs boot() automatically)
            await import('../gateway/index.js');

            if (isDaemon || isGatewayOnly) {
                console.log('🦅 Talon Gateway v0.4.0 started');
                console.log('   HTTP:      http://127.0.0.1:19789');
                console.log('   WebSocket: ws://127.0.0.1:19789/ws');
                console.log('   Use `talon health` to check status');
            }

            // Keep process alive - gateway handles its own lifecycle
            await new Promise(() => { });
            break;
        }

        case 'health': {
            try {
                const res = await fetch('http://127.0.0.1:19789/api/health', {
                    signal: AbortSignal.timeout(5000),
                });
                const data = await res.json();
                console.log('🦅 Talon Health Check');
                console.log('─────────────────────');
                console.log(`  Status:     ${data.status === 'ok' ? '✅ OK' : '❌ Error'}`);
                console.log(`  Version:    ${data.version}`);
                console.log(`  Uptime:     ${Math.round(data.uptime)}s`);
                console.log(`  Sessions:   ${data.stats?.sessions ?? 0}`);
                console.log(`  WS Clients: ${data.stats?.wsClients ?? 0}`);
            } catch {
                console.log('❌ Talon is not running.');
                console.log('   Run `talon start` to start the gateway.');
            }
            break;
        }

        case 'status': {
            const { getGatewayStatus } = await import('../gateway/process-manager.js');
            const status = await getGatewayStatus();
            
            console.log('🦅 Talon Gateway Status');
            console.log('─────────────────────────');
            
            if (status.running) {
                console.log(`  Status:   ✅ Running`);
                console.log(`  PID:      ${status.pid}`);
                console.log(`  Version:  ${status.version || 'unknown'}`);
                console.log(`  Uptime:   ${Math.round(status.uptime || 0)}s`);
                console.log(`  Port:     ${status.port}`);
                console.log(`  Config:   ${status.configPath || 'N/A'}`);
                
                if (status.stale) {
                    console.log('');
                    console.log('  ⚠️  Warning: PID file is stale or missing');
                    console.log('     Consider running `talon restart`');
                }
                
                // Check version mismatch
                const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
                if (status.version && status.version !== packageJson.version) {
                    console.log('');
                    console.log(`  ⚠️  Version mismatch!`);
                    console.log(`     Running: ${status.version}`);
                    console.log(`     Built:   ${packageJson.version}`);
                    console.log('     Run `talon restart` to update');
                }
            } else {
                console.log(`  Status:   ❌ Not running`);
                console.log('');
                console.log('  Run `talon gateway` to start');
            }
            break;
        }

        case 'debug:process': {
            const { debugProcess } = await import('../gateway/process-manager.js');
            await debugProcess();
            break;
        }

        case '--help':
        case '-h':
        case undefined: {
            console.log(`
🦅 Talon — Personal AI Assistant

Usage: talon <command> [options]

Commands:
  setup              Run the onboarding wizard
  gateway            Start gateway server only (WebSocket only)
  tui                Connect to running gateway (text interface)
  provider           Add/change AI provider
  switch             Switch between configured models
  start              Start the gateway server with CLI
  stop [--force]     Stop running gateway (--force to kill)
  restart            Restart the gateway
  health             Check if the gateway is running
  status             Show detailed gateway status
  debug:process      Debug process management (PID, port, health)
  service            Manage system service

Options:
  --force, -f        Force stop/restart (SIGKILL)
  --daemon, -d       Run in background

Examples:
  talon gateway           # Start gateway-only mode
  talon start --force     # Force restart if already running
  talon stop --force      # Force kill gateway
  talon restart           # Graceful restart
  talon status            # Show PID, version, uptime
  talon debug:process     # Debug process issues
      `);
            break;
        }

        case 'stop': {
            const forceStop = flags.includes('--force') || flags.includes('-f');
            const { stopGateway } = await import('../gateway/process-manager.js');
            
            const result = await stopGateway(forceStop);
            
            if (result.success) {
                console.log(`✓ ${result.message}`);
            } else {
                console.log(`✗ ${result.message}`);
                process.exit(1);
            }
            break;
        }

        case 'restart': {
            console.log('🔄 Restarting Talon gateway...');
            
            const { stopGateway, isGatewayRunning } = await import('../gateway/process-manager.js');
            
            // Stop if running
            const status = await isGatewayRunning();
            if (status.running) {
                console.log('   Stopping old gateway...');
                const result = await stopGateway(true);
                if (!result.success) {
                    console.log(`   ✗ Failed to stop: ${result.message}`);
                    process.exit(1);
                }
                console.log('   ✓ Stopped');
                // Wait for port to be freed
                await new Promise(r => setTimeout(r, 1000));
            }
            
            // Start new gateway
            console.log('   Starting new gateway...');
            process.argv = ['node', 'talon', 'gateway'];
            process.env.LOG_LEVEL = 'silent';
            process.env.TALON_CLI_ENABLED = 'false';
            
            await import('../gateway/index.js');
            
            console.log('✓ Talon gateway restarted');
            console.log('   HTTP:      http://127.0.0.1:19789');
            console.log('   WebSocket: ws://127.0.0.1:19789/ws');
            
            // Keep process alive
            await new Promise(() => { });
            break;
        }

        case 'service': {
            const { installService, uninstallService, restartService, serviceStatus, stopService, startService } = await import('./service.js');
            const subcommand = flags[0];

            switch (subcommand) {
                case 'install':
                    await installService();
                    break;
                case 'uninstall':
                    await uninstallService();
                    break;
                case 'restart':
                    await restartService();
                    break;
                case 'stop':
                    await stopService();
                    break;
                case 'start':
                    await startService();
                    break;
                case 'status':
                    await serviceStatus();
                    break;
                default:
                    console.error('Usage: talon service <install|uninstall|start|stop|restart|status>');
                    process.exit(1);
            }
            break;
        }

        case 'tui': {
            console.log('Starting Interactive TUI (Readline)...');
            const { startTUI } = await import('./tui.js');
            await startTUI();
            break;
        }

        case 'provider': {
            const { addProvider } = await import('./provider.js');
            await addProvider();
            break;
        }

        case 'switch': {
            const { switchModel } = await import('./provider.js');
            await switchModel();
            break;
        }

        default: {
            console.error(`Unknown command: ${command}`);
            console.error('Run `talon --help` for available commands.');
            process.exit(1);
        }
    }
}

main().catch((err) => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
