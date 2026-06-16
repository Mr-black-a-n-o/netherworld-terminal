import React, { useState } from "react";
import { useListAssets, useCreateAsset, useDeleteAsset } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AssetsPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [newSymbol, setNewSymbol] = useState("");
  const [newType, setNewType] = useState<"crypto" | "forex">("crypto");

  const { data: assets, refetch } = useListAssets();
  const createMutation = useCreateAsset();
  const deleteMutation = useDeleteAsset();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol) return;
    try {
      await createMutation.mutateAsync({
        data: { symbol: newSymbol.toUpperCase(), type: newType }
      });
      setNewSymbol("");
      refetch();
      toast({ title: "ASSET ADDED", description: `${newSymbol.toUpperCase()} added to surveillance.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "ERROR", description: error.message });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove asset from surveillance?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      refetch();
      toast({ title: "ASSET REMOVED" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "ERROR", description: error.message });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="border-b border-border/50 pb-4">
        <h1 className="text-2xl font-bold text-primary">ASSET SURVEILLANCE</h1>
        <p className="text-muted-foreground text-sm mt-1">Tracked instruments for signal generation</p>
      </div>

      {isAdmin && (
        <form onSubmit={handleAdd} className="bg-card border border-border corner-brackets p-4 flex flex-col md:flex-row gap-4 items-end md:items-center">
          <div className="flex-1 w-full">
            <label className="text-xs text-muted-foreground tracking-widest uppercase mb-1 block">SYMBOL</label>
            <input 
              type="text" 
              value={newSymbol}
              onChange={e => setNewSymbol(e.target.value)}
              className="w-full bg-input/50 border border-border p-2 text-foreground focus:outline-none focus:border-primary uppercase"
              placeholder="e.g. BTCUSDT"
              data-testid="input-new-asset"
            />
          </div>
          <div className="w-full md:w-48">
            <label className="text-xs text-muted-foreground tracking-widest uppercase mb-1 block">TYPE</label>
            <select 
              value={newType}
              onChange={e => setNewType(e.target.value as any)}
              className="w-full bg-input/50 border border-border p-2 text-foreground focus:outline-none focus:border-primary uppercase"
              data-testid="select-new-asset-type"
            >
              <option value="crypto">CRYPTO</option>
              <option value="forex">FOREX</option>
            </select>
          </div>
          <button 
            type="submit"
            disabled={createMutation.isPending || !newSymbol}
            className="w-full md:w-auto bg-primary/20 text-primary border border-primary hover:bg-primary hover:text-primary-foreground p-2 px-6 font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            data-testid="button-add-asset"
          >
            {createMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            ADD ASSET
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        {assets?.map(asset => (
          <div key={asset.id} className="bg-card border border-border p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-4">
              <div className={`px-2 py-1 text-xs font-bold border ${asset.type === 'crypto' ? 'border-accent text-accent bg-accent/10' : 'border-blue-500 text-blue-500 bg-blue-500/10'}`}>
                {asset.type.toUpperCase()}
              </div>
              <div className="font-bold text-lg">{asset.symbol}</div>
            </div>
            
            {isAdmin && (
              <button 
                onClick={() => handleDelete(asset.id)}
                disabled={deleteMutation.isPending}
                className="text-muted-foreground hover:text-destructive p-2 opacity-0 group-hover:opacity-100 transition-all"
                title="Remove Asset"
                data-testid={`button-delete-asset-${asset.id}`}
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
        {assets?.length === 0 && (
          <div className="col-span-full text-center py-10 text-muted-foreground border border-dashed border-border/50">
            No assets configured.
          </div>
        )}
      </div>
    </div>
  );
}
