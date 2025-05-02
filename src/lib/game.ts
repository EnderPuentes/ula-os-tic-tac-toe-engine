import { BoardSymbol, CellPosition } from './types';

/**
 * Get the winnerPlayer line in the board
 * @param board - The board to check
 * @param winnerPlayer - The winnerPlayer
 */
export function getWinnerLine(
  board: BoardSymbol[][],
  winnerPlayer: BoardSymbol,
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
