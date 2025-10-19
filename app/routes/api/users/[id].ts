// User API routes with dynamic parameter
export async function GET(req: Request): Promise<Response> {
  const params = (req as any).params;
  const userId = params.id;
  
  // Mock user data
  const user = {
    id: userId,
    name: `User ${userId}`,
    corporation: "Test Corporation",
    alliance: "Test Alliance",
    killmails: Math.floor(Math.random() * 1000),
    losses: Math.floor(Math.random() * 500)
  };
  
  return new Response(JSON.stringify(user), {
    headers: { "Content-Type": "application/json" }
  });
}

export async function PUT(req: Request): Promise<Response> {
  const params = (req as any).params;
  const userId = params.id;
  
  try {
    const body = await req.json();
    
    // Mock update operation
    const updatedUser = {
      id: userId,
      ...body,
      updatedAt: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(updatedUser), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const params = (req as any).params;
  const userId = params.id;
  
  return new Response(JSON.stringify({ 
    message: `User ${userId} deleted successfully` 
  }), {
    headers: { "Content-Type": "application/json" }
  });
}