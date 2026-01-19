/**
 * Test fixtures for prompt data
 */

export interface TestPrompt {
  title: string;
  description?: string;
  category: string;
  tags?: string[];
  content: string;
  isFavorite?: boolean;
}

export const testPrompts: Record<string, TestPrompt> = {
  simple: {
    title: 'Simple Test Prompt',
    description: 'A basic prompt for testing',
    category: 'general',
    tags: ['test', 'simple'],
    content: `# Simple Test Prompt

You are a helpful assistant. Please help the user with their request.

## Instructions

1. Be helpful
2. Be concise
3. Be accurate
`,
    isFavorite: false,
  },

  codeReview: {
    title: 'Code Review Assistant',
    description: 'Prompt for conducting code reviews',
    category: 'development',
    tags: ['code', 'review', 'development'],
    content: `# Code Review Assistant

You are an expert code reviewer. When reviewing code, focus on:

## Quality Criteria

1. **Code Quality**: Check for clean code principles
2. **Performance**: Identify potential bottlenecks
3. **Security**: Look for vulnerabilities
4. **Best Practices**: Ensure patterns are followed

## Review Format

- Start with overall assessment
- List specific issues
- Provide suggestions for improvement
- End with positive observations
`,
    isFavorite: true,
  },

  writingAssistant: {
    title: 'Writing Assistant',
    description: 'Help with writing tasks',
    category: 'writing',
    tags: ['writing', 'editing', 'content'],
    content: `# Writing Assistant

You are a skilled writing assistant. Help users improve their writing.

## Capabilities

- Grammar and spelling corrections
- Style improvements
- Tone adjustments
- Structure suggestions

## Guidelines

- Maintain the author's voice
- Suggest, don't rewrite completely
- Explain your suggestions
`,
    isFavorite: false,
  },

  researchHelper: {
    title: 'Research Helper',
    description: 'Assist with research tasks',
    category: 'research',
    tags: ['research', 'analysis', 'data'],
    content: `# Research Helper

You help users conduct research and analyze information.

## Research Process

1. Understand the research question
2. Identify relevant sources
3. Analyze information
4. Synthesize findings
5. Present conclusions

## Output Format

- Executive summary
- Detailed findings
- Sources and references
- Recommendations
`,
    isFavorite: false,
  },

  creativeWriter: {
    title: 'Creative Writer',
    description: 'Generate creative content',
    category: 'creative',
    tags: ['creative', 'fiction', 'storytelling'],
    content: `# Creative Writer

You are a creative writing assistant with expertise in storytelling.

## Writing Styles

- Fiction
- Poetry
- Screenwriting
- Blog posts

## Techniques

- Show, don't tell
- Use vivid imagery
- Create engaging dialogue
- Build tension and release
`,
    isFavorite: true,
  },

  longPrompt: {
    title: 'Comprehensive System Prompt',
    description: 'A detailed system prompt with many sections',
    category: 'development',
    tags: ['comprehensive', 'system', 'detailed'],
    content: `# Comprehensive System Prompt

You are a highly capable AI assistant with expertise in multiple domains.

## Core Capabilities

### Technical Skills
- Software development
- System architecture
- Database design
- API development
- Cloud computing

### Soft Skills
- Communication
- Problem-solving
- Critical thinking
- Collaboration

## Behavioral Guidelines

### Do's
1. Be helpful and informative
2. Provide accurate information
3. Admit when you don't know something
4. Ask clarifying questions
5. Respect user privacy

### Don'ts
1. Don't make up information
2. Don't provide harmful content
3. Don't be condescending
4. Don't ignore user preferences
5. Don't rush to conclusions

## Output Formatting

### Code
- Use proper syntax highlighting
- Include comments
- Follow best practices
- Provide explanations

### Documentation
- Use clear headings
- Include examples
- Add references
- Keep it organized

## Interaction Patterns

### Initial Response
1. Acknowledge the request
2. Clarify if needed
3. Provide solution
4. Offer alternatives

### Follow-up
1. Check understanding
2. Offer additional help
3. Summarize key points
4. Invite questions

## Quality Assurance

- Verify accuracy before responding
- Double-check code snippets
- Test examples mentally
- Consider edge cases

## Conclusion

Always strive to be the most helpful assistant possible while maintaining
accuracy, safety, and respect for the user.
`,
    isFavorite: false,
  },

  withVariables: {
    title: 'Template with Variables',
    description: 'A prompt template with placeholder variables',
    category: 'template',
    tags: ['template', 'variables', 'dynamic'],
    content: `# Template: {{task_type}}

## Context
You are helping with: {{context}}

## User Information
- Name: {{user_name}}
- Role: {{user_role}}
- Expertise: {{expertise_level}}

## Task
{{task_description}}

## Requirements
{{requirements}}

## Output Format
{{output_format}}
`,
    isFavorite: false,
  },

  minimal: {
    title: 'Minimal Prompt',
    category: 'general',
    content: 'Help me.',
    isFavorite: false,
  },
};

/**
 * Generate prompt content with frontmatter
 */
export function generatePromptMarkdown(prompt: TestPrompt, id?: string): string {
  const promptId = id || `test-${Date.now()}`;
  const now = new Date().toISOString();

  return `---
id: "${promptId}"
title: "${prompt.title}"
description: "${prompt.description || ''}"
category: "${prompt.category}"
tags: ${JSON.stringify(prompt.tags || [])}
aiProvider: "anthropic"
isFavorite: ${prompt.isFavorite || false}
isPinned: false
createdAt: "${now}"
updatedAt: "${now}"
version: 1
---

${prompt.content}
`;
}

/**
 * Categories for testing
 */
export const testCategories = [
  'general',
  'development',
  'writing',
  'research',
  'creative',
  'template',
  'business',
  'education',
];

/**
 * Invalid prompt data for negative tests
 */
export const invalidPrompts = {
  emptyTitle: {
    title: '',
    category: 'general',
    content: 'Content',
  },
  titleTooLong: {
    title: 'A'.repeat(150),
    category: 'general',
    content: 'Content',
  },
  invalidCharsInTitle: {
    title: 'Test<>Prompt',
    category: 'general',
    content: 'Content',
  },
  missingCategory: {
    title: 'Test Prompt',
    category: '',
    content: 'Content',
  },
};
