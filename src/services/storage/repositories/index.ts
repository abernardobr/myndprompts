// Export all repositories
export { BaseRepository } from './base.repository';
export { AuthRepository, getAuthRepository } from './auth.repository';
export {
  ConfigRepository,
  getConfigRepository,
  ConfigKeys,
  type ConfigKey,
} from './config.repository';
export { UIStateRepository, getUIStateRepository } from './ui-state.repository';
export { RecentFilesRepository, getRecentFilesRepository } from './recent-files.repository';
export { SyncStatusRepository, getSyncStatusRepository } from './sync-status.repository';
export { GitStatusRepository, getGitStatusRepository } from './git-status.repository';
export { AIProvidersRepository, getAIProvidersRepository } from './ai-providers.repository';
export { ProjectIndexRepository, getProjectIndexRepository } from './project-index.repository';
export { ProjectRepository, getProjectRepository } from './project.repository';

// File Sync repositories
export { ProjectFolderRepository, getProjectFolderRepository } from './project-folder.repository';
export { FileIndexRepository, getFileIndexRepository } from './file-index.repository';
