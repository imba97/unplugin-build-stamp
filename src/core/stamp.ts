import type { BuildStamp, BuildStampOptions } from '../types'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'

interface PackageJson {
  name?: string
  version?: string
}

interface EnvironmentStamp {
  name?: string
  version?: string
  hash?: string
  buildHash?: string
  shortHash?: string
  branch?: string
  commitTime?: string
  buildTime?: string
  dirty?: boolean
}

/**
 * BUILD_STAMP 是 CI 传入的完整指纹；旧变量保留作兼容回退。
 * 无效 JSON 不应阻断构建，直接继续使用旧变量和 git。
 */
function readEnvironmentStamp(): EnvironmentStamp {
  const raw = process.env.BUILD_STAMP
  if (!raw)
    return {}

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {}

    const value = parsed as Record<string, unknown>
    return {
      name: readString(value.name),
      version: readString(value.version),
      hash: readString(value.hash),
      buildHash: readString(value.buildHash),
      shortHash: readString(value.shortHash),
      branch: readString(value.branch),
      commitTime: readString(value.commitTime),
      buildTime: readString(value.buildTime),
      dirty: readBoolean(value.dirty),
    }
  }
  catch {
    return {}
  }
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0)
    return value
  return undefined
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean')
    return value
  if (value === 'true')
    return true
  if (value === 'false')
    return false
  return undefined
}

function readLegacyBoolean(value: string | undefined): boolean | undefined {
  if (value === 'true')
    return true
  if (value === 'false')
    return false
  return undefined
}

/**
 * 从 startDir 向上查找第一个 package.json
 */
function findPackageJson(startDir: string): { dir: string, pkg: PackageJson } | undefined {
  let current = resolve(startDir)

  while (true) {
    const file = join(current, 'package.json')

    if (existsSync(file)) {
      try {
        return {
          dir: current,
          pkg: JSON.parse(readFileSync(file, 'utf-8')) as PackageJson,
        }
      }
      catch {
        return { dir: current, pkg: {} }
      }
    }

    const parent = dirname(current)
    if (parent === current)
      return undefined
    current = parent
  }
}

/**
 * 在指定目录执行 git 命令，失败时返回 undefined
 */
function git(cwd: string, args: string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || undefined
  }
  catch {
    return undefined
  }
}

export function createBuildStamp(options: BuildStampOptions = {}): BuildStamp & Record<string, unknown> {
  const cwd = resolve(options.cwd ?? process.cwd())
  const found = findPackageJson(cwd)
  const environment = readEnvironmentStamp()

  // git 需要在真正的工作树根目录执行，否则子目录里也能工作，但统一取仓库根更稳
  const gitRoot = git(cwd, ['rev-parse', '--show-toplevel']) ?? cwd
  const hash = environment.hash
    ?? environment.buildHash
    ?? process.env.BUILD_HASH
    ?? process.env.GIT_COMMIT
    ?? git(gitRoot, ['rev-parse', 'HEAD'])
    ?? ''
  const shortHash = environment.shortHash ?? hash.slice(0, 7)
  const branch = environment.branch
    ?? process.env.BUILD_BRANCH
    ?? git(gitRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])
    ?? ''
  const commitTimeRaw = environment.commitTime
    ?? process.env.COMMIT_TIME
    ?? git(gitRoot, ['log', '-1', '--format=%cI'])
    ?? ''
  const status = git(gitRoot, ['status', '--porcelain'])

  return {
    version: environment.version ?? found?.pkg.version ?? '0.0.0',
    name: environment.name ?? found?.pkg.name ?? '',
    hash,
    shortHash,
    branch,
    commitTime: commitTimeRaw,
    buildTime: environment.buildTime
      ?? process.env.BUILD_TIME
      ?? (options.now?.() ?? new Date()).toISOString(),
    dirty: environment.dirty
      ?? readLegacyBoolean(process.env.BUILD_DIRTY)
      ?? Boolean(status),
    ...options.extra,
  }
}

/**
 * 将指纹值序列化为可以安全写进源码的表达式
 */
export function serializeStamp(stamp: BuildStamp & Record<string, unknown>): string {
  return JSON.stringify(stamp)
}
