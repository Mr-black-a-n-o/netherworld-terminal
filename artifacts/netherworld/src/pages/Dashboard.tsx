import React from "react";
import { useGetTodayStats, useListTrades, useListSignals } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Target, ShieldAlert, Crosshair } from "lucide-react";

function fmtPrice(n: number): string {
  if (!n) return "—";
  if (n >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toFixed(6);
}

function getStrengthBadge(strength: number) {
  switch (strength) {
    case 1: return <span className="text-red-500 font-bold">🔴 VERY WEAK 1/5</span>;
    case 2: return <span className="text-orange-500 font-bold">🟠 WEAK 2/5</span>;
    case 3: return <span className="text-yellow-500 font-bold">🟡 MODERATE 3/5</span>;
    case 4: return <span className="text-green-500 font-bold">🟢 STRONG 4/5</span>;
    case 5: return <span className="text-primary font-bold animate-glow-pulse">⚡ ELITE 5/5</span>;
    default: return null;
  }
}

export default function Dashboard() {
  const { data: stats } = useGetTodayStats({ query: { refetchInterval: 30000, queryKey: ["today-stats"] } });
  const { data: trades } = useListTrades({ query: { refetchInterval: 15000, queryKey: ["trades"] } });
  const { data: signals } = useListSignals({});

  const activeTrades = trades?.filter(t => t.isActive) ?? [];

  // Find the most recent active signal details
  const latestActiveTrade = activeTrades[0] ?? null;
  const latestSignal = latestActiveTrade && signals
    ? signals.find(s => s.symbol === latestActiveTrade.symbol && s.status === "active")
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-3">
          <Activity className="animate-pulse" />
          NETHERWORLD TERMINAL ⚡
        </h1>
        <div className="flex items-center gap-2 text-red-500 text-sm animate-blink font-bold border border-red-500/50 px-3 py-1 bg-red-500/10">
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          HUNTING SIGNALS...
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "TOTAL SIGNALS", value: stats?.totalSignals ?? 0, icon: Target },
          { label: "ACTIVE TRADES", value: activeTrades.length, icon: Activity },
          { label: "WIN RATE", value: `${(stats?.winRate || 0).toFixed(1)}%`, icon: Crosshair },
          { label: "TP HITS", value: stats?.tpHits ?? 0, icon: ShieldAlert },
        ].map((stat, i) => (
          <Card key={i} className="bg-card border-border corner-brackets animate-pulse-shadow rounded-none overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-muted-foreground tracking-widest">{stat.label}</span>
                <stat.icon className="text-accent" size={16} />
              </div>
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TARGET LOCKED — latest active signal */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-red-500 animate-blink flex items-center gap-2">
            🎯 TARGET LOCKED
          </h2>

          <div className="bg-card border border-border corner-brackets p-4 min-h-[400px] relative overflow-hidden">
            {/* Glow background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

            {latestActiveTrade ? (
              <div className="relative z-10 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{latestActiveTrade.direction === "BUY" ? "🔥" : "☠️"}</span>
                    <div>
                      <div className="text-xl font-bold text-accent tracking-tighter">{latestActiveTrade.symbol}</div>
                      <div className={`text-sm font-bold ${latestActiveTrade.direction === "BUY" ? "text-green-400" : "text-red-400"}`}>
                        {latestActiveTrade.direction}
                      </div>
                    </div>
                  </div>
                  <div className={`text-lg font-bold ${(latestActiveTrade.pnlPercent ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(latestActiveTrade.pnlPercent ?? 0) >= 0 ? "+" : ""}{(latestActiveTrade.pnlPercent ?? 0).toFixed(2)}%
                  </div>
                </div>

                {/* Price levels */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-black/40 border border-border/40 p-3 text-center">
                    <div className="text-[10px] text-muted-foreground tracking-widest mb-1">ENTRY</div>
                    <div className="text-sm font-bold text-foreground">{fmtPrice(latestActiveTrade.entryPrice)}</div>
                  </div>
                  <div className="bg-black/40 border border-green-500/30 p-3 text-center">
                    <div className="text-[10px] text-green-500 tracking-widest mb-1">TAKE PROFIT 🎯</div>
                    <div className="text-sm font-bold text-green-400">{fmtPrice(latestActiveTrade.takeProfit)}</div>
                  </div>
                  <div className="bg-black/40 border border-red-500/30 p-3 text-center">
                    <div className="text-[10px] text-red-500 tracking-widest mb-1">STOP LOSS 🛑</div>
                    <div className="text-sm font-bold text-red-400">{fmtPrice(latestActiveTrade.stopLoss)}</div>
                  </div>
                </div>

                {/* Strength */}
                {latestSignal && (
                  <div className="bg-black/40 border border-border/40 p-3">
                    <div className="text-[10px] text-muted-foreground tracking-widest mb-2">SIGNAL STRENGTH</div>
                    <div className="text-sm">{getStrengthBadge(latestSignal.strength)}</div>
                  </div>
                )}

                {/* Conditions */}
                {latestSignal?.conditions && (
                  <div className="bg-black/40 border border-border/40 p-3">
                    <div className="text-[10px] text-muted-foreground tracking-widest mb-2">CONDITIONS</div>
                    <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                      {[
                        ["EMA200", latestSignal.conditions.ema200],
                        ["RSI", latestSignal.conditions.rsiDivergence],
                        ["Volume", latestSignal.conditions.volumeSpike],
                        ["S/R Zone", latestSignal.conditions.supportResistance],
                        ["Momentum", latestSignal.conditions.momentum],
                      ].map(([label, pass]) => (
                        <div key={String(label)} className={`flex items-center gap-1 ${pass ? "text-green-400" : "text-red-400"}`}>
                          <span>{pass ? "✅" : "❌"}</span>
                          <span>{String(label)}: {pass ? "Pass" : "Fail"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* P&L bar */}
                <div className="bg-black/40 border border-border/40 p-3">
                  <div className="text-[10px] text-muted-foreground tracking-widest mb-2">LIVE P&L</div>
                  <div className={`text-2xl font-bold ${(latestActiveTrade.pnlPercent ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(latestActiveTrade.pnlPercent ?? 0) >= 0 ? "+" : ""}
                    {(latestActiveTrade.pnlPercent ?? 0).toFixed(2)}%
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[350px] gap-4">
                <div className="text-5xl opacity-20">🎯</div>
                <div className="text-center text-muted-foreground uppercase tracking-widest text-sm">
                  NO ACTIVE SIGNAL
                </div>
                <div className="text-center text-muted-foreground/50 text-xs tracking-widest">
                  Next scan in &lt;15 min
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ACTIVE OPERATIONS */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-accent flex items-center gap-2">
            ⚡ ACTIVE OPERATIONS
          </h2>
          <div className="bg-card border border-border corner-brackets p-4 min-h-[400px] overflow-auto">
            {activeTrades.length > 0 ? (
              <div className="space-y-3">
                {activeTrades.map(trade => (
                  <div key={trade.id} className="border border-border/50 bg-black/40 p-3 hover:bg-black/60 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{trade.direction === "BUY" ? "🔥 BUY" : "☠️ SELL"}</span>
                        <span className="text-accent font-bold">{trade.symbol}</span>
                      </div>
                      <span className={`text-sm font-bold ${(trade.pnlPercent ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {(trade.pnlPercent ?? 0) >= 0 ? "+" : ""}{(trade.pnlPercent ?? 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mt-2 border-t border-border/30 pt-2">
                      <div>ENTRY: <span className="text-foreground">{fmtPrice(trade.entryPrice)}</span></div>
                      <div>TP: <span className="text-green-500">{fmtPrice(trade.takeProfit)}</span></div>
                      <div>SL: <span className="text-red-500">{fmtPrice(trade.stopLoss)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[350px] gap-4">
                <div className="text-5xl opacity-20">⚡</div>
                <div className="text-center text-muted-foreground uppercase tracking-widest text-sm">
                  No active operations
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
