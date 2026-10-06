/* =========================================================
   MediaVerse — Official Application Script (app.js)
   Table of Contents:
   1. Configuration & Constants
   2. Application State & DOM Cache
   3. Utility & Helper Functions
   4. Google Drive URL Parsers
   5. Google Sheets JSONP Data Loader
   6. Search & Filter Engine
   7. UI Render Functions (Spotlight, Grid, Cards)
   8. Media Player & Fullscreen Engine
   9. Details Modal & Deep-Linking (Routing)
   10. Event Handlers & App Bootstrap
   ========================================================= */


/* =========================================================
   1. CONFIGURATION & CONSTANTS
   ========================================================= */

const MAIN_SHEET_ID = "13t2hCpG87CGhOuSdd2yX-6yLnSfufTCR4Jrca_dvg-0";
const MAIN_SHEET_NAME = "Media";

const ASSETS_SHEET_ID = "1hPw7hJFHmUuLjaRVK6VBU8n98W1ebuTWLuNSMOCTDcQ";
const COVERS_SHEET_NAME = "Covers";
const HIRES_AUDIO_SHEET_NAME = "HiResAudio";

/* প্রতি পেজে দৃশ্যমান গানের সংখ্যা */
const ITEMS_PER_PAGE = 18;


/* =========================================================
   2. APPLICATION STATE & DOM CACHE
   ========================================================= */

let MEDIA = [];
let COVER_ASSETS = [];
let AUDIO_ASSETS = [];
let activeFilter = "all";
let visibleCount = ITEMS_PER_PAGE;

/* প্রধান DOM এলিমেন্টসমূহ */
const grid = document.getElementById("mediaGrid");
const empty = document.getElementById("emptyState");
const search = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const loadMoreContainer = document.getElementById("loadMoreContainer");
const scrollTopBtn = document.getElementById("scrollTopBtn");
const closeDetailsBtn = document.getElementById("closeDetails");
const heroSection = document.querySelector(".hero");
const featuredSpotlight = document.getElementById("featuredSpotlight");
const librarySection = document.getElementById("library");
const detailsSection = document.getElementById("details");
const detailsContent = document.getElementById("detailsContent");


/* =========================================================
   3. UTILITY & HELPER FUNCTIONS
   ========================================================= */

function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function value(cell) {
  if (!cell || cell.v === null || cell.v === undefined) return "";
  return String(cell.v).trim();
}

function numberValue(cell) {
  if (!cell) return 0;
  const n = Number(cell.v);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJs(val) {
  return String(val ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}


/* =========================================================
   4. GOOGLE DRIVE URL PARSERS
   ========================================================= */

function getDriveFileId(url) {
  if (!url) return "";
  const text = String(url).trim();

  let match = text.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];

  match = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];

  match = text.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];

  return "";
}

function getDriveImageUrls(url) {
  const fileId = getDriveFileId(url);
  if (!fileId) return [];

  const id = encodeURIComponent(fileId);
  return [
    `https://drive.google.com/thumbnail?id=${id}&sz=w1200`,
    `https://drive.google.com/uc?export=view&id=${id}`,
    `https://lh3.googleusercontent.com/d/${id}=w1200`
  ];
}

function getDrivePreviewUrl(url) {
  const fileId = getDriveFileId(url);
  if (!fileId) return "";
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}


/* =========================================================
   5. GOOGLE SHEETS JSONP DATA LOADER
   ========================================================= */

function loadGoogleSheet(sheetId, sheetName) {
  return new Promise((resolve, reject) => {
    const callbackName = "mediaVerseCallback_" + Date.now() + "_" + Math.random().toString(36).substring(2);
    const script = document.createElement("script");
    script.id = "mediaVerse_" + sheetName + "_" + Date.now();
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (script.parentNode) script.parentNode.removeChild(script);
      try { delete window[callbackName]; } catch (e) {}
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Google Sheet timeout: ${sheetName}`));
    }, 20000);

    window[callbackName] = function(response) {
      clearTimeout(timeout);
      try {
        if (!response || !response.table) {
          throw new Error(`Invalid Google Sheet response: ${sheetName}`);
        }
        resolve(response.table.rows || []);
      } catch (error) {
        reject(error);
      } finally {
        cleanup();
      }
    };

    script.onerror = function() {
      clearTimeout(timeout);
      cleanup();
      reject(new Error(`Google Sheet request failed: ${sheetName}`));
    };

    const baseUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`;
    const params = `?sheet=${encodeURIComponent(sheetName)}&tqx=${encodeURIComponent("out:json;responseHandler:" + callbackName)}`;
    script.src = baseUrl + params;
    document.body.appendChild(script);
  });
}

