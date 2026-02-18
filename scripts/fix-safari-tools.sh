#!/bin/bash
# ─── Talon Safari Tools Diagnostic & Fix Script ───────────────────

echo "🔍 Talon Safari Tools Diagnostic"
echo "================================"
echo ""

# 1. Kill all processes on port 19789
echo "1. Killing processes on port 19789..."
lsof -ti :19789 | xargs kill -9 2>/dev/null || echo "   No processes found"
echo "   ✓ Port cleared"
echo ""

# 2. Check if dist files exist
echo "2. Checking compiled files..."
if [ -f "dist/tools/apple-safari.js" ]; then
    echo "   ✓ apple-safari.js exists"
    grep -q "apple_safari_navigate" dist/tools/apple-safari.js && echo "   ✓ Tools exported correctly"
else
    echo "   ✗ apple-safari.js NOT FOUND"
fi

if [ -f "dist/tools/registry.js" ]; then
    echo "   ✓ registry.js exists"
    grep -q "appleSafariTools" dist/tools/registry.js && echo "   ✓ Safari tools imported in registry"
else
    echo "   ✗ registry.js NOT FOUND"
fi
echo ""

# 3. Clean rebuild
echo "3. Cleaning and rebuilding..."
rm -rf dist/
npm run build 2>&1 | tail -5
echo "   ✓ Build complete"
echo ""

# 4. Verify build
echo "4. Verifying build..."
if [ -f "dist/tools/apple-safari.js" ]; then
    echo "   ✓ Safari tools compiled"
    safari_tools=$(grep -c "name: 'apple_safari" dist/tools/apple-safari.js)
    echo "   ✓ Found $safari_tools Safari tools"
else
    echo "   ✗ Build failed"
    exit 1
fi
echo ""

# 5. Check system prompt
echo "5. Checking system prompt..."
if grep -q "apple_safari_navigate" dist/agent/prompts.js; then
    echo "   ✓ Safari tools mentioned in system prompt"
else
    echo "   ✗ Safari tools NOT in system prompt"
fi
echo ""

echo "================================"
echo "✓ Diagnostic complete!"
echo ""
echo "Next steps:"
echo "1. Start gateway: npm start"
echo "2. In new terminal: talon tui"
echo "3. Ask: 'List all available tools'"
echo ""
echo "Safari tools should now appear under 'APPLE (macOS)' section"
