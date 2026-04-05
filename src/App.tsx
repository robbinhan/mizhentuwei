import { useState, useEffect, useCallback } from 'react';
import './App.css';
import {
  BOARD_SIZE,
  type Board,
  type Position,
  type Piece,
  initializeBoard,
  getValidMoves,
  executeMove,
  hasValidMoves,
  aiChooseMove,
  checkGameOver,
  selectStartPosition,
} from './gameLogic';

const HIGH_SCORE_KEY = 'mizhentuwei-high-score';

function App() {
  const [board, setBoard] = useState<Board>(initializeBoard());
  const [player, setPlayer] = useState<Piece>({ position: null, letter: 'A', digit: 0 });
  const [ai, setAi] = useState<Piece>({ position: null, letter: 'A', digit: 0 });
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<'player' | 'ai'>('player');
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'player' | 'ai' | null>(null);

  const [selectedCell, setSelectedCell] = useState<Position | null>(null);
  const [validTargets, setValidTargets] = useState<Position[]>([]);
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem(HIGH_SCORE_KEY);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [showSelection, setShowSelection] = useState(true);
  const [selectionPhase, setSelectionPhase] = useState<'player' | 'ai'>('player');

  // 更新最高分
  useEffect(() => {
    if (playerScore > highScore) {
      setHighScore(playerScore);
      localStorage.setItem(HIGH_SCORE_KEY, playerScore.toString());
    }
  }, [playerScore, highScore]);

  // 显示提示后自动消失，允许玩家选择起点
  useEffect(() => {
    if (showSelection && selectionPhase === 'player') {
      const timer = setTimeout(() => {
        setShowSelection(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSelection, selectionPhase]);

  // AI 回合 - 处理连续移动
  const performAiMove = useCallback((currentBoard: Board, currentAi: Piece, currentPlayer: Piece) => {
    const move = aiChooseMove(currentBoard, currentAi, currentPlayer);

    const timer = setTimeout(() => {
      if (move) {
        const result = executeMove(currentBoard, currentAi, move.to, currentPlayer);

        if (result.success) {
          setBoard(result.newBoard);
          setAi(result.newPiece);
          setAiScore(prev => prev + result.scoreGained);

          // 检查是否吃掉了对手 - 吃掉对手立即获胜
          if (result.capturedOpponent) {
            setWinner('ai');
            setGameOver(true);
            return;
          }

          // 吃子后换手给玩家，移动到空格子可以继续移动
          if (result.scoreGained > 0) {
            // 吃子后换手
            setCurrentTurn('player');
          } else {
            // 移动到空格子，检查是否还能继续移动
            const nextMoves = getValidMoves(result.newBoard, result.newPiece, currentPlayer);
            if (nextMoves.length === 0) {
              // 没有合法移动，AI 输了
              setWinner('player');
              setGameOver(true);
            } else {
              // 继续移动
              performAiMove(result.newBoard, result.newPiece, currentPlayer);
            }
          }
        } else {
          // 移动失败，换手
          setCurrentTurn('player');
        }
      } else {
        // 没有合法移动，AI 输了
        setWinner('player');
        setGameOver(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // AI 回合开始时触发
  useEffect(() => {
    if (currentTurn === 'ai' && !gameOver && ai.position && player.position) {
      performAiMove(board, ai, player);
    }
  }, [currentTurn, gameOver]);

  // 检查游戏结束 - 在当前玩家没有合法移动时结束
  useEffect(() => {
    if (player.position && ai.position && !gameOver) {
      // 检查当前回合的玩家是否有合法移动
      const currentPiece = currentTurn === 'player' ? player : ai;
      const opponentPiece = currentTurn === 'player' ? ai : player;
      const isGameOver = checkGameOver(board, currentPiece, opponentPiece);

      if (isGameOver) {
        // 当前回合的玩家没有合法移动，对手获胜
        setWinner(currentTurn === 'player' ? 'ai' : 'player');
        setGameOver(true);
      }
    }
  }, [board, player, ai, gameOver, currentTurn]);

  // 处理格子点击
  const handleCellClick = useCallback((row: number, col: number) => {
    if (gameOver) return;

    const clickedPos = { row, col };

    // 选择起点阶段 - 玩家还没有选择起点
    if (!player.position) {
      if (selectionPhase === 'player') {
        const newPiece = selectStartPosition(board, clickedPos);
        if (newPiece) {
          setPlayer(newPiece);
          // 清除棋盘上起点位置的格子
          setBoard(prev => {
            const newBoard = prev.map(row => row.map(cell => cell ? { ...cell } : null));
            newBoard[clickedPos.row][clickedPos.col] = null;
            return newBoard;
          });
          setShowSelection(false);
          setSelectionPhase('ai');

          // AI 选择起点 - 使用函数式更新确保拿到最新棋盘
          setTimeout(() => {
            setBoard(prevBoard => {
              const newBoard = prevBoard.map(row => row.map(cell => cell ? { ...cell } : null));
              let randomAiPos: Position;
              let attempts = 0;
              // 找一个不是玩家位置且有格子的位置
              do {
                randomAiPos = {
                  row: Math.floor(Math.random() * BOARD_SIZE),
                  col: Math.floor(Math.random() * BOARD_SIZE),
                };
                attempts++;
              } while (
                (newBoard[randomAiPos.row][randomAiPos.col] === null ||
                 (randomAiPos.row === clickedPos.row && randomAiPos.col === clickedPos.col)) &&
                attempts < 100
              );
              newBoard[randomAiPos.row][randomAiPos.col] = null;
              setAi({
                position: randomAiPos,
                letter: prevBoard[randomAiPos.row][randomAiPos.col]!.letter,
                digit: prevBoard[randomAiPos.row][randomAiPos.col]!.digit
              });
              setCurrentTurn('player');
              return newBoard;
            });
          }, 800);
          return;
        }
      }
      return;
    }

    // 游戏进行中 - 只有当前回合的玩家可以移动
    if (currentTurn !== 'player') return;

    // 如果点击的是 valid target，执行移动
    const isValidTarget = validTargets.some(t => t.row === row && t.col === col);

    if (isValidTarget) {
      const result = executeMove(board, player, clickedPos, ai);

      if (result.success) {
        setBoard(result.newBoard);
        setPlayer(result.newPiece);
        setPlayerScore(prev => prev + result.scoreGained);

        // 检查是否吃掉了对手 - 吃掉对手立即获胜
        if (result.capturedOpponent) {
          setWinner('player');
          setGameOver(true);
          setSelectedCell(null);
          setValidTargets([]);
          return;
        }

        // 吃子后换手给 AI，移动到空格子可以继续移动
        if (result.scoreGained > 0) {
          // 吃子后换手
          setCurrentTurn('ai');
          setSelectedCell(null);
          setValidTargets([]);
        } else {
          // 移动到空格子，玩家继续移动，重新计算合法目标
          const newTargets = getValidMoves(result.newBoard, result.newPiece, ai);
          if (newTargets.length === 0) {
            // 没有合法移动，玩家输了
            setWinner('ai');
            setGameOver(true);
            setSelectedCell(null);
            setValidTargets([]);
          } else {
            setValidTargets(newTargets);
            setSelectedCell(result.newPiece.position);
          }
        }
      }
      return;
    }

    // 选择己方棋子（点击自己的棋子）
    if (player.position.row === row && player.position.col === col) {
      setSelectedCell(clickedPos);
      const targets = getValidMoves(board, player, ai);
      setValidTargets(targets);
      return;
    }

    // 点击其他地方取消选择
    setSelectedCell(null);
    setValidTargets([]);
  }, [board, player, ai, currentTurn, validTargets, selectionPhase, gameOver]);

  // 新游戏
  const startNewGame = useCallback(() => {
    setBoard(initializeBoard());
    setPlayer({ position: null, letter: 'A', digit: 0 });
    setAi({ position: null, letter: 'A', digit: 0 });
    setPlayerScore(0);
    setAiScore(0);
    setCurrentTurn('player');
    setGameOver(false);
    setWinner(null);
    setSelectedCell(null);
    setValidTargets([]);
    setShowSelection(true);
    setSelectionPhase('player');
  }, []);

  // 判断格子显示内容
  const getCellDisplay = (row: number, col: number) => {
    // 首先是玩家棋子位置
    if (player.position?.row === row && player.position?.col === col) {
      return { type: 'player-piece', value: `${player.letter}${player.digit}` };
    }

    // 然后是 AI 棋子位置
    if (ai.position?.row === row && ai.position?.col === col) {
      return { type: 'ai-piece', value: `${ai.letter}${ai.digit}` };
    }

    // 最后是棋盘格子
    const cell = board[row][col];
    if (!cell) return { type: 'empty', value: '' };

    return { type: 'filled', value: `${cell.letter}${cell.digit}` };
  };

  // 检查是否是合法移动目标
  const isValidTargetCell = (row: number, col: number) => {
    return validTargets.some(t => t.row === row && t.col === col);
  };

  // 检查是否被选中
  const isSelectedCell = (row: number, col: number) => {
    return selectedCell?.row === row && selectedCell?.col === col;
  };

  // 游戏结束判断胜负
  const getResultMessage = () => {
    if (winner === 'player') {
      return { text: '你赢了!', className: 'win' };
    } else if (winner === 'ai') {
      return { text: 'AI 赢了!', className: 'lose' };
    } else {
      return { text: '游戏结束', className: 'draw' };
    }
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="score-board">
          <div className="score-item player">
            <span className="score-label">玩家</span>
            <span className="score-value">{playerScore}</span>
          </div>
          <div className="score-item ai">
            <span className="score-label">AI</span>
            <span className="score-value">{aiScore}</span>
          </div>
        </div>

        <div className={`game-status ${
          gameOver ? 'game-over' :
          currentTurn === 'player' ? 'player-turn' : 'ai-turn'
        }`}>
          {gameOver ? '游戏结束' :
           currentTurn === 'player' ? '你的回合' : 'AI 思考中...'}
        </div>

        <button className="new-game-btn" onClick={startNewGame}>
          新游戏
        </button>
      </div>

      <div className="board-container">
        <div className="board" style={{
          gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`
        }}>
          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const display = getCellDisplay(rowIndex, colIndex);
              const valid = isValidTargetCell(rowIndex, colIndex);
              const selected = isSelectedCell(rowIndex, colIndex);

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`cell ${display.type} ${valid ? 'valid-target' : ''} ${selected ? 'selected' : ''}`}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                >
                  {display.value}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="game-info">
        <div className="high-score">
          <div className="high-score-label">最高分</div>
          <div className="high-score-value">{highScore}</div>
        </div>
      </div>

      {/* 选择起点覆盖层 */}
      {showSelection && selectionPhase === 'player' && (
        <div className="selection-overlay">
          <div className="selection-modal">
            <div className="selection-title">选择你的起点</div>
            <div className="selection-instruction">点击任意格子作为你的起始位置</div>
          </div>
        </div>
      )}

      {/* 游戏结束覆盖层 */}
      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-modal">
            <div className="game-over-title">游戏结束</div>
            <div className="game-over-scores">
              <div className="game-over-score player">
                <span className="game-over-score-label">玩家</span>
                <span className="game-over-score-value">{playerScore}</span>
              </div>
              <div className="game-over-score ai">
                <span className="game-over-score-label">AI</span>
                <span className="game-over-score-value">{aiScore}</span>
              </div>
            </div>
            <div className={`game-over-result ${getResultMessage().className}`}>
              {getResultMessage().text}
            </div>
            <button className="new-game-btn" onClick={startNewGame}>
              再来一局
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
