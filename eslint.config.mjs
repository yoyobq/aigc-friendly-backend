// @ts-check
import eslint from '@eslint/js';
import eslintPluginBoundaries from 'eslint-plugin-boundaries';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import path from 'node:path';
import tseslint from 'typescript-eslint';

const PROJECT_ROOT = import.meta.dirname;
const CORE_ROOT = path.join(PROJECT_ROOT, 'src', 'core');
const INFRASTRUCTURE_ROOT = path.join(PROJECT_ROOT, 'src', 'infrastructure');
const MODULES_ROOT = path.join(PROJECT_ROOT, 'src', 'modules');
const TYPES_ROOT = path.join(PROJECT_ROOT, 'src', 'types');
const USECASES_ROOT = path.join(PROJECT_ROOT, 'src', 'usecases');
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');

const TRANSACTION_MANAGER_ORM_METHODS = new Set([
  'createQueryBuilder',
  'delete',
  'getRepository',
  'insert',
  'query',
  'save',
  'update',
]);

const LEGACY_BOUNDARY_PORT_FILES = new Set([
  path.join(CORE_ROOT, 'pagination', 'pagination.ports.ts'),
  path.join(CORE_ROOT, 'search', 'search.ports.ts'),
  path.join(CORE_ROOT, 'sort', 'sort.ports.ts'),
]);
const LEGACY_BOUNDARY_PORT_SPECIFIERS = new Set([
  '@core/pagination/pagination.ports',
  '@core/search/search.ports',
  '@core/sort/sort.ports',
]);
const LEGACY_TRANSACTION_MANAGER_ALIASES = new Set([
  `${path.join(MODULES_ROOT, 'account', 'base', 'services', 'account.service.ts')}#AccountTransactionManager`,
  `${path.join(MODULES_ROOT, 'verification-record', 'verification-record.service.ts')}#VerificationRecordTransactionManager`,
  `${path.join(MODULES_ROOT, 'async-task-record', 'async-task-record.service.ts')}#AsyncTaskRecordTransactionManager`,
]);
function isPathInside(targetPath, rootPath) {
  const relative = path.relative(rootPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveInternalImport(fromFile, specifier) {
  if (specifier.startsWith('.')) return path.resolve(path.dirname(fromFile), specifier);
  if (specifier.startsWith('@src/')) {
    return path.resolve(PROJECT_ROOT, 'src', specifier.slice('@src/'.length));
  }
  if (specifier.startsWith('@core/')) {
    return path.resolve(PROJECT_ROOT, 'src', 'core', specifier.slice('@core/'.length));
  }
  if (specifier.startsWith('@app-types/')) {
    return path.resolve(PROJECT_ROOT, 'src', 'types', specifier.slice('@app-types/'.length));
  }
  if (specifier.startsWith('@adapters/')) {
    return path.resolve(PROJECT_ROOT, 'src', 'adapters', specifier.slice('@adapters/'.length));
  }
  if (specifier.startsWith('@modules/')) {
    return path.resolve(PROJECT_ROOT, 'src', 'modules', specifier.slice('@modules/'.length));
  }
  if (specifier.startsWith('@usecases/')) {
    return path.resolve(PROJECT_ROOT, 'src', 'usecases', specifier.slice('@usecases/'.length));
  }
  if (specifier.startsWith('src/')) return path.resolve(PROJECT_ROOT, specifier);
  return null;
}

function getStaticPropertyName(node) {
  if (node.type !== 'MemberExpression') return null;
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string') {
    return node.property.value;
  }
  return null;
}

function getUsecaseScope(filePath) {
  if (!isPathInside(filePath, USECASES_ROOT)) return null;
  const [scope] = path.relative(USECASES_ROOT, filePath).split(path.sep);
  return scope && scope !== '..' ? scope : null;
}

function isUsecaseBoundaryContract(filePath) {
  if (!isPathInside(filePath, USECASES_ROOT)) return false;
  const relative = path.relative(USECASES_ROOT, filePath);
  return (
    relative.startsWith(`common${path.sep}`) &&
    (relative.endsWith('.contract') || relative.endsWith('.contract.ts'))
  );
}

function visitImportLike(context, node, visitor) {
  const specifier = typeof node.source?.value === 'string' ? node.source.value : null;
  if (!specifier) return;
  const targetPath = resolveInternalImport(context.filename, specifier);
  if (!targetPath) return;
  visitor(specifier, targetPath);
}

function visitRequire(context, node, visitor) {
  if (node.callee.type !== 'Identifier' || node.callee.name !== 'require') return;
  const firstArg = node.arguments[0];
  if (!firstArg || firstArg.type !== 'Literal' || typeof firstArg.value !== 'string') return;
  const targetPath = resolveInternalImport(context.filename, firstArg.value);
  if (!targetPath) return;
  visitor(firstArg.value, targetPath);
}

function visitDynamicImport(context, node, visitor) {
  if (node.source.type !== 'Literal' || typeof node.source.value !== 'string') return;
  const targetPath = resolveInternalImport(context.filename, node.source.value);
  if (!targetPath) return;
  visitor(node.source.value, targetPath);
}

const localArchitecturePlugin = {
  rules: {
    'no-boundary-port-naming-drift': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        function reportPortImportIfNeeded(node, specifier) {
          if (LEGACY_BOUNDARY_PORT_SPECIFIERS.has(specifier)) return;
          if (specifier.includes('transaction-runner.port')) {
            context.report({
              node,
              message:
                'TransactionRunner 边界契约固定使用 transaction-runner.contract.ts；禁止导入 transaction-runner.port。',
            });
            return;
          }
          if (!/(^|\/)[^/]+\.ports?(?:\.ts)?$/.test(specifier)) return;
          context.report({
            node,
            message:
              '新增 boundary contract 文件使用 *.contract.ts；禁止新增或导入 *.port.ts / *.ports.ts。',
          });
        }
        return {
          Program(node) {
            if (!isPathInside(context.filename, SRC_ROOT)) return;
            if (!/\.ports?\.ts$/.test(context.filename)) return;
            if (LEGACY_BOUNDARY_PORT_FILES.has(context.filename)) return;
            context.report({
              node,
              message:
                '新增 boundary contract 文件使用 *.contract.ts；禁止新增 *.port.ts / *.ports.ts。',
            });
          },
          ImportDeclaration(node) {
            visitImportLike(context, node, (specifier) => reportPortImportIfNeeded(node, specifier));
          },
          ExportNamedDeclaration(node) {
            visitImportLike(context, node, (specifier) => reportPortImportIfNeeded(node, specifier));
          },
          ExportAllDeclaration(node) {
            visitImportLike(context, node, (specifier) => reportPortImportIfNeeded(node, specifier));
          },
          CallExpression(node) {
            visitRequire(context, node, (specifier) => reportPortImportIfNeeded(node, specifier));
          },
          ImportExpression(node) {
            visitDynamicImport(context, node, (specifier) =>
              reportPortImportIfNeeded(node, specifier),
            );
          },
          Identifier(node) {
            if (node.name !== 'TransactionPort' && node.name !== 'UnitOfWork') return;
            context.report({
              node,
              message:
                '事务边界固定命名为 TransactionRunner；禁止新增 TransactionPort / UnitOfWork 并行抽象。',
            });
          },
        };
      },
    },
    'no-transaction-manager-alias': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        if (
          !isPathInside(context.filename, MODULES_ROOT) &&
          !isPathInside(context.filename, USECASES_ROOT)
        ) {
          return {};
        }
        function isAllowedLegacyAlias(typeName) {
          return LEGACY_TRANSACTION_MANAGER_ALIASES.has(`${context.filename}#${typeName}`);
        }
        function reportIfNeeded(node, typeName) {
          if (!typeName.endsWith('TransactionManager')) return;
          if (isAllowedLegacyAlias(typeName)) return;
          context.report({
            node,
            message:
              '禁止新增本地 *TransactionManager alias/interface；usecase 持有事务边界，modules(service) 只接收 transactionContext。',
          });
        }
        return {
          TSTypeAliasDeclaration(node) {
            reportIfNeeded(node, node.id.name);
          },
          TSInterfaceDeclaration(node) {
            reportIfNeeded(node, node.id.name);
          },
        };
      },
    },
    'no-usecase-transaction-manager-orm-api': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        if (!isPathInside(context.filename, USECASES_ROOT)) return {};
        const transactionContextNames = new Set();
        const sourceCode = context.sourceCode;
        function textMentionsTransactionContextType(node) {
          return /\b(?:PersistenceTransactionContext|TransactionManager|EntityManager)\b/.test(
            sourceCode.getText(node),
          );
        }
        function rememberTypedIdentifier(node) {
          if (node.type === 'Identifier') {
            if (node.typeAnnotation && textMentionsTransactionContextType(node.typeAnnotation)) {
              transactionContextNames.add(node.name);
              return;
            }
          }
          if (node.type === 'AssignmentPattern') rememberTypedIdentifier(node.left);
        }
        function isTransactionContextLikeExpression(node) {
          if (node.type === 'ChainExpression') return isTransactionContextLikeExpression(node.expression);
          if (node.type === 'Identifier') {
            const lowerName = node.name.toLowerCase();
            return (
              transactionContextNames.has(node.name) ||
              lowerName === 'transactioncontext' ||
              lowerName === 'activetransactioncontext' ||
              lowerName === 'manager' ||
              lowerName === 'txmanager' ||
              lowerName === 'activemanager' ||
              lowerName === 'transactionmanager'
            );
          }
          if (node.type !== 'MemberExpression') return false;
          const propertyName = getStaticPropertyName(node);
          if (!propertyName) return false;
          const lowerPropertyName = propertyName.toLowerCase();
          return (
            lowerPropertyName === 'transactioncontext' ||
            lowerPropertyName === 'activetransactioncontext' ||
            lowerPropertyName === 'manager' ||
            lowerPropertyName === 'txmanager' ||
            lowerPropertyName === 'activemanager' ||
            lowerPropertyName === 'transactionmanager'
          );
        }
        function rememberFunctionParams(node) {
          for (const param of node.params) rememberTypedIdentifier(param);
        }
        return {
          FunctionDeclaration: rememberFunctionParams,
          FunctionExpression: rememberFunctionParams,
          ArrowFunctionExpression: rememberFunctionParams,
          VariableDeclarator(node) {
            if (node.id.type !== 'Identifier') return;
            if (node.id.typeAnnotation && textMentionsTransactionContextType(node.id.typeAnnotation)) {
              transactionContextNames.add(node.id.name);
              return;
            }
            if (node.init && textMentionsTransactionContextType(node.init)) {
              transactionContextNames.add(node.id.name);
            }
          },
          CallExpression(node) {
            if (node.callee.type !== 'MemberExpression') return;
            const methodName = getStaticPropertyName(node.callee);
            if (!methodName || !TRANSACTION_MANAGER_ORM_METHODS.has(methodName)) return;
            if (!isTransactionContextLikeExpression(node.callee.object)) return;
            context.report({
              node: node.callee,
              message:
                'Usecase 只能传递 transaction context，不得直接调用事务上下文的 ORM API。',
            });
          },
        };
      },
    },
    'no-infrastructure-to-modules-imports': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        if (!isPathInside(context.filename, INFRASTRUCTURE_ROOT)) return {};
        function checkImport(node, specifier, targetPath) {
          if (!isPathInside(targetPath, MODULES_ROOT)) return;
          context.report({
            node,
            message:
              'Infrastructure 层禁止依赖 modules 实现；仅允许依赖 module-owned boundary contract。',
            data: { specifier },
          });
        }
        function reportIfNeeded(node) {
          visitImportLike(context, node, (specifier, targetPath) =>
            checkImport(node, specifier, targetPath),
          );
        }
        return {
          ImportDeclaration: reportIfNeeded,
          ExportNamedDeclaration: reportIfNeeded,
          ExportAllDeclaration: reportIfNeeded,
          CallExpression(node) {
            visitRequire(context, node, (specifier, targetPath) =>
              checkImport(node, specifier, targetPath),
            );
          },
          ImportExpression(node) {
            visitDynamicImport(context, node, (specifier, targetPath) =>
              checkImport(node, specifier, targetPath),
            );
          },
        };
      },
    },
    'no-cross-domain-usecases-imports': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        const fromScope = getUsecaseScope(context.filename);
        if (!fromScope) return {};
        function checkImport(node, specifier, targetPath) {
          if (!isPathInside(targetPath, USECASES_ROOT)) return;
          if (isUsecaseBoundaryContract(targetPath)) return;
          const toScope = getUsecaseScope(targetPath);
          if (!toScope || toScope === fromScope) return;
          context.report({
            node,
            message: 'Usecase 层仅允许同域依赖；禁止跨 usecase bounded context import。',
            data: { fromScope, specifier, toScope },
          });
        }
        function reportIfNeeded(node) {
          visitImportLike(context, node, (specifier, targetPath) =>
            checkImport(node, specifier, targetPath),
          );
        }
        return {
          ImportDeclaration: reportIfNeeded,
          ExportNamedDeclaration: reportIfNeeded,
          ExportAllDeclaration: reportIfNeeded,
          CallExpression(node) {
            visitRequire(context, node, (specifier, targetPath) =>
              checkImport(node, specifier, targetPath),
            );
          },
          ImportExpression(node) {
            visitDynamicImport(context, node, (specifier, targetPath) =>
              checkImport(node, specifier, targetPath),
            );
          },
        };
      },
    },
    'no-types-to-core-imports': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        if (!isPathInside(context.filename, TYPES_ROOT)) return {};
        function checkImport(node, specifier, targetPath) {
          if (!isPathInside(targetPath, CORE_ROOT)) return;
          context.report({
            node,
            message: 'Types 层禁止依赖 core；types 是最底层共享契约。',
            data: { specifier },
          });
        }
        function reportIfNeeded(node) {
          visitImportLike(context, node, (specifier, targetPath) =>
            checkImport(node, specifier, targetPath),
          );
        }
        return {
          ImportDeclaration: reportIfNeeded,
          ExportNamedDeclaration: reportIfNeeded,
          ExportAllDeclaration: reportIfNeeded,
          CallExpression(node) {
            visitRequire(context, node, (specifier, targetPath) =>
              checkImport(node, specifier, targetPath),
            );
          },
          ImportExpression(node) {
            visitDynamicImport(context, node, (specifier, targetPath) =>
              checkImport(node, specifier, targetPath),
            );
          },
        };
      },
    },
  },
};

