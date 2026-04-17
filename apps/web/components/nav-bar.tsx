"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
  { href: "/jobs", label: "Jobs" },
  { href: "/workspace", label: "Workspace" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="container mx-auto px-4 max-w-6xl flex items-center gap-6 h-14">
        <Link href="/" className="font-bold text-lg tracking-tight text-indigo-700">
          AI Career Copilot
        </Link>
        <div className="flex gap-4">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition-colors ${
                pathname === l.href
                  ? "text-indigo-700 border-b-2 border-indigo-700 pb-[2px]"
                  : "text-gray-600 hover:text-gray-900"
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
