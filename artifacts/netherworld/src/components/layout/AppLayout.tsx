import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Activity, LayoutDashboard, Settings, User as UserIcon, LogOut, Wallet, ShieldAlert, Users } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, isAdmin, logout } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/signals", label: "Signals", icon: Activity },
    { href: "/assets", label: "Assets", icon: Wallet },
    { href: "/performance", label: "Performance", icon: ShieldAlert },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row overflow-hidden font-mono">
      {/* Top Gradient Line */}
      <div className="h-1 w-full absolute top-0 left-0 z-50 animate-gradient-flow" />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card shadow-[0_0_15px_rgba(0,0,0,0.5)] z-40">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-primary animate-glow-pulse tracking-tight">NETHERWORLD</h1>
          <h2 className="text-sm text-accent tracking-widest mt-1">TERMINAL ⚡</h2>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-none border ${isActive ? 'bg-primary/10 border-primary text-primary shadow-[inset_4px_0_0_hsl(var(--primary))]' : 'border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground hover:border-border'} transition-all`} data-testid={`nav-${item.label.toLowerCase()}`}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          
          {isAdmin && (
            <Link href="/users" className={`flex items-center gap-3 px-4 py-3 rounded-none border ${location === '/users' ? 'bg-primary/10 border-primary text-primary shadow-[inset_4px_0_0_hsl(var(--primary))]' : 'border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground hover:border-border'} transition-all`} data-testid="nav-users">
              <Users size={18} />
              <span>Users</span>
            </Link>
          )}

          <div className="my-6 border-t border-border" />

          <Link href="/profile" className={`flex items-center gap-3 px-4 py-3 rounded-none border ${location === '/profile' ? 'bg-primary/10 border-primary text-primary shadow-[inset_4px_0_0_hsl(var(--primary))]' : 'border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground hover:border-border'} transition-all`} data-testid="nav-profile">
            <UserIcon size={18} />
            <span>👤 Profile</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-border">
          <button onClick={logout} className="flex items-center gap-3 px-4 py-3 w-full text-left text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive transition-all" data-testid="button-logout">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
          <div className="mt-4 text-xs text-center text-muted-foreground tracking-widest">
            ☠️ Powered by Mr.black_a_n_o
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative z-10 overflow-auto h-screen pb-16 md:pb-0">
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:30px_30px]" />
        
        {/* Scanline effect */}
        <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%] opacity-20" />
        
        <div className="flex-1 p-4 md:p-8">
          {children}
        </div>

        <footer className="py-4 border-t border-border/50 text-center text-xs text-muted-foreground tracking-widest bg-background/80 backdrop-blur-sm z-20">
          ☠️ Powered by Mr.black_a_n_o — ham_evil_bot netherworld edition ☠️
        </footer>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card flex justify-around p-2 z-40 pb-safe">
        {[...navItems.slice(0, 4), { href: "/profile", label: "Profile", icon: UserIcon }].map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center p-2 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              <Icon size={20} />
              <span className="text-[10px] mt-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Watermark */}
      <div className="fixed bottom-10 right-10 text-[10vw] font-bold text-white/[0.02] pointer-events-none select-none -rotate-12 z-0 tracking-tighter whitespace-nowrap">
        Mr.black_a_n_o
      </div>
    </div>
  );
}
