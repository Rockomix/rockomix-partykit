import { CreateParty } from "../components/create-party";
import Link from "next/link";
import { LogoBrand } from "~/components/logo-brand";
import { esMX } from "~/locales/es-MX";

export default async function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
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
