/**
 * 仅服务于本目录单测的 Jest 配置。
 *
 * fossflow-app 本身没有测试配置（rsbuild + SWC，不做类型检查），
 * 而改 package.json 会和别的 Agent 冲突，所以把配置收在本模块目录内，
 * 用 `npx jest --config <此文件>` 运行。
 *
 * moduleNameMapper 让本测试能直接引用 fossflow-lib 源码里的真实 modelSchema
 * （dist 只带 .d.ts，没有导出 schema 的 JS）。
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '../../../..',
  roots: ['<rootDir>/src/services/topologyImport'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/../fossflow-lib/src/$1',
    '^fossflow/src/(.*)$': '<rootDir>/../fossflow-lib/src/$1',
    '\\.css$': '<rootDir>/src/services/topologyImport/__tests__/styleMock.js'
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'es2020',
          jsx: 'react-jsx',
          esModuleInterop: true,
          isolatedModules: true
        }
      }
    ]
  }
};
