export type PublishMode =
  | "standard"
  | "skip_pull"
  | "merge_instead"
  | "force_with_lease"
  | "force_push"

export type PublishModeOption = {
  id: PublishMode
  label: string
  summary: string
  detail: string
  risky?: boolean
}

export const PUBLISH_MODE_OPTIONS: readonly PublishModeOption[] = [
  {
    id: "standard",
    label: "Sync then push (recommended)",
    summary: "Download GitHub’s latest changes, put your upload on top, then push.",
    detail:
      "Runs git pull --rebase with autostash, commits your gallery files, then pushes. This is the normal, safe path.",
  },
  {
    id: "skip_pull",
    label: "Push without downloading first",
    summary: "Skip the download step and push your local copy straight to GitHub.",
    detail:
      "Use only if you just clicked Sync gallery project and know nobody else pushed. GitHub will reject the push if the branch moved.",
  },
  {
    id: "merge_instead",
    label: "Download and merge (not rebase)",
    summary: "Download latest and merge instead of replaying your commit on top.",
    detail:
      "Creates a merge commit if histories diverged. Try this when rebase stops with conflicts you do not want to untangle.",
  },
  {
    id: "force_with_lease",
    label: "Replace GitHub only if nobody else pushed",
    summary: "Push with --force-with-lease: overwrite GitHub unless it gained new commits.",
    detail:
      "Safer than a bare force push. Use when a normal push was rejected but your local folder is definitely the version you want online.",
    risky: true,
  },
  {
    id: "force_push",
    label: "Overwrite GitHub with my copy (dangerous)",
    summary: "Force push: make GitHub match this PC, even if that drops remote-only commits.",
    detail:
      "Only use if you are sure commits on GitHub should be discarded. You cannot undo this from the app.",
    risky: true,
  },
]

export const DEFAULT_PUBLISH_MODE: PublishMode = "standard"

export function publishModeOption(id: PublishMode): PublishModeOption {
  return PUBLISH_MODE_OPTIONS.find((o) => o.id === id) ?? PUBLISH_MODE_OPTIONS[0]
}
