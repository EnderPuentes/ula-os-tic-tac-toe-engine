import { Room } from "@/lib/types";
import { logger } from "@/lib/utils";
import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: "*" } });

const rooms: Room[] = [];

io.on("connection", (socket) => {
  logger(`New client connected: ${socket.id}`, "success");

  socket.on("create-room", ({ id, name }) => {
    logger(`Room ${name} created`, "success");
    rooms.push({ id, name, players: [] });
  });

  socket.on("get-rooms", () => {
    logger("Getting rooms", "info");
    socket.emit("rooms", rooms);
  });

  socket.on("disconnect", () => {
    logger(`Client disconnected: ${socket.id}`, "warn");
  });
});

httpServer.listen(3001, () => {
  logger(`------------------------------------------------`, "info");
  logger(`Socket server listening on http://localhost:3001`, "info");
  logger(`------------------------------------------------\n`, "info");
});
