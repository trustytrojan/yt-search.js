import { search } from '../src/index.ts';

const results = await search('hello world');
console.log(results);
