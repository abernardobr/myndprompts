/**
 * Export/Import Types and Interfaces
 *
 * This file defines the TypeScript interfaces and types used across
 * the export/import functionality for MyndPrompts.
 */

// ============================================================================
// Constants (defined first as they're used by types below)
// ============================================================================

/**
 * Current export format version.
 * Increment when making breaking changes to the export format.
 */
export const EXPORT_FORMAT_VERSION = '1.0.0';

/**
 * Error codes for export/import operations.
 * These codes help identify specific failure modes.
 */
export const ERROR_CODES = {
  /** File does not exist at the specified path */
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  /** File is not a valid ZIP archive */
  INVALID_ZIP: 'INVALID_ZIP',
  /** ZIP is missing the index.json manifest */
  MISSING_MANIFEST: 'MISSING_MANIFEST',
  /** Manifest JSON is malformed or invalid */
  INVALID_MANIFEST: 'INVALID_MANIFEST',
  /** Export version is not compatible with current app */
  VERSION_INCOMPATIBLE: 'VERSION_INCOMPATIBLE',
  /** Failed to write to the destination path */
  WRITE_ERROR: 'WRITE_ERROR',
  /** Permission denied when accessing file or directory */
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  /** ZIP file is corrupted or cannot be extracted */
  CORRUPTED_ZIP: 'CORRUPTED_ZIP',
  /** ZIP file is empty (0 bytes) */
  EMPTY_FILE: 'EMPTY_FILE',
  /** File size exceeds the maximum limit */
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  /** Checksum verification failed */
  CHECKSUM_MISMATCH: 'CHECKSUM_MISMATCH',
  /** Unknown or unexpected error */
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Maximum file size for import (100 MB)
 */
export const MAX_IMPORT_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Warning threshold for large exports (50 MB)
 */
export const LARGE_FILE_WARNING_SIZE = 50 * 1024 * 1024;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Error code type for export/import operations.
 */
export type ExportImportErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Conflict resolution strategies when importing files that already exist.
 * - skip: Keep existing file, don't import
 * - replace: Overwrite existing with imported file
 * - rename: Import with suffix (e.g., `prompt (imported).md`)
 */
export type ConflictResolution = 'skip' | 'replace' | 'rename';

/**
 * File types that can be exported/imported.
 */
export type ExportFileType = 'prompt' | 'snippet' | 'persona' | 'template' | 'project' | 'other';

/**
 * Individual file entry in the export manifest.
 * Contains metadata about each file included in the export.
 */
export interface IExportFileEntry {
  /** Path relative to base directory (e.g., "prompts/folder1/prompt.md") */
  relativePath: string;

  /** Type of file based on its location */
  type: ExportFileType;

  /** File size in bytes */
  size: number;

  /** Optional MD5/SHA256 hash for integrity verification */
  checksum?: string;

  /** Optional metadata extracted from frontmatter */
  metadata?: {
    id?: string;
    title?: string;
    category?: string;
    tags?: string[];
  };
}

/**
 * Statistics about the export/import operation.
 */
export interface IExportStatistics {
  /** Total number of files */
  totalFiles: number;

  /** Number of prompt files */
  prompts: number;

  /** Number of snippet files */
  snippets: number;

  /** Number of persona files */
  personas: number;

  /** Number of template files */
  templates: number;

  /** Number of project files/configs */
  projects: number;
}

/**
 * The structure of index.json in the export ZIP.
 * This manifest provides metadata about the export and lists all included files.
 */
export interface IExportManifest {
  /** Export format version (e.g., "1.0.0") */
  version: string;

  /** ISO timestamp when the export was created */
  exportedAt: string;

  /** MyndPrompts app version that created the export */
  appVersion: string;

  /** Statistics about the exported content */
  statistics: IExportStatistics;

  /** List of all files included in the export */
  files: IExportFileEntry[];
}

/**
 * Options for the export operation.
 * Allows selective export of different content types.
 */
export interface IExportOptions {
  /** Include prompt files (default: true) */
  includePrompts?: boolean;

  /** Include snippet files (default: true) */
  includeSnippets?: boolean;

  /** Include persona files (default: true) */
  includePersonas?: boolean;

  /** Include template files (default: true) */
  includeTemplates?: boolean;

  /** Include project files (default: true) */
  includeProjects?: boolean;

  /** Generate checksums for integrity verification (default: false) */
  generateChecksums?: boolean;
}

/**
 * Options for the import operation.
 * Configures how conflicts are handled and where files are imported.
 */
export interface IImportOptions {
  /** Strategy for handling files that already exist */
  conflictResolution?: ConflictResolution;

  /** Optional target directory (defaults to base storage dir) */
  targetDirectory?: string;

  /** Validate checksums if present in manifest (default: false) */
  validateChecksums?: boolean;
}

/**
 * Result of an export operation.
 */
export interface IExportResult {
  /** Whether the export completed successfully */
  success: boolean;

  /** Error message if the export failed */
  error?: string;

  /** Error code for programmatic handling */
  errorCode?: ExportImportErrorCode;

  /** Path to the exported ZIP file */
  path?: string;

  /** Statistics about the exported content */
  statistics?: IExportStatistics;
}

/**
 * Information about a conflict that was resolved during import.
 */
export interface IImportConflict {
  /** Original path of the conflicting file */
  path: string;

  /** How the conflict was resolved */
  resolution: ConflictResolution;

  /** New path if the file was renamed */
  newPath?: string;
}

/**
 * Result of an import operation.
 */
export interface IImportResult {
  /** Whether the import completed successfully */
  success: boolean;

  /** Error message if the import failed */
  error?: string;

  /** Error code for programmatic handling */
  errorCode?: ExportImportErrorCode;

  /** Statistics about the imported content */
  imported: IExportStatistics;

  /** Number of files that were skipped */
  skipped: number;

  /** List of conflicts that were resolved */
  conflicts: IImportConflict[];
}

/**
 * Phases of the export operation for progress tracking.
 */
export type ExportPhase = 'reading' | 'compressing' | 'writing';

/**
 * Phases of the import operation for progress tracking.
 */
export type ImportPhase = 'extracting' | 'validating' | 'copying';

/**
 * Progress information during an export operation.
 */
export interface IExportProgress {
  /** Current phase of the export */
  phase: ExportPhase;

  /** Current progress count */
  current: number;

  /** Total items to process */
  total: number;

  /** Name of the file currently being processed */
  currentFile?: string;
}

/**
 * Progress information during an import operation.
 */
export interface IImportProgress {
  /** Current phase of the import */
  phase: ImportPhase;

  /** Current progress count */
  current: number;

  /** Total items to process */
  total: number;

  /** Name of the file currently being processed */
  currentFile?: string;
}

/**
 * A validation error with optional error code.
 */
export interface IValidationError {
  /** Human-readable error message */
  message: string;

  /** Error code for programmatic handling */
  code?: ExportImportErrorCode;
}

/**
 * Result of validating an export ZIP file.
 */
export interface IValidationResult {
  /** Whether the ZIP file is valid */
  valid: boolean;

  /** List of validation errors found (strings for backward compatibility) */
  errors: string[];

  /** Detailed validation errors with codes */
  validationErrors?: IValidationError[];

  /** Warnings (non-fatal issues) */
  warnings?: string[];
}

/**
 * Default export options.
 */
export const DEFAULT_EXPORT_OPTIONS: Required<IExportOptions> = {
  includePrompts: true,
  includeSnippets: true,
  includePersonas: true,
  includeTemplates: true,
  includeProjects: true,
  generateChecksums: false,
};

/**
 * Default import options.
 */
export const DEFAULT_IMPORT_OPTIONS: Required<IImportOptions> = {
  conflictResolution: 'rename',
  targetDirectory: '',
  validateChecksums: false,
};

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Custom error class for export operations.
 * Includes an error code for programmatic handling.
 */
export class ExportError extends Error {
  public readonly code: ExportImportErrorCode;

  constructor(message: string, code: ExportImportErrorCode = ERROR_CODES.UNKNOWN_ERROR) {
    super(message);
    this.name = 'ExportError';
    this.code = code;
  }
}

/**
 * Custom error class for import operations.
 * Includes an error code for programmatic handling.
 */
export class ImportError extends Error {
  public readonly code: ExportImportErrorCode;

  constructor(message: string, code: ExportImportErrorCode = ERROR_CODES.UNKNOWN_ERROR) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}
