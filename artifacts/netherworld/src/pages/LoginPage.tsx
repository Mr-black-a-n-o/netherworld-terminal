import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy } from "lucide-react";

function playHorrorSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    drone.type = "sawtooth";
    drone.frequency.setValueAtTime(40, ctx.currentTime);
    drone.frequency.linearRampToValueAtTime(35, ctx.currentTime + 3);
    droneGain.gain.setValueAtTime(0.4, ctx.currentTime);
    droneGain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 1);
    droneGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 4);
    drone.connect(droneGain);
    droneGain.connect(ctx.destination);
    drone.start();
    drone.stop(ctx.currentTime + 4);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(120, ctx.currentTime);
    osc2.frequency.setValueAtTime(90, ctx.currentTime + 0.5);
    osc2.frequency.setValueAtTime(130, ctx.currentTime + 1);
    gain2.gain.setValueAtTime(0.3, ctx.currentTime);
    gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start();
    osc2.stop(ctx.currentTime + 3);

    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 0.5);
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    noiseSrc.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSrc.start();
  } catch {}
}

function TerrorScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => { playHorrorSound(); }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    interface Skull { x: number; y: number; speed: number; size: number; opacity: number; }
    const skulls: Skull[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * -window.innerHeight,
      speed: Math.random() * 3 + 1,
      size: Math.random() * 22 + 10,
      opacity: Math.random() * 0.7 + 0.3,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of skulls) {
        ctx.globalAlpha = s.opacity;
        ctx.font = `${s.size}px serif`;
        ctx.fillText("☠️", s.x, s.y);
        s.y += s.speed;
        if (s.y > canvas.height + 40) { s.y = -40; s.x = Math.random() * canvas.width; }
      }
      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 overflow-hidden" style={{ animation: "terrorShake 0.15s infinite" }}>
      <style>{`
        @keyframes terrorShake {
          0%   { transform: translate(0,0) rotate(0deg); }
          20%  { transform: translate(-3px, 2px) rotate(-0.5deg); }
          40%  { transform: translate(3px, -2px) rotate(0.5deg); }
          60%  { transform: translate(-2px, 3px) rotate(-0.3deg); }
          80%  { transform: translate(2px, -1px) rotate(0.3deg); }
          100% { transform: translate(0,0) rotate(0deg); }
        }
        @keyframes glitchText {
          0%   { text-shadow: 2px 0 #ff0000, -2px 0 #0000ff; transform: translate(0); }
          20%  { text-shadow: -3px 0 #ff0000, 3px 0 #0000ff; transform: translate(-2px, 1px); }
          40%  { text-shadow: 3px 0 #ff0000, -3px 0 #0000ff; transform: translate(2px, -1px) skewX(3deg); }
          60%  { text-shadow: -2px 0 #ff0000, 2px 0 #0000ff; transform: translate(-1px, 2px); }
          80%  { text-shadow: 2px 2px #ff0000, -2px -2px #0000ff; transform: translate(1px, -2px) skewX(-3deg); }
          100% { text-shadow: 0 0 #ff0000, 0 0 #0000ff; transform: translate(0); }
        }
        @keyframes accessDeniedPulse {
          0%, 100% { opacity: 1; text-shadow: 0 0 10px #ff0000, 0 0 30px #ff0000, 0 0 60px #ff0000; }
          50% { opacity: 0.3; text-shadow: 0 0 2px #ff0000; }
        }
        @keyframes bloodDrop {
          0%   { transform: scaleY(0); transform-origin: top; opacity: 1; }
          70%  { transform: scaleY(1); transform-origin: top; opacity: 1; }
          100% { transform: scaleY(1); transform-origin: top; opacity: 0.7; }
        }
        @keyframes lightning {
          0%, 90%, 100% { opacity: 0; }
          92%, 96% { opacity: 0.15; }
          94%, 98% { opacity: 0; }
        }
        @keyframes scanDown {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `}</style>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      <div className="absolute inset-0 bg-red-600 pointer-events-none" style={{ animation: "lightning 1.5s ease-in-out infinite", zIndex: 2 }} />
      <div className="absolute left-0 top-0 w-8 h-full flex flex-col gap-0 pointer-events-none z-10">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="absolute top-0" style={{
            left: `${i * 6 + 2}px`, width: `${Math.random() * 6 + 4}px`,
            background: "linear-gradient(to bottom, #8b0000, #cc0000)",
            borderRadius: "0 0 50% 50%",
            animationName: "bloodDrop", animationDuration: `${Math.random() * 2 + 1}s`,
            animationDelay: `${Math.random() * 1}s`, animationFillMode: "forwards",
            animationTimingFunction: "ease-out", height: `${Math.random() * 40 + 20}vh`,
          }} />
        ))}
      </div>
      <div className="absolute right-0 top-0 w-8 h-full pointer-events-none z-10">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="absolute top-0" style={{
            right: `${i * 6 + 2}px`, width: `${Math.random() * 6 + 4}px`,
            background: "linear-gradient(to bottom, #8b0000, #cc0000)",
            borderRadius: "0 0 50% 50%",
            animationName: "bloodDrop", animationDuration: `${Math.random() * 2 + 1}s`,
            animationDelay: `${Math.random() * 1.5}s`, animationFillMode: "forwards",
            animationTimingFunction: "ease-out", height: `${Math.random() * 40 + 20}vh`,
          }} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none px-4">
        <div className="text-7xl md:text-9xl mb-4" style={{ animation: "glitchText 0.3s infinite" }}>☠️</div>
        <h1 className="text-4xl md:text-7xl font-bold font-mono tracking-tighter text-red-600 mb-8"
          style={{ animation: "accessDeniedPulse 0.6s ease-in-out infinite" }}>
          ACCESS DENIED
        </h1>
        <div className="relative max-w-xl text-center">
          <p className="text-base md:text-xl font-mono text-red-400 leading-relaxed tracking-wide"
            style={{ animation: "glitchText 0.4s infinite" }}>
            Lol blocked. 😂 There is no place for you in hell, Start paving your way to heaven 🙏 You&apos;ve been blocked by Mr.black_a_n_o ☠️
          </p>
        </div>
        <div className="mt-10 text-xs text-red-900 font-mono tracking-widest" style={{ animation: "glitchText 0.5s infinite" }}>
          YOUR DEVICE HAS BEEN LOGGED. SIGNATURE RECORDED.
        </div>
      </div>
      <div className="absolute left-0 right-0 h-1 bg-red-600/30 pointer-events-none z-30"
        style={{ animation: "scanDown 3s linear infinite" }} />
    </div>
  );
}

