/**
 * 构建指纹数据，注入到应用中的值就是它的 JSON 序列化结果
 */
export interface BuildStamp {
  /** package.json 中的 version */
  version: string
  /** package.json 中的 name */
  name: string
  /** 当前 HEAD 的 commit hash（完整 40 位） */
  hash: string
  /** 当前 HEAD 的 commit hash（7 位短 hash） */
  shortHash: string
  /** 当前分支名，detached HEAD 时为 `HEAD` */
  branch: string
  /** 最近一次提交时间，ISO 8601 格式 */
  commitTime: string
  /** 构建时间，ISO 8601 格式 */
  buildTime: string
  /** 工作区是否有未提交改动 */
  dirty: boolean
}

export interface BuildStampOptions {
  /**
   * 模块 id 前缀，只在匹配到该前缀的模块中注入常量。
   *
   * @default ['\0', '/', '\\', 'virtual:']
   */
  include?: string[]
  /**
   * 计算指纹时所在目录，用于向上查找 package.json 与 git 仓库。
   *
   * @default process.cwd()
   */
  cwd?: string
  /**
   * 注入的全局常量名。
   *
   * @default '__BUILD_STAMP__'
   */
  name?: string
  /**
   * 是否在构建日志中打印最终指纹。
   *
   * @default true
   */
  log?: boolean
  /**
   * 在默认指纹基础上附加/覆盖字段。
   */
  extra?: Record<string, unknown>
  /**
   * 构建时间来源，默认取当前时间，便于测试时固定。
   */
  now?: () => Date
}
