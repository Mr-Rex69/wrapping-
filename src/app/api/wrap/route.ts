import { NextRequest, NextResponse } from "next/server";
import { buildWrap } from "@/lib/music";
import type { Source } from "@/lib/types";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const source=request.nextUrl.searchParams.get("source") as Source|null;
 const username=request.nextUrl.searchParams.get("username")?.trim();
 if(source!=="lastfm"&&source!=="listenbrainz")return NextResponse.json({error:"Choose Last.fm or ListenBrainz."},{status:400});
 if(!username||username.length>64||!/^[\w.-]+$/.test(username))return NextResponse.json({error:"Enter a valid username."},{status:400});
 try{return NextResponse.json(await buildWrap(source,username))}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not load listening data."},{status:502})}
}
