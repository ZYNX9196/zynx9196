import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import importPayload from "./import_payload.json";

const STORAGE_KEYS = {
  works: "zynx_works_v2",
  playlists: "zynx_playlists_v2",
  poems: "zynx_poems_v2",
  terminal: "zynx_terminal_v2",
  payloadVersion: "zynx_payload_version_v1",
};

const ADMIN_SESSION_KEY = "zynx_admin_unlocked_v1";
const ADMIN_UNLOCK_COMMAND = "studio";
const ADMIN_PASSPHRASE = "zynx-9196";

const IMPORT_PAYLOAD = importPayload || {};
const DEFAULT_IMPORT_PAYLOAD_ID = IMPORT_PAYLOAD.payloadId || IMPORT_PAYLOAD.exportedAt || String(IMPORT_PAYLOAD.version || 0);

const TERMINAL_COMMANDS = [
  { command: "help", label: "show command index" },
  { command: "list", label: "scan the works" },
  { command: "open 1", label: "open a numbered piece" },
  { command: "random", label: "open a random piece" },
  { command: "latest", label: "newest works" },
  { command: "collections", label: "collection counts" },
  { command: "playlist", label: "current listening stack" },
  { command: "socials", label: "contact links" },
  { command: "prjcts", label: "project shelf" },
  { command: "signal", label: "site signal" },
  { command: "method", label: "working notes" },
  { command: "gallery", label: "return to gallery" },
  { command: "archive", label: "resource archive" },
  { command: "clear", label: "reset terminal" },
];

const DEFAULT_TERMINAL = normalizeTerminal(IMPORT_PAYLOAD.terminal || {
  introLines: [
    "ZYNX_9196 / local index",
    "type help for the full command index",
    "",
    "list          scan works",
    "open 1        open a work",
    "random        open a random piece",
    "latest        newest works",
    "signal        small signal",
  ],
  unknownResponse: ["command not found", "try: help / list / random / latest / gallery / archive"],
  galleryResponse: ["returning to gallery"],
  repeatOpenResponse: ["already opened", "revisiting"],
  firstOpenResponse: ["opening"],
  missingWorkResponse: ["no work at that number"],
  commands: [
    {
      id: crypto.randomUUID?.() || String(Date.now() + 3),
      trigger: "about",
      response: "image fragments / interfaces / unfinished systems\nsomewhere between archive and signal",
    },
    {
      id: crypto.randomUUID?.() || String(Date.now() + 4),
      trigger: "dream",
      response: "a room with too many exits\nan image trying to remember its source",
    },
    {
      id: crypto.randomUUID?.() || String(Date.now() + 5),
      trigger: "signal",
      response: "ZYNX_9196 is an index of pressure points\nimages as evidence, errors as texture, the page as a small machine",
    },
    {
      id: crypto.randomUUID?.() || String(Date.now() + 6),
      trigger: "method",
      response: "collect / distort / arrange / leave a trace\nif the system looks too clean, introduce friction",
    },
  ],
});

const DEFAULT_WORKS = Array.isArray(IMPORT_PAYLOAD.works) && IMPORT_PAYLOAD.works.length
  ? IMPORT_PAYLOAD.works
  : [
      {
        id: crypto.randomUUID?.() || String(Date.now()),
        title: "Velvet Static",
        year: "2026",
        note: "",
        alt: "",
        image: "",
        images: [],
        detailsTitle: "Velvet Static",
        detailsText: "Add details about this piece here.",
        medium: "",
        dimensions: "",
        collection: "main",
      },
    ];

const DEFAULT_PLAYLISTS = Array.isArray(IMPORT_PAYLOAD.playlists) && IMPORT_PAYLOAD.playlists.length
  ? IMPORT_PAYLOAD.playlists
  : [
      {
        id: crypto.randomUUID?.() || String(Date.now() + 1),
        title: "late tabs",
        description: "for looking around slowly",
        currentTrack: "",
        audioUrl: "",
        tracks: [],
      },
    ];

const DEFAULT_POEMS = Array.isArray(IMPORT_PAYLOAD.poems) && IMPORT_PAYLOAD.poems.length
  ? IMPORT_PAYLOAD.poems
  : [
      {
        id: crypto.randomUUID?.() || String(Date.now() + 2),
        title: "untitled fragment",
        note: "",
        body: "write here",
      },
    ];

const PUBLIC_WORK_IMAGES = getPublicWorkImages(DEFAULT_WORKS);

function makeId() {
  return crypto.randomUUID?.() || String(Date.now() + Math.random());
}

function makeArchiveCode() {
  return `ARC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function getArchiveResourceCode(work = {}) {
  if (work.archiveCode) return work.archiveCode;
  if (/^ARC-[A-Z0-9]{6}$/i.test(work.title || "")) return work.title.toUpperCase();
  const idPart = String(work.id || "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 6)
    .toUpperCase()
    .padEnd(6, "0");
  return `ARC-${idPart || "000000"}`;
}

function getArchiveDownloadName(work = {}) {
  const extension = String(work.image || "").match(/\.([a-z0-9]+)(?:[?#].*)?$/i)?.[1] || "png";
  return `${getArchiveResourceCode(work)}.${extension.toLowerCase()}`;
}

function safeLoad(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function safeSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Could not save ${key}:`, error);
    return false;
  }
}

function safeImageUrl(src) {
  if (!src) return "";
  return typeof src === "string" ? encodeURI(src) : src;
}

