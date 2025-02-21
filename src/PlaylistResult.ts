import { PlaylistVideo, Thumbnail } from './types.ts';

export default class PlaylistResult {
	type = 'playlist';
	id: string;
	thumbnail: Thumbnail[];
	title: string;
	videos: PlaylistVideo[];

	static canConstruct({ playlistRenderer: pr }: any): boolean {
		return pr?.playlistId;
	}

	constructor({ playlistRenderer: pr }: any) {
		this.id = pr.playlistId;
		this.thumbnail = pr.thumbnails[0].thumbnails;
		this.title = pr.title.simpleText;
		this.videos = pr.videos.map((v: any) => ({
			id: v.childVideoRenderer.videoId,
			title: v.childVideoRenderer.title.simpleText,
			lengthText: v.childVideoRenderer.lengthText.simpleText
		}));
		Object.defineProperty(this, 'type', { writable: false });
	}
}
