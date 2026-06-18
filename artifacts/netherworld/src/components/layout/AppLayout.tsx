import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Activity, LayoutDashboard, Settings, User as UserIcon,
  LogOut, Wallet, ShieldAlert, Users, Download
} from "lucide-react";

function usePWAInstall() {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setPrompt(null);
    } else {
      // Fallback: guide user to install manually
      alert("To install: tap your browser's Share button → 'Add to Home Screen'  (iOS) or use the browser menu → 'Install app' (Android/Chrome)");
    }
  };

  return { installed, install };
}

function InstallButton({ className = "" }: { className?: string }) {
  const { installed, install } = usePWAInstall();
  if (installed) return null;
  return (
    <button
      onClick={install}
      title="Install App"
      className={`flex items-center gap-1.5 px-3 py-1.5 border border-accent text-accent hover:bg-accent hover:text-black font-bold tracking-widest uppercase text-xs transition-all ${className}`}
      style={{ boxShadow: "0 0 8px rgba(147,51,234,0.4)" }}
    >
      <Download size={12} />
      <span>Install</span>
    </button>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, logout } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
    { href: "/signals",     label: "Signals",     icon: Activity },
    { href: "/assets",      label: "Assets",      icon: Wallet },
    { href: "/performance", label: "Performance", icon: ShieldAlert },
    { href: "/settings",    label: "Settings",    icon: Settings },
  ];

  const allNavItems = [
    ...navItems,
    ...(isAdmin ? [{ href: "/users", label: "Users", icon: Users }] : []),
    { href: "/profile", label: "Profile", icon: UserIcon },
  ];

  const bottomNav = isAdmin
    ? [navItems[0], navItems[1], navItems[2], { href: "/users", label: "Users", icon: Users }, { href: "/profile", label: "Profile", icon: UserIcon }]
    : [...navItems.slice(0, 4), { href: "/profile", label: "Profile", icon: UserIcon }];

  return (
    <div className="min-h-screen bg-transparent text-foreground flex flex-col md:flex-row overflow-hidden font-mono">
      {/* Top Gradient Line */}
      <div className="h-0.5 w-full absolute top-0 left-0 z-50 animate-gradient-flow" />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 lg:w-64 border-r border-border bg-card/50 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.5)] z-40 flex-shrink-0">
        <div className="p-4 lg:p-6 border-b border-border">
          <h1 className="text-lg lg:text-xl font-bold text-primary animate-glow-pulse tracking-tight">NETHERWORLD</h1>
          <h2 className="text-xs text-accent tracking-widest mt-0.5">TERMINAL ⚡</h2>
          <InstallButton className="mt-3 w-full justify-center" />
          
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {allNavItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-none border text-sm transition-all ${
                  isActive
                    ? "bg-primary/10 border-primary text-primary shadow-[inset_4px_0_0_hsl(var(--primary))]"
                    : "border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground hover:border-border"
                }`}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          <div className="my-4 border-t border-border" />
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-left text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive transition-all text-sm"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
          <div className="mt-3 text-[10px] text-center text-muted-foreground tracking-widest leading-relaxed">
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card z-40">
        <div>
          <h1 className="text-base font-bold text-primary tracking-tight">NETHERWORLD</h1>
          <p className="text-[10px] text-accent tracking-widest">TERMINAL ⚡</p>
        </div>
        <div className="flex items-center gap-2">
          <InstallButton className="mt-3 w-full justify-center" />
          <button
            onClick={logout}
            className="p-2 text-destructive border border-destructive/40 hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative z-10 overflow-auto md:h-screen" style={{ paddingBottom: "64px" }}>
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:30px_30px]" />
        <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%] opacity-10" />

        <div className="flex-1 p-3 md:p-6 lg:p-8">
          {children}
        </div>

        <footer className="py-3 border-t border-border/50 text-center text-[10px] text-muted-foreground tracking-widest bg-background/30 backdrop-blur-sm z-20 hidden md:block">
          ☠️ Powered by  — ham_evil_bot netherworld edition ☠️
        </footer>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-around">
          {bottomNav.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-2 px-1 flex-1 min-w-0 transition-colors active:scale-95 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className={`p-1.5 transition-all ${isActive ? "bg-primary/10" : ""}`}>
                  <Icon size={18} />
                </div>
                <span className="text-[9px] mt-0.5 tracking-wide truncate w-full text-center">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      
    </div>
  );
}

