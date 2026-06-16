import React from "react";
import { useGetTodayStats, useGetPortfolio, useGetSignalHistory } from "@workspace/api-client-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PerformancePage() {
  const { data: stats } = useGetTodayStats();
  const { data: portfolio } = useGetPortfolio();
  const { data: history } = useGetSignalHistory({ query: { limit: 50 } });

  const pieData = stats ? [
    { name: 'Wins (TP)', value: stats.tpHits, color: 'hsl(var(--primary))' },
    { name: 'Losses (SL)', value: stats.slHits, color: 'hsl(var(--destructive))' },
    { name: 'Manual', value: stats.manualCloses, color: 'hsl(var(--muted-foreground))' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      <div className="border-b border-border/50 pb-4">
        <h1 className="text-2xl font-bold text-primary">PERFORMANCE METRICS</h1>
        <p className="text-muted-foreground text-sm mt-1">Operational scorecard & history</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scorecard */}
        <Card className="col-span-1 bg-card border-border corner-brackets rounded-none">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-accent text-sm tracking-widest">TODAY'S SCORECARD</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-center border-b border-border/30 pb-2">
              <span className="text-muted-foreground text-sm">TOTAL SIGNALS</span>
              <span className="font-bold text-lg">{stats?.totalSignals || 0}</span>
            </div>
            <div className="flex justify-between items-center border-b border-border/30 pb-2">
              <span className="text-muted-foreground text-sm">WIN RATE</span>
              <span className="font-bold text-lg text-primary animate-glow-pulse">{(stats?.winRate || 0).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center border-b border-border/30 pb-2">
              <span className="text-muted-foreground text-sm">BEST TRADE</span>
              <span className="font-bold text-green-500">{stats?.bestTrade || '---'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">WORST TRADE</span>
              <span className="font-bold text-red-500">{stats?.worstTrade || '---'}</span>
            </div>

            {pieData.length > 0 && (
              <div className="h-[200px] mt-4 pt-4 border-t border-border/50">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 0, fontFamily: 'monospace' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'monospace' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Portfolio */}
        <Card className="col-span-1 lg:col-span-2 bg-card border-border corner-brackets rounded-none">
          <CardHeader className="border-b border-border/50 pb-3 flex flex-row justify-between items-center">
            <CardTitle className="text-accent text-sm tracking-widest">PORTFOLIO EXPOSURE</CardTitle>
            <div className={`font-bold text-xl px-4 py-1 border ${(portfolio?.totalPnlPercent || 0) >= 0 ? 'text-green-500 border-green-500/50 bg-green-500/10' : 'text-red-500 border-red-500/50 bg-red-500/10'}`}>
              PNL: {(portfolio?.totalPnlPercent || 0).toFixed(2)}%
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-[400px] overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-black/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-normal">ASSET</th>
                  <th className="px-4 py-3 font-normal">DIR</th>
                  <th className="px-4 py-3 font-normal">ENTRY</th>
                  <th className="px-4 py-3 font-normal">CURRENT</th>
                  <th className="px-4 py-3 font-normal text-right">PNL %</th>
                </tr>
              </thead>
              <tbody>
                {portfolio?.trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-border/30 hover:bg-white/5">
                    <td className="px-4 py-3 font-bold">{trade.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={trade.direction === 'BUY' ? 'text-green-500' : 'text-red-500'}>
                        {trade.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3">{trade.entryPrice}</td>
                    <td className="px-4 py-3 text-accent">{trade.currentPrice}</td>
                    <td className={`px-4 py-3 text-right font-bold ${trade.pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
                {portfolio?.trades.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No active positions</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card className="bg-card border-border corner-brackets rounded-none">
        <CardHeader className="border-b border-border/50 pb-3">
          <CardTitle className="text-accent text-sm tracking-widest">OPERATION HISTORY</CardTitle>
        </CardHeader>
        <CardContent className="p-0 max-h-[500px] overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-black/50 sticky top-0">
              <tr>
                <th className="px-4 py-3 font-normal">DATE</th>
                <th className="px-4 py-3 font-normal">ASSET</th>
                <th className="px-4 py-3 font-normal">DIR</th>
                <th className="px-4 py-3 font-normal">RESULT</th>
                <th className="px-4 py-3 font-normal text-right">PNL %</th>
              </tr>
            </thead>
            <tbody>
              {history?.map((trade: any) => (
                <tr key={trade.id} className="border-b border-border/30 hover:bg-white/5">
                  <td className="px-4 py-3 text-muted-foreground">{new Date(trade.closedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-bold">{trade.symbol}</td>
                  <td className="px-4 py-3">
                    <span className={trade.direction === 'BUY' ? 'text-green-500' : 'text-red-500'}>
                      {trade.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-[10px] uppercase border ${
                      trade.closeReason === 'take_profit' ? 'border-green-500 text-green-500 bg-green-500/10' :
                      trade.closeReason === 'stop_loss' ? 'border-red-500 text-red-500 bg-red-500/10' :
                      'border-muted text-muted-foreground bg-muted/10'
                    }`}>
                      {trade.closeReason.replace('_', ' ')}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${trade.pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
