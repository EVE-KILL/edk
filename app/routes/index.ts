// Home page route
export default function handler(req: Request): Response {
  return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>EVE Kill v4</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui; margin: 2rem; }
          .routes { margin: 2rem 0; }
          .route { padding: 0.5rem; margin: 0.25rem 0; background: #f5f5f5; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>🚀 EVE Kill v4</h1>
        <p>Welcome to the new EVE Kill API built with Bun!</p>
        
        <div class="routes">
          <h2>Available Routes:</h2>
          <div class="route">GET / - This homepage</div>
          <div class="route">GET /api/health - Health check</div>
          <div class="route">GET /api/users/:id - Get user by ID</div>
          <div class="route">POST /api/users - Create user</div>
          <div class="route">GET /killmails/:id - Get killmail by ID</div>
        </div>
      </body>
    </html>
  `, {
    headers: { "Content-Type": "text/html" }
  });
}