"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function LegalPage() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("site_legal")
      .select("impressum")
      .eq("id", "main")
      .maybeSingle()
      .then(({ data }) => setText((data as any)?.impressum ?? ""));
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 text-black overflow-x-hidden">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <a href="/" className="text-blue-700 underline text-sm">← Zurück zur App</a>
        <div className="bg-white border rounded p-6 mt-4">
          <h1 className="text-2xl font-bold mb-4">Impressum</h1>
          {text === null ? (
            <p className="text-gray-400">Lädt …</p>
          ) : text.trim() === "" ? (
            <p className="text-gray-500">Noch kein Impressum hinterlegt.</p>
          ) : (
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</div>
          )}
        </div>
      </div>
    </main>
  );
}
