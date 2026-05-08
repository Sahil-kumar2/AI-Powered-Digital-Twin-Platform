import hashlib
import json
import math
import os
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
import logging

import httpx
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from pinecone import Pinecone
except Exception:  # pragma: no cover
    Pinecone = None


load_dotenv(override=True)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "digital-twin-kb")
PINECONE_NAMESPACE = os.getenv("PINECONE_NAMESPACE", "global")
PINECONE_AUTO_CREATE = os.getenv("PINECONE_AUTO_CREATE", "false").lower() in {"1", "true", "yes"}
PINECONE_CLOUD = os.getenv("PINECONE_CLOUD", "")
PINECONE_REGION = os.getenv("PINECONE_REGION", "")
EMBED_DIM = int(os.getenv("EMBED_DIM", "384"))

logger = logging.getLogger("ai-service")

app = FastAPI(title="Digital Twin AI Service", version="1.0.0")


class TelemetryPoint(BaseModel):
    componentId: str
    metric: str
    value: float
    timestamp: datetime


class AnomalyRequest(BaseModel):
    systemId: str
    telemetry: List[TelemetryPoint]
    window: int = Field(default=50, ge=20, le=500)


class FailurePredictionRequest(BaseModel):
    systemId: str
    telemetry: List[TelemetryPoint]
    horizonMinutes: int = Field(default=240, ge=30, le=1440)


class KnowledgeDocument(BaseModel):
    id: Optional[str] = None
    text: str = Field(min_length=2)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class KnowledgeUpsertRequest(BaseModel):
    namespace: Optional[str] = None
    documents: List[KnowledgeDocument]


class KnowledgeSearchRequest(BaseModel):
    query: str
    namespace: Optional[str] = None
    topK: int = Field(default=4, ge=1, le=20)


class AskLlmRequest(BaseModel):
    question: str
    systemContext: Optional[Dict[str, Any]] = None
    knowledgeContext: List[str] = Field(default_factory=list)
    temperature: float = Field(default=0.2, ge=0.0, le=1.0)


class ScenarioComponent(BaseModel):
    id: str
    name: str
    type: str


class ScenarioSuggestRequest(BaseModel):
    systemId: str
    telemetry: List[TelemetryPoint]
    components: List[ScenarioComponent]


def _local_embedding(text: str, dim: int = EMBED_DIM) -> List[float]:
    vec = np.zeros(dim, dtype=np.float32)
    tokens = text.lower().split()
    if not tokens:
        return vec.tolist()
    for token in tokens:
        h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        sign = -1.0 if (h >> 8) % 2 else 1.0
        vec[idx] += sign
    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec /= norm
    return vec.tolist()


class PineconeStore:
    def __init__(self):
        self.enabled = bool(PINECONE_API_KEY and Pinecone)
        self._memory: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.client = None
        self.index = None
        self.status = "fallback_memory"

        if self.enabled:
            try:
                self.client = Pinecone(api_key=PINECONE_API_KEY)

                # Fast path when index already exists.
                self.index = self.client.Index(PINECONE_INDEX)

                # Probe quickly so missing resources fail here and can fallback cleanly.
                self.index.describe_index_stats()
                self.status = "configured"
            except Exception as exc:
                if PINECONE_AUTO_CREATE and PINECONE_CLOUD and PINECONE_REGION:
                    try:
                        self.client.create_index(
                            name=PINECONE_INDEX,
                            dimension=EMBED_DIM,
                            metric="cosine",
                            spec={
                                "serverless": {
                                    "cloud": PINECONE_CLOUD,
                                    "region": PINECONE_REGION,
                                }
                            },
                        )
                        self.index = self.client.Index(PINECONE_INDEX)
                        self.status = "configured"
                        logger.info("Pinecone index auto-created: %s", PINECONE_INDEX)
                    except Exception as create_exc:
                        self.index = None
                        self.status = "fallback_memory"
                        logger.warning(
                            "Pinecone unavailable (auto-create failed). Using in-memory fallback. error=%s",
                            create_exc,
                        )
                else:
                    self.index = None
                    self.status = "fallback_memory"
                    logger.warning(
                        "Pinecone unavailable (index missing or unreachable). Using in-memory fallback. error=%s",
                        exc,
                    )

    def upsert(self, namespace: str, docs: List[KnowledgeDocument]) -> int:
        vectors = []
        for d in docs:
            vid = d.id or hashlib.md5(f"{d.text}-{datetime.utcnow().isoformat()}".encode()).hexdigest()
            vectors.append(
                {
                    "id": vid,
                    "values": _local_embedding(d.text),
                    "metadata": {"text": d.text, **d.metadata},
                }
            )

        if self.index is not None:
            self.index.upsert(vectors=vectors, namespace=namespace)
        else:
            self._memory[namespace].extend(vectors)

        return len(vectors)

    def query(self, namespace: str, text: str, top_k: int) -> List[Dict[str, Any]]:
        query_vec = _local_embedding(text)

        if self.index is not None:
            result = self.index.query(
                namespace=namespace,
                vector=query_vec,
                top_k=top_k,
                include_metadata=True,
            )
            return [
                {
                    "id": m.get("id", ""),
                    "score": float(m.get("score", 0)),
                    "text": (m.get("metadata", {}) or {}).get("text", ""),
                    "metadata": m.get("metadata", {}) or {},
                }
                for m in result.get("matches", [])
            ]

        # Local fallback: cosine over in-memory vectors
        candidates = self._memory.get(namespace, [])
        scored: List[Dict[str, Any]] = []
        q = np.array(query_vec, dtype=np.float32)
        qn = np.linalg.norm(q)
        for c in candidates:
            v = np.array(c["values"], dtype=np.float32)
            denom = float(qn * np.linalg.norm(v)) or 1.0
            score = float(np.dot(q, v) / denom)
            scored.append(
                {
                    "id": c["id"],
                    "score": score,
                    "text": c.get("metadata", {}).get("text", ""),
                    "metadata": c.get("metadata", {}),
                }
            )

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]


