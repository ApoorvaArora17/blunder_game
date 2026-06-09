import io
import random
import chess
import chess.pgn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
import pickle



app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


with open("june_games_pgn.pkl", "rb") as file:
    MY_GAMES_LIST = pickle.load(file)



@app.get("/api/get-challenge")
def get_challenge():
    try:
        if not MY_GAMES_LIST:
            return {"error": "Your game list is empty."}
            
        # 1. Grab a completely random raw string from your list
        raw_pgn_string = random.choice(MY_GAMES_LIST)
        
        # 2. Convert the raw text string into a file-like stream object
        pgn_stream = io.StringIO(raw_pgn_string)
        game = chess.pgn.read_game(pgn_stream)
        
        if game is None:
            return {"error": "Failed to parse the chosen PGN string."}

        # 3. Compile the list of main line moves played in this match
        all_moves = list(game.mainline_moves())
        
        # 4. Enforce tactical puzzle bounds
        # We skip the first 6 half-moves (opening phase) and guarantee 
        # at least 2 moves remain so there's an active continuation line.
        min_ply = min(6, len(all_moves) - 1)
        max_ply = len(all_moves) - 2
        
        if max_ply < min_ply:
            random_ply = len(all_moves) // 2
        else:
            random_ply = random.randint(min_ply, max_ply)
            
        if not all_moves:
            return {"error": "The selected game contains no move notation history."}

        # 5. Play out the game logic up to our target split point
        board = game.board()
        for i in range(random_ply):
            board.push(all_moves[i])
            
        # Freeze the layout and convert it to FEN string metadata
        puzzle_fen = board.fen()
        
        # 6. Extract the winning continuation move details
        correct_move_obj = all_moves[random_ply]
        correct_move_san = board.san(correct_move_obj) # e.g., "Nxe5", "Qc2+"
        
        from_square = chess.square_name(correct_move_obj.from_square) # e.g., "c6"
        to_square = chess.square_name(correct_move_obj.to_square)     # e.g., "e5"
        
        # 7. Collect game header tags for frontend layout details
        white_player = game.headers.get("White", "White Player")
        black_player = game.headers.get("Black", "Black Player")
        event_name = game.headers.get("Event", "Custom Game")

        return {
            "fen": puzzle_fen,
            "correctMove": correct_move_san,
            "fromSquare": from_square,
            "toSquare": to_square,
            "metadata": {
                "white": white_player,
                "black": black_player,
                "event": event_name,
                "moveNumber": (random_ply // 2) + 1
            }
        }
        
    except Exception as e:
        print(f"Error structuring puzzle data payload: {e}")
        return {"error": "An internal parsing step encountered an issue."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)