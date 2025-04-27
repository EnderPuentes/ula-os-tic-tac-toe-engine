/**
 * Server for real-time Tic-Tac-Toe multiplayer game
 * Handles player connections, room management, and game state
 * Uses worker threads for concurrent room processing
 */

import crypto from "crypto";
import { createServer } from "http";
import { Server } from "socket.io";
import { Worker } from "worker_threads";
import type {
  Message,
  Player,
  Room,
  WorkerMessageReceive,
  WorkerMessageSend,
} from "./lib/types";
import { getAvatarUrl, logger } from "./lib/utils";

// Create HTTP and Socket.IO servers
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// Store connected players and active game rooms
const players = new Map<string, Player>();
const rooms = new Map<string, Worker>();

/**
 * Handle client connection
 * Sets up socket event listeners for game actions
 */
io.on("connection", (socket) => {
  logger("Client connected", "info");

  /**
   * Create player
   * @param playerName - The name of the player
   * Creates new player with unique ID and avatar
   */
  socket.on("create-player", (playerName: string) => {
    const playerId = socket.id;

    if (players.has(playerId)) {
      // Emit player created error
      logger(`Player already exists`, "error");
      io.emit("player-created-error", "Player already exists");
      return;
    }

    // Create player
    const player: Player = {
      id: playerId,
      name: playerName,
      avatar: getAvatarUrl(playerName),
    };

    // Set player
    players.set(playerId, player);

    // Emit player created
    logger(`Player created: ${playerName}`, "success");
    io.emit("player-created", playerId);
  });

  /**
   * Create room
   * @param roomName - The name of the room
   * Creates new game room with worker thread
   */
  socket.on("create-room", (roomName: string) => {
    // Generate room id
    const roomId = crypto.randomUUID();

    // Check if room already exists
    if (rooms.has(roomId)) {
      // Emit room created error
      logger(`Room already exists`, "error");
      io.emit("room-created-error", "Room already exists");
      return;
    }

    // Create room
    const room: Room = {
      id: roomId,
      name: roomName,
      status: "waiting",
      game: {
        board: Array(9).fill(""),
        currentPlayer: null,
        winner: null,
      },
      chat: { messages: [], playersTyping: [] },
      players: [],
      maxPlayers: 2,
    };

    // Create room worker
    const worker = new Worker("./src/workers/room.ts", {
      workerData: room,
      execArgv: ["-r", "ts-node/register"],
    });

    // Set room
    rooms.set(roomId, worker);

    // Emit room created
    logger(`Room created: ${roomName}`, "success");
    io.emit("room-created", roomId);
  });

  /**
   * Get players
   * Returns list of all connected players
   */
  socket.on("get-players", async () => {
    // Check if there are no players
    if (players.size === 0) {
      // Emit empty players data
      logger(`No players found`, "info");
      io.emit("players", []);
    } else {
      // Get players data
      const playersData: Player[] = Array.from(players.values());

      // Emit players data
      logger(`Players fetched: ${players.size}`, "info");
      io.emit("players", playersData);
    }
  });

  /**
   * Get rooms
   * Returns list of all active game rooms
   */
  socket.on("get-rooms", async () => {
    // Check if there are no rooms
    if (rooms.size === 0) {
      // Emit empty rooms data
      logger(`No rooms found`, "info");
      io.emit("rooms", []);
    } else {
      // Get rooms data
      const dataPromises = Array.from(rooms.values()).map(
        (worker) =>
          new Promise<Room>((resolve) => {
            // On message
            const onMessage = (messageReceive: WorkerMessageReceive) => {
              resolve(messageReceive.data as Room);
              worker.off("message", onMessage);
            };

            // Listen for messages
            worker.on("message", onMessage);

            // Send message to worker
            const messageSend: WorkerMessageSend = {
              type: "get",
              data: null,
            };
            worker.postMessage(messageSend);
          })
      );

      // Get rooms data
      const roomsData: Room[] = await Promise.all(dataPromises);

      // Emit rooms data
      logger(`Rooms fetched: ${rooms.size}`, "info");
      io.emit("rooms", roomsData);
    }
  });

  /**
   * Get room
   * @param roomId - The id of the room
   * Returns data for specific room
   */
  socket.on("get-room", async (roomId: string) => {
    logger(`Getting room ${roomId}`, "info");

    // Check if room exists
    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      // Emit room not found
      logger(`Room not found`, "error");
      io.emit("get-room-error", `Room ${roomId} not found`);
      return;
    }

    // Get room data from worker
    const roomData: Room | undefined = await new Promise((resolve) => {
      // On message
      const onMessage = (messageReceive: WorkerMessageReceive) => {
        resolve(messageReceive.data as Room);
        roomWorker.off("message", onMessage);
      };

      // Listen for messages
      roomWorker.on("message", onMessage);

      // Send message to worker
      const messageSend: WorkerMessageSend = {
        type: "get",
        data: null,
      };
      roomWorker.postMessage(messageSend);
    });

    if (roomData) {
      // Emit room data
      logger(`Room data fetched ${roomData.name}`, "info");
      socket.emit("room", roomData);
    } else {
      // Emit undefined room data
      logger(`Room data not found`, "error");
      io.emit("get-room-error", `Room ${roomId} not found`);
    }
  });

  /**
   * Join player to room
   * @param roomId - The id of the room to join
   * Adds player to specified game room
   */
  socket.on("join-player-to-room", (roomId: string) => {
    // Check if player is in room
    const player: Player | undefined = players.get(socket.id);
    if (!player) {
      // Emit join player to room error
      logger(`Player not found`, "error");
      io.emit("join-player-to-room-error", `Player ${socket.id} not found`);
      return;
    }

    // Check if room exists
    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      // Emit join player to room error
      logger(`Room not found`, "error");
      io.emit("join-player-to-room-error", `Room ${roomId} not found`);
      return;
    }

    // Join player to room
    const messageSend: WorkerMessageSend = {
      type: "join-player",
      data: player,
    };
    roomWorker.postMessage(messageSend);

    // Listen for messages from room worker
    roomWorker.on("message", (messageReceive: WorkerMessageReceive) => {
      const room: Room = messageReceive.data as Room;

      switch (messageReceive.type) {
        case "room-full":
          // Emit room full
          logger(`Room ${roomId} is full`, "warn");
          socket.emit(
            "player-joined-to-room-error",
            `Room ${roomId} is full, max players: ${room.maxPlayers}`
          );
          break;

        case "player-already-in-room":
          // Emit player already in room
          logger(`Player already in room ${roomId}`, "warn");
          socket.emit(
            "player-joined-to-room-error",
            `Player ${player.id} already in room ${roomId}`
          );
          break;

        case "player-joined":
          // Emit player joined
          logger(`Player joined room ${roomId}`, "success");
          const playerJoined: Player = messageReceive.data as Player;
          io.emit("player-joined-to-room-success", playerJoined.id);
          break;

        default:
          logger(`Unknown message from room worker`, "error");
          io.emit(
            "player-joined-to-room-error",
            `Unknown message from room worker`
          );
          break;
      }
    });
  });

  /**
   * Send message to room
   * @param roomId - The id of the room
   * @param message - The message content
   * Sends chat message to specified room
   */
  socket.on("send-message-to-room", (roomId: string, message: string) => {
    logger(`Sending message to room ${roomId}`, "info");

    // Check if player is in room
    const player: Player | undefined = players.get(socket.id);
    if (!player) {
      // Emit send message to room error
      logger(`Player not found`, "error");
      io.emit("send-message-to-room-error", `Player ${socket.id} not found`);
      return;
    }

    // Check if room exists
    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      // Emit send message to room error
      logger(`Room not found`, "error");
      io.emit("send-message-to-room-error", `Room ${roomId} not found`);
      return;
    }

    // Send message to room worker
    const messageSend: WorkerMessageSend = {
      type: "send-message",
      data: {
        content: message,
        sender: player,
        timestamp: Date.now(),
      } as Message,
    };

    // Send message to room worker
    roomWorker.postMessage(messageSend);

    // Listen for messages from room worker
    roomWorker.on("message", (messageReceive: WorkerMessageReceive) => {
      if (messageReceive.type === "message-sent") {
        // Emit message sent
        logger(`Message sent to room ${roomId}`, "success");
        io.emit("message-sent", messageReceive.data);
      }
    });
  });

  /**
   * Player typing indicator on
   * @param roomId - The id of the room
   * Shows typing indicator for player in chat
   */
  socket.on("player-typing-on-in-chat-of-room", (roomId: string) => {
    // Check if player is in room
    const player: Player | undefined = players.get(socket.id);
    if (!player) {
      // Emit player typing on in chat of room error
      logger(`Player not found`, "error");
      io.emit(
        "player-typing-on-in-chat-of-room-error",
        `Player ${socket.id} not found`
      );
      return;
    }

    // Check if room exists
    const roomWorker = rooms.get(roomId);
    if (!roomWorker) {
      // Emit player typing on in chat of room error
      logger(`Room not found`, "error");
      io.emit(
        "player-typing-on-in-chat-of-room-error",
        `Room ${roomId} not found`
      );
      return;
    }

    // Create message to send to room worker
    const messageSend: WorkerMessageSend = {
      type: "player-typing-on-in-chat",
      data: player,
    };

    // Send message to room worker
    roomWorker.postMessage(messageSend);

    // Listen for messages from room worker
    roomWorker.on("message", (messageReceive: WorkerMessageReceive) => {
      if (messageReceive.type === "emit-player-typing-in-chat-of-room") {
        // Emit player typing on in chat of room
        logger(`Player typing on in chat of room ${roomId}`, "success");
        io.emit("add-player-typing-in-chat-of-room", messageReceive.data);
      }
    });
  });

  /**
   * Player typing indicator off
   * @param roomId - The id of the room
   * Removes typing indicator for player in chat
   */
  socket.on("player-typing-off-in-chat-of-room", (roomId: string) => {
    // Check if player is in room
    const player: Player | undefined = players.get(socket.id);
    if (!player) {
      // Emit player typing off in chat of room error
      logger(`Player not found`, "error");
      io.emit(
        "player-typing-off-in-chat-of-room-error",
        `Player ${socket.id} not found`
      );
      return;
    }

    // Check if room exists
    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      // Emit player typing off in chat of room error
      logger(`Room not found`, "error");
      io.emit(
        "player-typing-off-in-chat-of-room-error",
        `Room ${roomId} not found`
      );
      return;
    }

    // Create message to send to room worker
    const messageSend: WorkerMessageSend = {
      type: "player-typing-off-in-chat",
      data: player,
    };

    // Send message to room worker
    roomWorker.postMessage(messageSend);

    // Listen for messages from room worker
    roomWorker.on("message", (messageReceive: WorkerMessageReceive) => {
      if (messageReceive.type === "emit-player-typing-off-in-chat-of-room") {
        // Emit player typing off in chat of room
        logger(`Player typing off in chat of room ${roomId}`, "success");
        io.emit("remove-player-typing-in-chat-of-room", messageReceive.data);
      }
    });
  });

  /**
   * Handle client disconnect
   * Removes player from game and cleans up rooms
   */
  socket.on("disconnect", async () => {
    logger(`Player disconnected: ${socket.id}`, "warn");

    // Check if player is in room
    const player: Player | undefined = players.get(socket.id);
    if (!player) {
      // Emit send message to room error
      logger(`Player not found`, "error");
      io.emit("send-message-to-room-error", `Player ${socket.id} not found`);
      return;
    }

    /*
     * Delete player
     */
    logger(`Deleting player: ${socket.id}`, "info");
    players.delete(socket.id);

    /*
     * Check if player is in any room with 'playing' status
     */
    logger(`Checking if player is in any room with 'playing' status`, "info");

    // Get rooms data
    const dataPromises = Array.from(rooms.values()).map(
      (worker) =>
        new Promise<Room>((resolve) => {
          // On message
          const onMessage = (messageReceive: WorkerMessageReceive) => {
            resolve(messageReceive.data as Room);
            worker.off("message", onMessage);
          };

          // Listen for messages
          worker.on("message", onMessage);

          // Send message to worker
          const messageSend: WorkerMessageSend = {
            type: "get",
            data: null,
          };
          worker.postMessage(messageSend);
        })
    );

    // Get rooms data
    const roomsData: Room[] = await Promise.all(dataPromises);

    // Check if player is in any room with 'playing' status
    const room = roomsData.find((room) =>
      room.players.some((player) => player.id === socket.id)
    );

    if (!room) {
      // Emit player left
      logger(`Player left, not in any room`, "success");
      io.emit("player-left", player);
      return;
    }

    if (room?.status === "playing") {
      // Delete room directly
      rooms.delete(room.id);
      logger(`Room ${room.id} deleted`, "info");

      // Emit player left
      logger(`Player left room ${room.id}`, "success");
      io.emit("player-left", player);
    } else {
      // Check if room exists
      const roomWorker: Worker | undefined = rooms.get(room.id);
      if (!roomWorker) {
        // Emit send message to room error
        logger(`Room not found`, "error");
        io.emit("send-message-to-room-error", `Room ${room?.id} not found`);
        return;
      }

      // Create message to send to room worker
      const messageSend: WorkerMessageSend = {
        type: "leave-player",
        data: player,
      };

      // Send message to room worker
      roomWorker.postMessage(messageSend);

      // Listen for messages from room worker
      roomWorker.on("message", (messageReceive: WorkerMessageReceive) => {
        if (messageReceive.type === "player-left") {
          // Emit player left
          logger(`Player left room ${room.id}`, "success");
          io.emit("player-left", messageReceive.data);
        }
      });
    }

    // Get players data
    const playersData = Array.from(players.values());

    // Emit players data
    logger(`Players fetched: ${playersData.length}`, "info");
    io.emit("players", playersData);
  });
});

/**
 * Start HTTP server
 * Listens on port 3001
 */
httpServer.listen(3001, () => {
  logger(`------------------------------------------------`, "info");
  logger(`Socket server listening on http://localhost:3001`, "info");
  logger(`------------------------------------------------\n`, "info");
});
