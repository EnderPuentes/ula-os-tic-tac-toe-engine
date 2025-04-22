import { Player, Room } from "@/lib/types";
import { logger } from "@/lib/utils";
import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: "*" } });

const players: Player[] = [];
const rooms: Room[] = [];

io.on("connection", (socket) => {
  logger(`New client connected: ${socket.id}`, "success");

  socket.on("create-player", (playerName: string) => {
    const newPlayer = {
      id: socket.id,
      name: playerName,
      avatar: `https://api.dicebear.com/6.x/bottts/svg?seed=${playerName}`,
    };

    players.push(newPlayer);

    io.emit("players", players);
    logger(`Player ${newPlayer.name} created`, "success");
  });

  socket.on("get-players", () => {
    logger("Getting players", "info");
    io.emit("players", players);
  });

  socket.on("create-room", (roomName: string) => {
    const newRoom = {
      id: crypto.randomUUID(),
      name: roomName,
      players: [],
    };

    rooms.push(newRoom);

    io.emit("rooms", rooms);
    logger(`Room ${newRoom.name} created`, "success");
  });

  socket.on("get-rooms", () => {
    logger("Getting rooms", "info");
    io.emit("rooms", rooms);
  });

  // Join player to room
  socket.on("join-player-to-room", (roomId: string) => {
    // Check if room exists
    const room = rooms.find((room) => room.id === roomId);
    if (!room) {
      logger(`Room ${roomId} not found`, "warn");
      io.emit("error", "Room not found");
      return;
    }

    // Check if room is full
    if (room.players.length >= 2) {
      logger(`Room ${roomId} is full`, "warn");
      io.emit("error", "Room is full");
      return;
    }

    // Check if player exists
    const player = players.find((player) => player.id === socket.id);
    if (!player) {
      logger(`Player ${socket.id} not found`, "warn");
      io.emit("error", "Player not found");
      return;
    }
    // Check if player is already in room
    if (room.players.some((p) => p.id === socket.id)) {
      logger(`Player ${socket.id} already in room ${roomId}`, "warn");
      io.emit("error", "Player already in room");
      return;
    }

    // Add player to room
    room.players.push(player);

    logger(`Player ${socket.id} joined room ${roomId}`, "success");
    io.emit("success", `Player ${player.name} joined room ${room.name}`);
    io.emit("rooms", rooms);
  });

  socket.on("get-room", (roomId: string) => {
    const room = rooms.find((room) => room.id === roomId);
    io.emit("room", room);
  });

  socket.on("disconnect", () => {
    logger(`Player disconnected: ${socket.id}`, "warn");
    // Remove player from players array
    const updatedPlayers = players.filter((player) => player.id !== socket.id);
    players.length = 0;
    players.push(...updatedPlayers);
    io.emit("players", players);

    // Remove player from rooms
    const updatedRooms = rooms.filter((room) => room.id !== socket.id);
    rooms.length = 0;
    rooms.push(...updatedRooms);
    io.emit("rooms", rooms);
  });
});

httpServer.listen(3001, () => {
  logger(`------------------------------------------------`, "info");
  logger(`Socket server listening on http://localhost:3001`, "info");
  logger(`------------------------------------------------\n`, "info");
});
