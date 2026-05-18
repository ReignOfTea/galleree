export type RegistryCollection = {
  slug: string
  title: string
  description: string | null
}

export type RegistryEquipment = {
  slug: string
  name: string
  make: string | null
  model: string | null
}

export type GalleryRegistries = {
  collections: RegistryCollection[]
  cameras: RegistryEquipment[]
  lenses: RegistryEquipment[]
}

export type GalleryImageRef = {
  id: string
  title: string
}

export type RegistryKind = "collection" | "camera" | "lens"

export type RegistryField = "collectionSelect" | "cameraSelect" | "lensSelect"

export type RegistryModalRequest = {
  kind: RegistryKind
  /** Photo row to assign after create; omit for toolbar-only create */
  rowId?: string
  field?: RegistryField
}

export const SELECT_NONE = ""
export const SELECT_CUSTOM = "__custom__"

export type CoverCandidate = {
  id: string
  label: string
  source: "upload" | "gallery"
}
