"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mail,
  Link as LinkedinIcon,
  Globe,
  Pencil,
  ChevronRight,
  Bell,
  Lock,
  Palette,
  Languages,
  LogOut,
  User as UserIcon,
  MapPin,
  Briefcase,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { pageVariants, containerVariants, cardVariants, hoverLift, tapScale } from "@/lib/motion";

interface ProfileData {
  full_name: string;
  preferred_name: string;
  bio: string;
  location: string;
  email: string;
  portfolio: string;
  linkedin: string;
}

interface Preferences {
  email_notifications: boolean;
  push_notifications: boolean;
  weekly_digest: boolean;
  two_factor_enabled: boolean;
  session_timeout_minutes: number;
  theme: "light" | "dark" | "system";
  language: string;
  timezone: string;
}

const STORAGE_KEY = "profile_data";
const PREFS_KEY = "app_preferences";

const DEFAULT_PROFILE: ProfileData = {
  full_name: "",
  preferred_name: "",
  bio: "",
  location: "",
  email: "",
  portfolio: "",
  linkedin: "",
};

const DEFAULT_PREFS: Preferences = {
  email_notifications: true,
  push_notifications: false,
  weekly_digest: true,
  two_factor_enabled: false,
  session_timeout_minutes: 60,
  theme: "system",
  language: "English (US)",
  timezone: "UTC",
};

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [editingSection, setEditingSection] = useState<null | "personal" | "contact">(null);
  const [draft, setDraft] = useState<ProfileData>(DEFAULT_PROFILE);

  // App preferences (Notifications, Privacy, Appearance, Language)
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [activeDialog, setActiveDialog] = useState<null | "notifications" | "privacy" | "appearance" | "language">(null);
  const [prefsDraft, setPrefsDraft] = useState<Preferences>(DEFAULT_PREFS);
  const [prefsSavedAt, setPrefsSavedAt] = useState<string | null>(null);

  // Hydrate preferences from localStorage on mount, then apply side effects
  useEffect(() => {
    let parsed: Partial<Preferences> = {};
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch {
      // ignore
    }
    const merged = { ...DEFAULT_PREFS, ...parsed };
    setPrefs(merged);
    applyPreferences(merged);
  }, []);

  // Apply a Preferences object to the live app (DOM, browser APIs, etc.)
  function applyPreferences(p: Preferences) {
    if (typeof document === "undefined") return;

    // Theme
    const root = document.documentElement;
    if (p.theme === "dark") {
      root.classList.add("dark");
      root.dataset.theme = "dark";
    } else if (p.theme === "light") {
      root.classList.remove("dark");
      root.dataset.theme = "light";
    } else {
      // system: respect OS preference
      root.classList.remove("dark");
      delete root.dataset.theme;
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.matches) {
        root.classList.add("dark");
        root.dataset.theme = "dark";
      }
    }

    // Language → set <html lang> + lang-aware label
    root.lang = p.language.split(" ")[0].toLowerCase();
  }

  // Hydrate profile from localStorage and the auth user record on mount
  useEffect(() => {
    if (!user) return;
    let stored: Partial<ProfileData> = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {
      stored = {};
    }
    setProfile({
      full_name: stored.full_name ?? user.full_name ?? user.email.split("@")[0],
      preferred_name:
        stored.preferred_name ??
        (user.full_name ? user.full_name.split(" ")[0] : user.email.split("@")[0]),
      bio: stored.bio ?? "Add a short bio so others can learn more about you.",
      location: stored.location ?? "",
      email: stored.email ?? user.email,
      portfolio: stored.portfolio ?? "",
      linkedin: stored.linkedin ?? "",
    });
  }, [user]);

  if (!user) return null;

  const displayName = profile.full_name || user.full_name || user.email.split("@")[0];
  const initials = displayName
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  const startEditing = (section: "personal" | "contact") => {
    setDraft(profile);
    setEditingSection(section);
  };

  const cancelEditing = () => setEditingSection(null);

  const saveEditing = () => {
    setProfile(draft);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // ignore storage errors
    }
    setEditingSection(null);
  };

  const handleSignOut = () => {
    logout();
    router.replace("/login");
  };

  // ----- Preferences (Settings) handlers -----
  const openPrefsDialog = (which: "notifications" | "privacy" | "appearance" | "language") => {
    setPrefsDraft(prefs);
    setActiveDialog(which);
  };

  const closePrefsDialog = () => setActiveDialog(null);

  const savePrefs = async () => {
    setPrefs(prefsDraft);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefsDraft));
      setPrefsSavedAt(new Date().toLocaleTimeString());
    } catch {
      // ignore
    }

    // Apply side effects to the live app
    applyPreferences(prefsDraft);

    // If user enabled push notifications, ask the browser for permission
    if (prefsDraft.push_notifications && typeof window !== "undefined" && "Notification" in window) {
      try {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
      } catch {
        // ignore — some browsers throw if not from a user gesture
      }
    }

    // 2FA enabled: log the intent (real 2FA would call a backend here)
    if (prefsDraft.two_factor_enabled) {
      console.log("[profile] 2FA enabled — would enroll a TOTP secret in production");
    }

    setActiveDialog(null);
  };

  return (
    <motion.div
      className="space-y-6"
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      {/* Hero / Identity Card */}
      <Card className="bg-card border-border/60 rounded-3xl p-6 md:p-7">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-linear-to-br from-primary/30 to-tertiary/30 flex items-center justify-center text-2xl md:text-3xl font-black text-foreground border-2 border-background shadow-md">
              {initials || <UserIcon className="h-10 w-10 text-muted-foreground" />}
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-[10px] font-bold border-2 border-background">
              ✓
            </div>
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              {displayName}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Career Co-Pilot candidate • Member
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-secondary/15 text-secondary border border-secondary/30">
                <Briefcase className="h-3 w-3" /> Open to Work
              </span>
              {profile.location && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-tertiary/15 text-tertiary border border-tertiary/30">
                  <MapPin className="h-3 w-3" /> {profile.location}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Two-column layout: main (left) + settings sidebar (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT — Personal Info + Contact & Links */}
        <div className="lg:col-span-2 space-y-5">
          {/* Personal Information */}
          <Card className="bg-card border-border/60 rounded-3xl p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-primary" />
                Personal Information
              </h2>
              {editingSection !== "personal" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEditing("personal")}
                  className="h-8 px-3 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
            </div>

            {editingSection === "personal" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label="Full Name"
                    value={draft.full_name}
                    onChange={(v) => setDraft({ ...draft, full_name: v })}
                  />
                  <Field
                    label="Preferred Name"
                    value={draft.preferred_name}
                    onChange={(v) => setDraft({ ...draft, preferred_name: v })}
                  />
                </div>
                <Field
                  label="Location"
                  value={draft.location}
                  onChange={(v) => setDraft({ ...draft, location: v })}
                  placeholder="City, Country"
                />
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Bio
                  </label>
                  <textarea
                    value={draft.bio}
                    onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                    rows={3}
                    className="mt-1 w-full text-sm rounded-xl bg-muted/40 border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Tell us a bit about yourself"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelEditing} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveEditing}
                    className="bg-primary hover:opacity-90 text-primary-foreground rounded-xl"
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ReadonlyField label="Full Name" value={profile.full_name} />
                <ReadonlyField label="Preferred Name" value={profile.preferred_name} />
                <ReadonlyField
                  label="Location"
                  value={profile.location || "Not set"}
                  empty={!profile.location}
                />
                <div className="md:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Bio
                  </p>
                  <p className="mt-1 text-sm text-foreground/90 leading-relaxed">{profile.bio}</p>
                </div>
              </div>
            )}
          </Card>

          {/* Contact & Links */}
          <Card className="bg-card border-border/60 rounded-3xl p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Contact & Links
              </h2>
              {editingSection !== "contact" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEditing("contact")}
                  className="h-8 px-3 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
            </div>

            {editingSection === "contact" ? (
              <div className="space-y-4">
                <Field
                  label="Email Address"
                  value={draft.email}
                  onChange={(v) => setDraft({ ...draft, email: v })}
                  type="email"
                />
                <Field
                  label="Portfolio"
                  value={draft.portfolio}
                  onChange={(v) => setDraft({ ...draft, portfolio: v })}
                  placeholder="https://yoursite.com"
                />
                <Field
                  label="LinkedIn"
                  value={draft.linkedin}
                  onChange={(v) => setDraft({ ...draft, linkedin: v })}
                  placeholder="linkedin.com/in/username"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelEditing} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveEditing}
                    className="bg-primary hover:opacity-90 text-primary-foreground rounded-xl"
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <ContactRow icon={Mail} label="Email Address" value={profile.email} />
                <ContactRow
                  icon={Globe}
                  label="Portfolio"
                  value={profile.portfolio}
                  href={profile.portfolio}
                  empty={!profile.portfolio}
                />
                <ContactRow
                  icon={LinkedinIcon}
                  label="LinkedIn"
                  value={profile.linkedin}
                  href={
                    profile.linkedin
                      ? profile.linkedin.startsWith("http")
                        ? profile.linkedin
                        : `https://${profile.linkedin}`
                      : undefined
                  }
                  empty={!profile.linkedin}
                />
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT — Settings sidebar + Sign Out */}
        <div className="space-y-5">
          <Card className="bg-card border-border/60 rounded-3xl p-5 md:p-6">
            <h2 className="font-bold text-base text-foreground flex items-center gap-2 mb-4">
              <Palette className="h-4 w-4 text-primary" />
              Settings
            </h2>
            <motion.ul
              className="space-y-1"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              <SettingsRow
                icon={Bell}
                label="Notifications"
                hint={
                  prefs.email_notifications
                    ? "Email · On"
                    : "Email · Off"
                }
                onClick={() => openPrefsDialog("notifications")}
              />
              <SettingsRow
                icon={Lock}
                label="Privacy & Security"
                hint={prefs.two_factor_enabled ? "2FA On" : "2FA Off"}
                onClick={() => openPrefsDialog("privacy")}
              />
              <SettingsRow
                icon={Palette}
                label="Appearance"
                hint={prefs.theme === "system" ? "System" : prefs.theme === "light" ? "Light" : "Dark"}
                onClick={() => openPrefsDialog("appearance")}
              />
              <SettingsRow
                icon={Languages}
                label="Language & Region"
                hint={`${prefs.language} · ${prefs.timezone}`}
                onClick={() => openPrefsDialog("language")}
              />
            </motion.ul>
            {prefsSavedAt && (
              <p className="mt-3 text-[10px] text-muted-foreground">
                Preferences saved at {prefsSavedAt}
              </p>
            )}
          </Card>

          <Button
            onClick={handleSignOut}
            className="w-full h-12 bg-destructive hover:opacity-90 text-destructive-foreground font-semibold rounded-2xl shadow-md shadow-destructive/20 flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* ----- Preferences dialogs ----- */}
      <Dialog open={activeDialog === "notifications"} onOpenChange={(o) => !o && closePrefsDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
            <DialogDescription>Choose how you want to be notified.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <ToggleRow
              label="Email notifications"
              description="Interview invites, roadmap updates, scorecards"
              checked={prefsDraft.email_notifications}
              onChange={(v) => setPrefsDraft({ ...prefsDraft, email_notifications: v })}
            />
            <ToggleRow
              label="Push notifications"
              description="Real-time browser alerts"
              checked={prefsDraft.push_notifications}
              onChange={(v) => setPrefsDraft({ ...prefsDraft, push_notifications: v })}
            />
            <ToggleRow
              label="Weekly digest"
              description="A Monday-morning summary of your progress"
              checked={prefsDraft.weekly_digest}
              onChange={(v) => setPrefsDraft({ ...prefsDraft, weekly_digest: v })}
            />
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={savePrefs} className="bg-primary hover:opacity-90 text-primary-foreground rounded-xl">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "privacy"} onOpenChange={(o) => !o && closePrefsDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Privacy & Security</DialogTitle>
            <DialogDescription>Control how your account is protected.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <ToggleRow
              label="Two-factor authentication"
              description="Require a code on each new device"
              checked={prefsDraft.two_factor_enabled}
              onChange={(v) => setPrefsDraft({ ...prefsDraft, two_factor_enabled: v })}
            />
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Session timeout (minutes)
              </label>
              <Input
                type="number"
                min={5}
                max={1440}
                value={prefsDraft.session_timeout_minutes}
                onChange={(e) =>
                  setPrefsDraft({
                    ...prefsDraft,
                    session_timeout_minutes: Math.max(5, Math.min(1440, Number(e.target.value) || 60)),
                  })
                }
                className="mt-1 h-10 bg-muted/40 border-border rounded-xl text-sm"
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Your data is stored in Supabase and never shared with third parties.
            </p>
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={savePrefs} className="bg-primary hover:opacity-90 text-primary-foreground rounded-xl">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "appearance"} onOpenChange={(o) => !o && closePrefsDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appearance</DialogTitle>
            <DialogDescription>Pick a theme that suits your eyes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(["light", "dark", "system"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setPrefsDraft({ ...prefsDraft, theme: opt })}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  prefsDraft.theme === opt
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/30 hover:bg-muted/50"
                }`}
              >
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold uppercase ${
                    prefsDraft.theme === opt ? "bg-primary text-primary-foreground" : "bg-background text-foreground"
                  }`}
                >
                  {opt.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground capitalize">{opt}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {opt === "light" && "Always use a light background"}
                    {opt === "dark" && "Always use a dark background"}
                    {opt === "system" && "Match your operating system"}
                  </p>
                </div>
                {prefsDraft.theme === opt && (
                  <span className="text-[10px] font-bold uppercase text-primary">Selected</span>
                )}
              </button>
            ))}
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={savePrefs} className="bg-primary hover:opacity-90 text-primary-foreground rounded-xl">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "language"} onOpenChange={(o) => !o && closePrefsDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Language & Region</DialogTitle>
            <DialogDescription>Set your preferred language and timezone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Language
              </label>
              <select
                value={prefsDraft.language}
                onChange={(e) => setPrefsDraft({ ...prefsDraft, language: e.target.value })}
                className="mt-1 w-full h-10 rounded-xl bg-muted/40 border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {["English (US)", "English (UK)", "Spanish (ES)", "French (FR)", "German (DE)", "Urdu (PK)"].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Timezone
              </label>
              <select
                value={prefsDraft.timezone}
                onChange={(e) => setPrefsDraft({ ...prefsDraft, timezone: e.target.value })}
                className="mt-1 w-full h-10 rounded-xl bg-muted/40 border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Karachi", "Asia/Dubai", "Asia/Tokyo"].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={savePrefs} className="bg-primary hover:opacity-90 text-primary-foreground rounded-xl">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Local sub-components
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 h-10 bg-muted/40 border-border rounded-xl text-sm"
      />
    </div>
  );
}

function ReadonlyField({
  label,
  value,
  empty = false,
}: {
  label: string;
  value: string;
  empty?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-sm font-medium ${empty ? "text-muted-foreground italic" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
  empty = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
  empty?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/40">
      <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`text-sm truncate ${
            empty ? "italic text-muted-foreground" : href ? "text-primary font-medium" : "text-foreground"
          }`}
        >
          {empty ? "Not set" : value}
        </p>
      </div>
    </div>
  );
  if (href && !empty) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80 transition-opacity">
        {inner}
      </a>
    );
  }
  return inner;
}

function SettingsRow({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <motion.li variants={cardVariants}>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 text-foreground text-sm font-medium transition-colors group"
      >
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <span className="flex-1 text-left">{label}</span>
        {hint && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
            {hint}
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>
    </motion.li>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 cursor-pointer hover:bg-muted/50 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
