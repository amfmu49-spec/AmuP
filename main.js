const audio1 = document.getElementById('audio-player');
const audio2 = document.getElementById('audio-player-2');
let activeAudio = audio1;
let inactiveAudio = audio2;
const titleEl = document.getElementById('song-title');
const artistEl = document.getElementById('artist-name');
const albumArtEl = document.getElementById('album-art');
const playPauseBtn = document.getElementById('btn-play-pause');
const prevBtn = document.getElementById('btn-prev');
const nextBtn = document.getElementById('btn-next');
const infoSection = document.querySelector('.info-section');
const seekBar = document.getElementById('seek-bar');
const timeCurrent = document.getElementById('time-current');
const timeDuration = document.getElementById('time-duration');
const bgSwitcher = document.getElementById('bg-switcher');
const layoutBtn = document.getElementById('layout-btn');
const bookmarkletBtn = document.getElementById('bookmarklet-btn');
const bookmarkletModal = document.getElementById('bookmarklet-modal');
const bookmarkletCode = document.getElementById('bookmarklet-code');
const bookmarkletCopyBtn = document.getElementById('bookmarklet-copy-btn');
const bookmarkletCloseBtn = document.getElementById('bookmarklet-close-btn');
const crosshairH = document.getElementById('crosshair-h');
const crosshairV = document.getElementById('crosshair-v');
const albumArtFrame = document.getElementById('album-art-frame');
const lyricsOverlay = document.getElementById('lyrics-overlay');

let playlist = [];
let currentTrackIndex = 0;
let authToken = '';
let currentLyrics = [];

async function init() {
  const params = new URLSearchParams(window.location.search);
  const sunoUrl = params.get('suno');
  const token = params.get('token');
  authToken = token;

  if (sunoUrl && token) {
    const match = sunoUrl.match(/\/playlist\/([a-zA-Z0-9-]+)/);
    if (match) {
      const playlistId = match[1];
      await loadPlaylist(playlistId, token);
    } else {
      showError("URLからプレイリストIDを取得できませんでした。");
    }
  } else {
    // デモ用データ
    playlist = [
      {
        title: "Ambient Echoes",
        display_name: "Suno AI",
        image_url: "https://cdn1.suno.ai/image_large_a3fb0e12-32a2-4752-9430-8d5fbbaf1ffc.jpeg",
        audio_url: "https://cdn1.suno.ai/a3fb0e12-32a2-4752-9430-8d5fbbaf1ffc.mp3"
      }
    ];
    updateUI();
  }
}

