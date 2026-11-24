import { cacheGet, cacheSet } from "./cache";
import { resolveAlbum, resolveArtist, resolveTrackPreview } from "./matching";
import type { Album, Artist, Listen, Source, Track, WrapData } from "./types";
const LASTFM="https://ws.audioscrobbler.com/2.0/", LB="https://api.listenbrainz.org/1";
const list=<T,>(v:T|T[]|undefined):T[]=>v?(Array.isArray(v)?v:[v]):[];
const num=(v:unknown)=>Number(v||0);
async function get<T>(url:string,headers?:Record<string,string>):Promise<T>{const r=await fetch(url,{headers:{"User-Agent":"Wrapping/0.2.0",...headers},cache:"no-store"});if(!r.ok)throw new Error(`Music service returned HTTP ${r.status}`);return r.json() as Promise<T>}
async function lastfm(method:string,params:Record<string,string>={}){const key=process.env.LASTFM_API_KEY;if(!key)throw new Error("Last.fm is not configured. Add LASTFM_API_KEY to the server environment.");const u=new URL(LASTFM);u.search=new URLSearchParams({method,api_key:key,format:"json",...params}).toString();const d=await get<any>(u.toString());if(d.error)throw new Error(d.message||"Last.fm API error");return d}
async function fromLastfm(username:string){
 const [ar,tr,al,re]=await Promise.all([
  lastfm("user.getTopArtists",{user:username,period:"12month",limit:"1000"}),
  lastfm("user.getTopTracks",{user:username,period:"12month",limit:"100"}),
  lastfm("user.getTopAlbums",{user:username,period:"12month",limit:"10"}),
  lastfm("user.getRecentTracks",{user:username,limit:"200"})
 ]);
 const artistRows=list(ar.topartists?.artist);
 const totalPages=Math.max(1,num(ar.topartists?.["@attr"]?.totalPages));
 for(let page=2;page<=totalPages;page+=1){const next=await lastfm("user.getTopArtists",{user:username,period:"12month",limit:"1000",page:String(page)});artistRows.push(...list(next.topartists?.artist));}
 const topArtists:Artist[]=artistRows.map((a:any)=>({name:a.name,playcount:num(a.playcount),mbid:a.mbid||undefined,image:list(a.image).at(-1)?.["#text"]||undefined,tags:[]}));
 const topTracks:Track[]=list(tr.toptracks?.track).map((t:any)=>({name:t.name,artist:t.artist?.name||t.artist?.["#text"]||"Unknown",playcount:num(t.playcount),mbid:t.mbid||undefined,url:t.url,album:t.album?.name||undefined}));
 const topAlbums:Album[]=list(al.topalbums?.album).map((a:any)=>({name:a.name,artist:a.artist?.name||a.artist?.["#text"]||"Unknown",playcount:num(a.playcount),mbid:a.mbid||undefined}));
 const listens:Listen[]=list(re.recenttracks?.track).filter((t:any)=>t.date?.uts).map((t:any)=>({artist:t.artist?.["#text"]||"Unknown",track:t.name,timestamp:num(t.date.uts)}));
 return{source:"lastfm" as const,username,totalScrobbles:topArtists.reduce((s,a)=>s+a.playcount,0),totalArtists:num(ar.topartists?.["@attr"]?.total)||topArtists.length,topArtists,topTracks,topAlbums,genreCountType:"artist-estimate" as const,listens};
}
async function fromListenBrainz(username:string){
 const headers=process.env.LISTENBRAINZ_USER_TOKEN?{Authorization:`Token ${process.env.LISTENBRAINZ_USER_TOKEN}`}:undefined;
 const u=encodeURIComponent(username);
 const [ar,tr,al,re,ga]=await Promise.all([
  get<any>(`${LB}/stats/user/${u}/artists?range=year&count=1000`,headers),
  get<any>(`${LB}/stats/user/${u}/recordings?range=year&count=100`,headers),
  get<any>(`${LB}/stats/user/${u}/releases?range=year&count=10`,headers),
  get<any>(`${LB}/user/${u}/listens?count=100`,headers)
 ]);
 const topArtists:Artist[]=list(ar.payload?.artists).map((a:any)=>({name:a.artist_name,playcount:num(a.listen_count),mbid:a.artist_mbid||undefined,tags:[]}));
 const topTracks:Track[]=list(tr.payload?.recordings).map((t:any)=>({name:t.track_name,artist:t.artist_name||"Unknown",playcount:num(t.listen_count),mbid:t.recording_mbid||undefined,album:t.release_name||undefined}));
 const topAlbums:Album[]=list(al.payload?.releases).map((a:any)=>({name:a.release_name,artist:a.artist_name||"Unknown",playcount:num(a.listen_count),mbid:a.release_mbid||undefined}));
 const listens:Listen[]=list(re.payload?.listens).map((l:any)=>({artist:l.track_metadata?.artist_name||"Unknown",track:l.track_metadata?.track_name||"Unknown",timestamp:num(l.listened_at)}));
 return{source:"listenbrainz" as const,username,totalScrobbles:num(ar.payload?.total_listen_count)||topArtists.reduce((s,a)=>s+a.playcount,0),totalArtists:num(ar.payload?.total_artist_count)||topArtists.length,topArtists,topTracks,topAlbums,listens};
}
async function enrichArtists(artists:Artist[]){
 const resolved:Artist[]=[];
 for(const artist of artists){const identified=await resolveArtist(artist);const key=`artist:${identified.mbid||identified.name.toLowerCase()}`;let info=cacheGet<any>(key);
  if(!info&&process.env.LASTFM_API_KEY){try{const r=await lastfm("artist.getInfo",identified.mbid?{mbid:identified.mbid}:{artist:identified.name});info={listeners:num(r.artist?.stats?.listeners),globalPlaycount:num(r.artist?.stats?.playcount),tags:list(r.artist?.tags?.tag).slice(0,5).map((t:any)=>t.name)};cacheSet(key,info,86400000)}catch{}}
  resolved.push(info?{...identified,...info,tags:[...new Set([...(identified.tags||[]),...(info.tags||[])])]}:identified);
 }
 return resolved;
}
function analyze(artists:Artist[],listens:Listen[]){const topArtistTotal=artists.reduce((s,a)=>s+a.playcount,0)||1,topFiveShare=Math.round(100*artists.slice(0,5).reduce((s,a)=>s+a.playcount,0)/topArtistTotal);const night=listens.filter(l=>{const h=new Date(l.timestamp*1000).getUTCHours();return h>=23||h<4}).length,early=listens.filter(l=>{const h=new Date(l.timestamp*1000).getUTCHours();return h>=6&&h<9}).length;const known=artists.filter(a=>a.listeners);const avg=known.reduce((s,a)=>s+(a.listeners||0),0)/(known.length||1);const first=artists[0];const multiplier=first?.listeners&&first.globalPlaycount?first.playcount/(first.globalPlaycount/first.listeners):null;return{uniqueArtists:new Set(artists.map(a=>a.mbid||a.name.toLowerCase())).size,nightOwlPercent:Math.round(100*night/(listens.length||1)),earlyBirdPercent:Math.round(100*early/(listens.length||1)),topFiveShare,undergroundScore:known.length?Math.round(avg):null,globalMultiplier:multiplier===null?null:Math.round(multiplier*10)/10}}
function makeBadges(s:ReturnType<typeof analyze>,artists:Artist[]){const b=[];if(s.undergroundScore!==null&&s.undergroundScore<50000)b.push({id:"underground",title:"Underground Explorer",description:"Your top artists lean far from the mainstream.",emoji:"🪩"});if(s.undergroundScore!==null&&s.undergroundScore>2e6)b.push({id:"charts",title:"Chart Topper",description:"You gravitate toward globally popular artists.",emoji:"🏆"});if(s.topFiveShare>60)b.push({id:"loyal",title:"One-Track Mind",description:"Your five most-played artists dominate your top 100.",emoji:"🎯"});if(s.topFiveShare<35)b.push({id:"variety",title:"Genre Hopper",description:"Your plays are spread across many artists.",emoji:"🧭"});if(s.nightOwlPercent>40)b.push({id:"night",title:"Night Owl",description:"Over 40% of sampled listens happen overnight (UTC).",emoji:"🦉"});if(s.earlyBirdPercent>30)b.push({id:"morning",title:"Early Bird",description:"Mornings are part of your soundtrack (UTC).",emoji:"🌅"});const tag=artists.flatMap(a=>a.tags).find(Boolean);if(tag)b.push({id:"genre",title:`${tag} Soul`,description:`Your top artists keep bringing you back to ${tag}.`,emoji:"🎧"});return b.slice(0,5)}
export async function buildWrap(source:Source,username:string):Promise<WrapData>{
 const key=`wrap:v3:${source}:${username.toLowerCase()}`;const cached=cacheGet<WrapData>(key);if(cached)return cached;
 const raw=source==="lastfm"?await fromLastfm(username):await fromListenBrainz(username);
 const allArtists=raw.topArtists;
 raw.topArtists=[...await enrichArtists(allArtists.slice(0,10)),...allArtists.slice(10)];
 const albums:Album[]=[];for(const album of raw.topAlbums.slice(0,8))albums.push(await resolveAlbum(album));raw.topAlbums=albums;
 const artistHighlights=raw.topArtists.slice(0,5).map(artist=>({artist,track:raw.topTracks.filter(track=>track.artist.toLowerCase()===artist.name.toLowerCase()).sort((a,b)=>b.playcount-a.playcount)[0]})).filter(x=>x.track);
 const previewCandidates=[...raw.topTracks.slice(0,10),...artistHighlights.map(x=>x.track)];
 const uniqueCandidates=[...new Map(previewCandidates.map(track=>[track.artist.toLowerCase()+"::"+track.name.toLowerCase(),track])).values()];
 const previews=await Promise.all(uniqueCandidates.map(track=>resolveTrackPreview(track)));
 const previewMap=new Map(previews.map(track=>[track.artist.toLowerCase()+"::"+track.name.toLowerCase(),track]));
 raw.topTracks=raw.topTracks.map(track=>previewMap.get(track.artist.toLowerCase()+"::"+track.name.toLowerCase())||track);
 raw.topArtists=raw.topArtists.map(artist=>({...artist,featuredTrack:artistHighlights.find(x=>x.artist.name===artist.name)?.track?previewMap.get(artistHighlights.find(x=>x.artist.name===artist.name)!.track.artist.toLowerCase()+"::"+artistHighlights.find(x=>x.artist.name===artist.name)!.track.name.toLowerCase()):undefined}));
 const ignoredTags=new Set(["seen live","favorites","favorite","favourite","awesome","love","beautiful","good","under 2000 listeners","my favorites"]);
 const genreTotals=new Map<string,{count:number;track?:Track}>();
 for(const artist of raw.topArtists){for(const rawTag of artist.tags||[]){const name=rawTag.trim();const key=name.toLowerCase();if(!name||ignoredTags.has(key)||name.length>32||/^\d/.test(name))continue;const current=genreTotals.get(key)||{count:0};current.count+=artist.playcount;const candidate=raw.topTracks.filter(track=>track.artist.toLowerCase()===artist.name.toLowerCase()).sort((a,b)=>b.playcount-a.playcount)[0];if(candidate&&(!current.track||candidate.playcount>current.track.playcount))current.track=candidate;genreTotals.set(key,current);}}
 const genres=[...genreTotals.entries()].map(([name,value])=>({name:name.replace(/\b\w/g,ch=>ch.toUpperCase()),count:value.count,topTrack:value.track})).sort((a,b)=>b.count-a.count).slice(0,20);
 const genreCandidates=genres.slice(0,8).map(genre=>genre.topTrack).filter((track):track is Track=>!!track&&!track.previewUrl);
 const genrePreviewResults=await Promise.all(genreCandidates.map(track=>resolveTrackPreview(track)));
 const genrePreviewMap=new Map(genrePreviewResults.map(track=>[track.artist.toLowerCase()+"::"+track.name.toLowerCase(),track]));
 for(const genre of genres){if(genre.topTrack){genre.topTrack=genrePreviewMap.get(genre.topTrack.artist.toLowerCase()+"::"+genre.topTrack.name.toLowerCase())||genre.topTrack;}}
 const exactGenreCounts="genreCounts" in raw?raw.genreCounts:[];const genreMap=new Map(genres.map(genre=>[genre.name.toLowerCase(),genre]));for(const item of exactGenreCounts){const previous=genreMap.get(item.name.toLowerCase());genreMap.set(item.name.toLowerCase(),{name:previous?.name||item.name,count:item.count,topTrack:previous?.topTrack});}const finalGenres=[...genreMap.values()].sort((a,b)=>b.count-a.count).slice(0,20);const stats=analyze(raw.topArtists,raw.listens);stats.uniqueArtists=raw.totalArtists;const result:WrapData={...raw,genres:finalGenres,genreCountType:raw.genreCountType,generatedAt:new Date().toISOString(),stats,badges:makeBadges(stats,raw.topArtists)};
 cacheSet(key,result,1800000);return result;
}
