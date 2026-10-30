import 'dotenv/config'
import mysql from 'mysql2/promise'
import { drizzle } from 'drizzle-orm/mysql2'
import * as schema from './schema.js'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('缺少环境变量 DATABASE_URL')
}

export const pool = mysql.createPool({
  uri: databaseUrl,
  waitForConnections: true,
  connectionLimit: 10,
})

export const db = drizzle(pool, { schema, mode: 'default' })
