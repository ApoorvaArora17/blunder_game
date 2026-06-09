import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

export default function ChessQuiz() {
  const [game, setGame] = useState(new Chess());
  const [visualPosition, setVisualPosition] = useState(""); 
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [score, setScore] = useState(0);
  const [boardKey, setBoardKey] = useState(0);
  const [status, setStatus] = useState('idle'); 
  const [highlightedSquare, setHighlightedSquare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [boardOrientation, setBoardOrientation] = useState('white');

  // --- REWIND UTILITY FOR ANIMATIONS ---
  // Takes the final puzzle state and reconstructs what it looked like *before* the move.
  // It handles captures perfectly by checking what piece currently sits at data.preTo BEFORE moving it back.
  const reconstructPreviousPosition = (data) => {
    if (!data || !data.preFrom || !data.preTo) return data.fen;

    const engine = new Chess(data.fen);
    
    // 1. Check what piece is physically sitting at the destination square right now
    const pieceAtDestination = engine.get(data.preTo);

    if (pieceAtDestination) {
      // 2. Clear the destination square
      engine.remove(data.preTo);
      
      // 3. Put that piece back at its starting square
      engine.put({ type: pieceAtDestination.type, color: pieceAtDestination.color }, data.preFrom);
      
      // 4. CAPTURE PROTECTION: If the backend indicates a piece was taken, or if we know
      // the moving piece's identity changed (or it was a known capture), we resurrect the victim.
      if (data.capturedPiece) {
        // Safe backend injection format: e.g., { type: 'p', color: 'b' }
        engine.put(data.capturedPiece, data.preTo);
      } else if (data.isCapture) {
        // Smart fallback guess: If backend tells us it was a capture but didn't pass the type,
        // we guess the opposite color. (Pawn is a safe neutral fallback for visual styling)
        const victimColor = pieceAtDestination.color === 'w' ? 'b' : 'w';
        engine.put({ type: 'p', color: victimColor }, data.preTo);
      }
    }
    
    return engine.fen();
  };

  // 1. Fetch a random challenge configuration from your backend API
  const fetchNewChallenge = async () => {
    try {
      setLoading(true);
      setStatus('loading-next-puzzle'); 
      setHighlightedSquare(null);

      const res = await fetch('https://blunder-game.onrender.com/api/get-challenge');
      const data = await res.json(); 
      
      setCurrentChallenge(data);
      
      // Initialize the primary validator engine
      const trueEngineInstance = new Chess(data.fen);
      setGame(trueEngineInstance);
      
      const playerTurn = trueEngineInstance.turn() === 'w' ? 'white' : 'black';
      setBoardOrientation(playerTurn);

      // Reconstruct historical layout before sliding pieces forward
      if (data.preFrom && data.preTo) {
        const initialLayout = reconstructPreviousPosition(data);
        
        setVisualPosition(initialLayout);
        setBoardKey(prev => prev + 1);
        setLoading(false);

        // Slide forward smoothly
        setTimeout(() => {
          setVisualPosition(data.fen);
          setHighlightedSquare(data.preTo); 
          setStatus('idle'); 
        }, 600);

      } else {
        setVisualPosition(data.fen);
        setBoardKey(prev => prev + 1);
        setLoading(false);
        setStatus('idle');
      }

    } catch (error) {
      console.error("Error fetching challenge data from backend:", error);
      setLoading(false);
      setStatus('idle');
    }
  };

  // 2. Replay the previous move animation manually
  const replayLastMove = () => {
    if (!currentChallenge || status === 'loading-next-puzzle' || status === 'showing-right-move') {
      return;
    }

    if (currentChallenge.preFrom && currentChallenge.preTo) {
      setStatus('loading-next-puzzle'); // Lock controls
      setHighlightedSquare(null);

      // Instantly rewind layout view
      const rewindLayout = reconstructPreviousPosition(currentChallenge);
      setVisualPosition(rewindLayout);
      
      // Let it slide back into place
      setTimeout(() => {
        setVisualPosition(currentChallenge.fen);
        setHighlightedSquare(currentChallenge.preTo);
        setStatus('idle');
      }, 500); 
    }
  };

  // 3. Listen for Arrow keys
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        replayLastMove();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentChallenge, status]);

  useEffect(() => {
    fetchNewChallenge();
  }, []);

  function makeAMove(moveObj) {
    if (status === 'loading-next-puzzle' || status === 'showing-right-move' || !currentChallenge) {
      return false;
    }

    const gameCopy = new Chess(game.fen());
    
    try {
      const result = gameCopy.move(moveObj);
      
      if (result) {
        setGame(gameCopy);
        setVisualPosition(gameCopy.fen()); 
        setHighlightedSquare(moveObj.to);

        if (result.san === currentChallenge.correctMove) {
          setStatus('correct');
          setScore(prev => prev + 1);
          
          setTimeout(() => {
            fetchNewChallenge(); 
          }, 1500);

        } else {
          setStatus('wrong');
          
          setTimeout(() => {
            const originalPosition = new Chess(currentChallenge.fen);
            setGame(originalPosition);
            setVisualPosition(originalPosition.fen());
            setHighlightedSquare(null); 
            
            setTimeout(() => {
              originalPosition.move({ 
                from: currentChallenge.fromSquare, 
                to: currentChallenge.toSquare 
              }); 
              setGame(originalPosition);
              setVisualPosition(originalPosition.fen());
              setHighlightedSquare(currentChallenge.toSquare); 
              setStatus('showing-right-move');

              setTimeout(() => {
                fetchNewChallenge(); 
              }, 2500);

            }, 600);
          }, 800);
        }

        return true;
      }
    } catch (e) {
      console.log("Invalid chess move:", e);
      return false; 
    }
    return false;
  }

  function onDrop(param1, param2) {
    let from, to;
    if (param1 && typeof param1 === 'object') {
      from = param1.sourceSquare;
      to = param1.targetSquare;
    } else {
      from = param1;
      to = param2;
    }

    return makeAMove({
      from: from,
      to: to,
      promotion: 'q', 
    });
  }

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading puzzle database...</div>;
  }

  const customSquareStyles = {};
  if (highlightedSquare) {
    if (status === 'correct') {
      customSquareStyles[highlightedSquare] = { backgroundColor: 'rgba(74, 222, 128, 0.5)' };
    } else if (status === 'wrong') {
      customSquareStyles[highlightedSquare] = { backgroundColor: 'rgba(239, 68, 68, 0.5)' };
    } else if (status === 'showing-right-move') {
      customSquareStyles[highlightedSquare] = { backgroundColor: 'rgba(59, 130, 246, 0.5)' };
    } else if (status === 'idle' && currentChallenge) {
      customSquareStyles[highlightedSquare] = { backgroundColor: 'rgba(251, 191, 36, 0.3)' };
    }
  }

  const bundledOptions = {
    id: "chess-guessr-board",
    position: visualPosition, 
    onPieceDrop: onDrop, 
    orientation: boardOrientation,
    boardOrientation: boardOrientation,
    customSquareStyles: customSquareStyles,
    animationDuration: 300 
  };

  return (
    <div style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Chess Guessr</h1>
      
      <div style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
        Score: {score}
      </div>
      
      <div style={{ height: '30px', marginBottom: '10px', fontSize: '18px', fontWeight: 'bold' }}>
        {status === 'correct' && <span style={{ color: '#22c55e' }}>✓ Correct!</span>}
        {status === 'wrong' && <span style={{ color: '#ef4444' }}>✗ Wrong Move...</span>}
        {status === 'showing-right-move' && <span style={{ color: '#3b82f6' }}>Master solution: {currentChallenge?.correctMove}</span>}
        {status === 'loading-next-puzzle' && <span style={{ color: '#94a3b8' }}>Opponent moving...</span>}
      </div>
      
      <div style={{ boxShadow: '0 4px 10px rgba(0,0,0,0.15)', borderRadius: '8px', overflow: 'hidden' }}>
        <Chessboard 
          id="chess-guessr-board"
          key={boardKey}
          options={bundledOptions} 
          position={visualPosition} 
          onPieceDrop={onDrop}
          orientation={boardOrientation}
          boardOrientation={boardOrientation}
          customSquareStyles={customSquareStyles}
          animationDuration={300}
        />
      </div>
      
      <p style={{ marginTop: '15px', color: '#666' }}>
        It is <strong>{boardOrientation === 'white' ? 'White' : 'Black'} to move</strong>. Find the best continuation!
      </p>

      <div style={{ marginTop: '15px' }}>
        <button 
          onClick={replayLastMove}
          disabled={status !== 'idle'}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: status === 'idle' ? 'pointer' : 'not-allowed',
            backgroundColor: '#e2e8f0',
            border: 'none',
            borderRadius: '5px',
            color: '#334155',
            transition: 'background-color 0.2s'
          }}
        >
          ⬅ Replay Last Move (or press Arrow Key)
        </button>
      </div>
    </div>
  );
}
