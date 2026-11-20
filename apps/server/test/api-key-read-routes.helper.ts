import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';

const SRC_DIR = join(__dirname, '..', 'src');

const HTTP_METHODS = [
  'Get',
  'Post',
  'Put',
  'Patch',
  'Delete',
  'All',
  'Head',
  'Options',
];

type DecoratorCall = { name: string; args: ts.NodeArray<ts.Expression> };

function decoratorCalls(node: ts.HasDecorators): DecoratorCall[] {
  return (ts.getDecorators(node) ?? [])
    .map((decorator) => decorator.expression)
    .filter(ts.isCallExpression)
    .map((call) => ({ name: call.expression.getText(), args: call.arguments }));
}

function pathsOf(arg?: ts.Expression): string[] {
  if (!arg) return [''];
  if (ts.isStringLiteralLike(arg)) return [arg.text];
  if (ts.isArrayLiteralExpression(arg)) return arg.elements.flatMap(pathsOf);
  if (ts.isObjectLiteralExpression(arg)) {
    const path = arg.properties.find(
      (property): property is ts.PropertyAssignment =>
        ts.isPropertyAssignment(property) && property.name.getText() === 'path',
    );
    return pathsOf(path?.initializer);
  }
  throw new Error(`Unsupported route path: ${arg.getText()}`);
}

function scopeOf(calls: DecoratorCall[], decorator: string): string {
  const call = calls.find((item) => item.name === decorator);
  if (!call) return undefined;
  const arg = call.args[0];
  if (!arg || !ts.isStringLiteralLike(arg)) {
    throw new Error(`@${decorator} must take a string literal`);
  }
  return arg.text;
}

// Reads controller sources and resolves scope tags the way JwtAuthGuard does.
export function listApiKeyReadRoutes(opts: {
  dir: string;
  excludeDir?: string;
}): string[] {
  const routes: string[] = [];

  const files = readdirSync(join(SRC_DIR, opts.dir), { recursive: true })
    .map((file) => join(opts.dir, String(file)))
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .filter(
      (file) => !opts.excludeDir || !file.startsWith(opts.excludeDir + '/'),
    );

  for (const file of files) {
    const text = readFileSync(join(SRC_DIR, file), 'utf8');
    if (!text.includes('@Controller(')) continue;

    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

    source.forEachChild((node) => {
      if (!ts.isClassDeclaration(node)) return;

      const classCalls = decoratorCalls(node);
      const controller = classCalls.find((call) => call.name === 'Controller');
      if (!controller) return;

      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;

        const calls = decoratorCalls(member);
        const route = calls.find((call) => HTTP_METHODS.includes(call.name));
        if (!route) continue;

        const scope =
          scopeOf(calls, 'ApiKeyScope') ??
          scopeOf(calls, 'OAuthScope') ??
          scopeOf(classCalls, 'OAuthScope');
        if (scope !== 'read') continue;

        for (const prefix of pathsOf(controller.args[0])) {
          for (const path of pathsOf(route.args[0])) {
            const url = [prefix, path]
              .map((part) => part.replace(/^\/+|\/+$/g, ''))
              .filter(Boolean)
              .join('/');
            routes.push(`${route.name.toUpperCase()} /${url}`);
          }
        }
      }
    });
  }

  return routes.sort();
}
