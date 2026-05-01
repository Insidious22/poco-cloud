import { deleteFileSchema, filePathSchema, mkdirSchema, type FileEntry } from "@poco-cloud/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, realpath, rm, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { appConfig } from "../config.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const root = resolve(appConfig.filesRoot);

const isInsideRoot = (rootPath: string, targetPath: string): boolean => {
  const rel = relative(rootPath, targetPath);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const rootRealPath = async (): Promise<string> => {
  await mkdir(root, { recursive: true });
  return realpath(root);
};

const resolveSafePath = async (inputPath: string, mode: "existing" | "new" = "existing"): Promise<string> => {
  const target = resolve(root, inputPath.replace(/^[/\\]+/, ""));
  const rel = relative(root, target);

  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("PATH_OUTSIDE_ROOT");
  }

  const realRoot = await rootRealPath();

  if (mode === "existing") {
    const realTarget = await realpath(target);
    if (!isInsideRoot(realRoot, realTarget)) {
      throw new Error("PATH_OUTSIDE_ROOT");
    }
    return realTarget;
  }

  const realParent = await realpath(dirname(target));
  if (!isInsideRoot(realRoot, realParent)) {
    throw new Error("PATH_OUTSIDE_ROOT");
  }
  return target;
};

const toPublicPath = (fullPath: string): string => relative(root, fullPath).replace(/\\/g, "/") || ".";

const safeDownloadName = (fullPath: string): string => basename(fullPath).replace(/[^\w.-]/g, "_") || "download";

export const filesRoutes = async (fastify: FastifyInstance): Promise<void> => {
  fastify.post(
    "/api/files/list",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = filePathSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: "Invalid path" });

      try {
        const target = await resolveSafePath(parsed.data.path);
        const names = await readdir(target);
        const entries = await Promise.all(
          names.map(async (name): Promise<FileEntry> => {
            const fullPath = join(target, name);
            const info = await stat(fullPath);
            return {
              name,
              path: toPublicPath(fullPath),
              type: info.isDirectory() ? "directory" : "file",
              size: info.size,
              modifiedAt: info.mtime.toISOString()
            };
          })
        );

        return {
          path: toPublicPath(target),
          entries: entries.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
        };
      } catch (error) {
        if ((error as Error).message === "PATH_OUTSIDE_ROOT") {
          return reply.code(403).send({ message: "Path is outside allowed root" });
        }
        return reply.code(404).send({ message: "Path not found" });
      }
    }
  );

  fastify.post(
    "/api/files/mkdir",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = mkdirSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: "Invalid folder payload" });

      const target = await resolveSafePath(join(parsed.data.path, parsed.data.name), "new");
      await mkdir(target, { recursive: false });
      return { message: "Folder created", path: toPublicPath(target) };
    }
  );

  fastify.delete(
    "/api/files",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = deleteFileSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: "Invalid delete payload" });
      if (!appConfig.allowFileDelete) {
        return reply.code(403).send({ message: "File deletion is disabled" });
      }

      const target = await resolveSafePath(parsed.data.path);
      await rm(target, { recursive: true, force: true });
      return { message: "Deleted", path: parsed.data.path };
    }
  );

  fastify.post(
    "/api/files/upload",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const destination = String((request.query as { path?: string }).path ?? ".");
      const targetDir = await resolveSafePath(destination);
      const file = await request.file();
      if (!file) return reply.code(400).send({ message: "No file received" });

      const safeName = basename(file.filename);
      const target = await resolveSafePath(join(toPublicPath(targetDir), safeName), "new");
      await pipeline(file.file, createWriteStream(target));
      return { message: "Uploaded", path: toPublicPath(target) };
    }
  );

  fastify.get(
    "/api/files/download",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const targetPath = String((request.query as { path?: string }).path ?? "");
      const target = await resolveSafePath(targetPath);
      return reply
        .header("Content-Disposition", `attachment; filename="${safeDownloadName(target)}"`)
        .send(createReadStream(target));
    }
  );
};
