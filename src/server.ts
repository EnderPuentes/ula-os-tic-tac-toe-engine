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
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// Store connected players and active game rooms
const rooms = new Map<string, Worker>();

/**
 * Handle client connection
 * Sets up socket event listeners for game actions
 */
io.on("connection", (socket) => {
  logger("Client connected", "info");

  /**
   * Create room
   * @param roomName - The name of the room
   * Creates new game room with worker thread
   */
  socket.on("create-room", (roomName: string, playerName: string) => {
    // Generate room id
    const roomId = crypto.randomUUID();

    // Check if room already exists
    if (rooms.has(roomId)) {
      // Emit room created error
      logger(`Room already exists`, "error");
      socket.emit("create-room-error", "Room already exists");
      return;
    }

    // Create room
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

    // Create room worker
    const worker = new Worker("./src/workers/room.ts", {
      workerData: room,
      execArgv: ["-r", "ts-node/register"],
    });

    // Set room
    rooms.set(roomId, worker);

    // Emit room created
    logger(`Room created: ${roomName}`, "success");
    socket.emit("create-room-success", roomId, socket.id);
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
            const messageId = crypto.randomUUID();
            worker.postMessage({
              id: messageId,
              type: "get-data",
              socketId: socket.id,
              data: null,
            });

            // On message
            const onMessage = (messageOutput: WorkerMessageOutput) => {
              if (messageOutput.id === messageId) {
                if (messageOutput.status === "success") {
                  resolve(messageOutput.data as Room);
                }
                worker.off("message", onMessage);
              }
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
      const messageId = crypto.randomUUID();
      roomWorker.postMessage({
        id: messageId,
        type: "get-data",
        socketId: socket.id,
        data: null,
      });

      // On message
      const onMessage = (messageOutput: WorkerMessageOutput) => {
        if (messageOutput.id === messageId) {
          if (messageOutput.status === "success") {
            resolve(messageOutput.data as Room);
          }
          roomWorker.off("message", onMessage);
        }
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
  socket.on(
    "join-player-to-room",
    async (roomId: string, playerName: string) => {
      logger(`Joining player to room ${roomId}`, "info");

      // Check if room exists
      const roomWorker: Worker | undefined = rooms.get(roomId);
      if (!roomWorker) {
        // Emit send message to room error
        logger(`Room not found`, "error");
        io.emit("join-player-to-room-error", `Room ${roomId} not found`);
        return;
      }

      // Send message to room worker
      const messageId = crypto.randomUUID();
      roomWorker.postMessage({
        id: messageId,
        type: "join-player",
        socketId: socket.id,
        data: playerName,
      } as WorkerMessageInput);

      // On message
      const onMessage = (messageOutput: WorkerMessageOutput) => {
        if (messageOutput.id === messageId) {
          if (messageOutput.status === "success") {
            // Emit player joined to room success
            logger(`Player joined room ${roomId}`, "success");
            io.emit("join-player-to-room-success", roomId, socket.id);
          } else {
            const error = messageOutput.data as string;

            // Emit join player to room error
            logger(`Room ${roomId} is full`, "error");
            socket.emit("join-player-to-room-error", error);
          }

          // Remove listener
          roomWorker.off("message", onMessage);
        }
      };

      // Listen for messages from room worker
      roomWorker.on("message", onMessage);
    }
  );

  /**
   * Leave player from room
   * @param roomId - The id of the room to leave
   * Removes player from specified game room
   */
  socket.on("leave-player-from-room", async (roomId: string) => {
    logger(`Leaving player from room ${roomId}`, "info");

    // Check if room exists
    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      // Emit leave player from room error
      logger(`Room not found`, "error");
      io.emit("leave-player-from-room-error", `Room ${roomId} not found`);
      return;
    }

    // Send message to room worker
    const messageId = crypto.randomUUID();
    roomWorker.postMessage({
      id: messageId,
      type: "leave-player",
      socketId: socket.id,
      data: null,
    } as WorkerMessageInput);

    // On message
    const onMessage = (messageOutput: WorkerMessageOutput) => {
      if (messageOutput.id === messageId) {
        if (messageOutput.status === "success") {
          // Emit player leave
          logger(`Player leave room ${roomId}`, "success");
          io.emit("leave-player-from-room-success", roomId, socket.id);

          // Check if room is empty
          logger(`Deleting room ${roomId}`, "info");
          rooms.delete(roomId);
        } else {
          const error = messageOutput.data as string;

          // Emit leave player from room error
          logger(`Player not found`, "error");
          socket.emit("leave-player-from-room-error", error);
        }

        // Remove listener
        roomWorker.off("message", onMessage);
      }
    };

    // Listen for messages from room worker
    roomWorker.on("message", onMessage);
  });

  /**
   * Start game in room
   * @param roomId - The id of the room
   * Starts the game in the specified room
   */
  socket.on("start-game-in-room", (roomId: string) => {
    logger(`Starting game in room ${roomId}`, "info");

    // Check if room exists
    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      // Emit start game in room error
      logger(`Room not found`, "error");
      io.emit("start-game-in-room-error", `Room ${roomId} not found`);
      return;
    }

    // Send message to room worker
    const messageId = crypto.randomUUID();
    roomWorker.postMessage({
      id: messageId,
      type: "start-game",
      socketId: socket.id,
      data: null,
    });

    // On message
    const onMessage = (messageOutput: WorkerMessageOutput) => {
      if (messageOutput.id === messageId) {
        if (messageOutput.status === "success") {
          // Emit game started
          logger(`Game started in room ${roomId}`, "success");
          io.emit("start-game-in-room-success", roomId);
        } else {
          const error = messageOutput.data as string;

          // Emit start game in room error
          logger(`Game not started in room ${roomId}`, "error");
          io.emit("start-game-in-room-error", error);
        }

        // Remove listener
        roomWorker.off("message", onMessage);
      }
    };

    // Listen for messages from room worker
    roomWorker.on("message", onMessage);
  });

  /**
   * Play again in room
   * @param roomId - The id of the room
   * Plays again in the specified room
   */
  socket.on("play-again-in-room", (roomId: string) => {
    logger(`Playing again in room ${roomId}`, "info");
    // Check if room exists
    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      // Emit play again in room error
      logger(`Room not found`, "error");
      io.emit("play-again-in-room-error", `Room ${roomId} not found`);
      return;
    }

    // Send message to room worker
    const messageId = crypto.randomUUID();
    roomWorker.postMessage({
      id: messageId,
      type: "play-again",
      socketId: socket.id,
      data: null,
    });

    // On message
    const onMessage = (messageOutput: WorkerMessageOutput) => {
      if (messageOutput.id === messageId) {
        if (messageOutput.status === "success") {
          // Emit play again in room success
          logger(`Game played again in room ${roomId}`, "success");
          io.emit("play-again-in-room-success", roomId);
        } else {
          const error = messageOutput.data as string;

          // Emit play again in room error
          logger(`Game not played again in room ${roomId}`, "error");
          io.emit("play-again-in-room-error", error);
        }

        // Remove listener
        roomWorker.off("message", onMessage);
      }
    };

    // Listen for messages from room worker
    roomWorker.on("message", onMessage);
  });

  /**
   * Player plays move in board of room
   * @param roomId - The id of the room
   * @param move - The move to play
   * Plays a move in the specified room
   */
  socket.on(
    "player-plays-move-in-board-of-room",
    ({ roomId, move }: { roomId: string; move: BoardMove }) => {
      logger(`Player plays move in board of room ${roomId}`, "info");

      // Check if room exists
      const roomWorker: Worker | undefined = rooms.get(roomId);
      if (!roomWorker) {
        // Emit player plays move in board of room error
        logger(`Room not found`, "error");
        io.emit(
          "player-plays-move-in-board-of-room-error",
          `Room ${roomId} not found`
        );
        return;
      }

      // Send message to room worker
      const messageId = crypto.randomUUID();
      roomWorker.postMessage({
        id: messageId,
        type: "player-plays-move-in-board",
        socketId: socket.id,
        data: move,
      });

      // On message
      const onMessage = (messageOutput: WorkerMessageOutput) => {
        if (messageOutput.id === messageId) {
          if (messageOutput.status === "success") {
            // Emit play move in board success
            io.emit("player-plays-move-in-board-of-room-success", roomId);

            const playerWinner = messageOutput.data as Player;
            if (playerWinner) {
              // Emit player wins
              io.emit("player-wins-in-board-of-room", roomId);
            }
          } else {
            const error = messageOutput.data as string;

            // Emit play move in board error
            logger(`Play move in board error`, "error");
            io.emit("player-plays-move-in-board-of-room-error", error);
          }

          // Remove listener
          roomWorker.off("message", onMessage);
        }
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

    // Send message to room worker
    const messageId = crypto.randomUUID();
    roomWorker.postMessage({
      id: messageId,
      type: "player-typing-on-in-chat-of-room",
      socketId: socket.id,
      data: null,
    });

    // On message
    const onMessage = (messageOutput: WorkerMessageOutput) => {
      if (messageOutput.id === messageId) {
        if (messageOutput.status === "success") {
          const playerTypingOn = messageOutput.data as Player;

          // Emit player typing on in chat of room
          logger(`Player typing on in chat of room ${roomId}`, "success");
          io.emit("player-typing-on-in-chat-of-room-success", playerTypingOn);
        } else {
          const error = messageOutput.data as string;

          // Emit player typing on in chat of room error
          logger(`Player typing on in chat of room ${roomId}`, "error");
          io.emit("player-typing-on-in-chat-of-room-error", error);
        }
        // Remove listener
        roomWorker.off("message", onMessage);
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

    // Send message to room worker
    const messageId = crypto.randomUUID();
    roomWorker.postMessage({
      id: messageId,
      type: "player-typing-off-in-chat-of-room",
      socketId: socket.id,
      data: null,
    });

    // On message
    const onMessage = (messageOutput: WorkerMessageOutput) => {
      if (messageOutput.id === messageId) {
        if (messageOutput.status === "success") {
          const playerTypingOff = messageOutput.data as Player;

          // Emit player typing off in chat of room
          logger(`Player typing off in chat of room ${roomId}`, "success");
          io.emit("player-typing-off-in-chat-of-room-success", playerTypingOff);
        } else {
          const error = messageOutput.data as string;

          // Emit player typing off in chat of room error
          logger(`Player typing off in chat of room ${roomId}`, "error");
          io.emit("player-typing-off-in-chat-of-room-error", error);
        }

        // Remove listener
        roomWorker.off("message", onMessage);
      }
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
      const messageId = crypto.randomUUID();
      roomWorker.postMessage({
        id: messageId,
        type: "send-message",
        socketId: socket.id,
        data: message,
      });

      // On message
      const onMessage = (messageOutput: WorkerMessageOutput) => {
        if (messageOutput.id === messageId) {
          if (messageOutput.status === "success") {
            // Emit message sent
            logger(`Message sent to room ${roomId}`, "success");
            io.emit(
              "player-send-message-in-chat-of-room-success",
              roomId,
              socket.id
            );
          } else {
            const error = messageOutput.data as string;

            // Emit send message to room error
            logger(`Message not sent to room ${roomId}`, "error");
            io.emit("send-message-to-room-error", error);
          }

          // Remove listener
          roomWorker.off("message", onMessage);
        }
      };

      // Listen for messages from room worker
      roomWorker.on("message", onMessage);
    }
  );

  /**
   * Handle client disconnect
   * Removes player from game and cleans up rooms
   */
  socket.on("disconnect", async () => {
    return;
    // logger(`Player disconnected: ${socket.id}`, "warn");

    // /*
    //  * Check if player is in any room with 'playing' status
    //  */
    // logger(`Checking if player is in any room with 'playing' status`, "info");

    // // Get rooms data
    // const roomsData: Room[] = await Promise.all(
    //   Array.from(rooms.values()).map(
    //     (worker) =>
    //       new Promise<Room>((resolve) => {
    //         // On message
    //         const onMessage = (messageOutput: WorkerMessageOutput) => {
    //           resolve(messageOutput.data as Room);
    //           worker.off("message", onMessage);
    //         };

    //         // Listen for messages
    //         worker.on("message", onMessage);

    //         // Send message to worker
    //         const messageInput: WorkerMessageInput = {
    //           type: "get-data",
    //           socketId: socket.id,
    //           data: null,
    //         };
    //         worker.postMessage(messageInput);
    //       })
    //   )
    // );

    // // Check if player is in any room with 'playing' status
    // const room = roomsData.find(
    //   (room) =>
    //     room.players.player1?.id === socket.id ||
    //     room.players.player2?.id === socket.id
    // );

    // if (!room) {
    //   // Emit player left
    //   logger(`Player left, not in any room`, "success");
    //   io.emit("player-left", socket.id);
    //   return;
    // }

    // if (room?.status === "done") {
    //   const roomWorker: Worker | undefined = rooms.get(room.id);
    //   if (!roomWorker) {
    //     // Emit send message to room error
    //     logger(`Room not found`, "error");
    //     return;
    //   }

    //   // Create message to send to room worker
    //   const messageInput: WorkerMessageInput = {
    //     type: "leave-player",
    //     socketId: socket.id,
    //     data: null,
    //   };

    //   // Send message to room worker
    //   roomWorker.postMessage(messageInput);

    //   // On message
    //   const onMessage = (messageOutput: WorkerMessageOutput) => {
    //     if (messageOutput.type === "leave-player-success") {
    //       // Emit player left
    //       logger(`Player left room ${room.id}`, "success");
    //       io.emit("player-left", messageOutput.data);
    //     } else if (messageOutput.type === "leave-player-error") {
    //       const error = messageOutput.data as string;
    //       // Emit leave player from room error
    //       logger(error, "error");
    //     }

    //     // Remove listener
    //     roomWorker.off("message", onMessage);
    //   };

    //   // Listen for messages from room worker
    //   roomWorker.on("message", onMessage);
    // }
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
