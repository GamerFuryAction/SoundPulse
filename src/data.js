// SOUNDPULSE PRE-LOADED TRACKS DATA

// Helper to generate a realistic looking waveform peaks array
function generateWaveformPeaks(count = 100) {
  const peaks = [];
  let current = 0.3 + Math.random() * 0.4;
  for (let i = 0; i < count; i++) {
    // Random walk with boundaries
    const step = (Math.random() - 0.5) * 0.15;
    current = Math.max(0.08, Math.min(0.95, current + step));
    // Apply envelope at start and end
    let multiplier = 1;
    if (i < 8) multiplier = i / 8;
    if (i > count - 8) multiplier = (count - i) / 8;
    
    peaks.push(Math.round(current * multiplier * 100) / 100);
  }
  return peaks;
}

export const INITIAL_TRACKS = [
  {
    id: "preseeded-1",
    title: "Echoes of the Night",
    artist: "SoundHelix Piano",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    coverUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop",
    gradientColors: ["#0f2027", "#203a43", "#2c5364"],
    genre: "Ambient Classical",
    description: "A soothing piano journey through nocturnal soundscapes. Ideal for studying, relaxing, or coding in the dark.",
    duration: 372, // 6:12
    peaks: generateWaveformPeaks(120),
    comments: [
      { id: "c1", author: "LofiLuna", text: "That intro piano riff hits different 🌌", timestamp: 12, createdAt: "2026-05-21T18:00:00Z" },
      { id: "c2", author: "CodeWave", text: "This is perfect for fixing bugs at 2 AM", timestamp: 45, createdAt: "2026-05-21T19:30:00Z" },
      { id: "c3", author: "SynthDreamer", text: "The chord progression here is pure magic.", timestamp: 120, createdAt: "2026-05-22T08:15:00Z" },
      { id: "c4", author: "ZenMaster", text: "Breathe in, breathe out... beautiful.", timestamp: 240, createdAt: "2026-05-22T12:00:00Z" }
    ],
    likes: 245,
    reposts: 34,
    plays: 10452,
    isLiked: false
  },
  {
    id: "preseeded-2",
    title: "Digital Dreams",
    artist: "Helix Wave",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    coverUrl: "https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=400&auto=format&fit=crop",
    gradientColors: ["#833ab4", "#fd1d1d", "#fcb045"],
    genre: "Synthwave",
    description: "A fast-paced retro-futuristic synth journey that takes you down neon-lit grid lines. Buckle up.",
    duration: 425, // 7:05
    peaks: generateWaveformPeaks(120),
    comments: [
      { id: "c5", author: "NeonRider", text: "Feels like I'm driving through Neo-Tokyo in a DeLorean 🏎️⚡", timestamp: 35, createdAt: "2026-05-21T21:10:00Z" },
      { id: "c6", author: "PixelPal", text: "That bassline is absolutely driving! 🥁", timestamp: 98, createdAt: "2026-05-22T02:45:00Z" },
      { id: "c7", author: "CyberGamer", text: "Listening while playing Cyberpunk, epic vibes.", timestamp: 180, createdAt: "2026-05-22T10:30:00Z" }
    ],
    likes: 512,
    reposts: 89,
    plays: 23194,
    isLiked: false
  },
  {
    id: "preseeded-3",
    title: "Golden Hour",
    artist: "Acoustic Horizon",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop",
    gradientColors: ["#f12711", "#f5af19"],
    genre: "Acoustic Chill",
    description: "Warm acoustic melodies blended with soft ambient percussion, capturing the essence of a serene sunset over the ocean.",
    duration: 302, // 5:02
    peaks: generateWaveformPeaks(120),
    comments: [
      { id: "c8", author: "SunnyDaze", text: "Instantly brings back memories of summer beach trips 🏖️", timestamp: 15, createdAt: "2026-05-21T15:20:00Z" },
      { id: "c9", author: "FolkFan", text: "The acoustic string resonance is recorded so cleanly.", timestamp: 80, createdAt: "2026-05-22T04:12:00Z" },
      { id: "c10", author: "CoffeeCat", text: "Pairs perfectly with a warm cup of coffee.", timestamp: 154, createdAt: "2026-05-22T14:40:00Z" }
    ],
    likes: 188,
    reposts: 12,
    plays: 8740,
    isLiked: false
  },
  {
    id: "preseeded-4",
    title: "Coffee & Rain",
    artist: "Lofi Pulse",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    coverUrl: "https://images.unsplash.com/photo-1515002246390-7bf7e8f87b54?q=80&w=400&auto=format&fit=crop",
    gradientColors: ["#3a7bd5", "#3a6073"],
    genre: "Lofi Hip Hop",
    description: "Raindrops pattering on the window, the aroma of fresh brew, and ultra-chill lofi beats to keep you company.",
    duration: 338, // 5:38
    peaks: generateWaveformPeaks(120),
    comments: [
      { id: "c11", author: "RainLover", text: "The ambient rain sounds in the background are so cozy 🌧️☕", timestamp: 8, createdAt: "2026-05-22T01:00:00Z" },
      { id: "c12", author: "StudyBud", text: "Concentration level: 200%", timestamp: 110, createdAt: "2026-05-22T09:10:00Z" },
      { id: "c13", author: "BeatVibe", text: "This snare sample is so crisp.", timestamp: 215, createdAt: "2026-05-22T16:25:00Z" }
    ],
    likes: 624,
    reposts: 145,
    plays: 45281,
    isLiked: false
  },
  {
    id: "local-acido-iii",
    title: "Acido III",
    artist: "UdieNnx",
    url: "music/Acido III/ACIDO_III.mp3",
    coverUrl: "",
    gradientColors: ["#1a1a2e", "#4e4e8c"],
    genre: "Electronica",
    description: "Imported from the local music folder.",
    duration: 220,
    peaks: generateWaveformPeaks(120),
    comments: [],
    likes: 0,
    reposts: 0,
    plays: 0,
    isLiked: false
  },
  {
    id: "local-bad-ending-funk",
    title: "BAD ENDING FUNK - Shimuda (speed up)",
    artist: "Vainly",
    url: "music/BAD ENDING FUNK/BAD ENDING FUNK - Shimuda (speed up).mp3",
    coverUrl: "",
    gradientColors: ["#2d0a2f", "#6b1f4f"],
    genre: "Funk",
    description: "Imported from the local music folder.",
    duration: 230,
    peaks: generateWaveformPeaks(120),
    comments: [],
    likes: 0,
    reposts: 0,
    plays: 0,
    isLiked: false
  },
  {
    id: "local-dreamcore-funk",
    title: "DREAMCORE Funk",
    artist: "Death",
    url: "music/DreamCore Funk/DREAMCORE_FUNK.mp3",
    coverUrl: "",
    gradientColors: ["#0b3d91", "#36a2d9"],
    genre: "Dreamcore",
    description: "Imported from the local music folder.",
    duration: 210,
    peaks: generateWaveformPeaks(120),
    comments: [],
    likes: 0,
    reposts: 0,
    plays: 0,
    isLiked: false
  },
  {
    id: "local-mambo-sxllx",
    title: "MAMBO SXLLX",
    artist: "Funtom",
    url: "music/MAMBO SXLLX/MAMBO SXLLX.mp3",
    coverUrl: "",
    gradientColors: ["#a43c2d", "#f19d5a"],
    genre: "Latin Electronica",
    description: "Imported from the local music folder.",
    duration: 250,
    peaks: generateWaveformPeaks(120),
    comments: [],
    likes: 0,
    reposts: 0,
    plays: 0,
    isLiked: false
  }
];
