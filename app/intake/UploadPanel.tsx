"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type IntakeFileRow = {
  id: string;
  intake_files: string;
  user_id: string;
  bucket: string;
  path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export default function UploadPanel({
  intakeSubmissionId,
  disabled,
  tag,
  title,
  helpText,
}: {
  intakeSubmissionId: string | null;
  disabled?: boolean;
  tag: "id" | "income" | "deductions" | "credits" | "general";
  title: string;
  helpText?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<IntakeFileRow[]>([]);
  const bucket = "client_uploads";

  const canUpload = !!intakeSubmissionId && !disabled && !busy;

  async function refresh() {
    if (!intakeSubmissionId) return;
    setError(null);

    const { data, error } = await supabase
      .from("storage_path")
      .select("*")
      .eq("intake_files", intakeSubmissionId)
      .order("created_at", { ascending: false });

    if (error) return setError(error.message);

    const all = (data || []) as IntakeFileRow[];
    const filtered = all.filter((f) => f.path.includes(`/${tag}/`));
    setFiles(filtered);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeSubmissionId, tag]);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files;
    if (!picked || picked.length === 0) return;

    if (!intakeSubmissionId) {
      setError("Create/save a draft first to enable uploads.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw new Error(sessErr.message);
      if (!sessionData.session) throw new Error("Not signed in.");

      const userId = sessionData.session.user.id;

      for (const file of Array.from(picked)) {
        const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${userId}/${intakeSubmissionId}/${tag}/${Date.now()}_${safe}`;

        const up = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });

        if (up.error) throw new Error(up.error.message);

        const { error: insErr } = await supabase.from("storage_path").insert({
          intake_files: intakeSubmissionId,
          user_id: userId,
          bucket,
          path,
          original_name: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
        });

        if (insErr) throw new Error(insErr.message);
      }

      await refresh();
      e.target.value = "";
    } catch (err: any) {
      setError(err?.message ?? "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(f: IntakeFileRow) {
    if (!intakeSubmissionId) return;
    setBusy(true);
    setError(null);

    try {
      const delStorage = await supabase.storage.from(f.bucket).remove([f.path]);
      if (delStorage.error) throw new Error(delStorage.error.message);

      const delRow = await supabase.from("storage_path").delete().eq("id", f.id);
      if (delRow.error) throw new Error(delRow.error.message);

      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {helpText && <p className="text-xs text-gray-600 mt-1">{helpText}</p>}
        </div>
        {busy && <span className="text-xs text-gray-600">Working…</span>}
      </div>

      {error && <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <div className="mt-3">
        <input
          type="file"
          multiple
          onChange={handlePick}
          disabled={!canUpload}
          className="underline disabled:opacity-50"
        />
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-gray-700">Files for this step</div>
        {files.length === 0 ? (
          <div className="text-sm text-gray-600 mt-2">No files uploaded yet.</div>
        ) : (
          <ul className="mt-2 space-y-2">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded border p-2">
                <div className="min-w-0">
                  <div className="truncate text-sm">{f.original_name}</div>
                  <div className="text-xs text-gray-500">{Math.round(f.size_bytes / 1024)} KB</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(f)}
                  disabled={disabled || busy || !intakeSubmissionId}
                  className="text-sm underline disabled:opacity-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
