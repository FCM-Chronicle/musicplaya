import OptionWheel from "./OptionWheel";
import React, { useState, useEffect, useRef, useId, useCallback, useMemo } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Mic2, Timer, Headphones, ChevronLeft, Plus, Minus,
  SlidersHorizontal, ListMusic, Disc3, Folder, LayoutGrid,
  Users, Music2, Search, X, GripVertical, MoreHorizontal, ListPlus, Share2, Pencil,
} from "lucide-react";
import AnimatedList from "./AnimatedList";

/* ---------------------------------------------------------
   더미 데이터 상수 제거 및 기본값 설정
--------------------------------------------------------- */
const EMPTY_TRACK = { title: "재생할 곡 없음", artist: "라이브러리를 스캔하세요", album: "", duration: 0, c1: "#394B59", c2: "#C49A6C" };


const EQ_BANDS = ["60", "150", "400", "1k", "2.4k", "6k", "15k"];
const EQ_PRESETS = {
  플랫: [0, 0, 0, 0, 0, 0, 0],
};

const TABS = [
  { id: "queue", label: "대기열", icon: ListMusic },
  { id: "home", label: "재생", icon: Disc3 },
  { id: "folders", label: "폴더", icon: Folder },
  { id: "albums", label: "앨범", icon: LayoutGrid },
  { id: "playlists", label: "플레이리스트", icon: ListPlus },
  { id: "artists", label: "아티스트", icon: Users },
  { id: "genres", label: "장르", icon: Music2 },
  { id: "search", label: "검색", icon: Search },
];

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function postNative(action, payload = {}) {
  window.musicplaya?.postMessage(JSON.stringify({ action, ...payload }));
}

/* ---------------------------------------------------------
   GlassSurface React Bits 컴포넌트
--------------------------------------------------------- */
const GlassSurface = ({
  children,
  width = 200,
  height = 80,
  borderRadius = 20,
  borderWidth = 0.07,
  brightness = 50,
  opacity = 0.93,
  blur = 11,
  displace = 0,
  backgroundOpacity = 0,
  saturation = 1,
  distortionScale = -180,
  redOffset = 0,
  greenOffset = 10,
  blueOffset = 20,
  xChannel = "R",
  yChannel = "G",
  mixBlendMode = "difference",
  className = "",
  style = {},
}) => {
  const uniqueId = useId().replace(/:/g, "-");
  const filterId = `glass-filter-${uniqueId}`;
  const redGradId = `red-grad-${uniqueId}`;
  const blueGradId = `blue-grad-${uniqueId}`;

  const [svgSupported, setSvgSupported] = useState(false);

  const containerRef = useRef(null);
  const feImageRef = useRef(null);
  const redChannelRef = useRef(null);
  const greenChannelRef = useRef(null);
  const blueChannelRef = useRef(null);
  const gaussianBlurRef = useRef(null);

  const generateDisplacementMap = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    const actualWidth = rect?.width || 400;
    const actualHeight = rect?.height || 200;
    const edgeSize = Math.min(actualWidth, actualHeight) * (borderWidth * 0.5);

    const svgContent = `
      <svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="red"/>
          </linearGradient>
          <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" fill="black"></rect>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${redGradId})" />
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode: ${mixBlendMode}" />
        <rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${borderRadius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)" />
      </svg>
    `;

    return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
  };

  const updateDisplacementMap = () => {
    feImageRef.current?.setAttribute("href", generateDisplacementMap());
  };

  useEffect(() => {
    updateDisplacementMap();
    [
      { ref: redChannelRef, offset: redOffset },
      { ref: greenChannelRef, offset: greenOffset },
      { ref: blueChannelRef, offset: blueOffset },
    ].forEach(({ ref, offset }) => {
      if (ref.current) {
        ref.current.setAttribute("scale", (distortionScale + offset).toString());
        ref.current.setAttribute("xChannelSelector", xChannel);
        ref.current.setAttribute("yChannelSelector", yChannel);
      }
    });

    gaussianBlurRef.current?.setAttribute("stdDeviation", displace.toString());
  }, [width, height, borderRadius, borderWidth, brightness, opacity, blur, displace, distortionScale, redOffset, greenOffset, blueOffset, xChannel, yChannel, mixBlendMode]);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(updateDisplacementMap, 0);
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    setTimeout(updateDisplacementMap, 0);
  }, [width, height]);

  useEffect(() => {
    setSvgSupported(supportsSVGFilters());
  }, []);

  const supportsSVGFilters = () => {
    if (typeof window === "undefined" || typeof document === "undefined") return false;
    const isWebkit = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    if (isWebkit || isFirefox) return false;
    const div = document.createElement("div");
    div.style.backdropFilter = `url(#${filterId})`;
    return div.style.backdropFilter !== "";
  };

  const containerStyle = {
    ...style,
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    borderRadius: `${borderRadius}px`,
    "--glass-frost": backgroundOpacity,
    "--glass-saturation": saturation,
    "--filter-id": `url(#${filterId})`,
  };

  return (
    <div
      ref={containerRef}
      className={`glass-surface ${svgSupported ? "glass-surface--svg" : "glass-surface--fallback"} ${className}`}
      style={containerStyle}
    >
      <svg className="glass-surface__filter" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
            <feImage ref={feImageRef} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
            <feDisplacementMap ref={redChannelRef} in="SourceGraphic" in2="map" result="dispRed" />
            <feColorMatrix in="dispRed" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="red" />
            <feDisplacementMap ref={greenChannelRef} in="SourceGraphic" in2="map" result="dispGreen" />
            <feColorMatrix in="dispGreen" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="green" />
            <feDisplacementMap ref={blueChannelRef} in="SourceGraphic" in2="map" result="dispBlue" />
            <feColorMatrix in="dispBlue" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="blue" />
            <feBlend in="red" in2="green" mode="screen" result="rg" />
            <feBlend in="rg" in2="blue" mode="screen" result="output" />
            <feGaussianBlur ref={gaussianBlurRef} in="output" stdDeviation="0.7" />
          </filter>
        </defs>
      </svg>
      <div className="glass-surface__content">{children}</div>
    </div>
  );
};

