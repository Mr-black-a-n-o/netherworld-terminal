import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGetProfile, useUpdateProfile } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Upload, X, ImagePlus } from "lucide-react";

// ── Social link helpers ─────────────────────────────────────────────────────
interface SocialLinks {
  instagram: string;
  tiktok: string;
  telegram: string;
  whatsapp: string;
}

function parseSocial(raw: string | null | undefined): SocialLinks {
  try {
    if (raw) return { instagram: "", tiktok: "", telegram: "", whatsapp: "", ...JSON.parse(raw) };
  } catch {}
  return { instagram: "", tiktok: "", telegram: "", whatsapp: "" };
}

function serializeSocial(s: SocialLinks): string {
  return JSON.stringify(s);
}

const SOCIAL_META = [
  {
    key: "instagram" as const,
    label: "Instagram",
    icon: "📸",
    placeholder: "@username",
    href: (v: string) => `https://instagram.com/${v.replace("@", "")}`,
    color: "from-pink-500 to-orange-400",
    borderColor: "border-pink-500/40",
    textColor: "text-pink-400",
  },
  {
    key: "tiktok" as const,
    label: "TikTok",
    icon: "🎵",
    placeholder: "@username",
    href: (v: string) => `https://tiktok.com/@${v.replace("@", "")}`,
    color: "from-cyan-400 to-black",
    borderColor: "border-cyan-500/40",
    textColor: "text-cyan-400",
  },
  {
    key: "telegram" as const,
    label: "Telegram",
    icon: "✈️",
    placeholder: "@username or link",
    href: (v: string) => `https://t.me/${v.replace("@", "")}`,
    color: "from-blue-400 to-blue-600",
    borderColor: "border-blue-500/40",
    textColor: "text-blue-400",
  },
  {
    key: "whatsapp" as const,
    label: "WhatsApp",
    icon: "💬",
    placeholder: "+60123456789",
    href: (v: string) => `https://wa.me/${v.replace(/[^0-9]/g, "")}`,
    color: "from-green-400 to-green-600",
    borderColor: "border-green-500/40",
    textColor: "text-green-400",
  },
];

