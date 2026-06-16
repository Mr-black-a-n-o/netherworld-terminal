import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Skull } from "lucide-react";

function TerrorScreen() {
  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-red-900/20 mix-blend-overlay animate-[pulse_0.5s_infinite]" />
      <div className="relative z-10 text-center">
        <Skull className="w-32 h-32 text-red-600 mx-auto mb-8 animate-[bounce_0.2s_infinite]" />
        <h1 className="text-6xl font-bold text-red-600 mb-4 animate-[ping_0.5s_infinite] tracking-tighter">ACCESS DENIED</h1>
        <p className="text-xl text-red-500 font-mono tracking-widest uppercase mt-8 animate-pulse">
          YOUR SIGNATURE HAS BEEN RECORDED.<br/>
          DO NOT ATTEMPT RE-ENTRY.
        </p>
      </div>
      {/* Fake skull rain could be added with canvas, but CSS pseudo elements or simple divs work too */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        {Array.from({length: 50}).map((_, i) => (
          <div key={i} className="absolute text-red-600 animate-[scanline_2s_linear_infinite]" 
               style={{ 
                 left: `${Math.random() * 100}%`, 
                 animationDuration: `${Math.random() * 2 + 1}s`,
                 animationDelay: `${Math.random() * 2}s`
               }}>
            ☠️
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [showTerror, setShowTerror] = useState(false);

  const [adminUser, setAdminUser] = useState("hamdhan");
  const [adminPass, setAdminPass] = useState("");

  const [userUser, setUserUser] = useState("");
  const [userPasskey, setUserPasskey] = useState("");

  useEffect(() => {
    // Generate passkey based on user agent and username
    if (userUser.length >= 3) {
      const fp = btoa(navigator.userAgent + userUser).substring(0, 16).toUpperCase();
      setUserPasskey(`KEY-${fp}`);
    } else {
      setUserPasskey("");
    }
  }, [userUser]);

  const handleLogin = async (role: "admin" | "user") => {
    try {
      const username = role === "admin" ? adminUser : userUser;
      const res = await loginMutation.mutateAsync({
        data: {
          role,
          username: username,
          password: role === "admin" ? adminPass : undefined,
          deviceFingerprint: role === "user" ? userPasskey : undefined,
        }
      });

      login("dummy-token", res.role, res.username);
      setLocation("/intro");
    } catch (error: any) {
      if (error?.status === 403 || error?.message?.includes("blocked")) {
        setShowTerror(true);
      } else {
        toast({
          variant: "destructive",
          title: "AUTH FAILURE",
          description: error?.message || "Invalid credentials. The syndicate has logged this attempt."
        });
      }
    }
  };

  if (showTerror) {
    return <TerrorScreen />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative font-mono">
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:30px_30px]" />
      
      <div className="w-full max-w-md bg-card border border-border shadow-[0_0_20px_rgba(0,0,0,0.8)] relative z-10 corner-brackets">
        <div className="p-8 text-center border-b border-border bg-black/40">
          <h1 className="text-3xl font-bold text-primary animate-glow-pulse mb-2 tracking-tighter">NETHERWORLD</h1>
          <p className="text-accent text-sm tracking-[0.2em]">TERMINAL ACCESS</p>
        </div>

        <Tabs defaultValue="admin" className="p-6">
          <TabsList className="w-full grid grid-cols-2 mb-6 bg-black/50 border border-border/50">
            <TabsTrigger value="admin" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary" data-testid="tab-admin">ADMIN</TabsTrigger>
            <TabsTrigger value="user" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary" data-testid="tab-user">USER</TabsTrigger>
          </TabsList>

          <TabsContent value="admin" className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase mb-1 block">IDENTIFIER</label>
              <input 
                type="text" 
                value={adminUser} 
                onChange={e => setAdminUser(e.target.value)}
                className="w-full bg-input/50 border border-border p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                data-testid="input-admin-user"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase mb-1 block">PASSPHRASE</label>
              <input 
                type="password" 
                value={adminPass} 
                onChange={e => setAdminPass(e.target.value)}
                className="w-full bg-input/50 border border-border p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                data-testid="input-admin-pass"
              />
            </div>
            <button 
              onClick={() => handleLogin("admin")}
              disabled={loginMutation.isPending}
              className="w-full bg-primary/10 border border-primary text-primary hover:bg-primary hover:text-primary-foreground p-4 font-bold tracking-widest uppercase transition-all shadow-[inset_0_0_10px_rgba(255,0,0,0.2)] hover:shadow-[0_0_15px_rgba(255,0,0,0.5)] mt-4"
              data-testid="button-login-admin"
            >
              {loginMutation.isPending ? "AUTHENTICATING..." : "BREACH SYSTEM"}
            </button>
          </TabsContent>

          <TabsContent value="user" className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase mb-1 block">ALIAS (MIN 3 CHARS)</label>
              <input 
                type="text" 
                value={userUser} 
                onChange={e => setUserUser(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                className="w-full bg-input/50 border border-border p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="Enter Alias..."
                data-testid="input-user-user"
              />
            </div>
            
            {userUser.length >= 3 && (
              <div className="bg-black/50 border border-accent p-4 relative corner-brackets">
                <label className="text-[10px] text-accent tracking-widest uppercase mb-2 block">GENERATED PASSKEY</label>
                <div className="flex items-center justify-between">
                  <span className="text-accent font-bold truncate">{userPasskey}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(userPasskey);
                      toast({ title: "COPIED TO CLIPBOARD" });
                    }}
                    className="p-2 text-accent hover:bg-accent/20 rounded-none transition-colors"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
            )}

            <button 
              onClick={() => handleLogin("user")}
              disabled={loginMutation.isPending || userUser.length < 3}
              className="w-full bg-primary/10 border border-primary text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:hover:bg-primary/10 disabled:hover:text-primary p-4 font-bold tracking-widest uppercase transition-all shadow-[inset_0_0_10px_rgba(255,0,0,0.2)] hover:shadow-[0_0_15px_rgba(255,0,0,0.5)] mt-4"
              data-testid="button-login-user"
            >
              {loginMutation.isPending ? "AUTHENTICATING..." : "REQUEST ACCESS"}
            </button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
