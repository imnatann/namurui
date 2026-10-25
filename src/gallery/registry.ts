import type { ComponentType } from "react";
import categoryList from "./categories.json";
import manifest from "./manifest.json";

/**
 * One gallery entry, mirroring its row in `manifest.json`.
 *
 * The three tiers say where a component comes from:
 * - "Free" – shipped in the upstream library's free tier, the baseline the reconstruction covers.
 * - "Pro"  – upstream components that sit behind the library's paid tier.
 * - "Core" – first-party NamurUI components written for this gallery, not derived from upstream.
 */
export type Item = {
  slug: string;
  title: string;
  kind: "components" | "screens" | "blocks" | "illustrations" | "motion";
  tier: "Free" | "Pro" | "Core";
  category: string;
  description: string;
  url: string;
};

export const items = manifest as Item[];

/**
 * The one grouping axis: what job a piece does in a product, not what shape it has.
 *
 * `kind` answers "is this a component or a screen" and `tier` answers "where did it come
 * from", so neither can also answer "what is it for". These eight buckets do, and their
 * order is the order the rail and the overview present them in.
 */
export const categories = categoryList as { id: string; blurb: string }[];

/*
 * Discovery is entirely lazy. The gallery mounts one item at a time, so nothing is
 * loaded until a page asks for it – which keeps the entry bundle to the chrome plus
 * the manifest instead of all 119 components and their 40k lines of source.
 *
 * Adding a file is still the whole install procedure: the globs pick it up.
 */
const demoModules = import.meta.glob<{ default: ComponentType }>("../namurui/demos/*.tsx");
const componentModules = import.meta.glob<Record<string, unknown>>("../namurui/*.tsx");
const sourceModules = import.meta.glob<string>("../namurui/*.tsx", {
  query: "?raw",
  import: "default",
});
const demoSourceModules = import.meta.glob<string>("../namurui/demos/*.tsx", {
  query: "?raw",
  import: "default",
});

const slugOf = (path: string) => path.slice(path.lastIndexOf("/") + 1, -4);

export const demos: Record<string, () => Promise<{ default: ComponentType }>> = {};
for (const [path, load] of Object.entries(demoModules)) demos[slugOf(path)] = load;

const componentLoader: Record<string, () => Promise<Record<string, unknown>>> = {};
const sourceLoader: Record<string, () => Promise<string>> = {};
const demoSourceLoader: Record<string, () => Promise<string>> = {};
for (const [path, load] of Object.entries(componentModules)) componentLoader[slugOf(path)] = load;
for (const [path, load] of Object.entries(sourceModules)) sourceLoader[slugOf(path)] = load;
for (const [path, load] of Object.entries(demoSourceModules)) demoSourceLoader[slugOf(path)] = load;

/** The component's source, fetched the first time a page asks for it. */
export async function loadSource(slug: string): Promise<string | undefined> {
  const load = sourceLoader[slug];
  return load ? await load() : undefined;
}

/** The demo's source, for the code tab. */
export async function loadDemoSource(slug: string): Promise<string | undefined> {
  const load = demoSourceLoader[slug];
  return load ? await load() : undefined;
}

/** The component's named exports, for the API table on its page. */
export async function loadExports(slug: string): Promise<string[]> {
  const load = componentLoader[slug];
  if (!load) return [];
  const mod = await load();
  return Object.keys(mod)
    .filter((key) => key !== "default")
    .sort();
}

export const kinds = [
  { id: "components", label: "Components" },
  { id: "screens", label: "Screens" },
  { id: "blocks", label: "Blocks" },
  { id: "illustrations", label: "Illustrations" },
  { id: "motion", label: "Motion" },
] as const;

export const bySlug: Record<string, Item> = Object.fromEntries(items.map((i) => [i.slug, i]));
