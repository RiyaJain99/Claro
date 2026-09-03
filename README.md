<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:6366F1,100:22D3EE&height=220&section=header&text=Claro&fontSize=80&fontColor=ffffff&fontAlignY=38&desc=AI%20Email%20Intelligence%20Platform&descAlignY=58&descSize=20&animation=fadeIn" width="100%"/>

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&duration=2600&pause=900&color=6366F1&center=true&vCenter=true&width=640&lines=Your+inbox%2C+finally+clear.;Gmail+%2B+Groq+Llama+3.1+%2B+FastAPI;Classify.+Summarize.+Draft.+Send.;Human-in-the-loop%2C+not+black-box." />

<br/>

[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](.)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](.)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](.)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](.)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.1-F55036?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEyIDJMMiAyMmgyMHoiLz48L3N2Zz4=&logoColor=white)](.)
[![Gmail API](https://img.shields.io/badge/Gmail_API-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](.)

</div>

<br/>

## What is this

**Claro** connects to Gmail and uses an LLM to triage your inbox for you — every email gets classified into one of 18 intent-aware categories, tagged with a priority, summarized in a sentence, and (if it needs one) given a one-click AI-drafted reply. No emails leave your machine; the SQLite DB is local and read-only Gmail scopes are the default.

<div align="center">
<table>
<tr>
<td width="33%" align="center">🧠<br/><b>AI Classification</b><br/><sub>18 categories · priority · confidence</sub></td>
<td width="33%" align="center">⚡<br/><b>Smart Replies</b><br/><sub>one-click AI drafts, sent via Gmail</sub></td>
<td width="33%" align="center">🛡️<br/><b>Private by default</b><br/><sub>local SQLite · read-only scopes</sub></td>
</tr>
</table>
</div>

## How it decides

Claro doesn't send every email to the LLM. A regex pre-filter catches the obvious stuff (newsletters, promos, shipping notices) in ~5ms; everything ambiguous goes to Groq's `openai/gpt-oss-20b` with a structured JSON schema (category, priority, confidence, summary, suggestion, `requires_reply`, `follow_up_needed`). When you correct a bad label, that correction is stored and replayed to the model as a few-shot example on every future call — the classifier improves per-user with zero fine-tuning.

```mermaid
flowchart LR
    A[Gmail API] -->|fetch| B[FastAPI backend]
    B -->|cache| C[(SQLite)]
    B -->|ambiguous email| D[Groq · Llama 3.1]
    D -->|category · priority · summary| B
    B -->|REST + CORS| E[React / Vite frontend]
    E -->|correction| B
    B -->|few-shot examples| D
```

## Stack

<div align="center">
<img src="https://go-skill-icons.vercel.app/api/icons?i=react,typescript,vite,tailwind,fastapi,python,sqlite,gmail" />
</div>

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts |
| Backend | FastAPI, SQLAlchemy, Pydantic |
| AI | Groq (`openai/gpt-oss-20b`), rule-based pre-filter |
| Data | Gmail API (OAuth2, PKCE), SQLite |

## Getting started

```bash
# backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example app/.env        # add your GROQ_API_KEY
uvicorn app.main:app --reload --port 8001

# frontend
cd frontend
npm install
npm run dev -- --port 5174
```

Open `http://localhost:5174` and click **Connect Gmail to get started**. Without a `credentials.json`, the app falls back to a mock demo session automatically.

## API surface

```
GET   /health
GET   /auth/login   /auth/callback   /auth/status   POST /auth/logout
GET   /emails                     GET /emails/analytics
POST  /emails/classify            POST /emails/bulk-classify
POST  /emails/draft-reply         GET  /emails/drafts/{id}
POST  /emails/create-draft        POST /emails/send
POST  /emails/feedback            GET  /emails/feedback/stats
```

<div align="center">
<br/>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:22D3EE,100:6366F1&height=120&section=footer" width="100%"/>

</div>
