# AI Service (FastAPI)

This service powers Phase 4 and Phase 5 capabilities:
- Real-time anomaly detection
- Failure probability prediction
- Pinecone-backed knowledge retrieval
- Groq LLM reasoning and scenario suggestions

## 1) Environment

Set values in `.env`:

- `GROQ_API_KEY`
- `GROQ_BASE_URL` (default: `https://api.groq.com/openai/v1`)
- `GROQ_MODEL` (default: `llama-3.3-70b-versatile`)
- `PINECONE_API_KEY`
- `PINECONE_INDEX`
- `PINECONE_NAMESPACE`

If Pinecone is not configured, a local in-memory vector fallback is used.

## 2) Install

```powershell
cd ai-service
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 3) Run

```powershell
cd ai-service
.\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## 4) Key Endpoints

- `GET /health`
- `POST /anomaly/detect`
- `POST /failure/predict`
- `POST /knowledge/upsert`
- `POST /knowledge/search`
- `POST /llm/ask`
- `POST /scenario/suggest`
