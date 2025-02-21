import ChannelResult from './ChannelResult.ts';
import PlaylistResult from './PlaylistResult.ts';
import VideoResult from './VideoResult.ts';

export interface Thumbnail {
	url: string;
	width: number;
	height: number;
}

export type SearchResult = VideoResult | ChannelResult | PlaylistResult;

export type SearchResultType = 'video' | 'channel' | 'playlist' | 'movie';

export interface NextPageContext {
	key: string;
	body: {
		context: any;
		continuation: any;
	};
}

export interface PlaylistVideo {
	id: string;
	title: string;
	length: string;
}
