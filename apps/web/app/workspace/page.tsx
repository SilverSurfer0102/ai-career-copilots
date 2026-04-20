"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkspacePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/applications");
  }, [router]);
  return <p className="text-sm text-muted-foreground p-4">Weiterleitung…</p>;
}
