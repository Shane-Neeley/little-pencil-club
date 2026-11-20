export const SCHEMA_VERSION = 1;

// These identifiers belong only to the prototype's synthetic catalog.
export const SAMPLE_LESSONS = Object.freeze(['sample-fox', 'sample-cupcake', 'sample-owl']);
const allowed = new Set(SAMPLE_LESSONS);

export function normalizeCompleted(ids) {
  if (!Array.isArray(ids) || ids.length > allowed.size || ids.some(id => !allowed.has(id))) {
    return null;
  }
  return [...new Set(ids)].sort();
}

export function mergeCompleted(local, backup) {
  return [...new Set([...local, ...backup])].sort();
}
