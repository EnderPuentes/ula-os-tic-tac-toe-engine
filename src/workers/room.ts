import {
  BoardMove,
  BoardSymbol,
  CellPosition,
  Message,
  Player,
  Room,
  RoomPlayer,
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
 * Get the winnerPlayer line in the board
 * @param board - The board to check
 * @param winnerPlayer - The winnerPlayer
 */
export function getWinnerLine(
  board: BoardSymbol[][],
  winnerPlayer: BoardSymbol
): [CellPosition, CellPosition, CellPosition] | null {
  // Check for horizontal wins
  for (let row = 0; row < 3; row++) {
    if (
      board[row][0] === winnerPlayer &&
      board[row][1] === winnerPlayer &&
      board[row][2] === winnerPlayer
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
      board[0][col] === winnerPlayer &&
      board[1][col] === winnerPlayer &&
      board[2][col] === winnerPlayer
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
    board[0][0] === winnerPlayer &&
    board[1][1] === winnerPlayer &&
    board[2][2] === winnerPlayer
  ) {
    return [
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 2 },
    ];
  }

  // Check reverse diagonal wins
  if (
    board[0][2] === winnerPlayer &&
    board[1][1] === winnerPlayer &&
    board[2][0] === winnerPlayer
  ) {
    return [
      { row: 0, col: 2 },
      { row: 1, col: 1 },
      { row: 2, col: 0 },
    ];
  }

  // If no winnerPlayer, return null
  return null;
}

/**
 * Check if there is a winnerPlayer in the board
 * @param board - The board to check
 * @returns The winnerPlayer if there is one, otherwise null
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

  // If no winnerPlayer, return null
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
      try {
        const joinPlayer: RoomPlayer = msg.data as RoomPlayer;

        // Check if room is full (max 2 players)
        if (room.players.player1 && room.players.player2) {
          parentPort?.postMessage({
            type: "join-player-error",
            data: `Room ${room.name} is full`,
          } as WorkerMessageOutput);
        } else {
          // Verify player isn't already in room
          if (
            room.players.player1?.id === joinPlayer.id ||
            room.players.player2?.id === joinPlayer.id
          ) {
            parentPort?.postMessage({
              type: "join-player-error",
              data: `Player ${joinPlayer.id} is already in room ${room.name}`,
            } as WorkerMessageOutput);
          } else {
            // Add new player to room
            if (!room.players.player1) {
              room.players.player1 = {
                ...joinPlayer,
                symbol: "X",
              };
            } else if (!room.players.player2) {
              room.players.player2 = {
                ...joinPlayer,
                symbol: "O",
              };
            }

            // If there are 2 players, set room status to done
            if (room.players.player1 && room.players.player2) {
              room.status = "done";
            }

            // Send message to parent thread
            parentPort?.postMessage({
              type: "join-player-success",
              data: joinPlayer,
            } as WorkerMessageOutput);
          }
        }
      } catch (error) {
        parentPort?.postMessage({
          type: "join-player-error",
          data: error,
        } as WorkerMessageOutput);
      }

      break;

    case "leave-player":
      try {
        // Remove player from room
        const leavePlayer: Player = msg.data as Player;
        if (room.players.player1?.id === leavePlayer.id) {
          room.players.player1 = null;
        } else if (room.players.player2?.id === leavePlayer.id) {
          room.players.player2 = null;
        }

        // Send message to parent thread
        parentPort?.postMessage({
          type: "leave-player-success",
          data: leavePlayer,
        } as WorkerMessageOutput);
      } catch (error) {
        parentPort?.postMessage({
          type: "leave-player-error",
          data: error,
        } as WorkerMessageOutput);
      }
      break;

    case "start-game":
      try {
        // Set room status to playing
        room.status = "playing";

        // Set current player
        room.game.currentPlayer =
          Math.floor(Math.random() * 2) === 0
            ? room.players.player1
            : room.players.player2;

        // Send message to parent thread
        messageOutput = {
          type: "start-game-success",
          data: room,
        };
        parentPort?.postMessage(messageOutput);
      } catch (error) {
        parentPort?.postMessage({
          type: "start-game-error",
          data: error,
        } as WorkerMessageOutput);
      }
      break;

    case "play-again":
      try {
        // Set room status to playing
        room.status = "playing";

        // Set current player
        room.game.currentPlayer =
          Math.floor(Math.random() * 2) === 0
            ? room.players.player1
            : room.players.player2;

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
        messageOutput = {
          type: "play-again-success",
          data: room,
        };
        parentPort?.postMessage(messageOutput);
      } catch (error) {
        parentPort?.postMessage({
          type: "play-again-error",
          data: error,
        } as WorkerMessageOutput);
      }
      break;
    case "player-plays-move-in-board":
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
        type: "send-message-success",
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
