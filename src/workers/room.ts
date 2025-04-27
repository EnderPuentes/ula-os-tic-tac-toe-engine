import {
  Message,
  Player,
  Room,
  WorkerMessageReceive,
  WorkerMessageSend,
} from "@/lib/types";
import { parentPort, workerData } from "worker_threads";

// Flag to track if a message is currently being processed
let isProcessing = false;

// Room data passed from parent thread
const room: Room = workerData;

// Queue to store pending messages while processing
const queue: WorkerMessageSend[] = [];

/**
 * Process incoming messages from parent thread
 * Handles room operations like joining/leaving players and chat messages
 * Uses a queue system to prevent concurrent processing
 */
const processMessage = (msg: WorkerMessageSend) => {
  // If already processing a message, add to queue
  if (isProcessing) {
    queue.push(msg);
    return;
  }

  isProcessing = true;

  let messageReceive: WorkerMessageReceive;

  switch (msg.type) {
    case "get":
      // Return current room state
      parentPort?.postMessage(room);
      break;

    case "join-player":
      let messageReceiveType: WorkerMessageReceive["type"];

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
          messageReceiveType = "player-joined";
        }
      }

      // Notify parent thread of join result
      messageReceive = {
        type: messageReceiveType,
        data: {
          roomId: room.id,
          player: joinPlayer,
        },
      };
      parentPort?.postMessage(messageReceive);
      break;

    case "leave-player":
      // Remove player from room
      const leavePlayer: Player = msg.data as Player;
      room.players = room.players.filter((p) => p.id !== leavePlayer.id);
      parentPort?.postMessage({
        type: "player-left",
        data: leavePlayer,
      });
      break;

    case "send-message":
      // Add new chat message
      const sendMessage = msg.data as Message;
      room.chat.messages.push(sendMessage);
      parentPort?.postMessage({
        type: "message-sent",
        data: {
          roomId: room.id,
          message: sendMessage,
        },
      });
      break;

    case "player-typing-on-in-chat":
      // Add player to typing indicator
      const playerTypingOn = msg.data as Player;
      room.chat.playersTyping.push(playerTypingOn);
      parentPort?.postMessage({
        type: "add-player-typing-in-chat-of-room",
        data: {
          roomId: room.id,
          player: playerTypingOn,
        },
      });
      break;

    case "player-typing-off-in-chat":
      // Remove player from typing indicator
      const playerTypingOff = msg.data as Player;
      room.chat.playersTyping = room.chat.playersTyping.filter(
        (p) => p.id !== playerTypingOff.id
      );
      parentPort?.postMessage({
        type: "remove-player-typing-in-chat-of-room",
        data: {
          roomId: room.id,
          player: playerTypingOff,
        },
      });
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
