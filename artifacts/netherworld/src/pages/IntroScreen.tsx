import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function IntroScreen() {
  const [, setLocation] = useLocation();
  const [exploded, setExploded] = useState(false);
  const [countdown, setCountdown] = useState(9);
  const [clickPos, setClickPos] = useState<{x: number, y: number} | null>(null);

  useEffect(() => {
    if (exploded) {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setLocation("/dashboard");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [exploded, setLocation]);

  const handleClick = (e: React.MouseEvent) => {
    if (!exploded) {
      setClickPos({ x: e.clientX, y: e.clientY });
      setExploded(true);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black overflow-hidden flex flex-col items-center justify-center cursor-crosshair z-50"
      onClick={handleClick}
    >
      {/* Nebula glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent blur-3xl pointer-events-none" />

      {/* Center content */}
      <div className={`relative z-10 flex flex-col items-center justify-center transition-opacity duration-1000 ${exploded ? 'opacity-0 scale-150' : 'opacity-100'}`}>
        <div className="text-8xl mb-8 animate-glow-pulse drop-shadow-[0_0_15px_rgba(255,0,0,0.8)]">☠️</div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-purple-600 animate-pulse-shadow border border-red-800 p-8">
          POWERED BY MR.BLACK_A_N_O
        </h1>
        <div className="absolute inset-0 rounded-full border border-red-500/30 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] pointer-events-none" />
        <div className="absolute inset-[-20%] rounded-full border border-purple-500/20 animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite] pointer-events-none" />
      </div>

      <div className="absolute bottom-10 text-red-500/70 font-mono tracking-widest">
        ☠️ ham_evil_bot — netherworld edition ☠️
      </div>

      {exploded && clickPos && (
        <div 
          className="absolute w-4 h-4 bg-white rounded-full pointer-events-none animate-ping"
          style={{ left: clickPos.x - 8, top: clickPos.y - 8, animationDuration: '0.5s' }}
        />
      )}

      {exploded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <div className="text-red-500 text-6xl font-bold mb-4 font-mono animate-blink">
            INITIALIZING {countdown}
          </div>
          <div className="w-64 h-2 bg-gray-900 border border-red-900 overflow-hidden corner-brackets">
            <div 
              className="h-full bg-red-600 transition-all duration-1000 ease-linear"
              style={{ width: `${((9 - countdown) / 9) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
