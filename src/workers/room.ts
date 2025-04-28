import {
  BoardMove,
  BoardSymbol,
  Message,
  Player,
  Room,
  WorkerMessageInput,
  WorkerMessageOutput,
} from "@/lib/types";
import { parentPort, workerData } from "worker_threads";

// Flag to track if a message is currently being processed
let isProcessing = false;

// Room data passed from parent thread
const room: Room = workerData;

// Queue to store pending messages while processing
const queue: WorkerMessageInput[] = [];

/**
 * Get the winner line in the board
 * @param board - The board to check
 * @param winner - The winner
 */
export function getWinnerLine(board: BoardSymbol[][], winner: BoardSymbol) {
  // Check for horizontal wins
  for (let row = 0; row < 3; row++) {
    if (
      board[row][0] === winner &&
      board[row][1] === winner &&
      board[row][2] === winner
    ) {
      return [
        { row, col: 0 },
        { row, col: 1 },
        { row, col: 2 },
      ];
    }
  }

  // Check for vertical wins
  for (let col = 0; col < 3; col++) {
    if (
      board[0][col] === winner &&
      board[1][col] === winner &&
      board[2][col] === winner
    ) {
      return [
        { row: 0, col },
        { row: 1, col },
        { row: 2, col },
      ];
    }
  }

  // Check diagonal wins
  if (
    board[0][0] === winner &&
    board[1][1] === winner &&
    board[2][2] === winner
  ) {
    return [
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 2 },
    ];
  }

  // Check reverse diagonal wins
  if (
    board[0][2] === winner &&
    board[1][1] === winner &&
    board[2][0] === winner
  ) {
    return [
      { row: 0, col: 2 },
      { row: 1, col: 1 },
      { row: 2, col: 0 },
    ];
  }

  // If no winner, return null
  return null;
}

/**
 * Check if there is a winner in the board
 * @param board - The board to check
 * @returns The winner if there is one, otherwise null
 */
export function checkWinner(board: BoardSymbol[][]): BoardSymbol | null {
  // Check for horizontal wins
  for (let row = 0; row < 3; row++) {
    if (
      board[row][0] !== null &&
      board[row][0] === board[row][1] &&
      board[row][1] === board[row][2]
    ) {
      return board[row][0];
    }
  }

  // Check for vertical wins
  for (let col = 0; col < 3; col++) {
    if (
      board[0][col] !== null &&
      board[0][col] === board[1][col] &&
      board[1][col] === board[2][col]
    ) {
      return board[0][col];
    }
  }

  // Check diagonal wins
  if (
    board[0][0] !== null &&
    board[0][0] === board[1][1] &&
    board[1][1] === board[2][2]
  ) {
    return board[0][0];
  }

  // Check reverse diagonal wins
  if (
    board[0][2] !== null &&
    board[0][2] === board[1][1] &&
    board[1][1] === board[2][0]
  ) {
    return board[0][2];
  }

  // If no winner, return null
  return null;
}

/**
 * Process incoming messages from parent thread
 * Handles room operations like joining/leaving players and chat messages
 * Uses a queue system to prevent concurrent processing
 */
const processMessage = (msg: WorkerMessageInput) => {
  // If already processing a message, add to queue
  if (isProcessing) {
    queue.push(msg);
    return;
  }

  isProcessing = true;

  let messageOutput: WorkerMessageOutput;

  switch (msg.type) {
    case "get-data":
      // Send message to parent thread
      messageOutput = {
        type: "data",
        data: room,
      };
      parentPort?.postMessage(messageOutput);
      break;

    case "join-player":
      let messageReceiveType: WorkerMessageOutput["type"] = "player-joined";

      const joinPlayer: Player = msg.data as Player;

      // Check if room is full (max 2 players)
      if (room.players.length >= 2) {
        messageReceiveType = "room-full";
      } else {
        // Verify player isn't already in room
        const alreadyInRoom = room.players.some((p) => p.id === joinPlayer.id);
        if (alreadyInRoom) {
          messageReceiveType = "player-already-in-room";
        } else {
          // Add new player to room
          room.players.push(joinPlayer);

          // If there are 2 players, set room status to done
          if (room.players.length === 2) {
            room.status = "done";
          }
        }
      }

      // Send message to parent thread
      messageOutput = {
        type: messageReceiveType,
        data: {
          roomId: room.id,
          player: joinPlayer,
        },
      };
      parentPort?.postMessage(messageOutput);
      break;

    case "leave-player":
      // Remove player from room
      const leavePlayer: Player = msg.data as Player;
      room.players = room.players.filter((p) => p.id !== leavePlayer.id);

      // Send message to parent thread
      messageOutput = {
        type: "player-leaved",
        data: leavePlayer,
      };
      parentPort?.postMessage(messageOutput);
      break;

    case "start-game":
      // Start game
      room.status = "playing";
      room.currentPlayer = room.players[Math.floor(Math.random() * 2)];
      room.currentSymbol = Math.random() < 0.5 ? "X" : "O";

      // Send message to parent thread
      messageOutput = {
        type: "start-game-success",
        data: room,
      };
      parentPort?.postMessage(messageOutput);
      break;

    case "player-plays-move-in-board":
      // Play move in board
      const playMove = msg.data as BoardMove;
      room.board[playMove.row][playMove.col] = playMove.symbol;

      // Check if there is a winner
      const winner = checkWinner(room.board);
      if (winner) {
        room.status = "finished";
        room.winner = room.currentPlayer;
        room.winnerLine = getWinnerLine(room.board, winner);
      } else {
        // Change current player
        room.currentPlayer =
          room.currentPlayer === room.players[0]
            ? room.players[1]
            : room.players[0];

        // Change current symbol
        room.currentSymbol = room.currentSymbol === "X" ? "O" : "X";
      }

      // Send message to parent thread
      messageOutput = {
        type: "player-plays-move-in-board-success",
        data: playMove,
      };
      parentPort?.postMessage(messageOutput);
      break;

    case "send-message":
      // Add new chat message
      const sendMessage = msg.data as Message;
      room.chat.messages.push(sendMessage);

      // Send message to parent thread
      messageOutput = {
        type: "message-sent",
        data: {
          roomId: room.id,
          message: sendMessage,
        },
      };
      parentPort?.postMessage(messageOutput);
      break;

    case "player-typing-on-in-chat-of-room":
      // Add player to typing indicator
      const playerTypingOn = msg.data as Player;
      room.chat.playersTyping.push(playerTypingOn);

      // Send message to parent thread
      messageOutput = {
        type: "player-typing-on-in-chat-of-room",
        data: {
          roomId: room.id,
          player: playerTypingOn,
        },
      };

      parentPort?.postMessage(messageOutput);
      break;

    case "player-typing-off-in-chat-of-room":
      // Remove player from typing indicator
      const playerTypingOff = msg.data as Player;
      room.chat.playersTyping = room.chat.playersTyping.filter(
        (p) => p.id !== playerTypingOff.id
      );

      // Send message to parent thread
      messageOutput = {
        type: "player-typing-off-in-chat-of-room",
        data: {
          roomId: room.id,
          player: playerTypingOff,
        },
      };
      parentPort?.postMessage(messageOutput);
      break;

    default:
      // Handle unknown message types
      parentPort?.postMessage({
        type: "unknown-message",
        message: msg,
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
};

// Set up message listener for parent thread communication
parentPort?.on("message", (msg) => {
  processMessage(msg);
});
