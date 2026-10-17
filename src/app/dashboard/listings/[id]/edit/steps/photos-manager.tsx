"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buttonClass } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { MAX_PHOTOS } from "@/lib/listings/constants";
import { listingImageUrl, thumbPathFor } from "@/lib/listings/images";
import { prepareListingPhoto, UnreadableImageError } from "@/lib/listings/resize-image";

type Photo = { id: string; storage_path: string; display_order: number };
type Upload = { key: string; name: string; state: "processing" | "uploading" | "error"; error?: string };

/**
 * Uploads go straight from the browser to Supabase Storage under
 * <user_id>/<listing_id>/, and rows go into listing_images. Row Level Security
 * on both checks that the listing and the folder belong to the signed-in user.
 */
export function PhotosManager({
  listingId,
  userId,
  initial,
  backHref,
  nextHref,
}: {
  listingId: string;
  userId: string;
  initial: Photo[];
  backHref: string;
  nextHref: string;
}) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const remaining = MAX_PHOTOS - photos.length;
  const bucket = supabase.storage.from("listing-images");

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setMessage(null);
    const list = Array.from(files);
    const accepted = list.slice(0, Math.max(0, remaining));
    if (list.length > accepted.length) {
      setMessage({ kind: "error", text: `Listings can have up to ${MAX_PHOTOS} photos, so only the first ${accepted.length} were added.` });
    }
    setBusy(true);
    let order = photos.reduce((m, p) => Math.max(m, p.display_order), -1) + 1;
    for (const file of accepted) {
      const key = crypto.randomUUID();
      const update = (u: Partial<Upload>) => setUploads((all) => all.map((x) => (x.key === key ? { ...x, ...u } : x)));
      setUploads((all) => [...all, { key, name: file.name, state: "processing" }]);
      try {
        const { full, thumb } = await prepareListingPhoto(file);
        update({ state: "uploading" });
        const path = `${userId}/${listingId}/${crypto.randomUUID()}.${full.ext}`;
        const up = await bucket.upload(path, full.blob, { contentType: full.blob.type, cacheControl: "31536000" });
        if (up.error) throw new Error(up.error.message);
        const upThumb = await bucket.upload(thumbPathFor(path), thumb.blob, { contentType: thumb.blob.type, cacheControl: "31536000" });
        if (upThumb.error) console.warn("Thumbnail upload failed; full image will be used", upThumb.error);

        const { data, error } = await supabase
          .from("listing_images")
          .insert({ listing_id: listingId, storage_path: path, display_order: order })
          .select("id, storage_path, display_order")
          .single();
        if (error || !data) {
          await bucket.remove([path, thumbPathFor(path)]);
          throw new Error(error?.message.includes("too_many_photos") ? `This listing already has ${MAX_PHOTOS} photos.` : "The photo uploaded but couldn't be attached. Try again.");
        }
        order += 1;
        setPhotos((p) => [...p, data]);
        setUploads((all) => all.filter((x) => x.key !== key));
      } catch (e) {
        update({
          state: "error",
          error:
            e instanceof UnreadableImageError
              ? "This file couldn't be read. Use a JPG, PNG, or WebP photo."
              : e instanceof Error
                ? e.message
                : "Upload failed.",
        });
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  async function persistOrder(next: Photo[]) {
    const renumbered = next.map((p, i) => ({ ...p, display_order: i }));
    const changed = renumbered.filter((p) => photos.find((o) => o.id === p.id)?.display_order !== p.display_order);
    setPhotos(renumbered);
    setBusy(true);
    const results = await Promise.all(
      changed.map((p) => supabase.from("listing_images").update({ display_order: p.display_order }).eq("id", p.id)),
    );
    setBusy(false);
    if (results.some((r) => r.error)) {
      setMessage({ kind: "error", text: "The new order didn't save. Refresh and try again." });
    }
    router.refresh();
  }

  const move = (index: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    void persistOrder(next);
  };

  async function remove(photo: Photo) {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.from("listing_images").delete().eq("id", photo.id);
    if (error) {
      setBusy(false);
      setMessage({ kind: "error", text: "That photo couldn't be removed. Try again." });
      return;
    }
    await bucket.remove([photo.storage_path, thumbPathFor(photo.storage_path)]);
    const next = photos.filter((p) => p.id !== photo.id);
    setBusy(false);
    await persistOrder(next);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border-2 border-dashed border-line bg-paper p-6 text-center">
        <p className="font-semibold text-ink">
          {photos.length === 0 ? "Add photos of the place" : `${photos.length} of ${MAX_PHOTOS} photos`}
        </p>
        <p className="mt-1 text-sm text-granite">
          The first photo is the cover. Bright, wide shots of each room work best. At least one is required to publish.
        </p>
        <input
          ref={input}
          id="photo-input"
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={busy || remaining <= 0}
          onChange={(e) => void addFiles(e.target.files)}
        />
        <label
          htmlFor="photo-input"
          aria-disabled={busy || remaining <= 0}
          className={buttonClass({ className: "mt-4 cursor-pointer aria-disabled:cursor-not-allowed aria-disabled:opacity-60" })}
        >
          {remaining <= 0 ? "Photo limit reached" : busy ? "Working…" : "Choose photos"}
        </label>
      </div>

      {message && <FormMessage status={message.kind}>{message.text}</FormMessage>}

      {uploads.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {uploads.map((u) => (
            <li key={u.key} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm">
              <span className="truncate text-ink">{u.name}</span>
              {u.state === "error" ? (
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-medium text-danger">{u.error}</span>
                  <button type="button" className="text-granite underline" onClick={() => setUploads((all) => all.filter((x) => x.key !== u.key))}>
                    Dismiss
                  </button>
                </span>
              ) : (
                <span className="shrink-0 text-granite">{u.state === "processing" ? "Preparing…" : "Uploading…"}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {photos.length > 0 && (
        <ol className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          {photos.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-lg border border-line bg-paper">
              <div className="relative aspect-[4/3] bg-pine-wash">
                {/* eslint-disable-next-line @next/next/no-img-element -- Supabase public URL; thumbnails are pre-sized */}
                <img
                  src={listingImageUrl(thumbPathFor(p.storage_path))}
                  onError={(e) => {
                    const full = listingImageUrl(p.storage_path);
                    if (e.currentTarget.src !== full) e.currentTarget.src = full;
                  }}
                  alt={`Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {i === 0 && (
                  <span className="absolute top-2 left-2 rounded-full bg-paper/95 px-2 py-0.5 text-xs font-semibold text-ink">Cover</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                <div className="flex gap-1">
                  <IconButton label={`Move photo ${i + 1} earlier`} disabled={busy || i === 0} onClick={() => move(i, i - 1)}>
                    ←
                  </IconButton>
                  <IconButton label={`Move photo ${i + 1} later`} disabled={busy || i === photos.length - 1} onClick={() => move(i, i + 1)}>
                    →
                  </IconButton>
                </div>
                <div className="flex gap-1">
                  {i > 0 && (
                    <button type="button" disabled={busy} onClick={() => move(i, 0)} className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold text-pine hover:bg-pine-wash disabled:opacity-50">
                      Make cover
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(p)}
                    className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold text-danger hover:bg-danger-wash disabled:opacity-50"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
        <Link href={backHref} className={buttonClass({ variant: "ghost" })}>
          Back
        </Link>
        <Link href={nextHref} aria-disabled={busy} className={buttonClass({ className: busy ? "pointer-events-none opacity-60" : "" })}>
          Continue to review
        </Link>
      </div>
    </div>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md text-ink hover:bg-pine-wash disabled:opacity-30"
    >
      {children}
    </button>
  );
}
