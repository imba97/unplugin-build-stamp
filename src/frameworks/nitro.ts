import type { BuildStampOptions } from '../types'
import { unplugin } from '../index'

/**
 * Nitro buildPlugins 使用 Rollup 兼容的 resolveId/load/transform 钩子，
 * 因此复用同一份 unplugin 实现，不依赖 Nitro 运行时包。
 */
export default function buildStamp(options?: BuildStampOptions) {
  return unplugin.raw(options, { framework: 'rollup', versions: {} })
}
