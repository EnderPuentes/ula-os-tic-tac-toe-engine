export type Player = {
  id: string;
  name: string;
  avatar: string;
  symbol: BoardSymbol;
};

type Chat = {
  playersTyping: Player[];
  messages: Message[];
};

export type Message = {
  content: string;
  sender: Player | null;
  timestamp: number;
};

type RoomStatus = 'waiting' | 'playing' | 'finished' | 'done';

export type BoardSymbol = 'X' | 'O' | null;

export type BoardMove = {
  row: number;
  col: number;
  symbol: BoardSymbol;
};

export type CellPosition = { row: number; col: number };

type PlayerResult = {
  wins: number;
  losses: number;
  draws: number;
};

type Game = {
  board: BoardSymbol[][];
  currentPlayer: Player | null;
  winnerPlayer: Player | null;
  winnerLine: [CellPosition, CellPosition, CellPosition] | null;
};

export type Room = {
  id: string;
  name: string;
  status: RoomStatus;
  game: Game;
  chat: Chat;
  players: {
    player1: Player | null;
    player2: Player | null;
  };
  results: {
    player1: PlayerResult;
    player2: PlayerResult;
  };
};

export type WorkerMessageInput = {
  id: string;
  type:
    | 'get-data'
    | 'join-player'
    | 'leave-player'
    | 'send-message'
    | 'player-typing-on-in-chat-of-room'
    | 'player-typing-off-in-chat-of-room'
    | 'player-plays-move-in-board'
    | 'start-game'
    | 'play-again';
  socketId: string;
  data: Message | Player | Room | BoardMove | string | null;
};

export type WorkerMessageOutput = {
  id: string;
  status: 'success' | 'error';
  data: Room | Player | BoardMove | string | null | Error;
};
