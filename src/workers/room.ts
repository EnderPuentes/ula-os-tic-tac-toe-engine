import {
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
        type: "player-left",
        data: leavePlayer,
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