async function loadAllData() {
  if (!grid) return;
  showLoading();

  try {
    const [mediaRows, coverRows, audioRows] = await Promise.all([
      loadGoogleSheet(MAIN_SHEET_ID, MAIN_SHEET_NAME),
      loadGoogleSheet(ASSETS_SHEET_ID, COVERS_SHEET_NAME),
      loadGoogleSheet(ASSETS_SHEET_ID, HIRES_AUDIO_SHEET_NAME)
    ]);

    /* ১. কভার অ্যাসেট */
    COVER_ASSETS = coverRows.map(row => {
      const title = value(row.c?.[0]);
      const fileName = value(row.c?.[1]);
      const driveUrl = value(row.c?.[2]);
      const downloadUrl = value(row.c?.[3]);
      const imageUrls = getDriveImageUrls(driveUrl || downloadUrl);

      return {
        title,
        key: normalizeTitle(title),
        fileName,
        driveUrl,
        downloadUrl,
        imageUrls,
        imageUrl: imageUrls[0] || ""
      };
    }).filter(item => item.title);

    /* ২. হাই-রেস অডিও অ্যাসেট */
    AUDIO_ASSETS = audioRows.map(row => {
      const title = value(row.c?.[0]);
      const fileName = value(row.c?.[1]);
      const format = value(row.c?.[2]);
      const driveUrl = value(row.c?.[3]);
      const downloadUrl = value(row.c?.[4]);

      return {
        title,
        key: normalizeTitle(title),
        fileName,
        format,
        driveUrl,
        downloadUrl
      };
    }).filter(item => item.title);

    /* ৩. মেইন মিডিয়া শিট ম্যাপিং */
    MEDIA = mediaRows.map((row, index) => {
      const c = row.c || [];
      const title = value(c[1]);
      if (!title || title === "Title") return null;

      const mediaKey = normalizeTitle(title);
      const cover = COVER_ASSETS.find(item => item.key === mediaKey) || null;
      const audio = AUDIO_ASSETS.find(item => item.key === mediaKey) || null;
      const embeddedHiRes = numberValue(c[12]) > 0;
      const externalHiRes = !!(audio && audio.downloadUrl);

      return {
        id: value(c[0]) || "media-" + index,
        title,
        fileName: value(c[2]),
        artist: value(c[3]),
        album: value(c[4]),
        composer: value(c[5]),
        genre: value(c[6]),
        language: value(c[7]),
        resolution: value(c[8]),
        videoCodec: value(c[9]),
        videoQuality: value(c[10]),
        audioCount: numberValue(c[11]),
        embeddedHiRes,
        embeddedHiResInfo: value(c[12]),
        subtitleCount: numberValue(c[13]),
        /* ডিউরেশন হিসেবে কভার পাথ না নেওয়ার জন্য খালি রাখা হলো */
        duration: "",
        cover: cover ? cover.imageUrl : "",
        coverImageUrls: cover ? cover.imageUrls : [],
        coverDriveUrl: cover ? cover.driveUrl : "",
        coverDownloadUrl: cover ? cover.downloadUrl : "",
        coverFileName: cover ? cover.fileName : "",
        coverSource: value(c[15]),
        videoUrl: value(c[16]),
        downloadUrl: value(c[17]),
        hiRes: embeddedHiRes || externalHiRes,
        audioUrl: audio ? audio.downloadUrl : "",
        audioDriveUrl: audio ? audio.driveUrl : "",
        audioFileName: audio ? audio.fileName : "",
        audioFormat: audio ? audio.format : "",
        hiResInfo: audio ? audio.format : (embeddedHiRes ? value(c[12]) : "")
      };
    }).filter(Boolean);

    if (MEDIA.length === 0) {
      showNoMedia();
      return;
    }

    renderFeaturedSpotlight();
    render();

  } catch (error) {
    console.error("MediaVerse loading error:", error);
    showLoadError(error.message);
  }
}


