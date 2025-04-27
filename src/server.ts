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
  MessageSent,
  Player,
  PlayerJoined,
  PlayerTypingOffInChatOfRoom,
  PlayerTypingOnInChatOfRoom,
  Room,
  WorkerMessageInput,
  WorkerMessageOutput,
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
      io.emit("create-room-error", "Room already exists");
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
    console.log("rooms", rooms.size);
    io.emit("create-room-success", roomId);
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
    logger(`Getting rooms`, "info");
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
            // Send message to worker
            const messageInput: WorkerMessageInput = {
              type: "get-data",
              data: null,
            };

            // Send message to worker
            worker.postMessage(messageInput);

            // On message
            const onMessage = (messageOutput: WorkerMessageOutput) => {
              resolve(messageOutput.data as Room);
              worker.off("message", onMessage);
            };

            // Listen for messages
            worker.on("message", onMessage);
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
      // Send message to worker
      const messageInput: WorkerMessageInput = {
        type: "get-data",
        data: null,
      };

      // Send message to worker
      roomWorker.postMessage(messageInput);

      // On message
      const onMessage = (messageOutput: WorkerMessageOutput) => {
        resolve(messageOutput.data as Room);
        roomWorker.off("message", onMessage);
      };

      // Listen for messages
      roomWorker.on("message", onMessage);
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
    const messageInput: WorkerMessageInput = {
      type: "join-player",
      data: player,
    };

    // Send message to room worker
    roomWorker.postMessage(messageInput);

    // On message
    const onMessage = (messageOutput: WorkerMessageOutput) => {
      const playerJoined: PlayerJoined = messageOutput.data as PlayerJoined;

      if (messageOutput.type === "player-joined") {
        // Emit player joined
        logger(`Player joined room ${roomId}`, "success");
        io.emit("player-joined-to-room-success", playerJoined.player.id);
      } else if (messageOutput.type === "room-full") {
        // Emit room full
        logger(`Room ${roomId} is full`, "warn");
        socket.emit(
          "player-joined-to-room-error",
          `Room ${roomId} is full, max players: 2`
        );
      } else if (messageOutput.type === "player-already-in-room") {
        // Emit player already in room
        logger(`Player already in room ${roomId}`, "warn");
        socket.emit(
          "player-joined-to-room-error",
          `Player ${player.id} already in room ${roomId}`
        );
      }

      // Remove listener
      roomWorker.off("message", onMessage);
    };

    // Listen for messages from room worker
    roomWorker.on("message", onMessage);
  });

  /**
   * Send message to room
   * @param roomId - The id of the room
   * @param message - The message content
   * Sends chat message to specified room
   */
  socket.on(
    "player-send-message-in-chat-of-room",
    (roomId: string, message: string) => {
      logger(`Sending message to room ${roomId}`, "info");

      // Check if player is in room
      const player: Player | undefined = players.get(socket.id);
      if (!player) {
        // Emit send message to room error
        logger(`Player not found`, "error");
        io.emit("player-send-message-in-chat-of-room-error", `Player ${socket.id} not found`);
        return;
      }

      // Check if room exists
      const roomWorker: Worker | undefined = rooms.get(roomId);
      if (!roomWorker) {
        // Emit send message to room error
        logger(`Room not found`, "error");
        io.emit(
          "player-send-message-in-chat-of-room-error",
          `Room ${roomId} not found`
        );
        return;
      }

      // Send message to room worker
      const messageInput: WorkerMessageInput = {
        type: "send-message",
        data: {
          content: message,
          sender: player,
          timestamp: Date.now(),
        } as Message,
      };

      // Send message to room worker
      roomWorker.postMessage(messageInput);

      // On message
      const onMessage = (messageOutput: WorkerMessageOutput) => {
        const messageSent: MessageSent = messageOutput.data as MessageSent;
        if (messageOutput.type === "message-sent") {
          // Emit message sent
          logger(`Message sent to room ${messageSent.roomId}`, "success");
          io.emit("player-send-message-in-chat-of-room-success", messageSent.message);
        }

        // Remove listener
        roomWorker.off("message", onMessage);
      };

      // Listen for messages from room worker
      roomWorker.on("message", onMessage);
    }
  );

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
    const messageInput: WorkerMessageInput = {
      type: "player-typing-on-in-chat-of-room",
      data: player,
    };

    // Send message to room worker
    roomWorker.postMessage(messageInput);

    // On message
    const onMessage = (messageOutput: WorkerMessageOutput) => {
      const playerTypingOn: PlayerTypingOnInChatOfRoom =
        messageOutput.data as PlayerTypingOnInChatOfRoom;

      if (messageOutput.type === "player-typing-on-in-chat-of-room") {
        // Emit player typing on in chat of room
        logger(
          `Player typing on in chat of room ${playerTypingOn.roomId}`,
          "success"
        );
        io.emit(
          "player-typing-on-in-chat-of-room-success",
          playerTypingOn.player
        );
      }
    };

    // Listen for messages from room worker
    roomWorker.on("message", onMessage);
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
      // Emit player typing on in chat of room error
      logger(`Player not found`, "error");
      io.emit(
        "player-typing-off-in-chat-of-room-error",
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
        "player-typing-off-in-chat-of-room-error",
        `Room ${roomId} not found`
      );
      return;
    }

    // Create message to send to room worker
    const messageInput: WorkerMessageInput = {
      type: "player-typing-off-in-chat-of-room",
      data: player,
    };

    // Send message to room worker
    roomWorker.postMessage(messageInput);

    // On message
    const onMessage = (messageOutput: WorkerMessageOutput) => {
      const playerTypingOff: PlayerTypingOffInChatOfRoom =
        messageOutput.data as PlayerTypingOffInChatOfRoom;

      if (messageOutput.type === "player-typing-off-in-chat-of-room") {
        // Emit player typing off in chat of room
        logger(
          `Player typing off in chat of room ${playerTypingOff.roomId}`,
          "success"
        );
        io.emit(
          "player-typing-off-in-chat-of-room-success",
          playerTypingOff.player
        );
      }
    };

    // Listen for messages from room worker
    roomWorker.on("message", onMessage);
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
          const onMessage = (messageOutput: WorkerMessageOutput) => {
            resolve(messageOutput.data as Room);
            worker.off("message", onMessage);
          };

          // Listen for messages
          worker.on("message", onMessage);

          // Send message to worker
          const messageInput: WorkerMessageInput = {
            type: "get-data",
            data: null,
          };
          worker.postMessage(messageInput);
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
      const messageInput: WorkerMessageInput = {
        type: "leave-player",
        data: player,
      };

      // Send message to room worker
      roomWorker.postMessage(messageInput);

      // Listen for messages from room worker
      roomWorker.on("message", (messageOutput: WorkerMessageOutput) => {
        if (messageOutput.type === "player-left") {
          // Emit player left
          logger(`Player left room ${room.id}`, "success");
          io.emit("player-left", messageOutput.data);
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
