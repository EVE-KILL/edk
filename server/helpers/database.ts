import postgres from 'postgres';
import { LRUCache } from 'lru-cache';
import { requestContext } from '../utils/request-context';
import { dbQueryDurationHistogram } from './metrics';
import { env } from './env';
import { als } from './als';

const DEFAULT_DATABASE_URL =
  'postgresql://edk_user:edk_password@localhost:5432/edk';

export type NamedParams = Record<string, any>;

export interface QueryOptions {
  cacheTimeMs?: number;
  cacheKey?: string;
}

export interface DatabaseOptions {
  url?: string;
  maxConnections?: number;
  idleTimeoutSeconds?: number;
  connectTimeoutSeconds?: number;
  cache?: LRUCache.Options<string, any, any>;
}

interface DriverAdapter {
  execute<T = unknown>(query: string, values?: any[]): Promise<T[]>;
}

class PostgresDriverAdapter implements DriverAdapter {
  constructor(private readonly sql: postgres.Sql) {}

  execute<T = unknown>(query: string, values: any[] = []): Promise<T[]> {
    return this.sql.unsafe<T[]>(query, values);
  }
}

export class Database {
  private sqlInstance: postgres.Sql | undefined;
  private driverInstance: DriverAdapter | undefined;
  private currentUrl: string | undefined;
  private readonly cache: LRUCache<string, any>;
  private readonly ownsConnection: boolean;
  private readonly overrideSql?: postgres.Sql;

  constructor(
    private readonly options: DatabaseOptions = {},
    private readonly overrideDriver?: DriverAdapter,
    overrideSql?: postgres.Sql
  ) {
    this.cache = new LRUCache<string, any>({
      max: options.cache?.max ?? 500,
      ttlAutopurge: true,
      ...options.cache,
    });

    this.ownsConnection = !overrideDriver;
    this.overrideSql = overrideSql;
  }

  async setUrl(url: string): Promise<void> {
    if (!this.ownsConnection) {
      throw new Error('Cannot set URL on a transactional database instance');
    }

    if (this.sqlInstance) {
      await this.sqlInstance.end({ timeout: 5 }).catch(() => {});
    }

    this.sqlInstance = undefined;
    this.driverInstance = undefined;
    this.currentUrl = url;
  }

  async close(): Promise<void> {
    if (!this.ownsConnection) {
      return;
    }

    if (this.sqlInstance) {
      await this.sqlInstance.end({ timeout: 5 }).catch(() => {});
      this.sqlInstance = undefined;
      this.driverInstance = undefined;
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.findOne('SELECT 1 as ok');
      return true;
    } catch {
      return false;
    }
  }

  async findOne<T = unknown>(
    query: string,
    params: NamedParams = {},
    options: QueryOptions = {}
  ): Promise<T | null> {
    const cacheKey = this.getCacheKey(query, params, options);
    if (options.cacheTimeMs && cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) {
        return cached as T | null;
      }
    }

    const rows = await this.runQuery<T>(query, params);
    const result = rows[0] ?? null;

    if (options.cacheTimeMs && cacheKey) {
      this.cache.set(cacheKey, result, { ttl: options.cacheTimeMs });
    }

