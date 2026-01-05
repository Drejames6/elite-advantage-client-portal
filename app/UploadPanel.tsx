"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  intakeSubmissionId: string;
  category: "id" | "income" | "deductions" | "credits";
  disabled?: boolean;
  title: string;
  helpText?: string;
};

type FileRow = {
  id: string;
  original_name: string;
  storage_path: string;
  created_at: string;
};

export default function UploadPanel({
  intakeSubmissionId,
  category,
  disabled,
  title,
  helpText,
}: Props) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const { data, error } = await supabase
      .from("storage_path")
      .select("id, original_name, storage_path, created_at")
      .eq("intake_files", intakeSubmissionId)
      .eq("category", category)
      .order("created_at", { ascending: false });

    if (error) {
      setErr(error.message);
      return;
    }
    setRows((data || []) as FileRow[]);
  }

  useEffect(() => {
    if (intakeSubmissionId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeSubmissionId, category]);

  async function onUpload() {
    if (disabled) return;
    if (!selectedFiles.length) return;

    setUploading(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setErr("Not signed in.");
      setUploading(false);
      return;
    }

    for (const f of selectedFiles) {
      const path = `${user.id}/${intakeSubmissionId}/${category}/${Date.now()}-${f.name}`;

      const up = await supabase.storage
        .from("client_uploads")
        .upload(path, f, { contentType: f.type });

      if (up.error) {
        setErr(up.error.message);
        setUploading(false);
        return;
      }

      const ins = await supabase.from("storage_path").insert({
        intake_files: intakeSubmissionId,
        user_id: user.id,
        category,
        original_name: f.name,
        storage_path: path,
        mime_type: f.type,
        size_bytes: f.size,
      });

      if (ins.error) {
        setErr(ins.error.message);
        setUploading(false);
        return;
      }
    }

    setSelectedFiles([]);
    await load();
    setUploading(false);
  }

  async function onDelete(id: string, storage_path: string) {
    if (disabled) return;

    setErr(null);
    const delStorage = await supabase.storage
      .from("client_uploads")
      .remove([storage_path]);

    if (delStorage.error) {
      setErr(delStorage.error.message);
      return;
    }

    const delRow = await supabase.from("storage_path").delete().eq("id", id);
    if (delRow.error) {
      setErr(delRow.error.message);
      return;
    }

    await load();
  }

  return (
    <div className="rounded border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {helpText ? <p className="text-xs text-gray-600">{helpText}</p> : null}
        </div>
      </div>

      {err ? (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {err}
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        <input
          type="file"
          multiple
          disabled={disabled || uploading}
          onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
        />
        <button
          type="button"
          onClick={onUpload}
          disabled={disabled || uploading || selectedFiles.length === 0}
          className="rounded bg-teal-700 px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-gray-500">No files uploaded yet.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded border p-2">
              <div className="text-xs">
                <div className="font-medium">{r.original_name}</div>
                <div className="text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(r.id, r.storage_path)}
                disabled={disabled}
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
