export interface Player {
  username: string;
  joinedAt: string;
  resumeConfirmed?: boolean;
}

export interface Account {
  userId: string;
  username: string;
  balance: number;
}

export type GameStatus = 'LOBBY' | 'RUNNING' | 'PAUSED' | 'FINISHED';

export interface Game {
  id: string;
  host: string;
  status: GameStatus | string;
  players: Player[];
  inviteCode?: string;
  inviteLink?: string;
  inviteLinkShort?: string;
  qrCodeSvg?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt?: string;
  accounts?: Account[];
  bank?: { balance: number } | null;
  winners?: string[];
}

export interface GameSummary {
  id: string;
  host: string;
  status: GameStatus | string;
  createdAt: string;
  startedAt?: string;
  playerCount: number;
  resumeConfirmedCount: number;
}

export interface Transaction {
  id: string;
  amount: number;
  type: string;
  memo: string | null;
  fromUsername: string | null;
  toUsername: string | null;
  createdAt: string;
  runningBalance: number | null;
}

export interface CreateGameResponse {
  message: string;
  game: Game;
}

export interface MyGamesResponse {
  games: GameSummary[];
}

export interface GetGameResponse {
  game: Game;
}

export interface JoinRoundResponse {
  roundId: string;
  roundName?: string;
  playerCount?: number;
}

export interface TransactionsResponse {
  transactions: Transaction[];
}
