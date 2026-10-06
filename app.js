/* =========================================================
   MediaVerse — Google Sheets Connected App
   Main Media + Covers + Hi-Res Audio
   Google Drive Embedded Player
   ========================================================= */


/* =========================================================
   GOOGLE SHEETS CONFIGURATION
   ========================================================= */

const MAIN_SHEET_ID =
  "13t2hCpG87CGhOuSdd2yX-6yLnSfufTCR4Jrca_dvg-0";

const MAIN_SHEET_NAME =
  "Media";


const ASSETS_SHEET_ID =
  "1hPw7hJFHmUuLjaRVK6VBU8n98W1ebuTWLuNSMOCTDcQ";

const COVERS_SHEET_NAME =
  "Covers";

const HIRES_AUDIO_SHEET_NAME =
  "HiResAudio";


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const grid =
  document.getElementById("mediaGrid");

const empty =
  document.getElementById("emptyState");

const search =
  document.getElementById("searchInput");


/* =========================================================
   GLOBAL DATA
   ========================================================= */

let MEDIA = [];

let COVER_ASSETS = [];

let AUDIO_ASSETS = [];

let activeFilter = "all";


/* =========================================================
   GOOGLE SHEETS JSONP LOADER
   ========================================================= */

function loadGoogleSheet(sheetId, sheetName) {

  return new Promise((resolve, reject) => {

    const callbackName =
      "mediaVerseCallback_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2);


    const script =
      document.createElement("script");


    script.id =
      "mediaVerse_" +
      sheetName +
      "_" +
      Date.now();


    let finished = false;


    const cleanup = () => {

      if (finished) {
        return;
      }

      finished = true;


      if (script.parentNode) {

        script.parentNode.removeChild(
          script
        );

      }


      try {

        delete window[callbackName];

      } catch (e) {}

    };


    const timeout =
      setTimeout(() => {

        cleanup();

        reject(
          new Error(
            "Google Sheet timeout: " +
            sheetName
          )
        );

      }, 20000);


    window[callbackName] =
      function(response) {

        clearTimeout(timeout);


        try {

          if (
            !response ||
            !response.table
          ) {

            throw new Error(
              "Invalid Google Sheet response: " +
              sheetName
            );

          }


          const rows =
            response.table.rows || [];


          resolve(rows);

        } catch (error) {

          reject(error);

        } finally {

          cleanup();

        }

      };


    script.onerror =
      function() {

        clearTimeout(timeout);

        cleanup();

        reject(
          new Error(
            "Google Sheet request failed: " +
            sheetName
          )
        );

      };


    const baseUrl =
      "https://docs.google.com/spreadsheets/d/" +
      sheetId +
      "/gviz/tq";


    const params =
      "?sheet=" +
      encodeURIComponent(sheetName) +
      "&tqx=" +
      encodeURIComponent(
        "out:json;responseHandler:" +
        callbackName
      );


    script.src =
      baseUrl +
      params;


    document.body.appendChild(script);

  });

}


/* =========================================================
   GOOGLE DRIVE FILE ID
   ========================================================= */

function getDriveFileId(url) {

  if (!url) {
    return "";
  }


  const text =
    String(url).trim();


  let match =
    text.match(
      /\/file\/d\/([a-zA-Z0-9_-]+)/
    );


  if (match && match[1]) {

    return match[1];

  }


  match =
    text.match(
      /[?&]id=([a-zA-Z0-9_-]+)/
    );


  if (match && match[1]) {

    return match[1];

  }


  match =
    text.match(
      /\/d\/([a-zA-Z0-9_-]+)/
    );


  if (match && match[1]) {

    return match[1];

  }


  return "";

}


/* =========================================================
   GOOGLE DRIVE COVER URL
   ========================================================= */

function getDriveImageUrls(url) {

  const fileId =
    getDriveFileId(url);


  if (!fileId) {
    return [];
  }


  const id =
    encodeURIComponent(fileId);


  return [

    "https://drive.google.com/thumbnail?id=" +
      id +
      "&sz=w1200",

    "https://drive.google.com/uc?export=view&id=" +
      id,

    "https://lh3.googleusercontent.com/d/" +
      id +
      "=w1200"

  ];

}


