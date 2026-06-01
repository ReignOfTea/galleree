import type {
  GalleryRegistries,
  RegistryCollection,
  RegistryEquipment,
  RegistryKind,
} from "../registryTypes"

type Props = {
  registries: GalleryRegistries
  disabled?: boolean
  onEdit: (kind: RegistryKind, slug: string) => void
  onNew: (kind: RegistryKind) => void
}

function collectionMeta(c: RegistryCollection): string {
  const parts: string[] = [`slug: ${c.slug}`]
  if (c.coverImageId) parts.push(`cover: ${c.coverImageId.slice(0, 8)}…`)
  if (c.description?.trim()) {
    const d = c.description.trim()
    parts.push(d.length > 48 ? `${d.slice(0, 48)}…` : d)
  }
  return parts.join(" · ")
}

function equipmentMeta(e: RegistryEquipment): string {
  const parts: string[] = [`slug: ${e.slug}`]
  const mm = [e.make, e.model].filter(Boolean).join(" ")
  if (mm) parts.push(mm)
  return parts.join(" · ")
}

function RegistryKindList({
  title,
  emptyLabel,
  items,
  disabled,
  onEdit,
  onNew,
}: {
  title: string
  emptyLabel: string
  items: readonly { slug: string; label: string; meta: string }[]
  disabled?: boolean
  onEdit: (slug: string) => void
  onNew: () => void
}) {
  return (
    <section className="registry-kind-list">
      <div className="registry-kind-list__header">
        <h3 className="registry-kind-list__title">{title}</h3>
        <button type="button" className="ghost" disabled={disabled} onClick={onNew}>
          Add new…
        </button>
      </div>
      {items.length === 0 ? (
        <p className="muted registry-kind-list__empty">{emptyLabel}</p>
      ) : (
        <ul className="registry-kind-list__items">
          {items.map((item) => (
            <li key={item.slug} className="registry-kind-list__item">
              <div className="registry-kind-list__item-text">
                <span className="registry-kind-list__item-label">{item.label}</span>
                <span className="registry-kind-list__item-meta muted">{item.meta}</span>
              </div>
              <button
                type="button"
                className="ghost registry-kind-list__edit"
                disabled={disabled}
                onClick={() => onEdit(item.slug)}
              >
                Edit
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function RegistryListsPanel({
  registries,
  disabled,
  onEdit,
  onNew,
}: Props) {
  const collections = registries.collections.map((c) => ({
    slug: c.slug,
    label: c.title,
    meta: collectionMeta(c),
  }))
  const cameras = registries.cameras.map((c) => ({
    slug: c.slug,
    label: c.name,
    meta: equipmentMeta(c),
  }))
  const lenses = registries.lenses.map((l) => ({
    slug: l.slug,
    label: l.name,
    meta: equipmentMeta(l),
  }))

  return (
    <div className="registry-manager">
      <RegistryKindList
        title="Collections"
        emptyLabel="No collections yet. Add one to group photos on the site."
        items={collections}
        disabled={disabled}
        onEdit={(slug) => onEdit("collection", slug)}
        onNew={() => onNew("collection")}
      />
      <RegistryKindList
        title="Cameras"
        emptyLabel="No cameras in the registry yet."
        items={cameras}
        disabled={disabled}
        onEdit={(slug) => onEdit("camera", slug)}
        onNew={() => onNew("camera")}
      />
      <RegistryKindList
        title="Lenses"
        emptyLabel="No lenses in the registry yet."
        items={lenses}
        disabled={disabled}
        onEdit={(slug) => onEdit("lens", slug)}
        onNew={() => onNew("lens")}
      />
    </div>
  )
}
