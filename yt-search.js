// adapted from https://github.com/damonwonghv/youtube-search-api

const baseUrl = 'https://www.youtube.com';

/**
 * @param {string} url 
 */
const getInitData = async (url) => {
	let apiToken, context;
	const page = await (await fetch(encodeURI(url))).text();

	const ytInitData = page.split('var ytInitialData =');
	if (ytInitData.length === 1)
		throw new Error('ytInitialData not present in page');

	const data = ytInitData[1].split('</script>')[0].slice(0, -1);

	const itApiKey = page.split('innertubeApiKey');
	if (itApiKey.length > 1)
		apiToken = itApiKey[1].trim().split(',')[0].split('"')[2];

	const itCtx = page.split('INNERTUBE_CONTEXT');
	if (itCtx.length > 1)
		context = JSON.parse(itCtx[1].trim().slice(2, -2));

	return { initdata: JSON.parse(data), apiToken, context };
};

/**
 * @typedef {object} Thumbnail
 * @prop {string} url
 * @prop {number} width
 * @prop {number} height
 */

/**
 * These typedefs allow external JS to see the types without me having to `export` them.
 * @typedef {VideoResult} VideoResult
 * @typedef {ChannelResult} ChannelResult
 * @typedef {PlaylistResult} PlaylistResult
 * 
 * @typedef {VideoResult | ChannelResult | PlaylistResult} SearchResult
 * @typedef {'video' | 'channel' | 'playlist' | 'movie'} SearchResultType
 */

/**
 * @typedef {object} NextPageContext
 * @prop {string} key
 * @prop {{ context, continuation }} body
 */

const srTypeMapping = Object.freeze({
	video: 'AQ',
	channel: 'Ag',
	playlist: 'Aw',
	movie: 'BA'
});

/**
 * @param {string} query 
 * @param {SearchResultType} [type]
 */
export const search = async (query, type) => {
	const page = await getInitData(`${baseUrl}/results?search_query=${query}${type ? `&sp=EgIQ${srTypeMapping[type]}%3D%3D` : ''}`);

	/** @type {NextPageContext} */
	const nextPageCtx = { key: page.apiToken, body: { context: page.context, continuation: null } };

	const results = [];

	for (const { continuationItemRenderer, itemSectionRenderer } of page.initdata.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents) {
		if (continuationItemRenderer)
			nextPageCtx.body.continuation = continuationItemRenderer.continuationEndpoint.continuationCommand.token;
		else if (itemSectionRenderer)
			for (const item of itemSectionRenderer.contents) {
				if (VideoResult.canConstruct(item))
					results.push(new VideoResult(item));
				else if (ChannelResult.canConstruct(item))
					results.push(new ChannelResult(item));
				else if (PlaylistResult.canConstruct(item))
					results.push(new PlaylistResult(item));
			}
	}

	return { results, nextPageCtx };
};

/**
 * Only returns the next page of results for a certain search query.
 * If `type` was passed into `search`, you will continue get the same type of results.
 * You can pass the same `NextPageContext` object from `search` on this function several times.
 * @param {NextPageContext} ctx 
 */
export const nextPage = async (ctx) => {
	const resp = await fetch(`${baseUrl}/youtubei/v1/search?key=${ctx.key}`, {
		method: 'POST',
		body: JSON.stringify(ctx.body)
	});

	if (resp.status === 403 && (await resp.text()).includes('automated queries'))
		throw 'ip-blacklisted';

	const page = await resp.json();

	if (!page.onResponseReceivedCommands?.[0]?.appendContinuationItemsAction)
		throw new Error('no data received from youtube; did you send nextPageCtx?');

	const { continuationItems } = page.onResponseReceivedCommands[0].appendContinuationItemsAction;
	const results = [];

	for (const conitem of continuationItems)
		if (conitem.continuationItemRenderer)
			ctx.body.continuation = conitem.continuationItemRenderer.continuationEndpoint.continuationCommand.token;
		else if (conitem.itemSectionRenderer)
			for (const item of conitem.itemSectionRenderer.contents)
				if (VideoResult.canConstruct(item))
					results.push(new VideoResult(item));
				else if (ChannelResult.canConstruct(item))
					results.push(new ChannelResult(item));
				else if (PlaylistResult.canConstruct(item))
					results.push(new PlaylistResult(item));

	return results;
};

export const getPlaylistData = async (playlistId, limit = 0) => {
	const initData = await getInitData(`${baseUrl}/playlist?list=${playlistId}`);
	const sectionListRenderer = initData.initdata;
	const metadata = sectionListRenderer.metadata;

	if (sectionListRenderer?.contents) {
		const videoItems = sectionListRenderer.contents
			.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content
			.sectionListRenderer.contents[0].itemSectionRenderer.contents[0]
			.playlistVideoListRenderer.contents;

		const items = [];
		videoItems.forEach((item) => {
			let videoRender = item.playlistVideoRenderer;
			if (videoRender && videoRender.videoId) {
				items.push(VideoRender(item));
			}
		});

		return {
			items: (limit != 0) ? items.slice(0, limit) : items,
			metadata
		};
	}

	return 'invalid_playlist';
};

export const getChannelData = async (channelId) => {
	const endpoint = await `${youtubeEndpoint}/channel/${channelId}`;
	try {
		const page = await GetYoutubeInitData(endpoint);
		const tabs = page.initdata.contents.twoColumnBrowseResultsRenderer.tabs;
		const items = tabs
			.map((json) => {
				if (json && json.tabRenderer) {
					const tabRenderer = json.tabRenderer;
					const title = tabRenderer.title;
					const content = tabRenderer.content;
					return { title, content };
				}
			})
			.filter((y) => typeof y != "undefined");
		return await Promise.resolve(items);
	} catch (ex) {
		return await Promise.reject(ex);
	}
};