/* =========================================================
   GOOGLE DRIVE PREVIEW URL
   ========================================================= */

function getDrivePreviewUrl(url) {

  const fileId =
    getDriveFileId(url);


  if (!fileId) {
    return "";
  }


  return (
    "https://drive.google.com/file/d/" +
    encodeURIComponent(fileId) +
    "/preview"
  );

}


/* =========================================================
   START LOADING
   ========================================================= */

async function loadAllData() {

  if (!grid) {

    console.error(
      "mediaGrid not found."
    );

    return;

  }


  showLoading();


  try {

    console.log(
      "Loading Main Media Sheet..."
    );


    console.log(
      "Loading Covers Sheet..."
    );


    console.log(
      "Loading HiResAudio Sheet..."
    );


    const results =
      await Promise.all([

        loadGoogleSheet(
          MAIN_SHEET_ID,
          MAIN_SHEET_NAME
        ),

        loadGoogleSheet(
          ASSETS_SHEET_ID,
          COVERS_SHEET_NAME
        ),

        loadGoogleSheet(
          ASSETS_SHEET_ID,
          HIRES_AUDIO_SHEET_NAME
        )

      ]);


    const mediaRows =
      results[0];

    const coverRows =
      results[1];

    const audioRows =
      results[2];


    console.log(
      "Main Media rows:",
      mediaRows.length
    );


    console.log(
      "Cover rows:",
      coverRows.length
    );


    console.log(
      "Hi-Res Audio rows:",
      audioRows.length
    );


    /* =====================================================
       COVER DATABASE
       ===================================================== */

    COVER_ASSETS =
      coverRows
        .map(row => {

          const title =
            value(row.c?.[0]);


          const fileName =
            value(row.c?.[1]);


          const driveUrl =
            value(row.c?.[2]);


          const downloadUrl =
            value(row.c?.[3]);


          const imageUrls =
            getDriveImageUrls(
              driveUrl ||
              downloadUrl
            );


          return {

            title:
              title,

            key:
              normalizeTitle(title),

            fileName:
              fileName,

            driveUrl:
              driveUrl,

            downloadUrl:
              downloadUrl,

            imageUrls:
              imageUrls,

            imageUrl:
              imageUrls[0] || ""

          };

        })
        .filter(
          item =>
            item.title
        );


    /* =====================================================
       HI-RES AUDIO DATABASE
       ===================================================== */

    AUDIO_ASSETS =
      audioRows
        .map(row => {

          const title =
            value(row.c?.[0]);


          const fileName =
            value(row.c?.[1]);


          const format =
            value(row.c?.[2]);


          const driveUrl =
            value(row.c?.[3]);


          const downloadUrl =
            value(row.c?.[4]);


          return {

            title:
              title,

            key:
              normalizeTitle(title),

            fileName:
              fileName,

            format:
              format,

            driveUrl:
              driveUrl,

            downloadUrl:
              downloadUrl

          };

        })
        .filter(
          item =>
            item.title
        );


    /* =====================================================
       MAIN MEDIA DATABASE
       ===================================================== */

    MEDIA =
      mediaRows
        .map((row, index) => {

          const c =
            row.c || [];


          const title =
            value(c[1]);


          if (
            !title ||
            title === "Title"
          ) {

            return null;

          }


          const mediaKey =
            normalizeTitle(title);


          const cover =
            COVER_ASSETS.find(
              item =>
                item.key ===
                mediaKey
            ) || null;


          const audio =
            AUDIO_ASSETS.find(
              item =>
                item.key ===
                mediaKey
            ) || null;


          const embeddedHiRes =
            numberValue(c[12]) > 0;


          const externalHiRes =
            !!(
              audio &&
              audio.downloadUrl
            );


          return {

            id:
              value(c[0]) ||
              "media-" + index,


            title:
              title,


            fileName:
              value(c[2]),


            artist:
              value(c[3]),


            album:
              value(c[4]),


            composer:
              value(c[5]),


            genre:
              value(c[6]),


            language:
              value(c[7]),


            resolution:
              value(c[8]),


            videoCodec:
              value(c[9]),


            videoQuality:
              value(c[10]),


            audioCount:
              numberValue(c[11]),


            embeddedHiRes:
              embeddedHiRes,


            embeddedHiResInfo:
              value(c[12]),


            subtitleCount:
              numberValue(c[13]),


            /* Cover */
            cover:
              cover
                ? cover.imageUrl
                : "",


            coverImageUrls:
              cover
                ? cover.imageUrls
                : [],


            coverDriveUrl:
              cover
                ? cover.driveUrl
                : "",


            coverDownloadUrl:
              cover
                ? cover.downloadUrl
                : "",


            coverFileName:
              cover
                ? cover.fileName
                : "",


            coverSource:
              value(c[15]),


            /* Video */
            videoUrl:
              value(c[16]),


            downloadUrl:
              value(c[17]),


            /* Hi-Res Audio */
            hiRes:
              embeddedHiRes ||
              externalHiRes,


            audioUrl:
              audio
                ? audio.downloadUrl
                : "",


            audioDriveUrl:
              audio
                ? audio.driveUrl
                : "",


            audioFileName:
              audio
                ? audio.fileName
                : "",


            audioFormat:
              audio
                ? audio.format
                : "",


            hiResInfo:
              audio
                ? audio.format
                : (
                    embeddedHiRes
                      ? value(c[12])
                      : ""
                  )

          };

        })
        .filter(
          item =>
            item !== null
        );


    console.log(
      "Final Media:",
      MEDIA
    );


    console.log(
      "Cover Assets:",
      COVER_ASSETS
    );


    console.log(
      "Hi-Res Audio Assets:",
      AUDIO_ASSETS
    );


    if (
      MEDIA.length === 0
    ) {

      showNoMedia();

      return;

    }


    renderFeaturedSpotlight();

    render();


  } catch (error) {

    console.error(
      "MediaVerse loading error:",
      error
    );


    showLoadError(
      error.message
    );

  }

}


