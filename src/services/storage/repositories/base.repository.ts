import type { Table, IndexableType } from 'dexie';

/**
 * Generic base repository providing CRUD operations for IndexedDB tables.
 *
 * @template T - The entity type
 * @template K - The primary key type (defaults to string)
 */
export class BaseRepository<T, K extends IndexableType = string> {
  constructor(protected readonly table: Table<T, K>) {}

  /**
   * Get all records from the table
   */
  async getAll(): Promise<T[]> {
    return this.table.toArray();
  }

  /**
   * Get a single record by its primary key
   */
  async getById(id: K): Promise<T | undefined> {
    return this.table.get(id);
  }

  /**
   * Create a new record
   */
  async create(entity: T): Promise<K> {
    return this.table.add(entity);
  }

  /**
   * Create multiple records in a single transaction
   */
  async createMany(entities: T[]): Promise<K[]> {
    return this.table.bulkAdd(entities, { allKeys: true }) as Promise<K[]>;
  }

  /**
   * Update an existing record by its primary key
   */
  async update(id: K, changes: Partial<T>): Promise<number> {
    // Dexie's update expects UpdateSpec which is compatible with Partial<T>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    return this.table.update(id, changes as any);
  }

  /**
   * Create or update a record (upsert)
   */
  async upsert(entity: T): Promise<K> {
    return this.table.put(entity);
  }

  /**
   * Create or update multiple records
   */
  async upsertMany(entities: T[]): Promise<K[]> {
    return this.table.bulkPut(entities, { allKeys: true }) as Promise<K[]>;
  }

  /**
   * Delete a record by its primary key
   */
  async delete(id: K): Promise<void> {
    return this.table.delete(id);
  }

  /**
   * Delete multiple records by their primary keys
   */
  async deleteMany(ids: K[]): Promise<void> {
    return this.table.bulkDelete(ids);
  }

  /**
   * Delete all records from the table
   */
  async clear(): Promise<void> {
    return this.table.clear();
  }

  /**
   * Count all records in the table
   */
  async count(): Promise<number> {
    return this.table.count();
  }

  /**
   * Check if a record exists by its primary key
   */
  async exists(id: K): Promise<boolean> {
    const record = await this.table.get(id);
    return record !== undefined;
  }

  /**
   * Find records matching a filter function
   */
  async filter(predicate: (entity: T) => boolean): Promise<T[]> {
    return this.table.filter(predicate).toArray();
  }

  /**
   * Find the first record matching a filter function
   */
  async findFirst(predicate: (entity: T) => boolean): Promise<T | undefined> {
    return this.table.filter(predicate).first();
  }

  /**
   * Get records with pagination
   */
  async paginate(offset: number, limit: number): Promise<T[]> {
    return this.table.offset(offset).limit(limit).toArray();
  }

  /**
   * Get access to the underlying Dexie table for advanced queries
   */
  getTable(): Table<T, K> {
    return this.table;
  }
}
