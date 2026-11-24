import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Wrapping — Your year in sound",description:"A personal listening recap powered by Last.fm and ListenBrainz."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
