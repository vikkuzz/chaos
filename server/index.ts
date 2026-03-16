import { createServer } from "http";
import { GameServer } from "./GameServer";

const PORT = Number(process.env.PORT) || 3001;

const httpServer = createServer();
const gameServer = new GameServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Game server listening on port ${PORT}`);
});