// ── Photo upload component ──────────────────────────────────────────────────
function PhotoUpload({ current, onChange }: { current: string; onChange: (b64: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(current);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setPreview(current); }, [current]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5 MB"); return; }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setPreview(b64);
      onChange(b64);
      setLoading(false);
    };
    reader.onerror = () => setLoading(false);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clear = () => { setPreview(""); onChange(""); };

  return (
    <div className="flex items-start gap-5">
      <div className="relative flex-shrink-0 w-28 h-28 border border-accent/40 bg-black/60 overflow-hidden corner-brackets flex items-center justify-center"
        style={{ boxShadow: "0 0 20px rgba(147,51,234,0.2)" }}>
        {loading ? <Loader2 size={24} className="animate-spin text-primary" /> :
          preview ? (
            <>
              <img src={preview} alt="Profile" className="w-full h-full object-cover" />
              <button type="button" onClick={clear}
                className="absolute top-1 right-1 bg-black/80 text-red-500 hover:text-white p-0.5 transition-colors">
                <X size={12} />
              </button>
            </>
          ) : <ImagePlus size={28} className="text-muted-foreground" />
        }
      </div>
      <div className="flex flex-col gap-2 flex-1 pt-1">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-3 bg-accent/10 border border-accent text-accent hover:bg-accent hover:text-black font-bold tracking-widest uppercase text-xs transition-all justify-center"
          style={{ boxShadow: "0 0 10px rgba(147,51,234,0.25)" }}>
          <Upload size={14} />
          {preview ? "CHANGE PHOTO" : "UPLOAD PHOTO"}
        </button>
        <p className="text-[10px] text-muted-foreground tracking-wide leading-relaxed">
          JPG, PNG, GIF, WebP — max 5 MB<br />
          Stored as base64 in database
        </p>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { data: profile, isLoading } = useGetProfile();
  const updateMutation = useUpdateProfile();

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { creatorName: "", bio: "", contactInfo: "", photoUrl: "" }
  });

  const [social, setSocial] = useState<SocialLinks>({ instagram: "", tiktok: "", telegram: "", whatsapp: "" });
  const photoUrl = watch("photoUrl");

  useEffect(() => {
    if (profile) {
      reset({
        creatorName: profile.creatorName || "",
        bio: profile.bio || "",
        contactInfo: profile.contactInfo || "",
        photoUrl: profile.photoUrl || "",
      });
      setSocial(parseSocial(profile.socialLinks));
    }
  }, [profile, reset]);

  const onSubmit = async (data: any) => {
    try {
      await updateMutation.mutateAsync({
        data: { ...data, socialLinks: serializeSocial(social) }
      });
      toast({ title: "PROFILE UPDATED", description: "Identity parameters saved." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "ERROR", description: error.message });
    }
  };

  if (isLoading) return <div className="p-8 text-primary animate-pulse">Loading identity matrix...</div>;

  // ── Parsed social for user view
  const userSocial = parseSocial(profile?.socialLinks);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-border/50 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-primary">SYNDICATE IDENTITY</h1>
          <p className="text-muted-foreground text-sm mt-1">Operative profile information</p>
        </div>
        <div className={`px-3 py-1 border font-bold tracking-widest text-xs ${isAdmin
          ? "border-primary text-primary bg-primary/10 shadow-[0_0_10px_rgba(255,0,0,0.2)]"
          : "border-accent text-accent bg-accent/10"}`}>
          ROLE: {isAdmin ? "ADMIN" : "USER"}
        </div>
      </div>

      {isAdmin ? (
        /* ─── ADMIN EDIT FORM ─── */
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Photo upload card */}
          <div className="bg-card border border-accent/30 p-5 relative overflow-hidden"
            style={{ boxShadow: "0 0 25px rgba(147,51,234,0.1), inset 0 0 25px rgba(147,51,234,0.03)" }}>
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
            <label className="text-xs text-muted-foreground tracking-widest uppercase block mb-4">PROFILE PHOTO</label>
            <PhotoUpload current={photoUrl} onChange={b64 => setValue("photoUrl", b64, { shouldDirty: true })} />
          </div>

          {/* Identity card */}
          <div className="bg-card border border-border p-5 space-y-4 relative overflow-hidden"
            style={{ boxShadow: "0 0 20px rgba(255,0,0,0.05)" }}>
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-30" />

            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase block mb-2">CREATOR NAME</label>
              <input {...register("creatorName")}
                className="w-full bg-input/50 border border-border p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase block mb-2">BIO / TAGLINE</label>
              <textarea {...register("bio")} rows={3}
                className="w-full bg-input/50 border border-border p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground tracking-widest uppercase block mb-2">CONTACT INFO</label>
              <input {...register("contactInfo")}
                className="w-full bg-input/50 border border-border p-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          {/* Social links card */}
          <div className="bg-card border border-border p-5 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-30" />
            <label className="text-xs text-muted-foreground tracking-widest uppercase block">SOCIAL LINKS</label>

            {SOCIAL_META.map(meta => (
              <div key={meta.key} className={`flex items-center gap-3 border ${meta.borderColor} bg-black/40 p-3`}>
                <span className="text-xl flex-shrink-0">{meta.icon}</span>
                <div className="flex-1">
                  <div className={`text-[10px] ${meta.textColor} tracking-widest uppercase mb-1`}>{meta.label}</div>
                  <input
                    value={social[meta.key]}
                    onChange={e => setSocial(s => ({ ...s, [meta.key]: e.target.value }))}
                    placeholder={meta.placeholder}
                    className="w-full bg-transparent border-none text-foreground focus:outline-none text-sm placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>
            ))}
          </div>

          <button type="submit" disabled={updateMutation.isPending}
            className="bg-primary/20 border border-primary text-primary hover:bg-primary hover:text-primary-foreground p-3 px-8 font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            style={{ boxShadow: "0 0 12px rgba(255,0,0,0.2)" }}>
            {updateMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            SAVE IDENTITY
          </button>
        </form>
      ) : (
        /* ─── USER READ VIEW ─── */
        <div className="space-y-5">
          {/* Avatar + name card */}
          <div className="bg-card border border-border p-6 relative overflow-hidden"
            style={{ boxShadow: "0 0 30px rgba(147,51,234,0.08), 0 0 60px rgba(255,0,0,0.03)" }}>
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-br from-accent/3 via-transparent to-primary/3 pointer-events-none" />

            <div className="flex items-center gap-6 relative z-10">
              <div className="w-24 h-24 flex-shrink-0 border border-accent/50 overflow-hidden corner-brackets relative"
                style={{ boxShadow: "0 0 20px rgba(147,51,234,0.3)" }}>
                {profile?.photoUrl ? (
                  <img src={profile.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-black/60 flex items-center justify-center">
                    <span className="text-4xl">👤</span>
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-accent tracking-tighter"
                  style={{ textShadow: "0 0 20px rgba(147,51,234,0.5)" }}>
                  {profile?.creatorName || "MR.BLACK_A_N_O"}
                </h2>
                <p className="text-muted-foreground text-sm mt-2 font-mono max-w-sm leading-relaxed">
                  {profile?.bio || "Commanding the shadows of the market."}
                </p>
                {profile?.contactInfo && (
                  <p className="text-xs text-muted-foreground/60 mt-2">{profile.contactInfo}</p>
                )}
              </div>
            </div>
          </div>

          {/* Social links card */}
          {Object.values(userSocial).some(v => v) && (
            <div className="bg-card border border-border p-5 space-y-3 relative overflow-hidden"
              style={{ boxShadow: "0 0 20px rgba(0,0,0,0.4)" }}>
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-30" />
              <h3 className="text-xs text-muted-foreground tracking-widest uppercase">CONNECT</h3>

              <div className="grid grid-cols-2 gap-3">
                {SOCIAL_META.map(meta => {
                  const val = userSocial[meta.key];
                  if (!val) return null;
                  return (
                    <a key={meta.key} href={meta.href(val)} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-3 border ${meta.borderColor} bg-black/50 p-3 hover:bg-black/70 transition-all group`}
                      style={{ boxShadow: `0 0 8px rgba(0,0,0,0.4)` }}>
                      <span className="text-xl">{meta.icon}</span>
                      <div className="min-w-0">
                        <div className={`text-[10px] ${meta.textColor} tracking-widest uppercase`}>{meta.label}</div>
                        <div className="text-xs text-foreground truncate group-hover:text-white transition-colors">{val}</div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