vector_store = PineconeStore()


async def _groq_chat(messages: List[Dict[str, str]], temperature: float = 0.2) -> str:
    if not GROQ_API_KEY:
        return "Groq API key is not configured. Add GROQ_API_KEY in ai-service/.env."

    payload = {
        "model": GROQ_MODEL,
        "temperature": temperature,
        "messages": messages,
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    timeout = httpx.Timeout(20.0, connect=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(f"{GROQ_BASE_URL}/chat/completions", headers=headers, json=payload)
        if resp.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"Groq error: {resp.text}")
        data = resp.json()
        return data["choices"][0]["message"]["content"]


def _group_metric_series(telemetry: List[TelemetryPoint]) -> Dict[str, List[float]]:
    grouped: Dict[str, List[float]] = defaultdict(list)
    for t in telemetry:
        grouped[t.metric].append(float(t.value))
    return grouped


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "providers": {
            "groq": "configured" if GROQ_API_KEY else "missing_key",
            "pinecone": vector_store.status,
        },
    }


@app.post("/anomaly/detect")
def detect_anomaly(req: AnomalyRequest) -> Dict[str, Any]:
    if not req.telemetry:
        return {"systemId": req.systemId, "metricStats": [], "flaggedCount": 0, "isAnomalous": False}

    grouped = _group_metric_series(req.telemetry)
    stats = []
    flagged_count = 0

    for metric, series in grouped.items():
        if len(series) < 10:
            continue

        latest = series[-1]
        baseline = series[-req.window :] if len(series) > req.window else series
        mean = float(np.mean(baseline[:-1] if len(baseline) > 1 else baseline))
        std = float(np.std(baseline[:-1] if len(baseline) > 1 else baseline))
        std = std if std > 1e-6 else 1e-6

        z = abs((latest - mean) / std)
        score = 1.0 - math.exp(-0.5 * z)
        flagged = z >= 2.8 or score >= 0.85
        if flagged:
            flagged_count += 1

        stats.append(
            {
                "metric": metric,
                "latest": latest,
                "zScore": round(z, 4),
                "anomalyScore": round(float(min(score, 0.999)), 4),
                "flagged": flagged,
            }
        )

    return {
        "systemId": req.systemId,
        "metricStats": sorted(stats, key=lambda x: x["anomalyScore"], reverse=True),
        "flaggedCount": flagged_count,
        "isAnomalous": flagged_count > 0,
    }


@app.post("/failure/predict")
def predict_failure(req: FailurePredictionRequest) -> Dict[str, Any]:
    if not req.telemetry:
        return {
            "systemId": req.systemId,
            "failureProbability": 0.0,
            "riskLevel": "low",
            "horizonMinutes": req.horizonMinutes,
            "factors": [],
        }

    grouped = _group_metric_series(req.telemetry)
    factors = []
    risk_acc = 0.0

    for metric, series in grouped.items():
        if len(series) < 6:
            continue

        arr = np.array(series[-40:], dtype=np.float64)
        latest = float(arr[-1])

        x = np.arange(len(arr), dtype=np.float64)
        slope = float(np.polyfit(x, arr, 1)[0]) if len(arr) > 3 else 0.0

        volatility = float(np.std(arr))
        baseline = float(np.mean(arr[:-1])) if len(arr) > 1 else latest

        drift_score = abs(slope) / (abs(baseline) + 1e-6)
        volatility_score = volatility / (abs(baseline) + 1.0)
        latest_shift = abs(latest - baseline) / (abs(baseline) + 1.0)

        impact = min(1.0, 0.45 * drift_score + 0.35 * volatility_score + 0.2 * latest_shift)
        risk_acc += impact

        factors.append({"metric": metric, "impact": round(float(impact), 4), "latest": round(latest, 4)})

    if not factors:
        probability = 0.08
    else:
        probability = min(0.995, risk_acc / max(len(factors), 1) * 1.4)

    if probability >= 0.9:
        risk = "critical"
    elif probability >= 0.7:
        risk = "high"
    elif probability >= 0.4:
        risk = "medium"
    else:
        risk = "low"

    factors.sort(key=lambda x: x["impact"], reverse=True)

    return {
        "systemId": req.systemId,
        "failureProbability": round(float(probability), 4),
        "riskLevel": risk,
        "horizonMinutes": req.horizonMinutes,
        "factors": factors[:8],
    }


