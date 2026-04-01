import path from "node:path";
import { pathToFileURL } from "node:url";

export async function importModuleFromFsPath(modulePath: string): Promise<unknown> {
  const resolvedPath = path.resolve(modulePath);
  return import(pathToFileURL(resolvedPath).href);
}
