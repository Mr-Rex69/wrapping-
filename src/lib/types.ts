export type Source = "lastfm" | "listenbrainz";
export type Artist = { name:string; playcount:number; mbid?:string; disambiguation?:string; listeners?:number; globalPlaycount?:number; tags:string[]; image?:string };
export type Track = { name:string; artist:string; playcount:number; album?:string; mbid?:string; url?:string; previewUrl?:string; previewAlbum?:string; previewArtwork?:string };
export type Album = { name:string; artist:string; playcount:number; mbid?:string; releaseMbid?:string; releaseGroupMbid?:string; matched?:boolean; matchedTitle?:string; matchedArtist?:string; matchNote?:string; coverArt?:string; year?:string };
export type Listen = { artist:string; track:string; timestamp:number };
export type WrapData = { source:Source; username:string; generatedAt:string; totalScrobbles:number; topArtists:Artist[]; topTracks:Track[]; topAlbums:Album[]; listens:Listen[]; badges:{id:string;title:string;description:string;emoji:string}[]; stats:{uniqueArtists:number;nightOwlPercent:number;earlyBirdPercent:number;topFiveShare:number;undergroundScore:number|null;globalMultiplier:number|null} };