/* =========================================================
   6. SEARCH & FILTER ENGINE
   ========================================================= */

function matches(item, filter) {
  if (filter === "all") return true;
  if (filter === "2k") return (item.videoQuality || "").toLowerCase() === "2k";
  if (filter === "1080p") return (item.videoQuality || "").toLowerCase() === "1080p";
  if (filter === "hires") return item.hiRes;
  if (filter === "multi") return item.audioCount > 1;
  if (filter === "subs") return item.subtitleCount > 0;
  return true;
}


/* =========================================================
   7. UI RENDER FUNCTIONS (SPOTLIGHT, GRID, CARDS)
   ========================================================= */

function showLoading() {
  if (!grid) return;
  grid.innerHTML = `
    <div style="grid-column:1/-1; text-align:center; padding:50px 20px; color:#8fa8bf;">
      Loading media library...
    </div>
  `;
}

function showNoMedia() {
  if (!grid) return;
  grid.innerHTML = `
    <div style="grid-column:1/-1; text-align:center; padding:50px 20px; color:#8fa8bf;">
      <h3>No media found</h3>
      <p>Google Sheet is connected, but no media records were found.</p>
    </div>
  `;
  if (empty) empty.hidden = true;
}

function showLoadError(message) {
  if (!grid) return;
  grid.innerHTML = `
    <div style="grid-column:1/-1; text-align:center; padding:45px 20px;">
      <h3 style="margin-bottom:10px;">Media data could not be loaded</h3>
      <p style="opacity:.65; margin-bottom:8px;">Google Sheet connection failed.</p>
      <small style="opacity:.45; display:block; margin-bottom:15px;">${escapeHtml(message || "Unknown error")}</small>
      <button onclick="loadAllData()" style="padding:10px 18px; border:0; border-radius:8px; cursor:pointer; background:var(--blue); color:white; font-weight:700;">
        Retry
      </button>
    </div>
  `;
}

