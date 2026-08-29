import { Instrument_Serif, Azeret_Mono } from "next/font/google";
import { getSessionProfile } from "@/lib/auth";
import { LandingPage } from "@/components/landing/landing-page";

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-landing-serif",
});

const mono = Azeret_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-landing-mono",
});

export default async function Home() {
  const profile = await getSessionProfile();

  return (
    <div className={`${serif.variable} ${mono.variable}`}>
      <LandingPage
        viewer={
          profile
            ? { fullName: profile.fullName, photoUrl: profile.photoUrl }
            : null
        }
      />
    </div>
  );
}
