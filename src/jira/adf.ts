export type AdfDoc = {
  type: 'doc';
  version: number;
  content: unknown[];
};

export function looksLikeAdfDoc(value: unknown): value is Partial<AdfDoc> {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.type === 'doc' || v.version !== undefined || v.content !== undefined;
}

export function assertValidAdfDoc(value: unknown, fieldNameForError: string): asserts value is AdfDoc {
  if (!value || typeof value !== 'object') {
    throw new Error(`Field "${fieldNameForError}" was expected to be an ADF doc object, got ${typeof value}`);
  }
  const v = value as Record<string, unknown>;
  if (v.type !== 'doc') throw new Error(`Field "${fieldNameForError}" ADF doc is missing type="doc"`);
  if (typeof v.version !== 'number') throw new Error(`Field "${fieldNameForError}" ADF doc is missing numeric version`);
  if (!Array.isArray(v.content)) throw new Error(`Field "${fieldNameForError}" ADF doc is missing array content`);
}


