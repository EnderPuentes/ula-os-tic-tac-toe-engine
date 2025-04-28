export type Player = {
  id: string;
  name: string;
  avatar: string;
};

export type Chat = {
  playersTyping: Player[];
  messages: Message[];
};

export type Message = {
  content: string;
  sender: Player;
  timestamp: number;
};

export type RoomStatus = "waiting" | "playing" | "finished" | "done";
export type RoomBoardSymbol = "X" | "O" | null;

export type Room = {
  id: string;
  name: string;
  status: RoomStatus;
  chat: Chat;
  board: RoomBoardSymbol[][];
  players: Player[];
  winner: Player | null;
  currentPlayer: Player | null;
  currentSymbol: RoomBoardSymbol | null;
  results: {
    [playerId: string]: {
      wins: number;
      losses: number;
      draws: number;
    };
  };
};

type PlayerAndRoomId = {
  roomId: string;
  player: Player;
};

export type PlayerJoined = PlayerAndRoomId;
export type PlayerAlreadyInRoom = PlayerAndRoomId;
export type PlayerLeft = PlayerAndRoomId;
export type PlayerTypingOnInChatOfRoom = PlayerAndRoomId;
export type PlayerTypingOffInChatOfRoom = PlayerAndRoomId;

export type MessageSent = {
  roomId: string;
  message: Message;
};

export type WorkerMessageInput = {
  type:
    | "get-data"
    | "join-player"
    | "leave-player"
    | "send-message"
    | "player-typing-on-in-chat-of-room"
    | "player-typing-off-in-chat-of-room"
    | "start-game";
  data: Message | Player | Room | null;
};

export type WorkerMessageOutput = {
  type:
    | "data"
    | "player-joined"
    | "player-leaved"
    | "player-already-in-room"
    | "room-full"
    | "message-sent"
    | "player-typing-on-in-chat-of-room"
    | "player-typing-off-in-chat-of-room"
    | "start-game-success"
    | "start-game-error";
  data:
    | Room
    | Player
    | Message
    | PlayerJoined
    | PlayerAlreadyInRoom
    | PlayerLeft
    | PlayerTypingOnInChatOfRoom
    | PlayerTypingOffInChatOfRoom
    | MessageSent;
};
