// src/tui/index.tsx
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

const GATEWAY_URL = 'ws://127.0.0.1:19789/ws';

export async function startInkTUI(): Promise<void> {
  // Check if stdin is a TTY (required for Ink)
  if (!process.stdin.isTTY) {
    console.error(chalk.red('✗ Error: Ink TUI requires an interactive terminal'));
    console.error(chalk.dim('  This command must be run in a terminal, not piped or redirected'));
    console.error(chalk.dim('  Try running: talon tui-legacy (for non-TTY environments)\n'));
    process.exit(1);
  }

  console.clear();

  // Check if gateway is running
  try {
    const healthCheck = await fetch('http://127.0.0.1:19789/api/health');
    if (!healthCheck.ok) {
      console.log(chalk.red('✗ Gateway is not responding'));
      console.log(chalk.dim('  Run `talon service start` or `talon start --daemon`\n'));
      process.exit(1);
    }
  } catch {
    console.log(chalk.red('✗ Gateway is not running'));
    console.log(chalk.dim('  Run `talon service start` or `talon start --daemon`\n'));
    process.exit(1);
  }

  // Load config
  const configPath = path.join(os.homedir(), '.talon', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // Render Ink app
  const { waitUntilExit } = render(
    <App
      gatewayUrl={GATEWAY_URL}
      initialModel={config.agent.model}
      workspaceRoot={config.workspace.root}
    />
  );

  await waitUntilExit();
}
