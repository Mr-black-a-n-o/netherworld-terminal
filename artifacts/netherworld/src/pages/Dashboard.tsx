import React from "react";
import { useGetTodayStats, useListTrades } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Target, ShieldAlert, Crosshair } from "lucide-react";

export default function Dashboard() {
  const { data: stats } = useGetTodayStats({
    query: {
      refetchInterval: 30000
    }
  });

  const { data: trades } = useListTrades({
    query: {
      refetchInterval: 30000
    }
  });

  const getStrengthBadge = (strength: number) => {
    switch (strength) {
      case 1: return <span className="text-red-500">🔴 VERY WEAK</span>;
      case 2: return <span className="text-orange-500">🟠 WEAK</span>;
      case 3: return <span className="text-yellow-500">🟡 MODERATE</span>;
      case 4: return <span className="text-green-500">🟢 STRONG</span>;
      case 5: return <span className="text-primary font-bold animate-glow-pulse">⚡ ELITE SIGNAL</span>;
      default: return null;
    }
  };

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
          { label: "TOTAL SIGNALS", value: stats?.totalSignals || 0, icon: Target },
          { label: "ACTIVE TRADES", value: trades?.filter(t => t.isActive).length || 0, icon: Activity },
          { label: "WIN RATE", value: `${(stats?.winRate || 0).toFixed(1)}%`, icon: Crosshair },
          { label: "TP HITS", value: stats?.tpHits || 0, icon: ShieldAlert },
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
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-red-500 animate-blink flex items-center gap-2">
            🎯 TARGET LOCKED
          </h2>
          <div className="bg-card border border-border corner-brackets p-4 min-h-[400px]">
            <div className="text-center text-muted-foreground py-20 uppercase tracking-widest text-sm">
              Waiting for signal intelligence...
              <br/>
              (Check Signals page to analyze)
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-accent flex items-center gap-2">
            ⚡ ACTIVE OPERATIONS
          </h2>
          <div className="bg-card border border-border corner-brackets p-4 min-h-[400px] overflow-auto">
            {trades && trades.filter(t => t.isActive).length > 0 ? (
              <div className="space-y-3">
                {trades.filter(t => t.isActive).map(trade => (
                  <div key={trade.id} className="border border-border/50 bg-black/40 p-3 hover:bg-black/60 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{trade.direction === 'BUY' ? '🔥 BUY' : '☠️ SELL'}</span>
                        <span className="text-accent font-bold">{trade.symbol}</span>
                      </div>
                      <span className={`text-sm ${trade.pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mt-2 border-t border-border/30 pt-2">
                      <div>ENTRY: <span className="text-foreground">{trade.entryPrice}</span></div>
                      <div>TP: <span className="text-green-500">{trade.takeProfit}</span></div>
                      <div>SL: <span className="text-red-500">{trade.stopLoss}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-20 uppercase tracking-widest text-sm">
                No active operations
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
