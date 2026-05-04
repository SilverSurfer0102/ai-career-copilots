"use client";
import { useRef } from "react";
import { api, type Profile } from "@/lib/api";
import { toast } from "sonner";

interface ProfilePickerProps {
  profiles: Profile[];
  selectedId: string | null;
  onSelect: (profileId: string) => void;
  onCreateNew: () => void;
  onPhotoUploaded?: (profileId: string) => void;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ProfilePicker({
  profiles,
  selectedId,
  onSelect,
  onCreateNew,
  onPhotoUploaded,
}: ProfilePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingForRef = useRef<string | null>(null);

  const handlePhotoClick = (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    uploadingForRef.current = profileId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const profileId = uploadingForRef.current;
    if (!file || !profileId) return;
    e.target.value = "";
    try {
      await api.profiles.uploadPhoto(profileId, file);
      toast.success("Profilbild hochgeladen");
      onPhotoUploaded?.(profileId);
    } catch {
      toast.error("Foto-Upload fehlgeschlagen");
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      {profiles.map((profile, i) => {
        const isSelected = profile.id === selectedId;
        const photoUrl = profile.photo_path ? api.profiles.photoUrl(profile.id) : null;

        return (
          <div
            key={profile.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(profile.id)}
            onKeyDown={(e) => e.key === "Enter" && onSelect(profile.id)}
            className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 w-32 transition-all cursor-pointer ${
              isSelected
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted"
            }`}
          >
            {isSelected && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground font-bold">
                ✓
              </span>
            )}

            <div className="relative group">
              {photoUrl ? (
                <img
                  src={`${photoUrl}?t=${profile.updated_at}`}
                  alt={profile.display_name}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-border"
                />
              ) : (
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold ${avatarColor(profile.id)}`}
                >
                  {initials(profile.display_name)}
                </div>
              )}
              <button
                onClick={(e) => handlePhotoClick(e, profile.id)}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium"
                title="Foto ändern"
              >
                📷
              </button>
            </div>

            <span className="text-xs font-medium text-center leading-tight line-clamp-2 w-full">
              {profile.display_name}
            </span>
          </div>
        );
      })}

      <button
        onClick={onCreateNew}
        className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-dashed border-border w-32 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted transition-all cursor-pointer"
      >
        <div className="w-14 h-14 rounded-full border-2 border-dashed border-current flex items-center justify-center text-2xl">
          +
        </div>
        <span className="text-xs font-medium text-center">Neues Profil</span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
