import type { BuildStamp } from './types'

declare global {
  /**
   * 构建时注入的指纹常量。
   *
   * 常量名可通过插件选项 `name` 修改；修改后需自行扩展声明。
   *
   * @example
   * ```ts
   * console.info(__BUILD_STAMP__.version, __BUILD_STAMP__.shortHash)
   * ```
   */
  const __BUILD_STAMP__: BuildStamp
}

export type { BuildStamp, BuildStampOptions } from './types'
