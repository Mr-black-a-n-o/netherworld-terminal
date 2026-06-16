import React, { useState } from "react";
import { useListSignals, useAnalyzeSignal } from "@workspace/api-client-react";
import { Search, Loader2 } from "lucide-react";

export default function SignalsPage() {
  const [symbolFilter, setSymbolFilter] = useState("");
  const [analyzeSymbol, setAnalyzeSymbol] = useState("");
  const [analyzeTimeframe, setAnalyzeTimeframe] = useState("1h");

  const { data: signals, refetch } = useListSignals({
    query: { refetchInterval: 30000 }
  });

  const analyzeMutation = useAnalyzeSignal();

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analyzeSymbol) return;
    try {
      await analyzeMutation.mutateAsync({
        data: {
          symbol: analyzeSymbol.toUpperCase(),
          timeframe: analyzeTimeframe
        }
      });
      refetch();
      setAnalyzeSymbol("");
    } catch (e) {
      console.error(e);
    }
  };

  const filteredSignals = signals?.filter(s => 
    s.symbol.toLowerCase().includes(symbolFilter.toLowerCase())
  );

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-4">
        <h1 className="text-2xl font-bold text-primary">SIGNAL INTELLIGENCE</h1>
        
        <form onSubmit={handleAnalyze} className="flex items-center gap-2 bg-card border border-border corner-brackets p-2 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="SYMBOL (e.g. BTCUSDT)" 
            value={analyzeSymbol}
            onChange={e => setAnalyzeSymbol(e.target.value)}
            className="bg-transparent border-none outline-none text-foreground w-32 md:w-40 text-sm uppercase placeholder:text-muted-foreground"
            data-testid="input-analyze-symbol"
          />
          <select 
            value={analyzeTimeframe}
            onChange={e => setAnalyzeTimeframe(e.target.value)}
            className="bg-black/50 border border-border text-xs p-1 outline-none text-accent"
            data-testid="select-analyze-timeframe"
          >
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d</option>
          </select>
          <button 
            type="submit"
            disabled={analyzeMutation.isPending || !analyzeSymbol}
            className="bg-primary/20 hover:bg-primary text-primary hover:text-primary-foreground border border-primary px-3 py-1 text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
            data-testid="button-analyze"
          >
            {analyzeMutation.isPending && <Loader2 size={12} className="animate-spin" />}
            ANALYZE
          </button>
        </form>
      </div>

      <div className="flex items-center bg-input/30 border border-border p-2 w-full max-w-md">
        <Search size={16} className="text-muted-foreground mr-2" />
        <input 
          type="text" 
          placeholder="Filter by symbol..." 
          value={symbolFilter}
          onChange={e => setSymbolFilter(e.target.value)}
          className="bg-transparent border-none outline-none w-full text-sm"
          data-testid="input-filter-symbols"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredSignals?.map((signal) => (
          <div key={signal.id} className="bg-card border border-border corner-brackets p-4 hover:border-primary/50 transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 bg-black/50 border-l border-b border-border/50 text-[10px] text-muted-foreground">
              {new Date(signal.createdAt).toLocaleTimeString()}
            </div>
            
            <div className="flex items-center gap-3 mb-4">
              <div className={`text-2xl font-bold ${signal.direction === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                {signal.direction === 'BUY' ? '🔥 BUY' : '☠️ SELL'}
              </div>
              <div>
                <div className="font-bold text-lg">{signal.symbol}</div>
                <div className="text-xs text-accent">{signal.timeframe}</div>
              </div>
            </div>

            <div className="mb-4 bg-black/40 border border-border/30 p-2 text-sm text-center">
              {getStrengthBadge(signal.strength)}
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs mb-4 text-center">
              <div className="border border-border/30 p-1 bg-black/20">
                <div className="text-muted-foreground mb-1">ENTRY</div>
                <div className="font-bold">{signal.entryPrice}</div>
              </div>
              <div className="border border-border/30 p-1 bg-black/20">
                <div className="text-muted-foreground mb-1">TP</div>
                <div className="font-bold text-green-500">{signal.takeProfit}</div>
              </div>
              <div className="border border-border/30 p-1 bg-black/20">
                <div className="text-muted-foreground mb-1">SL</div>
                <div className="font-bold text-red-500">{signal.stopLoss}</div>
              </div>
            </div>

            <div className="space-y-1 text-xs border-t border-border/50 pt-3">
              <div className="text-muted-foreground mb-2 tracking-widest">CONDITIONS</div>
              {Object.entries(signal.conditions).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center bg-black/20 p-1 px-2 border border-transparent hover:border-border/30">
                  <span className="uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span>{value ? '✅' : '❌'}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredSignals?.length === 0 && (
          <div className="col-span-full text-center py-20 text-muted-foreground uppercase tracking-widest border border-dashed border-border/50">
            No signals found
          </div>
        )}
      </div>
    </div>
  );
}
