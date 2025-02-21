import { search, nextPage } from '../src/index.ts';

const results = await search('hello world');
const nextResults = await nextPage(results.nextPageCtx);
console.log(nextResults);
