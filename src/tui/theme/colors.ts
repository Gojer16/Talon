// src/tui/theme/colors.ts
import chalk from 'chalk';

export const colors = {
  // Text
  text: '#E8E3D5',
  dim: '#7B7F87',
  accent: '#F6C453',
  accentSoft: '#F2A65A',
  
  // UI Elements
  border: '#3C414B',
  background: '#1E1E1E',
  
  // Messages
  userBg: '#2B2F36',
  userText: '#F3EEE0',
  assistantText: '#E8E3D5',
  systemText: '#9BA3B2',
  
  // Tools
  toolPendingBg: '#1F2A2F',
  toolSuccessBg: '#1E2D23',
  toolErrorBg: '#2F1F1F',
  toolTitle: '#F6C453',
  toolOutput: '#E1DACB',
  
  // Markdown
  quote: '#8CC8FF',
  quoteBorder: '#3B4D6B',
  code: '#F0C987',
  codeBlock: '#1E232A',
  codeBorder: '#343A45',
  link: '#7DD3A5',
  
  // Status
  error: '#F97066',
  success: '#7DD3A5',
  warning: '#F6C453',
  info: '#8CC8FF',
} as const;

export const theme = {
  text: chalk.hex(colors.text),
  dim: chalk.hex(colors.dim),
  accent: chalk.hex(colors.accent),
  accentSoft: chalk.hex(colors.accentSoft),
  error: chalk.hex(colors.error),
  success: chalk.hex(colors.success),
  warning: chalk.hex(colors.warning),
  info: chalk.hex(colors.info),
  userText: chalk.hex(colors.userText),
  assistantText: chalk.hex(colors.assistantText),
  systemText: chalk.hex(colors.systemText),
  toolTitle: chalk.hex(colors.toolTitle),
  toolOutput: chalk.hex(colors.toolOutput),
  quote: chalk.hex(colors.quote),
  code: chalk.hex(colors.code),
  link: chalk.hex(colors.link),
};
