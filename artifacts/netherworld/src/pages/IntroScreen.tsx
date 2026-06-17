import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";

interface Star {
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const STAR_COLORS = [
  "#9b30ff","#7b2fff","#ff2266","#cc1144","#aa00ff",
  "#ff44aa","#6600cc","#ff0055","#bb44ff","#dd1155",
];

function playThunder() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 0.3);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 180;
    lp.Q.value = 8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(2.5, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
    src.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    // Add a low boom
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 1.5);
    oscGain.gain.setValueAtTime(1.5, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.5);
  } catch {}
}

function speakWelcome() {
  try {
    const utter = new SpeechSynthesisUtterance("Welcome to Hamdhan's Netherworld");
    utter.pitch = 0.6;
    utter.rate = 0.75;
    utter.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const female = voices.find(v =>
      v.name.toLowerCase().includes("female") ||
      v.name.toLowerCase().includes("woman") ||
      v.name.includes("Samantha") ||
      v.name.includes("Victoria") ||
      v.name.includes("Karen") ||
      v.name.includes("Moira") ||
      v.name.includes("Tessa") ||
      v.name.includes("Fiona") ||
      (v.gender && v.gender === "female")
    );
    if (female) utter.voice = female;
    window.speechSynthesis.speak(utter);
  } catch {}
}

export default function IntroScreen() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const [exploded, setExploded] = useState(false);
  const [countdown, setCountdown] = useState(9);
  const [fading, setFading] = useState(false);
  const explodedRef = useRef(false);

  // Init stars
  useEffect(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const stars: Star[] = [];
    for (let i = 0; i < 320; i++) {
      const z = Math.random() * W;
      stars.push({
        x: Math.random() * W - W / 2,
        y: Math.random() * H - H / 2,
        z,
        px: 0,
        py: 0,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      });
    }
    starsRef.current = stars;
  }, []);

  const spawnBurst = useCallback((cx: number, cy: number) => {
    const particles: Particle[] = [];
    for (let i = 0; i < 200; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 14 + 2;
      const life = Math.random() * 60 + 40;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: Math.random() * 4 + 1,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      });
    }
    particlesRef.current = [...particlesRef.current, ...particles];
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let speed = 2;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;

      if (explodedRef.current) speed = Math.min(speed + 0.4, 40);

      // Draw stars
      for (const star of starsRef.current) {
        star.px = (star.x / star.z) * W + cx;
        star.py = (star.y / star.z) * H + cy;
        star.z -= speed;
        if (star.z <= 0) {
          star.x = Math.random() * W - cx;
          star.y = Math.random() * H - cy;
          star.z = W;
          star.px = (star.x / star.z) * W + cx;
          star.py = (star.y / star.z) * H + cy;
        }
        const nx = (star.x / star.z) * W + cx;
        const ny = (star.y / star.z) * H + cy;
        const size = Math.max(0.3, (1 - star.z / W) * 3.5);
        ctx.beginPath();
        ctx.moveTo(star.px, star.py);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = star.color;
        ctx.lineWidth = size;
        ctx.globalAlpha = Math.min(1, (1 - star.z / W) * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Draw burst particles
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      for (const p of particlesRef.current) {
        const alpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= 1;
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Countdown after explosion
  useEffect(() => {
    if (!exploded) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setFading(true);
          setTimeout(() => setLocation("/dashboard"), 900);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [exploded, setLocation]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (explodedRef.current) return;
    explodedRef.current = true;
    setExploded(true);
    spawnBurst(e.clientX, e.clientY);
    playThunder();
    // Small delay for voices to load
    setTimeout(speakWelcome, 200);
  }, [spawnBurst]);

  return (
    <div
      className="fixed inset-0 overflow-hidden cursor-crosshair z-50 select-none"
      onClick={handleClick}
      style={{
        opacity: fading ? 0 : 1,
        transition: fading ? "opacity 0.9s ease-in-out" : "none",
        background: "#000",
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Nebula core glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at 50% 50%, rgba(120,0,200,0.12) 0%, rgba(180,0,80,0.06) 40%, transparent 70%)"
      }} />

      {/* Center content — hidden after explosion */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-all duration-700 ${exploded ? "opacity-0 scale-125" : "opacity-100 scale-100"}`}>
        <div className="text-[100px] md:text-[140px] leading-none mb-6 drop-shadow-[0_0_30px_rgba(255,0,100,0.9)] animate-pulse">☠️</div>
        <h1 className="text-3xl md:text-6xl font-bold tracking-widest text-center px-4"
          style={{
            background: "linear-gradient(90deg, #ff0044, #aa00ff, #ff0044)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 12px rgba(255,0,80,0.7))",
          }}>
          POWERED BY MR.BLACK_A_N_O
        </h1>
        <p className="mt-8 text-red-500/60 font-mono tracking-[0.3em] text-sm animate-pulse">
          CLICK ANYWHERE TO ENTER ☠️
        </p>
      </div>

      {/* Post-explosion countdown */}
      {exploded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
          <div className="text-4xl md:text-7xl font-bold font-mono mb-8 tabular-nums"
            style={{
              color: "#ff0044",
              textShadow: "0 0 20px #ff0044, 0 0 40px #ff0044",
              animation: "pulse 0.5s ease-in-out infinite alternate",
            }}>
            INITIALIZING {countdown}
          </div>
          <div className="w-64 md:w-96 h-3 border border-red-900/80 overflow-hidden relative" style={{ boxShadow: "0 0 10px rgba(255,0,60,0.3)" }}>
            <div
              className="h-full transition-all duration-1000 ease-linear"
              style={{
                width: `${((9 - countdown) / 9) * 100}%`,
                background: "linear-gradient(90deg, #660022, #ff0044)",
                boxShadow: "0 0 8px #ff0044",
              }}
            />
          </div>
          <p className="mt-6 text-purple-400/70 font-mono tracking-widest text-xs">
            ☠️ ham_evil_bot — netherworld edition ☠️
          </p>
        </div>
      )}

      {/* Bottom watermark — pre-explosion */}
      {!exploded && (
        <div className="absolute bottom-8 left-0 right-0 text-center text-red-500/40 font-mono tracking-widest text-xs pointer-events-none">
          ☠️ ham_evil_bot — netherworld edition ☠️
        </div>
      )}
    </div>
  );
}
