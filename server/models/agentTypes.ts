import { database } from '../helpers/database';

export interface AgentType {
  agentTypeId: number;
  name: string;
}

export async function getAgentType(
  agentTypeId: number
): Promise<AgentType | null> {
  return database.findOne<AgentType>(
    `SELECT * FROM agenttypes WHERE "agentTypeId" = :agentTypeId`,
    { agentTypeId }
  );
}

export async function getAllAgentTypes(): Promise<AgentType[]> {
  return database.find<AgentType>(
    `SELECT * FROM agenttypes ORDER BY "agentTypeId"`
  );
}

export async function countAgentTypes(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM agenttypes`
  );
  return result?.count ?? 0;
}
