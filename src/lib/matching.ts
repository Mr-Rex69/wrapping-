import { cacheGet, cacheSet } from "./cache";
import type { Album, Artist, Track } from "./types";

const MB = "https://musicbrainz.org/ws/2";
const CAA = "https://coverartarchive.org";
const norm = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const sleep = (ms:number) => new Promise(resolve => setTimeout(resolve, ms));
let mbNext = 0;
async function mbFetch<T>(path:string):Promise<T>{
  const wait=Math.max(0,mbNext-Date.now()); if(wait) await sleep(wait);
  mbNext=Date.now()+1100;
  const r=await fetch(`${MB}${path}`,{headers:{"User-Agent":"Wrapping/0.2.0 (https://github.com/Mr-Rex69/wrapping-)","Accept":"application/json"},cache:"no-store"});
  if(!r.ok) throw new Error(`MusicBrainz HTTP ${r.status}`);
  return r.json() as Promise<T>;
}
function artistCreditNames(credits:any[]):string{return (credits||[]).map(c=>(c.name||c.artist?.name||"")+(c.joinphrase||"")).join("").trim()}
function primaryArtistName(credits:any[]):string{const c=(credits||[])[0];return c?.name||c?.artist?.name||""}
function isExact(a:string,b:string){return !!norm(a)&&norm(a)===norm(b)}
export async function resolveArtist(a:Artist):Promise<Artist>{
  if(a.mbid){
    const key="mb-artist-meta:"+a.mbid;const cached=cacheGet<string[]>(key);
    if(cached)return {...a,tags:[...new Set([...a.tags,...cached])]};
    try{const d=await mbFetch<any>(`/artist/${a.mbid}?inc=aliases+tags+genres&fmt=json`);const names=[d.name,...(d.aliases||[]).map((x:any)=>x.name)];if(names.some((name:string)=>isExact(name,a.name))){const tags=[...(d.genres||[]).map((x:any)=>x.name),...(d.tags||[]).map((x:any)=>x.name)].filter(Boolean);cacheSet(key,tags,30*86400000);return {...a,tags:[...new Set([...a.tags,...tags])]};}return {...a,mbid:undefined};}catch{return {...a,mbid:undefined}}
  }
  const cacheKey="mb-artist:"+norm(a.name);
  const cached=cacheGet<Artist>(cacheKey);
  if(cached?.mbid) return {...a,mbid:cached.mbid,disambiguation:cached.disambiguation};
  try{
    const q=encodeURIComponent(`artist:"${a.name.replace(/["\\]/g," ")}"`);
    const d=await mbFetch<any>(`/artist/?query=${q}&fmt=json&limit=5`);
    const exact=(d.artists||[]).filter((x:any)=>isExact(x.name,a.name));
    if(exact.length===1){const found={...a,mbid:exact[0].id,disambiguation:exact[0].disambiguation||undefined};cacheSet(cacheKey,found,30*86400000);return found;}
    if(exact.length>1){
      const primary=exact.filter((x:any)=>x["primary-type"]==="Person"||x["primary-type"]==="Group");
      if(primary.length===1){const found={...a,mbid:primary[0].id,disambiguation:primary[0].disambiguation||undefined};cacheSet(cacheKey,found,30*86400000);return found;}
    }
  }catch{}
  return a;
}
export async function resolveAlbum(a:Album):Promise<Album>{
  const cacheKey="mb-album:"+norm(a.artist)+":"+norm(a.name)+":"+(a.mbid||"");
  const cached=cacheGet<Album>(cacheKey);
  if(cached) return {...a,...cached};
  if(a.mbid){
    try{
      const d=await mbFetch<any>(`/release/${a.mbid}?inc=artists+release-groups&fmt=json`);
      const artist=artistCreditNames(d["artist-credit"]);
      if(isExact(d.title,a.name)&&isExact(primaryArtistName(d["artist-credit"]),a.artist)){
        const found={...a,matched:true,matchedTitle:d.title,matchedArtist:artist,releaseMbid:d.id,releaseGroupMbid:d["release-group"]?.id,year:d.date?.slice(0,4),coverArt:`${CAA}/release/${d.id}/front-500`};
        cacheSet(cacheKey,found,30*86400000);return found;
      }
    }catch{}
  }
  try{
    const q=encodeURIComponent(`release:"${a.name.replace(/["\\]/g," ")}" AND artist:"${a.artist.replace(/["\\]/g," ")}"`);
    const d=await mbFetch<any>(`/release/?query=${q}&fmt=json&limit=10`);
    const exact=(d.releases||[]).filter((x:any)=>isExact(x.title,a.name)&&isExact(primaryArtistName(x["artist-credit"]),a.artist));
    if(exact.length===1){
      const x=exact[0];
      const found={...a,matched:true,matchedTitle:x.title,matchedArtist:artistCreditNames(x["artist-credit"]),releaseMbid:x.id,releaseGroupMbid:x["release-group"]?.id,year:x.date?.slice(0,4),coverArt:`${CAA}/release/${x.id}/front-500`};
      cacheSet(cacheKey,found,30*86400000);return found;
    }
    if(exact.length>1){
      const withDate=exact.filter((x:any)=>x.date);
      if(withDate.length===1){const x=withDate[0];const found={...a,matched:true,matchedTitle:x.title,matchedArtist:artistCreditNames(x["artist-credit"]),releaseMbid:x.id,releaseGroupMbid:x["release-group"]?.id,year:x.date?.slice(0,4),coverArt:`${CAA}/release/${x.id}/front-500`};cacheSet(cacheKey,found,30*86400000);return found;}
      const unmatched={...a,matched:false,matchNote:"Several releases share this exact album and artist name; artwork was withheld to avoid a wrong match."};
      cacheSet(cacheKey,unmatched,6*60*60*1000);return unmatched;
    }
    const unmatched={...a,matched:false,matchNote:"No exact artist-and-album match was found in MusicBrainz."};
    cacheSet(cacheKey,unmatched,6*60*60*1000);return unmatched;
  }catch{return {...a,matched:false,matchNote:"MusicBrainz could not verify this release right now."}}
}
export async function resolveTrackPreview(t:Track):Promise<Track>{
  try{
    const term=encodeURIComponent(`${t.name} ${t.artist}`);
    const r=await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=20`,{cache:"no-store"});
    if(!r.ok)return t;
    const d=await r.json() as any;
    const matches=(d.results||[]).filter((x:any)=>isExact(x.trackName,t.name)&&isExact(x.artistName,t.artist)&&x.previewUrl);
    if(matches.length===1)return {...t,previewUrl:matches[0].previewUrl,previewAlbum:matches[0].collectionName,previewArtwork:matches[0].artworkUrl100};
    return t;
  }catch{return t}
}
