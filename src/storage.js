// SOUNDPULSE LOCAL STORAGE PERSISTENCE & AUTH LAYER
import { INITIAL_TRACKS } from './data.js';

const STORAGE_KEYS = {
  USERS: 'soundpulse_users_registry',
  ACTIVE_USER: 'soundpulse_active_user_session',
  CUSTOM_COMMENTS: 'soundpulse_custom_comments'
};

// Safe JSON Parse wrapper
function safeGetJSON(key, defaultValue) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error(`Error reading key "${key}" from localStorage:`, e);
    return defaultValue;
  }
}

function safeSetJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing key "${key}" to localStorage:`, e);
  }
}

// Pre-seed default users if database is empty
function preseedUsers() {
  const users = safeGetJSON(STORAGE_KEYS.USERS, null);
  if (!users) {
    const defaultUsers = [
      {
        username: 'lofi_luna',
        email: 'luna@soundpulse.fm',
        password: 'password123',
        bio: 'Lofi beats producer. Soft piano and rain elements are my signature aesthetic.',
        avatarInitial: 'L',
        createdAt: new Date().toISOString()
      },
      {
        username: 'synth_dreamer',
        email: 'dreamer@soundpulse.fm',
        password: 'password123',
        bio: 'Retro synthwave composer exploration down neon-lit Tokyo grid lines.',
        avatarInitial: 'S',
        createdAt: new Date().toISOString()
      }
    ];
    safeSetJSON(STORAGE_KEYS.USERS, defaultUsers);
  }
}

preseedUsers();

export const StorageManager = {
  
  // --- AUTHENTICATION MODULE ---
  
  getActiveUser() {
    return safeGetJSON(STORAGE_KEYS.ACTIVE_USER, null);
  },
  
  loginUser(username, password) {
    const users = safeGetJSON(STORAGE_KEYS.USERS, []);
    const match = users.find(u => u.username.toLowerCase() === username.toLowerCase().trim());
    
    if (!match) {
      throw new Error("Username not registered.");
    }
    
    if (match.password !== password) {
      throw new Error("Incorrect password.");
    }
    
    // Set active session
    const sessionUser = {
      username: match.username,
      email: match.email,
      bio: match.bio || "",
      avatarInitial: match.avatarInitial || match.username[0].toUpperCase()
    };
    safeSetJSON(STORAGE_KEYS.ACTIVE_USER, sessionUser);
    return sessionUser;
  },
  
  registerUser(username, email, password) {
    const cleanUser = username.trim();
    const cleanEmail = email.trim();
    
    if (cleanUser.length < 3) throw new Error("Username must be at least 3 characters.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    
    const users = safeGetJSON(STORAGE_KEYS.USERS, []);
    
    // Check duplicates
    const dupName = users.some(u => u.username.toLowerCase() === cleanUser.toLowerCase());
    if (dupName) throw new Error("Username already taken.");
    
    const dupEmail = users.some(u => u.email.toLowerCase() === cleanEmail.toLowerCase());
    if (dupEmail) throw new Error("Email already registered.");
    
    const newUser = {
      username: cleanUser,
      email: cleanEmail,
      password: password,
      bio: `Hello, I am ${cleanUser}! Just joined SoundPulse.`,
      avatarInitial: cleanUser[0].toUpperCase(),
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    safeSetJSON(STORAGE_KEYS.USERS, users);
    
    // Auto login after signup
    return this.loginUser(cleanUser, password);
  },
  
  logoutUser() {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
  },
  
  updateProfileBio(newBio) {
    const active = this.getActiveUser();
    if (!active) return false;
    
    const users = safeGetJSON(STORAGE_KEYS.USERS, []);
    const userIdx = users.findIndex(u => u.username === active.username);
    
    if (userIdx !== -1) {
      users[userIdx].bio = newBio;
      safeSetJSON(STORAGE_KEYS.USERS, users);
      
      // Update active session cache
      active.bio = newBio;
      safeSetJSON(STORAGE_KEYS.ACTIVE_USER, active);
      return true;
    }
    return false;
  },

  // --- DYNAMIC USER-ISOLATION KEYS HELPERS ---
  
  getUserKeys() {
    const active = this.getActiveUser();
    const prefix = active ? `soundpulse_${active.username}` : 'soundpulse_guest';
    return {
      uploads: `${prefix}_uploads`,
      likes: `${prefix}_likes`,
      playlists: `${prefix}_playlists`
    };
  },

  // --- TRACKS MANAGEMENT ---
  
  // Get all tracks (preseeded merged with active user's isolated uploads)
  getTracks() {
    const preseeded = JSON.parse(JSON.stringify(INITIAL_TRACKS)); // Deep clone
    const keys = this.getUserKeys();
    const customUploads = safeGetJSON(keys.uploads, []);
    const likedIds = this.getLikedTrackIds();
    
    // Combine preseeded and custom tracks
    const allTracks = [...preseeded, ...customUploads];
    
    // Set liked state and apply any custom comments
    return allTracks.map(track => {
      track.isLiked = likedIds.includes(track.id);
      
      // Merge public custom comments for this track (comments are public across all sessions)
      const customComments = safeGetJSON(`${STORAGE_KEYS.CUSTOM_COMMENTS}_${track.id}`, []);
      track.comments = [...(track.comments || []), ...customComments];
      
      return track;
    });
  },
  
  // Add a user uploaded track
  saveUpload(trackMetadata) {
    const active = this.getActiveUser();
    const keys = this.getUserKeys();
    const uploads = safeGetJSON(keys.uploads, []);
    
    const newTrack = {
      id: `upload-${Date.now()}`,
      title: trackMetadata.title || "Untitled Track",
      artist: active ? active.username : "Guest Creator",
      url: trackMetadata.url, 
      coverUrl: trackMetadata.coverUrl || "", 
      gradientColors: trackMetadata.gradientColors || this.getRandomGradient(),
      genre: trackMetadata.genre || "Electronic",
      description: trackMetadata.description || "No description provided.",
      duration: trackMetadata.duration || 180, 
      peaks: trackMetadata.peaks || [],
      comments: [],
      likes: 0,
      reposts: 0,
      plays: 0,
      isLiked: false,
      isCustomUpload: true,
      createdAt: new Date().toISOString()
    };
    
    uploads.unshift(newTrack);
    safeSetJSON(keys.uploads, uploads);
    return newTrack;
  },

  // --- LIKES MANAGEMENT ---
  
  getLikedTrackIds() {
    const keys = this.getUserKeys();
    return safeGetJSON(keys.likes, []);
  },
  
  toggleLike(trackId) {
    const keys = this.getUserKeys();
    const likedIds = this.getLikedTrackIds();
    const index = likedIds.indexOf(trackId);
    let isLikedNow = false;
    
    if (index === -1) {
      likedIds.push(trackId);
      isLikedNow = true;
    } else {
      likedIds.splice(index, 1);
      isLikedNow = false;
    }
    
    safeSetJSON(keys.likes, likedIds);
    return isLikedNow;
  },

  // --- PLAYLISTS MANAGEMENT ---
  
  getPlaylists() {
    const keys = this.getUserKeys();
    let playlists = safeGetJSON(keys.playlists, null);
    
    // Seed default playlists if empty
    if (!playlists) {
      playlists = [
        {
          id: "playlist-liked",
          name: "Liked Songs",
          description: "All the tracks you have liked on SoundPulse.",
          isSystemPlaylist: true,
          trackIds: []
        },
        {
          id: "playlist-uploads",
          name: "My Uploads",
          description: "Tracks you have uploaded to your SoundPulse library.",
          isSystemPlaylist: true,
          trackIds: []
        }
      ];
      safeSetJSON(keys.playlists, playlists);
    }
    
    // Synchronize liked playlist and custom upload playlist dynamically
    const likedIds = this.getLikedTrackIds();
    const uploads = safeGetJSON(keys.uploads, []);
    const uploadIds = uploads.map(t => t.id);
    
    return playlists.map(pl => {
      if (pl.id === "playlist-liked") {
        pl.trackIds = likedIds;
      } else if (pl.id === "playlist-uploads") {
        pl.trackIds = uploadIds;
      }
      return pl;
    });
  },
  
  createPlaylist(name, description = "") {
    const keys = this.getUserKeys();
    const playlists = safeGetJSON(keys.playlists, []);
    const newPlaylist = {
      id: `playlist-${Date.now()}`,
      name: name || "New Playlist",
      description: description,
      isSystemPlaylist: false,
      trackIds: [],
      createdAt: new Date().toISOString()
    };
    
    playlists.push(newPlaylist);
    safeSetJSON(keys.playlists, playlists);
    return newPlaylist;
  },
  
  addTrackToPlaylist(playlistId, trackId) {
    const keys = this.getUserKeys();
    const playlists = safeGetJSON(keys.playlists, []);
    const playlist = playlists.find(pl => pl.id === playlistId);
    
    if (playlist && !playlist.trackIds.includes(trackId)) {
      playlist.trackIds.push(trackId);
      safeSetJSON(keys.playlists, playlists);
      return true;
    }
    return false;
  },
  
  removeTrackFromPlaylist(playlistId, trackId) {
    const keys = this.getUserKeys();
    const playlists = safeGetJSON(keys.playlists, []);
    const playlist = playlists.find(pl => pl.id === playlistId);
    
    if (playlist) {
      const idx = playlist.trackIds.indexOf(trackId);
      if (idx !== -1) {
        playlist.trackIds.splice(idx, 1);
        safeSetJSON(keys.playlists, playlists);
        return true;
      }
    }
    return false;
  },

  // --- COMMENTS MANAGEMENT (PUBLIC ACROSS SESSIONS) ---
  
  addComment(trackId, author, text, timestamp) {
    const trackCommentsKey = `${STORAGE_KEYS.CUSTOM_COMMENTS}_${trackId}`;
    const comments = safeGetJSON(trackCommentsKey, []);
    
    const newComment = {
      id: `comment-${Date.now()}`,
      author: author || "Guest Listener",
      text: text,
      timestamp: Math.round(timestamp),
      createdAt: new Date().toISOString()
    };
    
    comments.push(newComment);
    safeSetJSON(trackCommentsKey, comments);
    return newComment;
  },

  // --- HELPERS ---
  
  getRandomGradient() {
    const gradients = [
      ["#ff9966", "#ff5e62"], 
      ["#00c6ff", "#0072ff"], 
      ["#11998e", "#38ef7d"], 
      ["#ee0979", "#ff6a00"], 
      ["#4ca1af", "#c4e0e5"], 
      ["#833ab4", "#fcb045"], 
      ["#1f1c2c", "#928dab"], 
      ["#141e30", "#243b55"]  
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
  }
};

