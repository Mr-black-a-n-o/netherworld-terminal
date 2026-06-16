import React from "react";
import { useListUsers, useBlockUser, useUnblockUser, useDeleteUser, useBlockAllUsers } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Trash2, Ban, CheckCircle2 } from "lucide-react";

export default function UsersPage() {
  const { toast } = useToast();
  const { data: users, refetch } = useListUsers();

  const blockMutation = useBlockUser();
  const unblockMutation = useUnblockUser();
  const deleteMutation = useDeleteUser();
  const blockAllMutation = useBlockAllUsers();

  const handleAction = async (action: 'block' | 'unblock' | 'delete', id: number) => {
    try {
      if (action === 'block') await blockMutation.mutateAsync({ id });
      if (action === 'unblock') await unblockMutation.mutateAsync({ id });
      if (action === 'delete') {
        if (!confirm("Permanently purge this user?")) return;
        await deleteMutation.mutateAsync({ id });
      }
      refetch();
      toast({ title: `USER ${action.toUpperCase()}ED` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "ERROR", description: error.message });
    }
  };

  const handleBlockAll = async () => {
    if (!confirm("WARNING: This will block ALL users. Proceed?")) return;
    try {
      await blockAllMutation.mutateAsync();
      refetch();
      toast({ title: "TOTAL LOCKDOWN ENACTED", description: "All users blocked." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "ERROR", description: error.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">USER MANIFEST</h1>
          <p className="text-muted-foreground text-sm mt-1">Terminal access control</p>
        </div>
        <button 
          onClick={handleBlockAll}
          disabled={blockAllMutation.isPending}
          className="bg-destructive/20 border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground px-4 py-2 font-bold flex items-center gap-2 transition-all shadow-[0_0_10px_rgba(255,0,0,0.2)] hover:shadow-[0_0_20px_rgba(255,0,0,0.6)]"
          data-testid="button-block-all"
        >
          <ShieldAlert size={18} />
          🚫 BLOCK ALL USERS
        </button>
      </div>

      <div className="bg-card border border-border corner-brackets overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/60 border-b border-border/50 text-muted-foreground tracking-widest text-xs">
              <tr>
                <th className="p-4 font-normal">ALIAS</th>
                <th className="p-4 font-normal">FINGERPRINT</th>
                <th className="p-4 font-normal">STATUS</th>
                <th className="p-4 font-normal">JOINED</th>
                <th className="p-4 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {users?.map(user => (
                <tr key={user.id} className="border-b border-border/20 hover:bg-white/5 transition-colors">
                  <td className="p-4 font-bold text-accent">{user.username}</td>
                  <td className="p-4 font-mono text-xs text-muted-foreground">{user.deviceInfo || 'UNKNOWN'}</td>
                  <td className="p-4">
                    {user.isBlocked ? (
                      <span className="text-red-500 border border-red-500/50 bg-red-500/10 px-2 py-1 text-[10px] uppercase font-bold animate-pulse">🔴 BLOCKED</span>
                    ) : (
                      <span className="text-green-500 border border-green-500/50 bg-green-500/10 px-2 py-1 text-[10px] uppercase font-bold">🟢 ACTIVE</span>
                    )}
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {user.isBlocked ? (
                      <button 
                        onClick={() => handleAction('unblock', user.id)}
                        className="text-green-500 hover:bg-green-500/20 p-2 border border-transparent hover:border-green-500/50 transition-colors"
                        title="Unblock User"
                        data-testid={`button-unblock-${user.id}`}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleAction('block', user.id)}
                        className="text-orange-500 hover:bg-orange-500/20 p-2 border border-transparent hover:border-orange-500/50 transition-colors"
                        title="Block User"
                        data-testid={`button-block-${user.id}`}
                      >
                        <Ban size={16} />
                      </button>
                    )}
                    <button 
                      onClick={() => handleAction('delete', user.id)}
                      className="text-red-500 hover:bg-red-500/20 p-2 border border-transparent hover:border-red-500/50 transition-colors"
                      title="Purge User"
                      data-testid={`button-delete-${user.id}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {users?.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-muted-foreground tracking-widest">NO USERS FOUND IN MANIFEST</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
