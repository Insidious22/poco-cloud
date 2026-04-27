import { deleteFileSchema, filePathSchema, mkdirSchema, type FileEntry } from "@poco-cloud/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { appConfig } from "../config.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const root = resolve(appConfig.filesRoot);

const resolveSafePath = (inputPath: string): string => {
  const target = resolve(root, inputPath.replace(/^[/\\]+/, ""));
  const rel = relative(root, target);

  if (rel.startsWith("..") || resolve(rel) === rel) {
    throw new Error("PATH_OUTSIDE_ROOT");
  }

  return target;
};

const toPublicPath = (fullPath: string): string => relative(root, fullPath).replace(/\\/g, "/") || ".";

export const filesRoutes = async (fastify: FastifyInstance): Promise<void> => {
  fastify.post(
    "/api/files/list",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = filePathSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ message: "Invalid path" });

      try {
        const target = resolveSafePath(parsed.data.path);
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

      const target = resolveSafePath(join(parsed.data.path, parsed.data.name));
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

      const target = resolveSafePath(parsed.data.path);
      await rm(target, { recursive: true, force: true });
      return { message: "Deleted", path: parsed.data.path };
    }
  );

  fastify.post(
    "/api/files/upload",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const destination = String((request.query as { path?: string }).path ?? ".");
      const targetDir = resolveSafePath(destination);
      const file = await request.file();
      if (!file) return reply.code(400).send({ message: "No file received" });

      const safeName = basename(file.filename);
      const target = resolveSafePath(join(toPublicPath(targetDir), safeName));
      await pipeline(file.file, createWriteStream(target));
      return { message: "Uploaded", path: toPublicPath(target) };
    }
  );

  fastify.get(
    "/api/files/download",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const targetPath = String((request.query as { path?: string }).path ?? "");
      const target = resolveSafePath(targetPath);
      return reply
        .header("Content-Disposition", `attachment; filename="${basename(target)}"`)
        .send(createReadStream(target));
    }
  );
};