function renderFeaturedSpotlight() {
  if (!featuredSpotlight || MEDIA.length === 0) return;
  const latest = MEDIA[0];
  const coverUrl = latest.coverImageUrls?.[0] || "";

  featuredSpotlight.innerHTML = `
    <div class="spotlight-card" onclick="if (!event.target.closest('.spotlight-actions')) { showDetails('${escapeJs(latest.id)}'); }">
      <div class="spotlight-thumb">
        ${
          coverUrl
            ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(latest.title)}" loading="lazy">`
            : `<div class="cover-placeholder"><span>MV</span></div>`
        }
      </div>

      <div class="spotlight-info">
        <span class="spotlight-badge">🔥 LATEST RELEASE</span>
        <h2 class="spotlight-title">${escapeHtml(latest.title || "Untitled")}</h2>
        <div class="spotlight-artist">${escapeHtml(latest.artist || "Unknown Artist")}</div>

        <div class="spotlight-actions" onclick="event.stopPropagation();">
          ${latest.videoUrl ? `
            <button type="button" class="watch" onclick="event.stopPropagation(); showDetails('${escapeJs(latest.id)}'); playMedia('${escapeJs(latest.id)}');">
              ▶ Watch Video
            </button>
          ` : ""}
          ${latest.downloadUrl ? `
            <a class="download" href="${escapeHtml(latest.downloadUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation();">
              ↓ Video
            </a>
          ` : ""}
          ${latest.audioUrl ? `
            <a class="download audio-download" href="${escapeHtml(latest.audioUrl)}" target="_blank" rel="noopener" download onclick="event.stopPropagation();">
              🎧 Hi-Res Audio
            </a>
          ` : ""}
        </div>
      </div>
    </div>
  `;

  featuredSpotlight.hidden = false;
}

function getCover(item) {
  const urls = item.coverImageUrls || [];
  if (!urls.length) {
    return `<div class="cover-placeholder"><span>MV</span></div>`;
  }

  return `
    <img
      class="cover-image"
      src="${escapeHtml(urls[0])}"
      alt="${escapeHtml(item.title)}"
      loading="lazy"
      data-cover-index="0"
      data-urls="${escapeHtml(JSON.stringify(urls))}"
      onerror="
        const u = this.dataset.urls ? JSON.parse(this.dataset.urls) : [];
        const n = Number(this.dataset.coverIndex || 0) + 1;
        if (n < u.length) {
          this.dataset.coverIndex = n;
          this.src = u[n];
        } else {
          this.style.display = 'none';
          if (this.nextElementSibling) this.nextElementSibling.style.display = 'flex';
        }
      "
    >
    <div class="cover-placeholder" style="display:none;"><span>MV</span></div>
  `;
}

function card(x) {
  const videoButton = x.downloadUrl ? `
    <a class="download" href="${escapeHtml(x.downloadUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation();">
      ↓ Video
    </a>
  ` : "";

  const audioButton = x.audioUrl ? `
    <a class="download audio-download" href="${escapeHtml(x.audioUrl)}" target="_blank" rel="noopener" download onclick="event.stopPropagation();">
      🎧 Audio
    </a>
  ` : "";

  return `
    <article class="card" data-id="${escapeHtml(x.id)}" onclick="if (!event.target.closest('.actions')) { showDetails('${escapeJs(x.id)}'); }" style="cursor:pointer;">
      <div class="thumb">
        ${getCover(x)}
        <span class="quality">${escapeHtml(x.videoQuality || "—")}</span>
        ${x.duration ? `<span class="duration">${escapeHtml(x.duration)}</span>` : ""}
      </div>

      <div class="card-body">
        <h3>${escapeHtml(x.title || "Untitled")}</h3>
        <div class="artist">${escapeHtml(x.artist || "Unknown Artist")}</div>
        ${x.album ? `<div class="album">${escapeHtml(x.album)}</div>` : ""}

        <div class="meta">
          <span class="tag">${escapeHtml(x.language || "—")}</span>
          <span class="tag">${escapeHtml(x.genre || "—")}</span>
        </div>

        <div class="meta">
          <span class="tag">${escapeHtml(x.videoCodec || "—")}</span>
          <span class="tag">${escapeHtml(x.resolution || "—")}</span>
        </div>

        <div class="badges">
          <span class="badge audio">🎵 ${x.audioCount} Audio</span>
          ${x.hiRes ? `<span class="badge hires">🎧 Hi-Res</span>` : ""}
          ${x.subtitleCount > 0 ? `<span class="badge sub">📝 ${x.subtitleCount} Sub</span>` : ""}
        </div>

        <div class="actions" onclick="event.stopPropagation();">
          ${x.videoUrl ? `
            <button type="button" class="watch" onclick="event.stopPropagation(); event.preventDefault(); showDetails('${escapeJs(x.id)}');">
              ▶ Watch
            </button>
          ` : ""}
          ${videoButton}
          ${audioButton}
        </div>
      </div>
    </article>
  `;
}

function render() {
  if (!grid) return;
  const q = search ? search.value.trim().toLowerCase() : "";

  const data = MEDIA.filter(item => {
    const filterMatch = matches(item, activeFilter);
    const searchable = [
      item.title, item.artist, item.album, item.composer,
      item.genre, item.language, item.fileName, item.videoQuality,
      item.videoCodec, item.resolution
    ].join(" ").toLowerCase();

    return filterMatch && searchable.includes(q);
  });

  const visibleData = data.slice(0, visibleCount);

  grid.innerHTML = visibleData.length
    ? visibleData.map(card).join("")
    : `<div style="grid-column:1/-1; text-align:center; padding:50px 20px; color:#8fa8bf;">No matching media found.</div>`;

  if (empty) {
    empty.hidden = data.length !== 0;
  }

  if (loadMoreContainer) {
    loadMoreContainer.hidden = !(data.length > visibleCount);
  }
}

/* =========================================================
   8. MEDIA PLAYER & FULLSCREEN ENGINE (CLEAN & CINEMATIC)
   ========================================================= */

window.togglePlayerFullscreen = function() {
  const el = document.getElementById("playerWrapper");
  if (!el) return;

  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
};

window.playMedia = function(id) {
  const x = MEDIA.find(item => String(item.id) === String(id));
  if (!x) return;

  const playerBox = document.getElementById("mediaPlayer");
  if (!playerBox) return;

  const previewUrl = getDrivePreviewUrl(x.videoUrl);

  if (!previewUrl) {
    playerBox.innerHTML = `
      <div style="padding:25px; text-align:center; color:#8fa8bf; background:#0b1625; border-radius:14px; border:1px solid #1a3450;">
        <p style="margin:0 0 10px; font-size:14px;">গুগল ড্রাইভ ভিডিও লিঙ্ক প্লেয়ারে কনভার্ট করা যায়নি।</p>
        ${x.videoUrl ? `<a href="${escapeHtml(x.videoUrl)}" target="_blank" rel="noopener" style="display:inline-block; padding:10px 18px; background:linear-gradient(135deg, #1595ff, #0b7fe0); color:white; border-radius:10px; font-weight:800; text-decoration:none;">ভিডিও ওপেন করুন</a>` : ""}
      </div>
    `;
    playerBox.hidden = false;
    return;
  }

  /* সিনেমাটিক ও ক্লিন প্লেয়ার (ড্রাইভের বাড়তি লিঙ্ক ছাড়া) */
  playerBox.innerHTML = `
    <div style="
      background: linear-gradient(180deg, rgba(14, 29, 48, 0.95), rgba(7, 17, 31, 0.9));
      border: 1px solid rgba(25, 215, 255, 0.3);
      border-radius: 18px;
      padding: 14px;
      margin-top: 15px;
      margin-bottom: 20px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(25, 215, 255, 0.12);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    ">
      
      <!-- প্লেয়ার হেডার: টাইটেল ও কন্ট্রোল বাটন -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:0 2px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; background:rgba(25, 215, 255, 0.15); border:1px solid rgba(25, 215, 255, 0.3); border-radius:8px; font-size:13px;">
            🎬
          </span>
          <span style="font-size:12px; font-weight:900; color:var(--cyan); letter-spacing:1px; text-transform:uppercase;">
            Cinema Player
          </span>
        </div>

        <div style="display:flex; gap:8px;">
          <button
            type="button"
            onclick="togglePlayerFullscreen()"
            style="
              background: linear-gradient(135deg, #1595ff, #0070d6);
              color: #ffffff;
              border: 0;
              padding: 7px 14px;
              border-radius: 9px;
              cursor: pointer;
              font-size: 12px;
              font-weight: 800;
              display: inline-flex;
              align-items: center;
              gap: 5px;
              box-shadow: 0 4px 14px rgba(21, 149, 255, 0.35);
              transition: transform 0.15s ease;
            "
            onmouseover="this.style.transform='scale(1.03)'"
            onmouseout="this.style.transform='scale(1)'"
          >
            ⛶ Fullscreen
          </button>

          <button
            type="button"
            onclick="closeMediaPlayer()"
            style="
              background: rgba(26, 52, 80, 0.85);
              color: #c7d5e3;
              border: 1px solid rgba(255, 255, 255, 0.1);
              padding: 7px 12px;
              border-radius: 9px;
              cursor: pointer;
              font-size: 12px;
              font-weight: 700;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.background='#ff3f9b'; this.style.color='#ffffff';"
            onmouseout="this.style.background='rgba(26, 52, 80, 0.85)'; this.style.color='#c7d5e3';"
          >
            ✕ Close
          </button>
        </div>
      </div>

      <!-- আইফ্রেম ভিডিও র্যাপার (পারফেক্ট ১৬:৯ সিনেমাটিক রেশিও) -->
        <div
      id="playerWrapper"
      style="
        position: relative;
        width: 100%;
        aspect-ratio: 16/9;
        background: #000000;
        border-radius: 14px;
        overflow: hidden;
        /* প্রিমিয়াম সিনেমাটিক বর্ডার ও সফট গ্লো */
        border: 1.5px solid rgba(25, 215, 255, 0.45);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(25, 215, 255, 0.15);
      "
    >

        <iframe
          src="${escapeHtml(previewUrl)}"
          style="position:absolute; inset:0; width:100%; height:100%; border:0;"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowfullscreen
          referrerpolicy="no-referrer"
          loading="lazy"
          title="${escapeHtml(x.title || "Media Player")}"
        ></iframe>
      </div>

      <!-- মিনিমাল স্ট্যাটাস বার -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding:0 4px;">
        <span style="font-size:11px; color:var(--muted); font-weight:600; display:inline-flex; align-items:center; gap:5px;">
          <span style="width:7px; height:7px; background:var(--green); border-radius:50%; display:inline-block;"></span>
          HD Stream Active
        </span>

        ${x.subtitleCount > 0 ? `
          <span style="font-size:11px; color:#46e29a; font-weight:700;">
            📝 ${x.subtitleCount} Subtitles Available
          </span>
        ` : ""}
      </div>

    </div>
  `;

  playerBox.hidden = false;

  playerBox.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
};

window.closeMediaPlayer = function() {
  const playerBox = document.getElementById("mediaPlayer");
  if (!playerBox) return;
  playerBox.innerHTML = "";
  playerBox.hidden = true;
};




/* =========================================================
   9. DETAILS MODAL & DEEP-LINKING (ROUTING)
   ========================================================= */

window.showDetails = function(id, fromHistory = false) {
  const x = MEDIA.find(item => String(item.id) === String(id));
  if (!x) return;

  if (!fromHistory) {
    history.pushState({ mediaId: String(id) }, "", "#media/" + encodeURIComponent(String(id)));
  }

  if (!detailsSection || !detailsContent) return;
  const urls = x.coverImageUrls || [];

  const cover = urls.length ? `
    <img
      class="detail-cover-image"
      src="${escapeHtml(urls[0])}"
      alt="${escapeHtml(x.title)}"
      loading="lazy"
      data-cover-index="0"
      data-urls="${escapeHtml(JSON.stringify(urls))}"
      onerror="
        const u = this.dataset.urls ? JSON.parse(this.dataset.urls) : [];
        const n = Number(this.dataset.coverIndex || 0) + 1;
        if (n < u.length) {
          this.dataset.coverIndex = n;
          this.src = u[n];
        } else {
          this.style.display = 'none';
          if (this.nextElementSibling) this.nextElementSibling.style.display = 'flex';
        }
      "
    >
    <div class="cover-placeholder" style="display:none;"><span>MV</span></div>
  ` : `<div class="cover-placeholder"><span>MV</span></div>`;

  detailsContent.innerHTML = `
    <div class="detail">
      <div class="detail-cover">${cover}</div>

      <div>
        <p class="eyebrow">MEDIA DETAILS</p>
        <h2>${escapeHtml(x.title || "Untitled")}</h2>
        <div class="artist">${escapeHtml(x.artist || "Unknown Artist")}</div>

        <div id="mediaPlayer" hidden style="margin-top:20px; margin-bottom:20px;"></div>

        <div class="info-grid">
          <div class="info"><small>Album</small><b>${escapeHtml(x.album || "—")}</b></div>
          <div class="info"><small>Composer</small><b>${escapeHtml(x.composer || "—")}</b></div>
          <div class="info"><small>Genre</small><b>${escapeHtml(x.genre || "—")}</b></div>
          <div class="info"><small>Language</small><b>${escapeHtml(x.language || "—")}</b></div>
          <div class="info"><small>Resolution</small><b>${escapeHtml(x.resolution || "—")}</b></div>
          <div class="info"><small>Video Codec</small><b>${escapeHtml(x.videoCodec || "—")}</b></div>
          <div class="info"><small>Quality</small><b>${escapeHtml(x.videoQuality || "—")}</b></div>
          <div class="info"><small>Audio</small><b>${x.audioCount} tracks</b></div>
          <div class="info">
            <small>Hi-Res Audio</small>
            <b>${x.audioUrl ? escapeHtml(x.audioFormat || "Available") : (x.embeddedHiRes ? escapeHtml(x.embeddedHiResInfo || "Embedded Hi-Res") : "Not available")}</b>
          </div>
          <div class="info"><small>Subtitles</small><b>${x.subtitleCount}</b></div>
          <div class="info"><small>Media ID</small><b>${escapeHtml(x.id)}</b></div>
          <div class="info"><small>File Name</small><b>${escapeHtml(x.fileName || "—")}</b></div>
          <div class="info"><small>Cover</small><b>${urls.length ? "Available" : "Not available"}</b></div>
          ${x.audioFileName ? `<div class="info"><small>Hi-Res File</small><b>${escapeHtml(x.audioFileName)}</b></div>` : ""}
        </div>

        <div class="detail-actions">
          ${x.videoUrl ? `<a href="#" class="play-button" onclick="event.preventDefault(); playMedia('${escapeJs(x.id)}');">▶ Play</a>` : ""}
          ${x.downloadUrl ? `<a class="download-button" href="${escapeHtml(x.downloadUrl)}" target="_blank" rel="noopener">↓ Video Download</a>` : ""}
          ${x.audioUrl ? `<a class="audio-download-button" href="${escapeHtml(x.audioUrl)}" target="_blank" rel="noopener" download>🎧 Hi-Res Audio</a>` : ""}
          <button type="button" class="copy-link-button" onclick="copyMediaLink('${escapeJs(x.id)}', this)">🔗 Copy Link</button>
        </div>
      </div>
    </div>
  `;

  detailsSection.hidden = false;

  /* ডিটেইলস ভিউতে হিরো ব্যানার, লাইব্রেরি ও স্পটলাইট লুকিয়ে ফেলা হচ্ছে */
  if (heroSection) heroSection.style.display = "none";
  if (librarySection) librarySection.style.display = "none";
  if (featuredSpotlight) featuredSpotlight.style.display = "none";

  detailsSection.scrollIntoView({ behavior: "smooth", block: "start" });
};

function returnToLibrary() {
  closeMediaPlayer();
  if (detailsSection) detailsSection.hidden = true;

  /* লাইব্রেরিতে ব্যাক করলে হিরো ব্যানার এবং বাকি সেকশন ফিরিয়ে আনা হচ্ছে */
  if (heroSection) heroSection.style.display = "";
  if (librarySection) librarySection.style.display = "";
  if (featuredSpotlight) featuredSpotlight.style.display = "";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.copyMediaLink = function(id, btn) {
  const fullUrl = window.location.origin + window.location.pathname + "#media/" + encodeURIComponent(id);

  navigator.clipboard.writeText(fullUrl).then(() => {
    const originalText = btn.innerHTML;
    btn.innerHTML = "✓ Copied!";
    btn.style.background = "var(--green)";
    btn.style.color = "#04130b";
    btn.style.borderColor = "var(--green)";

    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = "";
      btn.style.color = "";
      btn.style.borderColor = "";
    }, 2000);
  }).catch(() => {
    prompt("লিংকটি কপি করে নিন:", fullUrl);
  });
};


/* =========================================================
   10. EVENT HANDLERS & APP BOOTSTRAP
   ========================================================= */

/* ফিল্টার বাটন হ্যান্ডলার */
document.querySelectorAll(".filter").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter || "all";
    visibleCount = ITEMS_PER_PAGE;
    render();
  });
});

/* হেডার ন্যাভ লিংক ফিল্টার */
document.querySelectorAll(".nav a[data-filter]").forEach(link => {
  link.addEventListener("click", () => {
    activeFilter = link.dataset.filter || "all";
    visibleCount = ITEMS_PER_PAGE;
    render();
  });
});

/* সার্চ ইনপুট */
if (search) {
  search.addEventListener("input", () => {
    visibleCount = ITEMS_PER_PAGE;
    render();
  });
}

if (searchBtn && search) {
  searchBtn.addEventListener("click", () => search.focus());
}

/* ডিটেইলস ব্যাক বাটন */
if (closeDetailsBtn) {
  closeDetailsBtn.addEventListener("click", () => {
    if (location.hash.startsWith("#media/")) {
      history.back();
    } else {
      returnToLibrary();
    }
  });
}

/* অ্যান্ড্রয়েড/ব্রাউজার ব্যাক বাটন হ্যান্ডলার */
window.addEventListener("popstate", () => {
  if (!location.hash.startsWith("#media/")) {
    returnToLibrary();
  }
});

/* লোড মোর বাটন */
if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", () => {
    visibleCount += ITEMS_PER_PAGE;
    render();
  });
}

/* স্ক্রোল টু টপ বাটন */
if (scrollTopBtn) {
  window.addEventListener("scroll", () => {
    scrollTopBtn.hidden = window.scrollY <= 350;
  });

  scrollTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ইউআরএল হ্যাশ থেকে সরাসরি মিডিয়া ওপেন করা */
window.addEventListener("load", () => {
  const hash = location.hash;
  if (hash.startsWith("#media/")) {
    const id = decodeURIComponent(hash.substring("#media/".length));
    const waitForMedia = setInterval(() => {
      if (MEDIA.length > 0) {
        clearInterval(waitForMedia);
        showDetails(id, true);
      }
    }, 100);

    setTimeout(() => clearInterval(waitForMedia), 20000);
  }
});

/* অ্যাপ্লিকেশন স্টার্ট */
loadAllData();
