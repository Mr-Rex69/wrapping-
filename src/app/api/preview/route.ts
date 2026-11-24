import { NextRequest, NextResponse } from "next/server";
export const runtime="nodejs";
const allowedHosts=new Set(["audio-ssl.itunes.apple.com","audio.itunes.apple.com"]);
export async function GET(request:NextRequest){
 const raw=request.nextUrl.searchParams.get("url");
 if(!raw)return NextResponse.json({error:"A preview URL is required."},{status:400});
 let current:URL;
 try{current=new URL(raw)}catch{return NextResponse.json({error:"Invalid preview URL."},{status:400})}
 if(current.protocol!=="https:"||!allowedHosts.has(current.hostname))return NextResponse.json({error:"Only verified iTunes preview hosts are allowed."},{status:400});
 try{
  let upstream:Response|undefined;
  for(let attempt=0;attempt<4;attempt++){
   upstream=await fetch(current,{redirect:"manual",cache:"force-cache",next:{revalidate:3600}});
   if([301,302,303,307,308].includes(upstream.status)){
    const location=upstream.headers.get("location");
    if(!location)throw new Error("Preview redirect did not include a destination.");
    current=new URL(location,current);
    if(current.protocol!=="https:"||!allowedHosts.has(current.hostname))throw new Error("Preview redirected to an untrusted host.");
    continue;
   }
   break;
  }
  if(!upstream?.ok)throw new Error("The music preview is temporarily unavailable.");
  const contentType=upstream.headers.get("content-type")||"";
  if(!contentType.startsWith("audio/")&&!contentType.includes("octet-stream"))throw new Error("The preview response was not an audio file.");
  const bytes=await upstream.arrayBuffer();
  if(bytes.byteLength>10*1024*1024)throw new Error("The preview file exceeded the size limit.");
  return new Response(bytes,{headers:{"Content-Type":contentType||"audio/mp4","Cache-Control":"public, max-age=3600","Content-Length":String(bytes.byteLength)}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not load the preview."},{status:502})}
}
