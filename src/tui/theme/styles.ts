// src/tui/theme/styles.ts
import { colors } from './colors.js';

export const styles = {
  box: {
    borderStyle: 'round' as const,
    borderColor: colors.border,
    padding: 1,
  },
  
  userMessage: {
    borderStyle: 'round' as const,
    borderColor: colors.accent,
    padding: 1,
  },
  
  assistantMessage: {
    borderStyle: 'round' as const,
    borderColor: colors.dim,
    padding: 1,
  },
  
  toolCard: {
    borderStyle: 'round' as const,
    borderColor: colors.toolTitle,
    padding: 1,
  },
  
  overlay: {
    borderStyle: 'double' as const,
    borderColor: colors.accent,
    padding: 2,
  },
};
