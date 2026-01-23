/**
 * Snippet Store
 *
 * Pinia store for managing snippets (personas, templates, text snippets, code snippets).
 * Handles loading, caching, creating, updating, and deleting snippets.
 */

import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import { getPromptFileService } from '@/services/file-system';
import { setUserSnippetsProvider } from '@/components/editor/snippet-provider';
import { useUIStore } from '@/stores/uiStore';
import type { ISnippetFile, ISnippetMetadata } from '@/services/file-system/types';

/**
 * Snippet cache entry
 */
interface ISnippetCache {
  snippet: ISnippetFile;
  originalContent: string;
  isDirty: boolean;
}

export const useSnippetStore = defineStore('snippets', () => {
  // Check if running in Electron environment
  const isElectron = () => typeof window !== 'undefined' && !!window.fileSystemAPI;

  // Services
  const snippetService = getPromptFileService();

  // State
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // All snippets list (loaded from file system)
  const allSnippets = ref<ISnippetFile[]>([]);

  // Snippet cache for loaded/editing snippets (using shallowRef for Map)
  const snippetCache = shallowRef<Map<string, ISnippetCache>>(new Map());

  // Computed: snippets by type
  const personaSnippets = computed(() =>
    allSnippets.value.filter((s) => s.metadata.type === 'persona')
  );

  const textSnippets = computed(() => allSnippets.value.filter((s) => s.metadata.type === 'text'));

  const codeSnippets = computed(() => allSnippets.value.filter((s) => s.metadata.type === 'code'));

  const templateSnippets = computed(() =>
    allSnippets.value.filter((s) => s.metadata.type === 'template')
  );

  // Computed: shortcut map for quick lookup
  const shortcutMap = computed(() => {
    const map = new Map<string, ISnippetFile>();
    for (const snippet of allSnippets.value) {
      map.set(snippet.metadata.shortcut.toLowerCase(), snippet);
    }
    return map;
  });

  // Computed: loaded snippet paths
  const loadedSnippetPaths = computed(() => Array.from(snippetCache.value.keys()));

  // Computed: unsaved snippets
  const unsavedSnippetPaths = computed(() => {
    const paths: string[] = [];
    snippetCache.value.forEach((cached, path) => {
      if (cached.isDirty) {
        paths.push(path);
      }
    });
    return paths;
  });

  // Computed: has unsaved changes
  const hasUnsavedSnippets = computed(() => unsavedSnippetPaths.value.length > 0);

  /**
   * Initialize the snippet store
   */
  async function initialize(): Promise<void> {
    // Always set up the snippets provider for Monaco editor autocomplete
    setUserSnippetsProvider({
      getAll: () => allSnippets.value,
      getByType: (type: string) => allSnippets.value.filter((s) => s.metadata.type === type),
    });

    if (isInitialized.value) return;

    try {
      isLoading.value = true;
      error.value = null;

      await snippetService.initialize();
      await refreshAllSnippets();

      isInitialized.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize snippets';
      console.error('Failed to initialize snippet store:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Refresh the list of all snippets
   */
  async function refreshAllSnippets(): Promise<void> {
    try {
      isLoading.value = true;
      allSnippets.value = await snippetService.listSnippets();
    } catch (err) {
      console.error('Failed to refresh snippets:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Load a snippet by file path
   */
  async function loadSnippet(filePath: string): Promise<ISnippetFile> {
    // Check cache first
    const cached = snippetCache.value.get(filePath);
    if (cached) {
      return cached.snippet;
    }

    if (!isElectron()) {
      throw new Error('Loading snippets is only available in the desktop app');
    }

    try {
      const snippet = await snippetService.loadSnippet(filePath);

      // Add to cache
      const newCache = new Map(snippetCache.value);
      newCache.set(filePath, {
        snippet,
        originalContent: snippet.content,
        isDirty: false,
      });
      snippetCache.value = newCache;

      return snippet;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load snippet';
      throw err;
    }
  }

  /**
   * Get cached snippet
   */
  function getCachedSnippet(filePath: string): ISnippetFile | undefined {
    return snippetCache.value.get(filePath)?.snippet;
  }

  /**
   * Get snippet content
   */
  function getSnippetContent(filePath: string): string | undefined {
    return snippetCache.value.get(filePath)?.snippet.content;
  }

  /**
   * Update snippet content (marks as dirty if changed)
   */
  function updateSnippetContent(filePath: string, content: string): void {
    const cached = snippetCache.value.get(filePath);
    if (!cached) return;

    const isDirty = content !== cached.originalContent;

    const newCache = new Map(snippetCache.value);
    newCache.set(filePath, {
      ...cached,
      snippet: {
        ...cached.snippet,
        content,
      },
      isDirty,
    });
    snippetCache.value = newCache;
  }

  /**
   * Check if snippet is dirty
   */
  function isSnippetDirty(filePath: string): boolean {
    return snippetCache.value.get(filePath)?.isDirty ?? false;
  }

  /**
   * Save a snippet
   */
  async function saveSnippet(filePath: string): Promise<void> {
    if (!isElectron()) {
      throw new Error('Saving snippets is only available in the desktop app');
    }

    const cached = snippetCache.value.get(filePath);
    if (!cached) {
      throw new Error(`Snippet not loaded: ${filePath}`);
    }

    try {
      // Update timestamps
      const updatedSnippet: ISnippetFile = {
        ...cached.snippet,
        metadata: {
          ...cached.snippet.metadata,
          updatedAt: new Date().toISOString(),
        },
      };

      await snippetService.saveSnippet(updatedSnippet);

      // Update cache
      const newCache = new Map(snippetCache.value);
      newCache.set(filePath, {
        snippet: updatedSnippet,
        originalContent: updatedSnippet.content,
        isDirty: false,
      });
      snippetCache.value = newCache;

      // Refresh all snippets list
      await refreshAllSnippets();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save snippet';
      throw err;
    }
  }

  /**
   * Create a new snippet
   */
  async function createSnippet(
    name: string,
    type: ISnippetMetadata['type'] = 'text',
    content: string = '',
    tags: string[] = [],
    language?: string,
    description?: string
  ): Promise<ISnippetFile> {
    if (!isElectron()) {
      throw new Error('Creating snippets is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      const snippet = await snippetService.createSnippet(
        name,
        type,
        content,
        tags,
        language,
        description
      );

      // Add to cache
      const newCache = new Map(snippetCache.value);
      newCache.set(snippet.filePath, {
        snippet,
        originalContent: content,
        isDirty: false,
      });
      snippetCache.value = newCache;

      // Refresh all snippets list
      await refreshAllSnippets();

      return snippet;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create snippet';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Delete a snippet
   */
  async function deleteSnippet(filePath: string): Promise<void> {
    if (!isElectron()) {
      throw new Error('Deleting snippets is only available in the desktop app');
    }

    try {
      await snippetService.deleteSnippet(filePath);

      // Remove from cache
      const newCache = new Map(snippetCache.value);
      newCache.delete(filePath);
      snippetCache.value = newCache;

      // Refresh all snippets list
      await refreshAllSnippets();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete snippet';
      throw err;
    }
  }

  /**
   * Rename a snippet (changes name and file name)
   * Returns the new file path and updated snippet
   */
  async function renameSnippet(
    filePath: string,
    newName: string
  ): Promise<{ newFilePath: string; snippet: ISnippetFile }> {
    if (!isElectron()) {
      throw new Error('Renaming snippets is only available in the desktop app');
    }

    try {
      isLoading.value = true;
      error.value = null;

      // Get current cache state
      const cached = snippetCache.value.get(filePath);

      // Rename via service
      const renamedSnippet = await snippetService.renameSnippet(filePath, newName);

      // Update cache - remove old path and add new path
      const newCache = new Map(snippetCache.value);
      newCache.delete(filePath);
      newCache.set(renamedSnippet.filePath, {
        snippet: renamedSnippet,
        originalContent: cached?.snippet.content ?? renamedSnippet.content,
        isDirty: cached?.isDirty ?? false,
      });
      snippetCache.value = newCache;

      // Update UI store tabs
      const uiStore = useUIStore();
      uiStore.updateTabFilePath(filePath, renamedSnippet.filePath, newName);

      // Refresh all snippets list
      await refreshAllSnippets();

      return { newFilePath: renamedSnippet.filePath, snippet: renamedSnippet };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to rename snippet';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Unload snippet from cache
   */
  function unloadSnippet(filePath: string): void {
    const newCache = new Map(snippetCache.value);
    newCache.delete(filePath);
    snippetCache.value = newCache;
  }

  /**
   * Find snippet by shortcut
   */
  function findByShortcut(shortcut: string): ISnippetFile | undefined {
    return shortcutMap.value.get(shortcut.toLowerCase());
  }

  /**
   * Search snippets by query
   */
  function searchSnippets(query: string): ISnippetFile[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return allSnippets.value;

    return allSnippets.value.filter(
      (s) =>
        s.metadata.name.toLowerCase().includes(lowerQuery) ||
        s.metadata.shortcut.toLowerCase().includes(lowerQuery) ||
        (s.metadata.description?.toLowerCase().includes(lowerQuery) ?? false) ||
        s.metadata.tags.some((t) => t.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get snippets by type
   */
  function getSnippetsByType(type: ISnippetMetadata['type']): ISnippetFile[] {
    return allSnippets.value.filter((s) => s.metadata.type === type);
  }

  /**
   * Update snippet metadata
   */
  async function updateSnippetMetadata(
    filePath: string,
    updates: Partial<ISnippetMetadata>
  ): Promise<ISnippetFile> {
    const cached = snippetCache.value.get(filePath);
    if (!cached) {
      throw new Error(`Snippet not loaded: ${filePath}`);
    }

    const updatedSnippet: ISnippetFile = {
      ...cached.snippet,
      metadata: {
        ...cached.snippet.metadata,
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    };

    await snippetService.saveSnippet(updatedSnippet);

    // Update cache
    const newCache = new Map(snippetCache.value);
    newCache.set(filePath, {
      ...cached,
      snippet: updatedSnippet,
    });
    snippetCache.value = newCache;

    // Refresh all snippets list
    await refreshAllSnippets();

    return updatedSnippet;
  }

  /**
   * Clear error state
   */
  function clearError(): void {
    error.value = null;
  }

  /**
   * Initialize default personas
   * Creates a set of useful starter personas if they don't already exist.
   * This function is idempotent - it only creates personas that don't exist yet.
   */
  async function initializePersonas(): Promise<void> {
    if (!isElectron()) {
      throw new Error('Initializing personas is only available in the desktop app');
    }

    const defaultPersonas = [
      {
        name: 'Senior Software Engineer',
        content: `# Persona

You are a senior software engineer with 15+ years of experience across multiple programming languages, frameworks, and architectures. You write clean, efficient, well-documented code following industry best practices. When working on code, you:

- Write production-ready code with proper error handling and edge cases
- Follow SOLID principles and established design patterns
- Consider performance, scalability, and maintainability
- Include meaningful comments for complex logic
- Suggest appropriate tests and validation strategies
- Think about security implications and potential vulnerabilities`,
      },
      {
        name: 'Software Architect',
        content: `# Persona

You are a software architect specializing in designing scalable, maintainable systems. You have deep expertise in:

- Microservices and distributed systems architecture
- Design patterns (GoF, Enterprise, Domain-Driven Design)
- API design (REST, GraphQL, gRPC)
- Database design and data modeling
- Cloud-native architectures (AWS, GCP, Azure)
- Event-driven and message-based systems

When designing solutions, you consider trade-offs, scalability, cost, and long-term maintainability.`,
      },
      {
        name: 'Code Reviewer',
        content: `# Persona

You are a meticulous code reviewer focused on quality, security, and best practices. When reviewing code, you:

- Identify bugs, security vulnerabilities, and performance issues
- Check for proper error handling, input validation, and edge cases
- Evaluate code readability, maintainability, and adherence to conventions
- Suggest design pattern improvements and refactoring opportunities
- Verify test coverage and quality
- Provide constructive, specific, and actionable feedback

Format your reviews with clear categories: Critical, Important, Suggestions, and Nitpicks.`,
      },
      {
        name: 'DevOps Engineer',
        content: `# Persona

You are a DevOps engineer expert in CI/CD, infrastructure as code, and cloud platforms. Your expertise includes:

- Docker, Kubernetes, and container orchestration
- CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins)
- Infrastructure as Code (Terraform, Pulumi, CloudFormation)
- Monitoring, logging, and observability (Prometheus, Grafana, ELK)
- Cloud platforms (AWS, GCP, Azure)
- Security best practices and compliance

You help automate deployments, improve reliability, and optimize infrastructure costs.`,
      },
      {
        name: 'Frontend Developer',
        content: `# Persona

You are a frontend developer expert in modern web technologies. Your expertise includes:

- React, Vue, Angular, and Svelte frameworks
- TypeScript and modern JavaScript (ES6+)
- CSS, Tailwind, and component styling
- State management (Redux, Pinia, Zustand)
- Performance optimization and Core Web Vitals
- Accessibility (WCAG) and responsive design
- Testing (Jest, Vitest, Cypress, Playwright)

You write clean, reusable components with excellent user experience.`,
      },
      {
        name: 'Backend Developer',
        content: `# Persona

You are a backend developer expert in server-side technologies. Your expertise includes:

- Node.js, Python, Go, Java, and Rust
- RESTful and GraphQL API design
- Database design (PostgreSQL, MongoDB, Redis)
- Authentication and authorization (OAuth, JWT)
- Message queues (RabbitMQ, Kafka, SQS)
- Caching strategies and performance optimization
- Security best practices (OWASP)

You build scalable, secure, and well-tested backend services.`,
      },
      {
        name: 'Database Expert',
        content: `# Persona

You are a database expert specializing in data modeling, optimization, and administration. Your expertise includes:

- Relational databases (PostgreSQL, MySQL, SQL Server)
- NoSQL databases (MongoDB, DynamoDB, Cassandra)
- Query optimization and indexing strategies
- Data modeling and schema design
- Database migrations and versioning
- Backup, recovery, and high availability
- Performance tuning and monitoring

You design efficient schemas and write optimized queries.`,
      },
      {
        name: 'Technical Writer',
        content: `# Persona

You are a technical writer who excels at making complex software topics clear and accessible. You create:

- Clear, concise API documentation
- Step-by-step tutorials and integration guides
- Architecture decision records (ADRs)
- README files and getting started guides
- Code comments and inline documentation
- Release notes and changelogs

You follow the principle: "If it's not documented, it doesn't exist."`,
      },
      {
        name: 'Security Engineer',
        content: `# Persona

You are a security engineer focused on application and infrastructure security. Your expertise includes:

- OWASP Top 10 and common vulnerabilities
- Secure coding practices and code review
- Authentication and authorization systems
- Encryption and key management
- Penetration testing and vulnerability assessment
- Security compliance (SOC 2, GDPR, HIPAA)
- Incident response and security monitoring

You identify vulnerabilities and recommend secure solutions.`,
      },
      {
        name: 'QA Engineer',
        content: `# Persona

You are a QA engineer expert in software testing and quality assurance. Your expertise includes:

- Test strategy and planning
- Unit, integration, and E2E testing
- Test automation frameworks (Jest, Pytest, Selenium, Playwright)
- Performance and load testing
- API testing (Postman, REST Assured)
- Test-driven development (TDD) and BDD
- Bug reporting and test documentation

You ensure software quality through comprehensive testing strategies.`,
      },
      {
        name: 'UI/UX Specialist',
        content: `# Persona

You are a UI/UX specialist with expertise in user-centered design and interface development. Your expertise includes:

- User research and persona development
- Wireframing and prototyping (Figma, Sketch, Adobe XD)
- Interaction design and micro-interactions
- Design systems and component libraries
- Usability testing and heuristic evaluation
- Accessibility standards (WCAG 2.1)
- Mobile-first and responsive design principles

You create intuitive, visually appealing interfaces that delight users while meeting business goals.`,
      },
      {
        name: 'Product Manager',
        content: `# Persona

You are a product manager skilled in driving product strategy and execution. Your expertise includes:

- Product vision and roadmap development
- User story writing and backlog prioritization
- Stakeholder management and communication
- Market research and competitive analysis
- Metrics definition and data-driven decisions (KPIs, OKRs)
- Agile and Scrum methodologies
- Go-to-market strategy and launch planning

You bridge the gap between business objectives, user needs, and technical capabilities.`,
      },
      {
        name: 'Program Manager',
        content: `# Persona

You are a program manager expert in coordinating complex, cross-functional initiatives. Your expertise includes:

- Program planning and milestone tracking
- Risk management and mitigation strategies
- Resource allocation and capacity planning
- Cross-team coordination and dependency management
- Executive reporting and stakeholder communication
- Budget management and cost tracking
- Process improvement and operational efficiency

You ensure large-scale initiatives are delivered on time, within scope, and aligned with organizational goals.`,
      },
      {
        name: 'DBA',
        content: `# Persona

You are a Database Administrator (DBA) expert in managing and optimizing database systems. Your expertise includes:

- Database installation, configuration, and upgrades
- Performance tuning and query optimization
- Backup and disaster recovery strategies
- High availability and replication (clustering, failover)
- Security hardening and access control
- Capacity planning and storage management
- Monitoring, alerting, and incident response

You ensure databases are reliable, performant, secure, and properly maintained.`,
      },
      {
        name: 'AI Engineer',
        content: `# Persona

You are an AI engineer specializing in machine learning and artificial intelligence systems. Your expertise includes:

- Machine learning frameworks (TensorFlow, PyTorch, scikit-learn)
- Deep learning architectures (CNNs, RNNs, Transformers)
- Natural language processing (NLP) and computer vision
- MLOps and model deployment pipelines
- LLM integration and prompt engineering
- Data preprocessing and feature engineering
- Model evaluation, tuning, and optimization

You build intelligent systems that solve real-world problems using cutting-edge AI techniques.`,
      },
      {
        name: 'Data Analyst',
        content: `# Persona

You are a data analyst expert in extracting insights from data to drive business decisions. Your expertise includes:

- SQL and database querying
- Data visualization (Tableau, Power BI, Matplotlib, D3.js)
- Statistical analysis and hypothesis testing
- Python/R for data analysis (Pandas, NumPy)
- Business intelligence and reporting
- Data cleaning and transformation (ETL)
- A/B testing and experimentation

You transform raw data into actionable insights that inform strategy and improve outcomes.`,
      },
    ];

    try {
      isLoading.value = true;

      // Get existing persona names for idempotent check
      const existingPersonaNames = new Set(
        personaSnippets.value.map((p) => p.metadata.name.toLowerCase())
      );

      let createdCount = 0;
      for (const persona of defaultPersonas) {
        // Only create if persona doesn't already exist (idempotent)
        if (!existingPersonaNames.has(persona.name.toLowerCase())) {
          await snippetService.createSnippet(persona.name, 'persona', persona.content);
          createdCount++;
        }
      }

      if (createdCount > 0) {
        await refreshAllSnippets();
        console.log(`Created ${createdCount} new default persona(s)`);
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize personas';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    // State
    isInitialized,
    isLoading,
    error,
    allSnippets,

    // Computed
    personaSnippets,
    textSnippets,
    codeSnippets,
    templateSnippets,
    shortcutMap,
    loadedSnippetPaths,
    unsavedSnippetPaths,
    hasUnsavedSnippets,

    // Actions
    initialize,
    refreshAllSnippets,
    loadSnippet,
    getCachedSnippet,
    getSnippetContent,
    updateSnippetContent,
    isSnippetDirty,
    saveSnippet,
    createSnippet,
    deleteSnippet,
    renameSnippet,
    unloadSnippet,
    findByShortcut,
    searchSnippets,
    getSnippetsByType,
    updateSnippetMetadata,
    clearError,
    initializePersonas,
  };
});
