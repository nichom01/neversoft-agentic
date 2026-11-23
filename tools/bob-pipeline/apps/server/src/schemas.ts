import fs from "node:fs";
import path from "node:path";
import { Ajv, type ValidateFunction } from "ajv";

const ajv = new Ajv({ allErrors: true, strict: false });
const cache = new Map<string, { mtime: number; fn: ValidateFunction }>();

/** Compile (and cache) a JSON Schema file. Throws if the schema itself is invalid. */
export function compileSchema(absPath: string): ValidateFunction {
  const mtime = fs.statSync(absPath).mtimeMs;
  const hit = cache.get(absPath);
  if (hit && hit.mtime === mtime) return hit.fn;
  const schema = JSON.parse(fs.readFileSync(absPath, "utf8"));
  delete schema.$schema;
  const fn = ajv.compile(schema);
  cache.set(absPath, { mtime, fn });
  return fn;
}

/** Validate JSON text against a schema; returns a list of readable errors (empty = valid). */
export function validateJsonText(text: string, schemaAbsPath: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return [`Not valid JSON: ${(e as Error).message}`];
  }
  const fn = compileSchema(schemaAbsPath);
  if (fn(data)) return [];
  return (fn.errors ?? []).map((e) => `${e.instancePath || "(root)"} ${e.message ?? "is invalid"}${e.params && "allowedValues" in e.params ? ` (${(e.params as { allowedValues: unknown[] }).allowedValues.join(", ")})` : ""}`);
}

export function schemaPath(pipelineDir: string, rel: string) {
  return path.resolve(pipelineDir, rel);
}
