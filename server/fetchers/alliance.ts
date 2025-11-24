import { fetchESI } from '../helpers/esi';
import {
  storeAlliance as storeAllianceInDB,
  getAlliance,
} from '../models/alliances';
import { logger } from '../helpers/logger';

/**
 * ESI Alliance Data - Fields we store
 * Only contains fields from the official ESI API
 */
export interface ESIAlliance {
  creator_corporation_id: number;
  creator_id: number;
  date_founded: string | null;
  executor_corporation_id: number;
  name: string;
  ticker: string;
}

/**
 * Fetch alliance data from ESI
 * Stores only ESI-compatible fields in the database
 */
export async function fetchAndStoreAlliance(
  allianceId: number
): Promise<ESIAlliance | null> {
  try {
    const allianceData = await fetchFromESI(allianceId);

    if (!allianceData) {
      return null;
    }

    // Extract only ESI fields
    const esiAlliance = extractESIFields(allianceData);

    // Store in database
    await storeAlliance(allianceId, esiAlliance);

    return esiAlliance;
  } catch (error) {
    logger.error(`ESI fetch failed for alliance ${allianceId}`, {
      error: String(error),
    });
    return null;
  }
}

/**
 * Fetch alliance data from ESI API
 */
async function fetchFromESI(allianceId: number): Promise<any | null> {
  try {
    const response = await fetchESI(`/alliances/${allianceId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`ESI API error: ${response.statusText}`);
    }

    return response.data;
  } catch (error) {
    logger.error(`ESI fetch failed for alliance ${allianceId}`, {
      error: String(error),
    });
    return null;
  }
}

/**
 * Extract only ESI-compatible fields from alliance data
 */
function extractESIFields(data: any): ESIAlliance {
  return {
    creator_corporation_id: data.creator_corporation_id,
    creator_id: data.creator_id,
    date_founded: data.date_founded,
    executor_corporation_id: data.executor_corporation_id,
    name: data.name,
    ticker: data.ticker,
  };
}

/**
 * Store alliance in database
 */
async function storeAlliance(
  allianceId: number,
  alliance: ESIAlliance
): Promise<void> {
  await storeAllianceInDB(allianceId, {
    creatorCorporationId: alliance.creator_corporation_id,
    creatorId: alliance.creator_id,
    dateFounded: alliance.date_founded,
    executorCorporationId: alliance.executor_corporation_id,
    name: alliance.name,
    ticker: alliance.ticker,
  });
}

/**
 * Get cached alliance from database
 */
export async function getCachedAlliance(
  allianceId: number
): Promise<ESIAlliance | null> {
  try {
    const result = await getAlliance(allianceId);

    if (!result) {
      return null;
    }

    return {
      creator_corporation_id: result.creatorCorporationId,
      creator_id: result.creatorId,
      date_founded: result.dateFounded,
      executor_corporation_id: result.executorCorporationId,
      name: result.name,
      ticker: result.ticker,
    };
  } catch (error) {
    return null;
  }
}
