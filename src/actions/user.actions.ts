"use server";

import { prisma } from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";

import { revalidatePath } from "next/cache";

export async function syncUser() {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) return;

    // Check if user already exists in the database
    const existingUser = await prisma.user.findUnique({
      where: { clerkID: userId },
    });

    if (existingUser) return existingUser;

    const dbUser = await prisma.user.create({
      data: {
        clerkID: userId,
        name: `${user.firstName || ""} ${user.lastName || ""}`,
        username:
          user.username ?? user.emailAddresses[0].emailAddress.split("@")[0],
        email: user.emailAddresses[0].emailAddress,
        image: user.imageUrl,
      },
    });

    return dbUser;
  } catch (error) {
    console.log("Error syncing user: ", error);
  }
}

/**
 * Finds a user in the database by their Clerk ID.
 *
 * @param {string} clerkID The Clerk ID of the user to find.
 * @returns {Promise<User | null>} The user found, or null if no user is found.
 */
export async function getUserByClerkID(clerkID: string) {
  return await prisma.user.findUnique({
    where: { clerkID },
    include: {
      _count: {
        select: {
          follower: true,
          following: true,
          posts: true,
        },
      },
    },
  });
}

/**
 * Returns the ID of the user in the database, based on the currently
 * authenticated user.
 *
 * @throws {Error} If the user is not authenticated.
 * @throws {Error} If the user is authenticated, but not found in the database.
 * @returns {Promise<number>} The ID of the user in the database.
 */
export async function getDbUserId() {
  const { userId: clerkID } = await auth();
  if (!clerkID) return null;
  const user = await getUserByClerkID(clerkID);
  if (!user) throw new Error("User not found");

  return user.id;
}

export async function getRandomUsers() {
  try {
    const userId = await getDbUserId();

    if (!userId) return [];

    // get 3 random users excluding the current user and users the current user is
    const randomUsers = await prisma.user.findMany({
      where: {
        AND: [
          { NOT: { id: userId } },
          { NOT: { follower: { some: { followerID: userId } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        _count: {
          select: {
            follower: true,
          },
        },
      },
      take: 3,
    });

    return randomUsers;
  } catch (error) {
    console.log("Error getting random users: ", error);
    return [];
  }
}

export async function toggleFollow(targetUserId: string) {
  try {
    const userId = await getDbUserId();

    if (!userId) return;

    if (userId === targetUserId) throw new Error("You cannot follow yourself");

    const existingFollow = await prisma.follows.findUnique({
      where: {
        followerID_followingID: {
          followerID: userId,
          followingID: targetUserId,
        },
      },
    });

    if (existingFollow) {
      // unfollow
      await prisma.follows.delete({
        where: {
          followerID_followingID: {
            followerID: userId,
            followingID: targetUserId,
          },
        },
      });
    } else {
      // follow
      await prisma.$transaction([
        prisma.follows.create({
          data: {
            followerID: userId,
            followingID: targetUserId,
          },
        }),
        prisma.notification.create({
          data: {
            type: "FOLLOW",
            userID: targetUserId,
            creatorID: userId,
          },
        }),
      ]);
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.log("Error in toggleFollow", error);
    return { success: false, error: "Error toggling follow" };
  }
}
