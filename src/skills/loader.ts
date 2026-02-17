// ─── Skill Loader ─────────────────────────────────────────────────
// Loads and initializes skills from the skills directory

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { logger } from '../utils/logger.js';
import type { TalonConfig } from '../config/schema.js';

export interface SkillManifest {
    /** Unique identifier for the skill */
    id: string;
    /** Human-readable name */
    name: string;
    /** Short description */
    description: string;
    /** Version string */
    version: string;
    /** Author information */
    author?: string;
    /** Dependencies on other skills */
    dependencies?: string[];
    /** Whether the skill is enabled by default */
    enabled?: boolean;
}

export interface SkillModule {
    /** Called when skill is loaded */
    initialize?: (config: TalonConfig) => Promise<void> | void;
    /** Called when skill is unloaded */
    cleanup?: () => Promise<void> | void;
    /** Skill manifest */
    manifest: SkillManifest;
}

// ─── Skill Registry ───────────────────────────────────────────────

class SkillRegistry {
    private skills = new Map<string, SkillModule>();
    private loadedSkills = new Set<string>();

    /**
     * Load a skill from a directory
     */
    async loadSkill(skillDir: string): Promise<boolean> {
        const manifestPath = path.join(skillDir, 'skill.json');
        
        if (!fs.existsSync(manifestPath)) {
            logger.warn(`Skill directory ${skillDir} has no skill.json manifest`);
            return false;
        }
        
        try {
            const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
            const manifest: SkillManifest = JSON.parse(manifestContent);
            
            // Check if already loaded
            if (this.skills.has(manifest.id)) {
                logger.warn(`Skill "${manifest.id}" is already loaded`);
                return false;
            }
            
            // Check dependencies
            if (manifest.dependencies) {
                const missingDeps = manifest.dependencies.filter(dep => !this.skills.has(dep));
                if (missingDeps.length > 0) {
                    logger.warn(`Skill "${manifest.id}" missing dependencies: ${missingDeps.join(', ')}`);
                    return false;
                }
            }
            
            // Try to load the skill module
            const modulePath = path.join(skillDir, 'index.js');
            if (!fs.existsSync(modulePath)) {
                logger.warn(`Skill "${manifest.id}" has no index.js module`);
                return false;
            }
            
            // In a real implementation, we would dynamically import the module
            // For now, we'll create a placeholder and skills will register commands directly
            const skillModule: SkillModule = {
                manifest,
                // initialize and cleanup will be called by the skill itself
            };
            
            this.skills.set(manifest.id, skillModule);
            this.loadedSkills.add(manifest.id);
            
            logger.info(`Loaded skill: ${manifest.name} v${manifest.version}`);
            return true;
            
            this.skills.set(manifest.id, skillModule);
            this.loadedSkills.add(manifest.id);
            
            logger.info(`Loaded skill: ${manifest.name} v${manifest.version}`);
            return true;
            
        } catch (error) {
            logger.error(error, `Failed to load skill from ${skillDir}:`);
            return false;
        }
    }

    /**
     * Load all skills from a directory
     */
    async loadSkillsFromDir(skillsDir: string): Promise<string[]> {
        if (!fs.existsSync(skillsDir)) {
            logger.info(`Skills directory does not exist: ${skillsDir}`);
            return [];
        }
        
        const loaded: string[] = [];
        
        try {
            const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const skillDir = path.join(skillsDir, entry.name);
                    const success = await this.loadSkill(skillDir);
                    
                    if (success) {
                        loaded.push(entry.name);
                    }
                }
            }
            
            logger.info(`Loaded ${loaded.length} skills from ${skillsDir}`);
            return loaded;
            
        } catch (error) {
            logger.error(error, `Failed to load skills from ${skillsDir}:`);
            return [];
        }
    }

    /**
     * Get a loaded skill by ID
     */
    getSkill(id: string): SkillModule | undefined {
        return this.skills.get(id);
    }

    /**
     * Get all loaded skills
     */
    getAllSkills(): SkillModule[] {
        return Array.from(this.skills.values());
    }

    /**
     * Check if a skill is loaded
     */
    isLoaded(id: string): boolean {
        return this.loadedSkills.has(id);
    }

    /**
     * Unload a skill
     */
    async unloadSkill(id: string): Promise<boolean> {
        const skill = this.skills.get(id);
        if (!skill) return false;
        
        try {
            // Call cleanup if defined
            if (skill.cleanup) {
                await skill.cleanup();
            }
            
            this.skills.delete(id);
            this.loadedSkills.delete(id);
            
            logger.info(`Unloaded skill: ${id}`);
            return true;
            
        } catch (error) {
            logger.error(error, `Failed to unload skill ${id}:`);
            return false;
        }
    }

    /**
     * Unload all skills
     */
    async unloadAll(): Promise<void> {
        const skillIds = Array.from(this.skills.keys());
        
        for (const id of skillIds) {
            await this.unloadSkill(id);
        }
    }
}

// ─── Global Instance ──────────────────────────────────────────────

export const skillRegistry = new SkillRegistry();

// ─── Helper Functions ─────────────────────────────────────────────

/**
 * Get the skills directory path from config
 */
export function getSkillsDir(config: TalonConfig): string {
    const skillsDir = config.workspace.skillsDir;
    
    // Resolve ~ to home directory
    if (skillsDir.startsWith('~')) {
        return path.join(os.homedir(), skillsDir.slice(1));
    }
    
    // Resolve relative paths relative to TALON_HOME
    if (!path.isAbsolute(skillsDir)) {
        const talonHome = path.join(os.homedir(), '.talon');
        return path.join(talonHome, skillsDir);
    }
    
    return skillsDir;
}

/**
 * Initialize all skills
 */
export async function initializeSkills(config: TalonConfig): Promise<void> {
    const skillsDir = getSkillsDir(config);
    
    if (!fs.existsSync(skillsDir)) {
        // Create directory if it doesn't exist
        fs.mkdirSync(skillsDir, { recursive: true });
        logger.info(`Created skills directory: ${skillsDir}`);
        return;
    }
    
    await skillRegistry.loadSkillsFromDir(skillsDir);
}