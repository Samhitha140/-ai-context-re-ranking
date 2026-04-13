<<<<<<< HEAD
# 🔍 AI Contextual Search Re-Ranker

An AI-powered search system that **personalizes top 10 results based on who you are**.
100% free APIs — no credit card needed for either.

**How it works:**
1. User picks their persona (student, researcher, developer, etc.)
2. Tavily fetches 20 real live web results
3. Gemini AI re-ranks them for that persona's specific needs
4. Top 10 personalized results shown with persona-specific explanations

---

## 🆓 Both APIs Are Free — No Credit Card

| API | What it does | Free Tier | Card? | Get Key |
|-----|-------------|-----------|-------|---------|
| **Tavily** | Fetches real web results | 1,000 searches/month | ❌ No | [tavily.com](https://tavily.com) |
| **Gemini** | AI re-ranking | 250 requests/day | ❌ No | [aistudio.google.com](https://aistudio.google.com/app/apikey) |

---

## 🚀 Setup in VS Code

### Step 1 — Get your free API keys

**Tavily (free, no card):**
1. Go to [tavily.com](https://tavily.com)
2. Click "Get API Key" → sign up with email or Google
3. Copy your key — it starts with `tvly-`

**Gemini (free, no card):**
1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key" → copy it

---

### Step 2 — Open in VS Code

1. Unzip the project folder
2. In VS Code: **File → Open Folder** → select `smart-search`

---

### Step 3 — Add your keys

In VS Code, open `backend/` folder:
- Copy `.env.example` → rename the copy to `.env`
- Edit `.env`:

```
TAVILY_API_KEY=tvly-YOUR_ACTUAL_KEY
GEMINI_API_KEY=YOUR_ACTUAL_GEMINI_KEY
PORT=3001
```

In VS Code, open `frontend/` folder:
- Copy `.env.example` → rename copy to `.env`
- Leave it as is (or update if deploying)

---

### Step 4 — Install dependencies

Open VS Code terminal (`Ctrl + backtick`):

```bash
cd backend
npm install
```

Click the `+` to open a second terminal:

```bash
cd frontend
npm install
```

---

### Step 5 — Run the app

**Terminal 1:**
```bash
cd backend
npm start
```
→ You'll see: `🚀 Smart Search backend running on http://localhost:3001`

**Terminal 2:**
```bash
cd frontend
npm run dev
```
→ You'll see: `Local: http://localhost:3000`

Open your browser at **http://localhost:3000** — done!

---

## ☁️ Deploy (Free)

**Vercel (recommended):**
```bash
npm install -g vercel
cd backend && vercel   # deploy backend, add env vars in Vercel dashboard
cd ../frontend && vercel  # deploy frontend, set VITE_BACKEND_URL to backend URL
```

**Netlify + Railway** also work — see original guide.

---

## 📁 Structure

```
smart-search/
├── backend/
│   ├── server.js        ← Express server (Tavily + Gemini)
│   ├── package.json
│   └── .env.example     ← Copy to .env and fill in your keys
├── frontend/
│   ├── src/
│   │   ├── App.jsx      ← Main React UI
│   │   └── App.css
│   ├── vite.config.js
│   └── .env.example
└── README.md
```

---

## 💡 Personas

| Persona | AI prioritizes |
|---------|---------------|
| 🎓 Student | Free tools, tutorials, beginner content |
| 🔬 Researcher | Academic papers, arXiv, peer-reviewed |
| 💼 Professional | Enterprise tools, ROI, case studies |
| 💻 Developer | Docs, GitHub, APIs, code examples |
| 🚀 Entrepreneur | Lean tools, growth resources |
| 🎨 Creative | Design tools, free assets, inspiration |
| 📚 Educator | Classroom tools, free edu platforms |
| 🎯 Job Seeker | Job boards, resume tools, interview prep |

---

Built with Tavily Search API (free) + Google Gemini API (free)
=======
# -ai-context-re-ranking
>>>>>>> 7fbe055b8b747d32eebfe5d49f187f95236dc679
