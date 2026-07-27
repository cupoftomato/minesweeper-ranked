:root {
  --bg-color: #0f172a;
  --panel-bg: #1e293b;
  --text-main: #f8fafc;
  --accent: #38bdf8;
  --danger: #ef4444;
  --success: #22c55e;
  --gold: #fbbf24;
  --cell-bg: #334155;
  --cell-hover: #475569;
  --cell-open: #0f172a;
  --border: #0f172a;
}

* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; user-select: none; }
body { background-color: var(--bg-color); color: var(--text-main); display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
.hidden { display: none !important; }

/* LOGO */
.logo { text-align: center; margin-bottom: 2rem; }
.logo h1 { font-size: 3rem; letter-spacing: 2px; }
.logo .ranked { color: var(--accent); text-shadow: 0 0 10px rgba(56, 189, 248, 0.5); }
.accent-text { color: var(--accent); font-weight: bold; }
.gold-text { color: var(--gold); font-weight: bold; }

/* AUTH SCREEN */
#auth-screen { text-align: center; }
.auth-box { background: var(--panel-bg); padding: 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); min-width: 350px; }
.auth-box h2 { margin-bottom: 1.5rem; }
.auth-box input { width: 100%; padding: 12px; font-size: 1.1rem; border-radius: 6px; border: 2px solid #334155; background: var(--bg-color); color: #fff; margin-bottom: 1rem; outline: none; transition: border 0.2s; }
.auth-box input:focus { border-color: var(--accent); }
.auth-buttons { display: flex; gap: 10px; margin-top: 10px; }
.btn-primary, .btn-secondary, .btn-danger { flex: 1; padding: 12px; font-size: 1.1rem; font-weight: bold; border-radius: 6px; cursor: pointer; border: none; transition: transform 0.1s, box-shadow 0.2s; }
.btn-primary { background: var(--accent); color: #000; }
.btn-primary:hover { transform: scale(1.05); box-shadow: 0 0 15px var(--accent); }
.btn-secondary { background: var(--cell-bg); color: #fff; }
.btn-secondary:hover { transform: scale(1.05); background: var(--cell-hover); }
.btn-danger { background: transparent; color: var(--danger); border: 2px solid var(--danger); }
.btn-danger:hover { background: var(--danger); color: #fff; box-shadow: 0 0 15px var(--danger); }

/* LOBBY SCREEN */
#lobby-screen { text-align: center; }
.lobby-box { background: var(--panel-bg); padding: 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); min-width: 350px; }
.user-profile { font-size: 1.2rem; margin-bottom: 20px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; border: 1px solid var(--accent); position: relative; }
.btn-logout { position: absolute; top: 15px; right: 15px; background: transparent; border: 1px solid var(--danger); color: var(--danger); border-radius: 4px; padding: 4px 8px; cursor: pointer; transition: 0.2s; }
.btn-logout:hover { background: var(--danger); color: #fff; }

.btn-mode { width: 100%; padding: 15px 20px; font-size: 1.2rem; border: none; font-weight: bold; border-radius: 8px; cursor: pointer; transition: transform 0.1s, box-shadow 0.2s; margin-bottom: 15px; }
.normal-btn { background: var(--cell-hover); color: #fff; border: 2px solid var(--accent); }
.normal-btn:hover { transform: scale(1.05); box-shadow: 0 0 15px var(--accent); }
.ranked-btn { background: #332701; color: var(--gold); border: 2px solid var(--gold); }
.ranked-btn:hover { transform: scale(1.05); box-shadow: 0 0 15px var(--gold); }

#matchmaking-status { display: flex; flex-direction: column; align-items: center; }
.spinner { width: 40px; height: 40px; border: 4px solid rgba(255, 255, 255, 0.1); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px; }
@keyframes spin { 100% { transform: rotate(360deg); } }
#status-text { font-size: 1.2rem; margin-bottom: 15px; }
#btnCancel { padding: 8px 15px; background: transparent; border: 1px solid var(--danger); color: var(--danger); border-radius: 4px; cursor: pointer; }
.error { color: var(--danger); margin-top: 10px; font-weight: bold; }

/* INTERMISSION SCREEN */
#intermission-screen { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; z-index: 100; overflow: hidden;}
.seed-bg { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-size: cover; background-position: center; filter: blur(5px); opacity: 0.8; z-index: -1; transition: background-image 1s ease; }
.seed-bg.seed-Open { background-image: url('images/seed_Open.png'); }
.seed-bg.seed-Isolated { background-image: url('images/seed_Isolated.png'); }
.seed-bg.seed-Edge-Heavy { background-image: url('images/seed_Edge-Heavy.png'); }
.seed-bg.seed-Center-Heavy { background-image: url('images/seed_Center-Heavy.png'); }
.seed-bg.seed-Linear { background-image: url('images/seed_Linear.png'); }
.seed-bg.seed-Symmetric { background-image: url('images/seed_Symmetric.png'); }
.seed-bg.seed-Trap { background-image: url('images/seed_Trap.png'); }

.intermission-content { text-align: center; background: rgba(30, 41, 59, 0.85); padding: 3rem; border-radius: 16px; border: 2px solid var(--accent); box-shadow: 0 0 30px rgba(0,0,0,0.8); }
.intermission-content h2 { font-size: 2.5rem; color: var(--accent); margin-bottom: 20px; text-shadow: 0 0 15px var(--accent); }
.vs-banner { display: flex; justify-content: space-around; align-items: center; font-size: 1.5rem; font-weight: bold; margin-bottom: 30px; }
.vs-vs { font-size: 2rem; color: var(--danger); font-style: italic; }
.seed-info-box { margin-bottom: 30px; }
.seed-info-box h3 { font-size: 1rem; color: #94a3b8; }
.seed-name { font-size: 2.5rem; font-weight: bold; color: var(--gold); text-shadow: 0 0 15px var(--gold); text-transform: uppercase; letter-spacing: 3px;}
.timer-box { font-size: 1.2rem; margin-bottom: 30px; }
#intermission-timer { font-size: 3rem; font-weight: bold; color: #fff; }
.vote-box { display: flex; flex-direction: column; align-items: center; gap: 10px; }
#vote-status-text { font-size: 1rem; color: #94a3b8; }

/* GAME SCREEN */
#game-screen { width: 100%; max-width: 800px; display: flex; flex-direction: column; align-items: center; position: relative; }
.hud { display: flex; width: 100%; justify-content: space-between; align-items: center; background: var(--panel-bg); padding: 10px 20px; border-radius: 8px; margin-bottom: 20px; }
.player-info { text-align: center; font-weight: bold; min-width: 150px; }
.p1-info { color: var(--success); }
.p2-info { color: var(--danger); }
#my-elo, #opp-elo { font-size: 0.9rem; color: var(--gold); margin-left: 5px; }
.tug-of-war { flex-grow: 1; height: 12px; background: #000; margin: 0 20px; border-radius: 6px; display: flex; overflow: hidden; position: relative; border: 1px solid #444; }
#p1-bar { background: var(--success); transition: width 0.3s ease-out; }
#p2-bar { background: var(--danger); transition: width 0.3s ease-out; }
.timer { font-size: 2rem; font-family: monospace; font-weight: bold; color: var(--accent); margin-bottom: 20px; text-shadow: 0 0 10px rgba(56, 189, 248, 0.5); }
.board-container { position: relative; background: var(--border); padding: 4px; border-radius: 8px; box-shadow: 0 15px 35px rgba(0,0,0,0.6); }
#minesweeper-board { display: grid; gap: 2px; background: var(--border); }
.cell { width: 32px; height: 32px; background: var(--cell-bg); display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 1.2rem; cursor: pointer; border-radius: 2px; transition: background 0.1s; }
.cell:hover { background: var(--cell-hover); }
.cell.open { background: var(--cell-open); cursor: default; box-shadow: inset 0 0 5px rgba(0,0,0,0.5); }
.cell.flag { color: var(--danger); }
.val-1 { color: #3b82f6; } .val-2 { color: #22c55e; } .val-3 { color: #ef4444; } .val-4 { color: #a855f7; } .val-5 { color: #f97316; } .val-6 { color: #06b6d4; } .val-7 { color: #000000; } .val-8 { color: #6b7280; } .val--1 { color: var(--danger); font-size: 1.5rem; }
#freeze-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(239, 68, 68, 0.4); backdrop-filter: blur(4px); z-index: 10; display: flex; justify-content: center; align-items: center; font-size: 2rem; font-weight: bold; color: #fff; text-shadow: 0 2px 10px #000; border-radius: 8px; }

@keyframes shake { 0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 30% { transform: translate(3px, 2px) rotate(0deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 50% { transform: translate(-1px, 2px) rotate(-1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { transform: translate(3px, 1px) rotate(-1deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 90% { transform: translate(1px, 2px) rotate(0deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } }
.shake { animation: shake 0.5s; }
@keyframes ping { 0% { background: rgba(239, 68, 68, 0.8); } 100% { background: var(--cell-bg); } }
.ping { animation: ping 0.5s ease-out; }
.message-banner { margin-top: 20px; padding: 15px 30px; background: var(--panel-bg); border: 2px solid var(--accent); border-radius: 8px; font-size: 1.5rem; font-weight: bold; text-align: center; }

/* CHAT BOX */
#chat-container { position: fixed; bottom: 20px; left: 20px; width: 300px; max-height: 400px; background: rgba(15, 23, 42, 0.8); border: 1px solid #334155; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; z-index: 50; }
#chat-messages { flex-grow: 1; padding: 10px; overflow-y: auto; max-height: 300px; display: flex; flex-direction: column; gap: 5px; }
.chat-msg { font-size: 0.9rem; word-wrap: break-word; }
.chat-user { font-weight: bold; color: var(--accent); }
.chat-sys { color: var(--gold); font-style: italic; }
#chat-input { width: 100%; padding: 10px; border: none; border-top: 1px solid #334155; background: rgba(30, 41, 59, 0.9); color: #fff; font-size: 0.9rem; outline: none; }
#chat-input:focus { background: rgba(30, 41, 59, 1); }
#chat-container.active { display: flex !important; }
