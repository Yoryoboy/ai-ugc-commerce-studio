# Keeping the dashboard in sync

Read `studio.json` in the studio folder to get `dashboardUrl`. If it is missing, run the `setup`
skill first.

## After generating or changing anything

1. Download the result into the studio folder (see the folder layout in the `setup` skill).
2. Upload to the dashboard (`Artifact` tool, `url` = dashboardUrl, `asset: true`, `file_path` or
   `file_paths`), keeping each returned `/_blob/<id>` url:
   - **Thumbnail, always.** One frame of the video as JPEG, about 100 KB (see "Making a
     thumbnail"). Store it in `thumbAssetUrl`.
   - **Preview, only for a draft under review** and only if the file is 15 MB or less. Store it in
     `previewAssetUrl`.
   - Never upload finals or full-resolution videos. They are watched in Higgsfield.
3. Write the database rows with `ArtifactData` (schema in `db-schema.md`):
   - Use one `batch` when writing more than one document.
   - New documents: omit `if_version`. Existing documents: read them first and pass
     `if_version`.
   - Use `update` to change a few fields (status, URLs, credits) instead of `set`.
4. Add the credits of every attempt to the video's `credits` field, so the dashboard shows the
   real cost of each video, and append the attempt to `versions` with its own thumbnail
   (`thumbAssetUrl`) and a short `note` (e.g. "Hook nuevo"). Keep the thumbnails of older
   versions: the dashboard shows every version as a card. Set the row's `thumbAssetUrl` to the
   new version's thumbnail and delete only the previous preview video asset.
5. When a draft is approved, finalized or discarded, delete its preview asset (`Artifact` tool,
   `action: "delete"`, `url` = dashboardUrl, `path` = the asset id) and remove `previewAssetUrl`
   from the row with an `update` that sets it to `{"__delete__": true}`.

## Making a thumbnail

Extract one frame from about 1 second into the video and save it as JPEG, at most 540 px wide:

- macOS: `qlmanage -t -s 540 -o <out dir> <video>` produces a PNG thumbnail; convert it with
  `sips -s format jpeg -s formatOptions 70 <png> --out <jpg>`.
- With ffmpeg available: `ffmpeg -ss 1 -i <video> -frames:v 1 -vf scale=540:-2 -q:v 4 <jpg>`.

Save the thumbnail next to the video in its folder (`thumb.jpg`).

Never write invented data to the dashboard. Rows are what the user sees as their real work.
