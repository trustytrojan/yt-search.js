import { search, nextPage } from '../src/index.ts';

const [_, nextPageCtx] = await search('hello world');
const nextResults = await nextPage(nextPageCtx);
console.log(nextResults);
