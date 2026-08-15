import { createServer } from "http";
import { GameServer } from "./GameServer";

const PORT = Number(process.env.PORT) || 3001;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const httpServer = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }
  if (req.url?.startsWith("/socket.io")) return;
  const url = req.url || "/";
  if (url === "/" || url.startsWith("/health")) {
    res.writeHead(200, {
      "Content-Type": "application/json",
      ...corsHeaders,
    });
    res.end(JSON.stringify({ status: "ok", service: "game-server" }));
  } else {
    res.writeHead(404, corsHeaders);
    res.end();
  }
});

const gameServer = new GameServer(httpServer);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Game server listening on port ${PORT}`);
});