export default defineConfig(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      boundaries: eslintPluginBoundaries,
      'local-architecture': localArchitecturePlugin,
    },
    settings: {
      'boundaries/dependency-nodes': ['import'],
      'boundaries/elements': [
        { type: 'adapters-common', pattern: 'src/adapters/api/graphql/decorators', mode: 'folder' },
        { type: 'adapters-common', pattern: 'src/adapters/api/graphql/guards', mode: 'folder' },
        { type: 'adapters-common', pattern: 'src/adapters/api/graphql/common', mode: 'folder' },
        { type: 'adapters-common', pattern: 'src/adapters/api/graphql/schema', mode: 'folder' },
        { type: 'adapters-common', pattern: 'src/adapters/api/graphql/*.ts', mode: 'file' },
        {
          type: 'api-adapters-scope',
          pattern: 'src/adapters/api/graphql/*',
          mode: 'folder',
          capture: ['adapterScope'],
        },
        {
          type: 'worker-adapters-scope',
          pattern: 'src/adapters/worker/*',
          mode: 'folder',
          capture: ['adapterScope'],
        },
        {
          type: 'adapters-integration',
          pattern: 'src/adapters/api/integration-events',
          mode: 'folder',
        },
        { type: 'usecases', pattern: 'src/usecases/**' },
        {
          type: 'modules-queries',
          pattern: 'src/modules/*/**/queries',
          mode: 'folder',
          capture: ['moduleScope'],
        },
        {
          type: 'modules-queries',
          pattern: 'src/modules/*/**/*.query.service.ts',
          mode: 'file',
          capture: ['moduleScope'],
        },
        {
          type: 'modules-services',
          pattern: 'src/modules/*/**/services',
          mode: 'folder',
          capture: ['moduleScope'],
        },
        {
          type: 'modules-services',
          pattern: 'src/modules/*/**/service',
          mode: 'folder',
          capture: ['moduleScope'],
        },
        { type: 'infrastructure', pattern: 'src/infrastructure/**' },
        { type: 'core', pattern: 'src/core/**' },
        { type: 'types', pattern: 'src/types/**' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: { type: 'api-adapters-scope' },
              allow: [
                { to: { type: 'adapters-common' } },
                {
                  to: {
                    type: 'api-adapters-scope',
                    captured: { adapterScope: '{{from.adapterScope}}' },
                  },
                },
                { to: { type: 'usecases' } },
                { to: { type: 'core' } },
                { to: { type: 'types' } },
              ],
            },
            {
              from: { type: 'worker-adapters-scope' },
              allow: [
                {
                  to: {
                    type: 'worker-adapters-scope',
                    captured: { adapterScope: '{{from.adapterScope}}' },
                  },
                },
                { to: { type: 'usecases' } },
                { to: { type: 'core' } },
                { to: { type: 'types' } },
              ],
            },
            {
              from: { type: 'adapters-common' },
              allow: [
                { to: { type: 'adapters-common' } },
                { to: { type: 'core' } },
                { to: { type: 'types' } },
              ],
            },
            {
              from: { type: 'adapters-integration' },
              allow: [
                { to: { type: 'usecases' } },
                { to: { type: 'core' } },
                { to: { type: 'types' } },
              ],
            },
            {
              from: { type: 'usecases' },
              allow: [
                { to: { type: 'usecases' } },
                { to: { type: 'modules-queries' } },
                { to: { type: 'modules-services' } },
                { to: { type: 'core' } },
                { to: { type: 'types' } },
              ],
            },
            {
              from: { type: 'modules-queries' },
              allow: [
                {
                  to: {
                    type: 'modules-queries',
                    captured: { moduleScope: '{{from.moduleScope}}' },
                  },
                },
                { to: { type: 'core' } },
                { to: { type: 'types' } },
              ],
            },
            {
              from: { type: 'modules-services' },
              allow: [
                {
                  to: {
                    type: 'modules-services',
                    captured: { moduleScope: '{{from.moduleScope}}' },
                  },
                },
                { to: { type: 'infrastructure' } },
                { to: { type: 'core' } },
                { to: { type: 'types' } },
              ],
            },
            {
              from: { type: 'infrastructure' },
              allow: [
                { to: { type: 'infrastructure' } },
                { to: { type: 'core' } },
                { to: { type: 'types' } },
              ],
            },
            {
              from: { type: 'core' },
              allow: [{ to: { type: 'core' } }, { to: { type: 'types' } }],
            },
            {
              from: { type: 'types' },
              allow: [{ to: { type: 'types' } }],
            },
          ],
        },
      ],
      'local-architecture/no-boundary-port-naming-drift': 'error',
      'local-architecture/no-transaction-manager-alias': 'error',
      'local-architecture/no-usecase-transaction-manager-orm-api': 'error',
      'local-architecture/no-infrastructure-to-modules-imports': 'error',
      'local-architecture/no-cross-domain-usecases-imports': 'error',
      'local-architecture/no-types-to-core-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-expressions': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: ['src/types/**', '@src/types/**', '**/src/types/**'],
        },
      ],
      'prefer-const': 'error',
      'no-var': 'error',
      complexity: ['warn', 15],
      'max-depth': ['warn', 4],
      'max-lines-per-function': ['warn', 100],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variableLike',
          format: ['camelCase', 'UPPER_CASE'],
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'property',
          format: ['camelCase', 'snake_case', 'UPPER_CASE'],
        },
        {
          selector: 'parameter',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
      ],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@nestjs/*',
            'graphql',
            'typeorm',
            'src/types/**',
            '@src/types/**',
            '**/src/types/**',
          ],
        },
      ],
    },
  },
  {
    files: ['src/usecases/**/*.ts'],
    rules: {
      'max-lines-per-function': ['warn', 200],
    },
  },
  {
    files: ['test/**/*.ts', '**/*.spec.ts', '**/*.test.ts', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-console': 'off',
    },
  },
);
