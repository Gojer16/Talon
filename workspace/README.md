# Workspace Directory

⚠️ **This directory is for local development only and should remain empty in the repository.**

## What is this?

This directory exists to maintain the project structure, but **user workspace files are stored in `~/.talon/workspace/`** (your home directory).

## Why is it empty?

User workspace files contain **personal data**:
- Your name, preferences, and timezone (`USER.md`)
- AI personality and identity (`IDENTITY.md`, `SOUL.md`)
- Personal memories and notes (`MEMORY.md`, `memory/`)
- Tasks, calendar events, and reminders

**These files must NEVER be committed to the repository.**

## Where are my files?

Your actual workspace files are in:
```
~/.talon/workspace/
```

This location is:
- ✅ Gitignored (safe from accidental commits)
- ✅ Private to your user account
- ✅ Persistent across repository updates
- ✅ Backed up with your home directory

## Template Files

Clean template files (without personal data) are stored in:
```
templates/workspace/
```

These templates are copied to `~/.talon/workspace/` on first run.

## Security

This separation ensures:
1. **Privacy**: Your personal data never enters version control
2. **Safety**: Cloning the repo doesn't expose anyone's data
3. **Portability**: Each user gets their own isolated workspace

## Migration

If you have files in this directory from an older version, run:
```bash
./scripts/migrate-workspace.sh
```

This will safely move your files to `~/.talon/workspace/` and clean this directory.
