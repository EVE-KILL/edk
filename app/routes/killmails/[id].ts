// Killmail endpoint with dynamic parameter
export async function GET(req: Request): Promise<Response> {
  const params = (req as any).params;
  const killmailId = params.id;
  
  // Mock killmail data
  const killmail = {
    id: killmailId,
    victim: {
      character: {
        id: Math.floor(Math.random() * 100000),
        name: "Test Victim",
        corporation: "Victim Corp"
      },
      ship: {
        id: 587,
        name: "Rifter"
      },
      location: {
        system: "Jita",
        region: "The Forge"
      }
    },
    attackers: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, i) => ({
      character: {
        id: Math.floor(Math.random() * 100000),
        name: `Attacker ${i + 1}`,
        corporation: `Attacker Corp ${i + 1}`
      },
      ship: {
        id: Math.floor(Math.random() * 1000),
        name: `Ship ${i + 1}`
      },
      finalBlow: i === 0
    })),
    timestamp: new Date().toISOString(),
    value: Math.floor(Math.random() * 1000000000)
  };
  
  return new Response(JSON.stringify(killmail), {
    headers: { "Content-Type": "application/json" }
  });
}