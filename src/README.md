# 📁 src/ - Talon AI Assistant Source Code

## 🎯 What This Folder Does
Contains all source code for Talon - a personal AI assistant that's local-first, multi-channel, with agent loop and memory compression.

## 📁 Folder Structure
```
src/
├── agent/           # AI agent logic and providers
├── cli/             # Command-line interface
├── config/          # Configuration management
├── gateway/         # Main gateway/server
├── memory/          # Memory system with embeddings, cache, search
├── plugins/         # Plugin system for extensions
├── protocol/        # Communication protocols
├── shadow/          # Shadow/parallel execution system
├── storage/         # Data storage and persistence
├── subagents/       # Sub-agent management
├── tools/           # Tool definitions and implementations
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── web/             # Web interface/dashboard
```

## ⚠️ Important Constraints
- **TypeScript**: All code must be TypeScript with strict typing
- **Local-first**: Prioritize local execution over cloud services
- **Memory compression**: Implement memory optimization patterns
- **Multi-channel**: Support multiple communication channels (CLI, web, etc.)

## 🔌 Public Interfaces
- `Gateway` - Main server entry point (`src/gateway/`)
- `Agent` - AI agent system (`src/agent/`)
- `CLI` - Command-line interface (`src/cli/`)
- `MemorySystem` - Memory management (`src/memory/`)

## 🚀 Getting Started
1. Run `npm run dev` for development
2. Run `npm run build` to compile TypeScript
3. Run `npm start` to start the production server

## 📚 Documentation Strategy
Each subfolder contains its own `README.md` with specific details about that module's purpose, key files, and usage patterns.