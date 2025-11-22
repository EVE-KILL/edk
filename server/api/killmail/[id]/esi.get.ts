/**
 * GET /api/killmail/{id}/esi
 *
 * Retrieves a killmail by ID in ESI format
 *
 * @param id - The killmail ID to fetch
 * @returns ESI formatted killmail data
 */
export default defineEventHandler(async (event: any) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing killmail ID',
    });
  }

  const killmailId = parseInt(id, 10);

  if (isNaN(killmailId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid killmail ID - must be a number',
    });
  }

  const killmail = await getKillmail(killmailId);

  if (!killmail) {
    throw createError({
      statusCode: 404,
      statusMessage: `Killmail with ID ${killmailId} not found`,
    });
  }

  return killmail;
});
