"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/swipe", label: "Stellen-Feed" },
  { href: "/applications", label: "Bewerbungen" },
  { href: "/profile", label: "Profil" },
  { href: "/pool-cv", label: "Pool-CV" },
  { href: "/jobs", label: "Jobs" },
];

export function NavBar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/applications"
      ? pathname === href || pathname.startsWith("/applications")
      : pathname.startsWith(href);

  return (
    <nav className="border-b bg-secondary shadow-sm">
      <div className="container mx-auto px-4 max-w-6xl flex items-center gap-8 h-14">
        <Link href="/applications" className="font-serif font-semibold text-xl tracking-tight text-foreground">
          Career Copilot
        </Link>
        <div className="flex gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive(l.href)
                  ? "bg-primary/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
