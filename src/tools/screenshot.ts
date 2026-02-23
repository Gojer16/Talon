// ─── Desktop Screenshot Tool ──────────────────────────────────────
// Capture desktop screenshots (macOS/Linux/Windows)
// Includes Zod validation for output paths

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { z } from 'zod';
import type { ToolDefinition } from './registry.js';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

// ─── Input Validation Schema ──────────────────────────────────────

const ScreenshotSchema = z.object({
    outputPath: z.string()
        .trim()
        .max(500, 'Output path too long')
        .refine(
            (p) => !p || p.endsWith('.png'),
            'Output path must end with .png'
        )
        .optional(),
    returnBase64: z.boolean().optional().default(false),
});

/**
 * Validate that a path is safe (no path traversal outside allowed dirs)
 */
function validateOutputPath(outputPath: string | undefined): { valid: boolean; path: string; error?: string } {
    const timestamp = Date.now();
    const defaultPath = path.join(os.tmpdir(), `talon-screenshot-${timestamp}.png`);
    
    if (!outputPath) {
        return { valid: true, path: defaultPath };
    }
    
    // Check for path traversal
    if (outputPath.includes('..')) {
        return { valid: false, path: defaultPath, error: 'Path traversal not allowed (..)' };
    }
    
    // Resolve to absolute path
    const resolved = path.resolve(outputPath);
    
    // Ensure it's within safe directories (temp or home)
    const tmpDir = path.resolve(os.tmpdir());
    const homeDir = path.resolve(os.homedir());
    
    if (!resolved.startsWith(tmpDir) && !resolved.startsWith(homeDir)) {
        return { 
            valid: false, 
            path: defaultPath, 
            error: 'Output path must be in temp directory or home directory' 
        };
    }
    
    // Ensure it ends with .png
    if (!resolved.toLowerCase().endsWith('.png')) {
        return { valid: false, path: defaultPath, error: 'Output path must end with .png' };
    }
    
    return { valid: true, path: resolved };
}

/**
 * Capture a screenshot of the desktop
 */
async function captureScreenshot(outputPath?: string): Promise<string> {
    const platform = os.platform();
    const timestamp = Date.now();
    const defaultPath = outputPath || path.join(os.tmpdir(), `talon-screenshot-${timestamp}.png`);

    try {
        if (platform === 'darwin') {
            // macOS: use screencapture
            await execAsync(`screencapture -x "${defaultPath}"`);
        } else if (platform === 'linux') {
            // Linux: try scrot, then import (ImageMagick), then gnome-screenshot
            try {
                await execAsync(`scrot "${defaultPath}"`);
            } catch {
                try {
                    await execAsync(`import -window root "${defaultPath}"`);
                } catch {
                    await execAsync(`gnome-screenshot -f "${defaultPath}"`);
                }
            }
        } else if (platform === 'win32') {
            // Windows: use PowerShell
            const psScript = `
                Add-Type -AssemblyName System.Windows.Forms
                Add-Type -AssemblyName System.Drawing
                $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
                $bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
                $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
                $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
                $bitmap.Save("${defaultPath}")
                $graphics.Dispose()
                $bitmap.Dispose()
            `;
            await execAsync(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`);
        } else {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        // Verify file exists
        await fs.access(defaultPath);

        logger.info({ path: defaultPath, platform }, 'Screenshot captured');
        return defaultPath;
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        logger.error({ err, platform }, 'Screenshot failed');
        throw new Error(`Failed to capture screenshot: ${error}`);
    }
}

/**
 * Convert screenshot to base64 (optional)
 */
async function screenshotToBase64(imagePath: string): Promise<string> {
    const buffer = await fs.readFile(imagePath);
    return buffer.toString('base64');
}

export const desktopScreenshotTools: ToolDefinition[] = [
    {
        name: 'desktop_screenshot',
        description: 'Capture a screenshot of the entire desktop. Returns the file path to the saved screenshot. Useful for debugging UI issues, capturing error messages, or documenting the current state of the screen.',
        parameters: {
            type: 'object',
            properties: {
                outputPath: {
                    type: 'string',
                    description: 'Optional: Custom path to save the screenshot. If not provided, saves to temp directory with timestamp.',
                },
                returnBase64: {
                    type: 'boolean',
                    description: 'Optional: If true, returns base64-encoded image data instead of file path. Default: false',
                },
            },
            required: [],
        },
        execute: async (args) => {
            // Validate inputs
            let returnBase64: boolean;
            
            try {
                const parsed = ScreenshotSchema.parse(args);
                returnBase64 = parsed.returnBase64;
            } catch (error: any) {
                return `Error: ${error.errors?.[0]?.message || 'Invalid parameters'}`;
            }
            
            // Validate output path separately (custom validation)
            const outputPath = args.outputPath as string | undefined;
            const pathValidation = validateOutputPath(outputPath);
            
            if (!pathValidation.valid) {
                return `Error: Invalid output path: ${pathValidation.error}`;
            }

            try {
                const imagePath = await captureScreenshot(pathValidation.path);

                if (returnBase64) {
                    const base64 = await screenshotToBase64(imagePath);
                    return `Screenshot captured successfully.\n\nBase64 data (${base64.length} chars):\n${base64.substring(0, 100)}...\n\nFull path: ${imagePath}`;
                }

                return `Screenshot captured successfully.\n\nPath: ${imagePath}\n\nYou can view this file or use it for further processing.`;
            } catch (err) {
                const error = err instanceof Error ? err.message : String(err);
                return `Error capturing screenshot: ${error}\n\nMake sure screenshot tools are installed:\n- macOS: screencapture (built-in)\n- Linux: scrot, imagemagick, or gnome-screenshot\n- Windows: PowerShell (built-in)`;
            }
        },
    },
];
