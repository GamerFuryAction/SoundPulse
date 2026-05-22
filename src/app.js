// SOUNDPULSE CENTRAL ORCHESTRATOR & APPLICATION RUNTIME
import { StorageManager } from './storage.js';
import { playerEngine } from './player.js';
import { UIRenderer } from './ui.js';

const App = {
  volume: 0.8,
  preMuteVolume: 0.8,
  
  init() {
    // 1. Initialise UI
    UIRenderer.init();
    
    // 2. Setup player engine listeners
    this.setupPlayerCallbacks();
    
    // 3. Setup control bar event listeners
    this.setupPlayerControls();
    
    // 4. Setup sidebar click actions
    this.setupSidebarActions();
    
    // 5. Setup utility event listeners (Volume, Seek, Queue, Fullscreen)
    this.setupUtilityControls();
    
    // 6. Setup Modal Forms
    this.setupPlaylistModal();
    
    // 7. Load default track on bottom player (if available)
    const tracks = StorageManager.getTracks();
    if (tracks.length > 0) {
      playerEngine.playlist = tracks;
      playerEngine.currentIndex = 0;
      this.syncPlayerUI(tracks[0], false);
    }
  },
  
  // --- PLAYER CALLBACK WIRINGS ---
  
  setupPlayerCallbacks() {
    // A. Track change event
    playerEngine.onTrackChange = (track) => {
      this.syncPlayerUI(track, true);
      
      // If queue panel is open, refresh it
      this.refreshQueueView();
      
      // If viewing track details for this song, sync play buttons
      this.syncTrackDetailViewPlayState();
    };
    
    // B. Play/Pause state changes
    playerEngine.onPlayStateChange = (isPlaying) => {
      const playBtn = document.getElementById('player-play-btn');
      const playIcon = document.getElementById('player-play-icon');
      
      if (isPlaying) {
        playBtn.classList.add('playing');
        playIcon.setAttribute('data-lucide', 'pause');
      } else {
        playBtn.classList.remove('playing');
        playIcon.setAttribute('data-lucide', 'play');
      }
      if (window.lucide) window.lucide.createIcons();
      
      this.syncTrackDetailViewPlayState();
    };
    
    // C. Regular playback progress updates
    playerEngine.onTimeUpdate = (current, duration) => {
      const currentLbl = document.getElementById('player-time-current');
      const totalLbl = document.getElementById('player-time-total');
      const fill = document.getElementById('player-progress-fill');
      const handle = document.getElementById('player-progress-handle');
      
      if (currentLbl) currentLbl.textContent = this.formatTime(current);
      if (totalLbl && duration) totalLbl.textContent = this.formatTime(duration);
      
      const pct = duration ? (current / duration) * 100 : 0;
      if (fill) fill.style.width = `${pct}%`;
      if (handle) handle.style.left = `${pct}%`;
      
      // Dynamic rendering synchronization for active Track Detail View
      const active = playerEngine.getCurrentTrack();
      if (UIRenderer.activeView === 'track-detail' && UIRenderer.detailTrack && active && UIRenderer.detailTrack.id === active.id) {
        const canvas = document.getElementById('detailed-waveform-canvas');
        if (canvas && UIRenderer.hoverPercent === -1) {
          playerEngine.constructor.renderWaveform(canvas, active.peaks, current / (duration || 1));
        }
        
        // Update Add Comment strip timestamp label
        const liveStamp = document.getElementById('comment-live-timestamp');
        if (liveStamp) {
          liveStamp.textContent = `At ${this.formatTime(current)}`;
        }
      }
    };
    
    // D. Timed Comment Active trigger (SoundCloud popup notification review)
    playerEngine.onCommentActiveTrigger = (comments) => {
      comments.forEach(comment => {
        // Prevent toast duplicates
        if (document.getElementById(`toast-${comment.id}`)) return;
        this.showCommentToast(comment);
      });
    };
  },
  
  syncPlayerUI(track, updateMediaInfo = true) {
    if (!track) return;
    
    if (updateMediaInfo) {
      const cover = document.getElementById('player-track-cover');
      const coverPlaceholder = document.getElementById('player-track-cover-placeholder');
      const title = document.getElementById('player-track-title');
      const artist = document.getElementById('player-track-artist');
      const totalTime = document.getElementById('player-time-total');
      
      if (track.coverUrl) {
        cover.src = track.coverUrl;
        cover.classList.remove('hidden');
        coverPlaceholder.classList.add('hidden');
      } else {
        cover.src = "";
        cover.classList.add('hidden');
        coverPlaceholder.classList.remove('hidden');
        
        // Set dynamic gradient background for placeholder
        coverPlaceholder.style.background = `linear-gradient(135deg, ${track.gradientColors[0]}, ${track.gradientColors[1]})`;
      }
      
      title.textContent = track.title;
      artist.textContent = track.artist;
      totalTime.textContent = this.formatTime(track.duration);
      
      // Wire title click to jump to track details
      title.onclick = () => {
        UIRenderer.navigateTo('track-detail', { trackId: track.id });
      };
    }
    
    // Sync Heart/Like status
    const likeBtn = document.getElementById('player-like-btn');
    if (likeBtn) {
      likeBtn.classList.toggle('liked', track.isLiked);
    }
  },
  
  syncTrackDetailViewPlayState() {
    const detailBtn = document.getElementById('dt-play-btn');
    const detailIcon = document.getElementById('dt-play-icon');
    
    if (!detailBtn || !detailIcon) return;
    
    const active = playerEngine.getCurrentTrack();
    const isPlayingThis = active && UIRenderer.detailTrack && active.id === UIRenderer.detailTrack.id && playerEngine.isPlaying;
    
    if (isPlayingThis) {
      detailBtn.style.backgroundColor = "var(--text-main)";
      detailIcon.setAttribute('data-lucide', 'pause');
    } else {
      detailBtn.style.backgroundColor = "var(--accent)";
      detailIcon.setAttribute('data-lucide', 'play');
    }
    
    if (window.lucide) window.lucide.createIcons();
  },
  
  // --- BOTTOM CONTROL ACTIONS ---
  
  setupPlayerControls() {
    const playBtn = document.getElementById('player-play-btn');
    const prevBtn = document.getElementById('player-prev-btn');
    const nextBtn = document.getElementById('player-next-btn');
    const shuffleBtn = document.getElementById('player-shuffle-btn');
    const repeatBtn = document.getElementById('player-repeat-btn');
    const likeBtn = document.getElementById('player-like-btn');
    
    playBtn.onclick = () => playerEngine.togglePlay();
    prevBtn.onclick = () => playerEngine.prev();
    nextBtn.onclick = () => playerEngine.next();
    
    shuffleBtn.onclick = () => {
      const active = playerEngine.toggleShuffle();
      shuffleBtn.classList.toggle('active', active);
    };
    
    repeatBtn.onclick = () => {
      const state = playerEngine.toggleRepeat();
      repeatBtn.classList.remove('active');
      const icon = repeatBtn.querySelector('i');
      
      if (state === 'all') {
        repeatBtn.classList.add('active');
        icon.setAttribute('data-lucide', 'repeat');
      } else if (state === 'one') {
        repeatBtn.classList.add('active');
        icon.setAttribute('data-lucide', 'repeat-1');
      } else {
        icon.setAttribute('data-lucide', 'repeat');
      }
      if (window.lucide) window.lucide.createIcons();
    };
    
    likeBtn.onclick = () => {
      const track = playerEngine.getCurrentTrack();
      if (!track) return;
      
      const liked = StorageManager.toggleLike(track.id);
      likeBtn.classList.toggle('liked', liked);
      track.isLiked = liked;
      
      // Update Library sidebars / details if actively viewing playlist detail
      if (UIRenderer.activeView === 'playlist-detail' && UIRenderer.activePlaylistId === 'playlist-liked') {
        UIRenderer.navigateTo('playlist-detail', { playlistId: 'playlist-liked' });
      }
      if (UIRenderer.activeView === 'track-detail' && UIRenderer.detailTrack.id === track.id) {
        const dtHeart = document.getElementById('dt-like-btn');
        if (dtHeart) dtHeart.classList.toggle('liked', liked);
      }
    };
  },
  
  // --- SIDEBAR TABS ROUTING ---
  
  setupSidebarActions() {
    document.querySelectorAll('.nav-item').forEach(item => {
      const view = item.getAttribute('data-view');
      item.onclick = (e) => {
        e.preventDefault();
        UIRenderer.navigateTo(view);
      };
    });
    
    // Liked songs quicklink
    const likedSongsBtn = document.getElementById('liked-songs-shortcut');
    if (likedSongsBtn) {
      likedSongsBtn.onclick = () => {
        UIRenderer.navigateTo('playlist-detail', { playlistId: 'playlist-liked' });
      };
    }
    
    // Sidebar create playlist icon
    const addPlaylistBtn = document.getElementById('create-playlist-sidebar-btn');
    if (addPlaylistBtn) {
      addPlaylistBtn.onclick = () => {
        document.getElementById('playlist-modal').classList.remove('hidden');
      };
    }
  },
  
  // --- VOLUME & PROGRESS UTILITIES ---
  
  setupUtilityControls() {
    // 1. Audio Seek Interaction
    const progressWrapper = document.getElementById('player-progress-wrapper');
    if (progressWrapper) {
      const seekAction = (e) => {
        const rect = progressWrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        playerEngine.seek(pct);
      };
      
      let isDragging = false;
      progressWrapper.onmousedown = (e) => {
        isDragging = true;
        seekAction(e);
      };
      window.addEventListener('mousemove', (e) => {
        if (isDragging) seekAction(e);
      });
      window.addEventListener('mouseup', () => {
        isDragging = false;
      });
    }
    
    // 2. Volume Slide Interaction
    const volWrapper = document.querySelector('.volume-slider-wrapper');
    const volTrack = document.getElementById('player-volume-track');
    const volFill = document.getElementById('player-volume-fill');
    const volHandle = document.getElementById('player-volume-handle');
    const volBtn = document.getElementById('player-volume-btn');
    const volIcon = document.getElementById('player-volume-icon');
    
    const setVolumeUI = (pct) => {
      const widthPct = `${pct * 100}%`;
      volFill.style.width = widthPct;
      volHandle.style.left = widthPct;
      
      // Update icon
      if (pct === 0) volIcon.setAttribute('data-lucide', 'volume-x');
      else if (pct < 0.4) volIcon.setAttribute('data-lucide', 'volume');
      else if (pct < 0.7) volIcon.setAttribute('data-lucide', 'volume-1');
      else volIcon.setAttribute('data-lucide', 'volume-2');
      
      if (window.lucide) window.lucide.createIcons();
    };
    
    const changeVolume = (e) => {
      const rect = volTrack.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      this.volume = pct;
      playerEngine.setVolume(pct);
      setVolumeUI(pct);
    };
    
    let isVolDragging = false;
    if (volWrapper) {
      volWrapper.onmousedown = (e) => {
        isVolDragging = true;
        changeVolume(e);
      };
      window.addEventListener('mousemove', (e) => {
        if (isVolDragging) changeVolume(e);
      });
      window.addEventListener('mouseup', () => {
        isVolDragging = false;
      });
    }
    
    if (volBtn) {
      volBtn.onclick = () => {
        const muted = playerEngine.toggleMute();
        if (muted) {
          this.preMuteVolume = this.volume;
          setVolumeUI(0);
        } else {
          setVolumeUI(this.preMuteVolume);
        }
      };
    }
    
    // Initialize standard volume
    playerEngine.setVolume(this.volume);
    setVolumeUI(this.volume);
    
    // 3. Queue Sidebar Panel Toggle
    const queueBtn = document.getElementById('player-queue-btn');
    const closeContextBtn = document.getElementById('close-context-btn');
    const contextSidebar = document.getElementById('context-sidebar');
    
    const toggleQueuePanel = () => {
      const isCollapsed = contextSidebar.classList.contains('collapsed');
      const title = document.getElementById('context-sidebar-title');
      
      if (isCollapsed || (title && title.textContent !== 'Play Queue')) {
        contextSidebar.classList.remove('collapsed');
        document.getElementById('app-container').classList.add('with-context-sidebar');
        title.textContent = 'Play Queue';
        this.refreshQueueView();
      } else {
        contextSidebar.classList.add('collapsed');
        document.getElementById('app-container').classList.remove('with-context-sidebar');
      }
      if (window.lucide) window.lucide.createIcons();
    };
    
    if (queueBtn) queueBtn.onclick = toggleQueuePanel;
    if (closeContextBtn) {
      closeContextBtn.onclick = () => {
        contextSidebar.classList.add('collapsed');
        document.getElementById('app-container').classList.remove('with-context-sidebar');
      };
    }
    
    // 4. Ambient Fullscreen Visualizer overlay trigger
    const fullscreenBtn = document.getElementById('player-fullscreen-btn');
    const fsOverlay = document.getElementById('fullscreen-visualizer-overlay');
    const fsCloseBtn = document.getElementById('close-fullscreen-btn');
    const fsCanvas = document.getElementById('fullscreen-visualizer');
    
    if (fullscreenBtn && fsOverlay && fsCanvas) {
      fullscreenBtn.onclick = () => {
        const track = playerEngine.getCurrentTrack();
        if (!track) return;
        
        fsOverlay.classList.remove('hidden');
        
        // Populate info
        document.getElementById('fullscreen-track-title').textContent = track.title;
        document.getElementById('fullscreen-track-artist').textContent = track.artist;
        const fsCover = document.getElementById('fullscreen-track-cover');
        
        if (track.coverUrl) {
          fsCover.src = track.coverUrl;
          fsCover.classList.remove('hidden');
        } else {
          fsCover.src = "";
          fsCover.classList.add('hidden');
        }
        
        // Spin up canvas loop in playerEngine
        playerEngine.startFullscreenVisualizer(fsCanvas);
        if (window.lucide) window.lucide.createIcons();
      };
      
      if (fsCloseBtn) {
        fsCloseBtn.onclick = () => {
          fsOverlay.classList.add('hidden');
          playerEngine.stopFullscreenVisualizer();
        };
      }
    }
  },
  
  refreshQueueView() {
    const content = document.getElementById('context-sidebar-content');
    if (!content) return;
    
    const active = playerEngine.getCurrentTrack();
    const playlist = playerEngine.playlist;
    
    if (playlist.length === 0) {
      content.innerHTML = `<div style="text-align: center; color: var(--text-dim); margin-top: 48px;">Queue is empty</div>`;
      return;
    }
    
    const activeIdx = playerEngine.currentIndex;
    
    const currentHTML = active ? `
      <div class="queue-header-sub">Now Playing</div>
      <div class="queue-item active" style="margin-bottom: 24px;">
        <img class="queue-cover" src="${active.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop'}" alt="Art">
        <div class="queue-meta">
          <span class="queue-title">${active.title}</span>
          <span class="queue-artist">${active.artist}</span>
        </div>
        <i data-lucide="volume-2" style="width: 16px; height: 16px; color: var(--accent);"></i>
      </div>
    ` : '';
    
    const remaining = playlist.slice(activeIdx + 1);
    
    let upcomingHTML = '<div class="queue-header-sub">Next Up</div>';
    if (remaining.length === 0) {
      upcomingHTML += `<div style="color: var(--text-dim); font-size: 13px; padding-left: 8px;">No songs in queue</div>`;
    } else {
      upcomingHTML += remaining.map((t, idx) => `
        <div class="queue-item" data-queue-idx="${activeIdx + 1 + idx}">
          <img class="queue-cover" src="${t.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop'}" alt="Art">
          <div class="queue-meta">
            <span class="queue-title">${t.title}</span>
            <span class="queue-artist">${t.artist}</span>
          </div>
          <i data-lucide="grip-vertical" class="queue-drag-icon" style="width: 14px; height: 14px;"></i>
        </div>
      `).join('');
    }
    
    content.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${currentHTML}
        ${upcomingHTML}
      </div>
    `;
    
    // Wire queue item click
    content.querySelectorAll('.queue-item[data-queue-idx]').forEach(item => {
      const idx = parseInt(item.getAttribute('data-queue-idx'));
      item.onclick = () => {
        playerEngine.currentIndex = idx;
        playerEngine.loadActiveTrack();
        playerEngine.play();
      };
    });
    
    if (window.lucide) window.lucide.createIcons();
  },
  
  // --- TIMESTAMPED COMMENT GOWING TOAST NOTIFICATIONS ---
  
  showCommentToast(comment) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = `
        position: fixed;
        top: 80px;
        right: 32px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
      `;
      document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.id = `toast-${comment.id}`;
    toast.style.cssText = `
      background: rgba(18, 18, 24, 0.9);
      border: 1px solid var(--accent);
      border-left: 4px solid var(--accent);
      backdrop-filter: blur(12px);
      padding: 14px 20px;
      border-radius: var(--radius-md);
      color: white;
      width: 280px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 15px rgba(0, 230, 118, 0.15);
      display: flex;
      flex-direction: column;
      gap: 4px;
      transform: translateX(320px);
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      pointer-events: auto;
    `;
    
    toast.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-family: var(--font-display); font-weight: 700; color: var(--accent); font-size: 13px;">${comment.author}</span>
        <span style="font-size: 11px; font-weight: 700; background: rgba(0,230,118,0.15); color: var(--accent); padding: 2px 6px; border-radius: var(--radius-sm);">${this.formatTime(comment.timestamp)}</span>
      </div>
      <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px; line-height: 1.4;">"${comment.text}"</p>
    `;
    
    toastContainer.appendChild(toast);
    
    // Slide in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 50);
    
    // Slide out and remove
    setTimeout(() => {
      toast.style.transform = 'translateX(320px)';
      setTimeout(() => {
        toast.remove();
      }, 400);
    }, 4500);
  },
  
  // --- CREATE PLAYLIST MODAL MANAGEMENT ---
  
  setupPlaylistModal() {
    const modal = document.getElementById('playlist-modal');
    const closeBtn = document.getElementById('close-playlist-modal-btn');
    const cancelBtn = document.getElementById('cancel-playlist-modal-btn');
    const saveBtn = document.getElementById('save-playlist-modal-btn');
    const nameInput = document.getElementById('playlist-name-input');
    const descInput = document.getElementById('playlist-desc-input');
    
    const hideModal = () => {
      modal.classList.add('hidden');
      nameInput.value = '';
      descInput.value = '';
    };
    
    if (closeBtn) closeBtn.onclick = hideModal;
    if (cancelBtn) cancelBtn.onclick = hideModal;
    
    if (saveBtn) {
      saveBtn.onclick = () => {
        const name = nameInput.value.trim();
        if (!name) {
          alert("Playlist name is required!");
          return;
        }
        
        StorageManager.createPlaylist(name, descInput.value.trim());
        hideModal();
        
        // Refresh views
        UIRenderer.renderSidebarPlaylists();
        if (UIRenderer.activeView === 'library') {
          UIRenderer.renderLibrary(document.getElementById('main-content'));
        }
        
        if (window.lucide) window.lucide.createIcons();
      };
    }
  },
  
  // --- TIME FORMATTING ---
  formatTime(secs) {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }
};

// Start application runtime when window DOM is fully loaded
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
export default App;
