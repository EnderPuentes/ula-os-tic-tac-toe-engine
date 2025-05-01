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
  BoardMove,
  Message,
  MessageSent,
  Player,
  Room,
  RoomPlayer,
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
      socket.emit("create-player-error", "Player already exists");
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
    socket.emit("create-player-success", playerId);
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
        player1: null,
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
    console.log("rooms", rooms.size);
    socket.emit("create-room-success", roomId, socket.id);
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
  socket.on("join-player-to-room", async (roomId: string) => {
    // Check if player is in room
    const player: Player | undefined = players.get(socket.id);
    if (!player) {
      // Emit join player to room error
      logger(`Player not found`, "error");
      socket.emit("join-player-to-room-error", `Player ${socket.id} not found`);
      return;
    }

    // Check if room exists
    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      // Emit join player to room error
      logger(`Room not found`, "error");
      socket.emit("join-player-to-room-error", `Room ${roomId} not found`);
      return;
    }

    // Send message to room worker
    roomWorker.postMessage({
      type: "join-player",
      data: player,
    } as WorkerMessageInput);

    // On message
    const onMessage = (messageOutput: WorkerMessageOutput) => {
      if (messageOutput.type === "join-player-success") {
        const player = messageOutput.data as Player;

        // Emit player joined to room success
        logger(`Player joined room ${roomId}`, "success");
        io.emit("player-joined-to-room-success", roomId, player.id);
      } else if (messageOutput.type === "join-player-error") {
        const error = messageOutput.data as string;

        // Emit join player to room error
        logger(`Room ${roomId} is full`, "error");
        socket.emit("player-joined-to-room-error", error);
      }

      // Remove listener
      roomWorker.off("message", onMessage);
    };

    // Listen for messages from room worker
    roomWorker.on("message", onMessage);
  });

  /**
   * Leave player from room
   * @param roomId - The id of the room to leave
   * Removes player from specified game room
   */
  socket.on("leave-player-from-room", async (roomId: string) => {
    // Check if player is in room
    const player: Player | undefined = players.get(socket.id);
    if (!player) {
      // Emit leave player from room error
      logger(`Player not found`, "error");
      io.emit("leave-player-from-room-error", `Player ${socket.id} not found`);
      return;
    }

    // Check if room exists
    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      // Emit leave player from room error
      logger(`Room not found`, "error");
      io.emit("leave-player-from-room-error", `Room ${roomId} not found`);
      return;
    }

    // Send message to room worker
    roomWorker.postMessage({
      type: "leave-player",
      data: player,
    } as WorkerMessageInput);

    // On message
    roomWorker.on("message", (messageOutput: WorkerMessageOutput) => {
      if (messageOutput.type === "leave-player-success") {
        const player = messageOutput.data as Player;
        // Emit player leave
        logger(`Player leave room ${roomId}`, "success");
        io.emit("leave-player-from-room-success", roomId, player.id);
      } else if (messageOutput.type === "leave-player-error") {
        const error = messageOutput.data as string;
        // Emit leave player from room error
        logger(`Player not found`, "error");
        socket.emit("leave-player-from-room-error", error);
      }
    });
  });

  /**
   * Start game in room
   * @param roomId - The id of the room
   * Starts the game in the specified room
   */
  socket.on("start-game-in-room", (roomId: string) => {
    logger(`Starting game in room ${roomId}`, "info");

    // Check if player is in room
    const player: Player | undefined = players.get(socket.id);
    if (!player) {
      // Emit start game in room error
      logger(`Player not found`, "error");
      io.emit("start-game-in-room-error", `Player ${socket.id} not found`);
      return;
    }

    // Check if room exists
    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      // Emit start game in room error
      logger(`Room not found`, "error");
      io.emit("start-game-in-room-error", `Room ${roomId} not found`);
      return;
    }

    // Create message to send to room worker
    const messageInput: WorkerMessageInput = {
      type: "start-game",
      data: player,
    };

    // Send message to room worker
    roomWorker.postMessage(messageInput);

    // On message
    roomWorker.on("message", (messageOutput: WorkerMessageOutput) => {
      if (messageOutput.type === "start-game-success") {
        const room = messageOutput.data as Room;
        // Emit game started
        logger(`Game started in room ${roomId}`, "success");
        io.emit("start-game-in-room-success", roomId);
      } else if (messageOutput.type === "start-game-error") {
        const error = messageOutput.data as string;
        // Emit start game in room error
        logger(`Game not started in room ${roomId}`, "error");
        io.emit("start-game-in-room-error", error);
      }
    });
  });

  /**
   * Play again in room
   * @param roomId - The id of the room
   * Plays again in the specified room
   */
  socket.on("play-again-in-room", (roomId: string) => {
    logger(`Playing again in room ${roomId}`, "info");

    // Check if player is in room
    const player: Player | undefined = players.get(socket.id);
    if (!player) {
      // Emit play again in room error
      logger(`Player not found`, "error");
      io.emit("play-again-in-room-error", `Player ${socket.id} not found`);
      return;
    }

    // Check if room exists
    const roomWorker: Worker | undefined = rooms.get(roomId);
    if (!roomWorker) {
      // Emit play again in room error
      logger(`Room not found`, "error");
      io.emit("play-again-in-room-error", `Room ${roomId} not found`);
      return;
    }

    // Create message to send to room worker
    const messageInput: WorkerMessageInput = {
      type: "play-again",
      data: player,
    };

    // Send message to room worker
    roomWorker.postMessage(messageInput);

    // On message
    roomWorker.on("message", (messageOutput: WorkerMessageOutput) => {
      if (messageOutput.type === "play-again-success") {
        const room = messageOutput.data as Room;
        // Emit play again in room success
        logger(`Game played again in room ${roomId}`, "success");
        io.emit("play-again-in-room-success", roomId);
      } else if (messageOutput.type === "play-again-error") {
        const error = messageOutput.data as string;
        // Emit play again in room error
        logger(`Game not played again in room ${roomId}`, "error");
        io.emit("play-again-in-room-error", error);
      }
    });
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

      // Check if player is in room
      const player: Player | undefined = players.get(socket.id);
      if (!player) {
        // Emit player plays move in board of room error
        logger(`Player not found`, "error");
        io.emit(
          "player-plays-move-in-board-of-room-error",
          `Player ${socket.id} not found`
        );
        return;
      }

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

      // Create message to send to room worker
      const messageInput: WorkerMessageInput = {
        type: "player-plays-move-in-board",
        data: move,
      };

      // Send message to room worker
      roomWorker.postMessage(messageInput);

      // On message
      roomWorker.on("message", (messageOutput: WorkerMessageOutput) => {
        if (messageOutput.type === "player-plays-move-in-board-success") {
          // Emit play move in board success
          io.emit("player-plays-move-in-board-of-room-success", roomId);

          const playerWinner = messageOutput.data as RoomPlayer;
          if (playerWinner) {
            // Emit player wins
            io.emit("player-wins-in-board-of-room", roomId);
          }
        } else if (messageOutput.type === "player-plays-move-in-board-error") {
          // Emit play move in board error
          logger(`Play move in board error`, "error");
          io.emit(
            "player-plays-move-in-board-of-room-error",
            `Error playing move`
          );
        }
      });
    }
  );

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
        io.emit(
          "player-send-message-in-chat-of-room-error",
          `Player ${socket.id} not found`
        );
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
        if (messageOutput.type === "send-message-success") {
          // Emit message sent
          logger(`Message sent to room ${messageSent.roomId}`, "success");
          io.emit(
            "player-send-message-in-chat-of-room-success",
            messageSent.message
          );
        } else if (messageOutput.type === "send-message-error") {
          const error = messageOutput.data as string;
          // Emit send message to room error
          logger(`Message not sent to room ${messageSent.roomId}`, "error");
          io.emit("send-message-to-room-error", error);
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
      const playerTypingOn = messageOutput.data as Player;

      if (messageOutput.type === "player-typing-on-in-chat-of-room") {
        // Emit player typing on in chat of room
        logger(`Player typing on in chat of room ${roomId}`, "success");
        io.emit("player-typing-on-in-chat-of-room-success", playerTypingOn);
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
      const playerTypingOff = messageOutput.data as Player;

      if (messageOutput.type === "player-typing-off-in-chat-of-room") {
        // Emit player typing off in chat of room
        logger(`Player typing off in chat of room ${roomId}`, "success");
        io.emit("player-typing-off-in-chat-of-room-success", playerTypingOff);
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
    const room = roomsData.find(
      (room) =>
        room.players.player1?.id === socket.id ||
        room.players.player2?.id === socket.id
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
        if (messageOutput.type === "leave-player-success") {
          // Emit player left
          logger(`Player left room ${room.id}`, "success");
          io.emit("player-left", messageOutput.data);
        } else if (messageOutput.type === "leave-player-error") {
          const error = messageOutput.data as string;
          // Emit leave player from room error
          logger(error, "error");
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
