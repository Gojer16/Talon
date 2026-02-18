// src/tui/hooks/use-keyboard.ts
import { useInput } from 'ink';
import { useCallback } from 'react';

export interface KeyboardShortcuts {
  onCtrlC?: () => void;
  onCtrlD?: () => void;
  onCtrlG?: () => void;
  onCtrlL?: () => void;
  onCtrlO?: () => void;
  onCtrlP?: () => void;
  onCtrlT?: () => void;
  onShiftTab?: () => void;
  onEscape?: () => void;
  isActive?: boolean; // Only capture when active (e.g., in overlay)
}

export function useKeyboard(shortcuts: KeyboardShortcuts) {
  const { isActive = true } = shortcuts;
  
  useInput(
    useCallback(
      (input, key) => {
        // Only handle shortcuts, not regular typing
        // Let TextInput handle regular input
        
        if (key.ctrl && input === 'c') {
          shortcuts.onCtrlC?.();
          return;
        }

        if (key.ctrl && input === 'd') {
          shortcuts.onCtrlD?.();
          return;
        }

        if (key.ctrl && input === 'g') {
          shortcuts.onCtrlG?.();
          return;
        }

        if (key.ctrl && input === 'l') {
          shortcuts.onCtrlL?.();
          return;
        }

        if (key.ctrl && input === 'o') {
          shortcuts.onCtrlO?.();
          return;
        }

        if (key.ctrl && input === 'p') {
          shortcuts.onCtrlP?.();
          return;
        }

        if (key.ctrl && input === 't') {
          shortcuts.onCtrlT?.();
          return;
        }

        if (key.shift && key.tab) {
          shortcuts.onShiftTab?.();
          return;
        }

        if (key.escape) {
          shortcuts.onEscape?.();
          return;
        }
        
        // Don't consume other input - let it pass through to TextInput
      },
      [shortcuts]
    ),
    { isActive } // Only active when specified
  );
}
