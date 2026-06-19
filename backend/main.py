import io
import random
import chess
import chess.pgn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
import pandas as pd
import pickle

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Read the CSV file
BLUNDER_DATASET = pd.read_csv('blunder_dataset.csv')

@app.get("/api/get-challenge")
def get_challenge():
    try:
        # Check if the DataFrame is empty correctly using .empty
        if BLUNDER_DATASET.empty:
            return {"error": "Your game list is empty."}
            
        # Convert rows to a list of dictionaries so random.choice works perfectly
        records = BLUNDER_DATASET.to_dict(orient='records')
        random_blunder = random.choice(records)
        
        # Added the vital 'return' keyword here!
        return {
            "fenBefore": str(random_blunder.get('fenBefore', '')),
            "fenAfter": str(random_blunder.get('fenAfter', '')),
            "blunderMove": str(random_blunder.get('blunderMove', '')),
            "prevMove": str(random_blunder.get('prevMove', '')),
            "fromSquare": str(random_blunder.get('fromSquare', '')),
            "toSquare": str(random_blunder.get('toSquare', '')),
            "preFrom": str(random_blunder.get('preFrom', '')),
            "preTo": str(random_blunder.get('preTo', '')),
            "eval_preFrom": str(random_blunder.get('eval_preFrom', '0.0')),
            "eval_from": str(random_blunder.get('eval_from', '0.0')),
            "eval_after": str(random_blunder.get('eval_after', '0.0')),
            "preFrom_time_white": str(random_blunder.get('preFrom_time_white', "10:00")),
            "preFrom_time_black": str(random_blunder.get('preFrom_time_black', "10:00")),
            "from_time_white": str(random_blunder.get('from_time_white', "10:00")),
            "from_time_black": str(random_blunder.get('from_time_black', "10:00")),
            "after_time_white": str(random_blunder.get('after_time_white', "10:00")),
            "after_time_black": str(random_blunder.get('after_time_black', "10:00")),
            "white_player": str(random_blunder.get('white_player', 'White Player')),
            "black_player": str(random_blunder.get('black_player', 'Black Player')),
            "time_class": str(random_blunder.get('time_class', 'blitz'))
        }
        
    except Exception as e:
        print(f"Error structuring puzzle data payload: {e}")
        return {"error": f"An internal parsing step encountered an issue: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
