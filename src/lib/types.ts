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

export type BoardSymbol = "X" | "O" | null;

export type BoardMove = {
  row: number;
  col: number;
  symbol: BoardSymbol;
};

export type CellPosition = { row: number; col: number };

export type PlayerResult = {
  wins: number;
  losses: number;
  draws: number;
};

export type Game = {
  board: BoardSymbol[][];
  currentPlayer: Player | null;
  currentSymbol: BoardSymbol | null;
  winner: Player | null;
  winnerLine: [CellPosition, CellPosition, CellPosition] | null;
};

export type Room = {
  id: string;
  name: string;
  status: RoomStatus;
  game: Game;
  chat: Chat;
  players: Player[];
  results: Record<string, PlayerResult>;
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
    | "player-plays-move-in-board"
    | "start-game";
  data: Message | Player | Room | BoardMove | null;
};

export type WorkerMessageOutput = {
  type:
    | "data"
    | "join-player-error"
    | "join-player-success"
    | "player-leaved"
    | "message-sent"
    | "player-typing-on-in-chat-of-room"
    | "player-typing-off-in-chat-of-room"
    | "player-plays-move-in-board-success"
    | "player-plays-move-in-board-error"
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
    | MessageSent
    | BoardMove
    | string;
};
