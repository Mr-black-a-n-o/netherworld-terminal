import React, { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGetProfile, useUpdateProfile } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

export default function ProfilePage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { data: profile, isLoading } = useGetProfile();
  const updateMutation = useUpdateProfile();

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      creatorName: "",
      bio: "",
      contactInfo: "",
      socialLinks: "",
      photoUrl: "",
    }
  });

  useEffect(() => {
    if (profile) {
      reset({
        creatorName: profile.creatorName || "",
        bio: profile.bio || "",
        contactInfo: profile.contactInfo || "",
        socialLinks: profile.socialLinks || "",
        photoUrl: profile.photoUrl || "",
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data: any) => {
    try {
      await updateMutation.mutateAsync({ data });
      toast({ title: "PROFILE UPDATED", description: "Identity parameters saved." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "ERROR", description: error.message });
    }
  };

  if (isLoading) return <div className="p-8 text-primary animate-pulse">Loading identity matrix...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="border-b border-border/50 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-primary">SYNDICATE IDENTITY</h1>
          <p className="text-muted-foreground text-sm mt-1">Operative profile information</p>
        </div>
        <div className={`px-3 py-1 border font-bold tracking-widest text-xs ${isAdmin ? 'border-primary text-primary bg-primary/10 shadow-[0_0_10px_rgba(255,0,0,0.2)]' : 'border-accent text-accent bg-accent/10'}`}>
          ROLE: {isAdmin ? 'ADMIN' : 'USER'}
        </div>
      </div>

      <div className="bg-card border border-border corner-brackets p-6 relative overflow-hidden">
        {/* Decorative background logo/text */}
        <div className="absolute right-[-10%] top-[-10%] text-[200px] opacity-[0.02] pointer-events-none select-none">
          👤
        </div>

        {isAdmin ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 relative z-10">
            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase block mb-2">CREATOR (MR.BLACK_A_N_O)</label>
              <input 
                {...register("creatorName")}
                className="w-full bg-input/50 border border-border p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                data-testid="input-profile-creator"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase block mb-2">BIO / TAGLINE</label>
              <textarea 
                {...register("bio")}
                rows={3}
                className="w-full bg-input/50 border border-border p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground tracking-widest uppercase block mb-2">CONTACT INFO</label>
                <input 
                  {...register("contactInfo")}
                  className="w-full bg-input/50 border border-border p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground tracking-widest uppercase block mb-2">SOCIAL LINKS</label>
                <input 
                  {...register("socialLinks")}
                  className="w-full bg-input/50 border border-border p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase block mb-2">PHOTO URL</label>
              <input 
                {...register("photoUrl")}
                className="w-full bg-input/50 border border-border p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="pt-4 border-t border-border/50">
              <button 
                type="submit"
                disabled={updateMutation.isPending}
                className="bg-primary/20 border border-primary text-primary hover:bg-primary hover:text-primary-foreground p-3 px-8 font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                data-testid="button-save-profile"
              >
                {updateMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                SAVE IDENTITY
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-6 mb-8 border-b border-border/30 pb-6">
              <div className="w-24 h-24 bg-black border border-accent/50 flex items-center justify-center overflow-hidden corner-brackets">
                {profile?.photoUrl ? (
                  <img src={profile.photoUrl} alt="Avatar" className="w-full h-full object-cover opacity-80 mix-blend-luminosity grayscale" />
                ) : (
                  <span className="text-4xl">👤</span>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-accent tracking-tighter">{profile?.creatorName || "MR.BLACK_A_N_O"}</h2>
                <p className="text-muted-foreground text-sm mt-2 font-mono max-w-md">{profile?.bio || "Commanding the shadows of the market."}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xs text-muted-foreground tracking-widest mb-2 border-b border-border/30 pb-1">COMMUNICATIONS</h3>
                <p className="text-foreground">{profile?.contactInfo || "Classified"}</p>
              </div>
              <div>
                <h3 className="text-xs text-muted-foreground tracking-widest mb-2 border-b border-border/30 pb-1">NETWORK</h3>
                <p className="text-foreground">{profile?.socialLinks || "Classified"}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
