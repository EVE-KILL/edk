// Health check endpoint
export function GET(req: Request): Response {
  return new Response(JSON.stringify({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "4.0.0"
  }), {
    headers: { "Content-Type": "application/json" }
  });
}