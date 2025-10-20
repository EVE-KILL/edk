import { db } from "../../src/db";
import type { BunSQLiteDatabase } from "../../src/db";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { eq, and, or, desc, asc, sql, type SQL } from "drizzle-orm";

/**
 * Base Model class
 * Provides common CRUD operations for all models
 */
export abstract class BaseModel<
  TTable extends SQLiteTable,
  TSelect = TTable["$inferSelect"],
  TInsert = TTable["$inferInsert"]
> {
  protected db: BunSQLiteDatabase<Record<string, never>>;
  protected abstract table: TTable;
  protected abstract idColumn: any; // Will be the id column from the table

  constructor() {
    this.db = db as any;
  }

  /**
   * Find a single record by ID
   */
  async findById(id: number): Promise<TSelect | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.idColumn, id))
      .limit(1);

    return (results[0] as TSelect) || null;
  }

  /**
   * Find a single record by custom condition
   */
  async findOne(where: SQL): Promise<TSelect | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(where)
      .limit(1);

    return (results[0] as TSelect) || null;
  }

  /**
   * Find all records matching conditions
   */
  async find(options: {
    where?: SQL;
    limit?: number;
    offset?: number;
    orderBy?: SQL;
  } = {}): Promise<TSelect[]> {
    let query = this.db.select().from(this.table);

    if (options.where) {
      query = query.where(options.where) as any;
    }

    if (options.orderBy) {
      query = query.orderBy(options.orderBy) as any;
    }

    if (options.limit) {
      query = query.limit(options.limit) as any;
    }

    if (options.offset) {
      query = query.offset(options.offset) as any;
    }

    return query as Promise<TSelect[]>;
  }

  /**
   * Get all records
   */
  async findAll(limit?: number): Promise<TSelect[]> {
    return this.find({ limit });
  }

  /**
   * Create a new record
   */
  async create(data: TInsert): Promise<TSelect> {
    const result = await this.db.insert(this.table).values(data as any).returning();
    return result[0] as TSelect;
  }

  /**
   * Create multiple records
   */
  async createMany(data: TInsert[]): Promise<TSelect[]> {
    if (data.length === 0) return [];
    const result = await this.db.insert(this.table).values(data as any).returning();
    return result as unknown as TSelect[];
  }

  /**
   * Update a record by ID
   */
  async update(id: number, data: Partial<TInsert>): Promise<TSelect | null> {
    const result = await this.db
      .update(this.table)
      .set(data as any)
      .where(eq(this.idColumn, id))
      .returning();

    return (result[0] as TSelect) || null;
  }

  /**
   * Update records matching condition
   */
  async updateWhere(where: SQL, data: Partial<TInsert>): Promise<number> {
    const result = await this.db
      .update(this.table)
      .set(data as any)
      .where(where) as any;

    return result.changes || 0;
  }

  /**
   * Delete a record by ID
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(this.table)
      .where(eq(this.idColumn, id)) as any;

    return result.changes > 0;
  }

  /**
   * Delete records matching condition
   */
  async deleteWhere(where: SQL): Promise<number> {
    const result = await this.db.delete(this.table).where(where) as any;
    return result.changes || 0;
  }

  /**
   * Count all records
   */
  async count(where?: SQL): Promise<number> {
    let query = this.db.select({ count: sql<number>`count(*)` }).from(this.table);

    if (where) {
      query = query.where(where) as any;
    }

    const result = await query;
    return result[0]?.count || 0;
  }

  /**
   * Check if a record exists
   */
  async exists(where: SQL): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  /**
   * Paginate results
   */
  async paginate(options: {
    page?: number;
    perPage?: number;
    where?: SQL;
    orderBy?: SQL;
  } = {}): Promise<{
    data: TSelect[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  }> {
    const page = options.page || 1;
    const perPage = options.perPage || 50;
    const offset = (page - 1) * perPage;

    const [data, total] = await Promise.all([
      this.find({
        where: options.where,
        limit: perPage,
        offset,
        orderBy: options.orderBy,
      }),
      this.count(options.where),
    ]);

    return {
      data,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };
  }

  /**
   * Execute raw SQL query
   */
  protected async rawQuery<T = any>(query: string, params?: any[]): Promise<T[]> {
    const sqlite = (this.db as any)._.session.db;
    return sqlite.prepare(query).all(params || []) as T[];
  }

  /**
   * Get the table name
   */
  getTableName(): string {
    return (this.table as any)[Symbol.for("drizzle:Name")];
  }
}

/**
 * Export common query helpers
 */
export { eq, and, or, desc, asc, sql, type SQL };
