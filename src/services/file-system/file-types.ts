/**
 * File Type Classification Service
 *
 * Provides centralized file type detection and classification for the MyndPrompts application.
 * Used to determine which viewer component should be used to display a file.
 */

/**
 * File categories supported by the application
 */
export enum FileCategory {
  /** Markdown files - use Monaco Editor */
  MARKDOWN = 'markdown',
  /** Code/text files - use Monaco Editor */
  CODE = 'code',
  /** Image files - use ImageViewer */
  IMAGE = 'image',
  /** Video files - use VideoPlayer */
  VIDEO = 'video',
  /** Audio files - use AudioPlayer */
  AUDIO = 'audio',
  /** Document files (Word, PDF, etc.) - use DocumentViewer */
  DOCUMENT = 'document',
  /** Spreadsheet files (Excel, CSV, etc.) - use SpreadsheetViewer */
  SPREADSHEET = 'spreadsheet',
  /** Unknown/unsupported files - use FallbackViewer */
  UNKNOWN = 'unknown',
}

/**
 * Information about a file type
 */
export interface IFileTypeInfo {
  /** The category this file belongs to */
  category: FileCategory;
  /** The file extension (lowercase, with dot) */
  extension: string;
  /** MIME type for the file */
  mimeType: string;
  /** Whether the file can be previewed in the app */
  canPreview: boolean;
  /** Material icon name for this file type */
  icon: string;
}

/**
 * Extension to category mappings
 */
