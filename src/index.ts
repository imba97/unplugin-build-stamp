import type { UnpluginFactory } from 'unplugin'
import type { BuildStampOptions } from './types'
import { createUnplugin } from 'unplugin'
import { createBuildStamp, serializeStamp } from './core/stamp'
// 副作用导入：让引用插件的地方自动获得 __BUILD_STAMP__ 全局声明
import './client'

const SCOPE = '[build-stamp]'
const DEFAULT_NAME = '__BUILD_STAMP__'
const DEFAULT_MODULE_ID = 'virtual:build-stamp'

const toPosix = (id: string) => id.replace(/\\/g, '/')

function isNodeModules(id: string) {
  const normalized = toPosix(id)
  return normalized.includes('/node_modules/') || normalized.endsWith('/node_modules')
}

/**
 * 默认注入范围：虚拟模块，以及任意绝对路径（含 Windows 盘符路径）。
 * node_modules 会在匹配时单独排除。
 */
function isDefaultIncluded(id: string): boolean {
  const normalized = toPosix(id)
  return (
    normalized.startsWith('\0')
    || normalized.startsWith('virtual:')
    || normalized.startsWith('/')
    || /^[a-z]:\//i.test(normalized)
  )
}

export const unpluginFactory: UnpluginFactory<BuildStampOptions | undefined, false> = (rawOptions) => {
  const options = rawOptions ?? {}
  const name = options.name ?? DEFAULT_NAME
  const moduleId = options.moduleId ?? DEFAULT_MODULE_ID
  const resolvedModuleId = moduleId.startsWith('\0')
    ? moduleId
    : `\0${moduleId}`
  const customInclude = options.include?.map(toPosix)
  const shouldLog = options.log ?? true

  // 一次构建只计算一次，所有模块共享同一份指纹
  const stamp = createBuildStamp(options)
  const literal = serializeStamp(stamp)

  const shouldApply = (id: string): boolean => {
    if (isNodeModules(id))
      return false
    if (!customInclude)
      return isDefaultIncluded(id)
    return customInclude.some(prefix => toPosix(id).startsWith(prefix))
  }

  return {
    name: 'unplugin-build-stamp',
    enforce: 'pre',
    resolveId(source) {
      if (source === moduleId || source === resolvedModuleId)
        return resolvedModuleId
      return null
    },
    load(id) {
      if (id !== resolvedModuleId)
        return null
      return `const buildStamp = ${literal}\nexport { buildStamp }\nexport default buildStamp\n`
    },
    buildStart() {
      if (!shouldLog)
        return
      const flags = [
        stamp.hash ? stamp.shortHash : 'no-git',
        stamp.branch && `on ${stamp.branch}`,
        stamp.dirty && 'dirty',
      ].filter(Boolean)
      console.warn(`${SCOPE} inject ${name} = ${stamp.name || '<unnamed>'}@${stamp.version} (${flags.join(' ')})`)
    },
    transformInclude(id) {
      return shouldApply(id)
    },
    transform(code, id) {
      // 兜底：不是所有构建器都会走 transformInclude
      if (!shouldApply(id))
        return null

      // 只改写真正用到常量的模块，避免无谓的源码变动
      if (!code.includes(name))
        return null

      return {
        code: code.replaceAll(name, literal),
        map: null,
      }
    },
  }
}

export const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory)

export default unplugin
