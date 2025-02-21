import { Thumbnail } from './types.ts';

const textRunsReducer = (prev, curr) => prev.text + curr.text;

export default class VideoResult {
	type = 'video';
	id: string;
	thumbnails: Thumbnail[];
	title: string;
	channel: {
		title: string | undefined;
		thumbnails: Thumbnail[];
	};
	live: boolean;
	lengthText: string | undefined;
	viewsText: {
		short: string;
		long: string;
	};

	static isLive({ badges, thumbnailOverlays }) {
		if (badges && badges[0]?.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW') return true;
		if (thumbnailOverlays)
			for (const item of thumbnailOverlays)
				if (item?.thumbnailOverlayTimeStatusRenderer?.style === 'LIVE') return true;
		return false;
	}

	static canConstruct({ videoRenderer: vr, playlistVideoRenderer: pvr }) {
		return (vr || pvr)?.videoId;
	}

	constructor({ videoRenderer: vr, playlistVideoRenderer: pvr }) {
		vr ??= pvr;
		this.id = vr.videoId;
		this.thumbnails = vr.thumbnail.thumbnails;
		this.title = vr.title.runs[0].text;

		this.channel = {
			title: vr.ownerText?.runs?.[0]?.text ?? null,
			thumbnails: vr.channelThumbnailSupportedRenderers.channelThumbnailWithLinkRenderer.thumbnail.thumbnails
		};

		if (!(this.live = VideoResult.isLive(vr))) {
			this.lengthText = vr.lengthText.simpleText;
		}

		this.viewsText = {
			short: this.live ? vr.shortViewCountText.runs.reduce(textRunsReducer) : vr.shortViewCountText.simpleText,
			long: this.live ? vr.viewCountText.runs.reduce(textRunsReducer) : vr.viewCountText.simpleText
		};

		Object.defineProperty(this, 'type', { writable: false });
	}
}