/* =========================================================
   NORMALIZE TITLE
   ========================================================= */

function normalizeTitle(title) {

  return String(title || "")
    .toLowerCase()
    .replace(
      /\.[a-z0-9]{2,5}$/i,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


/* =========================================================
   VALUE
   ========================================================= */

function value(cell) {

  if (!cell) {
    return "";
  }


  if (
    cell.v === null ||
    cell.v === undefined
  ) {

    return "";

  }


  return String(
    cell.v
  ).trim();

}


/* =========================================================
   NUMBER VALUE
   ========================================================= */

function numberValue(cell) {

  if (!cell) {
    return 0;
  }


  const n =
    Number(cell.v);


  return Number.isFinite(n)
    ? n
    : 0;

}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading() {

  if (!grid) {
    return;
  }


  grid.innerHTML = `

    <div style="
      grid-column:1/-1;
      text-align:center;
      padding:50px 20px;
      color:#8fa8bf;
    ">

      Loading media library...

    </div>

  `;

}


/* =========================================================
   NO MEDIA
   ========================================================= */

function showNoMedia() {

  if (!grid) {
    return;
  }


  grid.innerHTML = `

    <div style="
      grid-column:1/-1;
      text-align:center;
      padding:50px 20px;
      color:#8fa8bf;
    ">

      <h3>
        No media found
      </h3>

      <p>
        Google Sheet is connected,
        but no media records were found.
      </p>

    </div>

  `;


  if (empty) {
    empty.hidden = true;
  }

}


/* =========================================================
   LOAD ERROR
   ========================================================= */

function showLoadError(message) {

  if (!grid) {
    return;
  }


  grid.innerHTML = `

    <div style="
      grid-column:1/-1;
      text-align:center;
      padding:45px 20px;
    ">

      <h3 style="
        margin-bottom:10px;
      ">
        Media data could not be loaded
      </h3>


      <p style="
        opacity:.65;
        margin-bottom:8px;
      ">
        Google Sheet connection failed.
      </p>


      <small style="
        opacity:.45;
        display:block;
        margin-bottom:15px;
      ">
        ${escapeHtml(
          message ||
          "Unknown error"
        )}
      </small>


      <button
        onclick="loadAllData()"
        style="
          margin-top:5px;
          padding:10px 18px;
          border:0;
          border-radius:8px;
          cursor:pointer;
          background:#1595ff;
          color:white;
          font-weight:700;
        "
      >
        Retry
      </button>

    </div>

  `;

}


/* =========================================================
   FILTER
   ========================================================= */

function matches(item, filter) {

  if (
    filter === "all"
  ) {

    return true;

  }


  if (
    filter === "2k"
  ) {

    return (
      item.videoQuality ||
      ""
    )
      .toLowerCase() ===
      "2k";

  }


  if (
    filter === "1080p"
  ) {

    return (
      item.videoQuality ||
      ""
    )
      .toLowerCase() ===
      "1080p";

  }


  if (
    filter === "hires"
  ) {

    return item.hiRes;

  }


  if (
    filter === "multi"
  ) {

    return (
      item.audioCount >
      1
    );

  }


  if (
    filter === "subs"
  ) {

    return (
      item.subtitleCount >
      0
    );

  }


  return true;

}


/* =========================================================
   RENDER FEATURED / LATEST RELEASE SPOTLIGHT
   ========================================================= */

function renderFeaturedSpotlight() {

  const container =
    document.getElementById(
      "featuredSpotlight"
    );


  if (
    !container ||
    MEDIA.length === 0
  ) {
    return;
  }


  /* শিটের ১ম সারির (ইনডেক্স ০) গানটিই লেটেস্ট */
  const latest =
    MEDIA[0];


  const coverUrl =
    latest.coverImageUrls &&
    latest.coverImageUrls.length
      ? latest.coverImageUrls[0]
      : "";


  container.innerHTML = `

    <div
      class="spotlight-card"
      onclick="
        if (!event.target.closest('.spotlight-actions')) {
          showDetails('${escapeJs(latest.id)}');
        }
      "
    >

      <div class="spotlight-thumb">

        ${
          coverUrl
            ? `
              <img
                src="${escapeHtml(coverUrl)}"
                alt="${escapeHtml(latest.title)}"
                loading="lazy"
              >
            `
            : `
              <div class="cover-placeholder">
                <span>MV</span>
              </div>
            `
        }

      </div>


      <div class="spotlight-info">

        <span class="spotlight-badge">
          🔥 LATEST RELEASE
        </span>


        <h2 class="spotlight-title">
          ${escapeHtml(
            latest.title ||
            "Untitled"
          )}
        </h2>


        <div class="spotlight-artist">
          ${escapeHtml(
            latest.artist ||
            "Unknown Artist"
          )}
        </div>


        <div
          class="spotlight-actions"
          onclick="event.stopPropagation();"
        >

          ${
            latest.videoUrl
              ? `
                <button
                  type="button"
                  class="watch"
                  onclick="
                    event.stopPropagation();
                    showDetails('${escapeJs(latest.id)}');
                    playMedia('${escapeJs(latest.id)}');
                  "
                >
                  ▶ Watch Video
                </button>
              `
              : ""
          }


          ${
            latest.downloadUrl
              ? `
                <a
                  class="download"
                  href="${escapeHtml(latest.downloadUrl)}"
                  target="_blank"
                  rel="noopener"
                  onclick="event.stopPropagation();"
                >
                  ↓ Video
                </a>
              `
              : ""
          }


          ${
            latest.audioUrl
              ? `
                <a
                  class="download audio-download"
                  href="${escapeHtml(latest.audioUrl)}"
                  target="_blank"
                  rel="noopener"
                  download
                  onclick="event.stopPropagation();"
                >
                  🎧 Hi-Res Audio
                </a>
              `
              : ""
          }

        </div>

      </div>

    </div>

  `;


  container.hidden = false;

}


/* =========================================================
   RENDER
   ========================================================= */

function render() {

  if (!grid) {
    return;
  }


  const q =
    search
      ? search.value
          .trim()
          .toLowerCase()
      : "";


  const data =
    MEDIA.filter(item => {

      const filterMatch =
        matches(
          item,
          activeFilter
        );


      const searchable = [

        item.title,
        item.artist,
        item.album,
        item.composer,
        item.genre,
        item.language,
        item.fileName,
        item.videoQuality,
        item.videoCodec,
        item.resolution

      ]
        .join(" ")
        .toLowerCase();


      return (
        filterMatch &&
        searchable.includes(q)
      );

    });


  grid.innerHTML =
    data.length
      ? data.map(card).join("")
      : `

        <div style="
          grid-column:1/-1;
          text-align:center;
          padding:50px 20px;
          color:#8fa8bf;
        ">

          No matching media found.

        </div>

      `;


  if (empty) {

    empty.hidden =
      data.length !== 0;

  }

}


/* =========================================================
   COVER HTML
   ========================================================= */

function getCover(item) {

  const urls =
    item.coverImageUrls || [];


  if (!urls.length) {

    return `

      <div class="cover-placeholder">

        <span>
          MV
        </span>

      </div>

    `;

  }


  return `

    <img
      class="cover-image"
      src="${escapeHtml(
        urls[0]
      )}"
      alt="${escapeHtml(
        item.title
      )}"
      loading="lazy"

      data-cover-index="0"

      onerror="
        const urls =
          this.dataset.urls
            ? JSON.parse(
                this.dataset.urls
              )
            : [];

        const next =
          Number(
            this.dataset.coverIndex || 0
          ) + 1;

        if (
          next < urls.length
        ) {

          this.dataset.coverIndex =
            next;

          this.src =
            urls[next];

        } else {

          this.style.display =
            'none';

          if (
            this.nextElementSibling
          ) {

            this.nextElementSibling.style.display =
              'flex';

          }

        }
      "

      data-urls="${escapeHtml(
        JSON.stringify(urls)
      )}"
    >


    <div
      class="cover-placeholder"
      style="display:none;"
    >

      <span>
        MV
      </span>

    </div>

  `;

}


/* =========================================================
   CARD
   ========================================================= */

function card(x) {

  const videoButton =
    x.downloadUrl
      ? `

        <a
          class="download"
          href="${escapeHtml(
            x.downloadUrl
          )}"
          target="_blank"
          rel="noopener"
          onclick="
            event.stopPropagation();
          "
        >
          ↓ Video
        </a>

      `
      : "";


  const audioButton =
    x.audioUrl
      ? `

        <a
          class="download audio-download"
          href="${escapeHtml(
            x.audioUrl
          )}"
          target="_blank"
          rel="noopener"
          download
          onclick="
            event.stopPropagation();
          "
        >
          🎧 Audio
        </a>

      `
      : "";


  return `

    <article
      class="card"
      data-id="${escapeHtml(
        x.id
      )}"
      onclick="
        if (!event.target.closest('.actions')) {
          showDetails('${escapeJs(x.id)}');
        }
      "
      style="
        cursor:pointer;
      "
    >

      <div class="thumb">

        ${getCover(x)}

        <span class="quality">

          ${escapeHtml(
            x.videoQuality ||
            "—"
          )}

        </span>

        <span class="duration">

          ${escapeHtml(
            x.duration ||
            ""
          )}

        </span>

      </div>


      <div class="card-body">

        <h3>

          ${escapeHtml(
            x.title ||
            "Untitled"
          )}

        </h3>


        <div class="artist">

          ${escapeHtml(
            x.artist ||
            "Unknown Artist"
          )}

        </div>


        ${
          x.album
            ? `

              <div class="album">

                ${escapeHtml(
                  x.album
                )}

              </div>

            `
            : ""
        }


        <div class="meta">

          <span class="tag">

            ${escapeHtml(
              x.language ||
              "—"
            )}

          </span>


          <span class="tag">

            ${escapeHtml(
              x.genre ||
              "—"
            )}

          </span>

        </div>


        <div class="meta">

          <span class="tag">

            ${escapeHtml(
              x.videoCodec ||
              "—"
            )}

          </span>


          <span class="tag">

            ${escapeHtml(
              x.resolution ||
              "—"
            )}

          </span>

        </div>


        <div class="badges">

          <span class="badge audio">

            🎵
            ${x.audioCount}
            Audio

          </span>


          ${
            x.hiRes
              ? `

                <span class="badge hires">

                  🎧 Hi-Res

                </span>

              `
              : ""
          }


          ${
            x.subtitleCount > 0
              ? `

                <span class="badge sub">

                  📝
                  ${x.subtitleCount}
                  Sub

                </span>

              `
              : ""
          }

        </div>


        <div
          class="actions"
          onclick="event.stopPropagation();"
        >

          ${
            x.videoUrl
              ? `
                <button
                  type="button"
                  class="watch"
                  onclick="
                    event.stopPropagation();
                    event.preventDefault();
                    showDetails('${escapeJs(x.id)}');
                  "
                >
                  ▶ Watch
                </button>
              `
              : ""
          }


          ${videoButton}


          ${audioButton}

        </div>

      </div>

    </article>

  `;

}


/* =========================================================
   PLAY MEDIA
   ========================================================= */

window.playMedia =
function(id) {

  const x =
    MEDIA.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if (!x) {

    console.error(
      "Media not found:",
      id
    );

    return;

  }


  const playerBox =
    document.getElementById(
      "mediaPlayer"
    );


  if (!playerBox) {

    console.error(
      "mediaPlayer not found."
    );

    return;

  }


  const previewUrl =
    getDrivePreviewUrl(
      x.videoUrl
    );


  if (!previewUrl) {

    playerBox.innerHTML = `

      <div style="
        padding:30px;
        text-align:center;
        color:#8fa8bf;
      ">

        <p>
          Google Drive video link
          could not be converted
          to a player.
        </p>


        ${
          x.videoUrl
            ? `

              <a
                href="${escapeHtml(
                  x.videoUrl
                )}"
                target="_blank"
                rel="noopener"
                style="
                  display:inline-block;
                  margin-top:10px;
                  padding:10px 15px;
                  background:#1595ff;
                  color:white;
                  border-radius:9px;
                  font-weight:800;
                "
              >
                Open Video
              </a>

            `
            : ""
        }

      </div>

    `;


    playerBox.hidden =
      false;


    return;

  }


  playerBox.innerHTML = `

    <div style="
      position:relative;
      width:100%;
      aspect-ratio:16/9;
      min-height:240px;
      background:#000;
      border-radius:14px;
      overflow:hidden;
      border:1px solid #1a3450;
      box-shadow:
        0 15px 45px
        rgba(0,0,0,.35);
    ">

      <iframe
        src="${escapeHtml(
          previewUrl
        )}"
        style="
          position:absolute;
          inset:0;
          width:100%;
          height:100%;
          border:0;
        "
        allow="
          autoplay;
          fullscreen;
          encrypted-media;
          picture-in-picture
        "
        allowfullscreen
        loading="lazy"
        title="${escapeHtml(
          x.title ||
          "Media Player"
        )}"
      ></iframe>

    </div>

  `;


  playerBox.hidden =
    false;


  playerBox.scrollIntoView({
    behavior:
      "smooth",

    block:
      "center"
  });

};


