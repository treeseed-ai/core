import { astroBin, runNodeBinary } from '../packages/package-tools.ts';

const args = process.argv.slice(2);

runNodeBinary(astroBin, args, { cwd: process.cwd() });
