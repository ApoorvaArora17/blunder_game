import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

export default function ChessQuiz() {
  const [game, setGame] = useState(() => new Chess());
  const [visualPosition, setVisualPosition] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"); 
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [score, setScore] = useState(0);
  const [totalAttempted, setTotalAttempted] = useState(0); // 1. Added total attempts tracker
  const [boardKey, setBoardKey] = useState(0);
  const [status, setStatus] = useState('idle'); 
  const [highlightedSquare, setHighlightedSquare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [boardOrientation, setBoardOrientation] = useState('white');
  const [prevMoveSquares, setPrevMoveSquares] = useState({ from: null, to: null });

  const sandboxFallback = {
    fenBefore: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    fenAfter: "r1bqkbnr/pppp1ppp/2n5/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQkq - 0 3",
    blunderMove: "Qe5",
    prevMove: "Nc6", 
    fromSquare: "d1",
    toSquare: "e5",
    preFrom: "b8",   
    preTo: "c6",     
    preTargetPiece: "", 
    preTargetColor: "",
    white_player: "Magnus Carlsen",
    black_player: "Hikaru Nakamura",
    from_time_white: "03:15",
    from_time_black: "04:02",
    eval_preFrom: "+0.4",
    eval_from: "-4.8",
    time_class: "blitz"
  };

  const sanitizeFenString = (fen, defaultTurn = 'w') => {
    if (!fen || typeof fen !== 'string' || fen.trim() === "" || fen.trim().toLowerCase() === "nan") {
      return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    }
    let trimmed = fen.trim();
    let parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return `${trimmed} ${defaultTurn} KQkq - 0 1`;
    }
    return trimmed;
  };

  const reconstructSetupStartFen = (data) => {
    try {
      const cleanBefore = sanitizeFenString(data.fenBefore, 'w');
      const fromSq = data.preFrom;
      const toSq = data.preTo;

      if (!fromSq || !toSq) return cleanBefore;

      const tempEngine = new Chess(cleanBefore);
      const pieceAtDestination = tempEngine.get(toSq);

      if (pieceAtDestination) {
        tempEngine.put({ type: pieceAtDestination.type, color: pieceAtDestination.color }, fromSq);
        
        if (data.preTargetPiece && data.preTargetColor) {
          tempEngine.put({ 
            type: data.preTargetPiece.toLowerCase(), 
            color: data.preTargetColor.toLowerCase() 
          }, toSq);
        } else {
          tempEngine.remove(toSq);
        }
        
        const tokens = tempEngine.fen().split(' ');
        tokens[1] = tempEngine.turn() === 'w' ? 'b' : 'w';
        return tokens.join(' ');
      }
      return cleanBefore;
    } catch (e) {
      return sanitizeFenString(data.fenBefore, 'w');
    }
  };

  const fetchNewChallenge = async () => {
    try {
      setLoading(true);
      setStatus('loading-next-puzzle');
      setHighlightedSquare(null);
      setPrevMoveSquares({ from: null, to: null });

      const res = await fetch('https://blunder-game.onrender.com/api/get-challenge');
      const data = await res.json();

      if (data && !data.error && data.fenBefore && data.fenBefore !== "nan") {
        initializeDataset(data);
      } else {
        initializeDataset(sandboxFallback);
      }
    } catch (err) {
      initializeDataset(sandboxFallback);
    }
  };

  const initializeDataset = (data) => {
    try {
      const cleanFenBefore = sanitizeFenString(data.fenBefore, 'w');
      const freshEngine = new Chess(cleanFenBefore);
      const targetSide = freshEngine.turn() === 'w' ? 'white' : 'black';
      
      setGame(freshEngine);
      setBoardOrientation(targetSide);
      setCurrentChallenge(data);

      const historicalStartFen = reconstructSetupStartFen(data);

      setPrevMoveSquares({
        from: data.preFrom || null,
        to: data.preTo || null
      });

      setVisualPosition(historicalStartFen);
      setLoading(false);
      setBoardKey(prev => prev + 1);

      setTimeout(() => {
        setVisualPosition(cleanFenBefore);
        setStatus('idle');
      }, 400);

    } catch (chessError) {
      console.error("Layout Engine crash:", chessError);
      const safeEngine = new Chess();
      setGame(safeEngine);
      setVisualPosition(safeEngine.fen());
      setCurrentChallenge(sandboxFallback);
      setPrevMoveSquares({ from: null, to: null });
      setLoading(false);
      setStatus('idle');
    }
  };

  useEffect(() => {
    fetchNewChallenge();
  }, []);

  function makeAMove(moveObj) {
    if (status !== 'idle' || !currentChallenge) return false;

    try {
      const gameCopy = new Chess(game.fen());
      const result = gameCopy.move(moveObj);
      
      if (result) {
        setGame(gameCopy);
        setVisualPosition(gameCopy.fen()); 
        setHighlightedSquare(moveObj.to);
        setPrevMoveSquares({ from: null, to: null });

        // 2. Increment total attempts on any valid piece movement submission
        setTotalAttempted(prev => prev + 1);

        if (result.san === currentChallenge.blunderMove) {
          setStatus('correct');
          setScore(prev => prev + 1);
        } else {
          setStatus('wrong');
          setTimeout(() => {
            const resetEngine = new Chess(sanitizeFenString(currentChallenge.fenBefore, 'w'));
            setGame(resetEngine);
            setVisualPosition(resetEngine.fen());
            setHighlightedSquare(null); 
            
            setTimeout(() => {
              resetEngine.move({ from: currentChallenge.fromSquare, to: currentChallenge.toSquare }); 
              setGame(resetEngine);
              setVisualPosition(resetEngine.fen());
              setHighlightedSquare(currentChallenge.toSquare); 
              setStatus('showing-right-move');
            }, 600);
          }, 800);
        }
        return true;
      }
    } catch (e) {
      return false; 
    }
    return false;
  }

  function onDrop(sourceSquare, targetSquare) {
    let from = sourceSquare;
    let to = targetSquare;

    if (sourceSquare && typeof sourceSquare === 'object') {
      from = sourceSquare.sourceSquare;
      to = sourceSquare.targetSquare;
    }

    return makeAMove({
      from: from,
      to: to,
      promotion: 'q', 
    });
  }

  const opponentName = boardOrientation === 'white' ? currentChallenge?.black_player : currentChallenge?.white_player;
  const activeName = boardOrientation === 'white' ? currentChallenge?.white_player : currentChallenge?.black_player;
  const displayEval = status === 'showing-right-move' || status === 'correct' ? currentChallenge?.eval_after : currentChallenge?.eval_from;

  const numericalEval = parseFloat(displayEval) || 0;
  const clamped = Math.max(-7, Math.min(7, numericalEval));
  const whiteHeight = ((clamped + 8) / 16) * 100;

  const textColor = '#ffffff';
  const badgeBgColor = 'rgba(0, 0, 0, 0.65)';

  const customSquareStyles = {};
  
  if (prevMoveSquares.from && prevMoveSquares.to) {
    customSquareStyles[prevMoveSquares.from] = { backgroundColor: 'rgba(239, 68, 68, 0.35)' }; 
    customSquareStyles[prevMoveSquares.to] = { backgroundColor: 'rgba(239, 68, 68, 0.45)' };   
  }
  
  if (highlightedSquare) {
    if (status === 'correct') customSquareStyles[highlightedSquare] = { backgroundColor: 'rgba(134, 239, 172, 0.5)' };
    else if (status === 'wrong') customSquareStyles[highlightedSquare] = { backgroundColor: 'rgba(248, 113, 113, 0.5)' };
    else if (status === 'showing-right-move') customSquareStyles[highlightedSquare] = { backgroundColor: 'rgba(96, 165, 250, 0.5)' };
  }

  const showNextButton = status === 'correct' || status === 'showing-right-move';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#302e2b', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif', padding: '20px' }}>
      
      <div style={{ width: '100%', maxWidth: '620px', textAlign: 'center', marginBottom: '14px' }}>
        <h2 style={{ margin: '5px 0', color: '#bababa', fontSize: '20px' }}>Chess Blunder Guesser</h2>
        
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '6px' }}>
          {/* 3. Updated UI text to show "score / totalAttempted" */}
          <div style={{ fontSize: '16px', color: '#81b64c', fontWeight: 'bold' }}>
            Session Score: {score} / {totalAttempted}
          </div>

          {currentChallenge?.time_class && (
            <span style={{ 
              backgroundColor: '#45423e', 
              color: '#d4d4d4', 
              fontSize: '11px', 
              fontWeight: 'bold', 
              textTransform: 'uppercase', 
              padding: '3px 8px', 
              borderRadius: '12px',
              letterSpacing: '0.5px',
              border: '1px solid #54514c'
            }}>
              ⏱️ {currentChallenge.time_class}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', width: '100%', maxWidth: '620px', gap: '12px', alignItems: 'stretch' }}>
        
        <div style={{ width: '28px', backgroundColor: '#262421', borderRadius: '4px', overflow: 'hidden', position: 'relative', border: '1px solid #403e3b', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
            {boardOrientation === 'white' ? (
              <>
                <div style={{ height: `${100 - whiteHeight}%`, backgroundColor: '#262522', transition: 'height 0.3s ease-out' }} />
                <div style={{ height: `${whiteHeight}%`, backgroundColor: '#ffffff', transition: 'height 0.3s ease-out' }} />
              </>
            ) : (
              <>
                <div style={{ height: `${whiteHeight}%`, backgroundColor: '#ffffff', transition: 'height 0.3s ease-out' }} />
                <div style={{ height: `${100 - whiteHeight}%`, backgroundColor: '#262522', transition: 'height 0.3s ease-out' }} />
              </>
            )}
          </div>
          
          <div style={{ 
            position: 'absolute', 
            left: '2px', 
            right: '2px', 
            top: '6px', 
            backgroundColor: badgeBgColor, 
            borderRadius: '3px',
            padding: '2px 0',
            textAlign: 'center', 
            zIndex: 10,
            pointerEvents: 'none',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
          }}>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: textColor, display: 'block' }}>
              {displayEval || "0.0"}
            </span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#dedede' }}>{opponentName || "Loading..."}</span>
            <span style={{ backgroundColor: '#262421', padding: '4px 8px', borderRadius: '3px', fontFamily: 'monospace' }}>
              {boardOrientation === 'white' ? currentChallenge?.from_time_black : currentChallenge?.from_time_white || "--:--"}
            </span>
          </div>

          <div style={{ position: 'relative', borderRadius: '4px', overflow: 'hidden', width: '100%', backgroundColor: '#262421' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '450px', color: '#bababa' }}>Syncing Layout Engine...</div>
            ) : (
              <Chessboard 
                id="chess-guessr-board"
                key={boardKey}
                customSquareStyles={customSquareStyles}
                options={{
                  position: visualPosition,
                  boardOrientation: boardOrientation,
                  onPieceDrop: onDrop,
                  animationDuration: 400, 
                  customDarkSquareStyle: { backgroundColor: '#b58863' },
                  customLightSquareStyle: { backgroundColor: '#f0d9b5' }
                }}
              />
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#dedede' }}>{activeName || "Loading..."}</span>
            <span style={{ backgroundColor: '#ffffff', color: '#262421', padding: '4px 8px', borderRadius: '3px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {boardOrientation === 'white' ? currentChallenge?.from_time_white : currentChallenge?.from_time_black || "--:--"}
            </span>
          </div>

        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '620px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        <div style={{ height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#262421' }}>
          {status === 'correct' && <span style={{ color: '#81b64c' }}>✓ You're so good at finding bad moves, do you ever win?</span>}
          {status === 'wrong' && <span style={{ color: '#fa4c4c' }}>✗ You can't even make the wrong moves correctly.</span>}
          {status === 'showing-right-move' && <span style={{ color: '#4fa3fa' }}>Actual Blunder: {currentChallenge?.blunderMove}</span>}
          {status === 'loading-next-puzzle' && <span style={{ color: '#9c9a96' }}>Setting up next board...</span>}
          {status === 'idle' && (
            <span style={{ color: '#dadada' }}>
              {currentChallenge?.prevMove 
                ? `Opponent played ${currentChallenge.prevMove}. Guess the blunder!` 
                : "Guess the blunder played in this position!"
              }
            </span>
          )}
        </div>

        {showNextButton && (
          <button 
            onClick={fetchNewChallenge}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#81b64c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#95cc59'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#81b64c'}
          >
            Next Puzzle →
          </button>
        )}
      </div>

    </div>
  );
}
