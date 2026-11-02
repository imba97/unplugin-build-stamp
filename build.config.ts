import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
    'src/client',
    'src/frameworks/vite',
    'src/frameworks/rollup',
    'src/frameworks/rolldown',
    'src/frameworks/webpack',
    'src/frameworks/rspack',
    'src/frameworks/rsbuild',
    'src/frameworks/esbuild',
    'src/frameworks/farm',
  ],
  externals: ['unplugin'],
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
    esbuild: {
      minify: true,
    },
    dts: {
      respectExternal: true,
    },
  },
  clean: true,
  declaration: true,
})
