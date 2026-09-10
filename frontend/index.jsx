import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Mic2, Timer, Headphones, ChevronLeft, Plus, Minus,
  SlidersHorizontal, ListMusic, Disc3, Folder, LayoutGrid,
  Users, Music2, Search, X, MoreHorizontal, ListPlus, Share2,
  Image as ImageIcon,
} from "lucide-react";

/* ---------------------------------------------------------
   더미 데이터 상수 및 기본값 설정
--------------------------------------------------------- */
const EMPTY_TRACK = {
  title: "재생할 곡 없음",
  artist: "라이브러리를 스캔하세요",
  album: "",
  duration: 0,
  c1: "#394B59",
  c2: "#C49A6C",
};

const DEFAULT_LYRICS = [
  { t: 0, line: "" },
  { t: 12, line: "골목 끝에 남아있는 가로등 불빛" },
  { t: 26, line: "네 발자국 소리를 기억하고 있어" },
  { t: 41, line: "지워지지 않는 계절의 온도" },
  { t: 58, line: "돌아오는 길은 항상 한 뼘 더 길다" },
  { t: 78, line: "말하지 못한 문장들이 쌓여가고" },
  { t: 100, line: "우리가 걷던 길 위에 남은 그림자" },
  { t: 128, line: "시간이 지나도 흐려지지 않는" },
  { t: 152, line: "창밖의 불빛을 세어보는 밤" },
  { t: 178, line: "그 밤의 온도를 기억해" },
  { t: 198, line: "다시, 여기서" },
];

const ROW_H = 56;

const TABS = [
  { id: "home", label: "재생", icon: Disc3 },
  { id: "queue", label: "대기열", icon: ListMusic },
  { id: "folders", label: "폴더", icon: Folder },
  { id: "albums", label: "앨범", icon: LayoutGrid },
  { id: "playlists", label: "플레이리스트", icon: ListPlus },
  { id: "artists", label: "아티스트", icon: Users },
  { id: "genres", label: "장르", icon: Music2 },
  { id: "search", label: "검색", icon: Search },
];

function formatTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function postNative(action, payload = {}) {
  window.musicplaya?.postMessage(JSON.stringify({ action, ...payload }));
}

/* ---------------------------------------------------------
   OptionWheel React Bits 컴포넌트
--------------------------------------------------------- */
const OptionWheel = ({
  items,
  defaultSelected = 0,
  onChange,
  textColor = "#85838c",
  activeColor = "#efece6",
  side = "left",
  fontSize = 1.7,
  spacing = 1.5,
  curve = 1,
  tilt = 7,
  blur = 2,
  fade = 0.32,
  minOpacity = 0.08,
  smoothing = 180,
  inset = 28,
  loop = false,
  draggable = true,
  className = "",
}) => {
  const rootRef = useRef(null);
  const itemRefs = useRef([]);
  const targetRef = useRef(defaultSelected);
  const posRef = useRef(defaultSelected);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const cfgRef = useRef({});
  const onChangeRef = useRef(onChange);
  const selectedRef = useRef(defaultSelected);
  const wheelTimerRef = useRef(null);
  const dragRef = useRef(null);
  const dragMovedRef = useRef(false);
  const [selectedIndex, setSelectedIndex] = useState(defaultSelected);
  const [isDragging, setIsDragging] = useState(false);

  const remPx = typeof window !== "undefined" ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16 : 16;

  onChangeRef.current = onChange;
  cfgRef.current = { count: items.length, items, rowH: Math.max(fontSize * spacing * remPx, 1), curve, tilt, blur, fade, minOpacity, side, loop, smoothing, draggable };

  const runFrame = useCallback((now) => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    const cfg = cfgRef.current;
    const tau = Math.max(cfg.smoothing, 1) / 1000;
    const k = 1 - Math.exp(-dt / tau);
    const target = targetRef.current;
    const cur = posRef.current;
    let next = cur + (target - cur) * k;
    const settled = Math.abs(target - next) < 0.001;
    if (settled) next = target;
    posRef.current = next;

    const els = itemRefs.current;
    const n = cfg.count;
    const mirror = cfg.side === "right" ? -1 : 1;
    const tiltRad = (cfg.tilt * Math.PI) / 180;
    const R = tiltRad > 0.0005 ? cfg.rowH / tiltRad : 0;
    for (let i = 0; i < n; i++) {
      const el = els[i];
      if (!el) continue;
      let d = i - next;
      if (cfg.loop && n > 1) {
        d = ((d % n) + n) % n;
        if (d > n / 2) d -= n;
      }
      const dist = Math.abs(d);
      let x = 0;
      let y = d * cfg.rowH;
      let rot = 0;
      if (R > 0) {
        const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad));
        y = R * Math.sin(ang);
        x = -mirror * R * (1 - Math.cos(ang)) * cfg.curve;
        rot = (mirror * ang * 180) / Math.PI;
      }
      el.style.transform = `translate(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%)) rotate(${rot.toFixed(3)}deg)`;
      el.style.opacity = String(Math.max(cfg.minOpacity, 1 - dist * cfg.fade));
      el.style.filter = cfg.blur > 0 ? `blur(${(dist * cfg.blur).toFixed(2)}px)` : "none";
      el.style.setProperty("--ow-p", Math.max(0, 1 - Math.min(dist, 1)).toFixed(4));
    }
    rafRef.current = settled ? null : requestAnimationFrame(runFrame);
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  const applyTarget = useCallback(
    (value, snap) => {
      const cfg = cfgRef.current;
      let v = value;
      if (!cfg.loop) v = Math.min(Math.max(v, 0), Math.max(cfg.count - 1, 0));
      if (snap) v = Math.round(v);
      targetRef.current = v;
      const idx = ((Math.round(v) % cfg.count) + cfg.count) % cfg.count;
      if (idx !== selectedRef.current) {
        selectedRef.current = idx;
        setSelectedIndex(idx);
        onChangeRef.current?.(idx, cfg.items[idx]);
      }
      startLoop();
    },
    [startLoop]
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const cfg = cfgRef.current;
      const delta = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaY;
      const step = Math.max(-1, Math.min(1, delta / cfg.rowH));
      applyTarget(targetRef.current + step, false);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => applyTarget(targetRef.current, true), 140);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, [applyTarget]);

  const handlePointerDown = useCallback((e) => {
    if (!cfgRef.current.draggable) return;
    dragRef.current = { y: e.clientY, start: targetRef.current, id: e.pointerId };
    dragMovedRef.current = false;
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (!dragMovedRef.current && Math.abs(dy) > 4) {
        dragMovedRef.current = true;
        rootRef.current?.setPointerCapture(drag.id);
      }
      if (dragMovedRef.current) applyTarget(drag.start - dy / cfgRef.current.rowH, false);
    },
    [applyTarget]
  );

  const handlePointerEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    if (dragMovedRef.current) applyTarget(targetRef.current, true);
  }, [applyTarget]);

  const handleItemClick = useCallback(
    (index) => {
      if (dragMovedRef.current) return;
      const cfg = cfgRef.current;
      const cur = targetRef.current;
      let d = index - (((cur % cfg.count) + cfg.count) % cfg.count);
      if (cfg.loop && cfg.count > 1) {
        if (d > cfg.count / 2) d -= cfg.count;
        else if (d < -cfg.count / 2) d += cfg.count;
      }
      applyTarget(cur + d, true);
    },
    [applyTarget]
  );

  const handleKeyDown = useCallback(
    (e) => {
      let delta = null;
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") delta = -1;
      else if (e.key === "ArrowDown" || e.key === "ArrowRight") delta = 1;
      if (delta == null) return;
      e.preventDefault();
      applyTarget(Math.round(targetRef.current) + delta, true);
    },
    [applyTarget]
  );

  useEffect(() => {
    applyTarget(targetRef.current, false);
  }, [items, fontSize, spacing, curve, tilt, blur, fade, minOpacity, side, loop, smoothing]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    },
    []
  );

  return (
    <div
      ref={rootRef}
      role="listbox"
      tabIndex={0}
      className={`option-wheel${side === "right" ? " option-wheel--right" : ""}${isDragging ? " option-wheel--dragging" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--ow-text-color": textColor, "--ow-active-color": activeColor, "--ow-font-size": `${fontSize}rem`, "--ow-inset": `${inset}px` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
    >
      {items.map((label, index) => (
        <div
          key={`${label}-${index}`}
          ref={(el) => { itemRefs.current[index] = el; }}
          role="option"
          aria-selected={selectedIndex === index}
          className={`option-wheel__item${selectedIndex === index ? " option-wheel__item--selected" : ""}`}
          onClick={() => handleItemClick(index)}
        >
          {label}
        </div>
      ))}
    </div>
  );
};

/* ---------------------------------------------------------
   AlbumCard 컴포넌트
--------------------------------------------------------- */
function AlbumCard({ album, onOpen }) {
  const artSrc = album.artworkB64;
  return (
    <figure
      className="album-card"
      onClick={() => onOpen?.(album)}
    >
      <div
        className="album-card__art"
        style={
          artSrc
            ? { backgroundImage: `url(${artSrc})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: `radial-gradient(circle at 26% 22%, ${album.c1} 0%, transparent 58%), radial-gradient(circle at 78% 76%, ${album.c2} 0%, transparent 55%), linear-gradient(160deg, #24242c 0%, #121216 100%)` }
        }
      >
        <figcaption className="album-card__caption">
          {album.title}
        </figcaption>
      </div>
    </figure>
  );
}