export const getHomePageShorts = async () => {
	const page = await getInitData(baseUrl);
	const shortResult =
		page.initdata.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.richGridRenderer.contents
			.filter((x) => {
				return x.richSectionRenderer;
			})
			.map((z) => z.richSectionRenderer.content)
			.filter((y) => y.richShelfRenderer)
			.map((u) => u.richShelfRenderer)
			.find((i) => i.title.runs[0].text == "Shorts");
	const res = shortResult.contents
		.map((z) => z.richItemRenderer)
		.map((y) => y.content.reelItemRenderer);
	return res.map((json) => ({
		id: json.videoId,
		type: "reel",
		thumbnail: json.thumbnail.thumbnails[0],
		title: json.headline.simpleText,
		inlinePlaybackEndpoint: json.inlinePlaybackEndpoint || {}
	}));
};

export const getHomePageVideos = async (limit = 0) => {
	const endpoint = await `${baseUrl}`;
	try {
		const page = await getInitData(endpoint);
		const sectionListRenderer = await page.initdata.contents
			.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content
			.richGridRenderer.contents;
		let items = await [];
		let otherItems = await [];
		await sectionListRenderer.forEach((item) => {
			if (item.richItemRenderer && item.richItemRenderer.content) {
				let videoRender = item.richItemRenderer.content.videoRenderer;
				if (videoRender && videoRender.videoId) {
					items.push(VideoRender(item.richItemRenderer.content));
				} else {
					otherItems.push(videoRender);
				}
			}
		});
		const itemsResult = limit != 0 ? items.slice(0, limit) : items;
		return await Promise.resolve({ items: itemsResult });
	} catch (ex) {
		await console.error(ex);
		return await Promise.reject(ex);
	}
};

class VideoResult {
	static isLive({ badges, thumbnailOverlays }) {
		if (badges && badges[0]?.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW')
			return true;
		if (thumbnailOverlays)
			for (const item of thumbnailOverlays)
				if (item?.thumbnailOverlayTimeStatusRenderer?.style === 'LIVE')
					return true;
		return false;
	}

	static canConstruct({ videoRenderer: vr, playlistVideoRenderer: pvr }) {
		return (vr || pvr)?.videoId;
	}

	type = 'video';

	constructor({ videoRenderer: vr, playlistVideoRenderer: pvr }) {
		vr ??= pvr;

		/** @type {string} */
		this.id = vr.videoId;

		/** @type {Thumbnail[]} */
		this.thumbnails = vr.thumbnail.thumbnails;

		/** @type {string} */
		this.title = vr.title.runs[0].text;

		this.channel = {
			/** @type {string?} */
			title: vr.ownerText?.runs?.[0]?.text ?? null,

			/** @type {Thumbnail[]} */
			thumbnails: vr.channelThumbnailSupportedRenderers.channelThumbnailWithLinkRenderer.thumbnail.thumbnails
		};

		this.live = VideoResult.isLive(vr);

		if (!this.live) {
			/** @type {string} */
			this.lengthText = vr.lengthText.simpleText;
		}

		const textRunsReducer = (prev, curr) => prev.text + curr.text;

		this.viewsText = {
			/** @type {string} */
			short: this.live ? vr.shortViewCountText.runs.reduce(textRunsReducer) : vr.shortViewCountText.simpleText,

			/** @type {string} */
			long: this.live ? vr.viewCountText.runs.reduce(textRunsReducer) : vr.viewCountText.simpleText
		};

		Object.defineProperty(this, 'type', { writable: false });
	}
}

class ChannelResult {
	static canConstruct({ channelRenderer: cr }) {
		return cr;
	}

	static getDescription({ descriptionSnippet }) {
		if (!descriptionSnippet?.runs)
			return null;
		let desc = '';
		for (const run of descriptionSnippet.runs)
			if (run?.text)
				desc += run.text;
		return desc;
	}

	type = 'channel';

	constructor({ channelRenderer: cr }) {
		/** @type {string} */
		this.id = cr.channelId;

		/** @type {Thumbnail[]} */
		this.thumbnails = cr.thumbnail.thumbnails;

		/** @type {string} */
		this.title = cr.title.simpleText;

		this.description = ChannelResult.getDescription(cr);

		/** @type {string} */
		this.subscribersText = cr.videoCountText.simpleText;

		Object.defineProperty(this, 'type', { writable: false });
	}
}

/**
 * @typedef {object} PlaylistVideo
 * @prop {string} id
 * @prop {string} title
 * @prop {string} length
 */

class PlaylistResult {
	static canConstruct({ playlistRenderer: pr }) {
		return pr?.playlistId;
	}

	type = 'playlist';

	constructor({ playlistRenderer: pr }) {
		/** @type {string} */
		this.id = pr.playlistId;

		/** @type {Thumbnail[]} */
		this.thumbnail = pr.thumbnails[0].thumbnails;

		/** @type {string} */
		this.title = pr.title.simpleText;

		/** @type {PlaylistVideo[]} */
		this.videos = pr.videos.map(v => ({
			id: v.childVideoRenderer.videoId,
			title: v.childVideoRenderer.title.simpleText,
			lengthText: v.childVideoRenderer.lengthText.simpleText
		}));

		Object.defineProperty(this, 'type', { writable: false });
	}
}
