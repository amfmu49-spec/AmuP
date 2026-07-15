const audio = document.getElementById('audio-player');
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
const crosshairH = document.getElementById('crosshair-h');
const crosshairV = document.getElementById('crosshair-v');
const albumArtFrame = document.getElementById('album-art-frame');

let playlist = [];
let currentTrackIndex = 0;

async function init() {
  const params = new URLSearchParams(window.location.search);
  const sunoUrl = params.get('suno');
  const token = params.get('token');

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
    const res = await fetch(`/api/playlist/${playlistId}/?page=1`, {
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

function loadTrack() {
  if (playlist.length === 0) return;
  const track = playlist[currentTrackIndex];
  if (track.audio_url) {
    audio.src = track.audio_url;
    audio.play().catch(e => console.warn('Autoplay blocked:', e));
  }
}

playPauseBtn.addEventListener('click', () => {
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
});

audio.addEventListener('play', () => {
  playPauseBtn.textContent = 'Ⅱ';
});

audio.addEventListener('pause', () => {
  playPauseBtn.textContent = '▶';
});

audio.addEventListener('ended', () => {
  playPauseBtn.textContent = '▶';
});

prevBtn.addEventListener('click', () => {
  if (currentTrackIndex > 0) {
    currentTrackIndex--;
    updateUI();
    loadTrack();
  }
});

nextBtn.addEventListener('click', () => {
  if (currentTrackIndex < playlist.length - 1) {
    currentTrackIndex++;
    updateUI();
    loadTrack();
  }
});

// Seekbar and Time Logic
function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  // Update seekbar value only if it's not currently being dragged
  // To keep it simple, we just update it. A better way would pause updates on drag.
  seekBar.value = (audio.currentTime / audio.duration) * 100;
  timeCurrent.textContent = formatTime(audio.currentTime);
});

audio.addEventListener('loadedmetadata', () => {
  timeDuration.textContent = formatTime(audio.duration);
});

seekBar.addEventListener('input', () => {
  if (!audio.duration) return;
  const seekTo = audio.duration * (seekBar.value / 100);
  audio.currentTime = seekTo;
});

// Auto-play next track
audio.addEventListener('ended', () => {
  if (currentTrackIndex < playlist.length - 1) {
    currentTrackIndex++;
    updateUI();
    loadTrack();
  }
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

init();
