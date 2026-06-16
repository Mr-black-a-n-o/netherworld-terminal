import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Terminal, Settings as SettingsIcon, Database } from "lucide-react";

export default function SettingsPage() {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="border-b border-border/50 pb-4">
        <h1 className="text-2xl font-bold text-primary">SYSTEM CONFIGURATION</h1>
        <p className="text-muted-foreground text-sm mt-1">Bot parameters & integrations</p>
      </div>

      <div className="grid gap-6">
        <div className="bg-card border border-border corner-brackets p-6">
          <h2 className="text-lg font-bold text-accent flex items-center gap-2 mb-4">
            <Terminal size={20} />
            BOT IDENTITY
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase block mb-1">DESIGNATION</label>
              <div className="text-foreground font-bold p-3 bg-black/50 border border-border/50">ham_evil_bot</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase block mb-1">EDITION</label>
              <div className="text-primary font-bold p-3 bg-black/50 border border-border/50">NETHERWORLD EDITION</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase block mb-1">STATUS</label>
              <div className="text-green-500 font-bold p-3 bg-green-500/10 border border-green-500/30 animate-pulse">ONLINE & ACTIVE</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border corner-brackets p-6">
          <h2 className="text-lg font-bold text-accent flex items-center gap-2 mb-4">
            <Database size={20} />
            SCHEDULER SUBSYSTEM
          </h2>
          <div className="p-4 bg-black/50 border border-border/50 space-y-2">
            <div className="flex justify-between items-center border-b border-border/30 pb-2">
              <span className="text-muted-foreground text-sm">SCAN INTERVAL</span>
              <span className="font-bold text-primary">15 MINUTES</span>
            </div>
            <div className="flex justify-between items-center border-b border-border/30 pb-2 pt-2">
              <span className="text-muted-foreground text-sm">MARKET DATA SYNC</span>
              <span className="font-bold">REALTIME</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-muted-foreground text-sm">AUTO-CLOSE THRESHOLDS</span>
              <span className="font-bold text-accent">ACTIVE</span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="bg-card border border-border corner-brackets p-6">
            <h2 className="text-lg font-bold text-accent flex items-center gap-2 mb-4">
              <SettingsIcon size={20} />
              ADMIN CONTROLS
            </h2>
            <div className="p-4 bg-black/50 border border-border/50">
              <p className="text-sm text-muted-foreground mb-4">
                System is currently integrated with Telegram bot @ham_evil_bot. 
                Configuration changes must be made at the environment level.
              </p>
              <div className="p-3 border border-yellow-500/30 bg-yellow-500/5 text-yellow-500 text-xs">
                ⚠️ WARNING: Altering connection strings requires a full system restart.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