const EXTENSION_CATEGORY_MAP: Record<string, FileCategory> = {
  // Markdown
  '.md': FileCategory.MARKDOWN,

  // Code/Text files
  '.js': FileCategory.CODE,
  '.jsx': FileCategory.CODE,
  '.ts': FileCategory.CODE,
  '.tsx': FileCategory.CODE,
  '.mjs': FileCategory.CODE,
  '.cjs': FileCategory.CODE,
  '.json': FileCategory.CODE,
  '.jsonc': FileCategory.CODE,
  '.html': FileCategory.CODE,
  '.htm': FileCategory.CODE,
  '.css': FileCategory.CODE,
  '.scss': FileCategory.CODE,
  '.sass': FileCategory.CODE,
  '.less': FileCategory.CODE,
  '.vue': FileCategory.CODE,
  '.svelte': FileCategory.CODE,
  '.py': FileCategory.CODE,
  '.pyw': FileCategory.CODE,
  '.rb': FileCategory.CODE,
  '.java': FileCategory.CODE,
  '.kt': FileCategory.CODE,
  '.kts': FileCategory.CODE,
  '.go': FileCategory.CODE,
  '.rs': FileCategory.CODE,
  '.c': FileCategory.CODE,
  '.h': FileCategory.CODE,
  '.cpp': FileCategory.CODE,
  '.cc': FileCategory.CODE,
  '.cxx': FileCategory.CODE,
  '.hpp': FileCategory.CODE,
  '.hxx': FileCategory.CODE,
  '.cs': FileCategory.CODE,
  '.swift': FileCategory.CODE,
  '.m': FileCategory.CODE,
  '.mm': FileCategory.CODE,
  '.php': FileCategory.CODE,
  '.pl': FileCategory.CODE,
  '.pm': FileCategory.CODE,
  '.lua': FileCategory.CODE,
  '.r': FileCategory.CODE,
  '.R': FileCategory.CODE,
  '.scala': FileCategory.CODE,
  '.clj': FileCategory.CODE,
  '.cljs': FileCategory.CODE,
  '.ex': FileCategory.CODE,
  '.exs': FileCategory.CODE,
  '.erl': FileCategory.CODE,
  '.hrl': FileCategory.CODE,
  '.hs': FileCategory.CODE,
  '.lhs': FileCategory.CODE,
  '.ml': FileCategory.CODE,
  '.mli': FileCategory.CODE,
  '.fs': FileCategory.CODE,
  '.fsx': FileCategory.CODE,
  '.sql': FileCategory.CODE,
  '.sh': FileCategory.CODE,
  '.bash': FileCategory.CODE,
  '.zsh': FileCategory.CODE,
  '.fish': FileCategory.CODE,
  '.ps1': FileCategory.CODE,
  '.psm1': FileCategory.CODE,
  '.bat': FileCategory.CODE,
  '.cmd': FileCategory.CODE,
  '.xml': FileCategory.CODE,
  '.xsl': FileCategory.CODE,
  '.xslt': FileCategory.CODE,
  '.yaml': FileCategory.CODE,
  '.yml': FileCategory.CODE,
  '.toml': FileCategory.CODE,
  '.ini': FileCategory.CODE,
  '.cfg': FileCategory.CODE,
  '.conf': FileCategory.CODE,
  '.config': FileCategory.CODE,
  '.env': FileCategory.CODE,
  '.gitignore': FileCategory.CODE,
  '.gitattributes': FileCategory.CODE,
  '.editorconfig': FileCategory.CODE,
  '.eslintrc': FileCategory.CODE,
  '.prettierrc': FileCategory.CODE,
  '.babelrc': FileCategory.CODE,
  '.txt': FileCategory.CODE,
  '.text': FileCategory.CODE,
  '.log': FileCategory.CODE,
  '.dockerfile': FileCategory.CODE,
  '.makefile': FileCategory.CODE,
  '.cmake': FileCategory.CODE,
  '.gradle': FileCategory.CODE,
  '.groovy': FileCategory.CODE,
  '.graphql': FileCategory.CODE,
  '.gql': FileCategory.CODE,
  '.proto': FileCategory.CODE,
  '.prisma': FileCategory.CODE,
  '.tf': FileCategory.CODE,
  '.tfvars': FileCategory.CODE,
  '.hcl': FileCategory.CODE,
  '.dart': FileCategory.CODE,
  '.nim': FileCategory.CODE,
  '.zig': FileCategory.CODE,
  '.v': FileCategory.CODE,
  '.d': FileCategory.CODE,
  '.pas': FileCategory.CODE,
  '.pp': FileCategory.CODE,
  '.asm': FileCategory.CODE,
  '.s': FileCategory.CODE,
  '.nasm': FileCategory.CODE,
  '.wasm': FileCategory.CODE,
  '.wat': FileCategory.CODE,

  // Images
  '.jpg': FileCategory.IMAGE,
  '.jpeg': FileCategory.IMAGE,
  '.png': FileCategory.IMAGE,
  '.gif': FileCategory.IMAGE,
  '.webp': FileCategory.IMAGE,
  '.svg': FileCategory.IMAGE,
  '.bmp': FileCategory.IMAGE,
  '.ico': FileCategory.IMAGE,
  '.tiff': FileCategory.IMAGE,
  '.tif': FileCategory.IMAGE,

  // Videos
  '.mp4': FileCategory.VIDEO,
  '.webm': FileCategory.VIDEO,
  '.mov': FileCategory.VIDEO,
  '.avi': FileCategory.VIDEO,
  '.mkv': FileCategory.VIDEO,
  '.m4v': FileCategory.VIDEO,
  '.wmv': FileCategory.VIDEO,
  '.flv': FileCategory.VIDEO,

  // Audio
  '.mp3': FileCategory.AUDIO,
  '.wav': FileCategory.AUDIO,
  '.ogg': FileCategory.AUDIO,
  '.flac': FileCategory.AUDIO,
  '.aac': FileCategory.AUDIO,
  '.m4a': FileCategory.AUDIO,
  '.wma': FileCategory.AUDIO,
  '.opus': FileCategory.AUDIO,

  // Documents
  '.doc': FileCategory.DOCUMENT,
  '.docx': FileCategory.DOCUMENT,
  '.odt': FileCategory.DOCUMENT,
  '.rtf': FileCategory.DOCUMENT,
  '.pdf': FileCategory.DOCUMENT,
  '.pages': FileCategory.DOCUMENT,
  '.tex': FileCategory.DOCUMENT,

  // Spreadsheets
  '.xls': FileCategory.SPREADSHEET,
  '.xlsx': FileCategory.SPREADSHEET,
  '.ods': FileCategory.SPREADSHEET,
  '.csv': FileCategory.SPREADSHEET,
  '.numbers': FileCategory.SPREADSHEET,
  '.tsv': FileCategory.SPREADSHEET,
};

/**
 * MIME type mappings for media files
 */
