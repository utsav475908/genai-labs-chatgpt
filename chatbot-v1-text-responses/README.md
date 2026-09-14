# MyAI - ChatGPT-style starter

## Requirements
- macOS/Linux/Windows
- Python 3.10+
- Node.js 18+
- OpenAI API key

## Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and add your API key
uvicorn main:app --reload --port 8000
```

## Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:3000

If your API account does not expose `gpt-5.6-luna`, change `OPENAI_MODEL` in `backend/.env` to a model available to your account.

## Security
Never commit `.env` or expose your API key in frontend JavaScript.
