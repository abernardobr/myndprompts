export interface ISnippet {
  id: string;
  name: string;
  type: SnippetType;
  shortcut: string;
  description: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type SnippetType = 'persona' | 'template' | 'context' | 'instruction' | 'example';