    return result;
  }

  async find<T = unknown>(
    query: string,
    params: NamedParams = {},
    options: QueryOptions = {}
  ): Promise<T[]> {
    const cacheKey = this.getCacheKey(query, params, options);
    if (options.cacheTimeMs && cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) {
        return cached as T[];
      }
    }

    const rows = await this.runQuery<T>(query, params);

    if (options.cacheTimeMs && cacheKey) {
      this.cache.set(cacheKey, rows, { ttl: options.cacheTimeMs });
    }

    return rows;
  }

  async query<T = unknown>(
    query: string,
    params: NamedParams = {},
    options: QueryOptions = {}
  ): Promise<T[]> {
    return this.find<T>(query, params, options);
  }

  async insert(query: string, params: NamedParams = {}): Promise<boolean> {
    return this.execute(query, params);
  }

  async update(query: string, params: NamedParams = {}): Promise<boolean> {
    return this.execute(query, params);
  }

  async upsert(query: string, params: NamedParams = {}): Promise<boolean> {
    return this.execute(query, params);
  }

  async delete(query: string, params: NamedParams = {}): Promise<boolean> {
    return this.execute(query, params);
  }

  async execute(query: string, params: NamedParams = {}): Promise<boolean> {
    await this.runQuery(query, params);
    this.cache.clear();
    return true;
  }

  async bulkInsert(
    table: string,
    rows: Record<string, unknown>[]
  ): Promise<boolean> {
    if (!rows.length) {
      return true;
    }

    const sql = this.sql;
    const columns = Object.keys(rows[0]);
    await sql`INSERT INTO ${sql(table)} ${sql(rows, ...columns)}`;

    return true;
  }

  async bulkUpsert(
    table: string,
    rows: Record<string, unknown>[],
    conflictColumns: string | string[],
    updateColumns?: string[]
  ): Promise<boolean> {
    if (!rows.length) {
      return true;
    }

    const sql = this.sql;
    const columns = Object.keys(rows[0]);
    const conflicts = Array.isArray(conflictColumns)
      ? conflictColumns
      : [conflictColumns];
    const updates =
      updateColumns ?? columns.filter((column) => !conflicts.includes(column));

    if (updates.length === 0) {
      await sql`
        INSERT INTO ${sql(table)} ${sql(rows, ...columns)}
        ON CONFLICT (${sql(conflicts)}) DO NOTHING
      `;
    } else {
      await sql`
        INSERT INTO ${sql(table)} ${sql(rows, ...columns)}
        ON CONFLICT (${sql(conflicts)}) DO UPDATE SET
        ${sql(
          updates.reduce(
            (acc, col) => {
              acc[col] = sql`EXCLUDED.${sql(col)}`;
              return acc;
            },
            {} as Record<string, any>
          )
        )}
      `;
    }

    return true;
  }

  async tableExists(tableName: string): Promise<boolean> {
    const row = await this.findOne<{ exists: number }>(
      `SELECT 1 AS exists FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = :tableName`,
      { tableName }
    );

    return Number(row?.exists) === 1;
  }

  async getTableSchema(
    tableName: string
  ): Promise<
    { name: string; type: string; default_expression: string | null }[]
  > {
    return this.find(
      `SELECT column_name as name, data_type as type, column_default as "default_expression"
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = :tableName
       ORDER BY ordinal_position`,
      { tableName }
    );
  }

  identifier(identifier: string): string {
    if (!identifier) {
      throw new Error('Identifier cannot be empty');
    }

    return identifier
      .split('.')
      .map((segment) => {
        if (!segment) {
          throw new Error(`Invalid identifier segment in "${identifier}"`);
        }
        return `"${segment.replace(/"/g, '""')}"`;
      })
      .join('.');
  }

  async transaction<T>(callback: (tx: Database) => Promise<T>): Promise<T> {
    if (!this.ownsConnection) {
      throw new Error('Nested transactions are not supported');
    }

    const sql = this.getSql();
    return sql.begin(async (txSql) => {
      const txDb = new Database(
        { ...this.options, cache: { max: 0 } },
        new PostgresDriverAdapter(txSql),
        txSql
      );

      const result = await callback(txDb);
      this.cache.clear();
      return result;
    }) as unknown as Promise<T>;
  }

  get sql(): postgres.Sql {
    return this.getSql();
  }

  clearCache(): void {
    this.cache.clear();
  }

  private get driver(): DriverAdapter {
    if (this.overrideDriver) {
      return this.overrideDriver;
    }

    if (!this.driverInstance) {
      this.driverInstance = new PostgresDriverAdapter(this.getSql());
    }

    return this.driverInstance;
  }

  private getSql(): postgres.Sql {
    if (this.overrideSql) {
      return this.overrideSql;
    }

    if (this.overrideDriver) {
      throw new Error('Transactional database does not expose base client');
    }

    if (!this.sqlInstance) {
      const url =
        this.options.url ||
        this.currentUrl ||
        env.DATABASE_URL ||
        DEFAULT_DATABASE_URL;

      this.currentUrl = url;

      this.sqlInstance = postgres(url, {
        max: this.options.maxConnections ?? env.DB_POOL_MAX,
        idle_timeout: this.options.idleTimeoutSeconds ?? env.DB_IDLE_TIMEOUT,
        connect_timeout:
          this.options.connectTimeoutSeconds ?? env.DB_CONNECT_TIMEOUT,
      });
    }

    return this.sqlInstance;
  }

  private async runQuery<T = unknown>(
    query: string,
    params: NamedParams
  ): Promise<T[]> {
    this.assertNoPositionalParams(query);
    const { sql, values } = this.prepare(query, params);
    const performance = requestContext.getStore()?.performance;

    const store = als.getStore();
    const finalSql = store?.correlationId
      ? `/* correlationId: ${store.correlationId} */ ${sql}`
      : sql;

    // Extract table name for span naming (simple heuristic)
    const tableName =
      sql.match(
        /(?:FROM|UPDATE|INSERT INTO|DELETE FROM)\s+([a-zA-Z0-9_"]+)/i
      )?.[1] || 'query';

    // Capture current parent span before query starts
    const parentSpanId = performance?.['currentSpanId'];

    const start = Date.now();

    // Debug logging if DEBUG env var is set
    if (env.DEBUG) {
      logger.info(
        '[DB Query]',
        finalSql.substring(0, 200) + (finalSql.length > 200 ? '...' : '')
      );
      logger.info('[DB Params]', values);
    }

    try {
      const rows = await this.driver.execute<T>(finalSql, values as any[]);
      const duration = Date.now() - start;
      dbQueryDurationHistogram.observe({ query: finalSql }, duration / 1000);

      if (performance) {
        performance.addQuery(finalSql, values, duration);
        // Create span with accurate query duration and parent
        const spanId = performance.startSpan(`db:${tableName}`, 'database', {
          sql: finalSql,
        });
        const span = performance['spans'].get(spanId);
        if (span) {
          span.startTime = start;
          span.endTime = Date.now();
          span.duration = duration;
          span.parentId = parentSpanId;
        }
      }

      if (env.DEBUG) {
        logger.info(`[DB Duration] ${duration}ms, rows: ${rows.length}`);
      }

      return rows;
    } catch (error) {
      const duration = Date.now() - start;
      dbQueryDurationHistogram.observe({ query: finalSql }, duration / 1000);

      if (performance) {
        performance.addQuery(finalSql, values, duration);
        // Create span with accurate query duration even on error and set parent
        const spanId = performance.startSpan(`db:${tableName}`, 'database', {
          sql: finalSql,
        });
        const span = performance['spans'].get(spanId);
        if (span) {
          span.startTime = start;
          span.endTime = Date.now();
          span.duration = duration;
          span.parentId = parentSpanId;
        }
      }

      if (env.DEBUG) {
        logger.error('[DB Error]', error);
      }

      throw error;
    }
  }

  private prepare(
    query: string,
    params: NamedParams
  ): { sql: string; values: any[] } {
    const values: any[] = [];
    const replacements = new Map<string, string>();

    const length = query.length;
    let result = '';
    let i = 0;
    let inSingle = false;
    let inDouble = false;
    let inLineComment = false;
    let inBlockComment = false;

    while (i < length) {
      const char = query[i];
      const next = query[i + 1];

      if (inLineComment) {
        if (char === '\n') {
          inLineComment = false;
        }
        result += char;
        i += 1;
        continue;
      }

      if (inBlockComment) {
        if (char === '*' && next === '/') {
          inBlockComment = false;
          result += '*/';
          i += 2;
        } else {
          result += char;
          i += 1;
        }
        continue;
      }

      if (!inSingle && !inDouble && char === '-' && next === '-') {
        inLineComment = true;
        result += char;
        i += 1;
        continue;
      }

      if (!inSingle && !inDouble && char === '/' && next === '*') {
        inBlockComment = true;
        result += '/*';
        i += 2;
        continue;
      }

      if (!inDouble && char === "'") {
        if (inSingle && next === "'") {
          result += "''";
          i += 2;
          continue;
        }
        inSingle = !inSingle;
        result += char;
        i += 1;
        continue;
      }

      if (!inSingle && char === '"') {
        if (inDouble && next === '"') {
          result += '""';
          i += 2;
          continue;
        }
        inDouble = !inDouble;
        result += char;
        i += 1;
        continue;
      }

      if (!inSingle && !inDouble && char === ':' && this.isParamStart(next)) {
        // Skip casts like ::interval
        if (i > 0 && query[i - 1] === ':') {
          result += char;
          i += 1;
          continue;
        }

        const { name, offset } = this.readParamName(query, i + 1);

        // Check if this parameter is inside ANY() - look backwards for ANY(
        const beforeParam = result.slice(Math.max(0, result.length - 20));
        const isInsideAny = /ANY\s*\(\s*$/i.test(beforeParam);

        const replacement = this.getPlaceholder(
          name,
          params,
          replacements,
          values,
          isInsideAny
        );
        result += replacement;
        i = offset;
        continue;
      }

      result += char;
      i += 1;
    }

    return { sql: result, values };
  }

  private isParamStart(char?: string): boolean {
    if (!char) {
      return false;
    }

    return /[a-zA-Z_]/.test(char);
  }

  private readParamName(query: string, startIndex: number) {
    let name = '';
    let index = startIndex;

    while (index < query.length) {
      const char = query[index];
      if (!/[a-zA-Z0-9_]/.test(char)) {
        break;
      }
      name += char;
      index += 1;
    }

    if (!name) {
      throw new Error('Encountered ":" without a parameter name');
    }

    return { name, offset: index };
  }

  private getPlaceholder(
    name: string,
    params: NamedParams,
    replacements: Map<string, string>,
    values: unknown[],
    isInsideAny: boolean = false
  ) {
    if (!Object.prototype.hasOwnProperty.call(params, name)) {
      throw new Error(`Missing value for parameter :${name}`);
    }

    const existing = replacements.get(name);
    if (existing) {
      return existing;
    }

    const value = params[name];
    if (value === undefined) {
      throw new Error(`Parameter :${name} is undefined`);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        throw new Error(
          `Parameter :${name} is an empty array - supply at least one value or skip the condition`
        );
      }

      // For ANY(), pass the array as a single parameter instead of expanding
      if (isInsideAny) {
        values.push(value);
        const placeholder = `$${values.length}`;
        replacements.set(name, placeholder);
        return placeholder;
      }

      // For IN(), expand the array into multiple placeholders
      const placeholderList = value
        .map((entry) => {
          values.push(entry);
          return `$${values.length}`;
        })
        .join(', ');

      replacements.set(name, placeholderList);
      return placeholderList;
    }

    values.push(value);
    const placeholder = `$${values.length}`;
    replacements.set(name, placeholder);
    return placeholder;
  }

  private assertNoPositionalParams(query: string): void {
    if (/\$\d+/u.test(query)) {
      throw new Error(
        'Positional parameters are not supported. Use named parameters like :example instead.'
      );
    }
  }

  private getCacheKey(
    query: string,
    params: NamedParams,
    options: QueryOptions
  ): string | null {
    if (!options.cacheTimeMs || options.cacheTimeMs <= 0) {
      return null;
    }

    if (options.cacheKey) {
      return options.cacheKey;
    }

    try {
      const serialized = JSON.stringify({
        query,
        params: this.stableSerialize(params),
      });
      return serialized;
    } catch {
      return null;
    }
  }

  private stableSerialize(value: unknown): unknown {
    if (value === null) {
      return null;
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.stableSerialize(entry));
    }

    if (value instanceof Date) {
      return { __type: 'date', value: value.toISOString() };
    }

    if (Buffer.isBuffer(value)) {
      return { __type: 'buffer', value: value.toString('base64') };
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (typeof value === 'object') {
      const entries: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        entries[key] = this.stableSerialize(
          (value as Record<string, unknown>)[key]
        );
      }
      return entries;
    }

    return value;
  }
}

export const database = new Database();
