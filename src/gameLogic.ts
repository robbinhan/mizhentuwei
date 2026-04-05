// 游戏核心类型定义
export type Letter = 'A' | 'B' | 'C' | 'D' | 'E';
export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Cell {
  letter: Letter;
  digit: Digit;
}

export interface Position {
  row: number;
  col: number;
}

// 棋子有自己的值，独立于棋盘
export interface Piece {
  position: Position | null;
  letter: Letter;
  digit: Digit;
}

// 棋盘：每个格子可能是 Cell 或 null（被吃掉后变空）
export type Board = (Cell | null)[][];

export interface GameState {
  board: Board;
  player: Piece;
  ai: Piece;
  playerScore: number;
  aiScore: number;
  isPlayerTurn: boolean;
  gameOver: boolean;
}

// 常量
export const BOARD_SIZE = 18;
export const LETTERS: Letter[] = ['A', 'B', 'C', 'D', 'E'];
export const DIGITS: Digit[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// 工具函数
export function randomLetter(): Letter {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}

export function randomDigit(): Digit {
  return DIGITS[Math.floor(Math.random() * DIGITS.length)];
}

export function createCell(letter: Letter, digit: Digit): Cell {
  return { letter, digit };
}

// 生成初始棋盘（填满格子）
export function initializeBoard(): Board {
  const board: Board = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    const rowData: (Cell | null)[] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      rowData.push(createCell(randomLetter(), randomDigit()));
    }
    board.push(rowData);
  }
  return board;
}

// 检查棋子是否可以移动到目标位置
// 参数：棋子、目标位置的棋盘格子
export function canMoveTo(piece: Piece, targetCell: Cell | null): boolean {
  if (!targetCell) {
    // 移动到空格子：总是可以
    return true;
  }
  // 移动到非空格子：数字或字母至少有一个相同
  return piece.letter === targetCell.letter || piece.digit === targetCell.digit;
}

// 检查位置是否在棋盘内
export function isValidPosition(pos: Position): boolean {
  return pos.row >= 0 && pos.row < BOARD_SIZE && pos.col >= 0 && pos.col < BOARD_SIZE;
}

// 获取棋子所有合法的移动目标（只能移动到上下左右相邻格子）
export function getValidMoves(board: Board, piece: Piece, opponent: Piece | null): Position[] {
  const moves: Position[] = [];

  if (!piece.position) return moves;

  // 四个方向：上、下、左、右
  const directions = [
    { row: -1, col: 0 },  // 上
    { row: 1, col: 0 },   // 下
    { row: 0, col: -1 },  // 左
    { row: 0, col: 1 },   // 右
  ];

  for (const dir of directions) {
    const newRow = piece.position.row + dir.row;
    const newCol = piece.position.col + dir.col;

    // 检查是否在棋盘范围内
    if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) continue;

    const targetCell = board[newRow][newCol];

    // 检查是否是对手位置
    const isOpponentPos = opponent && opponent.position &&
                         newRow === opponent.position.row &&
                         newCol === opponent.position.col;

    if (isOpponentPos) {
      // 吃掉对手需要字母或数字有一个相同
      const canCapture = piece.letter === opponent.letter || piece.digit === opponent.digit;
      if (canCapture) {
        moves.push({ row: newRow, col: newCol });
      }
    } else if (canMoveTo(piece, targetCell)) {
      // 普通移动：空格子总是可以，非空格子需要字母或数字相同
      moves.push({ row: newRow, col: newCol });
    }
  }

  return moves;
}

// 检查玩家是否还有合法移动
export function hasValidMoves(board: Board, piece: Piece, opponent: Piece | null): boolean {
  if (!piece.position) return false;
  const moves = getValidMoves(board, piece, opponent);
  return moves.length > 0;
}

// 计算移动结果
export function calculateMoveResult(
  piece: Piece,
  targetCell: Cell | null
): {
  captured: boolean;
  newLetter: Letter;
  newDigit: Digit;
  scoreGained: number;
} {
  if (!targetCell) {
    // 移动到空格子：棋子值不变，不得分
    return {
      captured: false,
      newLetter: piece.letter,
      newDigit: piece.digit,
      scoreGained: 0
    };
  }

  const sameLetter = piece.letter === targetCell.letter;
  const sameDigit = piece.digit === targetCell.digit;

  if (sameLetter && sameDigit) {
    // 数字字母都相同 → 棋子值不变，格子消失，得 1 分
    return {
      captured: true,
      newLetter: piece.letter,
      newDigit: piece.digit,
      scoreGained: 1
    };
  } else if (sameLetter) {
    // 只有字母相同 → 数字相加%10，格子消失，得 1 分
    const newDigit = ((piece.digit + targetCell.digit) % 10) as Digit;
    return {
      captured: true,
      newLetter: piece.letter,
      newDigit: newDigit,
      scoreGained: 1
    };
  } else if (sameDigit) {
    // 只有数字相同 → 字母五进制相加%5，格子消失，得 1 分
    const sourceIndex = LETTERS.indexOf(piece.letter);
    const targetIndex = LETTERS.indexOf(targetCell.letter);
    const newIndex = (sourceIndex + targetIndex) % 5;
    return {
      captured: true,
      newLetter: LETTERS[newIndex],
      newDigit: piece.digit,
      scoreGained: 1
    };
  } else {
    // 不能移动到这里
    return {
      captured: false,
      newLetter: piece.letter,
      newDigit: piece.digit,
      scoreGained: 0
    };
  }
}

