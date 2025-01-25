import Link from "next/link";
import React from "react";
import DesktopNavbar from "./desktop-navbar";
import MobileNavbar from "./mobile-navbar";
import { currentUser } from "@clerk/nextjs/server";
import { syncUser } from "@/actions/user.actions";
import Image from "next/image";

async function navbar() {
  const user = await currentUser();
  if (user) await syncUser();

  return (
    <nav className="sticky top-0 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link
              href="/"
              className="text-xl font-bold text-primary font-mono tracking-wider flex items-center"
            >
              <Image
                ref={null}
                src="/tambayan-logo.png"
                alt="Logo"
                width={40}
                height={40}
              />
              <span className="ml-2">TAMBAYAN</span>
            </Link>
          </div>

          <DesktopNavbar />
          <MobileNavbar />
        </div>
      </div>
    </nav>
  );
}

export default navbar;
