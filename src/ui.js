// SOUNDPULSE USER INTERFACE & VIEW RENDERING SYSTEM
import { StorageManager } from './storage.js';
import { playerEngine } from './player.js';

export const UIRenderer = {
  activeView: 'home',
  history: ['home'],
  historyIndex: 0,
  
  // Track currently selected in the detail view
  detailTrack: null,
  
  // Track detail waveform interaction states
  detailedWaveformListenersAdded: false,
  hoverPercent: -1,
  
  init() {
    this.renderSidebarPlaylists();
    this.navigateTo('home');
    this.setupHistoryButtons();
    this.setupProfileDropdown();
  },
  
  // --- NAVIGATION SYSTEM (SPA) WITH ROUTE GUARDS ---
  
  navigateTo(viewId, params = null) {
    const activeUser = StorageManager.getActiveUser();
    
    // Route guard: only allow logged in creators to access Upload or Profile dashboards
    if ((viewId === 'upload' || viewId === 'profile') && !activeUser) {
      this.navigateTo('auth', { redirect: viewId, message: "Authentication required to open creator studios!" });
      return;
    }
    
    // Manage history
    if (this.history[this.historyIndex] !== viewId || params) {
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(viewId);
      this.historyIndex = this.history.length - 1;
    }
    
    this.activeView = viewId;
    this.updateSidebarActiveState(viewId);
    this.updateHistoryButtonStates();
    
    // Close context sidebar on view shifts unless it's the track queue
    if (viewId !== 'queue') {
      const contextBar = document.getElementById('context-sidebar');
      if (contextBar && !contextBar.classList.contains('collapsed')) {
        const title = document.getElementById('context-sidebar-title');
        if (title && title.textContent === 'Play Queue') {
          // Keep queue open
        } else {
          contextBar.classList.add('collapsed');
          document.getElementById('app-container').classList.remove('with-context-sidebar');
        }
      }
    }
    
    const container = document.getElementById('main-content');
    container.scrollTop = 0;
    
    // Dynamic top bar profile sync
    this.renderTopBarAuth();
    
    switch (viewId) {
      case 'home':
        this.renderHome(container);
        break;
      case 'search':
        this.renderSearch(container);
        break;
      case 'library':
        this.renderLibrary(container);
        break;
      case 'upload':
        this.renderUpload(container);
        break;
      case 'profile':
        this.renderProfile(container);
        break;
      case 'auth':
        this.renderAuth(container, params);
        break;
      case 'track-detail':
        if (params && params.trackId) {
          this.renderTrackDetail(container, params.trackId);
        }
        break;
      case 'playlist-detail':
        if (params && params.playlistId) {
          this.renderPlaylistDetail(container, params.playlistId);
        }
        break;
      default:
        this.renderHome(container);
    }
    
    // Trigger Lucide SVG replacements
    if (window.lucide) {
      window.lucide.createIcons();
    }
  },
  
  setupHistoryButtons() {
    const backBtn = document.getElementById('nav-back-btn');
    const forwardBtn = document.getElementById('nav-forward-btn');
    
    if (backBtn) {
      backBtn.onclick = () => {
        if (this.historyIndex > 0) {
          this.historyIndex--;
          const prevView = this.history[this.historyIndex];
          this.navigateTo(prevView);
        }
      };
    }
    
    if (forwardBtn) {
      forwardBtn.onclick = () => {
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          const nextView = this.history[this.historyIndex];
          this.navigateTo(nextView);
        }
      };
    }
  },
  
  updateHistoryButtonStates() {
    const backBtn = document.getElementById('nav-back-btn');
    const forwardBtn = document.getElementById('nav-forward-btn');
    
    if (backBtn) {
      backBtn.disabled = this.historyIndex === 0;
      backBtn.style.opacity = this.historyIndex === 0 ? '0.4' : '1';
    }
    if (forwardBtn) {
      forwardBtn.disabled = this.historyIndex === this.history.length - 1;
      forwardBtn.style.opacity = this.historyIndex === this.history.length - 1 ? '0.4' : '1';
    }
  },
  
  updateSidebarActiveState(viewId) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
      }
    });
    
    const likedItem = document.getElementById('liked-songs-shortcut');
    if (likedItem) {
      if (viewId === 'playlist-detail' && this.activePlaylistId === 'playlist-liked') {
        likedItem.classList.add('active');
      } else {
        likedItem.classList.remove('active');
      }
    }
  },

  // --- TOP BAR AUTH RENDERER ---
  
  renderTopBarAuth() {
    const pill = document.getElementById('user-profile-pill');
    if (!pill) return;
    
    const active = StorageManager.getActiveUser();
    const topBar = document.getElementById('top-bar');
    
    // Remove old guest pills if they exist
    const oldGuest = document.getElementById('top-bar-guest-pills');
    if (oldGuest) oldGuest.remove();
    
    if (active) {
      pill.classList.remove('hidden');
      document.getElementById('user-avatar-initial').textContent = active.avatarInitial;
      document.getElementById('top-username').textContent = active.username;
    } else {
      pill.classList.add('hidden');
      
      // Render guest login/signup buttons
      const guestDiv = document.createElement('div');
      guestDiv.id = 'top-bar-guest-pills';
      guestDiv.style.cssText = `display: flex; gap: 12px; align-items: center;`;
      guestDiv.innerHTML = `
        <button class="btn-flat" id="top-login-btn" style="padding: 8px 18px; font-size: 13px; font-weight:600; border-radius:var(--radius-full);">Log In</button>
        <button class="btn-primary" id="top-signup-btn" style="padding: 8px 18px; font-size: 13px; font-weight:700; box-shadow: none;">Sign Up</button>
      `;
      topBar.appendChild(guestDiv);
      
      document.getElementById('top-login-btn').onclick = () => this.navigateTo('auth', { mode: 'login' });
      document.getElementById('top-signup-btn').onclick = () => this.navigateTo('auth', { mode: 'register' });
    }
  },

  setupProfileDropdown() {
    const pill = document.getElementById('user-profile-pill');
    if (!pill) return;
    
    // Setup glass dropdown container
    let dropdown = document.getElementById('profile-dropdown-menu');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'profile-dropdown-menu';
      dropdown.className = 'hidden';
      dropdown.style.cssText = `
        position: absolute;
        top: 60px;
        right: 32px;
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 6px;
        width: 180px;
        z-index: 1000;
        box-shadow: var(--shadow-lg);
        display: flex;
        flex-direction: column;
        gap: 2px;
      `;
      dropdown.innerHTML = `
        <button class="dd-item" id="dd-view-profile" style="background:transparent; border:none; text-align:left; color:white; padding:10px 14px; cursor:pointer; font-weight:500; font-size:13px; border-radius:var(--radius-sm); width:100%; display:flex; align-items:center; gap:10px;">
          <i data-lucide="user" style="width:16px; height:16px;"></i> View Profile
        </button>
        <button class="dd-item" id="dd-upload-track" style="background:transparent; border:none; text-align:left; color:white; padding:10px 14px; cursor:pointer; font-weight:500; font-size:13px; border-radius:var(--radius-sm); width:100%; display:flex; align-items:center; gap:10px;">
          <i data-lucide="upload-cloud" style="width:16px; height:16px;"></i> Upload Studio
        </button>
        <div style="height:1px; background:var(--border-color); margin:4px 0;"></div>
        <button class="dd-item" id="dd-logout" style="background:transparent; border:none; text-align:left; color:#ff2a6d; padding:10px 14px; cursor:pointer; font-weight:600; font-size:13px; border-radius:var(--radius-sm); width:100%; display:flex; align-items:center; gap:10px;">
          <i data-lucide="log-out" style="width:16px; height:16px;"></i> Sign Out
        </button>
      `;
      document.getElementById('main-panel').appendChild(dropdown);
      
      // Dynamic item hovers
      dropdown.querySelectorAll('.dd-item').forEach(item => {
        item.onmouseenter = () => item.style.backgroundColor = 'var(--bg-surface-hover)';
        item.onmouseleave = () => item.style.backgroundColor = 'transparent';
      });
      
      // Wire dropdown buttons
      document.getElementById('dd-view-profile').onclick = () => {
        dropdown.classList.add('hidden');
        this.navigateTo('profile');
      };
      document.getElementById('dd-upload-track').onclick = () => {
        dropdown.classList.add('hidden');
        this.navigateTo('upload');
      };
      document.getElementById('dd-logout').onclick = () => {
        dropdown.classList.add('hidden');
        StorageManager.logoutUser();
        this.navigateTo('home');
      };
    }
    
    // Toggle dropdown
    pill.onclick = (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    };
    
    // Click outside to dismiss dropdown
    window.addEventListener('click', () => {
      dropdown.classList.add('hidden');
    });
  },

  // --- HOME VIEW ---
  
  renderHome(container) {
    const tracks = StorageManager.getTracks();
    const preseeded = tracks.filter(t => !t.isCustomUpload);
    const uploads = tracks.filter(t => t.isCustomUpload);
    
    let recentUploadsHTML = '';
    if (uploads.length > 0) {
      recentUploadsHTML = `
        <div class="view-section">
          <div class="section-title-bar">
            <h2>Your Creator Uploads</h2>
          </div>
          <div class="track-grid">
            ${uploads.slice(0, 6).map(track => this.generateTrackCardHTML(track)).join('')}
          </div>
        </div>
      `;
    }
    
    container.innerHTML = `
      <div class="view-container">
        <!-- Hero Banner -->
        <div class="hero-banner">
          <div class="hero-text">
            <div class="profile-badge pulse-animation">Creator Studio Mode</div>
            <h1 style="margin-top: 10px;">Welcome to SoundPulse</h1>
            <p>Experience Spotify's premium acoustics fused with SoundCloud's community energy. Upload files, interact with canvas waveforms, and pin timestamped reviews.</p>
            <button class="btn-primary" id="hero-upload-btn" style="margin-top: 20px;">
              <i data-lucide="upload-cloud"></i>
              <span>Upload Your Music</span>
            </button>
          </div>
          <div class="hero-visualizer">
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
        
        <!-- Featured Tracks Grid -->
        <div class="view-section">
          <div class="section-title-bar">
            <h2>Featured Sounds</h2>
          </div>
          <div class="track-grid">
            ${preseeded.map(track => this.generateTrackCardHTML(track)).join('')}
          </div>
        </div>
        
        <!-- Custom Uploads Section -->
        ${recentUploadsHTML}
      </div>
    `;
    
    const heroBtn = document.getElementById('hero-upload-btn');
    if (heroBtn) heroBtn.onclick = () => this.navigateTo('upload');
    
    this.wireTrackCardClicks(tracks);
  },
  
  generateTrackCardHTML(track) {
    const coverHTML = track.coverUrl 
      ? `<img src="${track.coverUrl}" class="card-cover-img" alt="${track.title}">` 
      : `<div class="card-cover-placeholder" style="background: linear-gradient(135deg, ${track.gradientColors[0]}, ${track.gradientColors[1]})"><i data-lucide="music"></i></div>`;
      
    return `
      <div class="track-card" data-track-id="${track.id}">
        <div class="card-cover-wrapper">
          ${coverHTML}
          <button class="play-hover-btn" data-track-id="${track.id}" title="Play Track">
            <i data-lucide="play"></i>
          </button>
        </div>
        <div class="card-title" title="${track.title}">${track.title}</div>
        <div class="card-artist" title="${track.artist}">${track.artist}</div>
      </div>
    `;
  },
  
  wireTrackCardClicks(tracks) {
    document.querySelectorAll('.track-card').forEach(card => {
      const trackId = card.getAttribute('data-track-id');
      
      card.onclick = (e) => {
        if (e.target.closest('.play-hover-btn')) return;
        this.navigateTo('track-detail', { trackId });
      };
      
      const playBtn = card.querySelector('.play-hover-btn');
      if (playBtn) {
        playBtn.onclick = (e) => {
          e.stopPropagation();
          const targetIndex = tracks.findIndex(t => t.id === trackId);
          if (targetIndex !== -1) {
            playerEngine.setPlaylist(tracks, targetIndex);
            playerEngine.play();
          }
        };
      }
    });
  },

  // --- SEARCH VIEW ---
  
  renderSearch(container) {
    const tracks = StorageManager.getTracks();
    
    container.innerHTML = `
      <div class="view-container">
        <div class="search-container">
          <h2>Search Music</h2>
          <div class="search-input-wrapper">
            <i data-lucide="search"></i>
            <input type="text" id="search-box" class="search-field" placeholder="Search by songs, artists, or genres..." autocomplete="off">
          </div>
          
          <div class="genres-shortcut-strip" id="genres-strip" style="display: flex; gap: 10px; flex-wrap: wrap;">
            <span class="genre-pill" style="background-color: var(--bg-surface); padding: 8px 16px; border-radius: var(--radius-full); cursor: pointer; border: 1px solid var(--border-color); font-weight: 500; font-size: 13px;">Synthwave</span>
            <span class="genre-pill" style="background-color: var(--bg-surface); padding: 8px 16px; border-radius: var(--radius-full); cursor: pointer; border: 1px solid var(--border-color); font-weight: 500; font-size: 13px;">Ambient</span>
            <span class="genre-pill" style="background-color: var(--bg-surface); padding: 8px 16px; border-radius: var(--radius-full); cursor: pointer; border: 1px solid var(--border-color); font-weight: 500; font-size: 13px;">Lofi</span>
            <span class="genre-pill" style="background-color: var(--bg-surface); padding: 8px 16px; border-radius: var(--radius-full); cursor: pointer; border: 1px solid var(--border-color); font-weight: 500; font-size: 13px;">Acoustic</span>
          </div>
        </div>
        
        <div class="view-section" id="search-results-section">
          <h2>Browse All</h2>
          <div class="track-grid" id="search-results-grid">
            ${tracks.map(track => this.generateTrackCardHTML(track)).join('')}
          </div>
        </div>
      </div>
    `;
    
    const searchBox = document.getElementById('search-box');
    const resultsGrid = document.getElementById('search-results-grid');
    const resultsTitle = document.querySelector('#search-results-section h2');
    
    const performFilter = (query) => {
      const q = query.toLowerCase().trim();
      let filtered = tracks;
      
      if (q) {
        filtered = tracks.filter(t => 
          t.title.toLowerCase().includes(q) || 
          t.artist.toLowerCase().includes(q) || 
          (t.genre && t.genre.toLowerCase().includes(q))
        );
        resultsTitle.textContent = `Search Results for "${query}" (${filtered.length})`;
      } else {
        resultsTitle.textContent = "Browse All";
      }
      
      if (filtered.length > 0) {
        resultsGrid.innerHTML = filtered.map(track => this.generateTrackCardHTML(track)).join('');
        this.wireTrackCardClicks(filtered);
      } else {
        resultsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-muted);">
            <i data-lucide="frown" style="width: 48px; height: 48px; margin-bottom: 12px; color: var(--text-dim);"></i>
            <h3>No results found</h3>
            <p style="margin-top: 4px;">Double check spelling or try a different genre pill</p>
          </div>
        `;
      }
      if (window.lucide) window.lucide.createIcons();
    };
    
    if (searchBox) {
      searchBox.oninput = (e) => performFilter(e.target.value);
    }
    
    document.querySelectorAll('.genre-pill').forEach(pill => {
      pill.onclick = () => {
        const genre = pill.textContent;
        searchBox.value = genre;
        performFilter(genre);
      };
    });
    
    this.wireTrackCardClicks(tracks);
  },

  // --- LIBRARY VIEW ---
  
  renderLibrary(container) {
    const playlists = StorageManager.getPlaylists();
    
    container.innerHTML = `
      <div class="view-container">
        <div class="view-section">
          <div class="section-title-bar">
            <h2>Your Collections</h2>
            <button class="btn-primary" id="lib-create-playlist-btn">
              <i data-lucide="plus"></i>
              <span>Create Playlist</span>
            </button>
          </div>
          
          <div class="track-grid" id="playlists-grid">
            ${playlists.map(pl => `
              <div class="track-card playlist-card" data-playlist-id="${pl.id}">
                <div class="card-cover-wrapper">
                  <div class="card-cover-placeholder" style="background: linear-gradient(135deg, ${pl.id === 'playlist-liked' ? '#3b0066, #ff2a6d' : '#0c0c0f, #222'});">
                    <i data-lucide="${pl.id === 'playlist-liked' ? 'heart' : 'list-music'}" style="${pl.id === 'playlist-liked' ? 'fill: white; color: white;' : ''}"></i>
                  </div>
                  <button class="play-hover-btn play-playlist-btn" data-playlist-id="${pl.id}" title="Play Playlist">
                    <i data-lucide="play"></i>
                  </button>
                </div>
                <div class="card-title">${pl.name}</div>
                <div class="card-artist" style="color: var(--text-dim);">${pl.trackIds.length} tracks</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    const createBtn = document.getElementById('lib-create-playlist-btn');
    if (createBtn) {
      createBtn.onclick = () => {
        const active = StorageManager.getActiveUser();
        if (!active) {
          this.navigateTo('auth', { redirect: 'library', message: 'You must log in to create playlists!' });
        } else {
          document.getElementById('playlist-modal').classList.remove('hidden');
        }
      };
    }
    
    document.querySelectorAll('.playlist-card').forEach(card => {
      const plId = card.getAttribute('data-playlist-id');
      
      card.onclick = (e) => {
        if (e.target.closest('.play-playlist-btn')) return;
        this.navigateTo('playlist-detail', { playlistId: plId });
      };
      
      const playBtn = card.querySelector('.play-playlist-btn');
      if (playBtn) {
        playBtn.onclick = (e) => {
          e.stopPropagation();
          const pl = playlists.find(p => p.id === plId);
          if (pl && pl.trackIds.length > 0) {
            const tracks = StorageManager.getTracks();
            const plTracks = pl.trackIds.map(id => tracks.find(t => t.id === id)).filter(Boolean);
            if (plTracks.length > 0) {
              playerEngine.setPlaylist(plTracks, 0);
              playerEngine.play();
            }
          } else {
            alert("This playlist has no songs yet!");
          }
        };
      }
    });
  },
  
  renderSidebarPlaylists() {
    const list = document.getElementById('sidebar-playlists-list');
    if (!list) return;
    
    const playlists = StorageManager.getPlaylists().filter(p => !p.isSystemPlaylist);
    
    list.innerHTML = playlists.map(pl => `
      <div class="sidebar-playlist-item" data-playlist-id="${pl.id}">
        ${pl.name}
      </div>
    `).join('');
    
    document.querySelectorAll('.sidebar-playlist-item').forEach(item => {
      const plId = item.getAttribute('data-playlist-id');
      item.onclick = () => {
        this.navigateTo('playlist-detail', { playlistId: plId });
      };
    });
  },
  
  // --- PLAYLIST DETAIL VIEW ---
  
  renderPlaylistDetail(container, playlistId) {
    this.activePlaylistId = playlistId;
    this.updateSidebarActiveState('playlist-detail');
    
    const pl = StorageManager.getPlaylists().find(p => p.id === playlistId);
    if (!pl) {
      container.innerHTML = `<div style="padding:48px; text-align:center;"><h3>Playlist not found or requires log in.</h3></div>`;
      return;
    }
    
    const tracks = StorageManager.getTracks();
    const plTracks = pl.trackIds.map(id => tracks.find(t => t.id === id)).filter(Boolean);
    
    let tracksHTML = '';
    if (plTracks.length === 0) {
      tracksHTML = `
        <div style="text-align: center; padding: 64px 32px; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: var(--radius-lg);">
          <i data-lucide="music-4" style="width: 48px; height: 48px; margin-bottom: 12px; color: var(--text-dim);"></i>
          <h3>This playlist is empty</h3>
          <p style="margin-top: 4px; margin-bottom: 20px;">Search songs to add to this playlist</p>
          <button class="btn-flat" id="pl-search-shortcut-btn">Find Tracks</button>
        </div>
      `;
    } else {
      tracksHTML = `
        <div class="track-list">
          <div class="track-list-item-header" style="display: grid; grid-template-columns: 40px 60px 4fr 3fr 1fr 80px; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--border-color); color: var(--text-dim); font-size: 12px; font-weight: 700; text-transform: uppercase;">
            <span>#</span>
            <span></span>
            <span>Title</span>
            <span>Genre</span>
            <span></span>
            <span style="text-align: right;"><i data-lucide="clock" style="width: 14px; height: 14px;"></i></span>
          </div>
          ${plTracks.map((track, index) => {
            const isPlayingThis = playerEngine.getCurrentTrack() && playerEngine.getCurrentTrack().id === track.id;
            const coverHTML = track.coverUrl 
              ? `<img src="${track.coverUrl}" class="list-cover" alt="Art">` 
              : `<div class="list-cover-placeholder" style="background: linear-gradient(135deg, ${track.gradientColors[0]}, ${track.gradientColors[1]});"><i data-lucide="music" style="width: 16px; height: 16px;"></i></div>`;
              
            return `
              <div class="track-list-item ${isPlayingThis ? 'active' : ''}" data-track-id="${track.id}">
                <span class="list-index">${index + 1}</span>
                <button class="list-play-btn" data-track-id="${track.id}"><i data-lucide="play"></i></button>
                ${coverHTML}
                <div class="list-title-box">
                  <span class="list-title">${track.title}</span>
                  <span class="list-artist">${track.artist}</span>
                </div>
                <span class="list-album">${track.genre || 'Electronic'}</span>
                <button class="list-heart-btn ${track.isLiked ? 'liked' : ''}" data-track-id="${track.id}"><i data-lucide="heart" style="width: 16px; height: 16px;"></i></button>
                <span class="list-duration">${this.formatTime(track.duration)}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
    
    container.innerHTML = `
      <div class="view-container">
        <div class="profile-header" style="background: linear-gradient(180deg, ${playlistId === 'playlist-liked' ? 'rgba(255, 42, 109, 0.12)' : 'rgba(255,255,255,0.02)'} 0%, rgba(8, 8, 12, 0) 100%);">
          <div class="profile-avatar-large" style="border-radius: var(--radius-md); background: linear-gradient(135deg, ${playlistId === 'playlist-liked' ? '#3b0066, #ff2a6d' : '#141e30, #243b55'});">
            <i data-lucide="${playlistId === 'playlist-liked' ? 'heart' : 'list-music'}" style="width: 64px; height: 64px; ${playlistId === 'playlist-liked' ? 'fill: white; color: white;' : 'color: white;'}"></i>
          </div>
          
          <div class="profile-meta-info" style="gap: 12px; flex-grow: 1;">
            <div class="profile-badge">Playlist</div>
            <h1 class="profile-name" style="font-size: 48px;">${pl.name}</h1>
            <p style="color: var(--text-muted); font-size: 15px;">${pl.description || 'No description added yet.'}</p>
            <div style="display: flex; gap: 16px; align-items: center; color: var(--text-muted); font-size: 13px; margin-top: 8px;">
              <span style="font-weight: 600; color: white;">Creator Library</span>
              <span>•</span>
              <span>${plTracks.length} tracks</span>
            </div>
          </div>
          
          ${plTracks.length > 0 ? `
            <button class="btn-primary" id="play-playlist-detail-btn" style="padding: 16px 32px;">
              <i data-lucide="play" style="fill: black;"></i>
              <span>Play</span>
            </button>
          ` : ''}
        </div>
        
        <div class="view-section">
          ${tracksHTML}
        </div>
      </div>
    `;
    
    const findTracksBtn = document.getElementById('pl-search-shortcut-btn');
    if (findTracksBtn) findTracksBtn.onclick = () => this.navigateTo('search');
    
    const playPlBtn = document.getElementById('play-playlist-detail-btn');
    if (playPlBtn) {
      playPlBtn.onclick = () => {
        if (plTracks.length > 0) {
          playerEngine.setPlaylist(plTracks, 0);
          playerEngine.play();
        }
      };
    }
    
    document.querySelectorAll('.track-list-item').forEach(item => {
      const trackId = item.getAttribute('data-track-id');
      
      item.onclick = (e) => {
        if (e.target.closest('.list-play-btn') || e.target.closest('.list-heart-btn')) return;
        this.navigateTo('track-detail', { trackId });
      };
      
      const listPlayBtn = item.querySelector('.list-play-btn');
      if (listPlayBtn) {
        listPlayBtn.onclick = (e) => {
          e.stopPropagation();
          const idx = plTracks.findIndex(t => t.id === trackId);
          if (idx !== -1) {
            playerEngine.setPlaylist(plTracks, idx);
            playerEngine.play();
          }
        };
      }
      
      const heartBtn = item.querySelector('.list-heart-btn');
      if (heartBtn) {
        heartBtn.onclick = (e) => {
          e.stopPropagation();
          
          const active = StorageManager.getActiveUser();
          if (!active) {
            this.navigateTo('auth', { redirect: 'playlist-detail', redirectParams: { playlistId }, message: 'You must log in to like tracks!' });
            return;
          }
          
          const isLiked = StorageManager.toggleLike(trackId);
          heartBtn.classList.toggle('liked', isLiked);
          
          if (playlistId === 'playlist-liked') {
            this.renderPlaylistDetail(container, playlistId);
            if (window.lucide) window.lucide.createIcons();
          }
        };
      }
    });
  },

  // --- UPLOAD VIEW ---
  
  renderUpload(container) {
    const activeUser = StorageManager.getActiveUser();
    
    container.innerHTML = `
      <div class="view-container">
        <h2>Creator Track Uploader</h2>
        <div class="upload-grid">
          
          <div class="upload-box-left" style="display: flex; flex-direction: column; gap: 20px;">
            <div class="upload-dropzone" id="file-dropzone">
              <div class="dropzone-icon">
                <i data-lucide="upload-cloud"></i>
              </div>
              <h3>Drag and drop your audio here</h3>
              <p style="color: var(--text-dim);">Supports MP3, WAV or OGG (Max 25MB)</p>
              <button class="btn-flat" id="file-select-btn" style="margin-top: 10px;">Select File</button>
              <input type="file" id="audio-file-input" accept="audio/*" class="hidden">
            </div>
            
            <div id="upload-analyzer-status" class="hidden" style="background-color: var(--bg-surface); border: 1px solid var(--border-color); padding: 20px; border-radius: var(--radius-lg); display: flex; align-items: center; gap: 16px;">
              <div class="spinner-glow" style="width: 24px; height: 24px; border: 3px solid rgba(0, 230, 118, 0.2); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <div style="flex-grow: 1;">
                <h4 id="analyzer-text" style="font-family: var(--font-display); font-weight: 600;">Analyzing Audio Data...</h4>
                <p id="analyzer-subtext" style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Extracting amplitude peaks for interactive waveform...</p>
              </div>
              <span id="analyzer-timer" style="font-family: var(--font-display); color: var(--accent); font-weight: 700;">0%</span>
            </div>
          </div>
          
          <div class="upload-form-panel">
            <h3>Track Metadata</h3>
            
            <div class="input-group">
              <label>Track Title</label>
              <input type="text" id="upload-title" placeholder="e.g. Midnight Chill Beats" disabled autocomplete="off">
            </div>
            
            <div class="input-group">
              <label>Artist Name</label>
              <input type="text" id="upload-artist" value="${activeUser ? activeUser.username : 'Creator'}" disabled autocomplete="off">
            </div>
            
            <div class="input-row">
              <div class="input-group">
                <label>Genre</label>
                <select id="upload-genre" disabled>
                  <option value="Lofi Hip Hop">Lofi Hip Hop</option>
                  <option value="Synthwave">Synthwave</option>
                  <option value="Electronic">Electronic</option>
                  <option value="Ambient">Ambient</option>
                  <option value="Chillout">Chillout</option>
                  <option value="Indie Classical">Indie Classical</option>
                </select>
              </div>
              <div class="input-group">
                <label>Dynamic Accent Gradient</label>
                <select id="upload-gradient" disabled>
                  <option value="Sunset">Sunset (Orange/Pink)</option>
                  <option value="Ocean">Ocean (Blue/Teal)</option>
                  <option value="Greenery">Greenery (Mint/Green)</option>
                  <option value="Instagram-ish">Vibrant Sunset (Purple/Gold)</option>
                  <option value="Deep Purple">Deep Space (Dark Purple)</option>
                </select>
              </div>
            </div>
            
            <div class="input-group">
              <label>Cover Art Photo</label>
              <div class="cover-upload-box">
                <div class="cover-upload-preview" id="cover-preview">
                  <i data-lucide="image"></i>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px; flex-grow: 1;">
                  <button class="btn-flat" id="cover-select-btn" style="padding: 8px 16px; font-size: 12px; width: fit-content;" disabled>Select Cover Art File</button>
                  <input type="file" id="cover-file-input" accept="image/*" class="hidden">
                  <span style="color: var(--text-dim); font-size: 11px;">Or paste an Unsplash Image URL below:</span>
                  <input type="text" id="upload-cover-url" placeholder="https://images.unsplash.com/photo-..." disabled style="padding: 6px 10px; font-size: 12px;">
                </div>
              </div>
            </div>
            
            <div class="input-group">
              <label>Description</label>
              <textarea id="upload-desc" placeholder="Tell your audience about the vibes, instruments used, or story behind this track..." rows="3" disabled></textarea>
            </div>
            
            <div class="upload-actions">
              <button class="btn-flat" id="upload-cancel-btn">Reset</button>
              <button class="btn-primary" id="upload-submit-btn" disabled>
                <i data-lucide="upload"></i>
                <span>Publish Track</span>
              </button>
            </div>
            
          </div>
        </div>
      </div>
    `;
    
    if (!document.getElementById('spin-keyframes-style')) {
      const style = document.createElement('style');
      style.id = 'spin-keyframes-style';
      style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }
    
    const dropzone = document.getElementById('file-dropzone');
    const selectBtn = document.getElementById('file-select-btn');
    const fileInput = document.getElementById('audio-file-input');
    
    const titleInput = document.getElementById('upload-title');
    const artistInput = document.getElementById('upload-artist');
    const genreSelect = document.getElementById('upload-genre');
    const gradientSelect = document.getElementById('upload-gradient');
    const coverSelectBtn = document.getElementById('cover-select-btn');
    const coverFileInput = document.getElementById('cover-file-input');
    const coverUrlInput = document.getElementById('upload-cover-url');
    const descInput = document.getElementById('upload-desc');
    
    const submitBtn = document.getElementById('upload-submit-btn');
    const resetBtn = document.getElementById('upload-cancel-btn');
    
    const statusBox = document.getElementById('upload-analyzer-status');
    const analyzerText = document.getElementById('analyzer-text');
    const analyzerTimer = document.getElementById('analyzer-timer');
    
    let uploadedAudioData = null;
    let uploadedCoverBase64 = "";
    
    const handleSelectedAudio = async (file) => {
      if (!file) return;
      
      let title = file.name.replace(/\.[^/.]+$/, "");
      titleInput.value = title;
      
      statusBox.classList.remove('hidden');
      analyzerText.textContent = "Analyzing Audio Data...";
      analyzerTimer.textContent = "0%";
      
      [titleInput, artistInput, genreSelect, gradientSelect, coverSelectBtn, coverUrlInput, descInput].forEach(f => {
        if (f) f.removeAttribute('disabled');
      });
      
      let percent = 0;
      const interval = setInterval(() => {
        percent += Math.floor(Math.random() * 15) + 5;
        if (percent > 90) percent = 90;
        analyzerTimer.textContent = `${percent}%`;
      }, 150);
      
      try {
        const decoded = await playerEngine.constructor.decodeAudioFile(file);
        clearInterval(interval);
        analyzerTimer.textContent = "100%";
        analyzerText.textContent = "Audio Analysis Complete!";
        statusBox.style.borderColor = "var(--accent)";
        
        uploadedAudioData = {
          url: URL.createObjectURL(file),
          duration: decoded.duration,
          peaks: decoded.peaks
        };
        
        submitBtn.removeAttribute('disabled');
        
      } catch (err) {
        clearInterval(interval);
        statusBox.style.borderColor = "red";
        analyzerText.textContent = "Analysis Failed";
        document.getElementById('analyzer-subtext').textContent = err.message;
        analyzerTimer.textContent = "Err";
      }
    };
    
    if (selectBtn && fileInput) {
      selectBtn.onclick = () => fileInput.click();
      fileInput.onchange = (e) => handleSelectedAudio(e.target.files[0]);
    }
    
    if (dropzone) {
      dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      };
      dropzone.ondragleave = () => dropzone.classList.remove('dragover');
      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          handleSelectedAudio(e.dataTransfer.files[0]);
        }
      };
    }
    
    if (coverSelectBtn && coverFileInput) {
      coverSelectBtn.onclick = () => coverFileInput.click();
      coverFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            uploadedCoverBase64 = ev.target.result;
            const preview = document.getElementById('cover-preview');
            preview.innerHTML = `<img src="${uploadedCoverBase64}" alt="Cover preview">`;
            coverUrlInput.value = "";
          };
          reader.readAsDataURL(file);
        }
      };
    }
    
    if (coverUrlInput) {
      coverUrlInput.oninput = (e) => {
        const val = e.target.value.trim();
        const preview = document.getElementById('cover-preview');
        if (val) {
          preview.innerHTML = `<img src="${val}" alt="Cover preview" onerror="this.src=''; this.parentElement.innerHTML='<i data-lucide=&quot;frown&quot;></i>';">`;
          uploadedCoverBase64 = "";
          if (window.lucide) window.lucide.createIcons();
        } else {
          preview.innerHTML = `<i data-lucide="image"></i>`;
          if (window.lucide) window.lucide.createIcons();
        }
      };
    }
    
    if (submitBtn) {
      submitBtn.onclick = () => {
        if (!uploadedAudioData) return;
        
        let cover = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop";
        
        if (uploadedCoverBase64) {
          cover = uploadedCoverBase64;
        } else if (coverUrlInput.value.trim()) {
          cover = coverUrlInput.value.trim();
        }
        
        let gradient = ["#ff9966", "#ff5e62"];
        const gradVal = gradientSelect.value;
        if (gradVal === "Ocean") gradient = ["#00c6ff", "#0072ff"];
        else if (gradVal === "Greenery") gradient = ["#11998e", "#38ef7d"];
        else if (gradVal === "Instagram-ish") gradient = ["#833ab4", "#fcb045"];
        else if (gradVal === "Deep Purple") gradient = ["#1f1c2c", "#928dab"];
        
        const metadata = {
          title: titleInput.value.trim() || "Untitled Track",
          genre: genreSelect.value,
          gradientColors: gradient,
          coverUrl: cover,
          description: descInput.value.trim(),
          url: uploadedAudioData.url,
          duration: uploadedAudioData.duration,
          peaks: uploadedAudioData.peaks
        };
        
        StorageManager.saveUpload(metadata);
        
        alert("Track published successfully!");
        this.navigateTo('profile');
      };
    }
    
    if (resetBtn) {
      resetBtn.onclick = () => {
        this.navigateTo('upload');
      };
    }
  },

  // --- REGULAR PROFILE SCREEN ---
  
  renderProfile(container) {
    const active = StorageManager.getActiveUser();
    if (!active) return;
    
    const tracks = StorageManager.getTracks();
    const uploads = tracks.filter(t => t.isCustomUpload);
    const likes = tracks.filter(t => t.isLiked);
    
    // Collect comments made by this active user
    const allCustomComments = [];
    tracks.forEach(t => {
      t.comments.forEach(c => {
        if (c.author === active.username) {
          allCustomComments.push({
            trackId: t.id,
            trackTitle: t.title,
            commentId: c.id,
            text: c.text,
            timestamp: c.timestamp,
            createdAt: c.createdAt
          });
        }
      });
    });
    
    let commentsHTML = '';
    if (allCustomComments.length === 0) {
      commentsHTML = `<div style="padding: 16px; color: var(--text-dim); text-align: center;">You haven't posted any comments yet. Try adding one on a song detail view!</div>`;
    } else {
      commentsHTML = `
        <div class="comments-list-section" style="display: flex; flex-direction: column; gap: 12px;">
          ${allCustomComments.map(c => `
            <div class="comment-card" style="border: 1px solid var(--border-color); background-color: var(--bg-surface); padding: 16px; border-radius: var(--radius-md); cursor: pointer;" data-track-id="${c.trackId}" data-timestamp="${c.timestamp}">
              <div class="comment-body">
                <div class="comment-meta">
                  <span class="comment-author-name" style="color: white; font-weight: 700;">On "${c.trackTitle}"</span>
                  <span class="comment-time-badge" style="background-color: var(--bg-surface-active); color: var(--accent); font-family: var(--font-display);">${this.formatTime(c.timestamp)}</span>
                </div>
                <div class="comment-text" style="color: var(--text-muted); font-size: 14px; margin-top: 8px;">"${c.text}"</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    container.innerHTML = `
      <div class="view-container">
        <div class="profile-header">
          <div class="profile-avatar-large">${active.avatarInitial}</div>
          
          <div class="profile-meta-info" style="flex-grow: 1;">
            <div class="profile-badge">Independent Creator</div>
            <h1 class="profile-name">${active.username}</h1>
            
            <div id="profile-bio-box" style="margin-top: 4px;">
              <p id="profile-bio-text" style="color: var(--text-muted); font-size: 14px; line-height: 1.6; max-width:500px;">${active.bio || 'Uploading, listening, and coding beats since 2026.'}</p>
              <button class="btn-flat" id="profile-edit-bio-btn" style="padding: 4px 10px; font-size:11px; font-weight:600; margin-top:8px; border-radius:var(--radius-sm);">Edit Bio</button>
            </div>
            
            <div id="profile-bio-edit-form" class="hidden" style="display:flex; flex-direction:column; gap:8px; max-width:500px; margin-top:8px;">
              <textarea id="profile-bio-textarea" rows="2" style="background:var(--bg-base); border:1px solid var(--border-color); border-radius:var(--radius-md); color:white; padding:8px; font-size:13px; font-family:var(--font-body);">${active.bio}</textarea>
              <div style="display:flex; gap:10px; justify-content:flex-end;">
                <button class="btn-flat" id="profile-cancel-bio-btn" style="padding: 4px 10px; font-size:11px; border-radius:var(--radius-sm);">Cancel</button>
                <button class="btn-primary" id="profile-save-bio-btn" style="padding: 4px 10px; font-size:11px; box-shadow:none; border-radius:var(--radius-sm);">Save</button>
              </div>
            </div>
            
            <div class="profile-stats" style="margin-top: 16px;">
              <div class="stat-item">
                <span class="stat-val">${uploads.length}</span>
                <span class="stat-label">Tracks</span>
              </div>
              <div class="stat-item">
                <span class="stat-val">${likes.length}</span>
                <span class="stat-label">Liked</span>
              </div>
              <div class="stat-item">
                <span class="stat-val">${allCustomComments.length}</span>
                <span class="stat-label">Comments</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="upload-grid">
          <div class="view-section">
            <h2>Your Uploaded Songs</h2>
            <div class="track-list" style="max-height: 400px; overflow-y: auto;">
              ${uploads.length === 0 ? '<div style="padding: 16px; color: var(--text-dim); text-align: center;">No tracks uploaded yet. Go to the uploader tab!</div>' : 
                uploads.map((t, idx) => `
                  <div class="track-list-item" style="grid-template-columns: 40px 60px 4fr 1fr;" data-track-id="${t.id}">
                    <span class="list-index">${idx + 1}</span>
                    <button class="list-play-btn" data-track-id="${t.id}"><i data-lucide="play"></i></button>
                    <div class="list-title-box">
                      <span class="list-title">${t.title}</span>
                      <span class="list-artist">${t.artist}</span>
                    </div>
                    <span class="list-duration">${this.formatTime(t.duration)}</span>
                  </div>
                `).join('')
              }
            </div>
          </div>
          
          <div class="view-section">
            <h2>Your Reviews Feed</h2>
            ${commentsHTML}
          </div>
        </div>
      </div>
    `;
    
    // Wire Bio edit forms
    const editBtn = document.getElementById('profile-edit-bio-btn');
    const cancelBtn = document.getElementById('profile-cancel-bio-btn');
    const saveBtn = document.getElementById('profile-save-bio-btn');
    const bioBox = document.getElementById('profile-bio-box');
    const bioForm = document.getElementById('profile-bio-edit-form');
    const textarea = document.getElementById('profile-bio-textarea');
    
    if (editBtn) {
      editBtn.onclick = () => {
        bioBox.classList.add('hidden');
        bioForm.classList.remove('hidden');
        textarea.focus();
      };
    }
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        bioBox.classList.remove('hidden');
        bioForm.classList.add('hidden');
        textarea.value = active.bio;
      };
    }
    if (saveBtn) {
      saveBtn.onclick = () => {
        const text = textarea.value.trim();
        StorageManager.updateProfileBio(text);
        
        bioBox.classList.remove('hidden');
        bioForm.classList.add('hidden');
        document.getElementById('profile-bio-text').textContent = text || 'No bio provided.';
        
        // Dynamic reload top pill and bio cache
        this.renderTopBarAuth();
      };
    }
    
    document.querySelectorAll('.track-list-item').forEach(item => {
      const trackId = item.getAttribute('data-track-id');
      item.onclick = (e) => {
        if (e.target.closest('.list-play-btn')) return;
        this.navigateTo('track-detail', { trackId });
      };
      
      const playBtn = item.querySelector('.list-play-btn');
      if (playBtn) {
        playBtn.onclick = (e) => {
          e.stopPropagation();
          playerEngine.setPlaylist(uploads, uploads.findIndex(t => t.id === trackId));
          playerEngine.play();
        };
      }
    });
    
    document.querySelectorAll('.comment-card').forEach(card => {
      const trackId = card.getAttribute('data-track-id');
      const stamp = parseFloat(card.getAttribute('data-timestamp'));
      
      card.onclick = () => {
        this.navigateTo('track-detail', { trackId });
        const targetTrack = StorageManager.getTracks().find(t => t.id === trackId);
        if (targetTrack) {
          const cur = playerEngine.getCurrentTrack();
          if (!cur || cur.id !== trackId) {
            playerEngine.setPlaylist([targetTrack], 0);
            playerEngine.play();
          }
          setTimeout(() => {
            playerEngine.audio.currentTime = stamp;
          }, 300);
        }
      };
    });
  },

  // --- NEW AUTHENTICATION VIEW (Sleek Glassmorphic forms) ---
  
  renderAuth(container, params) {
    const isLogin = params && params.mode === 'register' ? false : true;
    const redirect = params && params.redirect ? params.redirect : 'home';
    const redirectParams = params && params.redirectParams ? params.redirectParams : null;
    const alertMsg = params && params.message ? params.message : '';
    
    container.innerHTML = `
      <div class="view-container" style="align-items: center; justify-content: center; min-height: 80%; padding-top: 24px;">
        
        ${alertMsg ? `
          <div style="background-color: rgba(255, 42, 109, 0.1); border: 1px solid rgba(255, 42, 109, 0.2); padding: 12px 24px; border-radius: var(--radius-md); text-align: center; color: #ff2a6d; max-width: 440px; margin-bottom: 20px; font-size:13px; font-weight:600; width:100%;">
            <i data-lucide="alert-circle" style="width:16px; height:16px; vertical-align:middle; margin-right:6px;"></i> ${alertMsg}
          </div>
        ` : ''}
        
        <div class="modal-card" style="width: 440px; border-radius: var(--radius-lg); background: var(--bg-surface); border: 1px solid var(--border-color); animation: slide-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); max-width: 100%;">
          
          <div class="auth-header" style="display:flex; justify-content:center; gap:24px; border-bottom: 1px solid var(--border-color); padding: 20px 24px 0 24px;">
            <button id="auth-tab-login" class="auth-tab" style="background:transparent; border:none; color: ${isLogin ? 'var(--accent)' : 'var(--text-dim)'}; border-bottom: 3px solid ${isLogin ? 'var(--accent)' : 'transparent'}; font-family: var(--font-display); font-size: 16px; font-weight: 700; padding-bottom: 16px; cursor: pointer; transition:var(--transition-fast);">Log In</button>
            <button id="auth-tab-signup" class="auth-tab" style="background:transparent; border:none; color: ${!isLogin ? 'var(--accent)' : 'var(--text-dim)'}; border-bottom: 3px solid ${!isLogin ? 'var(--accent)' : 'transparent'}; font-family: var(--font-display); font-size: 16px; font-weight: 700; padding-bottom: 16px; cursor: pointer; transition:var(--transition-fast);">Register</button>
          </div>
          
          <div class="modal-body" style="padding: 28px 32px 20px 32px; gap: 20px;">
            
            <div id="auth-error-box" class="hidden" style="color: #ff2a6d; border:1px solid rgba(255, 42, 109, 0.2); background:rgba(255, 42, 109, 0.05); padding:10px; border-radius:var(--radius-sm); font-size:12px; font-weight:600; text-align:center;"></div>
            
            <div class="input-group">
              <label for="auth-username">Username</label>
              <input type="text" id="auth-username" placeholder="e.g. lofi_luna" autocomplete="off" style="background-color: var(--bg-base); border: 1px solid var(--border-color);">
            </div>
            
            <div class="input-group ${isLogin ? 'hidden' : ''}" id="auth-email-group">
              <label for="auth-email">Email Address</label>
              <input type="email" id="auth-email" placeholder="e.g. luna@soundpulse.fm" autocomplete="off" style="background-color: var(--bg-base); border: 1px solid var(--border-color);">
            </div>
            
            <div class="input-group">
              <label for="auth-password">Password</label>
              <input type="password" id="auth-password" placeholder="••••••••" autocomplete="off" style="background-color: var(--bg-base); border: 1px solid var(--border-color);">
            </div>
            
            <button class="btn-primary" id="auth-submit-btn" style="width: 100%; justify-content: center; padding: 14px; font-size:14px; margin-top: 10px;">
              <span id="auth-submit-text">${isLogin ? 'Sign In' : 'Join SoundPulse'}</span>
            </button>
            
          </div>
          
          <div class="modal-footer" style="flex-direction:column; align-items:center; gap:12px; padding: 20px 32px 28px 32px; background: rgba(0,0,0,0.15);">
            <span style="font-size:11px; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Demo Shortcuts</span>
            <div style="display:flex; gap:10px; width:100%;">
              <button class="btn-flat demo-login-btn" data-demo-user="lofi_luna" style="flex-grow:1; padding: 8px 12px; font-size:11px; text-align:center; font-weight:600; white-space:nowrap; border-radius:var(--radius-sm);">As Lofi Luna</button>
              <button class="btn-flat demo-login-btn" data-demo-user="synth_dreamer" style="flex-grow:1; padding: 8px 12px; font-size:11px; text-align:center; font-weight:600; white-space:nowrap; border-radius:var(--radius-sm);">As Synth Dreamer</button>
            </div>
          </div>
          
        </div>
      </div>
    `;
    
    const tabLogin = document.getElementById('auth-tab-login');
    const tabSignup = document.getElementById('auth-tab-signup');
    const emailGroup = document.getElementById('auth-email-group');
    const submitText = document.getElementById('auth-submit-text');
    const submitBtn = document.getElementById('auth-submit-btn');
    const errBox = document.getElementById('auth-error-box');
    
    const uField = document.getElementById('auth-username');
    const eField = document.getElementById('auth-email');
    const pField = document.getElementById('auth-password');
    
    let currentMode = isLogin; // true for login, false for register
    
    const toggleMode = (loginMode) => {
      currentMode = loginMode;
      errBox.classList.add('hidden');
      
      tabLogin.style.color = currentMode ? 'var(--accent)' : 'var(--text-dim)';
      tabLogin.style.borderBottomColor = currentMode ? 'var(--accent)' : 'transparent';
      
      tabSignup.style.color = !currentMode ? 'var(--accent)' : 'var(--text-dim)';
      tabSignup.style.borderBottomColor = !currentMode ? 'var(--accent)' : 'transparent';
      
      if (currentMode) {
        emailGroup.classList.add('hidden');
        submitText.textContent = "Sign In";
      } else {
        emailGroup.classList.remove('hidden');
        submitText.textContent = "Join SoundPulse";
      }
    };
    
    tabLogin.onclick = () => toggleMode(true);
    tabSignup.onclick = () => toggleMode(false);
    
    // Form submission
    submitBtn.onclick = () => {
      errBox.classList.add('hidden');
      const u = uField.value.trim();
      const p = pField.value;
      const e = eField.value.trim();
      
      try {
        if (currentMode) {
          // Log In
          StorageManager.loginUser(u, p);
        } else {
          // Sign Up
          StorageManager.registerUser(u, e, p);
        }
        
        // Success: redirect to intended view or reload
        this.navigateTo(redirect, redirectParams);
        
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      }
    };
    
    // Quick Demo buttons logins
    document.querySelectorAll('.demo-login-btn').forEach(btn => {
      const demoUser = btn.getAttribute('data-demo-user');
      btn.onclick = () => {
        uField.value = demoUser;
        pField.value = "password123";
        toggleMode(true);
        submitBtn.click();
      };
    });
  },

  // --- SOUNDCLOUD DETAILED TRACK VIEW WITH TIMESTAMP COMMENTS ---
  
  renderTrackDetail(container, trackId) {
    const tracks = StorageManager.getTracks();
    const track = tracks.find(t => t.id === trackId);
    if (!track) {
      container.innerHTML = `<h3>Track not found</h3>`;
      return;
    }
    
    this.detailTrack = track;
    this.hoverPercent = -1;
    
    const coverHTML = track.coverUrl 
      ? `<img src="${track.coverUrl}" class="track-detail-cover" alt="Art" id="dt-cover">` 
      : `<div class="track-detail-cover-placeholder" style="background: linear-gradient(135deg, ${track.gradientColors[0]}, ${track.gradientColors[1]});"><i data-lucide="music" style="width: 48px; height: 48px;"></i></div>`;
      
    container.innerHTML = `
      <div class="view-container">
        <div class="track-detail-header">
          <div class="track-detail-meta">
            ${coverHTML}
            <div class="track-detail-title-block">
              <span class="track-detail-tag">${track.genre || 'Electronic'}</span>
              <h1 class="track-detail-title" id="dt-title">${track.title}</h1>
              <span class="track-detail-artist" id="dt-artist">${track.artist}</span>
              
              <div class="track-detail-social-actions">
                <button class="circle-action-btn" id="dt-play-btn" title="Play Track" style="background-color: var(--accent); color: black;">
                  <i data-lucide="play" style="fill: black;" id="dt-play-icon"></i>
                </button>
                <button class="circle-action-btn ${track.isLiked ? 'liked' : ''}" id="dt-like-btn" title="Like Song">
                  <i data-lucide="heart"></i>
                </button>
                <button class="circle-action-btn" id="dt-add-playlist-btn" title="Add to Playlist">
                  <i data-lucide="plus"></i>
                </button>
                <button class="circle-action-btn" id="dt-share-btn" title="Share Track">
                  <i data-lucide="share-2"></i>
                </button>
              </div>
            </div>
            
            <div class="stat-items-block" style="display: flex; flex-direction: column; gap: 12px; font-family: var(--font-display); text-align: right;">
              <span style="color: var(--text-dim); font-size: 11px; text-transform: uppercase;">Acoustic Stats</span>
              <span style="font-size: 20px; font-weight: 700; color: white;">${track.plays + (track.id.startsWith('upload') ? 0 : 42)} plays</span>
            </div>
          </div>
        </div>
        
        <div class="waveform-section">
          <div class="waveform-canvas-wrapper" id="canvas-wrapper">
            <canvas id="detailed-waveform-canvas"></canvas>
            <div id="comment-markers-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
          </div>
          
          <div class="comment-input-strip">
            <div class="comment-avatar" id="dt-comment-avatar">G</div>
            <input type="text" id="dt-comment-input" class="comment-input-field" placeholder="Write a timestamped review...">
            <div class="comment-timestamp-pill" id="comment-live-timestamp">At 0:00</div>
            <button class="comment-send-btn" id="dt-comment-send-btn" title="Post Comment">
              <i data-lucide="send"></i>
            </button>
          </div>
        </div>
        
        <div class="upload-grid" style="align-items: flex-start;">
          <div class="view-section">
            <h2>About this Track</h2>
            <div style="background-color: var(--bg-surface); border: 1px solid var(--border-color); padding: 24px; border-radius: var(--radius-lg); font-size: 15px; color: var(--text-muted); line-height: 1.6;">
              ${track.description}
            </div>
          </div>
          
          <div class="view-section">
            <h2>Timed Comments (${track.comments.length})</h2>
            <div class="comments-list-section" id="dt-comments-list" style="max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;">
              <!-- Timed comments -->
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Update Comment Form Avatar dynamically based on active auth
    const activeUser = StorageManager.getActiveUser();
    const commentAvatar = document.getElementById('dt-comment-avatar');
    if (commentAvatar) {
      commentAvatar.textContent = activeUser ? activeUser.avatarInitial : 'G';
      commentAvatar.style.color = activeUser ? 'var(--accent)' : 'var(--text-dim)';
    }
    
    const playBtn = document.getElementById('dt-play-btn');
    const playIcon = document.getElementById('dt-play-icon');
    const likeBtn = document.getElementById('dt-like-btn');
    const shareBtn = document.getElementById('dt-share-btn');
    const commentInput = document.getElementById('dt-comment-input');
    const commentSendBtn = document.getElementById('dt-comment-send-btn');
    const addPlBtn = document.getElementById('dt-add-playlist-btn');
    
    const active = playerEngine.getCurrentTrack();
    if (active && active.id === trackId && playerEngine.isPlaying) {
      playBtn.style.backgroundColor = "var(--text-main)";
      playIcon.setAttribute('data-lucide', 'pause');
      playIcon.style.fill = 'black';
    }
    
    playBtn.onclick = () => {
      const active = playerEngine.getCurrentTrack();
      if (active && active.id === trackId) {
        playerEngine.togglePlay();
      } else {
        playerEngine.setPlaylist([track], 0);
        playerEngine.play();
      }
      setTimeout(() => {
        const active = playerEngine.getCurrentTrack();
        const playing = playerEngine.isPlaying;
        if (active && active.id === trackId && playing) {
          playBtn.style.backgroundColor = "var(--text-main)";
          playIcon.setAttribute('data-lucide', 'pause');
        } else {
          playBtn.style.backgroundColor = "var(--accent)";
          playIcon.setAttribute('data-lucide', 'play');
        }
        if (window.lucide) window.lucide.createIcons();
      }, 100);
    };
    
    likeBtn.onclick = () => {
      if (!activeUser) {
        this.navigateTo('auth', { redirect: 'track-detail', redirectParams: { trackId }, message: 'You must log in to like tracks!' });
        return;
      }
      const liked = StorageManager.toggleLike(trackId);
      likeBtn.classList.toggle('liked', liked);
      const bottomLike = document.getElementById('player-like-btn');
      if (active && active.id === trackId && bottomLike) {
        bottomLike.classList.toggle('liked', liked);
      }
    };
    
    addPlBtn.onclick = () => {
      if (!activeUser) {
        this.navigateTo('auth', { redirect: 'track-detail', redirectParams: { trackId }, message: 'You must log in to construct playlists!' });
        return;
      }
      const pls = StorageManager.getPlaylists().filter(p => !p.isSystemPlaylist);
      if (pls.length === 0) {
        if (confirm("You don't have any custom playlists yet. Create one now?")) {
          document.getElementById('playlist-modal').classList.remove('hidden');
        }
      } else {
        const names = pls.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
        const select = prompt(`Select playlist index to add "${track.title}":\n${names}`);
        if (select) {
          const idx = parseInt(select) - 1;
          if (idx >= 0 && idx < pls.length) {
            StorageManager.addTrackToPlaylist(pls[idx].id, trackId);
            alert(`Added to playlist "${pls[idx].name}"!`);
            this.renderSidebarPlaylists();
          }
        }
      }
    };
    
    shareBtn.onclick = () => {
      navigator.clipboard.writeText(window.location.href);
      alert("App share URL copied to clipboard!");
    };
    
    this.renderDetailedCommentsList(track);
    
    const canvas = document.getElementById('detailed-waveform-canvas');
    if (canvas) {
      let progress = 0;
      if (active && active.id === trackId && playerEngine.audio.duration) {
        progress = playerEngine.audio.currentTime / playerEngine.audio.duration;
      }
      playerEngine.constructor.renderWaveform(canvas, track.peaks, progress);
      this.setupWaveformInteraction(canvas, track);
      this.renderCommentMarkers(track);
    }
    
    const postComment = () => {
      if (!activeUser) {
        this.navigateTo('auth', { redirect: 'track-detail', redirectParams: { trackId }, message: 'You must log in to write timed comments!' });
        return;
      }
      
      const text = commentInput.value.trim();
      if (!text) return;
      
      let timestamp = 0;
      if (active && active.id === trackId && playerEngine.audio.duration) {
        timestamp = playerEngine.audio.currentTime;
      } else {
        timestamp = this.hoverPercent !== -1 ? this.hoverPercent * track.duration : 0;
      }
      
      StorageManager.addComment(trackId, activeUser.username, text, timestamp);
      commentInput.value = '';
      
      const updatedTrack = StorageManager.getTracks().find(t => t.id === trackId);
      this.renderDetailedCommentsList(updatedTrack);
      this.renderCommentMarkers(updatedTrack);
      
      const p = (active && active.id === trackId && playerEngine.audio.duration) ? (playerEngine.audio.currentTime / playerEngine.audio.duration) : 0;
      playerEngine.constructor.renderWaveform(canvas, updatedTrack.peaks, p);
    };
    
    if (commentSendBtn) commentSendBtn.onclick = postComment;
    if (commentInput) {
      commentInput.onkeydown = (e) => {
        if (e.key === 'Enter') postComment();
      };
    }
  },
  
  renderDetailedCommentsList(track) {
    const list = document.getElementById('dt-comments-list');
    if (!list) return;
    
    const sorted = [...track.comments].sort((a, b) => a.timestamp - b.timestamp);
    
    if (sorted.length === 0) {
      list.innerHTML = `<div style="padding: 16px; color: var(--text-dim); text-align: center;">No comments yet. Be the first to share your thoughts!</div>`;
      return;
    }
    
    list.innerHTML = sorted.map(c => `
      <div class="comment-card" data-timestamp="${c.timestamp}">
        <div class="comment-avatar">${c.author[0].toUpperCase()}</div>
        <div class="comment-body">
          <div class="comment-meta">
            <span class="comment-author-name">${c.author}</span>
            <span class="comment-time-badge" title="Jump here">${this.formatTime(c.timestamp)}</span>
          </div>
          <span class="comment-text">${c.text}</span>
        </div>
      </div>
    `).join('');
    
    list.querySelectorAll('.comment-time-badge').forEach(badge => {
      badge.onclick = (e) => {
        e.stopPropagation();
        const stamp = parseFloat(badge.closest('.comment-card').getAttribute('data-timestamp'));
        
        const active = playerEngine.getCurrentTrack();
        if (!active || active.id !== track.id) {
          playerEngine.setPlaylist([track], 0);
          playerEngine.play();
        }
        
        setTimeout(() => {
          playerEngine.audio.currentTime = stamp;
          playerEngine.play();
        }, 150);
      };
    });
  },
  
  setupWaveformInteraction(canvas, track) {
    const wrapper = document.getElementById('canvas-wrapper');
    const liveTime = document.getElementById('comment-live-timestamp');
    
    const getPercent = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      return Math.max(0, Math.min(1, x / rect.width));
    };
    
    wrapper.onmousemove = (e) => {
      const percent = getPercent(e);
      this.hoverPercent = percent;
      
      const active = playerEngine.getCurrentTrack();
      const progress = (active && active.id === track.id && playerEngine.audio.duration) ? (playerEngine.audio.currentTime / playerEngine.audio.duration) : 0;
      
      playerEngine.constructor.renderWaveform(canvas, track.peaks, progress, percent);
      
      const targetTime = percent * track.duration;
      if (liveTime) {
        liveTime.textContent = `At ${this.formatTime(targetTime)}`;
      }
    };
    
    wrapper.onmouseleave = () => {
      this.hoverPercent = -1;
      const active = playerEngine.getCurrentTrack();
      const progress = (active && active.id === track.id && playerEngine.audio.duration) ? (playerEngine.audio.currentTime / playerEngine.audio.duration) : 0;
      
      playerEngine.constructor.renderWaveform(canvas, track.peaks, progress);
      
      if (liveTime) {
        const curTime = (active && active.id === track.id) ? playerEngine.audio.currentTime : 0;
        liveTime.textContent = `At ${this.formatTime(curTime)}`;
      }
    };
    
    wrapper.onclick = (e) => {
      const percent = getPercent(e);
      
      const active = playerEngine.getCurrentTrack();
      if (!active || active.id !== track.id) {
        playerEngine.setPlaylist([track], 0);
        playerEngine.play();
      }
      
      setTimeout(() => {
        playerEngine.seek(percent);
        playerEngine.play();
      }, 150);
    };
  },
  
  renderCommentMarkers(track) {
    const container = document.getElementById('comment-markers-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    track.comments.forEach(comment => {
      const pct = (comment.timestamp / track.duration) * 100;
      
      const marker = document.createElement('div');
      marker.className = 'waveform-comment-marker';
      marker.style.left = `${pct}%`;
      
      marker.innerHTML = `
        <div class="waveform-comment-tooltip">
          <span class="tooltip-author">${comment.author} <small style="color: var(--text-dim); font-weight: normal; margin-left: 4px;">(${this.formatTime(comment.timestamp)})</small></span>
          <span>"${comment.text}"</span>
        </div>
      `;
      
      marker.style.pointerEvents = 'auto';
      marker.onclick = (e) => {
        e.stopPropagation();
        
        const active = playerEngine.getCurrentTrack();
        if (!active || active.id !== track.id) {
          playerEngine.setPlaylist([track], 0);
          playerEngine.play();
        }
        
        setTimeout(() => {
          playerEngine.audio.currentTime = comment.timestamp;
          playerEngine.play();
        }, 150);
      };
      
      container.appendChild(marker);
    });
  },
  
  // --- HELPERS ---
  
  formatTime(secs) {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }
};
