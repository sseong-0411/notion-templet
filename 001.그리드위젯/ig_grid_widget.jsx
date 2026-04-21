import { useState, useCallback, useRef } from "react";

const STATUS_COLORS = {
  "초안":     "#888780",
  "디자인 중": "#378ADD",
  "검토":     "#BA7517",
  "예약됨":   "#E8593C",
  "게시완료":  "#1E7A46",
  "보관":     "#5F5E5A",
};

const TYPE_META = {
  "피드 1:1": { bg: "#C3E8D0", accent: "#1E7A46", icon: "◻" },
  "피드 4:5": { bg: "#B5D4F4", accent: "#185FA5", icon: "▯" },
  "스토리":   { bg: "#CECBF6", accent: "#534AB7", icon: "▮" },
  "릴스":    { bg: "#F4C0D1", accent: "#993556", icon: "▶" },
  "":        { bg: "#F0FAF4", accent: "#88CFA4", icon: "◻" },
};

const CORS   = "https://corsproxy.io/?";
const NOTION = "https://api.notion.com/v1";

async function notionReq(method, path, token, body) {
  const url = `${CORS}${encodeURIComponent(`${NOTION}${path}`)}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

function mapPage(p) {
  const pr = p.properties;
  return {
    id:            p.id,
    title:         pr["게시물 제목"]?.title?.[0]?.plain_text || "제목 없음",
    status:        pr["게시 상태"]?.select?.name   || "",
    type:          pr["게시 유형"]?.select?.name   || "",
    scheduledDate: pr["게시 예정일"]?.date?.start  || "",
    actualDate:    pr["실제 게시일"]?.date?.start  || "",
    figmaLink:     pr["피그마 링크"]?.url           || "",
    likes:         pr["좋아요 수"]?.number,
    caption:       pr["캡션"]?.rich_text?.[0]?.plain_text || "",
    order:         pr["순서"]?.number ?? null,
  };
}

function Badge({ label, color }) {
  return (
    <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 500 }}>
      {label}
    </span>
  );
}

function Thumb({ post }) {
  const meta  = TYPE_META[post.type] || TYPE_META[""];
  const isImg = post.figmaLink && /\.(jpg|jpeg|png|gif|webp)/i.test(post.figmaLink);
  if (isImg) return <img src={post.figmaLink} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.target.style.display = "none"; }} />;
  return (
    <div style={{ width: "100%", height: "100%", background: meta.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
      <span style={{ fontSize: 22, color: meta.accent }}>{meta.icon}</span>
      <span style={{ fontSize: 9,  color: meta.accent, opacity: 0.7 }}>{post.type || "게시물"}</span>
    </div>
  );
}

function Modal({ post, onClose, dark }) {
  const bg   = dark ? "#2a2a28" : "#fff";
  const text = dark ? "#e0dfd8" : "#1C1C1A";
  const sub  = dark ? "#88CFA4" : "#1E7A46";
  const bdr  = dark ? "#3a3a38" : "#e8e6e0";
  const meta = TYPE_META[post.type] || TYPE_META[""];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: bg, borderRadius: 16, maxWidth: 420, width: "100%", overflow: "hidden", border: `1px solid ${bdr}` }}>
        <div style={{ aspectRatio: "1/1", background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, color: meta.accent, overflow: "hidden" }}>
          {post.figmaLink && /\.(jpg|jpeg|png|gif|webp)/i.test(post.figmaLink)
            ? <img src={post.figmaLink} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span>{meta.icon}</span>}
        </div>
        <div style={{ padding: "18px 20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <h3 style={{ color: text, fontWeight: 500, fontSize: 15, margin: 0, flex: 1, paddingRight: 10 }}>{post.title}</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", color: sub, fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {post.status && <Badge label={post.status} color={STATUS_COLORS[post.status] || "#888"} />}
            {post.type   && <Badge label={post.type}   color={meta.accent} />}
          </div>
          {(post.scheduledDate || post.actualDate) && (
            <p style={{ color: sub, fontSize: 12, margin: "0 0 8px" }}>
              {post.actualDate ? `게시일  ${post.actualDate}` : `예정일  ${post.scheduledDate}`}
            </p>
          )}
          {post.caption && <p style={{ color: text, fontSize: 13, margin: "0 0 10px", lineHeight: 1.65 }}>{post.caption}</p>}
          {post.likes != null && <p style={{ color: sub, fontSize: 12, margin: "0 0 10px" }}>좋아요 {post.likes.toLocaleString()}개</p>}
          {post.figmaLink && (
            <a href={post.figmaLink} target="_blank" rel="noreferrer" style={{ display: "inline-block", color: "#1E7A46", fontSize: 12, textDecoration: "none", borderBottom: "1px solid #1E7A4644" }}>
              피그마에서 열기 →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, index, onDragStart, onDragEnter, onDragEnd, onClick, saving }) {
  const [hovered,  setHovered]  = useState(false);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={() => { setDragging(true); onDragStart(index); }}
      onDragEnter={() => onDragEnter(index)}
      onDragEnd={() => { setDragging(false); onDragEnd(); }}
      onDragOver={e => e.preventDefault()}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", aspectRatio: "1/1",
        cursor: saving ? "not-allowed" : "grab",
        overflow: "hidden", borderRadius: 3,
        opacity: dragging ? 0.35 : 1,
        outline: dragging ? "2px dashed #1E7A46" : "none",
        transition: "opacity .15s",
      }}
    >
      <Thumb post={post} />

      <div style={{ position: "absolute", top: 5, right: 5, width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[post.status] || "#aaa", border: "1.5px solid rgba(255,255,255,.85)", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />

      {post.order != null && (
        <div style={{ position: "absolute", bottom: 5, left: 5, background: "rgba(7,48,28,.72)", color: "#C3E8D0", fontSize: 9, borderRadius: 4, padding: "1px 5px" }}>
          #{post.order}
        </div>
      )}

      {hovered && !dragging && (
        <>
          <div style={{ position: "absolute", top: 5, left: 5, background: "rgba(7,48,28,.65)", color: "#C3E8D0", fontSize: 9, borderRadius: 4, padding: "1px 5px" }}>⠿ 드래그</div>
          <div style={{ position: "absolute", inset: 0, background: "rgba(7,48,28,.82)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 8px", textAlign: "center", gap: 4 }}>
            <p style={{ color: "#F0FAF4", fontSize: 11, fontWeight: 500, margin: 0, lineHeight: 1.35 }}>{post.title}</p>
            {(post.scheduledDate || post.actualDate) && (
              <p style={{ color: "#88CFA4", fontSize: 10, margin: 0 }}>{post.actualDate || post.scheduledDate}</p>
            )}
            {post.type && <span style={{ background: "rgba(255,255,255,.12)", borderRadius: 10, padding: "1px 8px", color: "#C3E8D0", fontSize: 9 }}>{post.type}</span>}
          </div>
        </>
      )}
    </div>
  );
}

export default function IGGridWidget() {
  const [step,    setStep]    = useState("setup");
  const [token,   setToken]   = useState("");
  const [dbId,    setDbId]    = useState("");
  const [tToken,  setTToken]  = useState("");
  const [tDbId,   setTDbId]   = useState("");
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [dark,    setDark]    = useState(false);
  const [filter,  setFilter]  = useState("전체");
  const [enlarged,setEnlarged]= useState(null);

  const dragFrom = useRef(null);
  const dragTo   = useRef(null);

  const fetchPosts = useCallback(async (tok, db) => {
    setLoading(true); setError("");
    try {
      const cleanDb = db.replace(/-/g, "");
      const data = await notionReq("POST", `/databases/${cleanDb}/query`, tok, {
        page_size: 60,
        sorts: [
          { property: "순서",      direction: "ascending" },
          { property: "게시 예정일", direction: "ascending" },
        ],
      });
      setPosts(data.results.map(mapPage));
      setStep("grid");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const onDragStart = i  => { dragFrom.current = i; };
  const onDragEnter = i  => { dragTo.current   = i; };
  const onDragEnd   = () => {
    const from = dragFrom.current, to = dragTo.current;
    if (from === null || to === null || from === to) return;
    setPosts(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr.map((p, i) => ({ ...p, order: i + 1 }));
    });
    dragFrom.current = null;
    dragTo.current   = null;
  };

  const saveOrder = async () => {
    setSaving(true); setSaveMsg(""); setError("");
    try {
      await Promise.all(
        posts.map((p, i) =>
          notionReq("PATCH", `/pages/${p.id}`, token, {
            properties: { "순서": { number: i + 1 } },
          })
        )
      );
      setSaveMsg("✓ 노션에 저장됐어요");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) { setError("저장 실패: " + e.message); }
    finally { setSaving(false); }
  };

  const statuses = ["전체", ...Array.from(new Set(posts.map(p => p.status).filter(Boolean)))];
  const filtered = filter === "전체" ? posts : posts.filter(p => p.status === filter);

  const bg   = dark ? "#1a1a18" : "#F7F6F2";
  const card = dark ? "#242422" : "#ffffff";
  const text = dark ? "#e0dfd8" : "#1C1C1A";
  const sub  = dark ? "#88CFA4" : "#1E7A46";
  const bdr  = dark ? "#363634" : "#e8e6e0";

  /* setup screen */
  if (step === "setup") {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: card, borderRadius: 16, padding: "36px 32px", maxWidth: 440, width: "100%", border: `1px solid ${bdr}` }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
          <h2 style={{ color: text, fontWeight: 500, fontSize: 20, margin: "0 0 4px" }}>IG Grid Preview</h2>
          <p style={{ color: sub, fontSize: 13, margin: "0 0 28px", lineHeight: 1.6 }}>노션 게시물 DB를 연결해 그리드를 확인하고, 드래그로 순서를 정한 뒤 노션에 저장하세요</p>

          {[
            { label: "Notion Integration Token", ph: "secret_xxxxxxxxxxxxxxxxxxxx", val: tToken, set: setTToken, type: "password" },
            { label: "Database ID",              ph: "4ac2bfac-7925-4c11-9699-09a9ab418dba", val: tDbId,  set: setTDbId,  type: "text" },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: text, fontSize: 12, marginBottom: 5, fontWeight: 500 }}>{f.label}</label>
              <input type={f.type} placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${bdr}`, background: bg, color: text, fontSize: 13, boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
            </div>
          ))}

          {error && <div style={{ background: "#FCEBEB", border: "1px solid #F09595", borderRadius: 8, padding: "10px 14px", color: "#A32D2D", fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>{error}</div>}

          <button onClick={() => { setToken(tToken); setDbId(tDbId); fetchPosts(tToken, tDbId); }}
            disabled={loading || !tToken || !tDbId}
            style={{ width: "100%", background: "#1E7A46", color: "#F0FAF4", border: "none", borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 500, cursor: loading || !tToken || !tDbId ? "not-allowed" : "pointer", opacity: !tToken || !tDbId ? 0.5 : 1 }}>
            {loading ? "연결 중..." : "그리드 시작하기"}
          </button>

          <div style={{ marginTop: 18, background: dark ? "#2a2a28" : "#F0FAF4", borderRadius: 8, padding: "12px 14px", fontSize: 11, color: sub, lineHeight: 1.9 }}>
            <strong>설정 방법</strong><br />
            1. notion.so/my-integrations → New integration 생성<br />
            2. 권한: <strong>Read content + Update content</strong> 체크<br />
            3. 게시물 DB → ··· → Connections → 인테그레이션 추가<br />
            4. 토큰과 DB ID 입력
          </div>
        </div>
      </div>
    );
  }

  /* grid screen */
  return (
    <div style={{ minHeight: "100vh", background: bg, paddingBottom: 40 }}>

      <div style={{ background: card, borderBottom: `1px solid ${bdr}`, padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📷</span>
          <span style={{ color: text, fontWeight: 500, fontSize: 14 }}>IG Grid Preview</span>
          <span style={{ color: sub, fontSize: 11 }}>{filtered.length}/{posts.length}</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {saveMsg && <span style={{ color: "#1E7A46", fontSize: 11, fontWeight: 500 }}>{saveMsg}</span>}
          <button onClick={saveOrder} disabled={saving}
            style={{ background: saving ? "#88CFA4" : "#1E7A46", color: "#F0FAF4", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 500, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "저장 중..." : "순서 저장"}
          </button>
          {[
            { label: "↺", fn: () => fetchPosts(token, dbId) },
            { label: dark ? "☀" : "☽", fn: () => setDark(!dark) },
            { label: "⚙", fn: () => setStep("setup") },
          ].map(b => (
            <button key={b.label} onClick={b.fn}
              style={{ background: "transparent", border: `1px solid ${bdr}`, borderRadius: 6, padding: "5px 9px", color: sub, fontSize: 13, cursor: "pointer" }}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "10px 18px 4px", display: "flex", gap: 10, overflowX: "auto", alignItems: "center" }}>
        {Object.entries(STATUS_COLORS).map(([k, v]) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 3, color: text, fontSize: 11, whiteSpace: "nowrap" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: v, display: "inline-block" }} />{k}
          </span>
        ))}
      </div>

      <div style={{ padding: "8px 18px 6px", display: "flex", gap: 6, overflowX: "auto" }}>
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ background: filter === s ? "#1E7A46" : card, color: filter === s ? "#F0FAF4" : text, border: `1px solid ${filter === s ? "#1E7A46" : bdr}`, borderRadius: 20, padding: "5px 13px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontWeight: filter === s ? 500 : 400 }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ padding: "4px 18px 10px" }}>
        <span style={{ color: sub, fontSize: 11, opacity: 0.65 }}>⠿ 카드를 드래그해 순서 변경 → "순서 저장" 클릭 시 노션 DB에 반영</span>
      </div>

      {error && <div style={{ margin: "0 18px 12px", background: "#FCEBEB", border: "1px solid #F09595", borderRadius: 8, padding: "10px 14px", color: "#A32D2D", fontSize: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: "center", color: sub, padding: 60, fontSize: 14 }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: sub, padding: 60, fontSize: 13 }}>게시물이 없어요</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3, padding: "0 18px" }}>
          {filtered.map((post, i) => (
            <PostCard key={post.id} post={post} index={i}
              onDragStart={onDragStart} onDragEnter={onDragEnter} onDragEnd={onDragEnd}
              onClick={() => setEnlarged(post)} saving={saving} />
          ))}
        </div>
      )}

      {enlarged && <Modal post={enlarged} onClose={() => setEnlarged(null)} dark={dark} />}
    </div>
  );
}