/* ---------------------------------------------------------
   OptionWheel React Bits 컴포넌트
--------------------------------------------------------- */
const LocalOptionWheel = ({
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
  const activeIndex = tabs.findIndex((t) => t.id === activeId);
  return (
    <div className="tabbar-wrap">
      <GlassSurface className="tabbar-glass" borderRadius={22}>
        <div className="tabbar-inner">
          <div className="tabbar-pill" style={{ width: `${100 / tabs.length}%`, transform: `translateX(${activeIndex * 100}%)` }} />
          {tabs.map((tab) => (
            <button key={tab.id} className={`tabbar-btn ${activeId === tab.id ? "active" : ""}`} onClick={() => onSelect(tab.id)}>
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </GlassSurface>
    </div>
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
  const [lyricsEditing, setLyricsEditing] = useState(false);
  const [lyricsLines, setLyricsLines] = useState(() => []);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [menuTrack, setMenuTrack] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [playlistTracks, setPlaylistTracks] = useState({});
  const [nativePlaylists, setNativePlaylists] = useState([]);
  const [playlistPickerOpen, setPlaylistPickerOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showPlaylistNameInput, setShowPlaylistNameInput] = useState(false);
  const [notice, setNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [karaokeOn, setKaraokeOn] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [earSafeLock, setEarSafeLock] = useState(true);
  const [sleepMinutes, setSleepMinutes] = useState(null);
  const [sleepTrackCount, setSleepTrackCount] = useState(null);
  const [remainingSleepTracks, setRemainingSleepTracks] = useState(null);
  const [eqOn, setEqOn] = useState(false);
  const [eqBands, setEqBands] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [eqPreset, setEqPreset] = useState("플랫");
  const [openFolder, setOpenFolder] = useState(null);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [genreIndex, setGenreIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedQueueIndex, setDraggedQueueIndex] = useState(null);
  const [dragOverQueueIndex, setDragOverQueueIndex] = useState(null);
  const [queueMoveIndex, setQueueMoveIndex] = useState(null);
  const intervalRef = useRef(null);

  const TRACK = queueItems[currentTrackIndex] || EMPTY_TRACK;
  useEffect(() => {
    if (TRACK.embeddedLyrics) {
      const lines = TRACK.embeddedLyrics.split('\n').map(l => { const m = l.match(/\[(\d+):(\d+\.\d+)\](.*)/); return m ? { t: parseInt(m[1])*60 + parseFloat(m[2]), line: m[3] } : null }).filter(Boolean);
      setLyricsLines(lines.length ? lines : []);
    } else {
      setLyricsLines([]);
    }
  }, [TRACK.embeddedLyrics]);

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

  const moveQueueItem = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex == null || toIndex == null) return;
    const nextQueue = [...queueItems];
    const [movedItem] = nextQueue.splice(fromIndex, 1);
    nextQueue.splice(toIndex, 0, movedItem);
    setQueueItems(nextQueue);
    if (currentTrackIndex === fromIndex) setCurrentTrackIndex(toIndex);
  };

  return (
    <div className="player-app">
      <style>{`
        * { box-sizing: border-box; }
        body { background: #0b0b0e; color: #efece6; font-family: 'Manrope', sans-serif; }
        .player-app { height: 100dvh; overflow: hidden; position: relative; }
        .content { height: 100%; overflow-y: auto; padding: 20px; }
        .tabbar-wrap { position: absolute; bottom: 18px; width: 100%; z-index: 20; }
        .screen { display: flex; flex-direction: column; gap: 10px; }
        .album-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .queue-row, .album-track-row { display: flex; align-items: center; gap: 10px; padding: 10px; background: #1a1a20; border-radius: 10px; }
        .art-chip { width: 40px; height: 40px; border-radius: 8px; }
        .search-empty { text-align: center; color: #85838c; margin-top: 20px; }
        .playlist-add { background: #202027; color: #efece6; border: 1px solid #29292f; padding: 12px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
      `}</style>
      <div className="content">
        {activeTab === "home" && (
          <div className="screen">
            <div className="art-basic" style={artStyle(TRACK)} />
            <p>{TRACK.title}</p>
            <p>{TRACK.artist}</p>
            <button className="play-btn" onClick={togglePlayback}>{playing ? "일시정지" : "재생"}</button>
          </div>
        )}
        {activeTab === "queue" && (
          <div className="screen">
            <AnimatedList items={queueItems}>
              {(t, i) => (
                <div className="queue-row" onClick={() => playFromQueue(i)}>
                  <div className="art-chip" style={artStyle(t)} />
                  <div><p>{t.title}</p><p>{t.artist}</p></div>
                </div>
              )}
            </AnimatedList>
          </div>
        )}
        {activeTab === "folders" && (
          <div className="screen">
            <p className="screen-title">폴더</p>
            <p className="screen-sub">기기에서 음악 파일을 찾은 위치</p>
            <div className="folder-list">
              <button className="playlist-add" onClick={() => postNative("scanEntireDevice")}><Plus size={15} /> 기기 전체 음악 스캔하기</button>
              {derivedFolders.length === 0 && <p className="search-empty">스캔된 폴더가 없습니다. 위 버튼으로 스캔하세요.</p>}
              <AnimatedList items={derivedFolders}>
                {(f) => (
                  <div className="folder-row" onClick={() => setOpenFolder(openFolder === f.path ? null : f.path)}>
                    <div className="head">
                      <div className="name"><Folder size={15} />{f.name}</div>
                      <span className="count">{f.tracks.length}곡</span>
                    </div>
                    <p className="path">{f.path}</p>
                    {openFolder === f.path && (
                      <div className="folder-detail">
                        <AnimatedList items={f.tracks} displayScrollbar={false} showGradients={false}>
                          {(track, idx) => (
                            <div className="album-track-row" onClick={(e) => { e.stopPropagation(); playFromContext(f.tracks, idx); }}>
                              <span className="number">{String(idx + 1).padStart(2, "0")}</span>
                              <div className="art-chip" style={artStyle(track)} />
                              <div className="meta"><p className="title">{track.title}</p><p className="artist">{track.artist}</p></div>
                              <span className="duration">{formatTime(track.duration)}</span>
                            </div>
                          )}
                        </AnimatedList>
                      </div>
                    )}
                  </div>
                )}
              </AnimatedList>
            </div>
          </div>
        )}
        {activeTab === "albums" && (
          <div className="screen">
            {selectedAlbum ? (
              <>
                <button className="icon-btn" onClick={() => setSelectedAlbum(null)} aria-label="앨범 목록으로 돌아가기"><ChevronLeft size={18} /></button>
                <div className="album-detail-head">
                  <div className="album-detail-art" style={
                    selectedAlbum.artworkB64
                      ? { backgroundImage: `url(${selectedAlbum.artworkB64})`, backgroundSize: "cover", backgroundPosition: "center" }
                      : { background: `radial-gradient(circle at 26% 22%, ${selectedAlbum.c1} 0%, transparent 58%), radial-gradient(circle at 78% 76%, ${selectedAlbum.c2} 0%, transparent 55%), linear-gradient(160deg, #24242c 0%, #121216 100%)` }
                  } />
                  <div><h2>{selectedAlbum.title}</h2><p>{selectedAlbum.artist} · {selectedAlbum.tracks ? selectedAlbum.tracks.length : queueItems.filter((track) => track.album === selectedAlbum.title).length}곡</p></div>
                </div>
                <div className="album-track-list">
                  {(() => {
                    const albumTracks = selectedAlbum.tracks || queueItems.filter((track) => track.album === selectedAlbum.title);
                    return <AnimatedList items={albumTracks}>
                      {(track, index) => (
                      <div className="album-track-row" key={track.filePath || track.title + index} onClick={() => playFromContext(albumTracks, index)}>
                        <span className="number">{String(index + 1).padStart(2, "0")}</span>
                        <div className="art-chip" style={artStyle(track)} />
                        <div className="meta"><p className="title">{track.title}</p><p className="artist">{track.artist}</p></div>
                        <span className="duration">{formatTime(track.duration)}</span>
                        <button className="icon-btn" onClick={(event) => { event.stopPropagation(); openTrackMenu(track); }} aria-label={`${track.title} 메뉴`}><MoreHorizontal size={18} /></button>
                      </div>
                      )}
                    </AnimatedList>;
                  })()}
                </div>
              </>
            ) : (
              <>
                <p className="screen-title">앨범</p>
                <p className="screen-sub">{derivedAlbums.length}개 앨범</p>
                <AnimatedList items={derivedAlbums} className="animated-list--grid">
                  {(a) => <AlbumCard album={a} onOpen={(album) => setSelectedAlbum(album)} />}
                </AnimatedList>
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
                <div className="album-track-list">
                  {(() => {
                    const pTracks = playlistTracks[playlists[selectedPlaylist]] || [];
                    if (pTracks.length === 0) return <p className="search-empty">곡 메뉴에서 플레이리스트에 추가할 수 있어요.</p>;
                    return <AnimatedList items={pTracks}>
                      {(track, index) => (
                      <div className="album-track-row" key={track.title + index} onClick={() => playFromContext(pTracks, index)}>
                        <span className="number">{String(index + 1).padStart(2, "0")}</span>
                        <div className="art-chip" style={artStyle(track)} />
                        <div className="meta"><p className="title">{track.title}</p><p className="artist">{track.artist}</p></div>
                        <span className="duration">{formatTime(track.duration)}</span>
                      </div>
                      )}
                    </AnimatedList>;
                  })()}
                </div>
              </>
            ) : (
              <>
                <p className="screen-title">플레이리스트</p>
                <p className="screen-sub">곡 메뉴에서 플레이리스트에 추가할 수 있어요</p>
                <div className="playlist-list">
                  <AnimatedList items={playlists}>
                    {(playlist, idx) => (
                    <div className="folder-row" key={playlist} onClick={() => setSelectedPlaylist(idx)} style={{ cursor: "pointer" }}>
                      <div className="head">
                        <div className="name"><ListPlus size={15} />{playlist}</div>
                        <span className="count">{(playlistTracks[playlist] || []).length}곡</span>
                      </div>
                    </div>
                    )}
                  </AnimatedList>
                  {showPlaylistNameInput ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <input
                        autoFocus
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newPlaylistName.trim()) {
                            postNative("createPlaylist", { name: newPlaylistName.trim() });
                            setNewPlaylistName("");
                            setShowPlaylistNameInput(false);
                          } else if (e.key === "Escape") {
                            setNewPlaylistName("");
                            setShowPlaylistNameInput(false);
                          }
                        }}
                        placeholder="플레이리스트 이름 입력"
                        style={{ flex: 1, padding: "10px 14px", border: "1px solid #29292f", borderRadius: 10, background: "#1a1a20", color: "#efece6", font: "13px 'Manrope'", outline: "none" }}
                      />
                      <button className="playlist-add" style={{ width: "auto", marginTop: 0 }} onClick={() => {
                        if (newPlaylistName.trim()) {
                          postNative("createPlaylist", { name: newPlaylistName.trim() });
                          setNewPlaylistName("");
                          setShowPlaylistNameInput(false);
                        }
                      }}>확인</button>
                    </div>
                  ) : (
                    <button className="playlist-add" onClick={() => setShowPlaylistNameInput(true)}><Plus size={15} /> 새 플레이리스트 만들기</button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "artists" && (
          <div className="screen">
            <p className="screen-title">아티스트</p>
            <p className="screen-sub">{derivedArtists.length}명</p>
            <AnimatedList items={derivedArtists} className="animated-list--grid">
              {(name) => (
                <div
                  key={name}
                  className={`artist-card ${selectedArtist === name ? "active" : ""}`}
                  onClick={() => setSelectedArtist(selectedArtist === name ? null : name)}
                >
                  <p>{name}</p>
                </div>
              )}
            </AnimatedList>
            {selectedArtist && (
              <div className="artist-tracks">
                <p className="artist-tracks__title">{selectedArtist}의 곡</p>
                {(() => {
                  const artistTracks = queueItems.filter((track) => track.artist === selectedArtist);
                  return <AnimatedList items={artistTracks}>
                    {(track, index) => (
                    <div
                      className="artist-track-row"
                      key={track.filePath || track.title}
                      onClick={() => playFromContext(artistTracks, index)}
                    >
                      <div className="art-chip" style={artStyle(track)} />
                      <div className="meta">
                        <p className="t">{track.title}</p>
                        <p className="a">{track.album} · {formatTime(track.duration)}</p>
                      </div>
                    </div>
                    )}
                  </AnimatedList>;
                })()}
              </div>
            )}
          </div>
        )}

        {activeTab === "genres" && (
          <div className="genre-screen">
            <p className="screen-title">장르</p>
            <p className="screen-sub">스크롤해서 장르를 골라보세요</p>
            <div className="genre-wheel-stage">
              <OptionWheel items={derivedGenres.length ? derivedGenres : ["Unknown"]} defaultSelected={genreIndex} onChange={(idx) => setGenreIndex(idx)} side="left" />
            </div>
            <div className="genre-picked">
              <span className="label">선택된 장르</span>
              <p className="name">{derivedGenres[genreIndex] || "Unknown"}</p>
            </div>
            <div className="genre-track-list">
              {(() => {
                const selectedGenre = derivedGenres[genreIndex] || "Unknown";
                const genreTracks = queueItems.filter(t => selectedGenre === "Unknown" ? !t.genre : t.genre === selectedGenre);
                return <AnimatedList items={genreTracks}>
                  {(t, index) => (
                  <div
                    className="genre-track-row"
                    key={t.filePath || t.title || index}
                    onClick={() => playFromContext(genreTracks, index)}
                    style={{ cursor: "pointer" }}
                  >
                    <span className="genre-track-number">{(index < 9 ? "0" : "") + (index + 1)}</span>
                    <div>
                      <p>{t.title || "Unknown"}</p>
                      <span>{selectedGenre} · {t.artist || "Unknown"}</span>
                    </div>
                  </div>
                  )}
                </AnimatedList>;
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
                      <AnimatedList items={foundTracks}>
                        {(t, i) => (
                        <div key={t.filePath || i} className="queue-row" onClick={() => playFromQueue(queueItems.indexOf(t))}>
                          <div className="art-chip" style={artStyle(t)} />
                          <div><p>{t.title}</p><p style={{ fontSize: 11, color: "#85838c" }}>{t.artist}</p></div>
                        </div>
                        )}
                      </AnimatedList>
                    </>
                  )}
                  {foundAlbums.length > 0 && (
                    <>
                      <p className="search-group-label">앨범</p>
                      <AnimatedList items={foundAlbums} className="animated-list--grid">
                        {(a) => <AlbumCard album={a} onOpen={(album) => { setSelectedAlbum(album); setActiveTab("albums"); }} />}
                      </AnimatedList>
                    </>
                  )}
                  {foundArtists.length > 0 && (
                    <>
                      <p className="search-group-label">아티스트</p>
                      <AnimatedList items={foundArtists}>
                        {(name) => (
                        <div key={name} className="artist-card" onClick={() => { setSelectedArtist(name); setActiveTab("artists"); }}>
                          <p>{name}</p>
                        </div>
                        )}
                      </AnimatedList>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {activeTab !== "equalizer" && <GlassTabBar tabs={TABS} activeId={activeTab} onSelect={handleTabSelect} />}

      <div className={`sheet-backdrop ${settingsOpen ? "open" : ""}`} onClick={() => setSettingsOpen(false)} />
      <div className={`sheet ${settingsOpen ? "open" : ""}`}>
        <div className="sheet-handle" />
        <p className="sheet-title">재생 옵션</p>

        <div className="sheet-row">
          <div className="label">
            <Mic2 size={16} />
            <span>노래방 모드<span className="sub">원상 반전 보컬 제거 · 키 보존</span></span>
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
          <div className="label"><span>키 조절<span className="sub">반음 단위 위치 시프트</span></span></div>
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
            <span>이어폰 안전 볼륨<span className="sub">한계 넘기면 즉시 일시정지 + 볼륨 0</span></span>
          </div>
          <div className={`switch ${earSafeLock ? "on" : ""}`} onClick={() => setEarSafeLock((v) => !v)}>
            <div className="knob" />
          </div>
        </div>

        <div className="sheet-row">
          <div className="label">
            <Timer size={16} />
            <span>수면 타이머{sleepMinutes ? <span className="sub">{`${sleepMinutes}분 후 정지`}</span> : null}{remainingSleepTracks ? <span className="sub">{`${remainingSleepTracks}곡 후 정지`}</span> : null}</span>
          </div>
          <div className="sleep-control">
            <div className="sleep-custom">
              <input
                type="text"
                inputMode="numeric"
                min="1"
                max="240"
                placeholder="직접 입력"
                value={sleepMinutes ?? ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                  const value = digits === "" ? null : Math.min(240, Math.max(1, Number(digits)));
                  setSleepMinutes(value);
                }}
                aria-label="수면 타이머 분"
              />
              <span>분</span>
            </div>
            <div className="sleep-opts">
              {[15, 30, 60].map((m) => (
                <button key={m} className={sleepMinutes === m ? "on" : ""} onClick={() => setSleepMinutes(sleepMinutes === m ? null : m)}>{m}분</button>
              ))}
            </div>
            <div className="sleep-track-opts">
              <span>곡 수</span>
              {[1, 2, 3, 5].map((count) => (
                <button
                  key={count}
                  className={sleepTrackCount === count ? "on" : ""}
                  onClick={() => {
                    const next = sleepTrackCount === count ? null : count;
                    setSleepTrackCount(next);
                    setRemainingSleepTracks(next);
                  }}
                >
                  {count}곡
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

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
            <AnimatedList items={playlists} showGradients={false} displayScrollbar={false}>
              {(playlist) => (
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
              )}
            </AnimatedList>
            <button className="cancel" onClick={() => { setPlaylistPickerOpen(false); setMenuTrack(null); }}>취소</button>
          </div>
        </>
      )}
      {notice && <div className="notice">{notice}</div>}
    </div>
  );

  function playFromQueueSilently(delta) {
    if (remainingSleepTracks === 1) {
      setPlaying(false);
      setSleepTrackCount(null);
      setRemainingSleepTracks(null);
      return;
    }
    if (remainingSleepTracks) setRemainingSleepTracks((count) => count - 1);
    const next = (currentTrackIndex + delta + queueItems.length) % queueItems.length;
    setCurrentTrackIndex(next);
    setProgress(0);
    postNative(delta < 0 ? "previous" : "next");
  }
}
