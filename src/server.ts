import crypto from "crypto";
import { createServer } from "http";
import { Server } from "socket.io";
import { Worker } from "worker_threads";
import type { Message, Player, Room } from "./lib/types";
import { getAvatarUrl, logger } from "./lib/utils";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

const players = new Map<string, Player>();
const rooms = new Map<string, Worker>();

io.on("connection", (socket) => {
  logger("Client connected", "info");

  socket.on("create-player", (playerName: string) => {
    const playerId = socket.id;

    players.set(playerId, {
      id: playerId,
      name: playerName,
      avatar: getAvatarUrl(playerName),
    });

    logger(`Player created: ${playerName}`, "success");
    io.emit("player-created", playerId);
  });

  socket.on("create-room", (roomName: string) => {
    const roomId = crypto.randomUUID();

    const worker = new Worker("./src/workers/room.ts", {
      workerData: {
        id: roomId,
        name: roomName,
        status: "waiting",
        chat: {
          messages: [],
          playersTyping: [],
        },
        players: [],
        maxPlayers: 2,
      } as Room,
      execArgv: ["-r", "ts-node/register"],
    });

    rooms.set(roomId, worker);
    logger(`Room created: ${roomName}`, "success");
    io.emit("room-created", roomId);
  });

  socket.on("get-players", async () => {
    const playersData: Player[] = Array.from(players.values());
    logger(`Players fetched: ${playersData.length}`, "info");
    io.emit("players", playersData);
  });

  socket.on("get-rooms", async () => {
    const dataPromises = Array.from(rooms.values()).map(
      (worker) =>
        new Promise<Room>((resolve) => {
          const onMessage = (data: Room) => {
            resolve(data);
            worker.off("message", onMessage);
          };
          worker.on("message", onMessage);
          worker.postMessage("get-room-data");
        })
    );

    const roomsData = await Promise.all(dataPromises);
    io.emit("rooms", roomsData);
  });

  socket.on("get-room", async (roomId: string) => {
    logger(`Getting room ${roomId}`, "info");

    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      logger(`Room not found`, "error");
      return;
    }

    const roomData: Room = await new Promise((resolve) => {
      const onMessage = (data: Room) => {
        resolve(data);
        roomWorker.off("message", onMessage);
      };
      roomWorker.on("message", onMessage);
      roomWorker.postMessage("get-room-data");
    });

    logger(`Room data fetched ${roomData.name}`, "info");
    socket.emit("room", roomData);
  });

  socket.on("join-player-to-room", (roomId: string) => {
    // Check if player is in room
    const player: Player | undefined = players.get(socket.id);
    if (!player) {
      logger(`Player not found`, "error");
      return;
    }

    // Check if room exists
    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      logger(`Room not found`, "error");
      return;
    }

    // Join player to room
    roomWorker.postMessage({
      type: "join-player",
      player,
    });

    // Listen for messages from room worker
    roomWorker.on("message", (message) => {
      if (message.type === "player-joined") {
        logger(`Player joined room ${roomId}`, "success");
        io.emit("player-joined", message.player.id);
      }

      if (message.type === "room-full") {
        logger(`Room ${roomId} is full`, "warn");
        socket.emit("room-full", roomId);
      }
    });
  });

  socket.on("send-message-to-room", (roomId: string, message: string) => {
    logger(`Sending message to room ${roomId}`, "info");

    // Check if player is in room
    const player: Player | undefined = players.get(socket.id);
    if (!player) {
      logger(`Player not found`, "error");
      return;
    }

    // Check if room exists
    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      logger(`Room not found`, "error");
      return;
    }

    roomWorker.postMessage({
      type: "send-message",
      message: {
        content: message,
        sender: player,
        timestamp: Date.now(),
      } as Message,
    });

    // Listen for messages from room worker
    roomWorker.on("message", (message) => {
      if (message.type === "message-sent") {
        logger(`Message sent to room ${roomId}`, "success");
        io.emit("message-sent", message.message);
      }
    });
  });

  socket.on("player-typing-on-in-chat-of-room", (roomId: string) => {
    // Check if player is in room
    const player: Player | undefined = players.get(socket.id);
    if (!player) {
      logger(`Player not found`, "error");
      return;
    }

    // Check if room exists
    const roomWorker = rooms.get(roomId);
    if (!roomWorker) {
      logger(`Room not found`, "error");
      return;
    }

    // Send message to room worker
    roomWorker.postMessage({
      type: "player-typing-on-in-chat",
      player,
    });

    // Listen for messages from room worker
    roomWorker.on("message", (message) => {
      if (message.type === "add-player-typing-in-chat-of-room") {
        logger(`Player typing on in chat of room ${roomId}`, "success");
        io.emit("add-player-typing-in-chat-of-room", message.player);
      }
    });
  });

  socket.on("player-typing-off-in-chat-of-room", (roomId: string) => {
    // Check if player is in room
    const player: Player | undefined = players.get(socket.id);
    if (!player) {
      logger(`Player not found`, "error");
      return;
    }

    // Check if room exists
    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      logger(`Room not found`, "error");
      return;
    }

    // Send message to room worker
    roomWorker.postMessage({
      type: "player-typing-off-in-chat",
      player,
    });

    // Listen for messages from room worker
    roomWorker.on("message", (message) => {
      if (message.type === "remove-player-typing-in-chat-of-room") {
        logger(`Player typing off in chat of room ${roomId}`, "success");
        io.emit("remove-player-typing-in-chat-of-room", message.player);
      }
    });
  });

  socket.on("disconnect", () => {
    logger(`Player disconnected: ${socket.id}`, "warn");
    players.delete(socket.id);
    const playersData = Array.from(players.values());
    logger(`Players fetched: ${playersData.length}`, "info");
    io.emit("players", playersData);
  });
});

httpServer.listen(3001, () => {
  logger(`------------------------------------------------`, "info");
  logger(`Socket server listening on http://localhost:3001`, "info");
  logger(`------------------------------------------------\n`, "info");
});
