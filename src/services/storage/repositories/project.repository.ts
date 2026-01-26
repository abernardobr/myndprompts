import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IProject } from '../entities';

/**
 * Repository for managing project metadata in IndexedDB.
 * Projects are directories on the file system, but metadata is stored here.
 */
export class ProjectRepository extends BaseRepository<IProject, string> {
  private static instance: ProjectRepository | null = null;

  private constructor() {
    super(getDB().projects);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ProjectRepository {
    if (!ProjectRepository.instance) {
      ProjectRepository.instance = new ProjectRepository();
    }
    return ProjectRepository.instance;
  }

  /**
   * Get a project by its folder path (primary key)
   */
  async getByFolderPath(folderPath: string): Promise<IProject | undefined> {
    return this.table.get(folderPath);
  }

  /**
   * Create a new project
   */
  async createProject(folderPath: string, name: string, description?: string): Promise<IProject> {
    const now = new Date();
    const project: IProject = {
      id: uuidv4(),
      folderPath,
      name,
      description,
      associatedFolders: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.upsert(project);
    return project;
  }

  /**
   * Update an existing project
   */
  async updateProject(
    folderPath: string,
    updates: Partial<Omit<IProject, 'id' | 'folderPath' | 'createdAt'>>
  ): Promise<IProject> {
    const existing = await this.getByFolderPath(folderPath);
    if (!existing) {
      throw new Error(`Project not found: ${folderPath}`);
    }

    const updatedProject: IProject = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await this.upsert(updatedProject);
    return updatedProject;
  }

  /**
   * Update project folder path (when project is renamed/moved)
   */
  async updateProjectPath(
    oldFolderPath: string,
    newFolderPath: string,
    newName?: string
  ): Promise<IProject> {
    const existing = await this.getByFolderPath(oldFolderPath);
    if (!existing) {
      throw new Error(`Project not found: ${oldFolderPath}`);
    }

    // Delete old entry
    await this.delete(oldFolderPath);

    // Create new entry with updated path
    const updatedProject: IProject = {
      ...existing,
      folderPath: newFolderPath,
      name: newName ?? existing.name,
      updatedAt: new Date(),
    };

    await this.upsert(updatedProject);
    return updatedProject;
  }

  /**
   * Delete a project by folder path
   */
  async deleteProject(folderPath: string): Promise<void> {
    await this.delete(folderPath);
  }

  /**
   * Get all projects
   */
  async getAllProjects(): Promise<IProject[]> {
    return this.table.orderBy('createdAt').reverse().toArray();
  }

  /**
   * Search projects by name or tags
   */
  async searchProjects(query: string): Promise<IProject[]> {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
      return this.getAllProjects();
    }

    return this.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        (p.description?.toLowerCase().includes(lowerQuery) ?? false) ||
        p.tags.some((t) => t.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get projects by tag
   */
  async getProjectsByTag(tag: string): Promise<IProject[]> {
    const lowerTag = tag.toLowerCase();
    return this.filter((p) => p.tags.some((t) => t.toLowerCase() === lowerTag));
  }

  /**
   * Add a tag to a project
   */
  async addTag(folderPath: string, tag: string): Promise<IProject> {
    const project = await this.getByFolderPath(folderPath);
    if (!project) {
      throw new Error(`Project not found: ${folderPath}`);
    }

    if (!project.tags.includes(tag)) {
      return this.updateProject(folderPath, {
        tags: [...project.tags, tag],
      });
    }

    return project;
  }

  /**
   * Remove a tag from a project
   */
  async removeTag(folderPath: string, tag: string): Promise<IProject> {
    const project = await this.getByFolderPath(folderPath);
    if (!project) {
      throw new Error(`Project not found: ${folderPath}`);
    }

    return this.updateProject(folderPath, {
      tags: project.tags.filter((t) => t !== tag),
    });
  }

  /**
   * Add an associated folder to a project
   */
  async addAssociatedFolder(folderPath: string, associatedPath: string): Promise<IProject> {
    const project = await this.getByFolderPath(folderPath);
    if (!project) {
      throw new Error(`Project not found: ${folderPath}`);
    }

    if (!project.associatedFolders.includes(associatedPath)) {
      return this.updateProject(folderPath, {
        associatedFolders: [...project.associatedFolders, associatedPath],
      });
    }

    return project;
  }

  /**
   * Remove an associated folder from a project
   */
  async removeAssociatedFolder(folderPath: string, associatedPath: string): Promise<IProject> {
    const project = await this.getByFolderPath(folderPath);
    if (!project) {
      throw new Error(`Project not found: ${folderPath}`);
    }

    return this.updateProject(folderPath, {
      associatedFolders: project.associatedFolders.filter((f) => f !== associatedPath),
    });
  }

  /**
   * Check if a folder path is a project
   */
  async isProject(folderPath: string): Promise<boolean> {
    const project = await this.getByFolderPath(folderPath);
    return project !== undefined;
  }

  /**
   * Migrate project paths to the new storage location
   * This handles the case where storage location has changed by updating paths
   * instead of removing the projects
   * @returns Object with migrated count and removed count (only removed if not found in new location)
   */
  async migrateProjectPaths(): Promise<{ migrated: number; removed: number }> {
    // Only works in Electron environment
    if (!window?.fileSystemAPI) {
      return { migrated: 0, removed: 0 };
    }

    const allProjects = await this.getAllProjects();
    const config = await window.fileSystemAPI.getConfig();
    const currentPromptsDir = config.promptsDir;

    let migrated = 0;
    let removed = 0;

    for (const project of allProjects) {
      try {
        // Check if the path is within the current base directory
        const isPathAllowed = await window.fileSystemAPI.isPathAllowed(project.folderPath);
        if (isPathAllowed) {
          // Path is valid, no migration needed
          continue;
        }

        // Path is outside the current storage location - try to migrate
        // Extract the relative path after "/prompts/"
        const promptsIndex = project.folderPath.lastIndexOf('/prompts/');
        if (promptsIndex === -1) {
          // Can't determine relative path, remove the project
          console.warn(`Cannot migrate project (no /prompts/ in path): ${project.folderPath}`);
          await this.delete(project.folderPath);
          removed++;
          continue;
        }

        // Get the relative path (everything after "/prompts/")
        const relativePath = project.folderPath.substring(promptsIndex + '/prompts/'.length);
        const newPath = `${currentPromptsDir}/${relativePath}`;

        // Check if the new path exists
        const newPathExists = await window.fileSystemAPI.directoryExists(newPath);
        if (newPathExists) {
          // Migrate the project to the new path
          console.log(`Migrating project from ${project.folderPath} to ${newPath}`);

          // Delete old entry (since folderPath is the primary key)
          await this.delete(project.folderPath);

          // Create new entry with updated path
          const migratedProject: IProject = {
            ...project,
            folderPath: newPath,
            updatedAt: new Date(),
          };
          await this.upsert(migratedProject);
          migrated++;
        } else {
          // New path doesn't exist, remove the project entry
          console.warn(
            `Project directory not found in new location, removing: ${project.folderPath}`
          );
          await this.delete(project.folderPath);
          removed++;
        }
      } catch (err) {
        // If we can't migrate, log and remove
        console.error(`Failed to migrate project ${project.folderPath}:`, err);
        await this.delete(project.folderPath);
        removed++;
      }
    }

    return { migrated, removed };
  }

  /**
   * Clear all projects from IndexedDB
   * Used when storage location changes and all paths become invalid
   */
  async clearAll(): Promise<void> {
    const allProjects = await this.getAllProjects();
    for (const project of allProjects) {
      await this.delete(project.folderPath);
    }
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    ProjectRepository.instance = null;
  }
}

// Export a convenience function to get the repository
export function getProjectRepository(): ProjectRepository {
  return ProjectRepository.getInstance();
}
