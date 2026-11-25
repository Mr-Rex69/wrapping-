import { cacheGet, cacheSet } from "./cache";
import type { Album, Artist, Track } from "./types";

const API = "https://www.googleapis.com/youtube/v3";
const norm=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
async function search(q:string,type:"video"|"channel"){
 const key=process.env.YOUTUBE_API_KEY;
 if(!key)return [];
 const cacheKey="youtube:"+type+":"+norm(q);
 const cached=cacheGet<any[]>(cacheKey);if(cached)return cached;
 try{
  const u=new URL(API+"/search");
  u.search=new URLSearchParams({part:"snippet",q,type,maxResults:"8",safeSearch:"none",...(type==="video"?{videoEmbeddable:"true",videoSyndicated:"true"}:{}) ,key}).toString();
  const r=await fetch(u,{cache:"no-store"});
  if(!r.ok)return [];
  const d=await r.json() as any;
  const rows=Array.isArray(d.items)?d.items:[];
  cacheSet(cacheKey,rows,30*86400000);
  return rows;
 }catch{return []}
}
function scoreMatch(title:string,artist:string){
 const a=norm(title).split(" ").filter(x=>x.length>1);
 const b=norm(artist).split(" ").filter(x=>x.length>1);
 const joined=" "+a.join(" ")+" ";
 const hits=b.filter(x=>joined.includes(" "+x+" ")).length;
 return b.length?hits/b.length:0;
}
export async function enrichTrackWithYouTube(track:Track):Promise<Track>{
 if(!process.env.YOUTUBE_API_KEY)return track;
 const rows=await search(track.name+" "+track.artist+" official audio", "video");
 const candidates=rows.map((x:any)=>({x,score:scoreMatch(x.snippet?.title||"",track.artist)}))
  .filter(({x,score})=>x.id?.videoId&&score>=0.5&&norm(x.snippet?.title||"").includes(norm(track.name)));
 candidates.sort((a,b)=>b.score-a.score);
 const best=candidates[0]?.x;if(!best)return track;
 return {...track,youtubeVideoId:best.id.videoId,youtubeThumbnail:best.snippet?.thumbnails?.high?.url||best.snippet?.thumbnails?.medium?.url||best.snippet?.thumbnails?.default?.url};
}
export async function enrichArtistWithYouTube(artist:Artist):Promise<Artist>{
 if(!process.env.YOUTUBE_API_KEY)return artist;
 const rows=await search(artist.name+" official artist channel","channel");
 const exact=rows.filter((x:any)=>norm(x.snippet?.title||"")===norm(artist.name));
 const candidate=exact[0]||rows.find((x:any)=>scoreMatch(x.snippet?.title||"",artist.name)===1);
 const image=candidate?.snippet?.thumbnails?.high?.url||candidate?.snippet?.thumbnails?.medium?.url;
 return image?{...artist,youtubeImage:image}:artist;
}
export async function enrichAlbumWithYouTube(album:Album):Promise<Album>{
 if(!process.env.YOUTUBE_API_KEY)return album;
 const rows=await search(album.name+" "+album.artist+" official album","video");
 const candidate=rows.find((x:any)=>x.id?.videoId&&norm(x.snippet?.title||"").includes(norm(album.name))&&scoreMatch(x.snippet?.title||"",album.artist)>=0.5);
 const image=candidate?.snippet?.thumbnails?.high?.url||candidate?.snippet?.thumbnails?.medium?.url;
 return image?{...album,youtubeArtwork:image}:album;
}