@app.post("/knowledge/upsert")
def knowledge_upsert(req: KnowledgeUpsertRequest) -> Dict[str, Any]:
    if not req.documents:
        raise HTTPException(status_code=400, detail="documents cannot be empty")

    namespace = req.namespace or PINECONE_NAMESPACE
    upserted = vector_store.upsert(namespace=namespace, docs=req.documents)
    return {"upserted": upserted, "namespace": namespace}


@app.post("/knowledge/search")
def knowledge_search(req: KnowledgeSearchRequest) -> Dict[str, Any]:
    namespace = req.namespace or PINECONE_NAMESPACE
    matches = vector_store.query(namespace=namespace, text=req.query, top_k=req.topK)
    return {"matches": matches}


@app.post("/llm/ask")
async def ask_llm(req: AskLlmRequest) -> Dict[str, Any]:
    sys_parts = []
    if req.systemContext:
        sys_parts.append(json.dumps(req.systemContext))
    if req.knowledgeContext:
        joined = "\n\n".join([f"Context {i+1}: {ctx}" for i, ctx in enumerate(req.knowledgeContext[:8])])
        sys_parts.append(joined)

    system_prompt = (
        "You are a senior digital twin reliability engineer. "
        "Answer with practical, safety-aware recommendations. "
        "If context is incomplete, state assumptions explicitly."
    )
    if sys_parts:
        system_prompt += "\n\nAvailable context:\n" + "\n\n".join(sys_parts)

    content = await _groq_chat(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": req.question},
        ],
        temperature=req.temperature,
    )

    return {"answer": content, "model": GROQ_MODEL}


@app.post("/scenario/suggest")
async def scenario_suggest(req: ScenarioSuggestRequest) -> Dict[str, Any]:
    anomaly = detect_anomaly(AnomalyRequest(systemId=req.systemId, telemetry=req.telemetry))
    failure = predict_failure(FailurePredictionRequest(systemId=req.systemId, telemetry=req.telemetry, horizonMinutes=180))

    components_lookup = {c.id: c for c in req.components}
    top_metric = anomaly["metricStats"][0]["metric"] if anomaly["metricStats"] else "temperature"

    # Heuristic baseline suggestion for deterministic response.
    default_target = req.components[0].id if req.components else "unknown"
    suggestions = [
        {
            "type": "component_overheat" if top_metric in {"temperature", "cpu_temp", "heat"} else "signal_noise",
            "targetComponentId": default_target,
            "severity": min(1.0, 0.45 + float(failure["failureProbability"]) * 0.6),
            "durationTicks": 25,
            "rationale": f"Top anomalous metric is {top_metric}; simulated stress test can validate resilience.",
        }
    ]

    # Optional LLM refinement if Groq is configured.
    if GROQ_API_KEY and req.components:
        compact = {
            "anomaly": anomaly,
            "failure": failure,
            "components": [c.model_dump() for c in req.components[:20]],
        }
        prompt = (
            "Generate up to 3 scenario suggestions as JSON array. "
            "Each item must contain: type (one of sensor_failure, signal_noise, voltage_drop, "
            "motor_overload, network_delay, component_overheat), targetComponentId, severity (0-1), "
            "durationTicks (>0), rationale.\n"
            f"Data:\n{json.dumps(compact)}"
        )
        try:
            raw = await _groq_chat(
                [
                    {"role": "system", "content": "Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
            )
            parsed = json.loads(raw)
            validated = []
            allowed = {
                "sensor_failure",
                "signal_noise",
                "voltage_drop",
                "motor_overload",
                "network_delay",
                "component_overheat",
            }
            for item in parsed[:3]:
                target_id = item.get("targetComponentId")
                if target_id not in components_lookup:
                    continue
                scenario_type = item.get("type")
                if scenario_type not in allowed:
                    continue
                severity = float(item.get("severity", 0.7))
                duration = int(item.get("durationTicks", 20))
                validated.append(
                    {
                        "type": scenario_type,
                        "targetComponentId": target_id,
                        "severity": max(0.0, min(1.0, severity)),
                        "durationTicks": max(1, duration),
                        "rationale": str(item.get("rationale", "AI-generated recommendation.")),
                    }
                )
            if validated:
                suggestions = validated
        except Exception:
            pass

    return {"systemId": req.systemId, "suggestions": suggestions}
