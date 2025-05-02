/**
 * Server for real-time Tic-Tac-Toe multiplayer game
 * Handles player connections, room management, and game state
 * Uses worker threads for concurrent room processing
 */

import { createServer } from "http";
import { Server } from "socket.io";
import { Worker } from "worker_threads";
import type {
  BoardMove,
  Player,
  Room,
  WorkerMessageInput,
  WorkerMessageOutput,
} from "./lib/types";
import { getAvatarUrl, logger } from "./lib/utils";

// Create HTTP and Socket.IO servers
const httpServer = createServer();
const CLIENT_GAME_URL = process.env.CLIENT_GAME_URL || "http://localhost:3000";
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// Store connected players and active game rooms
const rooms = new Map<string, Worker>();

/**
 * Handle client connection
 * Sets up socket event listeners for game actions
 */
io.on("connection", (socket) => {
  logger("[Socket] Client connected", "info");

  /**
   * Create room
   * @param roomName - Room name
   * @param playerName - Player name
   * Creates new game room with worker thread
   */
  socket.on("create-room", (roomName: string, playerName: string) => {
    const roomId = Math.random().toString(36).substring(2, 8);

    if (rooms.has(roomId)) {
      logger("[Room] Creation failed - Room already exists", "error");
      socket.emit("create-room-error", "Room already exists");
      return;
    }

    const room: Room = {
      id: roomId,
      name: roomName,
      status: "waiting",
      game: {
        board: Array(3)
          .fill(null)
          .map(() => Array(3).fill(null)),
        currentPlayer: null,
        winnerPlayer: null,
        winnerLine: null,
      },
      chat: {
        messages: [],
        playersTyping: [],
      },
      players: {
        player1: {
          id: socket.id,
          name: playerName,
          avatar: getAvatarUrl(playerName),
          symbol: "X",
        },
        player2: null,
      },
      results: {
        player1: {
          wins: 0,
          losses: 0,
          draws: 0,
        },
        player2: {
          wins: 0,
          losses: 0,
          draws: 0,
        },
      },
    };

    const worker = new Worker("./src/workers/room.ts", {
      workerData: room,
      execArgv: ["-r", "ts-node/register"],
    });

    rooms.set(roomId, worker);

    logger(`[Room] Created room: ${roomName}`, "success");
    socket.emit("create-room-success", roomId, socket.id);
  });

  /**
   * Get rooms
   * Returns list of all active game rooms
   */
  socket.on("get-rooms", async () => {
    logger("[Room] Fetching all rooms", "info");

    if (rooms.size === 0) {
      logger("[Room] No rooms found", "info");
      io.emit("rooms", []);
    } else {
      const dataPromises = Array.from(rooms.values()).map(
        (worker) =>
          new Promise<Room>((resolve) => {
            const messageId = crypto.randomUUID();
            worker.postMessage({
              id: messageId,
              type: "get-data",
              socketId: socket.id,
              data: null,
            });

            const onMessage = (messageOutput: WorkerMessageOutput) => {
              if (messageOutput.id === messageId) {
                if (messageOutput.status === "success") {
                  resolve(messageOutput.data as Room);
                }
                worker.off("message", onMessage);
              }
            };

            worker.on("message", onMessage);
          })
      );

      const roomsData: Room[] = await Promise.all(dataPromises);

      logger(`[Room] Fetched ${rooms.size} rooms`, "info");
      io.emit("rooms", roomsData);
    }
  });

  /**
   * Get room
   * @param roomId - Room ID
   * Returns data for specific room
   */
  socket.on("get-room", async (roomId: string) => {
    logger(`[Room] Fetching room ${roomId}`, "info");

    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      logger("[Room] Room not found", "error");
      io.emit("get-room-error", `Room ${roomId} not found`);
      return;
    }

    const roomData: Room | undefined = await new Promise((resolve) => {
      const messageId = crypto.randomUUID();
      roomWorker.postMessage({
        id: messageId,
        type: "get-data",
        socketId: socket.id,
        data: null,
      });

      const onMessage = (messageOutput: WorkerMessageOutput) => {
        if (messageOutput.id === messageId) {
          if (messageOutput.status === "success") {
            resolve(messageOutput.data as Room);
          }
          roomWorker.off("message", onMessage);
        }
      };

      roomWorker.on("message", onMessage);
    });

    if (roomData) {
      logger(`[Room] Fetched room data: ${roomData.name}`, "info");
      socket.emit("room", roomData);
    } else {
      logger("[Room] Room data not found", "error");
      io.emit("get-room-error", `Room ${roomId} not found`);
    }
  });

  /**
   * Join player to room
   * @param roomId - Room ID
   * @param playerName - Player name
   * Adds player to specified game room
   */
  socket.on(
    "join-player-to-room",
    async (roomId: string, playerName: string) => {
      logger(`[Room] Player joining room ${roomId}`, "info");

      const roomWorker: Worker | undefined = rooms.get(roomId);
      if (!roomWorker) {
        logger("[Room] Room not found", "error");
        io.emit("join-player-to-room-error", `Room ${roomId} not found`);
        return;
      }

      const messageId = crypto.randomUUID();
      roomWorker.postMessage({
        id: messageId,
        type: "join-player",
        socketId: socket.id,
        data: playerName,
      } as WorkerMessageInput);

      const onMessage = (messageOutput: WorkerMessageOutput) => {
        if (messageOutput.id === messageId) {
          if (messageOutput.status === "success") {
            logger(`[Room] Player joined room ${roomId}`, "success");
            io.emit("join-player-to-room-success", roomId, socket.id);
          } else {
            const error = messageOutput.data as string;
            logger(`[Room] Join failed - ${error}`, "error");
            socket.emit("join-player-to-room-error", error);
          }

          roomWorker.off("message", onMessage);
        }
      };

      roomWorker.on("message", onMessage);
    }
  );

  /**
   * Leave player from room
   * @param roomId - Room ID
   * Removes player from specified game room
   */
  socket.on("leave-player-from-room", async (roomId: string) => {
    logger(`[Room] Player leaving room ${roomId}`, "info");

    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      logger("[Room] Room not found", "error");
      io.emit("leave-player-from-room-error", `Room ${roomId} not found`);
      return;
    }

    const messageId = crypto.randomUUID();
    roomWorker.postMessage({
      id: messageId,
      type: "leave-player",
      socketId: socket.id,
      data: null,
    } as WorkerMessageInput);

    const onMessage = (messageOutput: WorkerMessageOutput) => {
      if (messageOutput.id === messageId) {
        if (messageOutput.status === "success") {
          logger(`[Room] Player left room ${roomId}`, "success");
          io.emit("leave-player-from-room-success", roomId, socket.id);

          logger(`[Room] Deleting empty room ${roomId}`, "info");
          rooms.delete(roomId);
        } else {
          const error = messageOutput.data as string;
          logger("[Room] Leave failed - Player not found", "error");
          socket.emit("leave-player-from-room-error", error);
        }

        roomWorker.off("message", onMessage);
      }
    };

    roomWorker.on("message", onMessage);
  });

  /**
   * Play again in room
   * @param roomId - Room ID
   * Restarts game in the specified room
   */
  socket.on("play-again-in-room", (roomId: string) => {
    logger(`[Game] Restarting game in room ${roomId}`, "info");

    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      logger("[Room] Room not found", "error");
      io.emit("play-again-in-room-error", `Room ${roomId} not found`);
      return;
    }

    const messageId = crypto.randomUUID();
    roomWorker.postMessage({
      id: messageId,
      type: "play-again",
      socketId: socket.id,
      data: null,
    });

    const onMessage = (messageOutput: WorkerMessageOutput) => {
      if (messageOutput.id === messageId) {
        if (messageOutput.status === "success") {
          logger(`[Game] Restarted game in room ${roomId}`, "success");
          io.emit("play-again-in-room-success", roomId);
        } else {
          const error = messageOutput.data as string;
          logger(`[Game] Restart failed - ${error}`, "error");
          io.emit("play-again-in-room-error", error);
        }

        roomWorker.off("message", onMessage);
      }
    };

    roomWorker.on("message", onMessage);
  });

  /**
   * Player plays move in board
   * @param roomId - Room ID
   * @param move - Board move coordinates
   * Executes player move in game board
   */
  socket.on(
    "player-plays-move-in-board-of-room",
    ({ roomId, move }: { roomId: string; move: BoardMove }) => {
      logger(`[Game] Processing move in room ${roomId}`, "info");

      const roomWorker: Worker | undefined = rooms.get(roomId);
      if (!roomWorker) {
        logger("[Room] Room not found", "error");
        io.emit(
          "player-plays-move-in-board-of-room-error",
          `Room ${roomId} not found`
        );
        return;
      }

      const messageId = crypto.randomUUID();
      roomWorker.postMessage({
        id: messageId,
        type: "player-plays-move-in-board",
        socketId: socket.id,
        data: move,
      });

      const onMessage = (messageOutput: WorkerMessageOutput) => {
        if (messageOutput.id === messageId) {
          if (messageOutput.status === "success") {
            io.emit("player-plays-move-in-board-of-room-success", roomId);

            const playerWinner = messageOutput.data as Player;
            if (playerWinner) {
              logger(`[Game] Player won in room ${roomId}`, "info");
              io.emit("player-wins-in-board-of-room", roomId);
            }
          } else {
            const error = messageOutput.data as string;
            logger(`[Game] Invalid move - ${error}`, "error");
            io.emit("player-plays-move-in-board-of-room-error", error);
          }

          roomWorker.off("message", onMessage);
        }
      };

      roomWorker.on("message", onMessage);
    }
  );

  /**
   * Player typing indicator on
   * @param roomId - Room ID
   * Shows typing indicator for player in chat
   */
  socket.on("player-typing-on-in-chat-of-room", (roomId: string) => {
    logger(`[Chat] Player typing started in room ${roomId}`, "info");

    const roomWorker = rooms.get(roomId);
    if (!roomWorker) {
      logger("[Room] Room not found", "error");
      io.emit(
        "player-typing-on-in-chat-of-room-error",
        `Room ${roomId} not found`
      );
      return;
    }

    const messageId = crypto.randomUUID();
    roomWorker.postMessage({
      id: messageId,
      type: "player-typing-on-in-chat-of-room",
      socketId: socket.id,
      data: null,
    });

    const onMessage = (messageOutput: WorkerMessageOutput) => {
      if (messageOutput.id === messageId) {
        if (messageOutput.status === "success") {
          const playerTypingOn = messageOutput.data as Player;
          logger(`[Chat] Player typing indicator shown`, "success");
          io.emit("player-typing-on-in-chat-of-room-success", playerTypingOn);
        } else {
          const error = messageOutput.data as string;
          logger(`[Chat] Typing indicator failed - ${error}`, "error");
          io.emit("player-typing-on-in-chat-of-room-error", error);
        }
        roomWorker.off("message", onMessage);
      }
    };

    roomWorker.on("message", onMessage);
  });

  /**
   * Player typing indicator off
   * @param roomId - Room ID
   * Removes typing indicator for player in chat
   */
  socket.on("player-typing-off-in-chat-of-room", (roomId: string) => {
    logger(`[Chat] Player typing ended in room ${roomId}`, "info");

    const roomWorker = rooms.get(roomId);
    if (!roomWorker) {
      logger("[Room] Room not found", "error");
      io.emit(
        "player-typing-off-in-chat-of-room-error",
        `Room ${roomId} not found`
      );
      return;
    }

    const messageId = crypto.randomUUID();
    roomWorker.postMessage({
      id: messageId,
      type: "player-typing-off-in-chat-of-room",
      socketId: socket.id,
      data: null,
    });

    const onMessage = (messageOutput: WorkerMessageOutput) => {
      if (messageOutput.id === messageId) {
        if (messageOutput.status === "success") {
          const playerTypingOff = messageOutput.data as Player;
          logger(`[Chat] Player typing indicator removed`, "success");
          io.emit("player-typing-off-in-chat-of-room-success", playerTypingOff);
        } else {
          const error = messageOutput.data as string;
          logger(`[Chat] Typing indicator removal failed - ${error}`, "error");
          io.emit("player-typing-off-in-chat-of-room-error", error);
        }

        roomWorker.off("message", onMessage);
      }
    };

    roomWorker.on("message", onMessage);
  });

  /**
   * Send message to room
   * @param roomId - Room ID
   * @param message - Message content
   * Sends chat message to specified room
   */
  socket.on(
    "player-send-message-in-chat-of-room",
    (roomId: string, message: string) => {
      logger(`[Chat] Sending message in room ${roomId}`, "info");

      const roomWorker: Worker | undefined = rooms.get(roomId);
      if (!roomWorker) {
        logger("[Room] Room not found", "error");
        io.emit(
          "player-send-message-in-chat-of-room-error",
          `Room ${roomId} not found`
        );
        return;
      }

      const messageId = crypto.randomUUID();
      roomWorker.postMessage({
        id: messageId,
        type: "send-message",
        socketId: socket.id,
        data: message,
      });

      const onMessage = (messageOutput: WorkerMessageOutput) => {
        if (messageOutput.id === messageId) {
          if (messageOutput.status === "success") {
            logger(`[Chat] Message sent in room ${roomId}`, "success");
            io.emit(
              "player-send-message-in-chat-of-room-success",
              roomId,
              socket.id
            );
          } else {
            const error = messageOutput.data as string;
            logger(`[Chat] Message send failed - ${error}`, "error");
            io.emit("send-message-to-room-error", error);
          }

          roomWorker.off("message", onMessage);
        }
      };

      roomWorker.on("message", onMessage);
    }
  );

  /**
   * Handle client disconnect
   * Removes player from game and cleans up rooms
   */
  socket.on("disconnect", async () => {
    logger(`[Socket] Player disconnected: ${socket.id}`, "warn");
    logger(`[Room] Fetching rooms data`, "info");

    const dataPromises = Array.from(rooms.values()).map(
      (worker) =>
        new Promise<Room>((resolve) => {
          const messageId = crypto.randomUUID();

          worker.postMessage({
            id: messageId,
            type: "get-data",
            socketId: socket.id,
            data: null,
          });

          const onMessage = (messageOutput: WorkerMessageOutput) => {
            if (messageOutput.id === messageId) {
              if (messageOutput.status === "success") {
                resolve(messageOutput.data as Room);
              }
              worker.off("message", onMessage);
            }
          };

          worker.on("message", onMessage);
        })
    );

    const roomsData: Room[] = await Promise.all(dataPromises);

    logger(`[Room] Looking for player's room`, "info");

    const room = roomsData.find(
      (room) =>
        room.players.player1?.id === socket.id ||
        room.players.player2?.id === socket.id
    );

    if (!room) {
      logger(`[Room] No room found for disconnected player`, "warn");
      return;
    }

    const roomWorker = rooms.get(room.id);
    if (!roomWorker) {
      logger(`[Room] Worker not found for room ${room.id}`, "error");
      return;
    }

    const messageId = crypto.randomUUID();
    roomWorker.postMessage({
      id: messageId,
      type: "leave-player",
      socketId: socket.id,
      data: null,
    });

    const onMessage = (messageOutput: WorkerMessageOutput) => {
      if (messageOutput.id === messageId) {
        if (messageOutput.status === "success") {
          logger(`[Room] Player removed from room ${room.id}`, "success");
          io.emit("leave-player-from-room-success", room.id, socket.id);

          // Delete room if it's empty
          logger(`[Room] Deleting empty room ${room.id}`, "info");
          rooms.delete(room.id);

          // Emit event
          io.emit(
            "rooms",
            roomsData.filter((room) => room.id === room.id)
          );
        } else {
          const error = messageOutput.data as string;
          logger(`[Room] Player removal failed - ${error}`, "error");
          socket.emit("leave-player-from-room-error", error);
        }
        roomWorker.off("message", onMessage);
      }
    };

    roomWorker.on("message", onMessage);
  });
});

/**
 * Start HTTP server
 * Listens on port
 */

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  logger(`------------------------------------------------`, "info");
  logger(
    `[Server] Socket server listening on http://localhost:${PORT}`,
    "info"
  );
  logger(`------------------------------------------------\n`, "info");
});
