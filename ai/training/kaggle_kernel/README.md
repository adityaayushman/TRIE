# Push-button IDD fine-tune

This folder is the Kaggle-API-pushable form of `ai/training/kaggle_idd_notebook.md`
— the same four cells, just wrapped so a single command starts the run instead
of pasting them into the Kaggle UI by hand.

**Blocked on one thing:** the `~/.kaggle/kaggle.json` token in this environment
is dead (`kaggle kernels list --mine` returns "Authentication required" even
though public reads like `kaggle datasets list` work — it's a stale/placeholder
token, not a live one). Public dataset access needs no auth; pushing a kernel
does.

## To run it

1. Get a fresh token: kaggle.com → your avatar → **Settings** → **API** →
   **Create New Token** → save the downloaded `kaggle.json` to
   `~/.kaggle/kaggle.json` (overwrite the existing one).
2. In `kernel-metadata.json`, replace `YOUR_KAGGLE_USERNAME` with your real
   Kaggle username (the `id` field is `username/slug`).
3. From the repo root:
   ```bash
   kaggle kernels push -p ai/training/kaggle_kernel/
   ```
4. Poll status (takes ~2 hours on a T4 — GPU kernels run async, not in the
   foreground):
   ```bash
   kaggle kernels status YOUR_KAGGLE_USERNAME/trie-idd-perception-finetune
   ```
5. When it says `complete`, pull the artifacts:
   ```bash
   kaggle kernels output YOUR_KAGGLE_USERNAME/trie-idd-perception-finetune -p ./idd_output
   ```
   This downloads `best.pt` and `evaluation.json` into `./idd_output/`.
6. Drop `best.pt` into `runs/perception_idd/weights/` in the TRIE repo and
   hand me `evaluation.json` (or just paste its contents) — I'll wire
   `PerceptionEngine(model_path=...)` and flip every "COCO-pretrained
   baseline" caveat on `/research`, the README and the model card to the real,
   measured IDD mAP, the same way the road-damage and helmet detectors already
   went from "planned" to "measured."

`enable_gpu: true` in `kernel-metadata.json` requests Kaggle's free GPU quota
(~30 hrs/week per account) — this run uses about 2 hours of it.
