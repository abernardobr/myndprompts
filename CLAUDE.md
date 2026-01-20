# MyndPrompts - Development Notes

## CRITICAL: Two Electron Entry Points

This project has **TWO** electron main process entry points. When adding IPC handlers, you MUST add them to BOTH files:

1. `src/electron/main/index.ts` - Development entry point
2. `src-electron/electron-main.ts` - Production/Quasar entry point

Both files use the same services from `src/electron/main/services/`.

### Example: Adding a new IPC handler

```typescript
// Add to BOTH files:
ipcMain.handle('fs:my-new-handler', async (_event, arg: string) => {
  return fileSystemService.myNewMethod(arg);
});
```

### Checklist for new IPC handlers:

- [ ] Add method to service file (e.g., `src/electron/main/services/file-system.service.ts`)
- [ ] Add IPC handler to `src/electron/main/index.ts`
- [ ] Add IPC handler to `src-electron/electron-main.ts`
- [ ] Add type to preload interface in `src/electron/preload/index.ts`
- [ ] Add implementation to preload in `src/electron/preload/index.ts`

## Project Structure

- `src/` - Vue 3 + Quasar frontend
- `src/electron/` - Electron-specific code (main process, preload)
- `src-electron/` - Quasar's electron integration (production build)
- `src/services/` - Frontend services
- `src/stores/` - Pinia stores
- `src/components/` - Vue components
