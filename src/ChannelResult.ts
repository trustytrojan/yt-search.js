import { Thumbnail } from './types.ts';

export default class ChannelResult {
	type = 'channel';
	id: string;
	thumbnails: Thumbnail[];
	title: string;
	description: string | null;
	subscribersText: string;

	static canConstruct({ channelRenderer: cr }: any) {
		return cr;
	}

	static getDescription({ descriptionSnippet }: any) {
		if (!descriptionSnippet?.runs) return null;
		let desc = '';
		for (const run of descriptionSnippet.runs) if (run?.text) desc += run.text;
		return desc;
	}

	constructor({ channelRenderer: cr }: any) {
		this.id = cr.channelId;
		this.thumbnails = cr.thumbnail.thumbnails;
		this.title = cr.title.simpleText;
		this.description = ChannelResult.getDescription(cr);
		this.subscribersText = cr.videoCountText.simpleText;
		Object.defineProperty(this, 'type', { writable: false });
	}
}
