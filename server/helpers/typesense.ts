import { Configuration, Client } from 'typesense';
import { requestContext } from '../utils/request-context';

export const searchCollectionSchema = {
  name: 'search',
  fields: [
    { name: 'name', type: 'string', sort: true },
    { name: 'type', type: 'string', facet: true },
  ],
};

const host = process.env.TYPESENSE_HOST || 'localhost';
const port = parseInt(process.env.TYPESENSE_PORT || '8108', 10);
const protocol = process.env.TYPESENSE_PROTOCOL || 'http';
const apiKey = process.env.TYPESENSE_API_KEY || 'xyz';

const config = {
  nodes: [
    {
      host,
      port,
      protocol,
    },
  ],
  apiKey,
  connectionTimeoutSeconds: 2,
};

export const typesense = new Client(config);

let searchCollectionEnsured = false;

/**
 * Ensure the search collection exists before writing to it
 */
export async function ensureSearchCollection(): Promise<void> {
  const performance = requestContext.getStore()?.performance;
  const spanId = performance?.startSpan('typesense:ensure_collection', 'search');

  try {
    if (searchCollectionEnsured) {
      return;
    }

    try {
      await typesense.collections('search').retrieve();
      searchCollectionEnsured = true;
      return;
    } catch (error: any) {
      if (error?.httpStatus && error.httpStatus !== 404) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to check Typesense search collection:', error);
        }
        throw error;
      }
    }

    try {
      await typesense.collections().create(searchCollectionSchema);
      searchCollectionEnsured = true;
    } catch (error: any) {
      if (error?.httpStatus === 409) {
        searchCollectionEnsured = true;
        return;
      }

      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to create Typesense search collection:', error);
      }
      throw error;
    }
  } finally {
    if (spanId) performance?.endSpan(spanId);
  }
}

/**
 * Update or add an entity to the search index
 */
export async function updateSearchEntity(
  id: number,
  name: string,
  type:
    | 'character'
    | 'corporation'
    | 'alliance'
    | 'item'
    | 'system'
    | 'constellation'
    | 'region'
): Promise<void> {
  const performance = requestContext.getStore()?.performance;
  const spanId = performance?.startSpan('typesense:upsert', 'search', { type, id });

  try {
    await ensureSearchCollection();

    const documentId = `${type}-${id}`;
    const document = { id: documentId, name, type };

    // Use create/upsert - try create first, if exists update
    try {
      await typesense.collections('search').documents().create(document);
    } catch (error: any) {
      // If document exists (409), update it
      if (error.httpStatus === 409) {
        await typesense
          .collections('search')
          .documents(documentId)
          .update(document);
      } else {
        throw error;
      }
    }
  } catch (error) {
    // Silently fail - search index updates shouldn't break entity storage
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`Failed to update search index for ${type} ${id}:`, error);
    }
  } finally {
    if (spanId) performance?.endSpan(spanId);
  }
}