function getPublicImageName(src) {
  const value = String(src || "").trim();
  if (!value || /^(data:|https?:|blob:)/i.test(value)) return "";
  const cleanValue = value.replace(/^\/+/, "").split(/[?#]/)[0];
  if (!/\.(png|jpe?g|webp|gif)$/i.test(cleanValue)) return "";
  return cleanValue.split("/").pop();
}

function getPublicWorkImages(works = []) {
  const fileNames = works.flatMap((work) => [
    getPublicImageName(work.image),
    ...(Array.isArray(work.images) ? work.images.map(getPublicImageName) : []),
  ]);

  return [...new Set(fileNames.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function normalizeWork(work = {}, index = 0) {
  return {
    id: work.id || makeId(),
    title: work.title || `work ${index + 1}`,
    year: work.year || "",
    note: work.note || "",
    alt: work.alt || "",
    image: work.image || "",
    images: Array.isArray(work.images) ? work.images : [],
    detailsTitle: work.detailsTitle || work.title || `work ${index + 1}`,
    detailsText: work.detailsText || "",
    medium: work.medium || "",
    dimensions: work.dimensions || "",
    collection: work.collection || "main",
    archiveCode: work.archiveCode || "",
  };
}

function normalizePlaylistTrack(track = {}, index = 0) {
  return {
    id: track.id || makeId(),
    title: track.title || `track ${index + 1}`,
    url: track.url || "",
  };
}

function normalizePlaylist(playlist = {}, index = 0) {
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks.map(normalizePlaylistTrack) : [];

  return {
    id: playlist.id || makeId(),
    title: playlist.title || `playlist ${index + 1}`,
    description: playlist.description || "",
    currentTrack: playlist.currentTrack || (tracks[0]?.title || ""),
    audioUrl: playlist.audioUrl || "",
    tracks,
  };
}

function normalizePoem(poem = {}, index = 0) {
  return {
    id: poem.id || makeId(),
    title: poem.title || `poem ${index + 1}`,
    note: poem.note || "",
    body: poem.body || "",
  };
}

function normalizeTerminal(terminal = {}) {
  return {
    introLines: Array.isArray(terminal.introLines)
      ? terminal.introLines
      : DEFAULT_TERMINAL.introLines,
    unknownResponse: Array.isArray(terminal.unknownResponse)
      ? terminal.unknownResponse
      : DEFAULT_TERMINAL.unknownResponse,
    galleryResponse: Array.isArray(terminal.galleryResponse)
      ? terminal.galleryResponse
      : DEFAULT_TERMINAL.galleryResponse,
    repeatOpenResponse: Array.isArray(terminal.repeatOpenResponse)
      ? terminal.repeatOpenResponse
      : DEFAULT_TERMINAL.repeatOpenResponse,
    firstOpenResponse: Array.isArray(terminal.firstOpenResponse)
      ? terminal.firstOpenResponse
      : DEFAULT_TERMINAL.firstOpenResponse,
    missingWorkResponse: Array.isArray(terminal.missingWorkResponse)
      ? terminal.missingWorkResponse
      : DEFAULT_TERMINAL.missingWorkResponse,
    commands: Array.isArray(terminal.commands)
      ? terminal.commands.map((command, index) => ({
          id: command.id || makeId(),
          trigger: String(command.trigger || `command-${index + 1}`).toLowerCase().trim(),
          response: String(command.response || ""),
        }))
      : DEFAULT_TERMINAL.commands,
  };
}

function linesToText(lines) {
  return Array.isArray(lines) ? lines.join("\n") : "";
}

function textToLines(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trimEnd());
}

function getGalleryColumnCount(width = window.innerWidth) {
  if (width >= 1536) return 6;
  if (width >= 1280) return 5;
  if (width >= 1180) return 4;
  if (width >= 900) return 3;
  if (width >= 640) return 2;
  return 1;
}

function useGalleryColumnCount() {
  const [columnCount, setColumnCount] = useState(() =>
    typeof window === "undefined" ? 4 : getGalleryColumnCount(window.innerWidth)
  );

  useEffect(() => {
    const handleResize = () => setColumnCount(getGalleryColumnCount(window.innerWidth));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return columnCount;
}

function reorderIds(ids, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return ids;
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) return ids;

  const next = [...ids];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function swapIds(ids, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return ids;
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) return ids;

  const next = [...ids];
  [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
  return next;
}

function normalizePlaylistUrl(url) {
  let value = String(url || "").trim();
  if (!value) return "";
  if (/^www\./i.test(value)) value = `https://${value}`;
  if (isYoutubeUrl(value)) return "";

  if (/^data:audio\/(mpeg|mp3|ogg|wav|mp4|aac|flac|x-m4a);base64,/i.test(value)) {
    return value;
  }

  const googleDriveFileMatch = value.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  const googleDriveIdMatch = value.match(/drive\.google\.com\/.*[?&]id=([^&]+)/i);
  const googleDriveId = googleDriveFileMatch?.[1] || googleDriveIdMatch?.[1];
  if (googleDriveId) {
    return `https://drive.google.com/uc?export=download&id=${googleDriveId}`;
  }

  if (/^https?:\/\/(www\.)?dropbox\.com\//i.test(value)) {
    value = value.replace(/^https?:\/\/www\.dropbox\.com/i, "https://dl.dropboxusercontent.com");
    value = value.replace(/^https?:\/\/dropbox\.com/i, "https://dl.dropboxusercontent.com");
    value = value.replace(/[?&]dl=0\b/i, "?raw=1");
    if (!/[?&](raw|dl)=1\b/i.test(value)) {
      value += value.includes("?") ? "&raw=1" : "?raw=1";
    }
  }

  if (/^https?:\/\//i.test(value)) return value;
  if (/^(\/|\.\/|\.\.\/).*\.(mp3|ogg|wav|m4a|aac|flac)(\?.*)?$/i.test(value)) return value;

  return "";
}

function isAudioUrl(url) {
  return Boolean(normalizePlaylistUrl(url));
}

function isYoutubeUrl(url) {
  return /(^|\.)youtube\.com\/|(^|\.)youtu\.be\//i.test(String(url || "").trim());
}

function getYoutubeVideoId(url) {
  const value = String(url || "").trim();
  if (!isYoutubeUrl(value)) return "";

  const patterns = [
    /youtu\.be\/([^?&#/]+)/i,
    /youtube\.com\/watch\?.*?[?&]?v=([^?&#]+)/i,
    /youtube\.com\/embed\/([^?&#/]+)/i,
    /youtube\.com\/shorts\/([^?&#/]+)/i,
    /youtube\.com\/live\/([^?&#/]+)/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }

  return "";
}

function getYoutubePlaylistId(url) {
  const value = String(url || "").trim();
  if (!isYoutubeUrl(value)) return "";
  const match = value.match(/[?&]list=([^?&#]+)/i);
  return match?.[1] || "";
}

function getPlayablePlaylistTracks(playlists) {
  return playlists.flatMap((playlist, playlistIndex) => {
    const playlistId = playlist.id || `playlist-${playlistIndex}`;
    const playlistTitle = playlist.title || `playlist ${playlistIndex + 1}`;
    const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
    const playableTracks = tracks
      .map((track, trackIndex) => {
        const youtubeVideoId = getYoutubeVideoId(track.url);
        const youtubePlaylistId = youtubeVideoId ? "" : getYoutubePlaylistId(track.url);
        return {
          id: track.id || `${playlistId}-${trackIndex}`,
          playlistId,
          playlistTitle,
          title: track.title || playlist.currentTrack || playlistTitle || `track ${trackIndex + 1}`,
          source: youtubeVideoId ? "youtube" : youtubePlaylistId ? "youtubePlaylist" : "audio",
          url: youtubeVideoId || youtubePlaylistId ? track.url : normalizePlaylistUrl(track.url),
          youtubeVideoId,
          youtubePlaylistId,
        };
      })
      .filter((track) => track.url);

    const playlistYoutubeVideoId = getYoutubeVideoId(playlist.audioUrl);
    const playlistYoutubePlaylistId = playlistYoutubeVideoId ? "" : getYoutubePlaylistId(playlist.audioUrl);
    const playlistAudioUrl = normalizePlaylistUrl(playlist.audioUrl);
    if (playlistYoutubeVideoId || playlistYoutubePlaylistId || playlistAudioUrl) {
      playableTracks.push({
        id: `${playlistId}-fallback`,
        playlistId,
        playlistTitle,
        title: playlist.currentTrack || playlistTitle,
        source: playlistYoutubeVideoId ? "youtube" : playlistYoutubePlaylistId ? "youtubePlaylist" : "audio",
        url: playlistYoutubeVideoId || playlistYoutubePlaylistId ? playlist.audioUrl : playlistAudioUrl,
        youtubeVideoId: playlistYoutubeVideoId,
        youtubePlaylistId: playlistYoutubePlaylistId,
      });
    }

    return playableTracks;
  });
}

function getPlayablePlaylistOptions(playlists, tracks) {
  return playlists
    .map((playlist, index) => {
      const id = playlist.id || `playlist-${index}`;
      return {
        id,
        title: playlist.title || `playlist ${index + 1}`,
        trackCount: tracks.filter((track) => track.playlistId === id).length,
      };
    })
    .filter((playlist) => playlist.trackCount > 0);
}

function formatTrackDisplayTitle(title, artist) {
  const cleanTitle = String(title || "").trim();
  const cleanArtist = String(artist || "").trim();
  return [cleanTitle, cleanArtist].filter(Boolean).join(" | ");
}

function getTextValue(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(getTextValue).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    return getTextValue(value.simpleText || value.text || value.name || value.title);
  }
  return "";
}

function normalizeYoutubeMusicMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return null;

  const title = getTextValue(
    metadata.title ||
      metadata.song ||
      metadata.songTitle ||
      metadata.trackTitle ||
      metadata.track ||
      metadata.name
  );
  const artist = getTextValue(
    metadata.artist ||
      metadata.artists ||
      metadata.byArtist ||
      metadata.artistName ||
      metadata.albumArtist
  );

  return title || artist ? { title, artist, source: "music" } : null;
}

function getYoutubeTrackMetadata(player) {
  const videoData = player?.getVideoData?.() || {};
  const musicMetadata = [
    videoData.music,
    videoData.musicMetadata,
    videoData.videoDetails?.music,
    videoData.videoDetails?.musicMetadata,
    videoData.microformat?.music,
    videoData.playerResponse?.music,
    videoData.playerResponse?.videoDetails?.music,
    videoData.playerResponse?.microformat?.playerMicroformatRenderer?.music,
  ]
    .map(normalizeYoutubeMusicMetadata)
    .find(Boolean);

  if (musicMetadata) return musicMetadata;

  return {
    title: getTextValue(videoData.title),
    artist: getTextValue(videoData.author),
    source: "video",
  };
}

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector("script[src='https://www.youtube.com/iframe_api']");
    const previousReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve(window.YT);
    };

    if (existingScript) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function getPlaylistMediaUrl(playlist) {
  if (!playlist) return "";
  return normalizePlaylistUrl(playlist.audioUrl || "");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [mode, setMode] = useState("gallery");
  const [selectedWorkId, setSelectedWorkId] = useState(null);

  const savedWorks = safeLoad(STORAGE_KEYS.works, null);
  const savedPlaylists = safeLoad(STORAGE_KEYS.playlists, null);
  const savedPoems = safeLoad(STORAGE_KEYS.poems, null);
  const savedTerminal = safeLoad(STORAGE_KEYS.terminal, null);
  const savedPayloadVersion = safeLoad(STORAGE_KEYS.payloadVersion, null);
  const hasSavedData =
    savedWorks !== null || savedPlaylists !== null || savedPoems !== null || savedTerminal !== null;
  const shouldUseImportedPayload = !hasSavedData || savedPayloadVersion !== DEFAULT_IMPORT_PAYLOAD_ID;

  const [works, setWorks] = useState(() =>
    (shouldUseImportedPayload ? DEFAULT_WORKS : Array.isArray(savedWorks) ? savedWorks : DEFAULT_WORKS).map(normalizeWork)
  );
  const [playlists, setPlaylists] = useState(() =>
    (shouldUseImportedPayload ? DEFAULT_PLAYLISTS : Array.isArray(savedPlaylists) ? savedPlaylists : DEFAULT_PLAYLISTS).map(normalizePlaylist)
  );
  const [poems, setPoems] = useState(() =>
    (shouldUseImportedPayload ? DEFAULT_POEMS : Array.isArray(savedPoems) ? savedPoems : DEFAULT_POEMS).map(normalizePoem)
  );
  const [terminalConfig, setTerminalConfig] = useState(() =>
    normalizeTerminal(shouldUseImportedPayload ? DEFAULT_TERMINAL : savedTerminal || DEFAULT_TERMINAL)
  );

  useEffect(() => {
    if (shouldUseImportedPayload) {
      safeSave(STORAGE_KEYS.payloadVersion, DEFAULT_IMPORT_PAYLOAD_ID);
      safeSave(STORAGE_KEYS.works, DEFAULT_WORKS);
      safeSave(STORAGE_KEYS.playlists, DEFAULT_PLAYLISTS);
      safeSave(STORAGE_KEYS.poems, DEFAULT_POEMS);
      safeSave(STORAGE_KEYS.terminal, DEFAULT_TERMINAL);
    }
  }, [shouldUseImportedPayload]);

  const [terminalLines, setTerminalLines] = useState(terminalConfig.introLines);
  const [terminalInput, setTerminalInput] = useState("");
  const [openedWorkIds, setOpenedWorkIds] = useState([]);
  const [publicAdditionalImage, setPublicAdditionalImage] = useState("");
  const [activePlaylistId, setActivePlaylistId] = useState("");
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);

  useEffect(() => {
    safeSave(STORAGE_KEYS.works, works);
  }, [works]);

  useEffect(() => {
    safeSave(STORAGE_KEYS.playlists, playlists);
  }, [playlists]);

  useEffect(() => {
    safeSave(STORAGE_KEYS.poems, poems);
  }, [poems]);

  useEffect(() => {
    safeSave(STORAGE_KEYS.terminal, terminalConfig);
  }, [terminalConfig]);

  const unlockAdmin = () => {
    const passphrase = window.prompt("studio passphrase");
    if (passphrase !== ADMIN_PASSPHRASE) {
      setTerminalLines((prev) => [...prev, "access denied"]);
      return false;
    }

    try {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    } catch {
      // Session storage is a convenience only; keep the current tab unlocked.
    }

    setIsAdmin(true);
    setMode("gallery");
    setSelectedWorkId(null);
    setTerminalInput("");
    return true;
  };

  const lockAdmin = () => {
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // Ignore storage failures and still lock this tab.
    }

    setIsAdmin(false);
    setMode("gallery");
    setSelectedWorkId(null);
  };

  const allPlayerTracks = useMemo(() => getPlayablePlaylistTracks(playlists), [playlists]);
  const playablePlaylistOptions = useMemo(
    () => getPlayablePlaylistOptions(playlists, allPlayerTracks),
    [allPlayerTracks, playlists]
  );

  useEffect(() => {
    if (!playablePlaylistOptions.length) {
      setActivePlaylistId("");
      return;
    }

    if (!playablePlaylistOptions.some((playlist) => playlist.id === activePlaylistId)) {
      setActivePlaylistId(playablePlaylistOptions[0].id);
    }
  }, [activePlaylistId, playablePlaylistOptions]);

  const playerTracks = activePlaylistId
    ? allPlayerTracks.filter((track) => track.playlistId === activePlaylistId)
    : allPlayerTracks;
  const activeTrack = playerTracks[activeTrackIndex] || null;
  const activePlaylistTitle =
    playablePlaylistOptions.find((playlist) => playlist.id === activePlaylistId)?.title ||
    activeTrack?.playlistTitle ||
    "";
  const activePlaylistIndex = playablePlaylistOptions.findIndex((playlist) => playlist.id === activePlaylistId);
  const activeMediaUrl = activeTrack?.url || "";

  useEffect(() => {
    if (activeTrackIndex > 0 && activeTrackIndex >= playerTracks.length) {
      setActiveTrackIndex(Math.max(playerTracks.length - 1, 0));
    }
  }, [activeTrackIndex, playerTracks.length]);

  useEffect(() => {
    setActiveTrackIndex(0);
  }, [activePlaylistId]);

  const handleCommand = (cmd) => {
    const command = cmd.toLowerCase().trim();
    if (!command) return;

    const terminalWorks = works.filter((work) => (work.collection || "main").trim().toLowerCase() !== "archive");

    if (command === "clear") {
      setTerminalLines(terminalConfig.introLines);
      return;
    }

    setTerminalLines((prev) => [...prev, `> ${cmd}`]);

    let response = [];

    if (command === ADMIN_UNLOCK_COMMAND) {
      unlockAdmin();
      return;
    } else if (command === "lock") {
      lockAdmin();
      response = ["studio locked"];
    } else if (command === "help") {
      response = [
        "command index",
        "",
        ...TERMINAL_COMMANDS.map((item) => `${item.command.padEnd(13, " ")} ${item.label}`),
      ];
    } else if (command === "gallery") {
      setMode("gallery");
      setSelectedWorkId(null);
      response = terminalConfig.galleryResponse;
    } else if (command === "archive") {
      setMode("archive");
      setSelectedWorkId(null);
      response = ["showing archive"];
    } else if (command === "list") {
      response = terminalWorks.length
        ? terminalWorks.map((work, index) => {
            const collection = work.collection && work.collection !== "main" ? ` / ${work.collection}` : "";
            return `${index + 1}. ${work.title}${work.year ? ` (${work.year})` : ""}${collection}`;
          })
        : ["no works indexed"];
    } else if (command === "random") {
      const work = terminalWorks[Math.floor(Math.random() * terminalWorks.length)];
      if (work) {
        setSelectedWorkId(work.id);
        setOpenedWorkIds((prev) => (prev.includes(work.id) ? prev : [...prev, work.id]));
        response = ["random access", work.title, work.year ? `year: ${work.year}` : "year unknown"];
      } else {
        response = ["no works indexed"];
      }
    } else if (command === "latest") {
      const latestWorks = [...terminalWorks]
        .sort((a, b) => Number.parseInt(b.year || "0", 10) - Number.parseInt(a.year || "0", 10))
        .slice(0, 6);
      response = latestWorks.length
        ? ["newest signals", "", ...latestWorks.map((work) => `${work.year || "----"}  ${work.title}`)]
        : ["no dated works indexed"];
    } else if (command === "collections") {
      const counts = terminalWorks.reduce((acc, work) => {
        const key = (work.collection || "main").trim() || "main";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      response = Object.entries(counts).length
        ? ["collections", "", ...Object.entries(counts).map(([collection, count]) => `${collection}: ${count}`)]
        : ["no collections indexed"];
    } else if (command === "playlist") {
      response = playlists.length
        ? ["playlists", "", ...playlists.map((playlist, index) => `${index + 1}. ${playlist.title || "untitled playlist"}`)]
        : ["no playlists loaded"];
    } else if (command === "socials") {
      response = [
        "socials",
        "",
        "instagram | @zynx_9196",
        "substack | https://zynx9196.substack.com/",
        "email | signal@zynx9196.art",
      ];
    } else if (command === "prjcts") {
      response = poems.length
        ? ["PRJCTS", "", ...poems.map((project, index) => `${index + 1}. ${project.title || "untitled project"}`)]
        : ["PRJCTS is quiet for now", "empty shelf / available for future work"];
    } else if (command === "signal") {
      response = [
        "signal received",
        "ZYNX_9196 reads like an image archive with working memory",
        "gallery for finished pressure points / archive for reusable fragments / PRJCTS for future builds",
      ];
    } else if (command === "method") {
      response = [
        "method",
        "collect images until they start arguing with each other",
        "keep the interface plain enough that the work does the speaking",
        "leave room for accidents, versions, and unfinished systems",
      ];
    } else if (command.startsWith("open")) {
      const requestedIndex = Number.parseInt(command.split(" ")[1], 10) - 1;
      const work = terminalWorks[requestedIndex];

      if (work) {
        setSelectedWorkId(work.id);
        response = openedWorkIds.includes(work.id)
          ? [...terminalConfig.repeatOpenResponse, work.title]
          : [...terminalConfig.firstOpenResponse, work.title];
        setOpenedWorkIds((prev) => (prev.includes(work.id) ? prev : [...prev, work.id]));
      } else {
        response = terminalConfig.missingWorkResponse;
      }
    } else {
      const customCommand = terminalConfig.commands.find(
        (item) => item.trigger.toLowerCase().trim() === command
      );
      response = customCommand ? textToLines(customCommand.response) : terminalConfig.unknownResponse;
    }

    window.setTimeout(() => {
      setTerminalLines((prev) => [...prev, "...", ...response]);
    }, 200);
  };

  const navButtonClass = (targetMode) =>
    `relative px-1 py-1 text-center transition after:absolute after:inset-x-2 after:-bottom-0.5 after:h-px sm:min-h-0 sm:px-0 sm:py-0 sm:after:hidden ${
      mode === targetMode && !selectedWorkId
        ? "text-[#2e2e2b] after:bg-[#2e2e2b]"
        : "text-[#7a746a] after:bg-transparent hover:text-[#2e2e2b]"
    }`;

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f5f5f3] font-mono text-[#2e2e2b]">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[#e3e1dc]/70 bg-[#f5f5f3]/95 px-4 py-4 backdrop-blur sm:flex-nowrap md:px-7 md:py-4">
        <button
          type="button"
          onClick={() => {
            setMode("gallery");
            setSelectedWorkId(null);
          }}
          className="flex min-w-0 items-center gap-3 text-left sm:gap-2"
        >
          <img src="/logo.png" alt="ZYNX_9196 logo" className="h-10 w-10 shrink-0 object-contain sm:h-7 sm:w-7" />
          <span className="truncate text-[16px] tracking-widest sm:text-[12px] md:text-[13px]">ZYNX_9196</span>
        </button>

        <nav className="order-2 flex w-full items-center justify-between border-t border-[#e3e1dc]/70 pt-2 whitespace-nowrap text-[13px] uppercase tracking-[0.08em] sm:order-none sm:w-auto sm:justify-end sm:gap-3 sm:border-t-0 sm:pt-0 sm:text-left sm:text-[11px] sm:normal-case sm:tracking-normal md:gap-3 md:text-xs">
          <button
            type="button"
            onClick={() => {
              setMode("gallery");
              setSelectedWorkId(null);
            }}
            className={navButtonClass("gallery")}
          >
            gallery
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("archive");
              setSelectedWorkId(null);
            }}
            className={navButtonClass("archive")}
          >
            archive
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("terminal");
              setSelectedWorkId(null);
            }}
            className={navButtonClass("terminal")}
          >
            terminal
          </button>
        </nav>
      </header>

      {isAdmin ? (
        <Admin
          works={works}
          setWorks={setWorks}
          playlists={playlists}
          setPlaylists={setPlaylists}
          poems={poems}
          setPoems={setPoems}
          terminalConfig={terminalConfig}
          setTerminalConfig={setTerminalConfig}
          resetTerminal={() => setTerminalLines(terminalConfig.introLines)}
          publicAdditionalImage={publicAdditionalImage}
          setPublicAdditionalImage={setPublicAdditionalImage}
          onLock={lockAdmin}
        />
      ) : selectedWorkId ? (
        <WorkDetails
          work={works.find((work) => work.id === selectedWorkId)}
          onBack={() => setSelectedWorkId(null)}
        />
      ) : mode === "gallery" ? (
        <Gallery
          works={works}
          poems={poems}
          onSelectWork={setSelectedWorkId}
        />
      ) : mode === "archive" ? (
        <Archive works={works} />
      ) : (
        <Terminal
          lines={terminalLines}
          input={terminalInput}
          setInput={setTerminalInput}
          onCommand={handleCommand}
          customCommands={terminalConfig.commands}
        />
      )}
      {!isAdmin && playerTracks.length ? (
        <div className="hidden md:block">
          <PlayerWidget
            tracks={playerTracks}
            playlistOptions={playablePlaylistOptions}
            activePlaylistId={activePlaylistId}
            setActivePlaylistId={setActivePlaylistId}
            activePlaylistTitle={activePlaylistTitle}
            activePlaylistIndex={activePlaylistIndex}
            activeTrackIndex={activeTrackIndex}
            setActiveTrackIndex={setActiveTrackIndex}
            activeMediaUrl={activeMediaUrl}
            activeTrack={activeTrack}
          />
        </div>
      ) : null}
      <style>{`
        .masonry-work-image {
          filter: drop-shadow(0 0 0 transparent);
        }
        button:hover > .masonry-work-image {
          filter:
            drop-shadow(2px 0 0 rgba(255, 32, 92, 0.48))
            drop-shadow(-2px 0 0 rgba(0, 214, 255, 0.42));
          transform: translate3d(0.75px, 0, 0);
        }
      `}</style>
    </div>
  );
}

function Gallery({ works, poems, onSelectWork }) {
  const [activePoemId, setActivePoemId] = useState(poems[0]?.id || null);
  const [activeCollection, setActiveCollection] = useState("all");

  useEffect(() => {
    if (!poems.some((poem) => poem.id === activePoemId)) {
      setActivePoemId(poems[0]?.id || null);
    }
  }, [poems, activePoemId]);

  useEffect(() => {
    const visibleWorks = works.filter((work) => (work.collection || "main").trim().toLowerCase() !== "archive");
    const collections = ["all", ...new Set(visibleWorks.map((work) => (work.collection || "main").trim() || "main"))];
    if (!collections.includes(activeCollection)) {
      setActiveCollection("all");
    }
  }, [works, activeCollection]);

  const activePoem = poems.find((poem) => poem.id === activePoemId) || poems[0] || null;

  const visibleWorks = works.filter((work) => (work.collection || "main").trim().toLowerCase() !== "archive");
  const collectionNames = [
    "all",
    ...Array.from(new Set(visibleWorks.map((work) => (work.collection || "main").trim() || "main"))),
  ];

  const filteredWorks = activeCollection === "all"
    ? visibleWorks
    : visibleWorks.filter((work) => ((work.collection || "main").trim() || "main") === activeCollection);

  return (
    <main className="space-y-5 px-4 pb-28 pt-4 md:space-y-6 md:p-6 md:pb-32">
      <label className="-mx-4 flex items-center justify-between border-b border-[#e3e1dc]/70 px-4 pb-3 text-[11px] uppercase tracking-[0.12em] text-[#8a857a] md:hidden">
        <span>collection</span>
        <select
          value={activeCollection}
          onChange={(event) => setActiveCollection(event.target.value)}
          className="max-w-[58vw] border-0 bg-transparent text-right text-[11px] uppercase tracking-[0.12em] text-[#2e2e2b] outline-none"
          aria-label="choose collection"
        >
          {collectionNames.map((collectionName) => (
            <option key={collectionName} value={collectionName}>
              {collectionName === "all" ? "all" : collectionName}
            </option>
          ))}
        </select>
      </label>

      <div className="hidden gap-1 overflow-x-auto pb-1 text-[11px] text-[#7a746a] md:flex md:flex-wrap md:overflow-visible md:text-xs">
        {collectionNames.map((collectionName) => (
          <button
            key={collectionName}
            type="button"
            onClick={() => setActiveCollection(collectionName)}
            className={`min-h-8 shrink-0 rounded-none px-3 py-1.5 transition md:min-h-0 md:border md:px-2.5 md:py-1 ${
              activeCollection === collectionName
                ? "bg-[#2e2e2b] text-[#f5f5f3] md:border-[#2e2e2b]"
                : "text-[#7c776d] hover:bg-[#f0eee9] md:border-[#e3e1dc] md:bg-[#faf9f6]"
            }`}
          >
            {collectionName === "all" ? "all" : collectionName}
          </button>
        ))}
      </div>

      {filteredWorks.length ? (
        <MasonryWorkGrid works={filteredWorks} onSelectWork={onSelectWork} />
      ) : (
        <EmptyState label="no works yet" hint="new work will appear here soon" />
      )}

      <SubstackSection />
    </main>
  );
}

function Archive({ works }) {
  const archivedWorks = works.filter(
    (work) => ((work.collection || "main").trim().toLowerCase() === "archive")
  );

  return (
    <main className="space-y-5 px-4 pb-28 pt-4 md:space-y-6 md:p-6 md:pb-32">
      {archivedWorks.length ? (
        <MasonryWorkGrid
          works={archivedWorks}
          renderFooter={(work) => (
            <div className="bg-[#f6f5f2]/95 px-2.5 py-2 text-[11px]">
              <div className="truncate">{getArchiveResourceCode(work)}</div>
              <a
                href={safeImageUrl(work.image || "")}
                download={getArchiveDownloadName(work)}
                onClick={(event) => event.stopPropagation()}
                className="mt-1 inline-block border border-[#e3e1dc] px-2 py-1 text-[10px] text-[#4a4742] hover:bg-[#f0eee9]"
              >
                download image
              </a>
            </div>
          )}
        />
      ) : (
        <EmptyState label="no archived works" hint="archive resources will appear here soon" />
      )}
    </main>
  );
}

function SubstackSection() {
  return (
    <section className="border border-[#e3e1dc] bg-[#faf9f6] p-4">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[#8a857a] mb-2">
        transmissions
      </div>

      <div className="text-xs text-[#7a746a] mb-3">
        if you want to receive things sometimes
      </div>

      <form
        action="https://zynx9196.substack.com/api/v1/free"
        method="post"
        target="popupwindow"
        onSubmit={() => window.open('https://zynx9196.substack.com', 'popupwindow')}
        className="flex gap-2"
      >
        <input
          type="email"
          name="email"
          placeholder="your email"
          className="flex-1 border border-[#e3e1dc] bg-[#f6f5f2] p-2 text-xs outline-none"
          required
        />
        <button
          type="submit"
          className="border border-[#e3e1dc] px-3 text-xs hover:bg-[#f0eee9]"
        >
          enter
        </button>
      </form>
    </section>
  );
}

function ProjectsSection({ projects }) {
  return (
    <section className="overflow-hidden rounded-none border border-[#e3e1dc] bg-[#f6f5f2] md:rounded-none">
      <div className="border-b border-[#e3e1dc] px-4 py-3 text-[11px] uppercase tracking-[0.12em] text-[#8a857a]">
        PRJCTS
      </div>

      {projects.length ? (
        <div className="grid md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="bg-[#f2f1ee]">
            {projects.map((project) => {
              return (
                <div
                  key={project.id}
                  className="border-b border-[#e3e1dc] px-4 py-3 text-xs last:border-b-0"
                >
                  <div>{project.title || "untitled project"}</div>
                  <div className="mt-1 text-[11px] text-[#9a9489]">{project.note || "project"}</div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-[#e3e1dc] bg-[#faf9f6] p-4 text-xs leading-6 text-[#7a746a] md:border-l md:border-t-0">
            view paused for now
          </div>
        </div>
      ) : (
        <EmptyState label="PRJCTS coming later" hint="project notes will appear here soon" />
      )}
    </section>
  );
}

function PlayerWidget({
  tracks,
  playlistOptions,
  activePlaylistId,
  setActivePlaylistId,
  activePlaylistTitle,
  activePlaylistIndex,
  activeTrackIndex,
  setActiveTrackIndex,
  activeMediaUrl,
  activeTrack,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerStatus, setPlayerStatus] = useState("");
  const [isYoutubeReady, setIsYoutubeReady] = useState(false);
  const [youtubeTrackMeta, setYoutubeTrackMeta] = useState({ title: "", artist: "", source: "" });
  const [isTitleOverflowing, setIsTitleOverflowing] = useState(false);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const audioRef = useRef(null);
  const youtubeHostRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const titleViewportRef = useRef(null);
  const titleTextRef = useRef(null);
  const pendingYoutubePlayRef = useRef(false);
  const shouldResumePlaybackRef = useRef(false);
  const isYoutubeVideo = activeTrack?.source === "youtube" && Boolean(activeTrack?.youtubeVideoId);
  const isYoutubePlaylist = activeTrack?.source === "youtubePlaylist" && Boolean(activeTrack?.youtubePlaylistId);
  const isYoutube = isYoutubeVideo || isYoutubePlaylist;
  const isAudio = !isYoutube && isAudioUrl(activeMediaUrl);
  const canPlay = isYoutube || isAudio;
  const youtubeTitle = isYoutube ? youtubeTrackMeta.title : "";
  const youtubeArtist = isYoutube ? youtubeTrackMeta.artist : "";
  const currentTitle = youtubeTitle
    ? formatTrackDisplayTitle(youtubeTitle, youtubeArtist)
    : activeTrack?.title || "select audio";
  const titleScrollDuration = `${Math.min(42, Math.max(18, currentTitle.length * 0.58))}s`;
  const canNavigate = Array.isArray(tracks) && tracks.length > 1;
  const canUsePlayerNavigation = isYoutubePlaylist || canNavigate;
  const playlistCounter =
    playlistOptions.length && activePlaylistIndex >= 0
      ? `${activePlaylistIndex + 1}/${playlistOptions.length}`
      : "";

  const updateYoutubeTrackTitle = useCallback(() => {
    const metadata = getYoutubeTrackMetadata(youtubePlayerRef.current);
    if (metadata.title || metadata.artist) setYoutubeTrackMeta(metadata);
  }, []);

  const handlePlayPause = () => {
    if (isYoutube) {
      const player = youtubePlayerRef.current;
      if (!player || !isYoutubeReady) {
        pendingYoutubePlayRef.current = true;
        setPlayerStatus("youtube player is loading");
        return;
      }

      setPlayerStatus("");
      if (isPlaying) {
        player.pauseVideo();
        setIsPlaying(false);
      } else {
        player.playVideo();
        setIsPlaying(true);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio || !isAudio) return;

    if (audio.paused) {
      setPlayerStatus("");
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false);
          setPlayerStatus("link is not a direct playable audio file");
        });
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handlePrev = () => {
    if (isYoutubePlaylist) {
      if (!isYoutubeReady || !youtubePlayerRef.current) {
        setPlayerStatus("youtube player is loading");
        return;
      }
      youtubePlayerRef.current.previousVideo();
      window.setTimeout(updateYoutubeTrackTitle, 300);
      return;
    }

    if (!canNavigate) return;
    shouldResumePlaybackRef.current = true;
    setActiveTrackIndex((prevIndex) => Math.max(prevIndex - 1, 0));
  };

  const handleNext = () => {
    if (isYoutubePlaylist) {
      if (!isYoutubeReady || !youtubePlayerRef.current) {
        setPlayerStatus("youtube player is loading");
        return;
      }
      youtubePlayerRef.current.nextVideo();
      window.setTimeout(updateYoutubeTrackTitle, 300);
      return;
    }

    if (!canNavigate) return;
    shouldResumePlaybackRef.current = true;
    setActiveTrackIndex((prevIndex) => Math.min(prevIndex + 1, tracks.length - 1));
  };

  const handleStop = () => {
    if (isYoutube) {
      const player = youtubePlayerRef.current;
      if (!player || !isYoutubeReady) return;
      player.pauseVideo();
      player.seekTo(0, true);
      setIsPlaying(false);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      setIsPlaying(false);
      if (canNavigate && activeTrackIndex < tracks.length - 1) {
        setActiveTrackIndex((prevIndex) => prevIndex + 1);
      }
    };
    const handleError = () => {
      setIsPlaying(false);
      setPlayerStatus("link is not a direct playable audio file");
    };
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [tracks.length, activeTrackIndex, canNavigate, setActiveTrackIndex]);

  useEffect(() => {
    setIsPlaying(false);
    setPlayerStatus("");
    setIsYoutubeReady(false);
    setYoutubeTrackMeta({ title: "", artist: "", source: "" });
    pendingYoutubePlayRef.current = shouldResumePlaybackRef.current;
    shouldResumePlaybackRef.current = false;

    if (!isYoutube || !youtubeHostRef.current) {
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
      return;
    }

    let isCancelled = false;

    loadYouTubeIframeApi()
      .then((YT) => {
        if (isCancelled || !youtubeHostRef.current) return;
        youtubePlayerRef.current?.destroy?.();
        const playerConfig = {
          height: "1",
          width: "1",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              if (isCancelled) return;
              setIsYoutubeReady(true);
              setPlayerStatus("");
              window.setTimeout(updateYoutubeTrackTitle, 300);
              if (pendingYoutubePlayRef.current) {
                pendingYoutubePlayRef.current = false;
                youtubePlayerRef.current?.playVideo();
              }
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                setPlayerStatus("");
                updateYoutubeTrackTitle();
                window.setTimeout(updateYoutubeTrackTitle, 300);
              }
              if (event.data === YT.PlayerState.CUED) {
                updateYoutubeTrackTitle();
              }
              if (event.data === YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              }
              if (event.data === YT.PlayerState.ENDED) {
                setIsPlaying(false);
                if (canNavigate && activeTrackIndex < tracks.length - 1) {
                  setActiveTrackIndex((prevIndex) => prevIndex + 1);
                }
              }
            },
            onError: () => {
              setIsPlaying(false);
              setPlayerStatus("youtube could not play this video");
            },
          },
        };

        if (isYoutubeVideo) {
          playerConfig.videoId = activeTrack.youtubeVideoId;
        } else {
          playerConfig.playerVars.listType = "playlist";
          playerConfig.playerVars.list = activeTrack.youtubePlaylistId;
        }

        youtubePlayerRef.current = new YT.Player(youtubeHostRef.current, playerConfig);
      })
      .catch(() => {
        if (!isCancelled) setPlayerStatus("youtube player could not load");
      });

    return () => {
      isCancelled = true;
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
    };
  }, [
    activeTrack?.youtubePlaylistId,
    activeTrack?.youtubeVideoId,
    activeTrackIndex,
    canNavigate,
    isYoutube,
    isYoutubeVideo,
    setActiveTrackIndex,
    tracks.length,
    updateYoutubeTrackTitle,
  ]);

  useEffect(() => {
    if (isYoutube) return;

    const shouldResume = shouldResumePlaybackRef.current;
    shouldResumePlaybackRef.current = false;
    setIsPlaying(false);
    setPlayerStatus("");
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      if (shouldResume && isAudio) {
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
            setPlayerStatus("link is not a direct playable audio file");
          });
      }
    }
  }, [activeMediaUrl, isAudio, isYoutube]);

  useEffect(() => {
    const measureTitle = () => {
      const viewport = titleViewportRef.current;
      const text = titleTextRef.current;
      if (!viewport || !text) return;
      setIsTitleOverflowing(text.scrollWidth > viewport.clientWidth + 1);
    };

    measureTitle();
    window.addEventListener("resize", measureTitle);
    return () => window.removeEventListener("resize", measureTitle);
  }, [currentTitle]);

  return (
    <section className="fixed inset-x-0 bottom-0 z-20 border-t border-[#d8d3ca] bg-[#f5f5f3]/95 p-2.5 text-sm shadow-[0_-10px_28px_rgba(46,46,43,0.14)] backdrop-blur sm:inset-x-3 sm:bottom-3 sm:border sm:border-[#e3e1dc]/70 sm:p-3 sm:shadow-[0_16px_48px_rgba(46,46,43,0.22),0_0_0_1px_rgba(250,249,246,0.55)_inset] md:left-auto md:right-4 md:w-[300px]">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-[#8a857a] sm:mb-2">
        {playlistOptions.length > 1 ? (
          <select
            value={activePlaylistId}
            onChange={(event) => setActivePlaylistId(event.target.value)}
            className="min-h-7 min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-[10px] uppercase tracking-[0.16em] text-[#8a857a] outline-none sm:min-h-8"
            aria-label="choose playlist"
            title="choose playlist"
          >
            {playlistOptions.map((playlist) => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.title}
              </option>
            ))}
          </select>
        ) : (
          <div className="truncate">{activePlaylistTitle || "playlist"}</div>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {playlistCounter ? <div>{playlistCounter}</div> : null}
          <button
            type="button"
            onClick={() => setIsMobilePlayerOpen((value) => !value)}
            className="px-1 text-sm leading-none text-[#7a746a] hover:text-[#2e2e2b] sm:hidden"
            aria-label={isMobilePlayerOpen ? "collapse player controls" : "expand player controls"}
            title={isMobilePlayerOpen ? "collapse player controls" : "expand player controls"}
          >
            {isMobilePlayerOpen ? "x" : "+"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-2 sm:block">
        <div
          ref={titleViewportRef}
          className={`player-title border border-[#e3e1dc] bg-white px-3 py-2 ${isTitleOverflowing ? "player-title-overflowing" : ""} sm:mb-3 sm:py-2.5`}
          title={currentTitle}
        >
          <div
            className="player-title-text"
            style={{ "--player-title-duration": titleScrollDuration }}
          >
            <span ref={titleTextRef}>{currentTitle}</span>
            {isTitleOverflowing ? <span aria-hidden="true">{currentTitle}</span> : null}
          </div>
        </div>
        {canPlay ? (
          <button
            type="button"
            onClick={handlePlayPause}
            className="flex h-10 w-full items-center justify-center rounded-none border border-[#e3e1dc] bg-white text-base leading-none text-[#2a2926] transition hover:bg-[#f0eee9] sm:hidden"
            aria-label={isPlaying ? "pause track" : "play track"}
            title={isPlaying ? "pause track" : "play track"}
          >
            {isPlaying ? (
              <span aria-hidden="true" className="flex items-center gap-1">
                <span className="block h-3 w-1 bg-[#2a2926]" />
                <span className="block h-3 w-1 bg-[#2a2926]" />
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="block h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-[#2a2926]"
              />
            )}
          </button>
        ) : null}
      </div>

      <audio ref={audioRef} src={isAudio ? activeMediaUrl : ""} className="hidden" preload="none" />
      <div className="pointer-events-none fixed -left-[9999px] top-0 h-[200px] w-[200px] opacity-0" aria-hidden="true">
        <div ref={youtubeHostRef} />
      </div>

      {canPlay ? (
        <div className={`${isMobilePlayerOpen ? "grid" : "hidden"} mt-2 grid-cols-[44px_minmax(0,1fr)_44px_44px] items-center gap-2 sm:grid sm:grid-cols-[36px_minmax(0,1fr)_36px_36px]`}>
          <button
            type="button"
            onClick={handlePrev}
            disabled={!canUsePlayerNavigation}
            className="flex h-11 w-full items-center justify-center rounded-none border border-[#e3e1dc] bg-white text-base leading-none text-[#2a2926] transition hover:bg-[#f0eee9] disabled:opacity-40 md:h-9"
            aria-label="previous track"
            title="previous track"
          >
            <span aria-hidden="true">|&lt;</span>
          </button>
          <button
            type="button"
            onClick={handlePlayPause}
            className="flex h-11 flex-1 items-center justify-center rounded-none border border-[#e3e1dc] bg-white px-3 text-base leading-none text-[#2a2926] transition hover:bg-[#f0eee9] md:h-9"
            aria-label={isPlaying ? "pause track" : "play track"}
            title={isPlaying ? "pause track" : "play track"}
          >
            {isPlaying ? (
              <span aria-hidden="true" className="flex items-center gap-1">
                <span className="block h-3 w-1 bg-[#2a2926]" />
                <span className="block h-3 w-1 bg-[#2a2926]" />
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="block h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-[#2a2926]"
              />
            )}
          </button>
          <button
            type="button"
            onClick={handleStop}
            className="flex h-11 w-full items-center justify-center rounded-none border border-[#e3e1dc] bg-white text-base leading-none text-[#2a2926] transition hover:bg-[#f0eee9] md:h-9"
            aria-label="stop track"
            title="stop track"
          >
            <span aria-hidden="true" className="block h-2.5 w-2.5 bg-[#2a2926]" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canUsePlayerNavigation}
            className="flex h-11 w-full items-center justify-center rounded-none border border-[#e3e1dc] bg-white text-base leading-none text-[#2a2926] transition hover:bg-[#f0eee9] disabled:opacity-40 md:h-9"
            aria-label="next track"
            title="next track"
          >
            <span aria-hidden="true">&gt;|</span>
          </button>
        </div>
      ) : (
        <div className="rounded-none border border-[#e3e1dc] bg-white px-3 py-3 text-center text-[11px] text-[#7a746a]">
          no playlist source is available yet
        </div>
      )}
      {playerStatus ? (
        <div className="mt-2 text-[11px] leading-5 text-[#8a5a44]">{playerStatus}</div>
      ) : null}
      <style>{`
        .player-title {
          color: #2a2926;
          font-size: 0.875rem;
          font-weight: 500;
          line-height: 1.35;
          overflow: hidden;
          position: relative;
          white-space: nowrap;
        }
        .player-title-overflowing {
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent);
          mask-image: linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent);
        }
        .player-title-text {
          display: inline-flex;
          gap: 2rem;
          max-width: 100%;
          min-width: 0;
          transform: translateX(0);
        }
        .player-title-overflowing .player-title-text {
          max-width: none;
          min-width: max-content;
          animation: player-title-glide var(--player-title-duration) linear infinite;
          animation-delay: 1.2s;
          padding-right: 2rem;
        }
        @keyframes player-title-glide {
          0%, 12% { transform: translateX(0); }
          88%, 100% { transform: translateX(calc(-50% - 1rem)); }
        }
      `}</style>
    </section>
  );
}

function WorkDetails({ work, onBack }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [work?.id]);

  if (!work) {
    return (
      <div className="p-6 text-sm">
        <button type="button" onClick={onBack} className="mb-4 border border-[#e3e1dc] px-3 py-1 text-xs">
          back
        </button>
        <div>piece not found</div>
      </div>
    );
  }

  const workImages = [
    {
      id: `${work.id}-main`,
      src: work.image || "https://picsum.photos/900/1100",
      alt: work.alt || work.title || "artwork",
    },
    ...(Array.isArray(work.images) ? work.images : []).filter((image) => image?.src),
  ];
  const activeImage = workImages[activeImageIndex] || workImages[0];
  const hasVersions = workImages.length > 1;
  const showNextImage = () => {
    if (!hasVersions) return;
    setActiveImageIndex((index) => (index + 1) % workImages.length);
  };

  return (
    <main className="mx-auto max-w-[1420px] px-3 pb-32 pt-4 text-[#2e2e2b] sm:px-4 md:px-6 md:py-5 md:pb-32">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 min-h-10 rounded-none border border-[#e3e1dc] bg-[#f6f5f2] px-4 py-2 text-xs transition hover:bg-[#f0eee9] md:mb-4 md:min-h-0 md:px-3 md:py-1.5"
      >
        back
      </button>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_280px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <button
            type="button"
            onClick={showNextImage}
            className={`flex min-h-[360px] w-full items-center justify-center overflow-hidden rounded-none border border-[#e3e1dc] bg-[#f7f6f3] p-0 sm:min-h-[440px] md:min-h-[calc(100vh-140px)] md:p-2 ${
              hasVersions ? "cursor-pointer hover:bg-[#f0eee9]" : "cursor-default"
            }`}
            aria-label={hasVersions ? "show next version" : "artwork image"}
          >
          <img
            src={safeImageUrl(activeImage.src)}
            alt={activeImage.alt || work.alt || work.title || "artwork"}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="h-full max-h-[72vh] w-full object-contain md:h-auto md:max-h-[calc(100vh-156px)] md:w-auto"
          />
          </button>

          {hasVersions ? (
            <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
              <div className="text-[11px] uppercase tracking-[0.12em] text-[#8a857a]">
                {activeImageIndex + 1}/{workImages.length}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {workImages.map((image, index) => (
                  <button
                    key={image.id || image.src}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`h-16 w-16 shrink-0 border bg-[#f6f5f2] p-1 md:h-14 md:w-14 ${
                      index === activeImageIndex ? "border-[#2e2e2b]" : "border-[#e3e1dc] hover:border-[#2e2e2b]"
                    }`}
                    aria-label={`show version ${index + 1}`}
                  >
                    <img
                      src={safeImageUrl(image.src)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4 rounded-none border border-[#e3e1dc] bg-[#faf9f6] p-4 md:sticky md:top-20">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#8a857a]">piece</div>
            <h1 className="mt-2 text-base leading-6 text-[#2a2926]">{work.detailsTitle || work.title}</h1>
            <div className="mt-1 text-xs text-[#8a857a]">{work.year}</div>
          </div>

          {(work.medium || work.dimensions) && (
            <div className="space-y-3 text-xs leading-5 text-[#4a4742]">
              {work.medium && <Meta label="medium" value={work.medium} />}
              {work.dimensions && <Meta label="dimensions" value={work.dimensions} />}
            </div>
          )}

          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-[#9a9489]">notes</div>
            <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-[#4a4742]">
              {work.detailsText || work.note || "Details coming soon."}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.08em] text-[#9a9489]">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function Terminal({ lines, input, setInput, onCommand, customCommands = [] }) {
  const terminalRef = useRef(null);
  const visibleCommands = [
    ...TERMINAL_COMMANDS,
    ...customCommands
      .map((item) => item.trigger.trim())
      .filter(Boolean)
      .filter((trigger) => !TERMINAL_COMMANDS.some((item) => item.command === trigger.toLowerCase()))
      .slice(0, 4)
      .map((trigger) => ({ command: trigger, label: "custom response" })),
  ];

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  return (
    <main
      className="relative min-h-[calc(100svh-105px)] overflow-x-hidden bg-cover bg-center px-3 pb-32 pt-3 sm:min-h-[calc(100vh-73px)] sm:px-4 md:px-6 md:py-6 md:pb-32"
      style={{ backgroundImage: "url('/Untitled%20design%20(9).png')" }}
    >
      <div className="absolute inset-0 bg-[#f5f5f3]/28" aria-hidden="true" />
      <section className="relative mx-auto grid w-full max-w-5xl gap-3 sm:gap-4">
        <div className="border border-[#e3e1dc]/70 bg-[#f5f5f3]/95 p-3 text-xs shadow-[0_16px_48px_rgba(46,46,43,0.18),0_0_0_1px_rgba(250,249,246,0.55)_inset] backdrop-blur sm:p-4">
          <div className="mb-3 text-[11px] uppercase tracking-[0.12em] text-[#8a857a]">signal links</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <a
              href="https://www.instagram.com/zynx_9196/"
              target="_blank"
              rel="noreferrer"
              className="border border-[#e3e1dc] bg-white px-3 py-2 text-[#2e2e2b] transition hover:bg-[#f0eee9]"
            >
              <span className="block text-[10px] uppercase tracking-[0.12em] text-[#9a9489]">instagram</span>
              <span className="mt-1 block truncate">@zynx_9196</span>
            </a>
            <a
              href="https://zynx9196.substack.com/"
              target="_blank"
              rel="noreferrer"
              className="border border-[#e3e1dc] bg-white px-3 py-2 text-[#2e2e2b] transition hover:bg-[#f0eee9]"
            >
              <span className="block text-[10px] uppercase tracking-[0.12em] text-[#9a9489]">substack</span>
              <span className="mt-1 block truncate">zynx9196.substack.com</span>
            </a>
            <a
              href="mailto:signal@zynx9196.art"
              className="border border-[#e3e1dc] bg-white px-3 py-2 text-[#2e2e2b] transition hover:bg-[#f0eee9]"
            >
              <span className="block text-[10px] uppercase tracking-[0.12em] text-[#9a9489]">email</span>
              <span className="mt-1 block truncate">signal@zynx9196.art</span>
            </a>
          </div>
        </div>

        <div className="grid w-full gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0 overflow-hidden border border-[#e3e1dc]/70 bg-[#f5f5f3]/95 shadow-[0_16px_48px_rgba(46,46,43,0.22),0_0_0_1px_rgba(250,249,246,0.55)_inset] backdrop-blur">
          <div className="flex items-center justify-between border-b border-[#e3e1dc] bg-[#f6f5f2] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[#8a857a] sm:tracking-[0.14em]">
            <span>terminal</span>
            <span>{String(lines.length).padStart(3, "0")}</span>
          </div>
          <div ref={terminalRef} className="h-[clamp(240px,46svh,420px)] overflow-y-auto px-3 py-3 text-[13px] leading-6 sm:h-[clamp(260px,calc(100vh-330px),420px)] sm:px-4 sm:py-4 sm:leading-7 md:h-[clamp(260px,calc(100vh-300px),460px)] md:text-xs md:leading-6">
            {lines.map((line, index) => (
              <div
                key={`${line}-${index}`}
                className={`whitespace-pre-wrap break-words ${
                  line.startsWith(">") ? "text-[#2e2e2b]" : line === "..." ? "text-[#9a9489]" : "text-[#5a554d]"
                }`}
              >
                {line || "\u00a0"}
              </div>
            ))}
          </div>

          <label className="flex min-h-12 gap-2 border-t border-[#e3e1dc] bg-[#f6f5f2] px-3 py-3 text-[16px] sm:px-4 sm:text-[13px] md:min-h-0 md:text-xs">
            <span aria-hidden="true" className="text-[#8a857a]">&gt;</span>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onCommand(input);
                  setInput("");
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-[#2e2e2b] outline-none placeholder:text-[#9a9489]"
              aria-label="terminal input"
              placeholder="type command"
              autoFocus
            />
          </label>
        </div>

        <aside className="min-w-0 border border-[#e3e1dc]/70 bg-[#f5f5f3]/95 p-3 text-xs shadow-[0_16px_48px_rgba(46,46,43,0.18),0_0_0_1px_rgba(250,249,246,0.55)_inset] backdrop-blur sm:p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[#8a857a]">commands</div>
          <div className="mt-3 grid grid-cols-3 gap-2 leading-5 text-[#5a554d] sm:grid-cols-4 lg:grid-cols-6 xl:flex xl:flex-wrap">
            {visibleCommands.map(({ command, label }) => (
              <button
                key={command}
                type="button"
                onClick={() => onCommand(command)}
                title={label}
                className="min-h-10 min-w-0 border border-[#e3e1dc] bg-white px-2 py-2 text-center text-[12px] leading-4 hover:bg-[#f0eee9] hover:text-[#2e2e2b] sm:px-3 sm:text-xs sm:leading-5 xl:min-h-0 xl:px-2 xl:py-1 xl:text-left"
              >
                {command}
              </button>
            ))}
          </div>
        </aside>
        </div>
      </section>
    </main>
  );
}

function MasonryWorkGrid({ works, onSelectWork, renderFooter, draggable = false, draggingId, onDragStart, onDrop }) {
  const columnCount = useGalleryColumnCount();
  const columns = Array.from({ length: columnCount }, () => []);

  works.forEach((work, index) => {
    columns[index % columnCount].push({ work, index });
  });

  return (
    <div
      className="grid gap-4 sm:gap-3"
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
    >
      {columns.map((columnWorks, columnIndex) => (
        <div key={`column-${columnIndex}`} className="space-y-4 sm:space-y-3">
          {columnWorks.map(({ work, index }) => (
            <button
              key={work.id}
              type="button"
              draggable={draggable}
              onDragStart={() => onDragStart?.(work.id)}
              onDragOver={(event) => draggable && event.preventDefault()}
              onDrop={() => onDrop?.(work.id)}
              onDragEnd={() => onDragStart?.(null)}
              onClick={() => {
                if (onSelectWork) onSelectWork(work.id);
              }}
              disabled={!onSelectWork && !draggable}
              className={`block w-full overflow-hidden rounded-none border bg-[#f7f6f3] text-left shadow-[0_1px_0_rgba(46,46,43,0.03)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#f0eee9] hover:border-[#2e2e2b] focus:outline-none focus:ring-2 focus:ring-[#d8d3ca] active:bg-[#ebe9e4] md:rounded-none ${
                draggingId === work.id ? "border-[#2e2e2b] opacity-50" : "border-[#e3e1dc]"
              }`}
              title={draggable ? `drag to reorder: ${work.title}` : work.title}
            >
              <div className="flex aspect-[4/5] w-full items-center justify-center bg-[#f7f6f3] sm:block sm:aspect-auto">
                <img
                  src={safeImageUrl(work.image || "https://picsum.photos/500/650")}
                  loading={index < 4 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={index < 2 ? "high" : "auto"}
                  className="masonry-work-image h-full w-full object-contain transition duration-300 sm:h-auto"
                  alt={draggable ? "" : work.alt || work.title || "artwork"}
                />
              </div>
              {renderFooter ? (
                renderFooter(work, index)
              ) : (
                <div className="bg-[#f6f5f2]/95 px-4 py-3 text-[12px] leading-5 sm:px-3 sm:py-2.5 sm:text-[11px]">
                  <div className="break-words">{work.title}</div>
                  {work.year ? <div className="mt-0.5 text-[#8a857a]">{work.year}</div> : null}
                </div>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function Admin({
  works,
  setWorks,
  playlists,
  setPlaylists,
  poems,
  setPoems,
  terminalConfig,
  setTerminalConfig,
  resetTerminal,
  publicAdditionalImage,
  setPublicAdditionalImage,
  onLock,
}) {
  const [activePanel, setActivePanel] = useState("works");
  const [selectedWorkId, setSelectedWorkId] = useState(works[0]?.id || null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(playlists[0]?.id || null);
  const [selectedPoemId, setSelectedPoemId] = useState(poems[0]?.id || null);
  const [draggingId, setDraggingId] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!works.some((work) => work.id === selectedWorkId)) {
      setSelectedWorkId(works[0]?.id || null);
    }
  }, [works, selectedWorkId]);

  useEffect(() => {
    if (activePanel === "archive") {
      const selectedIsArchive = works.some(
        (work) => work.id === selectedWorkId && (work.collection || "main").trim().toLowerCase() === "archive"
      );
      if (!selectedIsArchive) {
        const firstArchive = works.find((work) => (work.collection || "main").trim().toLowerCase() === "archive");
        setSelectedWorkId(firstArchive?.id || null);
      }
    }
  }, [activePanel, works, selectedWorkId]);

  useEffect(() => {
    if (!playlists.some((playlist) => playlist.id === selectedPlaylistId)) {
      setSelectedPlaylistId(playlists[0]?.id || null);
    }
  }, [playlists, selectedPlaylistId]);

  useEffect(() => {
    if (!poems.some((poem) => poem.id === selectedPoemId)) {
      setSelectedPoemId(poems[0]?.id || null);
    }
  }, [poems, selectedPoemId]);

  const selectedWork = works.find((work) => work.id === selectedWorkId) || null;
  const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) || null;
  const selectedPoem = poems.find((poem) => poem.id === selectedPoemId) || null;

  const updateWork = (field, value) => {
    setWorks((prev) => prev.map((work) => (work.id === selectedWorkId ? { ...work, [field]: value } : work)));
  };

  const updatePlaylist = (field, value) => {
    setPlaylists((prev) =>
      prev.map((playlist) => (playlist.id === selectedPlaylistId ? { ...playlist, [field]: value } : playlist))
    );
  };

  const updatePlaylistTrack = (trackId, field, value) => {
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== selectedPlaylistId) return playlist;
        const tracks = Array.isArray(playlist.tracks) ? playlist.tracks.map((track) => {
          if (track.id !== trackId) return track;
          return { ...track, [field]: value };
        }) : [];
        return { ...playlist, tracks };
      })
    );
  };

  const addPlaylistTrack = () => {
    const nextTrack = { id: makeId(), title: "new track", url: "" };
    setPlaylists((prev) =>
      prev.map((playlist) =>
        playlist.id === selectedPlaylistId
          ? { ...playlist, tracks: [...(Array.isArray(playlist.tracks) ? playlist.tracks : []), nextTrack] }
          : playlist
      )
    );
  };

  const deletePlaylistTrack = (trackId) => {
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== selectedPlaylistId) return playlist;
        const tracks = Array.isArray(playlist.tracks)
          ? playlist.tracks.filter((track) => track.id !== trackId)
          : [];
        return { ...playlist, tracks };
      })
    );
  };

  const updatePoem = (field, value) => {
    setPoems((prev) => prev.map((poem) => (poem.id === selectedPoemId ? { ...poem, [field]: value } : poem)));
  };

  const addWork = () => {
    const next = normalizeWork({ id: makeId(), title: "new work", detailsTitle: "new work" }, works.length);
    setWorks((prev) => [...prev, next]);
    setSelectedWorkId(next.id);
    setActivePanel("works");
  };

  const addArchiveResource = (imageSrc, fileName = "") => {
    if (!imageSrc) return;
    const code = makeArchiveCode();
    const next = normalizeWork(
      {
        id: makeId(),
        title: code,
        detailsTitle: code,
        alt: code,
        image: imageSrc,
        collection: "archive",
        archiveCode: code,
      },
      works.length
    );
    setWorks((prev) => [...prev, next]);
    setSelectedWorkId(next.id);
    setActivePanel("archive");
  };

  const addPlaylist = () => {
    const next = normalizePlaylist({ id: makeId(), title: "new playlist" }, playlists.length);
    setPlaylists((prev) => [...prev, next]);
    setSelectedPlaylistId(next.id);
    setActivePanel("playlists");
  };

  const addPoem = () => {
    const next = normalizePoem({ id: makeId(), title: "new project" }, poems.length);
    setPoems((prev) => [...prev, next]);
    setSelectedPoemId(next.id);
    setActivePanel("projects");
  };

  const deleteSelectedWork = () => {
    setWorks((prev) => prev.filter((work) => work.id !== selectedWorkId));
  };

  const deleteSelectedPlaylist = () => {
    setPlaylists((prev) => prev.filter((playlist) => playlist.id !== selectedPlaylistId));
  };

  const deleteSelectedPoem = () => {
    setPoems((prev) => prev.filter((poem) => poem.id !== selectedPoemId));
  };

  const moveWork = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    setWorks((prev) => {
      const sourceIndex = prev.findIndex((work) => work.id === sourceId);
      const targetIndex = prev.findIndex((work) => work.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;

      const nextIds = reorderIds(prev.map((work) => work.id), sourceId, targetId);
      return nextIds.map((id) => prev.find((work) => work.id === id)).filter(Boolean);
    });
  };

  const saveLayoutOrder = (orderedVisibleIds) => {
    setWorks((prev) => {
      const byId = new Map(prev.map((work) => [work.id, work]));
      const visibleWorks = prev.filter((work) => (work.collection || "main").trim().toLowerCase() !== "archive");
      const archivedWorks = prev.filter((work) => (work.collection || "main").trim().toLowerCase() === "archive");
      const orderedVisibleWorks = orderedVisibleIds
        .map((id) => byId.get(id))
        .filter((work) => work && (work.collection || "main").trim().toLowerCase() !== "archive");
      const missingVisibleWorks = visibleWorks.filter((work) => !orderedVisibleIds.includes(work.id));
      return [...orderedVisibleWorks, ...missingVisibleWorks, ...archivedWorks];
    });
    setSaveStatus("layout saved");
    window.setTimeout(() => setSaveStatus(""), 1800);
  };

  const handleSingleImageUpload = async (file) => {
    if (!selectedWorkId || !file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateWork("image", dataUrl);
      if (!selectedWork?.title || selectedWork.title === "new work") {
        const title = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        updateWork("title", title);
        updateWork("detailsTitle", title);
      }
    } catch {
      alert("Could not upload that image.");
    }
  };

  const handleAdditionalImagesUpload = async (files) => {
    if (!selectedWorkId) return;
    const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;

    const uploaded = [];
    for (const file of imageFiles) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        uploaded.push({
          id: makeId(),
          src: dataUrl,
          alt: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
        });
      } catch {
        // skip failed file and continue
      }
    }

    if (uploaded.length) {
      const existing = Array.isArray(selectedWork?.images) ? selectedWork.images : [];
      updateWork("images", [...existing, ...uploaded]);
    }
  };

  const removeAdditionalImage = (imageId) => {
    if (!selectedWork) return;
    const existing = Array.isArray(selectedWork.images) ? selectedWork.images : [];
    updateWork(
      "images",
      existing.filter((image) => image.id !== imageId)
    );
  };

  const setAdditionalImageAsMain = (image) => {
    if (!image?.src) return;
    updateWork("image", image.src);
  };

  const addPublicAdditionalImage = (imageSrc, imageAlt) => {
    if (!selectedWorkId || !imageSrc) return;
    const existing = Array.isArray(selectedWork?.images) ? selectedWork.images : [];
    updateWork("images", [
      ...existing,
      {
        id: makeId(),
        src: imageSrc,
        alt: imageAlt || imageSrc.replace(/^.*\//, "").replace(/\.[^/.]+$/, ""),
      },
    ]);
  };

  const handleBulkUpload = async (files) => {
    const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;

    const uploaded = [];
    for (const file of imageFiles) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const title = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        uploaded.push(
          normalizeWork(
            {
              id: makeId(),
              title,
              detailsTitle: title,
              alt: title,
              image: dataUrl,
            },
            works.length + uploaded.length
          )
        );
      } catch {
        // skip failed file and continue
      }
    }

    if (uploaded.length) {
      setWorks((prev) => [...prev, ...uploaded]);
      setSelectedWorkId(uploaded[0].id);
      setActivePanel("works");
    }
  };

  const exportData = () => {
    const exportedAt = new Date().toISOString();
    const payload = {
      version: 5,
      payloadId: exportedAt,
      exportedAt,
      works,
      playlists,
      poems,
      terminal: terminalConfig,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "zynx_portfolio_export.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file) => {
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = Array.isArray(parsed) ? { works: parsed } : parsed;
      const nextWorks = Array.isArray(payload.works) ? payload.works : works;
      if (!Array.isArray(nextWorks)) throw new Error("Invalid file");

      const nextPlaylists = Array.isArray(payload.playlists) ? payload.playlists : playlists;
      const nextPoems = Array.isArray(payload.poems) ? payload.poems : poems;
      const nextTerminal = typeof payload.terminal === "object" ? payload.terminal : terminalConfig;
      const nextPayloadId = payload.payloadId || payload.exportedAt || String(payload.version || 0);

      const normalizedWorks = nextWorks.map(normalizeWork);
      const normalizedPlaylists = nextPlaylists.map(normalizePlaylist);
      const normalizedPoems = nextPoems.map(normalizePoem);
      const normalizedTerminal = normalizeTerminal(nextTerminal);

      setWorks(normalizedWorks);
      setPlaylists(normalizedPlaylists);
      setPoems(normalizedPoems);
      setTerminalConfig(normalizedTerminal);
      setSelectedWorkId(normalizedWorks[0]?.id || null);
      setSelectedPlaylistId(normalizedPlaylists[0]?.id || null);
      setSelectedPoemId(normalizedPoems[0]?.id || null);

      safeSave(STORAGE_KEYS.works, normalizedWorks);
      safeSave(STORAGE_KEYS.playlists, normalizedPlaylists);
      safeSave(STORAGE_KEYS.poems, normalizedPoems);
      safeSave(STORAGE_KEYS.terminal, normalizedTerminal);
      safeSave(STORAGE_KEYS.payloadVersion, nextPayloadId);
      setSaveStatus("imported");
      window.setTimeout(() => setSaveStatus(""), 1800);
    } catch {
      alert("Could not import that file.");
    }
  };

  const clearLocalData = () => {
    if (!window.confirm("Reset everything in this browser?")) return;
    setWorks(DEFAULT_WORKS.map(normalizeWork));
    setPlaylists(DEFAULT_PLAYLISTS.map(normalizePlaylist));
    setPoems(DEFAULT_POEMS.map(normalizePoem));
    setTerminalConfig(normalizeTerminal(DEFAULT_TERMINAL));
    resetTerminal();
    safeSave(STORAGE_KEYS.payloadVersion, DEFAULT_IMPORT_PAYLOAD_ID);
  };

  const addTerminalCommand = () => {
    const next = {
      id: makeId(),
      trigger: "new-command",
      response: "write response here",
    };
    setTerminalConfig((prev) => ({
      ...prev,
      commands: [...prev.commands, next],
    }));
    setActivePanel("terminal");
  };

  const updateTerminalField = (field, value) => {
    setTerminalConfig((prev) => ({ ...prev, [field]: textToLines(value) }));
  };

  const updateTerminalCommand = (id, field, value) => {
    setTerminalConfig((prev) => ({
      ...prev,
      commands: prev.commands.map((command) =>
        command.id === id
          ? {
              ...command,
              [field]: field === "trigger" ? value.toLowerCase().trim() : value,
            }
          : command
      ),
    }));
  };

  const deleteTerminalCommand = (id) => {
    setTerminalConfig((prev) => ({
      ...prev,
      commands: prev.commands.filter((command) => command.id !== id),
    }));
  };

  return (
    <main className="space-y-5 p-5 md:p-6">
      <section className="border border-[#e3e1dc] bg-[#faf9f6] p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#8a857a]">admin</div>
            <h1 className="mt-1 text-lg text-[#2a2926]">Upload and edit everything here.</h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#7a746a]">
              Add works one by one, bulk upload multiple images, write detail pages, manage PRJCTS and playlists, and export all of your content together.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addWork} className="admin-btn">+ work</button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="admin-btn">bulk upload images</button>
            <button type="button" onClick={addPlaylist} className="admin-btn">+ playlist</button>
            <button type="button" onClick={addPoem} className="admin-btn">+ project</button>
            <button type="button" onClick={addTerminalCommand} className="admin-btn">+ terminal command</button>
            <button type="button" onClick={exportData} className="admin-btn-dark">export</button>
            <button type="button" onClick={onLock} className="admin-btn-dark">lock</button>
            <label className="admin-btn cursor-pointer">
              import
              <input
                type="file"
                accept="application/json"
                onChange={(event) => {
                  importData(event.target.files?.[0]);
                  event.target.value = "";
                }}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                safeSave(STORAGE_KEYS.works, works);
                safeSave(STORAGE_KEYS.playlists, playlists);
                safeSave(STORAGE_KEYS.poems, poems);
                safeSave(STORAGE_KEYS.terminal, terminalConfig);
                setSaveStatus("saved");
                window.setTimeout(() => setSaveStatus(""), 1800);
              }}
              className="admin-btn"
            >
              save
            </button>
            <button type="button" onClick={clearLocalData} className="admin-btn">reset</button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                const files = event.target.files;
                if (!files || !files.length) return;
                handleBulkUpload(files);
              }}
              className="sr-only"
            />
          </div>
        </div>
      </section>

      {saveStatus ? (
        <div className="text-xs text-[#2a2926] opacity-80">{saveStatus}</div>
      ) : null}

      <div className="flex gap-2 text-xs">
        <PanelTab label="works" active={activePanel === "works"} onClick={() => setActivePanel("works")} />
        <PanelTab label="layout" active={activePanel === "layout"} onClick={() => setActivePanel("layout")} />
        <PanelTab label="archive" active={activePanel === "archive"} onClick={() => setActivePanel("archive")} />
        <PanelTab label="playlists" active={activePanel === "playlists"} onClick={() => setActivePanel("playlists")} />
        <PanelTab label="PRJCTS" active={activePanel === "projects"} onClick={() => setActivePanel("projects")} />
        <PanelTab label="terminal" active={activePanel === "terminal"} onClick={() => setActivePanel("terminal")} />
      </div>

      {activePanel === "works" && (
        <AdminWorksPanel
          works={works}
          selectedWork={selectedWork}
          selectedWorkId={selectedWorkId}
          setSelectedWorkId={setSelectedWorkId}
          updateWork={updateWork}
          deleteSelectedWork={deleteSelectedWork}
          handleSingleImageUpload={handleSingleImageUpload}
          handleAdditionalImagesUpload={handleAdditionalImagesUpload}
          removeAdditionalImage={removeAdditionalImage}
          setAdditionalImageAsMain={setAdditionalImageAsMain}
          draggingId={draggingId}
          setDraggingId={setDraggingId}
          moveWork={moveWork}
          publicAdditionalImage={publicAdditionalImage}
          setPublicAdditionalImage={setPublicAdditionalImage}
          addPublicAdditionalImage={addPublicAdditionalImage}
        />
      )}

      {activePanel === "layout" && (
        <AdminLayoutPanel works={works} onSaveOrder={saveLayoutOrder} />
      )}

      {activePanel === "playlists" && (
        <AdminPlaylistPanel
          playlists={playlists}
          selectedPlaylist={selectedPlaylist}
          selectedPlaylistId={selectedPlaylistId}
          setSelectedPlaylistId={setSelectedPlaylistId}
          updatePlaylist={updatePlaylist}
          updatePlaylistTrack={updatePlaylistTrack}
          addPlaylistTrack={addPlaylistTrack}
          deletePlaylistTrack={deletePlaylistTrack}
          deleteSelectedPlaylist={deleteSelectedPlaylist}
        />
      )}

      {activePanel === "archive" && (
        <AdminArchivePanel
          works={works}
          selectedWork={selectedWork}
          selectedWorkId={selectedWorkId}
          setSelectedWorkId={setSelectedWorkId}
          updateWork={updateWork}
          deleteSelectedWork={deleteSelectedWork}
          addArchiveResource={addArchiveResource}
        />
      )}

      {activePanel === "projects" && (
        <AdminProjectsPanel
          projects={poems}
          selectedProject={selectedPoem}
          selectedProjectId={selectedPoemId}
          setSelectedProjectId={setSelectedPoemId}
          updateProject={updatePoem}
          deleteSelectedProject={deleteSelectedPoem}
        />
      )}

      {activePanel === "terminal" && (
        <AdminTerminalPanel
          terminalConfig={terminalConfig}
          updateTerminalField={updateTerminalField}
          updateTerminalCommand={updateTerminalCommand}
          deleteTerminalCommand={deleteTerminalCommand}
          addTerminalCommand={addTerminalCommand}
          resetTerminal={resetTerminal}
        />
      )}

      <style>{`
        .admin-btn {
          border: 1px solid #e3e1dc;
          background: #f6f5f2;
          padding: 0.45rem 0.65rem;
          font-size: 0.75rem;
          color: #2e2e2b;
        }
        .admin-btn:hover { background: #f0eee9; }
        .admin-btn-dark {
          border: 1px solid #2e2e2b;
          background: #2e2e2b;
          padding: 0.45rem 0.65rem;
          font-size: 0.75rem;
          color: #f5f5f3;
        }
      `}</style>
    </main>
  );
}

function PanelTab({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-1 ${active ? "border-[#2e2e2b] bg-[#2e2e2b] text-[#f5f5f3]" : "border-[#e3e1dc] bg-[#faf9f6] text-[#7a746a]"}`}
    >
      {label}
    </button>
  );
}

function ImageFolderPicker({ label, actionLabel, selectedSrc = "", onSelect }) {
  const [query, setQuery] = useState("");
  const filteredImages = PUBLIC_WORK_IMAGES.filter((fileName) =>
    fileName.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.08em] text-[#8a857a]">{label}</div>
        <div className="text-[10px] text-[#9a9489]">{filteredImages.length}/{PUBLIC_WORK_IMAGES.length}</div>
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="search images"
        className="w-full border border-[#e3e1dc] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#d8d3ca]"
      />
      <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto border border-[#e3e1dc] bg-white p-2">
        {filteredImages.map((fileName) => {
          const imageSrc = `/${fileName}`;
          const isSelected = selectedSrc === imageSrc;
          return (
            <button
              key={fileName}
              type="button"
              onClick={() => onSelect(imageSrc, fileName)}
              className={`group border bg-[#f6f5f2] p-1 text-left transition hover:border-[#2e2e2b] ${
                isSelected ? "border-[#2e2e2b]" : "border-[#e3e1dc]"
              }`}
              title={`${actionLabel}: ${fileName}`}
            >
              <img
                src={safeImageUrl(imageSrc)}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-square w-full bg-white object-cover"
              />
              <div className="mt-1 truncate text-[10px] text-[#4a4742]">{fileName}</div>
            </button>
          );
        })}
        {!filteredImages.length ? (
          <div className="col-span-2 px-2 py-6 text-center text-[11px] text-[#8a857a]">no matching images</div>
        ) : null}
      </div>
    </div>
  );
}

function AdminLayoutPanel({ works, onSaveOrder }) {
  const visibleWorks = works.filter((work) => (work.collection || "main").trim().toLowerCase() !== "archive");
  const [orderedIds, setOrderedIds] = useState(() => visibleWorks.map((work) => work.id));
  const [draggingLayoutId, setDraggingLayoutId] = useState(null);

  useEffect(() => {
    setOrderedIds((prev) => {
      const visibleIds = visibleWorks.map((work) => work.id);
      const keptIds = prev.filter((id) => visibleIds.includes(id));
      const addedIds = visibleIds.filter((id) => !keptIds.includes(id));
      return [...keptIds, ...addedIds];
    });
  }, [works]);

  const worksById = new Map(visibleWorks.map((work) => [work.id, work]));
  const orderedWorks = orderedIds.map((id) => worksById.get(id)).filter(Boolean);

  return (
    <section className="space-y-4 border border-[#e3e1dc] bg-[#faf9f6] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-[#8a857a]">layout editor</div>
          <p className="mt-1 max-w-xl text-xs leading-5 text-[#7a746a]">
            Drag a piece onto another slot to swap them, then save the layout to publish that order.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOrderedIds(visibleWorks.map((work) => work.id))}
            className="admin-btn"
          >
            reset draft
          </button>
          <button type="button" onClick={() => onSaveOrder(orderedIds)} className="admin-btn-dark">
            save layout
          </button>
        </div>
      </div>

      {orderedWorks.length ? (
        <MasonryWorkGrid
          works={orderedWorks}
          draggable
          draggingId={draggingLayoutId}
          onDragStart={setDraggingLayoutId}
          onDrop={(targetId) => {
            setOrderedIds((prev) => swapIds(prev, draggingLayoutId, targetId));
            setDraggingLayoutId(null);
          }}
          renderFooter={(work, index) => (
            <div className="flex items-center gap-2 bg-[#f6f5f2]/95 px-2.5 py-2 text-[11px]">
              <span className="text-[#8a857a]">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate">{work.title}</span>
            </div>
          )}
        />
      ) : (
        <EmptyState label="no visible works" hint="add works or restore items from archive" />
      )}
    </section>
  );
}

function AdminWorksPanel({
  works,
  selectedWork,
  selectedWorkId,
  setSelectedWorkId,
  updateWork,
  deleteSelectedWork,
  handleSingleImageUpload,
  handleAdditionalImagesUpload,
  removeAdditionalImage,
  setAdditionalImageAsMain,
  draggingId,
  setDraggingId,
  moveWork,
  publicAdditionalImage,
  setPublicAdditionalImage,
  addPublicAdditionalImage,
}) {
  const singleImageInputRef = useRef(null);
  const additionalImagesInputRef = useRef(null);
  const isArchived = (selectedWork?.collection || "main").trim().toLowerCase() === "archive";

  return (
    <section className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
      <div className="border border-[#e3e1dc] bg-[#faf9f6] p-3">
        <div className="mb-3 text-[11px] uppercase tracking-[0.12em] text-[#8a857a]">works</div>
        <div className="space-y-1">
          {works.map((work, index) => (
            <div
              key={work.id}
              draggable
              onDragStart={() => setDraggingId(work.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                moveWork(draggingId, work.id);
                setDraggingId(null);
              }}
              onDragEnd={() => setDraggingId(null)}
              className={`flex w-full items-center gap-2 border px-2 py-2 text-left text-xs transition ${
                selectedWorkId === work.id ? "border-[#2e2e2b] bg-[#2e2e2b] text-[#f5f5f3]" : "border-transparent hover:bg-[#f0eee9]"
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedWorkId(work.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                {work.image ? (
                  <img
                    src={safeImageUrl(work.image)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-8 w-8 object-cover"
                  />
                ) : <div className="h-8 w-8 bg-[#ebe9e4]" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{work.title}</span>
                  {work.year ? <span className="mt-0.5 block text-[10px] opacity-60">{work.year}</span> : null}
                </span>
              </button>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] opacity-45">drag</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-[#e3e1dc] bg-[#faf9f6] p-4">
        {selectedWork ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="space-y-3">
              <AdminField label="title" value={selectedWork.title} onChange={(value) => updateWork("title", value)} />
              <AdminField label="collection" value={selectedWork.collection} onChange={(value) => updateWork("collection", value)} />
              <AdminField label="year" value={selectedWork.year} onChange={(value) => updateWork("year", value)} inputMode="numeric" />
              <AdminField label="short note" value={selectedWork.note} onChange={(value) => updateWork("note", value)} textarea />
              <AdminField label="alt text" value={selectedWork.alt} onChange={(value) => updateWork("alt", value)} textarea />
              <AdminField label="detail page title" value={selectedWork.detailsTitle} onChange={(value) => updateWork("detailsTitle", value)} />
              <AdminField label="medium" value={selectedWork.medium} onChange={(value) => updateWork("medium", value)} />
              <AdminField label="dimensions" value={selectedWork.dimensions} onChange={(value) => updateWork("dimensions", value)} />
              <AdminField label="detail page text" value={selectedWork.detailsText} onChange={(value) => updateWork("detailsText", value)} textarea tall />
            </div>

            <aside className="space-y-3">
              <div className="border border-[#e3e1dc] bg-[#f6f5f2] p-2">
                {selectedWork.image ? (
                  <img
                    src={safeImageUrl(selectedWork.image)}
                    alt={selectedWork.alt || selectedWork.title}
                    loading="lazy"
                    decoding="async"
                    className="h-auto w-full object-contain"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center border border-dashed border-[#d8d3ca] text-xs text-[#8a857a]">
                    no image yet
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => singleImageInputRef.current?.click()}
                className="block w-full border border-[#e3e1dc] bg-[#f6f5f2] px-3 py-2 text-center text-xs hover:bg-[#f0eee9]"
              >
                upload / replace image
              </button>
              <input
                ref={singleImageInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  handleSingleImageUpload(file);
                }}
                className="sr-only"
              />

              <ImageFolderPicker
                label="choose from folder"
                actionLabel="set main"
                selectedSrc={selectedWork.image || ""}
                onSelect={(imageSrc) => updateWork("image", imageSrc)}
              />

              <ImageFolderPicker
                label="add version from folder"
                actionLabel="add version"
                onSelect={(imageSrc, fileName) => {
                  setPublicAdditionalImage(imageSrc);
                  addPublicAdditionalImage(imageSrc, fileName);
                  setPublicAdditionalImage("");
                }}
              />

              <button
                type="button"
                onClick={() => additionalImagesInputRef.current?.click()}
                className="block w-full border border-[#e3e1dc] bg-[#f6f5f2] px-3 py-2 text-center text-xs hover:bg-[#f0eee9]"
              >
                add versions / extra images
              </button>
              <input
                ref={additionalImagesInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  const files = event.target.files;
                  if (!files || !files.length) return;
                  handleAdditionalImagesUpload(files);
                }}
                className="sr-only"
              />

              {Array.isArray(selectedWork.images) && selectedWork.images.length ? (
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-[0.08em] text-[#8a857a]">
                    versions
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedWork.images.map((image) => (
                      <div key={image.id} className="border border-[#e3e1dc] bg-[#f6f5f2] p-1">
                        <img
                          src={safeImageUrl(image.src)}
                          alt={image.alt || "version"}
                          loading="lazy"
                          decoding="async"
                          className="h-24 w-full object-cover"
                        />
                        <div className="mt-1 grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => setAdditionalImageAsMain(image)}
                            className="border border-[#e3e1dc] px-1 py-1 text-[10px] hover:bg-[#f0eee9]"
                          >
                            main
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAdditionalImage(image.id)}
                            className="border border-[#e3e1dc] px-1 py-1 text-[10px] hover:bg-[#f0eee9]"
                          >
                            remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => updateWork("collection", isArchived ? "main" : "archive")}
                className="mb-2 w-full border border-[#e3e1dc] px-3 py-2 text-xs hover:bg-[#f0eee9]"
              >
                {isArchived ? "restore from archive" : "move to archive"}
              </button>
              <button type="button" onClick={deleteSelectedWork} className="w-full border border-[#e3e1dc] px-3 py-2 text-xs hover:bg-[#f0eee9]">
                delete this work
              </button>
            </aside>
          </div>
        ) : (
          <EmptyState label="no work selected" hint="add or select a work" />
        )}
      </div>
    </section>
  );
}

function AdminPlaylistPanel({
  playlists,
  selectedPlaylist,
  selectedPlaylistId,
  setSelectedPlaylistId,
  updatePlaylist,
  updatePlaylistTrack,
  addPlaylistTrack,
  deletePlaylistTrack,
  deleteSelectedPlaylist,
}) {
  const [selectedTrackId, setSelectedTrackId] = useState(selectedPlaylist?.tracks?.[0]?.id || null);
  const [audioUploadStatus, setAudioUploadStatus] = useState("");
  const trackAudioInputRef = useRef(null);
  const playlistAudioInputRef = useRef(null);

  useEffect(() => {
    const tracks = selectedPlaylist?.tracks || [];
    if (tracks.some((track) => track.id === selectedTrackId)) return;
    setSelectedTrackId(tracks[0]?.id || null);
  }, [selectedPlaylist?.id, selectedPlaylist?.tracks?.length, selectedTrackId]);

  const selectedTrack = selectedPlaylist?.tracks?.find((track) => track.id === selectedTrackId) || null;
  const selectedTrackHasYoutubeUrl = isYoutubeUrl(selectedTrack?.url);
  const selectedTrackHasInvalidAudioUrl = Boolean(selectedTrack?.url) && !normalizePlaylistUrl(selectedTrack.url);
  const playlistHasYoutubeUrl = isYoutubeUrl(selectedPlaylist?.audioUrl);
  const playlistHasInvalidAudioUrl = Boolean(selectedPlaylist?.audioUrl) && !normalizePlaylistUrl(selectedPlaylist.audioUrl);

  const handleAudioUpload = async (file, onReady) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setAudioUploadStatus("choose an audio file");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setAudioUploadStatus("audio file is too large for browser storage; use a hosted mp3 URL");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      onReady(dataUrl);
      setAudioUploadStatus(`loaded ${file.name}`);
    } catch {
      setAudioUploadStatus("could not load audio file");
    }
  };

  return (
    <section className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
      <ListPanel
        label="playlists"
        items={playlists}
        selectedId={selectedPlaylistId}
        setSelectedId={setSelectedPlaylistId}
        getTitle={(playlist) => playlist.title}
      />
      <div className="space-y-3 border border-[#e3e1dc] bg-[#faf9f6] p-4">
        {selectedPlaylist ? (
          <>
            <AdminField label="playlist title" value={selectedPlaylist.title} onChange={(value) => updatePlaylist("title", value)} />
            <AdminField label="description" value={selectedPlaylist.description} onChange={(value) => updatePlaylist("description", value)} />
            <AdminField label="track label" value={selectedPlaylist.currentTrack} onChange={(value) => updatePlaylist("currentTrack", value)} />
            <div className="rounded-none border border-[#e3e1dc] bg-white p-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[#8a857a]">playlist tracks</div>
              {Array.isArray(selectedPlaylist.tracks) && selectedPlaylist.tracks.length ? (
                <div className="space-y-2">
                  {selectedPlaylist.tracks.map((track) => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => setSelectedTrackId(track.id)}
                      className={`block w-full text-left text-[11px] ${
                        track.id === selectedTrackId ? "text-[#2a2926]" : "text-[#7c776d] hover:text-[#2a2926]"
                      }`}
                    >
                      {track.title || "untitled track"}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-[#7c776d]">Add tracks here to build a playlist directly on the site.</div>
              )}
              <button
                type="button"
                onClick={addPlaylistTrack}
                className="mt-3 border border-[#e3e1dc] bg-[#f6f5f2] px-3 py-2 text-xs hover:bg-[#f0eee9]"
              >
                + add track
              </button>
            </div>

            {selectedTrack ? (
              <div className="space-y-3 rounded-none border border-[#e3e1dc] bg-white p-3">
                <AdminField label="track title" value={selectedTrack.title} onChange={(value) => updatePlaylistTrack(selectedTrack.id, "title", value)} />
                <AdminField label="track audio URL" value={selectedTrack.url} onChange={(value) => updatePlaylistTrack(selectedTrack.id, "url", value)} textarea />
                {selectedTrackHasYoutubeUrl ? (
                  <div className="text-[11px] leading-5 text-[#8a5a44]">
                    YouTube links play through the embedded YouTube player. They are not converted to mp3.
                  </div>
                ) : selectedTrackHasInvalidAudioUrl ? (
                  <div className="text-[11px] leading-5 text-[#8a5a44]">
                    This needs to end in .mp3, .m4a, .wav, .ogg, .aac, or .flac.
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => trackAudioInputRef.current?.click()}
                    className="border border-[#e3e1dc] bg-[#f6f5f2] px-3 py-2 text-xs hover:bg-[#f0eee9]"
                  >
                    upload audio
                  </button>
                  <span className="text-[11px] text-[#8a857a]">small mp3/m4a/wav files only</span>
                </div>
                <input
                  ref={trackAudioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={(event) => {
                    handleAudioUpload(event.target.files?.[0], (dataUrl) => updatePlaylistTrack(selectedTrack.id, "url", dataUrl));
                    event.target.value = "";
                  }}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={() => {
                    deletePlaylistTrack(selectedTrack.id);
                    setSelectedTrackId(selectedPlaylist.tracks?.[0]?.id || null);
                  }}
                  className="border border-[#e3e1dc] px-3 py-2 text-xs hover:bg-[#f0eee9]"
                >
                  remove track
                </button>
              </div>
            ) : null}

            <div className="rounded-none border border-[#e3e1dc] bg-white p-3">
              <AdminField label="playlist audio URL" value={selectedPlaylist.audioUrl} onChange={(value) => updatePlaylist("audioUrl", value)} textarea />
              {playlistHasYoutubeUrl ? (
                <div className="mt-2 text-[11px] leading-5 text-[#8a5a44]">
                  YouTube links play through the embedded YouTube player. They are not converted to mp3.
                </div>
              ) : playlistHasInvalidAudioUrl ? (
                <div className="mt-2 text-[11px] leading-5 text-[#8a5a44]">
                  This needs to end in .mp3, .m4a, .wav, .ogg, .aac, or .flac.
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => playlistAudioInputRef.current?.click()}
                  className="border border-[#e3e1dc] bg-[#f6f5f2] px-3 py-2 text-xs hover:bg-[#f0eee9]"
                >
                  upload audio
                </button>
                <span className="text-[11px] text-[#8a857a]">fallback track</span>
              </div>
              <input
                ref={playlistAudioInputRef}
                type="file"
                accept="audio/*"
                onChange={(event) => {
                  handleAudioUpload(event.target.files?.[0], (dataUrl) => updatePlaylist("audioUrl", dataUrl));
                  event.target.value = "";
                }}
                className="sr-only"
              />
            </div>

            {audioUploadStatus ? (
              <div className="text-[11px] text-[#7a746a]">{audioUploadStatus}</div>
            ) : null}

            <button type="button" onClick={deleteSelectedPlaylist} className="border border-[#e3e1dc] px-3 py-2 text-xs hover:bg-[#f0eee9]">
              delete this playlist
            </button>
          </>
        ) : (
          <EmptyState label="no playlist selected" hint="add or select a playlist" />
        )}
      </div>
    </section>
  );
}

function AdminArchivePanel({
  works,
  selectedWork,
  selectedWorkId,
  setSelectedWorkId,
  updateWork,
  deleteSelectedWork,
  addArchiveResource,
}) {
  const archiveWorks = works.filter((work) => (work.collection || "main").trim().toLowerCase() === "archive");

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4 border border-[#e3e1dc] bg-[#faf9f6] p-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-[#8a857a]">archive resources</div>
          <p className="mt-1 text-xs leading-5 text-[#7a746a]">
            Add public-folder images as simple downloadable/reference resources.
          </p>
        </div>

        <ImageFolderPicker
          label="add resource from folder"
          actionLabel="add resource"
          onSelect={addArchiveResource}
        />

        {archiveWorks.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {archiveWorks.map((work) => (
              <button
                key={work.id}
                type="button"
                onClick={() => setSelectedWorkId(work.id)}
                className={`border bg-[#f7f6f3] p-1 text-left transition hover:border-[#2e2e2b] ${
                  selectedWorkId === work.id ? "border-[#2e2e2b]" : "border-[#e3e1dc]"
                }`}
              >
                {work.image ? (
                  <img
                    src={safeImageUrl(work.image)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full bg-white object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full bg-[#ebe9e4]" />
                )}
                <div className="mt-1 truncate px-1 text-[10px] text-[#4a4742]">{getArchiveResourceCode(work)}</div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState label="archive is empty" hint="choose images from the folder picker" />
        )}
      </div>

      <div className="space-y-3 border border-[#e3e1dc] bg-[#faf9f6] p-4">
        {selectedWork && (selectedWork.collection || "main").trim().toLowerCase() === "archive" ? (
          <>
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#8a857a]">selected resource</div>
            {selectedWork.image ? (
              <img
                src={safeImageUrl(selectedWork.image)}
                alt=""
                loading="lazy"
                decoding="async"
                className="max-h-52 w-full border border-[#e3e1dc] bg-white object-contain"
              />
            ) : null}
            <div className="border border-[#e3e1dc] bg-[#f6f5f2] p-2 text-xs">
              <div className="text-[11px] uppercase tracking-[0.08em] text-[#8a857a]">resource code</div>
              <div className="mt-1">{getArchiveResourceCode(selectedWork)}</div>
            </div>
            <AdminField label="year" value={selectedWork.year} onChange={(value) => updateWork("year", value)} inputMode="numeric" />
            <button
              type="button"
              onClick={() => updateWork("collection", "main")}
              className="w-full border border-[#e3e1dc] px-3 py-2 text-xs hover:bg-[#f0eee9]"
            >
              restore to gallery
            </button>
            <button type="button" onClick={deleteSelectedWork} className="w-full border border-[#e3e1dc] px-3 py-2 text-xs hover:bg-[#f0eee9]">
              delete resource
            </button>
          </>
        ) : (
          <EmptyState label="no resource selected" hint="select a resource from the grid" />
        )}
      </div>
    </section>
  );
}

function AdminProjectsPanel({
  projects,
  selectedProject,
  selectedProjectId,
  setSelectedProjectId,
  updateProject,
  deleteSelectedProject,
}) {
  return (
    <section className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
      <ListPanel
        label="PRJCTS"
        items={projects}
        selectedId={selectedProjectId}
        setSelectedId={setSelectedProjectId}
        getTitle={(project) => project.title}
      />
      <div className="space-y-3 border border-[#e3e1dc] bg-[#faf9f6] p-4">
        {selectedProject ? (
          <>
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#8a857a]">future project entry</div>
            <AdminField label="project title" value={selectedProject.title} onChange={(value) => updateProject("title", value)} />
            <AdminField label="small note" value={selectedProject.note} onChange={(value) => updateProject("note", value)} />
            <AdminField label="project text / image notes" value={selectedProject.body} onChange={(value) => updateProject("body", value)} textarea tall />
            <button type="button" onClick={deleteSelectedProject} className="border border-[#e3e1dc] px-3 py-2 text-xs hover:bg-[#f0eee9]">
              delete this project
            </button>
          </>
        ) : (
          <EmptyState label="no project selected" hint="add projects later when ready" />
        )}
      </div>
    </section>
  );
}

function AdminTerminalPanel({
  terminalConfig,
  updateTerminalField,
  updateTerminalCommand,
  deleteTerminalCommand,
  addTerminalCommand,
  resetTerminal,
}) {
  return (
    <section className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
      <div className="border border-[#e3e1dc] bg-[#faf9f6] p-3">
        <div className="mb-3 text-[11px] uppercase tracking-[0.12em] text-[#8a857a]">
          terminal
        </div>
        <div className="space-y-3 text-xs leading-5 text-[#7a746a]">
          <p>Edit what the terminal says without touching the code.</p>
          <p>Each response line should go on a new line.</p>
          <p>Built-in commands still work: help, list, open 1, random, latest, collections, playlist, prjcts, gallery, archive, clear.</p>
        </div>
        <button
          type="button"
          onClick={resetTerminal}
          className="mt-4 w-full border border-[#e3e1dc] px-3 py-2 text-xs hover:bg-[#f0eee9]"
        >
          reset terminal display
        </button>
      </div>

      <div className="space-y-4 border border-[#e3e1dc] bg-[#faf9f6] p-4">
        <AdminField
          label="intro text"
          value={linesToText(terminalConfig.introLines)}
          onChange={(value) => updateTerminalField("introLines", value)}
          textarea
        />
        <AdminField
          label="unknown command response"
          value={linesToText(terminalConfig.unknownResponse)}
          onChange={(value) => updateTerminalField("unknownResponse", value)}
          textarea
        />
        <AdminField
          label="gallery command response"
          value={linesToText(terminalConfig.galleryResponse)}
          onChange={(value) => updateTerminalField("galleryResponse", value)}
          textarea
        />
        <AdminField
          label="first open response"
          value={linesToText(terminalConfig.firstOpenResponse)}
          onChange={(value) => updateTerminalField("firstOpenResponse", value)}
          textarea
        />
        <AdminField
          label="repeat open response"
          value={linesToText(terminalConfig.repeatOpenResponse)}
          onChange={(value) => updateTerminalField("repeatOpenResponse", value)}
          textarea
        />
        <AdminField
          label="missing work response"
          value={linesToText(terminalConfig.missingWorkResponse)}
          onChange={(value) => updateTerminalField("missingWorkResponse", value)}
          textarea
        />

        <div className="border-t border-[#e3e1dc] pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#8a857a]">
              custom commands
            </div>
            <button
              type="button"
              onClick={addTerminalCommand}
              className="border border-[#e3e1dc] px-3 py-1 text-xs hover:bg-[#f0eee9]"
            >
              + command
            </button>
          </div>

          <div className="space-y-3">
            {terminalConfig.commands.map((command) => (
              <div key={command.id} className="border border-[#e3e1dc] bg-[#f6f5f2] p-3">
                <AdminField
                  label="typed command"
                  value={command.trigger}
                  onChange={(value) => updateTerminalCommand(command.id, "trigger", value)}
                />
                <div className="mt-3">
                  <AdminField
                    label="response"
                    value={command.response}
                    onChange={(value) => updateTerminalCommand(command.id, "response", value)}
                    textarea
                  />
                </div>
                <button
                  type="button"
                  onClick={() => deleteTerminalCommand(command.id)}
                  className="mt-3 border border-[#e3e1dc] px-3 py-1 text-xs hover:bg-[#f0eee9]"
                >
                  delete command
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ListPanel({ label, items, selectedId, setSelectedId, getTitle }) {
  return (
    <div className="border border-[#e3e1dc] bg-[#faf9f6] p-3">
      <div className="mb-3 text-[11px] uppercase tracking-[0.12em] text-[#8a857a]">{label}</div>
      <div className="space-y-1">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedId(item.id)}
            className={`block w-full border px-2 py-2 text-left text-xs transition ${
              selectedId === item.id ? "border-[#2e2e2b] bg-[#2e2e2b] text-[#f5f5f3]" : "border-transparent hover:bg-[#f0eee9]"
            }`}
          >
            {getTitle(item) || `${label} ${index + 1}`}
          </button>
        ))}
      </div>
    </div>
  );
}

function AdminField({ label, value, onChange, textarea = false, tall = false, inputMode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block uppercase tracking-[0.08em] text-[#8a857a]">{label}</span>
      {textarea ? (
        <textarea
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full border border-[#e3e1dc] bg-[#f6f5f2] p-2 outline-none focus:border-[#d8d3ca] ${tall ? "min-h-48" : "min-h-20"}`}
        />
      ) : (
        <input
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          inputMode={inputMode}
          className="w-full border border-[#e3e1dc] bg-[#f6f5f2] p-2 outline-none focus:border-[#d8d3ca]"
        />
      )}
    </label>
  );
}

function EmptyState({ label, hint }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center border border-dashed border-[#d8d3ca] bg-[#faf9f6] p-6 text-center text-xs text-[#8a857a]">
      <div>{label}</div>
      <div className="mt-1 opacity-70">{hint}</div>
    </div>
  );
}