// 执行移动
export function executeMove(
  board: Board,
  piece: Piece,
  to: Position,
  opponent: Piece | null
): {
  success: boolean;
  newBoard: Board;
  newPiece: Piece;
  scoreGained: number;
  capturedOpponent: boolean;
} {
  if (!piece.position) {
    return { success: false, newBoard: board, newPiece: piece, scoreGained: 0, capturedOpponent: false };
  }

  const targetCell = board[to.row][to.col];
  const isOpponentPos = opponent && opponent.position && to.row === opponent.position.row && to.col === opponent.position.col;

  // 检查是否是对手位置 - 可以吃掉对手
  if (isOpponentPos) {
    // 检查是否可以移动到对手位置（字母或数字有一个相同）
    const canCapture = piece.letter === opponent.letter || piece.digit === opponent.digit;
    if (!canCapture) {
      return { success: false, newBoard: board, newPiece: piece, scoreGained: 0, capturedOpponent: false };
    }
    // 吃掉对手：棋子值不变，得 5 分
    const newPiece: Piece = {
      position: to,
      letter: piece.letter,
      digit: piece.digit
    };
    return { success: true, newBoard: board, newPiece, scoreGained: 5, capturedOpponent: true };
  }

  // 检查是否可以移动到目标位置
  if (!canMoveTo(piece, targetCell)) {
    return { success: false, newBoard: board, newPiece: piece, scoreGained: 0, capturedOpponent: false };
  }

  // 计算移动结果
  const { newLetter, newDigit, scoreGained } = calculateMoveResult(piece, targetCell);

  // 深拷贝棋盘
  const newBoard = board.map(row => row.map(cell => cell ? { ...cell } : null));

  // 清除原位置（棋子离开，变空）
  newBoard[piece.position.row][piece.position.col] = null;

  // 如果目标位置有格子，被吃掉（变空）
  if (targetCell) {
    newBoard[to.row][to.col] = null;
  }

  // 创建新棋子
  const newPiece: Piece = {
    position: to,
    letter: newLetter,
    digit: newDigit
  };

  return { success: true, newBoard, newPiece, scoreGained, capturedOpponent: false };
}

// AI 选择移动
export function aiChooseMove(board: Board, ai: Piece, player: Piece | null): { to: Position } | null {
  const moves = getValidMoves(board, ai, player);

  if (moves.length === 0) return null;

  // 检查是否可以吃掉对手（最高优先级）
  if (player && player.position) {
    const isOpponentInMoves = moves.some(m => m.row === player.position!.row && m.col === player.position!.col);
    if (isOpponentInMoves) {
      return { to: player.position };
    }
  }

  // 分离空格子移动和吃子移动
  const emptyMoves: Position[] = [];
  const captureMoves: { move: Position; cell: Cell; score: number }[] = [];

  for (const move of moves) {
    const targetCell = board[move.row][move.col];

    if (!targetCell) {
      emptyMoves.push(move);
    } else {
      const { captured, scoreGained } = calculateMoveResult(ai, targetCell);
      if (captured) {
        captureMoves.push({ move, cell: targetCell, score: scoreGained });
      }
    }
  }

  // 如果有吃子移动，随机选择一个（吃子得分是游戏目标）
  if (captureMoves.length > 0) {
    const randomIndex = Math.floor(Math.random() * captureMoves.length);
    return { to: captureMoves[randomIndex].move };
  }

  // 没有吃子移动时，才选择空格子移动
  if (emptyMoves.length > 0) {
    const randomIndex = Math.floor(Math.random() * emptyMoves.length);
    return { to: emptyMoves[randomIndex] };
  }

  return null;
}

// 检查游戏是否结束 - 只有当前玩家没有合法移动时才结束
export function checkGameOver(board: Board, currentPiece: Piece, opponentPiece: Piece): boolean {
  // 只有当前要移动的玩家没有合法移动时，游戏才结束
  return !hasValidMoves(board, currentPiece, opponentPiece);
}

// 选择起始位置（不修改棋盘）
export function selectStartPosition(board: Board, pos: Position): Piece | null {
  if (!isValidPosition(pos)) return null;
  const cell = board[pos.row][pos.col];
  if (!cell) return null;

  return {
    position: pos,
    letter: cell.letter,
    digit: cell.digit
  };
}
