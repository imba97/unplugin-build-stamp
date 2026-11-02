# unplugin-build-stamp

把 git hash、package 版本号和构建时间注入成应用里的一个全局常量。基于 [unplugin](https://github.com/unjs/unplugin)，Vite / Rollup / Webpack / Rspack / Rsbuild / esbuild 等构建器通用。

## Features

- 🏷️ **零配置**：自动向上查找 `package.json`，自动读取 git 信息
- 🔌 **多构建器**：Vite、Rollup、Rolldown、Webpack、Rspack、Rsbuild、esbuild、Farm…
- 🪶 **零运行时**：构建时直接替换为字面量，不引入任何运行时代码
- 🧩 **可扩展**：`extra` 可以附加 CI 编号、部署环境等自定义字段
- 🛡️ **健壮**：非 git 目录、无 git 命令、浅克隆等场景不会中断构建

## Installation

```bash
pnpm i -D unplugin-build-stamp
```

## Usage

### Vite

```ts
// vite.config.ts
import buildStamp from 'unplugin-build-stamp/vite'

export default defineConfig({
  plugins: [
    buildStamp()
  ]
})
```

### Rollup

```ts
// rollup.config.js
import buildStamp from 'unplugin-build-stamp/rollup'

export default {
  plugins: [
    buildStamp()
  ]
}
```

### Webpack

```js
// webpack.config.js
module.exports = {
  plugins: [
    require('unplugin-build-stamp/webpack')()
  ]
}
```

### Rsbuild / Rspack / esbuild / Farm

```ts
import buildStamp from 'unplugin-build-stamp/rspack' // 或 /rsbuild /esbuild /farm /rolldown
```

> 也可以用 `<pkg>.raw(options, meta)` 自行接入其他构建器。

## What you get

注入后的全局常量默认叫 `__BUILD_STAMP__`：

```ts
// 业务代码里直接使用
console.info(__BUILD_STAMP__.version, __BUILD_STAMP__.shortHash)
```

构建产物中它会被替换成：

```js
console.info('1.2.3', 'a1b2c3d')
```

## TypeScript

引用本插件后，`__BUILD_STAMP__` 的全局类型会自动生效，无需额外配置：

```ts
import buildStamp from 'unplugin-build-stamp/vite'

// __BUILD_STAMP__ 已被识别为 BuildStamp
const version: string = __BUILD_STAMP__.version
```

如果业务代码与插件配置不在同一处（例如常量只在某个 `.ts` 里用，而插件配在 `vite.config.ts`），可用三斜线引用显式引入：

```ts
/// <reference types="unplugin-build-stamp/client" />
```

也可以直接从这里取类型：

```ts
import type { BuildStamp, BuildStampOptions } from 'unplugin-build-stamp/client'
```

## Options

```ts
buildStamp({
  // 模块 id 前缀，只在匹配的模块中注入
  // 默认：虚拟模块 + 任意绝对路径，node_modules 自动跳过
  include: ['\0', 'virtual:', '/'],

  // 计算指纹的目录，用于向上查找 package.json 与 git 仓库
  // 默认：process.cwd()
  cwd: process.cwd(),

  // 注入的全局常量名
  // 默认：'__BUILD_STAMP__'
  name: '__BUILD_STAMP__',

  // 是否在构建时打印最终指纹
  // 默认：true
  log: true,

  // 在默认指纹上附加或覆盖字段
  extra: {
    env: process.env.NODE_ENV,
    ciBuildId: process.env.CI_BUILD_ID
  }
})
```

## Injected shape

```ts
interface BuildStamp {
  /** package.json 中的 version */
  version: string
  /** package.json 中的 name */
  name: string
  /** 完整 40 位 commit hash */
  hash: string
  /** 7 位短 hash */
  shortHash: string
  /** 当前分支，detached HEAD 时为 `HEAD` */
  branch: string
  /** 最近一次提交时间，ISO 8601 */
  commitTime: string
  /** 构建时间，ISO 8601 */
  buildTime: string
  /** 工作区是否有未提交改动 */
  dirty: boolean
}
```

## Programmatic API

如果不想走构建器，也可以直接拿到这份数据：

```ts
import { createBuildStamp } from 'unplugin-build-stamp'

const stamp = createBuildStamp({
  cwd: process.cwd()
})
console.log(stamp.version, stamp.shortHash)
```

## Notes

- 指纹在**一次构建开始时**计算一次，构建过程中不会变化。
- `dirty` 依赖 `git status --porcelain`，在超大仓库里可能略慢；可用 `extra` 覆盖，或在自己的 CI 里先确保工作区干净。
- 非 git 环境（Docker 镜像、npm 打包产物）下 `hash` / `shortHash` 为空字符串，其余字段照常。

## License

MIT
