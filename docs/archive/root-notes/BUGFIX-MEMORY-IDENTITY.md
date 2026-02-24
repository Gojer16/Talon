# Memory & Identity Bug Fixes

## Problem Summary

The Talon agent was not remembering user information (name, timezone) across sessions, even after being told. The agent kept asking the same questions repeatedly during bootstrap.

## Root Causes

### 1. **Incorrect Template Detection Logic**
The `isTemplateEmpty()` function in `src/agent/prompts.ts` was using incorrect string matching:
- Checked for `'**Name:**\n**What to call them:**\n'` but the actual format uses list items: `- **Name:**`
- The regex didn't account for the dash prefix in list-style fields
- Didn't properly parse field values after the colon

### 2. **Incomplete Workspace Seeding**
The setup wizard (`src/cli/wizard.ts`) only copied 2 files to the workspace:
- `SOUL.md`
- `FACTS.json`

But it was missing critical files:
- `USER.md` - stores user information
- `IDENTITY.md` - stores agent identity
- `BOOTSTRAP.md` - first-run instructions
- `MEMORY.md`, `AGENTS.md`, `TOOLS.md`, `HEARTBEAT.md`

### 3. **Unclear Bootstrap Instructions**
The bootstrap prompt didn't explicitly tell the agent to USE the `file_write` tool to persist information to disk.

## Fixes Applied

### Fix 1: Corrected Template Detection (`src/agent/prompts.ts`)

**Before:**
```typescript
if (user && !user.includes('**Name:**\n**What to call them:**\n')) {
    // Load user context
}
```

**After:**
```typescript
function isTemplateEmpty(content: string): boolean {
    // Check for template indicators
    const templateIndicators = [
        '*(pick something you like)*',
        '*(What do they care about?',
        '*(curated long-term memory)*',
        '*(Add anything useful',
    ];
    
    if (templateIndicators.some(indicator => content.includes(indicator))) {
        return true;
    }
    
    // Parse field lines with regex that handles list format
    const lines = content.split('\n');
    let hasAnyFilledField = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Match: - **FieldName:** value or **FieldName:** value
        const fieldMatch = line.match(/^-?\s*\*\*([^*]+):\*\*\s*(.*)$/);
        if (fieldMatch) {
            const fieldValue = fieldMatch[2].trim();
            
            // Skip optional fields or template markers
            if (fieldValue.includes('(optional)') || 
                fieldValue.startsWith('_') || 
                fieldValue.startsWith('*')) {
                continue;
            }
            
            // If there's actual content
            if (fieldValue && fieldValue.length > 0) {
                hasAnyFilledField = true;
                break;
            }
        }
    }
    
    return !hasAnyFilledField;
}

// Now use it consistently
if (user && !isTemplateEmpty(user)) {
    prompt += `\n\n## About the User\n\n${user}`;
}
```

### Fix 2: Complete Workspace Seeding (`src/cli/wizard.ts`)

**Before:**
```typescript
for (const file of ['SOUL.md', 'FACTS.json']) {
    // Copy template files
}
```

**After:**
```typescript
const templateFiles = [
    'SOUL.md',
    'FACTS.json',
    'USER.md',
    'IDENTITY.md',
    'BOOTSTRAP.md',
    'MEMORY.md',
    'AGENTS.md',
    'TOOLS.md',
    'HEARTBEAT.md',
];

for (const file of templateFiles) {
    // Copy all template files
}
```

### Fix 3: Explicit File Writing Instructions (`src/agent/prompts.ts`)

**Added to bootstrap prompt:**
```typescript
prompt = `## 🚀 SYSTEM BOOT — FIRST RUN SEQUENCE\n\n${bootstrapContent}\n\n## CRITICAL INSTRUCTIONS\n\nYou MUST use the file_write tool to update these files as you learn information:\n- USER.md — Fill in their name, timezone, and preferences\n- IDENTITY.md — Fill in your name, creature type, vibe, and emoji\n\nDo NOT just remember this information — you must WRITE it to the files so it persists across sessions.\n\nWhen a file is fully populated, it will be automatically loaded into your context on future sessions.`;
```

## Testing

Created `test-template-detection.mjs` to verify the logic:

```bash
$ node test-template-detection.mjs
Testing empty USER.md:
  Is template empty? true ✓
  Expected: true

Testing empty IDENTITY.md:
  Is template empty? true ✓
  Expected: true

Testing filled USER.md:
  Is template empty? false ✓
  Expected: false

Testing filled IDENTITY.md:
  Is template empty? false ✓
  Expected: false

✅ All tests passed!
```

## Expected Behavior After Fixes

1. **First Run (Bootstrap):**
   - Agent reads `BOOTSTRAP.md` instructions
   - Has a conversation to learn about user and itself
   - Uses `file_write` tool to populate `USER.md` and `IDENTITY.md`
   - Information persists to disk

2. **Subsequent Runs:**
   - Agent loads populated `USER.md` and `IDENTITY.md`
   - Remembers user's name (Orlando), timezone (America/New_York), etc.
   - Remembers its own identity (Talon, 🦅, etc.)
   - No longer asks the same questions

3. **Partial Bootstrap Recovery:**
   - If bootstrap was interrupted, agent sees what was already filled in
   - Doesn't ask questions that were already answered
   - Picks up where it left off

## Files Modified

1. `/Users/orlandoascanio/Desktop/PersonalOpenClawVersion/src/agent/prompts.ts`
   - Fixed `isTemplateEmpty()` function
   - Added explicit file writing instructions to bootstrap
   - Applied consistent template checking

2. `/Users/orlandoascanio/Desktop/PersonalOpenClawVersion/src/cli/wizard.ts`
   - Expanded template file seeding to include all workspace files

## Next Steps

1. Rebuild the project: `npm run build`
2. Test with a fresh workspace or reset existing one
3. Verify agent properly populates USER.md and IDENTITY.md during bootstrap
4. Confirm information persists across sessions
