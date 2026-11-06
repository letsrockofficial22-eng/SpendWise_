import { FlatCompat } from '@eslint/eslintrc';
import {fileURLToPath} from 'node:url';import {dirname} from 'node:path';
const compat=new FlatCompat({baseDirectory:dirname(fileURLToPath(import.meta.url))});
const config=[{ignores:['.next/**','node_modules/**','android/**','out/**','next-env.d.ts']},...compat.extends('next/core-web-vitals','next/typescript'),{rules:{'react/no-unescaped-entities':'off','@typescript-eslint/no-unused-vars':'off','@next/next/no-html-link-for-pages':'off'}}];

export default config;
