/**
 * @openapi
 * /api/auth/status:
 *   get:
 *     summary: Get current authentication status
 *     description: Returns the current authentication status and user information if authenticated. Always returns no-cache headers.
 *     tags:
 *       - Authentication
 *     responses:
 *       '200':
 *         description: Authentication status
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     authenticated:
 *                       type: boolean
 *                       example: false
 *                 - type: object
 *                   properties:
 *                     authenticated:
 *                       type: boolean
 *                       example: true
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         characterId:
 *                           type: integer
 *                         characterName:
 *                           type: string
 *                         corporationId:
 *                           type: integer
 *                         corporationName:
 *                           type: string
 *                         allianceId:
 *                           type: [integer, "null"]
 *                         allianceName:
 *                           type: [string, "null"]
 *                         admin:
 *                           type: boolean
 */
export default defineEventHandler((event) => {
  const user = event.context.authUser;

  // Always mark response as private/no-store
  setResponseHeaders(event, {
    'Cache-Control': 'private, no-store, max-age=0',
    Vary: 'Cookie',
  });

  if (!user) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    user: {
      id: user.id,
      characterId: user.characterId,
      characterName: user.characterName,
      corporationId: user.corporationId,
      corporationName: user.corporationName,
      allianceId: user.allianceId,
      allianceName: user.allianceName,
      admin: Boolean(user.admin),
    },
  };
});
