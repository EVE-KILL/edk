// Users collection endpoint
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  
  // Mock users data
  const users = Array.from({ length: limit }, (_, i) => ({
    id: offset + i + 1,
    name: `User ${offset + i + 1}`,
    corporation: `Corporation ${Math.floor(Math.random() * 100)}`,
    killmails: Math.floor(Math.random() * 1000),
    losses: Math.floor(Math.random() * 500)
  }));
  
  return new Response(JSON.stringify({
    users,
    pagination: {
      limit,
      offset,
      total: 10000 // Mock total
    }
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    
    // Mock user creation
    const newUser = {
      id: Math.floor(Math.random() * 10000),
      ...body,
      createdAt: new Date().toISOString(),
      killmails: 0,
      losses: 0
    };
    
    return new Response(JSON.stringify(newUser), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}