import { useState, useCallback, useRef } from "react";

const COLS = 8;
const ROWS = 8;
const MATCH = 4;

const GRAVITY_DIRS = ["down", "up", "left", "right"];
const DIR_LABEL = { down: "↓", up: "↑", left: "←", right: "→" };
const DIR_NAME  = { down: "下へ", up: "上へ", left: "左へ", right: "右へ" };
const DIR_COLOR = { down: "#a78bfa", up: "#f472b6", left: "#38bdf8", right: "#4ade80" };

const BALL_COLORS = ["#FF4757", "#FFD32A", "#2ED573", "#1E90FF", "#FF6EB4"];

function createEmpty() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}
function randomColor() { return BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)]; }
function randomDir()   { return GRAVITY_DIRS[Math.floor(Math.random() * GRAVITY_DIRS.length)]; }

function applyGravity(grid, dir) {
  const g = grid.map(r => [...r]);
  if (dir === "down") {
    for (let c = 0; c < COLS; c++) {
      let e = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (g[r][c]) { g[e][c] = g[r][c]; if (e !== r) g[r][c] = null; e--; }
      }
    }
  } else if (dir === "up") {
    for (let c = 0; c < COLS; c++) {
      let e = 0;
      for (let r = 0; r < ROWS; r++) {
        if (g[r][c]) { g[e][c] = g[r][c]; if (e !== r) g[r][c] = null; e++; }
      }
    }
  } else if (dir === "left") {
    for (let r = 0; r < ROWS; r++) {
      let e = 0;
      for (let c = 0; c < COLS; c++) {
        if (g[r][c]) { g[r][e] = g[r][c]; if (e !== c) g[r][c] = null; e++; }
      }
    }
  } else {
    for (let r = 0; r < ROWS; r++) {
      let e = COLS - 1;
      for (let c = COLS - 1; c >= 0; c--) {
        if (g[r][c]) { g[r][e] = g[r][c]; if (e !== c) g[r][c] = null; e--; }
      }
    }
  }
  return g;
}

function findMatches(grid) {
  const toRemove = new Set();
  let lines = 0;
  // 縦4個
  for (let c = 0; c < COLS; c++) {
    let run = 1;
    for (let r = 1; r < ROWS; r++) {
      if (grid[r][c] && grid[r][c] === grid[r-1][c]) { run++; }
      else {
        if (run >= MATCH) { lines++; for (let k = r-run; k < r; k++) toRemove.add(`${k},${c}`); }
        run = 1;
      }
    }
    if (run >= MATCH) { lines++; for (let k = ROWS-run; k < ROWS; k++) toRemove.add(`${k},${c}`); }
  }
  // 横4個
  for (let r = 0; r < ROWS; r++) {
    let run = 1;
    for (let c = 1; c < COLS; c++) {
      if (grid[r][c] && grid[r][c] === grid[r][c-1]) { run++; }
      else {
        if (run >= MATCH) { lines++; for (let k = c-run; k < c; k++) toRemove.add(`${r},${k}`); }
        run = 1;
      }
    }
    if (run >= MATCH) { lines++; for (let k = COLS-run; k < COLS; k++) toRemove.add(`${r},${k}`); }
  }
  return { toRemove, lines };
}

function removeMatches(grid, toRemove) {
  const g = grid.map(r => [...r]);
  for (const key of toRemove) {
    const [r, c] = key.split(",").map(Number);
    g[r][c] = null;
  }
  return g;
}

function isFull(grid) { return grid[0].every(cell => cell !== null); }

