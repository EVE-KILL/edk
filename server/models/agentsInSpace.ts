import { database } from '../helpers/database';

export interface AgentInSpace {
  agentId: number;
  dungeonId?: number;
  solarSystemId?: number;
  spawnPointId?: number;
  typeId?: number;
}

export async function getAgentInSpace(
  agentId: number
): Promise<AgentInSpace | null> {
  return database.findOne<AgentInSpace>(
    `SELECT * FROM agentsinspace WHERE "agentId" = :agentId`,
    { agentId }
  );
}

export async function getAgentsInSolarSystem(
  solarSystemId: number
): Promise<AgentInSpace[]> {
  return database.find<AgentInSpace>(
    `SELECT * FROM agentsinspace WHERE "solarSystemId" = :solarSystemId`,
    { solarSystemId }
  );
}

export async function getAllAgentsInSpace(): Promise<AgentInSpace[]> {
  return database.find<AgentInSpace>(
    `SELECT * FROM agentsinspace ORDER BY "agentId"`
  );
}

export async function countAgentsInSpace(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM agentsinspace`
  );
  return result?.count ?? 0;
}
