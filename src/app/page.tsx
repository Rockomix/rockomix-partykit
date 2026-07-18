import { CreateParty } from "../components/create-party";
import Link from "next/link";
import { LogoBrand } from "~/components/logo-brand";
import { esMX } from "~/locales/es-MX";

export default async function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <div className="p-4">
        {/* Publicidad futura Rockomix
        <Alert
          variant={"default"}
          className="m-2 bg-purple-600 duration-500 animate-in slide-in-from-top"
        >
          <Megaphone className="h-5 w-5" />
          <AlertTitle>Want to make your own karaoke?</AlertTitle>
          <AlertDescription>
            <p className="mt-4">
              Now you can with MyKaraoke Video. It takes 2 minutes!
            </p>
            <p className="mt-4">
              <a
                target="_blank"
                href="https://www.mykaraoke.video?ref=mykaraoke.party"
              >
                <Button>Try it now!</Button>
              </a>
            </p>
          </AlertDescription>
        </Alert>
        */}
      </div>
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 ">
        <LogoBrand size="lg" />

        <CreateParty />

        <div>
          <Link href="/terms-of-service" className="hover:underline">
            {esMX.landing.termsOfService}
          </Link>
        </div>
      </div>
    </main>
  );
}