/* =========================================================
   CLOSE PLAYER
   ========================================================= */

window.closeMediaPlayer =
function() {

  const playerBox =
    document.getElementById(
      "mediaPlayer"
    );


  if (!playerBox) {
    return;
  }


  playerBox.innerHTML =
    "";


  playerBox.hidden =
    true;

};


/* =========================================================
   DETAILS
   ========================================================= */

window.showDetails =
function(id, fromHistory = false) {

  const x =
    MEDIA.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if (!fromHistory) {

    history.pushState(
      {
        mediaId: String(id)
      },
      "",
      "#media/" +
        encodeURIComponent(String(id))
    );

  }


  if (!x) {

    console.error(
      "Media not found:",
      id
    );

    return;

  }


  const details =
    document.getElementById(
      "details"
    );


  const detailsContent =
    document.getElementById(
      "detailsContent"
    );


  if (
    !details ||
    !detailsContent
  ) {

    console.error(
      "Details section not found."
    );

    return;

  }


  const urls =
    x.coverImageUrls || [];


  const cover =
    urls.length
      ? `

        <img
          class="detail-cover-image"
          src="${escapeHtml(
            urls[0]
          )}"
          alt="${escapeHtml(
            x.title
          )}"
          loading="lazy"

          data-cover-index="0"

          data-urls="${escapeHtml(
            JSON.stringify(urls)
          )}"

          onerror="
            const urls =
              this.dataset.urls
                ? JSON.parse(
                    this.dataset.urls
                  )
                : [];

            const next =
              Number(
                this.dataset.coverIndex || 0
              ) + 1;

            if (
              next < urls.length
            ) {

              this.dataset.coverIndex =
                next;

              this.src =
                urls[next];

            } else {

              this.style.display =
                'none';

              if (
                this.nextElementSibling
              ) {

                this.nextElementSibling.style.display =
                  'flex';

              }

            }
          "
        >


        <div
          class="cover-placeholder"
          style="display:none;"
        >

          <span>
            MV
          </span>

        </div>

      `
      : `

        <div class="cover-placeholder">

          <span>
            MV
          </span>

        </div>

      `;


  detailsContent.innerHTML = `

    <div class="detail">


      <div class="detail-cover">

        ${cover}

      </div>


      <div>

        <p class="eyebrow">
          MEDIA DETAILS
        </p>


        <h2>

          ${escapeHtml(
            x.title ||
            "Untitled"
          )}

        </h2>


        <div class="artist">

          ${escapeHtml(
            x.artist ||
            "Unknown Artist"
          )}

        </div>


        <div
          id="mediaPlayer"
          hidden
          style="
            margin-top:20px;
            margin-bottom:20px;
          "
        ></div>


        <div class="info-grid">


          <div class="info">

            <small>
              Album
            </small>

            <b>

              ${escapeHtml(
                x.album ||
                "—"
              )}

            </b>

          </div>


          <div class="info">

            <small>
              Composer
            </small>

            <b>

              ${escapeHtml(
                x.composer ||
                "—"
              )}

            </b>

          </div>


          <div class="info">

            <small>
              Genre
            </small>

            <b>

              ${escapeHtml(
                x.genre ||
                "—"
              )}

            </b>

          </div>


          <div class="info">

            <small>
              Language
            </small>

            <b>

              ${escapeHtml(
                x.language ||
                "—"
              )}

            </b>

          </div>


          <div class="info">

            <small>
              Resolution
            </small>

            <b>

              ${escapeHtml(
                x.resolution ||
                "—"
              )}

            </b>

          </div>


          <div class="info">

            <small>
              Video Codec
            </small>

            <b>

              ${escapeHtml(
                x.videoCodec ||
                "—"
              )}

            </b>

          </div>


          <div class="info">

            <small>
              Quality
            </small>

            <b>

              ${escapeHtml(
                x.videoQuality ||
                "—"
              )}

            </b>

          </div>


          <div class="info">

            <small>
              Audio
            </small>

            <b>

              ${x.audioCount}
              tracks

            </b>

          </div>


          <div class="info">

            <small>
              Hi-Res Audio
            </small>

            <b>

              ${
                x.audioUrl
                  ? escapeHtml(
                      x.audioFormat ||
                      "Available"
                    )
                  : x.embeddedHiRes
                    ? escapeHtml(
                        x.embeddedHiResInfo ||
                        "Embedded Hi-Res"
                      )
                    : "Not available"
              }

            </b>

          </div>


          <div class="info">

            <small>
              Subtitles
            </small>

            <b>

              ${x.subtitleCount}

            </b>

          </div>


          <div class="info">

            <small>
              Media ID
            </small>

            <b>

              ${escapeHtml(
                x.id
              )}

            </b>

          </div>


          <div class="info">

            <small>
              File Name
            </small>

            <b>

              ${escapeHtml(
                x.fileName ||
                "—"
              )}

            </b>

          </div>


          <div class="info">

            <small>
              Cover
            </small>

            <b>

              ${
                urls.length
                  ? "Available"
                  : "Not available"
              }

            </b>

          </div>


          ${
            x.audioFileName
              ? `

                <div class="info">

                  <small>
                    Hi-Res File
                  </small>

                  <b>

                    ${escapeHtml(
                      x.audioFileName
                    )}

                  </b>

                </div>

              `
              : ""
          }


        </div>


        <div class="detail-actions">


          ${
            x.videoUrl
              ? `

                <a
                  href="#"
                  class="play-button"
                  onclick="
                    event.preventDefault();

                    playMedia(
                      '${escapeJs(x.id)}'
                    );
                  "
                >
                  ▶ Play
                </a>

              `
              : ""
          }


          ${
            x.downloadUrl
              ? `

                <a
                  class="download-button"
                  href="${escapeHtml(
                    x.downloadUrl
                  )}"
                  target="_blank"
                  rel="noopener"
                >
                  ↓ Video Download
                </a>

              `
              : ""
          }


          ${
            x.audioUrl
              ? `

                <a
                  class="audio-download-button"
                  href="${escapeHtml(
                    x.audioUrl
                  )}"
                  target="_blank"
                  rel="noopener"
                  download
                >
                  🎧 Hi-Res Audio
                </a>

              `
              : ""
          }


        </div>


      </div>

    </div>

  `;


  details.hidden =
    false;


  const library =
    document.getElementById(
      "library"
    );


  const featuredSpotlight =
    document.getElementById(
      "featuredSpotlight"
    );


  if (library) {

    library.style.display =
      "none";

  }


  if (featuredSpotlight) {

    featuredSpotlight.style.display =
      "none";

  }


  details.scrollIntoView({
    behavior:
      "smooth",

    block:
      "start"
  });

};