/* ---------------------------------------------------------
   GlassTabBar 컴포넌트
--------------------------------------------------------- */
const GlassTabBar = ({ tabs, activeId, onSelect }) => {
  return (
    <nav className="tabbar-wrap" aria-label="하단 내비게이션">
      <div className="tabbar-scroll">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tabbar-btn ${activeId === tab.id ? "active" : ""}`}
            onClick={() => onSelect(tab.id)}
          >
            <tab.icon size={15} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default function MusicoletKillerPlayer() {
  const [activeTab, setActiveTab] = useState("home");
  const [queueName, setQueueName] = useState("기기 음악");
  const [queueItems, setQueueItems] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [viewMode, setViewMode] = useState("basic");
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyricsLines, setLyricsLines] = useState(() => []);
  const [captureLine, setCaptureLine] = useState(null);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatState, setRepeatState] = useState("off");
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [menuTrack, setMenuTrack] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [playlistTracks, setPlaylistTracks] = useState({});
  const [nativePlaylists, setNativePlaylists] = useState([]);
  const [playlistPickerOpen, setPlaylistPickerOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [notice, setNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [karaokeOn, setKaraokeOn] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [earSafeLock, setEarSafeLock] = useState(true);
  const [sleepMinutes, setSleepMinutes] = useState(null);
  const [openFolder, setOpenFolder] = useState(null);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [genreIndex, setGenreIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const intervalRef = useRef(null);

  const TRACK = queueItems[currentTrackIndex] || EMPTY_TRACK;

  const artStyle = (t) => t?.artworkB64
    ? { backgroundImage: `url(${t.artworkB64})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: `radial-gradient(circle at 30% 25%, ${t?.c1 || "#394B59"} 0%, transparent 60%), radial-gradient(circle at 75% 75%, ${t?.c2 || "#C49A6C"} 0%, transparent 60%), #1c1c22` };

  const derivedArtists = useMemo(() => Array.from(new Set(queueItems.map((t) => t.artist || "Unknown"))).sort(), [queueItems]);
  const derivedGenres = useMemo(() => {
    const genres = queueItems.map((t) => t.genre).filter(Boolean);
    if (genres.length === 0) return ["Unknown"];
    return Array.from(new Set(genres)).sort();
  }, [queueItems]);
  const derivedAlbums = useMemo(() => {
    const map = new Map();
    queueItems.forEach((t) => {
      const a = t.album || "Unknown";
      if (!map.has(a)) map.set(a, { title: a, artist: t.artist || "Unknown", c1: t.c1, c2: t.c2, artworkB64: t.artworkB64 || null, tracks: [] });
      map.get(a).tracks.push(t);
    });
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [queueItems]);
  const derivedFolders = useMemo(() => {
    const map = new Map();
    queueItems.forEach((t) => {
      const fp = t.filePath || "/";
      const sep = fp.lastIndexOf("/");
      const dir = sep > 0 ? fp.substring(0, sep) : "/";
      if (!map.has(dir)) map.set(dir, { name: dir.split("/").filter(Boolean).pop() || dir, path: dir, tracks: [] });
      map.get(dir).tracks.push(t);
    });
    return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
  }, [queueItems]);

  const handleTabSelect = useCallback((tabId) => {
    setActiveTab(tabId);
    setSelectedAlbum(null);
    setSelectedArtist(null);
    setOpenFolder(null);
    setSelectedPlaylist(null);
  }, []);

  useEffect(() => {
    window.__musicplayaApplyState = (state) => {
      const nativeQueue = state?.queue;
      if (nativeQueue?.tracks?.length) {
        setQueueName(nativeQueue.name || "기기 음악");
        setQueueItems(nativeQueue.tracks);
        setCurrentTrackIndex(Math.max(0, Math.min(nativeQueue.tracks.length - 1, state.currentIndex || 0)));
      }
      if (typeof state?.playing === "boolean") setPlaying(state.playing);
      if (typeof state?.position === "number") setProgress(state.position);
      if (typeof state?.isShuffle === "boolean") setIsShuffle(state.isShuffle);
      if (typeof state?.repeatState === "string") setRepeatState(state.repeatState);
      if (state?.playlists) {
        setNativePlaylists(state.playlists);
        const pNames = state.playlists.map((p) => p.name);
        const pTracks = {};
        for (const p of state.playlists) {
          pTracks[p.name] = p.tracks;
        }
        setPlaylists(pNames);
        setPlaylistTracks(pTracks);
      }
      if (typeof state?.isKaraokeOn === "boolean") setKaraokeOn(state.isKaraokeOn);
      if (typeof state?.pitchShift === "number") setPitch(state.pitchShift);
    };
    if (window.__musicplayaPendingState) {
      window.__musicplayaApplyState(window.__musicplayaPendingState);
      delete window.__musicplayaPendingState;
    }
    postNative("ready");
    return () => { delete window.__musicplayaApplyState; };
  }, []);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setProgress((p) => (p >= TRACK.duration ? 0 : p + 1));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, TRACK.duration]);

  const pct = TRACK.duration > 0 ? (progress / TRACK.duration) * 100 : 0;

  const currentLineIdx = useMemo(() => {
    const list = lyricsLines.length > 0 ? lyricsLines : DEFAULT_LYRICS;
    let idx = 0;
    for (let i = 0; i < list.length; i++) {
      if ((list[i].t || 0) <= progress) idx = i;
    }
    return idx;
  }, [lyricsLines, progress]);

  const lyricsShift = 100 - currentLineIdx * ROW_H - ROW_H / 2;

  const playFromQueue = (idx) => {
    setCurrentTrackIndex(idx);
    setProgress(0);
    setPlaying(true);
    setActiveTab("home");
    postNative("selectTrack", { index: idx });
  };

  const playFromContext = (contextTracks, trackIndex) => {
    setQueueItems(contextTracks);
    setCurrentTrackIndex(trackIndex);
    setProgress(0);
    setPlaying(true);
    setActiveTab("home");
    postNative("setContextQueue", { tracks: contextTracks, startIndex: trackIndex });
  };

  const openTrackMenu = (track) => setMenuTrack(track);

  const togglePlayback = () => {
    const nextPlaying = !playing;
    setPlaying(nextPlaying);
    postNative(nextPlaying ? "play" : "pause");
  };

  return (
    <div className="player-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,380;0,9..144,520;1,9..144,480&family=Manrope:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

        .player-app {
          --bg-0: #0b0b0e;
          --bg-1: #131318;
          --surface: #1a1a20;
          --surface-2: #202027;
          --line: #29292f;
          --cream: #efece6;
          --muted: #85838c;
          --muted-2: #56545c;
          --dawn-a: #d9a578;
          --dawn-b: #6672b8;
          position: relative;
          height: 100dvh;
          width: 100%;
          margin: 0 auto;
          background: var(--bg-0);
          color: var(--cream);
          font-family: 'Manrope', sans-serif;
          overflow: hidden;
          isolation: isolate;
          display: flex;
          flex-direction: column;
        }

        .blur-bg {
          position: absolute;
          inset: -10% -10% 45% -10%;
          z-index: 0;
          filter: blur(70px);
          opacity: 0.38;
          background:
            radial-gradient(circle at 25% 15%, var(--dawn-b) 0%, transparent 52%),
            radial-gradient(circle at 78% 8%, var(--dawn-a) 0%, transparent 48%);
          animation: drift 20s ease-in-out infinite alternate;
          pointer-events: none;
        }
        @keyframes drift {
          0% { transform: translate(0,0) scale(1); }
          100% { transform: translate(3%, 2%) scale(1.06); }
        }

        .content {
          position: relative;
          z-index: 1;
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px 84px;
        }

        /* --- Topbar --- */
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .topbar .left {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 500;
        }
        .icon-btn {
          background: none;
          border: none;
          color: var(--cream);
          cursor: pointer;
          padding: 7px;
          border-radius: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background .15s;
        }
        .icon-btn:hover { background: rgba(239,236,230,0.06); }

        .view-toggle {
          display: flex;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 100px;
          padding: 3px;
          gap: 2px;
        }
        .view-toggle button {
          border: none;
          background: none;
          color: var(--muted);
          font-family: 'Manrope', sans-serif;
          font-size: 11.5px;
          font-weight: 600;
          padding: 5px 11px;
          border-radius: 100px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all .18s;
        }
        .view-toggle button.active {
          background: var(--surface-2);
          color: var(--cream);
          box-shadow: inset 0 0 0 1px var(--line);
        }

        .source-line {
          text-align: center;
          font-size: 11px;
          color: var(--muted-2);
          margin: 0 0 16px;
          letter-spacing: 0.01em;
        }

        /* --- Player Stage --- */
        .player-home {
          max-width: 420px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
        }

        .art-stage {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          width: 100%;
          height: 240px;
        }

        .art-basic {
          width: 220px;
          height: 220px;
          border-radius: 20px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          box-shadow: 0 18px 36px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at 25% 20%, #7c85c9 0%, transparent 55%),
            radial-gradient(circle at 80% 75%, #d9a578 0%, transparent 55%),
            linear-gradient(160deg, #24242c 0%, #121216 100%);
          background-size: cover;
          background-position: center;
          transition: transform .25s;
        }
        .art-basic:active { transform: scale(0.97); }

        .lp-wrap {
          position: relative;
          width: 240px;
          height: 240px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .vinyl {
          width: 216px;
          height: 216px;
          border-radius: 50%;
          background: repeating-radial-gradient(circle at center, #0e0e11 0px, #0e0e11 2px, #17171b 3px, #17171b 4px);
          box-shadow: 0 16px 34px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: spin 2.4s linear infinite;
          animation-play-state: paused;
        }
        .vinyl.spinning { animation-play-state: running; }
        .vinyl-label {
          width: 82px;
          height: 82px;
          border-radius: 50%;
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 0 2px #0e0e11, 0 3px 8px rgba(0,0,0,0.4);
        }
        .vinyl-hole {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #0e0e11;
          box-shadow: 0 0 0 3px rgba(239,236,230,0.15);
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .tonearm {
          position: absolute;
          top: -4px;
          right: 4px;
          width: 84px;
          height: 84px;
          transform-origin: 76px 10px;
          transform: rotate(-22deg);
          transition: transform .5s cubic-bezier(.4,0,.2,1);
          z-index: 2;
        }
        .tonearm.down { transform: rotate(3deg); }

        .tap-hint {
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 10.5px;
          color: var(--muted);
        }

        .track-info {
          text-align: center;
          margin-bottom: 16px;
        }
        .track-title {
          font-family: 'Fraunces', serif;
          font-size: 22px;
          font-weight: 520;
          letter-spacing: -0.01em;
          margin: 0 0 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .track-artist {
          font-size: 13px;
          color: var(--muted);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .progress-track {
          position: relative;
          height: 4px;
          border-radius: 4px;
          background: var(--line);
          cursor: pointer;
        }
        .progress-fill {
          position: absolute;
          inset: 0;
          width: var(--pct);
          background: linear-gradient(90deg, var(--dawn-b), var(--dawn-a));
          border-radius: 4px;
        }
        .progress-thumb {
          position: absolute;
          top: 50%;
          left: var(--pct);
          width: 12px;
          height: 12px;
          margin-left: -6px;
          margin-top: -6px;
          border-radius: 50%;
          background: var(--cream);
          box-shadow: 0 1px 5px rgba(0,0,0,0.5);
        }
        .time-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--muted-2);
          margin-top: 6px;
          font-variant-numeric: tabular-nums;
        }

        .transport {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 22px;
          margin: 16px 0 8px;
        }
        .transport .icon-btn.mini { color: var(--muted); }
        .play-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--surface-2);
          border: 1px solid var(--line);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--cream);
          transition: transform .15s, background .15s;
        }
        .play-btn:active { transform: scale(0.94); }

        .footer-row {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 14px;
        }
        .settings-link {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--muted-2);
          font-size: 11.5px;
          font-family: 'Manrope', sans-serif;
          cursor: pointer;
          padding: 6px 12px;
        }
        .settings-link:hover { color: var(--muted); }

        /* --- Lyrics Overlay --- */
        .lyrics-overlay {
          position: absolute;
          inset: 0;
          z-index: 5;
          background: rgba(11,11,14,0.96);
          backdrop-filter: blur(10px);
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          padding: 14px 16px;
          transform: translateY(100%);
          transition: transform .35s cubic-bezier(.4,0,.2,1);
        }
        .lyrics-overlay.open { transform: translateY(0); }
        .lyrics-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .lyrics-head span { font-size: 11.5px; color: var(--muted-2); }
        .lyrics-viewport {
          position: relative;
          flex: 1;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%);
        }
        .lyrics-list {
          position: absolute;
          left: 0;
          right: 0;
          transition: transform .4s cubic-bezier(.4,0,.2,1);
        }
        .lyric-row {
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 10px;
        }
        .lyric-line {
          font-family: 'Fraunces', serif;
          font-size: 15px;
          color: var(--muted-2);
          opacity: 0.6;
          transition: all .25s;
          cursor: pointer;
          text-align: center;
          line-height: 1.3;
        }
        .lyric-line.current {
          font-size: 19px;
          color: var(--cream);
          opacity: 1;
          font-weight: 500;
        }

        /* --- Other Screens --- */
        .screen { display: flex; flex-direction: column; gap: 10px; }
        .screen-title { font-size: 20px; font-weight: 700; margin: 0 0 2px; color: var(--cream); font-family: 'Fraunces', serif; }
        .screen-sub { font-size: 12px; color: var(--muted); margin: 0 0 12px; }
        .album-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .album-card { margin: 0; cursor: pointer; }
        .album-card__art { width: 100%; aspect-ratio: 1/1; border-radius: 12px; position: relative; overflow: hidden; background-size: cover; background-position: center; }
        .album-card__caption { position: absolute; bottom: 0; left: 0; right: 0; padding: 10px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .queue-row, .album-track-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          cursor: pointer;
        }
        .queue-row .art-chip, .album-track-row .art-chip { width: 42px; height: 42px; border-radius: 8px; flex-shrink: 0; }
        .art-chip { background-size: cover; background-position: center; }
        .queue-row p, .album-track-row p { margin: 0; font-size: 13px; font-weight: 600; }
        .queue-row p + p, .album-track-row p + p { font-size: 11px; font-weight: 400; color: var(--muted); margin-top: 2px; }
        .album-track-row .number { font-size: 12px; color: var(--muted-2); width: 22px; }
        .album-track-row .meta { flex: 1; min-width: 0; }
        .album-track-row .duration { font-size: 11px; color: var(--muted-2); }

        .folder-list { display: flex; flex-direction: column; gap: 8px; }
        .folder-row { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px; cursor: pointer; }
        .folder-row .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .folder-row .name { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; }
        .folder-row .count { font-size: 11px; color: var(--muted); }
        .folder-row .path { font-size: 10.5px; color: var(--muted-2); margin: 0; word-break: break-all; }
        .folder-detail { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }

        .search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 100px;
          padding: 8px 16px;
          margin-bottom: 14px;
        }
        .search-box input {
          flex: 1;
          background: none;
          border: none;
          color: var(--cream);
          font-family: 'Manrope', sans-serif;
          font-size: 13px;
          outline: none;
        }
        .search-group-label { font-size: 12px; font-weight: 700; color: var(--muted); margin: 12px 0 6px; }
        .search-empty { text-align: center; color: var(--muted); font-size: 12px; margin: 30px 0; }
        .playlist-add {
          background: var(--surface-2);
          color: var(--cream);
          border: 1px solid var(--line);
          padding: 12px 16px;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Manrope', sans-serif;
          font-size: 13px;
          font-weight: 600;
          width: 100%;
          margin-bottom: 12px;
        }

        /* --- Bottom Glass Tabbar --- */
        .tabbar-wrap {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 20;
          padding: 10px 14px 16px;
          background: linear-gradient(to top, rgba(11,11,14,0.96) 65%, transparent 100%);
          backdrop-filter: blur(12px);
        }
        .tabbar-scroll {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          padding: 4px;
          background: rgba(26,26,32,0.85);
          border: 1px solid var(--line);
          border-radius: 100px;
          max-width: 460px;
          margin: 0 auto;
        }
        .tabbar-scroll::-webkit-scrollbar { display: none; }
        .tabbar-btn {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 12px;
          border-radius: 100px;
          border: none;
          background: none;
          color: var(--muted);
          font-family: 'Manrope', sans-serif;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all .18s;
          white-space: nowrap;
        }
        .tabbar-btn.active {
          background: var(--surface-2);
          color: var(--cream);
          box-shadow: inset 0 0 0 1px var(--line), 0 2px 8px rgba(0,0,0,0.3);
        }

        /* --- Settings Bottomsheet --- */
        .sheet-backdrop {
          position: absolute;
          inset: 0;
          z-index: 28;
          background: rgba(0,0,0,0.55);
          opacity: 0;
          pointer-events: none;
          transition: opacity .3s;
        }
        .sheet-backdrop.open { opacity: 1; pointer-events: auto; }
        .sheet {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 30;
          background: var(--bg-1);
          border-top: 1px solid var(--line);
          border-radius: 20px 20px 0 0;
          padding: 10px 20px 28px;
          transform: translateY(100%);
          transition: transform .35s cubic-bezier(.4,0,.2,1);
          box-shadow: 0 -20px 40px rgba(0,0,0,0.5);
          max-width: 480px;
          margin: 0 auto;
        }
        .sheet.open { transform: translateY(0); }
        .sheet-handle { width: 36px; height: 4px; border-radius: 4px; background: var(--line); margin: 0 auto 14px; }
        .sheet-title { font-size: 14px; font-weight: 700; color: var(--cream); margin: 0 0 14px; }
        .sheet-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--line); }
        .sheet-row:last-child { border-bottom: none; }
        .sheet-row .label { display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--cream); }
        .sheet-row .label .sub { display: block; font-size: 10.5px; color: var(--muted-2); font-weight: 400; margin-top: 2px; }
        .sheet-row .label svg { color: var(--muted); }

        .switch { width: 40px; height: 24px; border-radius: 100px; background: var(--surface-2); border: 1px solid var(--line); position: relative; cursor: pointer; transition: background .2s; flex-shrink: 0; }
        .switch.on { background: linear-gradient(90deg, var(--dawn-b), var(--dawn-a)); border-color: transparent; }
        .switch .knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: var(--cream); transition: transform .2s; }
        .switch.on .knob { transform: translateX(16px); }

        .stepper { display: flex; align-items: center; gap: 12px; }
        .stepper button { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--line); background: var(--surface-2); color: var(--cream); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .stepper .val { font-family: 'Fraunces', serif; font-size: 15px; min-width: 26px; text-align: center; }

        .sleep-opts { display: flex; gap: 6px; align-items: center; }
        .sleep-opts button { font-size: 11px; padding: 4px 10px; border-radius: 100px; border: 1px solid var(--line); background: var(--surface-2); color: var(--muted); cursor: pointer; }
        .sleep-opts button.on { color: var(--bg-0); background: var(--dawn-a); border-color: var(--dawn-a); }

        /* --- Modals & Pickers --- */
        .modal-backdrop, .playlist-picker-backdrop { position: absolute; inset: 0; z-index: 35; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; padding: 24px; }
        .capture-card {
          width: 100%; aspect-ratio: 1/1; border-radius: 18px; overflow: hidden; position: relative;
          background: radial-gradient(circle at 25% 20%, #7c85c9 0%, transparent 55%), radial-gradient(circle at 80% 75%, #d9a578 0%, transparent 55%), linear-gradient(160deg, #24242c, #121216);
          display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center;
        }
        .capture-card p { font-family: 'Fraunces', serif; font-size: 19px; color: #fff; line-height: 1.5; text-shadow: 0 2px 12px rgba(0,0,0,0.4); margin: 0; }
        .capture-actions { display: flex; gap: 8px; margin-top: 12px; }
        .capture-actions button { flex: 1; padding: 10px; border-radius: 12px; border: none; font-family: 'Manrope', sans-serif; font-weight: 600; font-size: 12px; cursor: pointer; }
        .capture-actions .share { background: var(--dawn-a); color: #1a1408; }
        .capture-actions .close { background: var(--surface); color: var(--cream); border: 1px solid var(--line); }

        .track-menu { position: absolute; bottom: 80px; left: 20px; right: 20px; z-index: 32; background: var(--surface-2); border: 1px solid var(--line); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .track-menu__title { font-size: 13px; font-weight: 700; color: var(--cream); margin-bottom: 4px; }
        .track-menu button { background: var(--surface); border: 1px solid var(--line); color: var(--cream); padding: 10px; border-radius: 10px; font-family: 'Manrope', sans-serif; font-size: 12.5px; cursor: pointer; text-align: left; }
        .playlist-picker { background: var(--bg-1); border: 1px solid var(--line); border-radius: 18px; padding: 20px; width: 100%; max-width: 320px; z-index: 36; display: flex; flex-direction: column; gap: 8px; }
        .playlist-picker h3 { margin: 0 0 10px; font-size: 14px; }
        .playlist-picker button { background: var(--surface); border: 1px solid var(--line); color: var(--cream); padding: 10px 12px; border-radius: 10px; font-family: 'Manrope', sans-serif; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; }
        .playlist-picker .cancel { background: none; border: none; color: var(--muted); text-align: center; justify-content: center; margin-top: 4px; }
        .notice { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 40; background: var(--surface-2); border: 1px solid var(--line); color: var(--cream); padding: 8px 16px; border-radius: 100px; font-size: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
      `}</style>

      <div className="blur-bg" />

      <div className="content">
        {activeTab === "home" && (
          <div className="player-home">
            <div className="topbar">
              <div className="left">
                <button className="icon-btn" onClick={() => setActiveTab("queue")} aria-label="대기열로 이동">
                  <ListMusic size={18} />
                </button>
                <span>지금 재생 중 · {queueName || "대기열"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="view-toggle">
                  <button className={viewMode === "basic" ? "active" : ""} onClick={() => setViewMode("basic")}>
                    <ListMusic size={12} /> 기본
                  </button>
                  <button className={viewMode === "lp" ? "active" : ""} onClick={() => setViewMode("lp")}>
                    <Disc3 size={12} /> LP
                  </button>
                </div>
                <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="재생 설정">
                  <SlidersHorizontal size={17} />
                </button>
              </div>
            </div>

            <p className="source-line">{TRACK.album ? `${TRACK.album} · ` : ""}LRCLIB 싱크 가사 · ReplayGain 자동 적용</p>

            <div className="art-stage">
              {viewMode === "basic" ? (
                <div className="art-basic" style={artStyle(TRACK)} onClick={() => setLyricsOpen((v) => !v)} />
              ) : (
                <div className="lp-wrap" onClick={() => setLyricsOpen((v) => !v)}>
                  <div className={`tonearm ${playing ? "down" : ""}`}>
                    <svg width="84" height="84" viewBox="0 0 84 84" style={{ overflow: "visible" }}>
                      <circle cx="76" cy="10" r="5.5" fill="#2c2c33" stroke="#454550" strokeWidth="1.4" />
                      <line x1="76" y1="10" x2="16" y2="64" stroke="#3a3a42" strokeWidth="3.5" strokeLinecap="round" />
                      <circle cx="16" cy="64" r="2.6" fill="var(--dawn-a)" />
                    </svg>
                  </div>
                  <div className={`vinyl ${playing ? "spinning" : ""}`}>
                    <div className="vinyl-label" style={artStyle(TRACK)}>
                      <div className="vinyl-hole" />
                    </div>
                  </div>
                </div>
              )}
              <span className="tap-hint" style={{ display: lyricsOpen ? "none" : "block" }}>탭해서 가사 보기</span>

              <div className={`lyrics-overlay ${lyricsOpen ? "open" : ""}`}>
                <div className="lyrics-head">
                  <span>싱크 가사</span>
                  <button className="icon-btn" onClick={() => setLyricsOpen(false)}><X size={16} /></button>
                </div>
                <div className="lyrics-viewport" style={{ height: 200 }}>
                  <div className="lyrics-list" style={{ top: 0, transform: `translateY(${lyricsShift}px)` }}>
                    {(lyricsLines.length > 0 ? lyricsLines : DEFAULT_LYRICS).map((l, i) => (
                      <div className="lyric-row" key={i}>
                        <p
                          className={`lyric-line ${i === currentLineIdx ? "current" : ""}`}
                          onClick={() => l.line && setCaptureLine(l.line)}
                        >
                          {l.line || "♪"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="track-info">
              <p className="track-title">{TRACK.title}</p>
              <p className="track-artist">{TRACK.artist}{TRACK.album ? ` · ${TRACK.album}` : ""}</p>
            </div>

            <div style={{ "--pct": `${pct}%` }}>
              <div
                className="progress-track"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  const newPos = Math.max(0, Math.min(TRACK.duration || 1, Math.round(ratio * (TRACK.duration || 1))));
                  setProgress(newPos);
                  postNative("seek", { position: newPos });
                }}
              >
                <div className="progress-fill" />
                <div className="progress-thumb" />
              </div>
              <div className="time-row">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(TRACK.duration || 0)}</span>
              </div>
            </div>

            <div className="transport">
              <button
                className={`icon-btn mini ${isShuffle ? "active" : ""}`}
                onClick={() => {
                  setIsShuffle(!isShuffle);
                  postNative("shuffle");
                }}
                aria-label="셔플"
              >
                <Shuffle size={17} style={{ color: isShuffle ? "var(--dawn-a)" : "inherit" }} />
              </button>
              <button className="icon-btn" onClick={() => postNative("previous")} aria-label="이전 곡">
                <SkipBack size={22} />
              </button>
              <button className="play-btn" onClick={togglePlayback} aria-label={playing ? "일시정지" : "재생"}>
                {playing ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: 2 }} />}
              </button>
              <button className="icon-btn" onClick={() => postNative("next")} aria-label="다음 곡">
                <SkipForward size={22} />
              </button>
              <button
                className={`icon-btn mini ${repeatState !== "off" ? "active" : ""}`}
                onClick={() => {
                  const nextRepeat = repeatState === "off" ? "all" : repeatState === "all" ? "one" : "off";
                  setRepeatState(nextRepeat);
                  postNative("repeat");
                }}
                aria-label="반복 재생"
              >
                <Repeat size={17} style={{ color: repeatState !== "off" ? "var(--dawn-a)" : "inherit" }} />
              </button>
            </div>

            <div className="footer-row">
              <button className="settings-link" onClick={() => setSettingsOpen(true)}>
                <SlidersHorizontal size={12} /> 재생 옵션 (노래방·타이머·안심락)
              </button>
            </div>
          </div>
        )}

        {activeTab === "queue" && (
          <div className="screen">
            <p className="screen-title">대기열 ({queueItems.length})</p>
            <p className="screen-sub">현재 재생 큐: {queueName}</p>
            {queueItems.map((t, i) => (
              <div
                key={i}
                className="queue-row"
                onClick={() => playFromQueue(i)}
                style={{ borderColor: i === currentTrackIndex ? "var(--dawn-a)" : undefined }}
              >
                <div className="art-chip" style={artStyle(t)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: i === currentTrackIndex ? "var(--dawn-a)" : undefined }}>{t.title}</p>
                  <p>{t.artist}</p>
                </div>
                <span style={{ fontSize: 11, color: "var(--muted-2)" }}>{formatTime(t.duration)}</span>
              </div>
            ))}
            {queueItems.length === 0 && <p className="search-empty">대기열이 비어 있습니다.</p>}
          </div>
        )}

        {activeTab === "folders" && (
          <div className="screen">
            <p className="screen-title">폴더</p>
            <p className="screen-sub">기기 및 SD 카드에서 음악 파일을 찾은 위치</p>
            <div className="folder-list">
              <button className="playlist-add" onClick={() => postNative("scanEntireDevice")}>
                <Plus size={15} /> 기기 및 SD 카드 전체 스캔하기
              </button>
              <button
                className="playlist-add"
                style={{ background: "var(--surface)", borderColor: "var(--line)" }}
                onClick={() => postNative("pickFolder")}
              >
                <Folder size={15} /> 특정 폴더 / SD 카드 직접 선택
              </button>
              {derivedFolders.length === 0 && <p className="search-empty">스캔된 폴더가 없습니다. 위 버튼으로 스캔하세요.</p>}
              {derivedFolders.map((f) => (
                <div key={f.path} className="folder-row" onClick={() => setOpenFolder(openFolder === f.path ? null : f.path)}>
                  <div className="head">
                    <div className="name"><Folder size={15} />{f.name}</div>
                    <span className="count">{f.tracks.length}곡</span>
                  </div>
                  <p className="path">{f.path}</p>
                  {openFolder === f.path && (
                    <div className="folder-detail">
                      {f.tracks.map((track, idx) => (
                        <div className="album-track-row" key={track.filePath || idx} onClick={(e) => { e.stopPropagation(); playFromContext(f.tracks, idx); }}>
                          <span className="number">{String(idx + 1).padStart(2, "0")}</span>
                          <div className="art-chip" style={artStyle(track)} />
                          <div className="meta"><p className="title">{track.title}</p><p className="artist">{track.artist}</p></div>
                          <span className="duration">{formatTime(track.duration)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "albums" && (
          <div className="screen">
            {selectedAlbum ? (
              <>
                <button className="icon-btn" onClick={() => setSelectedAlbum(null)} aria-label="앨범 목록으로 돌아가기"><ChevronLeft size={18} /></button>
                <div style={{ display: "flex", gap: 14, alignItems: "center", margin: "10px 0 16px" }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 12, flexShrink: 0,
                    ...(selectedAlbum.artworkB64
                      ? { backgroundImage: `url(${selectedAlbum.artworkB64})`, backgroundSize: "cover", backgroundPosition: "center" }
                      : { background: `radial-gradient(circle at 26% 22%, ${selectedAlbum.c1} 0%, transparent 58%), radial-gradient(circle at 78% 76%, ${selectedAlbum.c2} 0%, transparent 55%), linear-gradient(160deg, #24242c 0%, #121216 100%)` })
                  }} />
                  <div>
                    <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>{selectedAlbum.title}</h2>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{selectedAlbum.artist} · {selectedAlbum.tracks.length}곡</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedAlbum.tracks.map((track, index) => (
                    <div className="album-track-row" key={track.filePath || track.title + index} onClick={() => playFromContext(selectedAlbum.tracks, index)}>
                      <span className="number">{String(index + 1).padStart(2, "0")}</span>
                      <div className="art-chip" style={artStyle(track)} />
                      <div className="meta"><p className="title">{track.title}</p><p className="artist">{track.artist}</p></div>
                      <span className="duration">{formatTime(track.duration)}</span>
                      <button className="icon-btn" onClick={(event) => { event.stopPropagation(); openTrackMenu(track); }} aria-label="메뉴"><MoreHorizontal size={18} /></button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="screen-title">앨범</p>
                <p className="screen-sub">{derivedAlbums.length}개 앨범</p>
                <div className="album-grid">
                  {derivedAlbums.map((a) => (
                    <AlbumCard key={a.title} album={a} onOpen={(album) => setSelectedAlbum(album)} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "playlists" && (
          <div className="screen">
            {selectedPlaylist != null ? (
              <>
                <button className="icon-btn" onClick={() => setSelectedPlaylist(null)}><ChevronLeft size={18} /></button>
                <p className="screen-title">{playlists[selectedPlaylist]}</p>
                <p className="screen-sub">{(playlistTracks[playlists[selectedPlaylist]] || []).length}곡</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(() => {
                    const pTracks = playlistTracks[playlists[selectedPlaylist]] || [];
                    if (pTracks.length === 0) return <p className="search-empty">곡 메뉴에서 플레이리스트에 추가할 수 있어요.</p>;
                    return pTracks.map((track, index) => (
                      <div className="album-track-row" key={track.title + index} onClick={() => playFromContext(pTracks, index)}>
                        <span className="number">{String(index + 1).padStart(2, "0")}</span>
                        <div className="art-chip" style={artStyle(track)} />
                        <div className="meta"><p className="title">{track.title}</p><p className="artist">{track.artist}</p></div>
                        <span className="duration">{formatTime(track.duration)}</span>
                      </div>
                    ));
                  })()}
                </div>
              </>
            ) : (
              <>
                <p className="screen-title">플레이리스트</p>
                <p className="screen-sub">{playlists.length}개 목록</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {playlists.map((p, idx) => (
                    <div key={p} className="folder-row" onClick={() => setSelectedPlaylist(idx)}>
                      <div className="head">
                        <div className="name"><ListPlus size={15} />{p}</div>
                        <span className="count">{(playlistTracks[p] || []).length}곡</span>
                      </div>
                    </div>
                  ))}
                  {playlists.length === 0 && <p className="search-empty">생성된 플레이리스트가 없습니다.</p>}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "artists" && (
          <div className="screen">
            {selectedArtist ? (
              <>
                <button className="icon-btn" onClick={() => setSelectedArtist(null)}><ChevronLeft size={18} /></button>
                <p className="screen-title">{selectedArtist}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  {(() => {
                    const aTracks = queueItems.filter((t) => (t.artist || "Unknown") === selectedArtist);
                    return aTracks.map((t, idx) => (
                      <div className="album-track-row" key={t.filePath || idx} onClick={() => playFromContext(aTracks, idx)}>
                        <span className="number">{String(idx + 1).padStart(2, "0")}</span>
                        <div className="art-chip" style={artStyle(t)} />
                        <div className="meta"><p className="title">{t.title}</p><p className="artist">{t.artist}</p></div>
                        <span className="duration">{formatTime(t.duration)}</span>
                      </div>
                    ));
                  })()}
                </div>
              </>
            ) : (
              <>
                <p className="screen-title">아티스트</p>
                <p className="screen-sub">{derivedArtists.length}명 아티스트</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {derivedArtists.map((name) => (
                    <div
                      key={name}
                      className="folder-row"
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedArtist(name)}
                    >
                      <div className="name" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <Users size={14} />{name}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "genres" && (
          <div className="screen">
            <p className="screen-title">장르 탐색</p>
            <div style={{ margin: "14px 0" }}>
              <OptionWheel items={derivedGenres.length ? derivedGenres : ["Unknown"]} defaultSelected={genreIndex} onChange={(idx) => setGenreIndex(idx)} side="left" />
            </div>
            <div style={{ padding: "8px 12px", background: "var(--surface)", borderRadius: 10, border: "1px solid var(--line)", marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: "var(--muted-2)" }}>선택된 장르</span>
              <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700 }}>{derivedGenres[genreIndex] || "Unknown"}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(() => {
                const selectedGenre = derivedGenres[genreIndex] || "Unknown";
                const genreTracks = queueItems.filter(t => selectedGenre === "Unknown" ? !t.genre : t.genre === selectedGenre);
                return genreTracks.map((t, index) => (
                  <div
                    className="album-track-row"
                    key={t.filePath || t.title || index}
                    onClick={() => playFromContext(genreTracks, index)}
                  >
                    <span className="number">{(index < 9 ? "0" : "") + (index + 1)}</span>
                    <div className="art-chip" style={artStyle(t)} />
                    <div className="meta">
                      <p className="title">{t.title || "Unknown"}</p>
                      <p className="artist">{selectedGenre} · {t.artist || "Unknown"}</p>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {activeTab === "search" && (
          <div className="screen">
            <div className="search-box">
              <Search size={15} />
              <input
                autoFocus
                placeholder="곡, 앨범, 아티스트 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="icon-btn" style={{ padding: 3 }} onClick={() => setSearchQuery("")}><X size={14} /></button>
              )}
            </div>

            {(() => {
              const q = searchQuery.trim().toLowerCase();
              if (!q) return <p className="search-empty">검색어를 입력해보세요.</p>;
              const foundTracks = queueItems.filter((t) => (t.title || "").toLowerCase().includes(q) || (t.artist || "").toLowerCase().includes(q));
              const foundAlbums = derivedAlbums.filter((a) => (a.title || "").toLowerCase().includes(q) || (a.artist || "").toLowerCase().includes(q));
              const foundArtists = derivedArtists.filter((a) => (a || "").toLowerCase().includes(q));
              if (foundTracks.length + foundAlbums.length + foundArtists.length === 0) return <p className="search-empty">일치하는 결과가 없어요.</p>;
              return (
                <>
                  {foundTracks.length > 0 && (
                    <>
                      <p className="search-group-label">곡</p>
                      {foundTracks.map((t, i) => (
                        <div key={t.filePath || i} className="queue-row" onClick={() => playFromQueue(queueItems.indexOf(t))}>
                          <div className="art-chip" style={artStyle(t)} />
                          <div><p>{t.title}</p><p style={{ fontSize: 11, color: "#85838c" }}>{t.artist}</p></div>
                        </div>
                      ))}
                    </>
                  )}
                  {foundAlbums.length > 0 && (
                    <>
                      <p className="search-group-label">앨범</p>
                      <div className="album-grid">
                        {foundAlbums.map((a) => (
                          <AlbumCard key={a.title} album={a} onOpen={(album) => { setSelectedAlbum(album); setActiveTab("albums"); }} />
                        ))}
                      </div>
                    </>
                  )}
                  {foundArtists.length > 0 && (
                    <>
                      <p className="search-group-label">아티스트</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {foundArtists.map((name) => (
                          <div key={name} className="folder-row" onClick={() => { setSelectedArtist(name); setActiveTab("artists"); }}>
                            <div className="name"><Users size={14} />{name}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      <GlassTabBar tabs={TABS} activeId={activeTab} onSelect={handleTabSelect} />

      {/* 설정 바텀시트 */}
      <div className={`sheet-backdrop ${settingsOpen ? "open" : ""}`} onClick={() => setSettingsOpen(false)} />
      <div className={`sheet ${settingsOpen ? "open" : ""}`}>
        <div className="sheet-handle" />
        <p className="sheet-title">재생 옵션</p>

        <div className="sheet-row">
          <div className="label">
            <Mic2 size={16} />
            <span>노래방 모드<span className="sub">위상 반전 보컬 제거 · 저음 보존</span></span>
          </div>
          <div className={`switch ${karaokeOn ? "on" : ""}`} onClick={() => {
            const next = !karaokeOn;
            setKaraokeOn(next);
            postNative("setKaraokeMode", { enabled: next });
          }}>
            <div className="knob" />
          </div>
        </div>

        <div className="sheet-row" style={{ opacity: karaokeOn ? 1 : 0.4, pointerEvents: karaokeOn ? "auto" : "none" }}>
          <div className="label"><span>키 조절<span className="sub">반음 단위 피치 시프트</span></span></div>
          <div className="stepper">
            <button onClick={() => {
              const next = Math.max(-6, pitch - 1);
              setPitch(next);
              postNative("setPitch", { semitones: next });
            }}><Minus size={13} /></button>
            <span className="val">{pitch > 0 ? `+${pitch}` : pitch}</span>
            <button onClick={() => {
              const next = Math.min(6, pitch + 1);
              setPitch(next);
              postNative("setPitch", { semitones: next });
            }}><Plus size={13} /></button>
          </div>
        </div>

        <div className="sheet-row">
          <div className="label">
            <Headphones size={16} />
            <span>이어폰 안심 볼륨락<span className="sub">연결 끊기면 즉시 일시정지 + 볼륨 0</span></span>
          </div>
          <div className={`switch ${earSafeLock ? "on" : ""}`} onClick={() => setEarSafeLock((v) => !v)}>
            <div className="knob" />
          </div>
        </div>

        <div className="sheet-row">
          <div className="label">
            <Timer size={16} />
            <span>수면 타이머{sleepMinutes ? <span className="sub">{`${sleepMinutes}분 후 정지`}</span> : null}</span>
          </div>
          <div className="sleep-opts">
            {[15, 30, 60].map((m) => (
              <button key={m} className={sleepMinutes === m ? "on" : ""} onClick={() => setSleepMinutes(sleepMinutes === m ? null : m)}>{m}분</button>
            ))}
          </div>
        </div>

        <div className="sheet-row">
          <div className="label">
            <ImageIcon size={16} />
            <span>가사 캡처 카드<span className="sub">현재 가사로 공유용 카드 생성</span></span>
          </div>
          <button
            className="icon-btn"
            style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "6px 14px", fontSize: 12, borderRadius: 10 }}
            onClick={() => {
              const list = lyricsLines.length > 0 ? lyricsLines : DEFAULT_LYRICS;
              setCaptureLine(list[currentLineIdx]?.line || list[1]?.line || "새벽의 온도");
              setSettingsOpen(false);
            }}
          >
            만들기
          </button>
        </div>
      </div>

      {captureLine && (
        <div className="modal-backdrop" onClick={() => setCaptureLine(null)}>
          <div style={{ width: "100%", maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className="capture-card"><p>“{captureLine}”</p></div>
            <div className="capture-actions">
              <button className="share"><Share2 size={13} style={{ marginRight: 6, verticalAlign: -2 }} />공유하기</button>
              <button className="close" onClick={() => setCaptureLine(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {menuTrack && (
        <div className="track-menu">
          <div className="track-menu__title">{menuTrack.title}</div>
          <button onClick={() => { setQueueItems((items) => items.some((item) => item.title === menuTrack.title) ? items : [...items, menuTrack]); setMenuTrack(null); }}>현재 대기열에 추가</button>
          <button onClick={() => { setPlaylistPickerOpen(true); }}>플레이리스트에 추가</button>
          <button onClick={() => setMenuTrack(null)}>닫기</button>
        </div>
      )}

      {playlistPickerOpen && menuTrack && (
        <>
          <div className="playlist-picker-backdrop" onClick={() => { setPlaylistPickerOpen(false); setMenuTrack(null); }} />
          <div className="playlist-picker" role="dialog" aria-label="플레이리스트 선택">
            <h3>플레이리스트에 추가</h3>
            {playlists.map((playlist) => (
              <button
                key={playlist}
                onClick={() => {
                  const targetPlaylist = nativePlaylists.find((p) => p.name === playlist);
                  if (targetPlaylist) {
                    postNative("addTrackToPlaylist", { playlistId: targetPlaylist.id, track: menuTrack });
                  }
                  setPlaylistPickerOpen(false);
                  setMenuTrack(null);
                  setNotice(`'${menuTrack.title}'을(를) ${playlist}에 추가했습니다.`);
                  window.setTimeout(() => setNotice(""), 2200);
                }}
              >
                <ListPlus size={15} style={{ marginRight: 8 }} />{playlist}
              </button>
            ))}
            <button className="cancel" onClick={() => { setPlaylistPickerOpen(false); setMenuTrack(null); }}>취소</button>
          </div>
        </>
      )}

      {notice && <div className="notice">{notice}</div>}
    </div>
  );
}
