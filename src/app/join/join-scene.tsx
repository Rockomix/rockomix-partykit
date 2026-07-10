"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "@mantine/hooks";
import logo from "~/assets/my-karaoke-party-logo.png";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/ui/form";
import { Input } from "~/components/ui/ui/input";
import { ButtonHoverGradient } from "~/components/ui/ui/button-hover-gradient";
import { useEffect } from "react";

const formSchema = z.object({
  partyCode: z.string().min(8),
  name: z.string().min(2).max(20),
});

export default function JoinScene({ partyHash }: { partyHash?: string }) {
  const router = useRouter();

  const [name, setName] = useLocalStorage({
    key: "name",
    defaultValue: "",
  });

  // 1. Define your form.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      partyCode: partyHash,
      name: name,
    },
  });

  // 2. Define a submit handler.
  function onSubmit(values: z.infer<typeof formSchema>) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
    console.log(values);

    setName(values.name);

    router.push(`/party/${partyHash}`);
  }

  useEffect(() => {
    form.setValue("name", name);
  }, [name, form]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center text-white">
      <div className="hero min-h-screen bg-base-200">
        <div className="hero-content text-center">
          <div className="max-w-xl p-5">
            <Image
              src={logo}
              width={666}
              height={375}
              alt="My Karaoke Party logo"
              priority={true}
              placeholder="blur"
            />
            <h1 className="text-outline text-4xl font-bold">Join a Party!</h1>
            <p className="py-6">
              Join a party by entering the party code and your name.
            </p>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col space-y-4 text-left"
              >
                <FormField
                  control={form.control}
                  name="partyCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter the party code..."
                          className="input input-bordered w-full"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your name..."
                          className="input input-bordered w-full"
                          autoFocus
                          minLength={3}
                          maxLength={20}
                          required
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <ButtonHoverGradient
                  type="submit"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? "Joining..." : "Join Party 🎉"}
                </ButtonHoverGradient>
              </form>
            </Form>
          </div>
        </div>
      </div>

      {/* <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 ">
        <Image
          src={logo}
          width={666}
          height={375}
          alt="My Karaoke Party logo"
          priority={true}
          placeholder="blur"
        />

        <h1>Join Party!</h1>


      </div> */}
    </main>
  );
}