export default function GravityPuzzle() {
  const [grid, setGrid]           = useState(createEmpty());
  const [nextDir, setNextDir]     = useState(randomDir());
  const [nextColor, setNextColor] = useState(randomColor());
  const [score, setScore]         = useState(0);
  const [combo, setCombo]         = useState(0);
  const [gameOver, setGameOver]   = useState(false);
  const [clearing, setClearing]   = useState(new Set());
  const [processing, setProcessing] = useState(false);
  const [scorePopups, setScorePopups] = useState([]);
  const [lastDir, setLastDir]     = useState(null);
  const popupId = useRef(0);

  const addPopup = (text) => {
    const id = popupId.current++;
    setScorePopups(p => [...p, { id, text }]);
    setTimeout(() => setScorePopups(p => p.filter(pp => pp.id !== id)), 1000);
  };

  const processChain = useCallback((g, dir, chainCombo) => {
    const { toRemove, lines } = findMatches(g);
    if (toRemove.size === 0) {
      setGrid(g);
      setProcessing(false);
      return;
    }
    setClearing(toRemove);
    setTimeout(() => {
      const g2 = removeMatches(g, toRemove);
      const mult = 1 + chainCombo * 0.5;
      const gained = Math.round(lines * 100 * mult);
      setScore(s => s + gained);
      setCombo(chainCombo + 1);
      addPopup(`+${gained}${chainCombo > 0 ? ` ×${mult.toFixed(1)}` : ""}`);
      setClearing(new Set());
      const g3 = applyGravity(g2, dir);
      processChain(g3, dir, chainCombo + 1);
    }, 380);
  }, []);

  // 重力の反対方向からボールを置く
  // down/up → 列(col)を選択、left/right → 行(row)を選択
  const placeBall = useCallback((index) => {
    if (gameOver || processing) return;
    const dir = nextDir;
    const color = nextColor;
    const g = grid.map(r => [...r]);

    if (dir === "down") {
      // 上から落とす → 列indexの最初の空きrow
      let row = -1;
      for (let r = 0; r < ROWS; r++) { if (g[r][index] === null) { row = r; break; } }
      if (row === -1) return;
      g[row][index] = color;
    } else if (dir === "up") {
      // 下から置く → 列indexの最後の空きrow
      let row = -1;
      for (let r = ROWS - 1; r >= 0; r--) { if (g[r][index] === null) { row = r; break; } }
      if (row === -1) return;
      g[row][index] = color;
    } else if (dir === "left") {
      // 右から置く → 行indexの最後の空きcol
      let col = -1;
      for (let c = COLS - 1; c >= 0; c--) { if (g[index][c] === null) { col = c; break; } }
      if (col === -1) return;
      g[index][col] = color;
    } else {
      // right: 左から置く → 行indexの最初の空きcol
      let col = -1;
      for (let c = 0; c < COLS; c++) { if (g[index][c] === null) { col = c; break; } }
      if (col === -1) return;
      g[index][col] = color;
    }

    const g2 = applyGravity(g, dir);

    setLastDir(dir);
    setNextColor(randomColor());
    setNextDir(randomDir());
    setProcessing(true);
    setCombo(0);

    if (isFull(g2)) { setGrid(g2); setGameOver(true); setProcessing(false); return; }
    processChain(g2, dir, 0);
  }, [grid, nextColor, nextDir, gameOver, processing, processChain]);

  const reset = () => {
    setGrid(createEmpty());
    setNextDir(randomDir());
    setNextColor(randomColor());
    setScore(0); setCombo(0);
    setGameOver(false);
    setClearing(new Set());
    setScorePopups([]);
    setProcessing(false);
    setLastDir(null);
  };

  // Responsive cell size: fit 12 cols in screen width with padding
  const CELL = Math.floor((Math.min(typeof window !== "undefined" ? window.innerWidth : 390, 480) - 32) / COLS);
  const GAP  = 2;

  return (
    <div style={{
      minHeight: "100vh",
      minHeight: "100dvh",
      background: "linear-gradient(160deg, #0f0c29 0%, #302b63 60%, #24243e 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "'Fredoka One', cursive",
      overflowX: "hidden",
      paddingBottom: "16px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes popOut { 0%{transform:scale(1.4);opacity:1} 100%{transform:scale(0.7) translateY(-20px);opacity:0} }
        @keyframes scoreUp { 0%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0;transform:translateX(-50%) translateY(-50px)} }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-4px)} 40%,80%{transform:translateX(4px)} }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
        @keyframes dirBounce { 0%{transform:scale(1)} 40%{transform:scale(1.4)} 100%{transform:scale(1)} }
        .clearing { animation: popOut 0.35s ease-out forwards; }
        .combo-pulse { animation: pulse 0.5s ease-in-out infinite; }
        .gameover-shake { animation: shake 0.5s ease-in-out; }
        .dir-bounce { animation: dirBounce 0.4s ease-out; }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{
        width: "100%",
        maxWidth: "480px",
        padding: "10px 16px 8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
      }}>
        {/* Score */}
        <div style={topCardStyle}>
          <div style={topLabelStyle}>SCORE</div>
          <div style={{ color: "#fff", fontSize: "20px", fontWeight: 900, lineHeight: 1 }}>{score.toLocaleString()}</div>
        </div>

        {/* Title */}
        <div style={{
          fontSize: "15px", fontWeight: 900, letterSpacing: "1px", textAlign: "center", flex: 1,
          background: `linear-gradient(90deg, ${BALL_COLORS.join(",")})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>GRAVITY<br/>PUZZLE</div>

        {/* Combo */}
        <div className={combo > 1 ? "combo-pulse" : ""} style={{
          ...topCardStyle,
          background: combo > 1 ? "linear-gradient(135deg,#FF4757,#FF6EB4)" : "rgba(255,255,255,0.08)",
          transition: "background 0.3s",
          minWidth: "70px",
        }}>
          <div style={topLabelStyle}>COMBO</div>
          <div style={{ color: "#fff", fontSize: "20px", fontWeight: 900, lineHeight: 1 }}>
            {combo > 1 ? `×${combo}` : "—"}
          </div>
        </div>
      </div>

      {/* ── INFO BAR: NEXT ball + gravity ── */}
      <div style={{
        width: "100%",
        maxWidth: "480px",
        padding: "0 16px 8px",
        display: "flex",
        gap: "10px",
      }}>
        {/* Next ball */}
        <div style={{
          ...infoCardStyle,
          flex: 1,
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <div>
            <div style={topLabelStyle}>NEXT</div>
            <div style={{
              width: "34px", height: "34px", borderRadius: "50%",
              background: nextColor,
              boxShadow: `0 0 16px ${nextColor}aa, inset 0 3px 5px rgba(255,255,255,0.35)`,
              position: "relative", marginTop: "4px",
            }}>
              <div style={{ position:"absolute", top:"18%", left:"20%", width:"30%", height:"22%", borderRadius:"50%", background:"rgba(255,255,255,0.6)", transform:"rotate(-30deg)" }} />
            </div>
          </div>
          {/* divider */}
          <div style={{ width: "1px", height: "40px", background: "rgba(255,255,255,0.12)" }} />
          {/* gravity */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={topLabelStyle}>次の重力</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "2px" }}>
              <div style={{
                fontSize: "32px", lineHeight: 1,
                color: DIR_COLOR[nextDir],
                textShadow: `0 0 12px ${DIR_COLOR[nextDir]}`,
                animation: "floatY 1.8s ease-in-out infinite",
              }}>{DIR_LABEL[nextDir]}</div>
              <div style={{ color: DIR_COLOR[nextDir], fontSize: "16px", fontWeight: 900 }}>{DIR_NAME[nextDir]}</div>
            </div>
          </div>
        </div>

        {/* Last gravity applied */}
        {lastDir && (
          <div style={{ ...infoCardStyle, minWidth: "64px", textAlign: "center" }}>
            <div style={topLabelStyle}>前の重力</div>
            <div style={{
              fontSize: "26px", lineHeight: 1, marginTop: "4px",
              color: DIR_COLOR[lastDir],
              opacity: 0.6,
            }}>{DIR_LABEL[lastDir]}</div>
          </div>
        )}
      </div>

      {/* ── BOARD ── */}
      <div style={{ position: "relative", padding: "0 16px" }}>
        {/* 上から置く（down）インジケーター */}
        {nextDir === "down" && (
          <div style={{ display: "flex", gap: `${GAP}px`, padding: "0 6px", marginBottom: "3px" }}>
            {Array.from({ length: COLS }).map((_, c) => (
              <div key={c} onClick={() => placeBall(c)} style={{
                width: `${CELL}px`, height: "6px", borderRadius: "3px",
                background: DIR_COLOR["down"] + "99",
                cursor: gameOver || processing ? "default" : "pointer",
              }} />
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          {/* 右から置く（left）インジケーター */}
          {nextDir === "left" && (
            <div style={{ display: "flex", flexDirection: "column", gap: `${GAP}px`, padding: "6px 0", marginRight: "3px" }}>
              {Array.from({ length: ROWS }).map((_, r) => (
                <div key={r} onClick={() => placeBall(r)} style={{
                  width: "6px", height: `${CELL}px`, borderRadius: "3px",
                  background: DIR_COLOR["left"] + "99",
                  cursor: gameOver || processing ? "default" : "pointer",
                }} />
              ))}
            </div>
          )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
            gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
            gap: `${GAP}px`,
            background: "rgba(0,0,0,0.5)",
            borderRadius: "14px",
            padding: "6px",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            touchAction: "manipulation",
          }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const key = `${r},${c}`;
              const isClearing = clearing.has(key);
              // 列クリック(down/up)か行クリック(left/right)か
              const clickIndex = (nextDir === "down" || nextDir === "up") ? c : r;
              return (
                <div
                  key={key}
                  className={isClearing ? "clearing" : ""}
                  onClick={() => placeBall(clickIndex)}
                  style={{
                    width: `${CELL}px`, height: `${CELL}px`,
                    borderRadius: cell ? "50%" : "5px",
                    background: cell ? cell : "rgba(255,255,255,0.04)",
                    border: cell ? "none" : "1px solid rgba(255,255,255,0.06)",
                    boxShadow: cell
                      ? `0 0 10px ${cell}66, inset 0 2px 4px rgba(255,255,255,0.28)`
                      : "none",
                    position: "relative",
                    overflow: "hidden",
                    cursor: gameOver || processing ? "default" : "pointer",
                    transition: "background 0.1s",
                    userSelect: "none",
                  }}
                >
                  {cell && (
                    <div style={{
                      position: "absolute", top: "16%", left: "18%",
                      width: "30%", height: "22%", borderRadius: "50%",
                      background: "rgba(255,255,255,0.55)",
                      transform: "rotate(-30deg)",
                      pointerEvents: "none",
                    }} />
                  )}
                </div>
              );
            })
          )}

          {/* score popup */}
          {scorePopups.map(p => (
            <div key={p.id} style={{
              position: "absolute",
              top: "35%", left: "50%",
              color: "#FFD32A",
              fontSize: "20px", fontWeight: 900,
              pointerEvents: "none",
              animation: "scoreUp 1s ease-out forwards",
              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
              zIndex: 20,
              whiteSpace: "nowrap",
            }}>{p.text}</div>
          ))}

          {/* game over */}
          {gameOver && (
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.82)",
              borderRadius: "12px",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "14px",
              backdropFilter: "blur(6px)",
              zIndex: 30,
            }}>
              <div className="gameover-shake" style={{ fontSize: "30px", fontWeight: 900, color: "#FF4757", letterSpacing: "2px" }}>GAME OVER</div>
              <div style={{ color: "#ddd", fontSize: "16px" }}>
                Score: <span style={{ color: "#FFD32A", fontSize: "22px" }}>{score.toLocaleString()}</span>
              </div>
              <button onClick={reset} style={{
                padding: "12px 36px",
                background: "linear-gradient(135deg,#FF4757,#FF6EB4)",
                border: "none", borderRadius: "30px",
                color: "#fff", fontSize: "16px", fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 6px 20px rgba(255,71,87,0.5)",
              }}>RETRY</button>
            </div>
          )}
        </div>

          {/* 左から置く（right）インジケーター */}
          {nextDir === "right" && (
            <div style={{ display: "flex", flexDirection: "column", gap: `${GAP}px`, padding: "6px 0", marginLeft: "3px" }}>
              {Array.from({ length: ROWS }).map((_, r) => (
                <div key={r} onClick={() => placeBall(r)} style={{
                  width: "6px", height: `${CELL}px`, borderRadius: "3px",
                  background: DIR_COLOR["right"] + "99",
                  cursor: gameOver || processing ? "default" : "pointer",
                }} />
              ))}
            </div>
          )}
        </div>

        {/* 下から置く（up）インジケーター */}
        {nextDir === "up" && (
          <div style={{ display: "flex", gap: `${GAP}px`, padding: "0 6px", marginTop: "3px" }}>
            {Array.from({ length: COLS }).map((_, c) => (
              <div key={c} onClick={() => placeBall(c)} style={{
                width: `${CELL}px`, height: "6px", borderRadius: "3px",
                background: DIR_COLOR["up"] + "99",
                cursor: gameOver || processing ? "default" : "pointer",
              }} />
            ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{
        width: "100%", maxWidth: "480px",
        padding: "10px 16px 0",
        display: "flex", gap: "10px", alignItems: "center",
      }}>
        <div style={{ ...infoCardStyle, flex: 1, fontSize: "11px", color: "#777", lineHeight: 1.7, textAlign: "center" }}>
          重力の反対側からタップして配置　縦/横<span style={{ color: "#FFD32A" }}>4個</span>同色で消去　連鎖でスコア倍増
        </div>
        <button onClick={reset} style={{
          padding: "10px 18px",
          background: "rgba(255,255,255,0.09)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "12px",
          color: "#fff", fontSize: "13px", fontWeight: 900,
          cursor: "pointer", letterSpacing: "1px",
          flexShrink: 0,
        }}>RESET</button>
      </div>
    </div>
  );
}

const topCardStyle = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  padding: "8px 12px",
  textAlign: "center",
  minWidth: "70px",
};

const topLabelStyle = {
  color: "#777",
  fontSize: "9px",
  letterSpacing: "1.5px",
  marginBottom: "3px",
};

const infoCardStyle = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  padding: "10px 14px",
};
