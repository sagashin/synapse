import type {Metadata} from 'next';
import {Chakra_Petch, Plus_Jakarta_Sans, JetBrains_Mono} from 'next/font/google';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/500.css';
import '@fontsource/noto-sans-jp/600.css';
import '@fontsource/noto-sans-jp/700.css';
import './globals.css';

const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-chakra',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'SYNAPSE ROGUE — 次世代SFローグライト脳トレ＆神経可塑性メインフレーム',
  description:
    'UFOV（有効視野）、進化型Dual N-Back、UCSF NeuroRacer準拠マルチタスク【LASER DRIVE】、およびリアルタイム動的難易度調整を搭載したSFローグライト脳トレWebアプリ。',
  openGraph: {
    title: 'SYNAPSE ROGUE — 次世代SFローグライト脳トレ＆神経可塑性メインフレーム',
    description:
      'UFOV（有効視野）、進化型Dual N-Back、UCSF NeuroRacer準拠マルチタスク【LASER DRIVE】、およびリアルタイム動的難易度調整を搭載したSFローグライト脳トレWebアプリ。',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SYNAPSE ROGUE — 次世代SFローグライト脳トレ＆神経可塑性メインフレーム',
    description:
      'UFOV（有効視野）、進化型Dual N-Back、UCSF NeuroRacer準拠マルチタスク【LASER DRIVE】、およびリアルタイム動的難易度調整を搭載したSFローグライト脳トレWebアプリ。',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html
      lang="ja"
      className={`${chakraPetch.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} dark`}
    >
      <body
        suppressHydrationWarning
        className="bg-[#0B0F19] text-slate-100 font-sans antialiased selection:bg-[#00F0FF]/30 selection:text-[#00F0FF] min-h-screen overflow-x-hidden"
      >
        {children}
      </body>
    </html>
  );
}
