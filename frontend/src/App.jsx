// import React, { useState, useEffect } from 'react';
// import { Chessboard } from 'react-chessboard';
// import { Chess } from 'chess.js';

// export default function ChessQuiz() {
//   const [game, setGame] = useState(new Chess());
//   const [currentChallenge, setCurrentChallenge] = useState(null);
//   const [score, setScore] = useState(0);

//   // // Fetch a random position from your backend
//   // const fetchNewPosition = async () => {
//   //   const res = await fetch('/api/get-challenge');
//   //   const data = await res.json(); // returns { fen, correctMove }
//   //   setCurrentChallenge(data);
//   //   setGame(new Chess(data.fen)); // Load FEN into chess logic
//   // };

import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

export default function ChessQuiz() {
  const [game, setGame] = useState(new Chess());
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [score, setScore] = useState(0);
  const [boardKey, setBoardKey] = useState(0);
  const [status, setStatus] = useState('idle'); 
  const [highlightedSquare, setHighlightedSquare] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Fetch a random challenge configuration from your backend API
  const fetchNewChallenge = async () => {
    try {
      setLoading(true);
      setStatus('idle');
      setHighlightedSquare(null);

      // Adjust URL to match your server port or proxy setup (e.g., http://localhost:5000)
      const res = await fetch('http://127.0.0.1:5001/api/get-challenge');
      const data = await res.json(); 
      
      setCurrentChallenge(data);
      
      // Instantiate and load the fresh puzzle position into chess logic
      const chessInstance = new Chess(data.fen);
      setGame(chessInstance);
      setBoardKey(prev => prev + 1); // Redraws UI to match new state
      setLoading(false);
    } catch (error) {
      console.error("Error fetching challenge data from backend:", error);
      setLoading(false);
    }
  };

  // Run once when the component renders on screen
  useEffect(() => {
    fetchNewChallenge();
  }, []);

  function makeAMove(moveObj) {
    if (status !== 'idle' || !currentChallenge) return false;

    const gameCopy = new Chess(game.fen());
    
    try {
      const result = gameCopy.move(moveObj);
      
      if (result) {
        setGame(gameCopy);
        setHighlightedSquare(moveObj.to);

        if (result.san === currentChallenge.correctMove) {
          // --- SUCCESS PATH ---
          setStatus('correct');
          setScore(prev => prev + 1);
          
          setTimeout(() => {
            fetchNewChallenge(); // Load next puzzle from database
          }, 1500);

        } else {
          // --- FAILURE PATH ---
          setStatus('wrong');
          
          setTimeout(() => {
            // Snap back directly to the starting layout of this specific challenge
            const originalPosition = new Chess(currentChallenge.fen);
            setGame(originalPosition);
            setHighlightedSquare(null); 
            
            setTimeout(() => {
              // Execute the master move variables passed down from backend
              originalPosition.move({ 
                from: currentChallenge.fromSquare, 
                to: currentChallenge.toSquare 
              }); 
              setGame(originalPosition);
              setHighlightedSquare(currentChallenge.toSquare); 
              setStatus('showing-right-move');

              setTimeout(() => {
                fetchNewChallenge(); // Load next puzzle after showing answer
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

  function onDrop({ sourceSquare, targetSquare }) {
    return makeAMove({
      from: sourceSquare,
      to: targetSquare,
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
    }
  }

  const chessboardOptions = {
    id: "chess-guessr-board",
    position: game.fen(), 
    onPieceDrop: onDrop, 
    orientation: game.turn() === 'w' ? 'white' : 'black',
    customSquareStyles: customSquareStyles
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
      </div>
      
      <div style={{ boxShadow: '0 4px 10px rgba(0,0,0,0.15)', borderRadius: '8px', overflow: 'hidden' }}>
        <Chessboard 
          key={boardKey}
          options={chessboardOptions} 
        />
      </div>
      
      <p style={{ marginTop: '15px', color: '#666' }}>
        It is <strong>{game.turn() === 'w' ? 'White' : 'Black'} to move</strong>. Find the best continuation!
      </p>
    </div>
  );
}