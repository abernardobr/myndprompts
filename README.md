# MyndPrompts

**AI Prompt Manager - Desktop Application**

A powerful desktop application for managing, organizing, and optimizing prompts for AI coding tools. Built with Vue 3, Quasar, and Electron.

## Overview

MyndPrompts helps developers and prompt engineers efficiently manage their AI prompts with a familiar VSCode-like interface. Whether you're working with Claude, ChatGPT, Gemini, or other AI assistants, MyndPrompts provides the tools you need to organize, version control, and optimize your prompts.

### Key Features

- **VSCode-like Interface** - Familiar IDE layout with activity bar, sidebar, editor area, and panels
- **Monaco Editor** - Professional code editing with syntax highlighting and IntelliSense
- **Git Integration** - Full version control support for prompts and projects
- **Snippet Library** - Reusable personas, templates, code snippets, and text snippets
- **Multi-language** - Support for 10 languages (EN, PT, ES, FR, DE, IT, AR)
- **Cross-platform** - Runs on macOS, Windows, and Linux
- **Offline-first** - All data stored locally with optional sync capabilities

### Screenshots

_Coming soon_

## Export and Import

MyndPrompts allows you to export all your data as a ZIP archive and import it back later or on another machine.

### Exporting Data

1. Open Settings (gear icon in the sidebar or `Cmd/Ctrl + ,`)
2. Navigate to the **Storage** section
3. Click **Export All Data**
4. Choose a location to save the ZIP file
5. Wait for the export to complete

The export includes:

- All prompts with their folder structure
- Snippets
- Personas
- Templates
- Project configurations

### Importing Data

1. Open Settings
2. Navigate to the **Storage** section
3. Click **Import Data**
4. Select a previously exported ZIP file
5. Wait for the import to complete

> **Note:** If a file already exists with the same name, it will be renamed to avoid conflicts (e.g., `prompt.md` becomes `prompt (imported).md`).

### Export File Format

The export is a standard ZIP file containing:

- `index.json` - Manifest with file metadata and statistics
- `prompts/` - All prompt files
- `snippets/` - All snippet files
- `personas/` - All persona files
- `templates/` - All template files
- `projects/` - Project configurations

## Installation

### Prerequisites

- Node.js 20+
- npm or yarn

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/myndprompts.git
cd myndprompts

# Install dependencies
npm install

# Run in development mode
npm run dev:electron
```

### Building for Production

```bash
# Build for current platform
npm run build:electron

# Build for specific platforms
npm run build:electron:mac    # macOS
npm run build:electron:win    # Windows
npm run build:electron:linux  # Linux
npm run build:electron:all    # All platforms
```

## Documentation

### Architecture

For a comprehensive understanding of the project architecture, see:

- **[Architecture Document](documents/architecture/myndprompts.md)** - Full system architecture, component design, data flow, and technical details

### Quick Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│              MyndPrompts Application                 │
├─────────────────────────────────────────────────────┤
│  Vue 3 + Quasar (UI Layer)                          │
│  ├─ Components (28+ Vue components)                 │
│  ├─ Pinia Stores (8 state stores)                   │
│  └─ Services (File, Git, Storage)                   │
├─────────────────────────────────────────────────────┤
│  Electron (Desktop Integration)                      │
│  ├─ Main Process (Node.js services)                 │
│  ├─ Preload (Secure IPC bridge)                     │
│  └─ Renderer (Vue application)                      │
├─────────────────────────────────────────────────────┤
│  Data Layer                                          │
│  ├─ IndexedDB (Configuration, UI state)             │
│  ├─ File System (Prompts, Snippets)                 │
│  └─ Git (Version control)                           │
└─────────────────────────────────────────────────────┘
```

## Technology Stack

| Category        | Technologies                     |
| --------------- | -------------------------------- |
| Frontend        | Vue 3, TypeScript, Quasar, Pinia |
| Desktop         | Electron 40                      |
| Editor          | Monaco Editor                    |
| Storage         | Dexie (IndexedDB), File System   |
| Version Control | simple-git                       |
| Build           | Vite, electron-builder           |
| Testing         | Vitest                           |

## Roadmap

### v0.1.0 - Current Release

- [x] Core application framework
- [x] VSCode-like layout system
- [x] Monaco editor integration
- [x] Project and prompt management
- [x] Snippet library (personas, templates, code, text)
- [x] Git integration (init, commit, push, pull, branches)
- [x] Multi-language support (10 locales)
- [x] Theme support (light/dark/system)

### v0.2.0 - Enhanced Editing

- [ ] Prompt templates with variables
- [x] Auto-complete for snippets in editor
- [x] Split editor panes
- [ ] Diff viewer for prompt changes
- [x] Keyboard shortcuts customization

### v0.3.0 - AI Integration

- [ ] AI provider configuration (API keys)
- [ ] Direct prompt testing within app
- [ ] Response history and comparison
- [ ] Token counting and cost estimation
- [ ] AI-powered prompt suggestions

### v0.4.0 - Collaboration

- [ ] Cloud sync (optional)
- [x] Export/import prompt collections
- [ ] Share prompts via links
- [ ] Team workspaces

### v0.5.0 - Advanced Features

- [ ] Plugin system for extensibility
- [ ] Custom themes
- [ ] Prompt analytics and insights
- [ ] Batch prompt operations
- [ ] CLI tool for prompt management

### Future Considerations

- Real-time collaboration
- Prompt marketplace
- Integration with popular IDEs
- Mobile companion app

## Project Structure

```
myndprompts/
├── src/                    # Source code
│   ├── components/         # Vue components
│   ├── stores/            # Pinia state stores
│   ├── services/          # Business logic
│   ├── i18n/              # Translations
│   └── electron/          # Electron services
├── src-electron/          # Electron main entry
├── documents/             # Documentation
│   └── architecture/      # Architecture docs
└── scripts/               # Build scripts
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Vue.js](https://vuejs.org/) - The Progressive JavaScript Framework
- [Quasar Framework](https://quasar.dev/) - Build high-performance Vue.js apps
- [Electron](https://www.electronjs.org/) - Build cross-platform desktop apps
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - The code editor that powers VS Code

---

**MyndPrompts** - _Your AI Prompt Companion_
