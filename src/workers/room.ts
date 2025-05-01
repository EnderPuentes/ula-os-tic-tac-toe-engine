import {
  BoardMove,
  BoardSymbol,
  CellPosition,
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
 * Get the avatar url
 * @param name - The name
 * @returns The avatar url
 */
export function getAvatarUrl(name: string) {
  return `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${name}&backgroundType=gradientLinear&mouth=cute,kissHeart,lilSmile,smileLol,smileTeeth,tongueOut,wideSmile`;
}

/**
 * Get the winnerPlayer line in the board
 * @param board - The board to check
 * @param winnerPlayer - The winnerPlayer
 */
function getWinnerLine(
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
function checkWinner(board: BoardSymbol[][]): BoardSymbol | null {
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
        type: "data",
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
            type: "join-player-error",
            data: `Player is already in room ${room.name}`,
          });
          break;
        }

        // Check if room is full
        if (room.players.player1 && room.players.player2) {
          sendMessage({
            type: "join-player-error",
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
          type: "join-player-success",
          data: null,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          type: "join-player-error",
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
          type: "leave-player-success",
          data: leavePlayer,
        });
      } catch (error) {
        // Send message to parent thread with error
        parentPort?.postMessage({
          type: "leave-player-error",
          data: error as Error,
        });
      }
      break;

    case "start-game":
      try {
        // Check if room is full
        if (!room.players.player1 || !room.players.player2) {
          sendMessage({
            type: "start-game-error",
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
          type: "start-game-success",
          data: null,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          type: "start-game-error",
          data: error as Error,
        });
      }
      break;

    case "play-again":
      try {
        // Check if room is full
        if (!room.players.player1 || !room.players.player2) {
          sendMessage({
            type: "play-again-error",
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
          type: "play-again-success",
          data: null,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          type: "play-again-error",
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
          type: "player-plays-move-in-board-success",
          data: room.game.winnerPlayer,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          type: "player-plays-move-in-board-error",
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
          type: "player-typing-on-in-chat-of-room-success",
          data: playerTypingOn,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          type: "player-typing-on-in-chat-of-room-error",
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
          type: "player-typing-off-in-chat-of-room-success",
          data: null,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          type: "player-typing-off-in-chat-of-room-error",
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
          type: "send-message-success",
          data: null,
        });
      } catch (error) {
        // Send message to parent thread with error
        sendMessage({
          type: "send-message-error",
          data: error as Error,
        });
      }
      break;

    default:
      // Handle unknown message types
      sendMessage({
        type: "unknown-message",
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