/* =========================================================
   FILTER BUTTONS
   ========================================================= */

document
  .querySelectorAll(".filter")
  .forEach(btn => {

    btn.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(".filter")
          .forEach(b => {

            b.classList.remove(
              "active"
            );

          });


        btn.classList.add(
          "active"
        );


        activeFilter =
          btn.dataset.filter ||
          "all";


        render();

      }
    );

  });


/* =========================================================
   NAV FILTERS
   ========================================================= */

document
  .querySelectorAll(
    ".nav a[data-filter]"
  )
  .forEach(link => {

    link.addEventListener(
      "click",
      () => {

        activeFilter =
          link.dataset.filter ||
          "all";


        render();

      }
    );

  });


/* =========================================================
   SEARCH
   ========================================================= */

if (search) {

  search.addEventListener(
    "input",
    render
  );

}


const searchBtn =
  document.getElementById(
    "searchBtn"
  );


if (searchBtn) {

  searchBtn.addEventListener(
    "click",
    () => {

      if (search) {

        search.focus();

      }

    }
  );

}


/* =========================================================
   CLOSE DETAILS & LIBRARY NAVIGATION
   ========================================================= */

const closeDetails =
  document.getElementById(
    "closeDetails"
  );


function returnToLibrary() {

  closeMediaPlayer();


  const details =
    document.getElementById(
      "details"
    );


  const library =
    document.getElementById(
      "library"
    );


  const featuredSpotlight =
    document.getElementById(
      "featuredSpotlight"
    );


  if (details) {

    details.hidden =
      true;

  }


  if (library) {

    library.style.display =
      "";

  }


  if (featuredSpotlight) {

    featuredSpotlight.style.display =
      "";

  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


if (closeDetails) {

  closeDetails.addEventListener(
    "click",
    () => {

      /*
       * Use browser history so that
       * Android/browser Back behaves naturally.
       */

      if (
        location.hash.startsWith(
          "#media/"
        )
      ) {

        history.back();

      } else {

        returnToLibrary();

      }

    }
  );

}


/* =========================================================
   SECURITY HELPERS
   ========================================================= */

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


function escapeJs(value) {

  return String(
    value ?? ""
  )
    .replace(
      /\\/g,
      "\\\\"
    )
    .replace(
      /'/g,
      "\\'"
    );

}


/* =========================================================
   BROWSER / ANDROID BACK BUTTON
   ========================================================= */

window.addEventListener(
  "popstate",
  () => {

    returnToLibrary();

  }
);


/* =========================================================
   OPEN MEDIA FROM URL
   ========================================================= */

window.addEventListener(
  "load",
  () => {

    const hash =
      location.hash;


    if (
      hash.startsWith(
        "#media/"
      )
    ) {

      const id =
        decodeURIComponent(
          hash.substring(
            "#media/".length
          )
        );


      /*
       * Wait until Google Sheet data
       * has finished loading.
       */

      const waitForMedia =
        setInterval(
          () => {

            if (
              MEDIA.length > 0
            ) {

              clearInterval(
                waitForMedia
              );


              showDetails(
                id,
                true
              );

            }

          },
          100
        );


      setTimeout(
        () => {

          clearInterval(
            waitForMedia
          );

        },
        20000
      );

    }

  }
);


/* =========================================================
   START APPLICATION
   ========================================================= */

loadAllData();
