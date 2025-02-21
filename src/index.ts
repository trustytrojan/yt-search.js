import VideoResult from './VideoResult.ts';
import ChannelResult from './ChannelResult.ts';
import PlaylistResult from './PlaylistResult.ts';
import { NextPageContext, SearchResult, SearchResultType } from './types.ts';

const baseUrl = 'https://www.youtube.com';

const getInitData = async (url: string) => {
	const page = await (await fetch(encodeURI(url))).text();

	const ytInitData = page.split('var ytInitialData =');
	if (ytInitData.length <= 1) throw new Error('ytInitialData not present in page');
	const data = ytInitData[1].split('</script>')[0].slice(0, -1);

	const itApiKey = page.split('innertubeApiKey');
	if (itApiKey.length <= 1) throw new Error('innertubeApiKey invalid');
	const apiToken = itApiKey[1].trim().split(',')[0].split('"')[2];

	const itCtx = page.split('INNERTUBE_CONTEXT');
	if (itCtx.length <= 1) throw Error('INNERTUBE_CONTEXT invalid');
	const context = JSON.parse(itCtx[1].trim().slice(2, -2));

	return { initdata: JSON.parse(data), apiToken, context };
};

const searchResultTypeMapping = Object.freeze({
	video: 'AQ',
	channel: 'Ag',
	playlist: 'Aw',
	movie: 'BA'
});

export const search = async (
	query: string,
	type?: SearchResultType
): Promise<{
	results: SearchResult[];
	nextPageCtx: NextPageContext;
}> => {
	const page = await getInitData(
		`${baseUrl}/results?search_query=${query}${type ? `&sp=EgIQ${searchResultTypeMapping[type]}%3D%3D` : ''}`
	);

	const nextPageCtx: NextPageContext = {
		key: page.apiToken,
		body: { context: page.context, continuation: null }
	};

	const results: SearchResult[] = [];

	for (const { continuationItemRenderer, itemSectionRenderer } of page.initdata.contents
		.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents) {
		if (continuationItemRenderer)
			nextPageCtx.body.continuation = continuationItemRenderer.continuationEndpoint.continuationCommand.token;
		else if (itemSectionRenderer)
			for (const item of itemSectionRenderer.contents) {
				if (VideoResult.canConstruct(item)) results.push(new VideoResult(item));
				else if (ChannelResult.canConstruct(item)) results.push(new ChannelResult(item));
				else if (PlaylistResult.canConstruct(item)) results.push(new PlaylistResult(item));
			}
	}

	return { results, nextPageCtx };
};

/**
 * Only returns the next page of results for a certain search query.
 * If `type` was passed into `search`, you will continue get the same type of results.
 * You can pass the same `NextPageContext` object from `search` on this function several times.
 */
export const nextPage = async (ctx: NextPageContext): Promise<SearchResult[]> => {
	const resp = await fetch(`${baseUrl}/youtubei/v1/search?key=${ctx.key}`, {
		method: 'POST',
		body: JSON.stringify(ctx.body)
	});

	if (resp.status === 403 && (await resp.text()).includes('automated queries')) throw 'ip-blacklisted';

	const page = await resp.json();

	if (!page.onResponseReceivedCommands?.[0]?.appendContinuationItemsAction)
		throw new Error('no data received from youtube; did you send nextPageCtx?');

	const { continuationItems } = page.onResponseReceivedCommands[0].appendContinuationItemsAction;
	const results: SearchResult[] = [];

	for (const conitem of continuationItems)
		if (conitem.continuationItemRenderer)
			ctx.body.continuation = conitem.continuationItemRenderer.continuationEndpoint.continuationCommand.token;
		else if (conitem.itemSectionRenderer)
			for (const item of conitem.itemSectionRenderer.contents)
				if (VideoResult.canConstruct(item)) results.push(new VideoResult(item));
				else if (ChannelResult.canConstruct(item)) results.push(new ChannelResult(item));
				else if (PlaylistResult.canConstruct(item)) results.push(new PlaylistResult(item));

	return results;
};
