import type { FastifyInstance } from 'fastify'
import { and, desc, eq, like, sql } from 'drizzle-orm'
import {
  createEmptyCanvas,
  createProjectInputSchema,
  ERROR_CODES,
  projectListQuerySchema,
  updateProjectInputSchema,
} from '@nexa/schema'
import { db } from '../db/client.js'
import { projects } from '../db/schema.js'
import { generateId } from '../lib/crypto.js'
import { sendError, sendValidationError } from '../lib/http.js'

/** 组件数量直接由 JSON 列计算，避免额外存储字段不一致 */
const componentCountSql = sql<number>`JSON_LENGTH(${projects.canvasJson}->'$.components')`

const summaryColumns = {
  id: projects.id,
  name: projects.name,
  type: projects.type,
  revision: projects.revision,
  componentCount: componentCountSql.as('component_count'),
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
}

function toIso(value: Date): string {
  return value.toISOString()
}

function mapSummary(row: {
  id: string
  name: string
  type: 'draft' | 'template'
  revision: number
  componentCount: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    revision: row.revision,
    componentCount: row.componentCount,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.get('/projects', async (request, reply) => {
    const parsed = projectListQuerySchema.safeParse(request.query)
    if (!parsed.success) return sendValidationError(reply, parsed.error.issues)

    const { type, search, limit } = parsed.data
    const filters = [eq(projects.userId, request.authUser!.id), eq(projects.type, type)]
    if (search) filters.push(like(projects.name, `%${search}%`))

    const rows = await db
      .select(summaryColumns)
      .from(projects)
      .where(and(...filters))
      .orderBy(desc(projects.updatedAt))
      .limit(limit)

    return reply.send({ projects: rows.map(mapSummary) })
  })

  app.post('/projects', async (request, reply) => {
    const parsed = createProjectInputSchema.safeParse(request.body ?? {})
    if (!parsed.success) return sendValidationError(reply, parsed.error.issues)

    const now = new Date()
    const row = {
      id: generateId('p'),
      userId: request.authUser!.id,
      name: parsed.data.name,
      type: parsed.data.type,
      canvasJson: parsed.data.canvas ?? createEmptyCanvas(),
      revision: 1,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(projects).values(row)

    return reply.status(201).send({
      project: {
        ...row,
        componentCount: row.canvasJson.components.length,
        canvas: row.canvasJson,
        createdAt: toIso(now),
        updatedAt: toIso(now),
      },
    })
  })

  app.get('/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const rows = await db
      .select({ ...summaryColumns, canvas: projects.canvasJson })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, request.authUser!.id)))
      .limit(1)

    const row = rows[0]
    if (!row) return sendError(reply, 404, ERROR_CODES.NOT_FOUND, '草稿不存在或无权访问')

    return reply.send({ project: { ...mapSummary(row), canvas: row.canvas } })
  })

  app.put('/projects/:id', async (request, reply) => {
    const parsed = updateProjectInputSchema.safeParse(request.body)
    if (!parsed.success) return sendValidationError(reply, parsed.error.issues)

    const { id } = request.params as { id: string }
    const { revision, name, canvas } = parsed.data

    const [result] = await db
      .update(projects)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(canvas !== undefined ? { canvasJson: canvas } : {}),
        revision: revision + 1,
      })
      .where(and(eq(projects.id, id), eq(projects.userId, request.authUser!.id), eq(projects.revision, revision)))

    if (result.affectedRows === 0) {
      const exists = await db
        .select({ revision: projects.revision })
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.userId, request.authUser!.id)))
        .limit(1)

      if (!exists[0]) return sendError(reply, 404, ERROR_CODES.NOT_FOUND, '草稿不存在或无权访问')

      return sendError(reply, 409, ERROR_CODES.PROJECT_REVISION_CONFLICT, '草稿已在别处更新，请刷新后重试', {
        currentRevision: exists[0].revision,
      })
    }

    const rows = await db
      .select({ ...summaryColumns, canvas: projects.canvasJson })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, request.authUser!.id)))
      .limit(1)

    return reply.send({ project: { ...mapSummary(rows[0]), canvas: rows[0].canvas } })
  })

  app.delete('/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const [result] = await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, request.authUser!.id)))

    if (result.affectedRows === 0) {
      return sendError(reply, 404, ERROR_CODES.NOT_FOUND, '草稿不存在或无权访问')
    }

    return reply.status(204).send()
  })
}