// Device-only fingerprint (does NOT include username so blocking works across name changes)
function getDeviceFingerprint(): string {
  const raw = [
    navigator.userAgent,
    screen.width,
    screen.height,
    screen.colorDepth,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");
  return btoa(raw).replace(/[^A-Z0-9]/gi, "").substring(0, 24).toUpperCase();
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [showTerror, setShowTerror] = useState(false);

  const [adminUser, setAdminUser] = useState("hamdhan");
  const [adminPass, setAdminPass] = useState("");

  const [userUser, setUserUser] = useState("");
  const [deviceFp, setDeviceFp] = useState("");

  useEffect(() => {
    setDeviceFp(getDeviceFingerprint());
  }, []);

  const handleLogin = async (role: "admin" | "user") => {
    try {
      const username = role === "admin" ? adminUser : userUser;
      const res = await loginMutation.mutateAsync({
        data: {
          role,
          username,
          password: role === "admin" ? adminPass : undefined,
          deviceFingerprint: role === "user" ? deviceFp : undefined,
        }
      });
      login("dummy-token", res.role, res.username);
      setLocation("/intro");
    } catch (error: any) {
      if (error?.status === 403 || error?.message?.includes("BLOCKED") || error?.message?.includes("blocked")) {
        setShowTerror(true);
      } else {
        toast({
          variant: "destructive",
          title: "AUTH FAILURE",
          description: error?.message || "Invalid credentials. The syndicate has logged this attempt."
        });
      }
    }
  };

  if (showTerror) return <TerrorScreen />;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative font-mono">
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:30px_30px]" />

      <div className="w-full max-w-md bg-card border border-border shadow-[0_0_20px_rgba(0,0,0,0.8)] relative z-10 corner-brackets">
        <div className="p-8 text-center border-b border-border bg-black/40">
          <h1 className="text-3xl font-bold text-primary animate-glow-pulse mb-2 tracking-tighter">NETHERWORLD</h1>
          <p className="text-accent text-sm tracking-[0.2em]">TERMINAL ACCESS</p>
        </div>

        <Tabs defaultValue="admin" className="p-6">
          <TabsList className="w-full grid grid-cols-2 mb-6 bg-black/50 border border-border/50">
            <TabsTrigger value="admin" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary">ADMIN</TabsTrigger>
            <TabsTrigger value="user" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary">USER</TabsTrigger>
          </TabsList>

          <TabsContent value="admin" className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase mb-1 block">IDENTIFIER</label>
              <input type="text" value={adminUser} onChange={e => setAdminUser(e.target.value)}
                className="w-full bg-input/50 border border-border p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase mb-1 block">PASSPHRASE</label>
              <input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin("admin")}
                className="w-full bg-input/50 border border-border p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <button onClick={() => handleLogin("admin")} disabled={loginMutation.isPending}
              className="w-full bg-primary/10 border border-primary text-primary hover:bg-primary hover:text-primary-foreground p-4 font-bold tracking-widest uppercase transition-all shadow-[inset_0_0_10px_rgba(255,0,0,0.2)] hover:shadow-[0_0_15px_rgba(255,0,0,0.5)] mt-4">
              {loginMutation.isPending ? "AUTHENTICATING..." : "BREACH SYSTEM"}
            </button>
          </TabsContent>

          <TabsContent value="user" className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase mb-1 block">YOUR NAME</label>
              <input type="text" value={userUser}
                onChange={e => setUserUser(e.target.value.replace(/[^a-zA-Z]/g, ""))}
                className="w-full bg-input/50 border border-border p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="Enter your name..." />
            </div>

            {userUser.length >= 3 && (
              <div className="bg-black/50 border border-accent p-4 relative corner-brackets">
                <label className="text-[10px] text-accent tracking-widest uppercase mb-2 block">DEVICE PASSKEY</label>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-accent font-bold truncate text-sm">{deviceFp}</span>
                  <button onClick={() => { navigator.clipboard.writeText(deviceFp); toast({ title: "COPIED TO CLIPBOARD" }); }}
                    className="p-2 text-accent hover:bg-accent/20 rounded-none transition-colors flex-shrink-0">
                    <Copy size={16} />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Unique to your device</p>
              </div>
            )}

            <button onClick={() => handleLogin("user")} disabled={loginMutation.isPending || userUser.length < 3}
              className="w-full bg-primary/10 border border-primary text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed p-4 font-bold tracking-widest uppercase transition-all shadow-[inset_0_0_10px_rgba(255,0,0,0.2)] hover:shadow-[0_0_15px_rgba(255,0,0,0.5)] mt-4">
              {loginMutation.isPending ? "AUTHENTICATING..." : "REQUEST ACCESS"}
            </button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