async function loadPlaylist(playlistId, token) {
  try {
    const res = await fetch(`/api/playlist/${playlistId}?page=1`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    if (data && data.playlist_clips) {
      playlist = data.playlist_clips.map(c => c.clip);
      updateUI();
      loadTrack();
    } else if (data && Array.isArray(data)) {
      // API might return an array directly
      playlist = data;
      updateUI();
      loadTrack();
    } else {
      throw new Error("APIレスポンスの形式が異なります");
    }
  } catch (e) {
    console.error("Failed to load playlist", e);
    showError(e.message || "プレイリストの読み込みに失敗しました");
  }
}

function updateUI() {
  if (playlist.length === 0) return;
  const track = playlist[currentTrackIndex];
  
  // Fade out
  infoSection.style.opacity = 0;
  albumArtEl.style.opacity = 0;

  setTimeout(() => {
    titleEl.textContent = track.title || "Unknown Title";
    artistEl.textContent = track.display_name || "Unknown Artist";
    if (track.image_url) {
      albumArtEl.src = track.image_url;
    }
    
    // Fade in
    infoSection.style.opacity = 1;
    albumArtEl.style.opacity = 1;
  }, 500);
}

async function loadLyrics(trackId) {
  currentLyrics = [];
  lyricsOverlay.textContent = '';
  lyricsOverlay.classList.add('hidden');
  
  if (!authToken) return;
  
  try {
    const res = await fetch(`/api/lyrics/${trackId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      const aligned = data.aligned_lyrics || (data.data && data.data.aligned_lyrics) || [];
      if (Array.isArray(aligned) && aligned.length > 0) {
        currentLyrics = aligned.filter(l => {
           if (!l.text) return false;
           const t = l.text.trim();
           if (t.length === 0) return false;
           if (t.startsWith('[') && t.endsWith(']')) return false;
           return true;
        }).map((l, i, arr) => {
           let start = typeof l.start_s === 'number' ? l.start_s : 0;
           let end = typeof l.end_s === 'number' ? l.end_s : (arr[i+1]?.start_s || start + 2);
           return { text: l.text.trim(), start, end };
        });
      }
    }
  } catch (e) {
    console.warn("Failed to load lyrics", e);
  }
}

function loadTrack() {
  if (playlist.length === 0) return;
  const track = playlist[currentTrackIndex];
  if (track.audio_url) {
    activeAudio.src = track.audio_url;
    activeAudio.volume = 1.0;
    activeAudio.play().catch(e => console.warn('Autoplay blocked:', e));
  }
  if (track.id) {
    loadLyrics(track.id);
  }
}

playPauseBtn.addEventListener('click', () => {
  if (activeAudio.paused) {
    activeAudio.play();
  } else {
    activeAudio.pause();
  }
});

function setupAudioEvents(audioEl) {
  audioEl.addEventListener('play', () => {
    if (audioEl === activeAudio) playPauseBtn.textContent = 'Ⅱ';
  });
  
  audioEl.addEventListener('pause', () => {
    if (audioEl === activeAudio) playPauseBtn.textContent = '▶';
  });

  audioEl.addEventListener('ended', () => {
    if (audioEl === activeAudio) {
      playPauseBtn.textContent = '▶';
      if (currentTrackIndex < playlist.length - 1) {
        changeTrackWithFade(currentTrackIndex + 1);
      }
    }
  });

  audioEl.addEventListener('timeupdate', () => {
    if (audioEl !== activeAudio) return;
    if (!audioEl.duration) return;
    seekBar.value = (audioEl.currentTime / audioEl.duration) * 100;
    timeCurrent.textContent = formatTime(audioEl.currentTime);

    // Lyrics sync logic
    const ct = audioEl.currentTime;
    const activeLine = currentLyrics.find(l => ct >= l.start && ct <= l.end);
    
    if (activeLine) {
      if (lyricsOverlay.textContent !== activeLine.text) {
        lyricsOverlay.textContent = activeLine.text;
        lyricsOverlay.classList.remove('hidden');
      }
    } else {
      if (!lyricsOverlay.classList.contains('hidden')) {
        lyricsOverlay.classList.add('hidden');
      }
    }
  });

  audioEl.addEventListener('loadedmetadata', () => {
    if (audioEl === activeAudio) {
      timeDuration.textContent = formatTime(audioEl.duration);
    }
  });
}

setupAudioEvents(audio1);
setupAudioEvents(audio2);

let isFading = false;
function changeTrackWithFade(newIndex) {
  if (isFading || newIndex < 0 || newIndex >= playlist.length) return;
  isFading = true;

  const fadeDuration = 1000;
  const steps = 20;
  const stepTime = fadeDuration / steps;

  const fadingOutAudio = activeAudio;
  const fadingInAudio = inactiveAudio;

  activeAudio = fadingInAudio;
  inactiveAudio = fadingOutAudio;

  currentTrackIndex = newIndex;
  updateUI();
  
  const track = playlist[currentTrackIndex];
  if (track.audio_url) {
    activeAudio.src = track.audio_url;
    activeAudio.volume = 0;
    activeAudio.play().catch(e => console.warn('Autoplay blocked:', e));
  }
  if (track.id) {
    loadLyrics(track.id);
  } else {
    currentLyrics = [];
    lyricsOverlay.textContent = '';
    lyricsOverlay.classList.add('hidden');
  }

  let outVol = fadingOutAudio.paused || fadingOutAudio.volume === 0 || !fadingOutAudio.src ? 0 : fadingOutAudio.volume;
  const outVolStep = outVol > 0 ? outVol / steps : 0;
  
  let inVol = 0;
  const targetVol = 1.0;
  const inVolStep = targetVol / steps;

  const crossfadeInterval = setInterval(() => {
    outVol -= outVolStep;
    inVol += inVolStep;

    if (outVol <= 0 || inVol >= targetVol) {
      fadingOutAudio.volume = 0;
      fadingOutAudio.pause();
      
      activeAudio.volume = targetVol;
      clearInterval(crossfadeInterval);
      isFading = false;
    } else {
      if (outVolStep > 0) fadingOutAudio.volume = outVol;
      activeAudio.volume = inVol;
    }
  }, stepTime);
}

prevBtn.addEventListener('click', () => {
  if (currentTrackIndex > 0) {
    changeTrackWithFade(currentTrackIndex - 1);
  }
});

nextBtn.addEventListener('click', () => {
  if (currentTrackIndex < playlist.length - 1) {
    changeTrackWithFade(currentTrackIndex + 1);
  }
});

// Seekbar and Time Logic
function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

seekBar.addEventListener('input', () => {
  if (!activeAudio.duration) return;
  const seekTo = activeAudio.duration * (seekBar.value / 100);
  activeAudio.currentTime = seekTo;
});

// Background Switcher Logic
const backgrounds = [
  '/assets/wood_bg_no_text.png',
  '/assets/bg_water_1_notext.png',
  '/assets/bg_concrete_1_notext.png',
  '/assets/bg_darkstone_1_notext.png',
  '/assets/bg_lightstone_notext.png',
  '/assets/bg_frosted_notext.png',
  '/assets/bg_water_2_notext.png',
  '/assets/bg_darkstone_2_notext.png'
];
let currentBgIndex = 0;

bgSwitcher.addEventListener('click', () => {
  currentBgIndex = (currentBgIndex + 1) % backgrounds.length;
  document.documentElement.style.setProperty('--wood-bg', `url('${backgrounds[currentBgIndex]}')`);
});

// Layout Toggle Logic
layoutBtn.addEventListener('click', () => {
  if (document.body.classList.contains('view-vertical')) {
    document.body.classList.remove('view-vertical');
    document.body.classList.add('view-horizontal');
  } else {
    document.body.classList.remove('view-horizontal');
    document.body.classList.add('view-vertical');
  }
});

// Touch / Drag / Pinch Logic
let isDragging = false;
let startX = 0;
let startY = 0;
let initialFrameX = 0;
let initialFrameY = 0;

let initialPinchDistance = 0;
let initialFrameSize = 400;

function getCssVar(name) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

function getDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// Touch Events
albumArtFrame.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    isDragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    initialFrameX = getCssVar('--frame-x');
    initialFrameY = getCssVar('--frame-y');
    
    crosshairH.classList.add('visible');
    crosshairV.classList.add('visible');
  } else if (e.touches.length === 2) {
    isDragging = false;
    initialPinchDistance = getDistance(e.touches);
    initialFrameSize = getCssVar('--frame-size') || 400;
    crosshairH.classList.remove('visible');
    crosshairV.classList.remove('visible');
  }
}, { passive: false });

albumArtFrame.addEventListener('touchmove', (e) => {
  e.preventDefault(); // Prevent scrolling
  
  if (isDragging && e.touches.length === 1) {
    const deltaX = e.touches[0].clientX - startX;
    const deltaY = e.touches[0].clientY - startY;
    
    let newX = initialFrameX + deltaX;
    let newY = initialFrameY + deltaY;
    
    const snapThreshold = 20;
    
    if (Math.abs(newX) < snapThreshold) {
      newX = 0;
      crosshairV.classList.add('snapped');
    } else {
      crosshairV.classList.remove('snapped');
    }
    
    if (Math.abs(newY) < snapThreshold) {
      newY = 0;
      crosshairH.classList.add('snapped');
    } else {
      crosshairH.classList.remove('snapped');
    }
    
    document.documentElement.style.setProperty('--frame-x', `${newX}px`);
    document.documentElement.style.setProperty('--frame-y', `${newY}px`);
    
  } else if (e.touches.length === 2) {
    const currentDistance = getDistance(e.touches);
    const scale = currentDistance / initialPinchDistance;
    let newSize = initialFrameSize * scale;
    
    newSize = Math.max(150, Math.min(newSize, 800));
    document.documentElement.style.setProperty('--frame-size', `${newSize}px`);
  }
}, { passive: false });

albumArtFrame.addEventListener('touchend', (e) => {
  if (e.touches.length === 0) {
    isDragging = false;
    crosshairH.classList.remove('visible');
    crosshairV.classList.remove('visible');
    crosshairH.classList.remove('snapped');
    crosshairV.classList.remove('snapped');
  }
});

// Mouse Events for PC
albumArtFrame.addEventListener('mousedown', (e) => {
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  initialFrameX = getCssVar('--frame-x');
  initialFrameY = getCssVar('--frame-y');
  
  crosshairH.classList.add('visible');
  crosshairV.classList.add('visible');
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  
  const deltaX = e.clientX - startX;
  const deltaY = e.clientY - startY;
  
  let newX = initialFrameX + deltaX;
  let newY = initialFrameY + deltaY;
  
  const snapThreshold = 20;
  
  if (Math.abs(newX) < snapThreshold) {
    newX = 0;
    crosshairV.classList.add('snapped');
  } else {
    crosshairV.classList.remove('snapped');
  }
  
  if (Math.abs(newY) < snapThreshold) {
    newY = 0;
    crosshairH.classList.add('snapped');
  } else {
    crosshairH.classList.remove('snapped');
  }
  
  document.documentElement.style.setProperty('--frame-x', `${newX}px`);
  document.documentElement.style.setProperty('--frame-y', `${newY}px`);
});

window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    crosshairH.classList.remove('visible');
    crosshairV.classList.remove('visible');
    crosshairH.classList.remove('snapped');
    crosshairV.classList.remove('snapped');
  }
});

// Mouse wheel for zoom on PC
albumArtFrame.addEventListener('wheel', (e) => {
  e.preventDefault();
  let currentSize = getCssVar('--frame-size') || 400;
  const zoomSpeed = 0.5;
  let newSize = currentSize - (e.deltaY * zoomSpeed);
  newSize = Math.max(150, Math.min(newSize, 800));
  document.documentElement.style.setProperty('--frame-size', `${newSize}px`);
}, { passive: false });

function showError(msg) {
  titleEl.textContent = "Error";
  artistEl.textContent = msg;
}

// Bookmarklet Modal Logic
const BOOKMARKLET_CODE = "javascript:(async function(){try{const match=window.location.pathname.match(/\\/playlist\\/([a-zA-Z0-9-]+)/);if(!match){alert(\"\\u3053\\u306e\\u30da\\u30fc\\u30b8\\u306f\\u30d7\\u30ec\\u30a4\\u30ea\\u30b9\\u30c8\\u30da\\u30fc\\u30b8\\u3067\\u306f\\u3042\\u308a\\u307e\\u305b\\u3093\");return;}let token='';if(window.Clerk&&window.Clerk.session){token=await window.Clerk.session.getToken();}else{const cMatch=document.cookie.match(/__session=([^;]+)/);token=cMatch?cMatch[1]:'';}const url=encodeURIComponent(window.location.href);window.open('https://amu-p.vercel.app/?suno='+url+'&token='+token,'_blank');}catch(e){alert('Error: '+e.message);}})();";

bookmarkletCode.value = BOOKMARKLET_CODE;

bookmarkletBtn.addEventListener('click', () => {
  bookmarkletModal.classList.add('visible');
});

bookmarkletCloseBtn.addEventListener('click', () => {
  bookmarkletModal.classList.remove('visible');
});

bookmarkletModal.addEventListener('click', (e) => {
  if (e.target === bookmarkletModal) bookmarkletModal.classList.remove('visible');
});

bookmarkletCopyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(BOOKMARKLET_CODE).then(() => {
    bookmarkletCopyBtn.textContent = '\u2705 \u30b3\u30d4\u30fc\u5b8c\u4e86';
    bookmarkletCopyBtn.classList.add('copied');
    setTimeout(() => {
      bookmarkletCopyBtn.textContent = '\ud83d\udccb \u30b3\u30d4\u30fc';
      bookmarkletCopyBtn.classList.remove('copied');
    }, 2000);
  });
});

init();
