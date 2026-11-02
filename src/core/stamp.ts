import type { BuildStamp, BuildStampOptions } from '../types'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'

interface PackageJson {
  name?: string
  version?: string
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

  // git 需要在真正的工作树根目录执行，否则子目录里也能工作，但统一取仓库根更稳
  const gitRoot = git(cwd, ['rev-parse', '--show-toplevel']) ?? cwd
  const hash = git(gitRoot, ['rev-parse', 'HEAD']) ?? ''
  const shortHash = hash.slice(0, 7)
  const branch = git(gitRoot, ['rev-parse', '--abbrev-ref', 'HEAD']) ?? ''
  const commitTimeRaw = git(gitRoot, ['log', '-1', '--format=%cI']) ?? ''
  const status = git(gitRoot, ['status', '--porcelain'])

  return {
    version: found?.pkg.version ?? '0.0.0',
    name: found?.pkg.name ?? '',
    hash,
    shortHash,
    branch,
    commitTime: commitTimeRaw,
    buildTime: (options.now?.() ?? new Date()).toISOString(),
    dirty: Boolean(status),
    ...options.extra,
  }
}

/**
 * 将指纹值序列化为可以安全写进源码的表达式
 */
export function serializeStamp(stamp: BuildStamp & Record<string, unknown>): string {
  return JSON.stringify(stamp)
}
