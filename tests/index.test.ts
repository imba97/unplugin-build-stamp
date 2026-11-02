import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { unplugin } from '../src'
import { createBuildStamp } from '../src/core/stamp'

const FIXED_TIME = new Date('2026-01-02T03:04:05.000Z')
const now = () => FIXED_TIME

describe('createBuildStamp', () => {
  const dirs: string[] = []
  const makeTmp = () => {
    const dir = mkdtempSync(join(tmpdir(), 'build-stamp-'))
    dirs.push(dir)
    return dir
  }

  afterAll(() => {
    for (const dir of dirs)
      rmSync(dir, { recursive: true, force: true })
  })

  it('读取 package.json 的 name 与 version', () => {
    const dir = makeTmp()
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'demo-app', version: '1.2.3' }))

    const stamp = createBuildStamp({ cwd: dir, now })

    expect(stamp.name).toBe('demo-app')
    expect(stamp.version).toBe('1.2.3')
    expect(stamp.buildTime).toBe(FIXED_TIME.toISOString())
  })

  it('缺少 package.json 时使用兜底版本号', () => {
    const dir = makeTmp()

    const stamp = createBuildStamp({ cwd: dir, now })

    expect(stamp.version).toBe('0.0.0')
    expect(stamp.name).toBe('')
  })

  it('从子目录向上查找 package.json', () => {
    const dir = makeTmp()
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'root', version: '9.9.9' }))

    const stamp = createBuildStamp({ cwd: dir, now })

    expect(stamp.version).toBe('9.9.9')
  })

  it('在 git 仓库中读取 hash、分支与提交时间', () => {
    const dir = makeTmp()
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: dir, encoding: 'utf-8' }).trim()

    git('init', '-q')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'test')
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'git-app', version: '0.1.0' }))
    git('add', '.')
    git('commit', '-q', '-m', 'init')

    const head = git('rev-parse', 'HEAD')
    const stamp = createBuildStamp({ cwd: dir, now })

    expect(stamp.hash).toBe(head)
    expect(stamp.shortHash).toBe(head.slice(0, 7))
    expect(stamp.shortHash).toHaveLength(7)
    expect(stamp.branch).toBeTruthy()
    expect(stamp.branch).not.toBe('HEAD')
    expect(stamp.commitTime).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(stamp.dirty).toBe(false)
  })

  it('工作区有未提交改动时标记 dirty', () => {
    const dir = makeTmp()
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: dir, encoding: 'utf-8' }).trim()

    git('init', '-q')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'test')
    writeFileSync(join(dir, 'a.txt'), '1')
    git('add', '.')
    git('commit', '-q', '-m', 'init')
    writeFileSync(join(dir, 'a.txt'), '2')

    expect(createBuildStamp({ cwd: dir, now }).dirty).toBe(true)
  })

  it('非 git 目录不抛错，hash 为空', () => {
    const dir = makeTmp()
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'no-git', version: '0.0.2' }))

    const stamp = createBuildStamp({ cwd: dir, now })

    expect(stamp.hash).toBe('')
    expect(stamp.shortHash).toBe('')
    expect(stamp.dirty).toBe(false)
  })

  it('extra 字段可以覆盖默认值', () => {
    const dir = makeTmp()
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'a', version: '1.0.0' }))

    const stamp = createBuildStamp({
      cwd: dir,
      now,
      extra: { version: '2.0.0', ci: true },
    })

    expect(stamp.version).toBe('2.0.0')
    expect(stamp.ci).toBe(true)
  })
})

describe('unplugin transform', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'build-stamp-plugin-'))
  writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'plugin-app', version: '3.2.1' }))

  afterAll(() => rmSync(tmp, { recursive: true, force: true }))

  const plugin = unplugin.raw({
    cwd: tmp,
    log: false,
    now: () => FIXED_TIME,
  }, { framework: 'vite', versions: {} }) as any

  it('把常量替换为指纹字面量', () => {
    const result = plugin.transform('export const info = __BUILD_STAMP__', '/app/src/main.ts')

    expect(result).not.toBeNull()
    const stamp = JSON.parse(result.code.replace('export const info = ', ''))
    expect(stamp.name).toBe('plugin-app')
    expect(stamp.version).toBe('3.2.1')
    expect(stamp.buildTime).toBe(FIXED_TIME.toISOString())
  })

  it('未使用常量的模块返回 null', () => {
    expect(plugin.transform('export const a = 1', '/app/src/a.ts')).toBeNull()
  })

  it('跳过 node_modules', () => {
    const id = '/app/node_modules/foo/index.js'
    expect(plugin.transformInclude(id)).toBe(false)
    expect(plugin.transform('__BUILD_STAMP__', id)).toBeNull()
  })

  it('允许通过 name 自定义常量名', () => {
    const custom = unplugin.raw(
      {
        cwd: tmp,
        log: false,
        name: '__APP_INFO__',
        now: () => FIXED_TIME,
      },
      { framework: 'vite', versions: {} },
    ) as any

    const result = custom.transform('console.log(__APP_INFO__)', '/app/src/b.ts')

    expect(JSON.parse(result.code.slice('console.log('.length, -1)).version).toBe('3.2.1')
    expect(custom.transform('console.log(__BUILD_STAMP__)', '/app/src/b.ts')).toBeNull()
  })

  it('允许通过 include 覆盖匹配规则', () => {
    const custom = unplugin.raw(
      {
        cwd: tmp,
        log: false,
        include: ['/custom/'],
        now: () => FIXED_TIME,
      },
      { framework: 'vite', versions: {} },
    ) as any

    expect(custom.transformInclude('/custom/a.ts')).toBe(true)
    expect(custom.transformInclude('/app/src/a.ts')).toBe(false)
  })

  it('windows 路径也能匹配默认 include', () => {
    const id = String.raw`C:\app\src\main.ts`
    expect(plugin.transformInclude(id)).toBe(true)
    expect(plugin.transform('__BUILD_STAMP__', id)).not.toBeNull()
  })
})