const EXTENSION_MIME_MAP: Record<string, string> = {
  // Markdown
  '.md': 'text/markdown',

  // Code/Text files
  '.js': 'text/javascript',
  '.jsx': 'text/javascript',
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.mjs': 'text/javascript',
  '.cjs': 'text/javascript',
  '.json': 'application/json',
  '.jsonc': 'application/json',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.scss': 'text/x-scss',
  '.sass': 'text/x-sass',
  '.less': 'text/x-less',
  '.vue': 'text/x-vue',
  '.svelte': 'text/x-svelte',
  '.py': 'text/x-python',
  '.pyw': 'text/x-python',
  '.rb': 'text/x-ruby',
  '.java': 'text/x-java',
  '.kt': 'text/x-kotlin',
  '.kts': 'text/x-kotlin',
  '.go': 'text/x-go',
  '.rs': 'text/x-rust',
  '.c': 'text/x-c',
  '.h': 'text/x-c',
  '.cpp': 'text/x-c++',
  '.cc': 'text/x-c++',
  '.cxx': 'text/x-c++',
  '.hpp': 'text/x-c++',
  '.hxx': 'text/x-c++',
  '.cs': 'text/x-csharp',
  '.swift': 'text/x-swift',
  '.m': 'text/x-objective-c',
  '.mm': 'text/x-objective-c++',
  '.php': 'text/x-php',
  '.pl': 'text/x-perl',
  '.pm': 'text/x-perl',
  '.lua': 'text/x-lua',
  '.r': 'text/x-r',
  '.R': 'text/x-r',
  '.scala': 'text/x-scala',
  '.clj': 'text/x-clojure',
  '.cljs': 'text/x-clojure',
  '.ex': 'text/x-elixir',
  '.exs': 'text/x-elixir',
  '.erl': 'text/x-erlang',
  '.hrl': 'text/x-erlang',
  '.hs': 'text/x-haskell',
  '.lhs': 'text/x-haskell',
  '.ml': 'text/x-ocaml',
  '.mli': 'text/x-ocaml',
  '.fs': 'text/x-fsharp',
  '.fsx': 'text/x-fsharp',
  '.sql': 'text/x-sql',
  '.sh': 'text/x-shellscript',
  '.bash': 'text/x-shellscript',
  '.zsh': 'text/x-shellscript',
  '.fish': 'text/x-shellscript',
  '.ps1': 'text/x-powershell',
  '.psm1': 'text/x-powershell',
  '.bat': 'text/x-bat',
  '.cmd': 'text/x-bat',
  '.xml': 'text/xml',
  '.xsl': 'text/xml',
  '.xslt': 'text/xml',
  '.yaml': 'text/x-yaml',
  '.yml': 'text/x-yaml',
  '.toml': 'text/x-toml',
  '.ini': 'text/x-ini',
  '.cfg': 'text/plain',
  '.conf': 'text/plain',
  '.config': 'text/plain',
  '.env': 'text/plain',
  '.gitignore': 'text/plain',
  '.gitattributes': 'text/plain',
  '.editorconfig': 'text/plain',
  '.eslintrc': 'application/json',
  '.prettierrc': 'application/json',
  '.babelrc': 'application/json',
  '.txt': 'text/plain',
  '.text': 'text/plain',
  '.log': 'text/plain',
  '.dockerfile': 'text/x-dockerfile',
  '.makefile': 'text/x-makefile',
  '.cmake': 'text/x-cmake',
  '.gradle': 'text/x-groovy',
  '.groovy': 'text/x-groovy',
  '.graphql': 'text/x-graphql',
  '.gql': 'text/x-graphql',
  '.proto': 'text/x-protobuf',
  '.prisma': 'text/plain',
  '.tf': 'text/x-terraform',
  '.tfvars': 'text/x-terraform',
  '.hcl': 'text/x-hcl',
  '.dart': 'text/x-dart',
  '.nim': 'text/x-nim',
  '.zig': 'text/x-zig',
  '.v': 'text/x-v',
  '.d': 'text/x-d',
  '.pas': 'text/x-pascal',
  '.pp': 'text/x-pascal',
  '.asm': 'text/x-asm',
  '.s': 'text/x-asm',
  '.nasm': 'text/x-asm',
  '.wasm': 'application/wasm',
  '.wat': 'text/plain',

  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',

  // Videos
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/x-m4v',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',

  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.wma': 'audio/x-ms-wma',
  '.opus': 'audio/opus',

  // Documents
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.rtf': 'application/rtf',
  '.pdf': 'application/pdf',
  '.pages': 'application/x-iwork-pages-sffpages',
  '.tex': 'application/x-tex',

  // Spreadsheets
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.csv': 'text/csv',
  '.numbers': 'application/x-iwork-numbers-sffnumbers',
  '.tsv': 'text/tab-separated-values',
};

/**
 * Icon mappings by extension (for specific file types)
 */
const EXTENSION_ICON_MAP: Record<string, string> = {
  // Code/Text files
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'javascript',
  '.tsx': 'javascript',
  '.json': 'data_object',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  '.less': 'css',
  '.py': 'code',
  '.java': 'code',
  '.go': 'code',
  '.rs': 'code',
  '.c': 'code',
  '.cpp': 'code',
  '.h': 'code',
  '.cs': 'code',
  '.swift': 'code',
  '.php': 'php',
  '.rb': 'code',
  '.sql': 'storage',
  '.sh': 'terminal',
  '.bash': 'terminal',
  '.zsh': 'terminal',
  '.ps1': 'terminal',
  '.bat': 'terminal',
  '.cmd': 'terminal',
  '.xml': 'code',
  '.yaml': 'settings',
  '.yml': 'settings',
  '.toml': 'settings',
  '.ini': 'settings',
  '.cfg': 'settings',
  '.conf': 'settings',
  '.config': 'settings',
  '.env': 'key',
  '.gitignore': 'rule',
  '.txt': 'article',
  '.log': 'receipt_long',
  '.dockerfile': 'deployed_code',
  '.graphql': 'schema',
  '.gql': 'schema',

  // Documents
  '.pdf': 'picture_as_pdf',
  '.doc': 'description',
  '.docx': 'description',
  '.odt': 'description',
  '.rtf': 'article',
  '.pages': 'description',
  '.tex': 'code',

  // Spreadsheets
  '.xls': 'grid_on',
  '.xlsx': 'grid_on',
  '.ods': 'table_chart',
  '.csv': 'view_list',
  '.numbers': 'grid_on',
  '.tsv': 'view_list',
};

