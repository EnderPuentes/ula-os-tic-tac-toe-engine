import { parentPort, workerData } from "worker_threads";

import {
  BoardMove,
  Message,
  Player,
  Room,
  WorkerMessageInput,
  WorkerMessageOutput,
} from "@/lib/types";
import { checkWinner, getWinnerLine } from "../lib/game";
import { getAvatarUrl } from "../lib/utils";

// Flag to track if a message is currently being processed
let isProcessing = false;

// Room data passed from parent thread
const room: Room = workerData;

// Queue to store pending messages while processing
const queue: WorkerMessageInput[] = [];

/**
 * Send message to parent thread
 * @param message - The message to send
 */
function sendMessage(message: WorkerMessageOutput) {
  parentPort?.postMessage(message);
}

/**
 * Process incoming messages from parent thread
 * Handles room operations like joining/leaving players and chat messages
 * Uses a queue system to prevent concurrent processing
 */
function processMessage(msg: WorkerMessageInput) {
  // If already processing a message, add to queue
  if (isProcessing) {
    queue.push(msg);
    console.log("queue", queue);
    return;
  }

  isProcessing = true;

  const socketId: string = msg.socketId;

  switch (msg.type) {
    case "get-data":
      // Send message to parent thread
      sendMessage({
        id: msg.id,
        status: "success",
        data: room,
      });
      break;

    case "join-player":
      try {
        // Check if player is already in room
        if (
          room.players.player1?.id === socketId ||
          room.players.player2?.id === socketId
        ) {
          sendMessage({
            id: msg.id,
            status: "error",
            data: `Player is already in room ${room.name}`,
          });
          break;
        }

        // Check if room is full
        if (room.players.player1 && room.players.player2) {
          sendMessage({
            id: msg.id,
            status: "error",
            data: `Room ${room.name} is full`,
          });
          break;
        }

        // Get player name
        const playerName: string = msg.data as string;

        // Create new player
        const newPlayer: Player = {
          id: socketId,
          name: playerName,
          avatar: getAvatarUrl(playerName),
          symbol: room.players.player1 ? "O" : "X",
        };

        // Set player in room
        if (room.players.player1) {
          room.players.player2 = newPlayer;
        } else {
          room.players.player1 = newPlayer;
        }

        // Set room status to done
        if (room.players.player1 && room.players.player2) {
          room.status = "done";
        }

        // Send message to parent thread
        sendMessage({
          id: msg.id,
          status: "success",
          data: null,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          id: msg.id,
          status: "error",
          data: error as Error,
        });
      }
      break;

    case "leave-player":
      try {
        let leavePlayer: Player | null = null;

        // Remove player from room
        if (room.players.player1?.id === socketId) {
          leavePlayer = room.players.player1;
          room.players.player1 = null;
        } else if (room.players.player2?.id === socketId) {
          leavePlayer = room.players.player2;
          room.players.player2 = null;
        }

        // Send message to parent thread
        sendMessage({
          id: msg.id,
          status: "success",
          data: leavePlayer,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          id: msg.id,
          status: "error",
          data: error as Error,
        });
      }
      break;

    case "start-game":
      try {
        // Check if room is full
        if (!room.players.player1 || !room.players.player2) {
          sendMessage({
            id: msg.id,
            status: "error",
            data: "Room is not full",
          });
          return;
        }

        // Set current player
        room.game.currentPlayer = room.players.player1;

        // Set status to playing
        room.status = "playing";

        // Send message to parent thread
        sendMessage({
          id: msg.id,
          status: "success",
          data: null,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          id: msg.id,
          status: "error",
          data: error as Error,
        });
      }
      break;

    case "play-again":
      try {
        // Check if room is full
        if (!room.players.player1 || !room.players.player2) {
          sendMessage({
            id: msg.id,
            status: "error",
            data: "Room is not full",
          });
          return;
        }

        // Set status to playing
        room.status = "playing";

        // Set current player
        room.game.currentPlayer = room.players.player1;

        // Reset board
        room.game.board = [
          [null, null, null],
          [null, null, null],
          [null, null, null],
        ];

        // Reset winnerPlayer
        room.game.winnerPlayer = null;

        // Reset winnerPlayer line
        room.game.winnerLine = null;

        // Send message to parent thread
        sendMessage({
          id: msg.id,
          status: "success",
          data: null,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          id: msg.id,
          status: "error",
          data: error as Error,
        });
      }
      break;

    case "player-plays-move-in-board":
      try {
        // Play move in board
        const playMove = msg.data as BoardMove;
        room.game.board[playMove.row][playMove.col] = playMove.symbol;

        // Check if there is a winnerPlayer
        const winnerPlayer = checkWinner(room.game.board);
        if (!winnerPlayer) {
          // Check if board is full (draw)
          const isBoardFull = room.game.board.every((row) =>
            row.every((cell) => cell !== null)
          );

          if (isBoardFull) {
            // Set room status to finished with no winner
            room.status = "finished";

            // Set winnerPlayer
            room.game.winnerPlayer = null;

            // Set winnerPlayer line
            room.game.winnerLine = null;

            // Update player stats for draw
            room.results.player1.draws++;
            room.results.player2.draws++;
          } else {
            // Change current player
            room.game.currentPlayer =
              room.game.currentPlayer === room.players.player1
                ? room.players.player2
                : room.players.player1;
          }
        } else {
          // Set room status to finished
          room.status = "finished";

          // Set winnerPlayer
          room.game.winnerPlayer = room.game.currentPlayer;

          // Set winnerPlayer line
          room.game.winnerLine = getWinnerLine(room.game.board, winnerPlayer);

          // Update player stats for winner
          if (room.game.currentPlayer === room.players.player1) {
            room.results.player1.wins++;
            room.results.player2.losses++;
          } else {
            room.results.player2.wins++;
            room.results.player1.losses++;
          }
        }

        // Send message to parent thread
        sendMessage({
          id: msg.id,
          status: "success",
          data: room.game.winnerPlayer,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          id: msg.id,
          status: "error",
          data: error as Error,
        });
      }
      break;

    case "player-typing-on-in-chat-of-room":
      try {
        // Add player to typing indicator
        const playerTypingOn =
          socketId === room.players.player1?.id
            ? room.players.player1
            : room.players.player2;

        // Send message to parent thread
        sendMessage({
          id: msg.id,
          status: "success",
          data: playerTypingOn,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          id: msg.id,
          status: "error",
          data: error as Error,
        });
      }
      break;

    case "player-typing-off-in-chat-of-room":
      try {
        // Remove player from typing indicator
        room.chat.playersTyping = room.chat.playersTyping.filter(
          (p) => p.id !== socketId
        );

        // Send message to parent thread
        sendMessage({
          id: msg.id,
          status: "success",
          data: null,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          id: msg.id,
          status: "error",
          data: error as Error,
        });
      }
      break;

    case "send-message":
      try {
        // Get content
        const content = msg.data as string;

        // Create new message
        const newMessage: Message = {
          content,
          sender:
            socketId === room.players.player1?.id
              ? room.players.player1
              : room.players.player2,
          timestamp: Date.now(),
        };

        // Add message to chat
        room.chat.messages.push(newMessage);

        // Send message to parent thread
        sendMessage({
          id: msg.id,
          status: "success",
          data: null,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          id: msg.id,
          status: "error",
          data: error as Error,
        });
      }
      break;

    default:
      // Handle unknown message types
      sendMessage({
        id: msg.id,
        status: "error",
        data: new Error("Unknown message type"),
      });
  }

  // Process next message in queue if any
  if (queue.length > 0) {
    const nextMessage = queue.shift();
    if (nextMessage) {
      processMessage(nextMessage);
    }
  } else {
    isProcessing = false;
  }
}

// Set up message listener for parent thread communication
parentPort?.on("message", (msg) => {
  processMessage(msg);
});
