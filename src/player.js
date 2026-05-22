// SOUNDPULSE AUDIO CONTROLLER & CANVAS VISUALIZATION ENGINE

export class AudioEngine {
  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous"; // Enable CORS for Web Audio API visualizers
    
    // Playback state
    this.playlist = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.isShuffle = false;
    this.isRepeat = 'none'; // 'none' | 'one' | 'all'
    this.shuffleOrder = [];
    
    // Web Audio API properties (instantiated lazily to satisfy browser autoplay requirements)
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.visualizerAnimationId = null;
    this.miniVisualizerAnimationId = null;
    this.isVisualizerEnabled = true;
    
    // Callbacks for UI updates
    this.onTrackChange = null;
    this.onPlayStateChange = null;
    this.onTimeUpdate = null;
    this.onQueueChange = null;
    
    this.initAudioListeners();
  }

  // --- AUDIO CORE LISTENERS ---
  initAudioListeners() {
    this.audio.addEventListener('timeupdate', () => {
      if (this.onTimeUpdate) {
        this.onTimeUpdate(this.audio.currentTime, this.audio.duration || 0);
      }
      this.checkTimestampCommentsTrigger();
    });
    
    this.audio.addEventListener('ended', () => {
      if (this.isRepeat === 'one') {
        this.audio.currentTime = 0;
        this.audio.play();
      } else {
        this.next();
      }
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      if (this.onPlayStateChange) this.onPlayStateChange(false);
    });

    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      if (this.onPlayStateChange) this.onPlayStateChange(true);
      this.initWebAudio(); // Try to initialize Web Audio on first user play
    });
  }

  // --- WEB AUDIO API SETUP ---
  initWebAudio() {
    if (this.audioContext) return; // Already initialized
    
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      // Attempt to connect HTML5 Audio to the Web Audio pipeline
      this.source = this.audioContext.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      
      console.log("Web Audio API successfully connected.");
      this.startMiniVisualizer();
    } catch (e) {
      // In case of CORS block or other constraints, we catch and log
      console.warn("Web Audio API connection failed. Player will fallback to standard HTML5 Audio without active visualizer:", e);
      // We sever the Web Audio nodes if they were partially initialized to let audio play directly
      if (this.source) {
        try {
          this.source.disconnect();
        } catch (err) {}
      }
    }
  }

  // --- QUEUE / CONTROLS API ---

  setPlaylist(tracks, startIndex = 0) {
    this.playlist = [...tracks];
    this.currentIndex = startIndex;
    
    if (this.isShuffle) {
      this.generateShuffleOrder();
      // Force active track as the starting track in shuffle order
      const orderIdx = this.shuffleOrder.indexOf(startIndex);
      if (orderIdx !== -1) {
        this.shuffleOrder.splice(orderIdx, 1);
        this.shuffleOrder.unshift(startIndex);
      }
    }
    
    this.loadActiveTrack();
    if (this.onQueueChange) this.onQueueChange();
  }

  getCurrentTrack() {
    if (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
      return this.playlist[this.currentIndex];
    }
    return null;
  }

  loadActiveTrack() {
    const track = this.getCurrentTrack();
    if (!track) return;
    
    // Revoke old URL if it was a local file blob URL to save memory
    if (this.audio.src && this.audio.src.startsWith('blob:') && this.audio.src !== track.url) {
      // Keep custom tracks' urls intact since they are held in storage, but we check
    }

    this.audio.src = track.url;
    this.audio.load();
    
    if (this.onTrackChange) {
      this.onTrackChange(track);
    }
  }

  play() {
    if (this.playlist.length === 0) return;
    if (this.currentIndex === -1) this.currentIndex = 0;
    
    // Resume context if suspended by browser security policy
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.warn("Autoplay block or loading error:", error);
        this.isPlaying = false;
        if (this.onPlayStateChange) this.onPlayStateChange(false);
      });
    }
  }

  pause() {
    this.audio.pause();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  next() {
    if (this.playlist.length === 0) return;
    
    if (this.isShuffle) {
      const currentShuffleIdx = this.shuffleOrder.indexOf(this.currentIndex);
      if (currentShuffleIdx !== -1 && currentShuffleIdx < this.shuffleOrder.length - 1) {
        this.currentIndex = this.shuffleOrder[currentShuffleIdx + 1];
      } else if (this.isRepeat === 'all') {
        this.currentIndex = this.shuffleOrder[0];
      } else {
        this.pause();
        return;
      }
    } else {
      if (this.currentIndex < this.playlist.length - 1) {
        this.currentIndex++;
      } else if (this.isRepeat === 'all') {
        this.currentIndex = 0;
      } else {
        this.pause();
        return;
      }
    }
    
    this.loadActiveTrack();
    this.play();
  }

  prev() {
    if (this.playlist.length === 0) return;
    
    // If song is past 3 seconds, restart the song first
    if (this.audio.currentTime > 3) {
      this.seek(0);
      return;
    }
    
    if (this.isShuffle) {
      const currentShuffleIdx = this.shuffleOrder.indexOf(this.currentIndex);
      if (currentShuffleIdx > 0) {
        this.currentIndex = this.shuffleOrder[currentShuffleIdx - 1];
      } else if (this.isRepeat === 'all') {
        this.currentIndex = this.shuffleOrder[this.shuffleOrder.length - 1];
      }
    } else {
      if (this.currentIndex > 0) {
        this.currentIndex--;
      } else if (this.isRepeat === 'all') {
        this.currentIndex = this.playlist.length - 1;
      }
    }
    
    this.loadActiveTrack();
    this.play();
  }

  seek(percent) {
    if (!this.audio.duration) return;
    this.audio.currentTime = percent * this.audio.duration;
  }

  setVolume(percent) {
    this.audio.volume = Math.max(0, Math.min(1, percent));
  }

  toggleMute() {
    this.audio.muted = !this.audio.muted;
    return this.audio.muted;
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    if (this.isShuffle && this.playlist.length > 0) {
      this.generateShuffleOrder();
    }
    return this.isShuffle;
  }

  toggleRepeat() {
    // Cycles: 'none' -> 'all' -> 'one' -> 'none'
    if (this.isRepeat === 'none') {
      this.isRepeat = 'all';
    } else if (this.isRepeat === 'all') {
      this.isRepeat = 'one';
    } else {
      this.isRepeat = 'none';
    }
    return this.isRepeat;
  }

  generateShuffleOrder() {
    this.shuffleOrder = Array.from({ length: this.playlist.length }, (_, i) => i);
    // Fisher-Yates Shuffle
    for (let i = this.shuffleOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffleOrder[i], this.shuffleOrder[j]] = [this.shuffleOrder[j], this.shuffleOrder[i]];
    }
  }

  // --- AUDIO FILE DECODER (FOR CREATOR UPLOADS) ---
  
  static decodeAudioFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const tempContext = new AudioContextClass();
        
        tempContext.decodeAudioData(arrayBuffer, function(decodedData) {
          const duration = decodedData.duration;
          
          // Generate peaks
          const peaks = AudioEngine.extractPeaksFromBuffer(decodedData, 120);
          tempContext.close();
          resolve({ duration, peaks });
        }, function(err) {
          tempContext.close();
          reject(new Error("Failed to decode audio binary: " + err.message));
        });
      };
      reader.onerror = function() {
        reject(new Error("Failed to read audio file bytes."));
      };
      reader.readAsArrayBuffer(file);
    });
  }
  
  static extractPeaksFromBuffer(buffer, sampleCount = 120) {
    const rawData = buffer.getChannelData(0); // Use Left channel for mono peaks
    const blockSize = Math.floor(rawData.length / sampleCount);
    const peaks = [];
    
    for (let i = 0; i < sampleCount; i++) {
      let start = i * blockSize;
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const val = Math.abs(rawData[start + j]);
        if (val > max) max = val;
      }
      peaks.push(Math.round(max * 100) / 100);
    }
    
    // Normalize peaks so the highest peak is around 0.95
    const maxVal = Math.max(...peaks);
    if (maxVal > 0) {
      const scale = 0.95 / maxVal;
      return peaks.map(p => Math.round(p * scale * 100) / 100);
    }
    
    return peaks.map(() => 0.1); // Fallback
  }

  // --- COMMENTS TIMESTAMP NOTIFIER ---
  checkTimestampCommentsTrigger() {
    const track = this.getCurrentTrack();
    if (!track || !track.comments) return;
    
    const curTime = Math.round(this.audio.currentTime);
    const matchingComments = track.comments.filter(c => Math.round(c.timestamp) === curTime);
    
    if (matchingComments.length > 0 && this.onCommentActiveTrigger) {
      // Trigger callback with active comment(s) to highlight/popup in UI
      this.onCommentActiveTrigger(matchingComments);
    }
  }

  // --- WAVEFORM CANVAS RENDERER ---
  
  static renderWaveform(canvas, peaks, progressPercent = 0, hoverPercent = -1) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Get true sizing
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    
    ctx.clearRect(0, 0, width, height);
    
    if (!peaks || peaks.length === 0) return;
    
    const barCount = peaks.length;
    const gap = 2;
    const barWidth = (width - (barCount - 1) * gap) / barCount;
    
    for (let i = 0; i < barCount; i++) {
      const peak = peaks[i];
      const barHeight = peak * height;
      const x = i * (barWidth + gap);
      const y = (height - barHeight) / 2; // Center-aligned waveform
      
      const barPercent = i / barCount;
      
      // Determine colors based on active play progress vs hover position
      let color = 'rgba(255, 255, 255, 0.15)'; // Muted unplayed
      
      if (barPercent <= progressPercent) {
        color = '#00e676'; // Standard dynamic Accent color (Played portion)
      } else if (hoverPercent !== -1 && barPercent <= hoverPercent) {
        color = 'rgba(0, 230, 118, 0.4)'; // Hover highlight
      }
      
      ctx.fillStyle = color;
      
      // Draw rounded vertical bars
      AudioEngine.drawRoundedRect(ctx, x, y, barWidth, barHeight, Math.max(1, barWidth / 2));
    }
  }
  
  static drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height - radius);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  // --- AUDIO VISUALIZER (FREQUENCY WAVE / BARS ANIMATORS) ---
  
  startMiniVisualizer() {
    if (this.miniVisualizerAnimationId) return;
    
    const canvas = document.getElementById('mini-visualizer');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const bufferLength = this.analyser ? this.analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      this.miniVisualizerAnimationId = requestAnimationFrame(draw);
      
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (!this.isPlaying || !this.analyser) {
        return; // Draw nothing active if not playing
      }
      
      this.analyser.getByteFrequencyData(dataArray);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      
      ctx.fillStyle = 'rgba(0, 230, 118, 0.1)';
      ctx.beginPath();
      
      for (let i = 0; i < bufferLength; i++) {
        const percent = dataArray[i] / 255;
        const barHeight = percent * canvas.height * 0.9;
        
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };
    
    draw();
  }

  startFullscreenVisualizer(canvas) {
    if (this.visualizerAnimationId) {
      cancelAnimationFrame(this.visualizerAnimationId);
    }
    
    const ctx = canvas.getContext('2d');
    const bufferLength = this.analyser ? this.analyser.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufferLength);
    
    let particleAngle = 0;
    
    const draw = () => {
      this.visualizerAnimationId = requestAnimationFrame(draw);
      
      // Resize to window
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const baseRadius = Math.min(canvas.width, canvas.height) * 0.15;
      
      ctx.fillStyle = 'rgba(4, 4, 7, 0.15)'; // Trail effect
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      if (this.analyser) {
        this.analyser.getByteFrequencyData(dataArray);
      } else {
        // Mock data when visualizer runs in silent/fallback mode
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = this.isPlaying ? (Math.sin(Date.now() / 200 + i) * 60 + 80) : 0;
        }
      }
      
      // Calculate overall energy
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      const avgEnergy = sum / bufferLength;
      const scaleFactor = 1 + (avgEnergy / 255) * 0.2;
      
      // Draw dynamic aura glow
      const glowGrad = ctx.createRadialGradient(cx, cy, baseRadius * 0.8, cx, cy, baseRadius * 2 * scaleFactor);
      glowGrad.addColorStop(0, 'rgba(0, 230, 118, 0.1)');
      glowGrad.addColorStop(0.5, 'rgba(0, 145, 234, 0.05)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 2 * scaleFactor, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw interactive circular visualizer waves!
      ctx.strokeStyle = '#00e676';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      for (let i = 0; i < bufferLength; i++) {
        const percent = dataArray[i] / 255;
        const amplitude = percent * 60;
        
        const angle = (i / bufferLength) * Math.PI * 2;
        const r = (baseRadius + amplitude) * scaleFactor;
        
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();
      
      // Inner blue pulse circle
      ctx.strokeStyle = 'rgba(0, 145, 234, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * scaleFactor, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw floating space particles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      particleAngle += 0.002 + (avgEnergy / 255) * 0.01;
      const numParticles = 30;
      for (let i = 0; i < numParticles; i++) {
        const localAngle = particleAngle + (i * Math.PI * 2) / numParticles;
        const r = (baseRadius * 2.2 + Math.sin(Date.now() / 1000 + i) * 30) * scaleFactor;
        const px = cx + Math.cos(localAngle) * r;
        const py = cy + Math.sin(localAngle) * r;
        ctx.beginPath();
        ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    };
    
    draw();
  }
  
  stopFullscreenVisualizer() {
    if (this.visualizerAnimationId) {
      cancelAnimationFrame(this.visualizerAnimationId);
      this.visualizerAnimationId = null;
    }
  }
}
export const playerEngine = new AudioEngine();
export default playerEngine;