/**
 * Default icons by category
 */
const CATEGORY_ICON_MAP: Record<FileCategory, string> = {
  [FileCategory.MARKDOWN]: 'description',
  [FileCategory.CODE]: 'code',
  [FileCategory.IMAGE]: 'image',
  [FileCategory.VIDEO]: 'movie',
  [FileCategory.AUDIO]: 'music_note',
  [FileCategory.DOCUMENT]: 'description',
  [FileCategory.SPREADSHEET]: 'grid_on',
  [FileCategory.UNKNOWN]: 'insert_drive_file',
};

/**
 * Categories that can be previewed in the app
 */
const PREVIEWABLE_CATEGORIES: Set<FileCategory> = new Set([
  FileCategory.MARKDOWN,
  FileCategory.CODE,
  FileCategory.IMAGE,
  FileCategory.VIDEO,
  FileCategory.AUDIO,
]);

/**
 * Extracts the file extension from a file path (case-insensitive)
 * @param filePath - The full path or filename
 * @returns The lowercase extension with dot, or empty string if none
 */
function getExtension(filePath: string): string {
  const lastDotIndex = filePath.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filePath.length - 1) {
    return '';
  }
  return filePath.slice(lastDotIndex).toLowerCase();
}

/**
 * Gets the file category based on the file extension
 * @param filePath - The full path or filename
 * @returns The FileCategory for this file
 */
export function getFileCategory(filePath: string): FileCategory {
  const extension = getExtension(filePath);
  if (!extension) {
    return FileCategory.UNKNOWN;
  }
  return EXTENSION_CATEGORY_MAP[extension] ?? FileCategory.UNKNOWN;
}

/**
 * Gets the MIME type for a file based on its extension
 * @param filePath - The full path or filename
 * @returns The MIME type string, or 'application/octet-stream' for unknown types
 */
export function getMimeType(filePath: string): string {
  const extension = getExtension(filePath);
  if (!extension) {
    return 'application/octet-stream';
  }
  return EXTENSION_MIME_MAP[extension] ?? 'application/octet-stream';
}

/**
 * Gets complete file type information for a file
 * @param filePath - The full path or filename
 * @returns Complete file type information
 */
export function getFileTypeInfo(filePath: string): IFileTypeInfo {
  const extension = getExtension(filePath);
  const category = getFileCategory(filePath);
  const mimeType = getMimeType(filePath);
  const canPreview = PREVIEWABLE_CATEGORIES.has(category);
  const icon = getIconForFile(filePath);

  return {
    category,
    extension,
    mimeType,
    canPreview,
    icon,
  };
}

/**
 * Checks if a file can be previewed within the application
 * @param filePath - The full path or filename
 * @returns True if the file can be previewed in-app
 */
export function canPreviewInApp(filePath: string): boolean {
  const category = getFileCategory(filePath);
  return PREVIEWABLE_CATEGORIES.has(category);
}

/**
 * Gets the Material icon name for a file based on its extension or category
 * @param filePath - The full path or filename
 * @returns Material icon name
 */
export function getIconForFile(filePath: string): string {
  const extension = getExtension(filePath);

  // First check for extension-specific icon
  if (extension && EXTENSION_ICON_MAP[extension]) {
    return EXTENSION_ICON_MAP[extension];
  }

  // Fall back to category icon
  const category = getFileCategory(filePath);
  return CATEGORY_ICON_MAP[category];
}

/**
 * Checks if a file extension is supported by the application
 * @param filePath - The full path or filename
 * @returns True if the extension is recognized
 */
export function isKnownFileType(filePath: string): boolean {
  const category = getFileCategory(filePath);
  return category !== FileCategory.UNKNOWN;
}

/**
 * Gets all supported extensions for a given category
 * @param category - The file category
 * @returns Array of extensions (with dots) for that category
 */
export function getExtensionsForCategory(category: FileCategory): string[] {
  return Object.entries(EXTENSION_CATEGORY_MAP)
    .filter(([, cat]) => cat === category)
    .map(([ext]) => ext);
}
