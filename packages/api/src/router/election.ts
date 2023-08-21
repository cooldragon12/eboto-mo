import { clerkClient } from "@clerk/nextjs";
import { db } from "@eboto-mo/db";
import {
  candidates,
  commissioners,
  elections,
  invited_voters,
  partylists,
  positions,
  publicity,
  voter_fields,
  voters,
} from "@eboto-mo/db/schema";
import type {
  Candidate,
  Election,
  InvitedVoter,
  Partylist,
  Voter,
} from "@eboto-mo/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import { positionTemplate, takenSlugs } from "../../../../apps/www/constants";
import { account_status_type_with_accepted } from "../../../../apps/www/utils/zod-schema";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { isElectionOngoing } from "./../../../../apps/www/utils/index";

export const electionRouter = createTRPCRouter({
  getElectionVoting: publicProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      return ctx.db.query.positions.findMany({
        where: (positions, { eq }) => eq(positions.election_id, input),
        orderBy: (positions, { asc }) => asc(positions.order),
        with: {
          candidates: {
            with: {
              partylist: true,
            },
          },
        },
      });
    }),
  getElectionRealtime: publicProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      const election = await ctx.db.query.elections.findFirst({
        where: (elections, { eq }) => eq(elections.slug, input),
      });

      if (!election) throw new Error("Election not found");

      const realtimeResult = await ctx.db.query.positions.findMany({
        where: (positions, { eq }) => eq(positions.election_id, election.id),
        orderBy: (positions, { asc }) => asc(positions.order),
        with: {
          votes: true,
          candidates: {
            with: {
              votes: {
                with: {
                  candidate: true,
                },
              },
              partylist: {
                columns: {
                  acronym: true,
                },
              },
            },
          },
        },
      });

      // make the candidate as "Candidate 1"... "Candidate N" if the election is ongoing

      return realtimeResult.map((position) => ({
        ...position,
        votes: position.votes.length,
        candidates: position.candidates
          .sort((a, b) => b.votes.length - a.votes.length)
          .map((candidate, index) => {
            return {
              id: candidate.id,
              first_name: isElectionOngoing({ election })
                ? `Candidate ${index + 1}`
                : candidate.first_name,
              last_name: isElectionOngoing({ election })
                ? ""
                : candidate.last_name,
              middle_name: isElectionOngoing({ election })
                ? ""
                : candidate.middle_name,
              partylist: candidate.partylist,
              vote: candidate.votes.length,
            };
          }),
      }));
    }),
  // getElectionBySlug: publicProcedure
  //   .input(
  //     z.object({
  //       slug: z.string().min(1),
  //     }),
  //   )
  //   .query(async ({ input }) => {
  //     return await db.query.elections.findFirst({
  //       where: (elections, { eq }) => eq(elections.slug, input.slug),
  //     });
  //   }),
  getAllMyElections: protectedProcedure.query(async ({ ctx }) => {
    // TODO: Validate commissioner
    return await db.query.commissioners.findMany({
      where: (commissioners, { eq }) =>
        eq(commissioners.user_id, ctx.auth.userId),
      with: {
        election: true,
      },
    });
  }),
  // getAllPartylistsWithoutINDByElectionId: protectedProcedure
  //   .input(
  //     z.object({
  //       election_id: z.string().min(1),
  //     }),
  //   )
  //   .query(async ({ ctx, input }) => {
  //     // TODO: Validate commissioner
  //     return await db.query.partylists.findMany({
  //       where: (partylists, { eq, and }) =>
  //         and(
  //           eq(partylists.election_id, input.election_id),
  //           not(eq(partylists.acronym, "IND")),
  //         ),
  //       orderBy: (partylists, { desc }) => desc(partylists.updated_at),
  //     });
  //   }),
  // getAllPartylistsByElectionId: protectedProcedure
  //   .input(
  //     z.object({
  //       election_id: z.string().min(1),
  //     }),
  //   )
  //   .query(async ({ ctx, input }) => {
  //     // TODO: Validate commissioner
  //     return await db.query.partylists.findMany({
  //       where: (partylists, { eq }) =>
  //         eq(partylists.election_id, input.election_id),
  //       orderBy: (partylists, { asc }) => asc(partylists.created_at),
  //     });
  //   }),
  // getAllPositionsByElectionId: protectedProcedure
  //   .input(
  //     z.object({
  //       election_id: z.string().min(1),
  //     }),
  //   )
  //   .query(async ({ ctx, input }) => {
  //     // TODO: Validate commissioner
  //     return await db.query.positions.findMany({
  //       where: (positions, { eq }) =>
  //         eq(positions.election_id, input.election_id),
  //       orderBy: (positions, { asc }) => asc(positions.order),
  //     });
  //   }),
  // getAllCandidatesByElectionId: protectedProcedure
  //   .input(
  //     z.object({
  //       election_id: z.string().min(1),
  //     }),
  //   )
  //   .query(async ({ ctx, input }) => {
  //     // TODO: Validate commissioner
  //     return await db.query.positions.findMany({
  //       where: (positions, { eq }) =>
  //         eq(positions.election_id, input.election_id),
  //       orderBy: (positions, { asc }) => asc(positions.order),
  //       with: {
  //         candidates: {
  //           with: {
  //             partylist: true,
  //             credential: {
  //               columns: {
  //                 id: true,
  //               },
  //               with: {
  //                 affiliations: {
  //                   columns: {
  //                     id: true,
  //                     org_name: true,
  //                     org_position: true,
  //                     start_year: true,
  //                     end_year: true,
  //                   },
  //                 },
  //                 achievements: {
  //                   columns: {
  //                     id: true,
  //                     name: true,
  //                     year: true,
  //                   },
  //                 },
  //                 events_attended: {
  //                   columns: {
  //                     id: true,
  //                     name: true,
  //                     year: true,
  //                   },
  //                 },
  //               },
  //             },
  //             platforms: {
  //               columns: {
  //                 id: true,
  //                 title: true,
  //                 description: true,
  //               },
  //             },
  //           },
  //         },
  //       },
  //     });
  //   }),
  getVotersByElectionId: protectedProcedure
    .input(
      z.object({
        election_id: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      const voters = await db.query.voters.findMany({
        where: (voters, { eq }) => eq(voters.election_id, input.election_id),

        with: {
          user: true,
          votes: {
            limit: 1,
          },
        },
      });
      const invitedVoters = await db.query.invited_voters.findMany({
        where: (invited_voters, { eq }) =>
          eq(invited_voters.election_id, input.election_id),
      });

      const userFromVoters = await clerkClient.users.getUserList({
        emailAddress: voters.map((voter) => voter.user.id),
      });

      return voters
        .map((voter) => ({
          id: voter.id,
          email: userFromVoters.find(
            (user) => user.emailAddresses[0]?.emailAddress === voter.user.id,
          )?.emailAddresses[0]?.emailAddress,
          account_status: "ACCEPTED",
          created_at: voter.created_at,
          has_voted: voter.votes.length > 0,
          field: voter.field,
        }))
        .concat(
          invitedVoters.map((voter) => ({
            id: voter.id,
            email: voter.email,
            account_status: voter.status,
            created_at: voter.created_at,
            has_voted: false,
            field: voter.field,
          })),
        );
    }),
  createElection: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1).trim().toLowerCase(),
        start_date: z.date(),
        end_date: z.date(),
        template: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Validate commissioner
      if (takenSlugs.includes(input.slug)) {
        throw new Error("Election slug is already exists");
      }

      const isElectionSlugExists: Election | undefined =
        await db.query.elections.findFirst({
          where: (elections, { eq }) => eq(elections.slug, input.slug),
        });

      if (isElectionSlugExists) {
        throw new Error("Election slug is already exists");
      }

      const id = nanoid();
      await db.insert(elections).values({
        id,
        name: input.name,
        slug: input.slug,
        start_date: input.start_date,
        end_date: input.end_date,
      });
      await db.insert(commissioners).values({
        id: nanoid(),
        election_id: id,
        user_id: ctx.auth.userId,
      });
      await db.insert(partylists).values({
        id: nanoid(),
        name: "Independent",
        acronym: "IND",
        election_id: id,
      });

      const positions1 =
        positionTemplate
          .find((template) => template.id === input.template)
          ?.organizations.flatMap((org) =>
            org.positions.map((position, i) => ({
              id: nanoid(),
              name: position,
              order: i,
              election_id: id,
            })),
          ) ?? [];

      if (input.template !== "none")
        await db.insert(positions).values(positions1);
    }),
  editElection: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        description: z.string().nullable(),
        oldSlug: z.string().trim().toLowerCase().optional(),
        newSlug: z.string().min(1).trim().toLowerCase(),
        start_date: z.date(),
        end_date: z.date(),
        publicity: z.enum(publicity),
        logo: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Validate commissioner
      if (input.newSlug !== input.oldSlug) {
        if (takenSlugs.includes(input.newSlug)) {
          throw new Error("Election slug is already exists");
        }

        const isElectionSlugExists: Election | undefined =
          await db.query.elections.findFirst({
            where: (elections, { eq }) => eq(elections.slug, input.newSlug),
          });

        if (isElectionSlugExists)
          throw new Error("Election slug is already exists");
      }

      const isElectionCommissionerExists: Election | undefined =
        await db.query.elections.findFirst({
          with: {
            commissioners: {
              where: (commissioners, { eq }) =>
                eq(commissioners.user_id, ctx.auth.userId),
            },
          },
        });

      if (!isElectionCommissionerExists) throw new Error("Unauthorized");

      await db
        .update(elections)
        .set({
          name: input.name,
          slug: input.newSlug,
          description: input.description,
          start_date: input.start_date,
          end_date: input.end_date,
        })
        .where(eq(elections.id, input.id));
    }),
  createPartylist: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        acronym: z.string().min(1),
        election_id: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: Validate commissioner
      const isAcronymExists: Partylist | undefined =
        await db.query.partylists.findFirst({
          where: (partylists, { eq, and }) =>
            and(
              eq(partylists.election_id, input.election_id),
              eq(partylists.acronym, input.acronym),
            ),
        });

      if (isAcronymExists) throw new Error("Acronym is already exists");

      await db.insert(partylists).values({
        id: nanoid(),
        name: input.name,
        acronym: input.acronym,
        election_id: input.election_id,
      });
    }),
  editPartylist: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        oldAcronym: z.string().optional(),
        newAcronym: z.string().min(1),
        election_id: z.string().min(1),
        description: z.string().nullable(),
        logo_link: z.string().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: Validate commissioner
      if (input.newAcronym === "IND")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "IND is a reserved acronym",
        });

      if (input.oldAcronym !== input.newAcronym) {
        const isAcronymExists: Partylist | undefined =
          await db.query.partylists.findFirst({
            where: (partylists, { eq, and }) =>
              and(
                eq(partylists.election_id, input.election_id),
                eq(partylists.acronym, input.newAcronym),
              ),
          });

        if (isAcronymExists)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Acronym is already exists",
          });
      }

      await db
        .update(partylists)
        .set({
          name: input.name,
          acronym: input.newAcronym,
          description: input.description,
          logo_link: input.logo_link,
        })
        .where(eq(partylists.id, input.id));
    }),
  deletePartylist: protectedProcedure
    .input(
      z.object({
        partylist_id: z.string().min(1),
        election_id: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: Validate commissioner
      await db
        .delete(partylists)
        .where(
          and(
            eq(partylists.id, input.partylist_id),
            eq(partylists.election_id, input.election_id),
          ),
        );
    }),
  deleteCandidate: protectedProcedure
    .input(
      z.object({
        candidate_id: z.string().min(1),
        election_id: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: Validate commissioner

      await db
        .delete(candidates)
        .where(
          and(
            eq(candidates.id, input.candidate_id),
            eq(candidates.election_id, input.election_id),
          ),
        );
    }),
  createPosition: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        min: z.number().nonnegative().optional(),
        max: z.number().nonnegative().optional(),
        election_id: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: Validate commissioner

      const positionsInDB = await db.query.positions.findMany({
        where: (positions, { eq }) =>
          eq(positions.election_id, input.election_id),
        columns: {
          id: true,
        },
      });

      await db.insert(positions).values({
        id: nanoid(),
        name: input.name,
        order: positionsInDB.length,
        min: input.min,
        max: input.max,
        election_id: input.election_id,
      });
    }),
  deletePosition: protectedProcedure
    .input(
      z.object({
        position_id: z.string().min(1),
        election_id: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: Validate commissioner
      await db
        .delete(positions)
        .where(
          and(
            eq(positions.id, input.position_id),
            eq(positions.election_id, input.election_id),
          ),
        );
    }),
  editPosition: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        min: z.number().nonnegative().optional(),
        max: z.number().nonnegative().optional(),
        election_id: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const positionsInDB = await db.query.positions.findMany({
        where: (positions, { eq }) =>
          eq(positions.election_id, input.election_id),
        columns: {
          id: true,
        },
      });

      await db
        .update(positions)
        .set({
          name: input.name,
          description: input.description,
          order: positionsInDB.length,
          min: input.min,
          max: input.max,
        })
        .where(
          and(
            eq(positions.id, input.id),
            eq(positions.election_id, input.election_id),
          ),
        );
    }),
  createCandidate: protectedProcedure
    .input(
      z.object({
        slug: z.string().min(1).trim().toLowerCase(),
        first_name: z.string().min(1),
        middle_name: z.string().nullable(),
        last_name: z.string().min(1),
        election_id: z.string().min(1),
        position_id: z.string().min(1),
        partylist_id: z.string().min(1),
        image_link: z.string().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: Validate commissioner
      const isCandidateSlugExists: Candidate | undefined =
        await db.query.candidates.findFirst({
          where: (candidates, { eq, and }) =>
            and(
              eq(candidates.slug, input.slug),
              eq(candidates.election_id, input.election_id),
            ),
        });

      if (isCandidateSlugExists)
        throw new Error("Candidate slug is already exists");

      const id = nanoid();

      await db.insert(candidates).values({
        id,
        slug: input.slug,
        first_name: input.first_name,
        middle_name: input.middle_name,
        last_name: input.last_name,
        election_id: input.election_id,
        position_id: input.position_id,
        partylist_id: input.partylist_id,
        image_link: input.image_link,
      });
    }),
  editCandidate: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        slug: z.string().min(1).trim().toLowerCase(),
        first_name: z.string().min(1),
        middle_name: z.string().nullable(),
        last_name: z.string().min(1),
        election_id: z.string().min(1),
        position_id: z.string().min(1),
        partylist_id: z.string().min(1),
        image_link: z.string().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: Validate commissioner
      const isCandidateSlugExists: Candidate | undefined =
        await db.query.candidates.findFirst({
          where: (candidates, { eq, and }) =>
            and(
              eq(candidates.slug, input.slug),
              eq(candidates.election_id, input.election_id),
            ),
        });

      if (isCandidateSlugExists)
        throw new Error("Candidate slug is already exists");

      await db.insert(candidates).values({
        id: nanoid(),
        slug: input.slug,
        first_name: input.first_name,
        middle_name: input.middle_name,
        last_name: input.last_name,
        election_id: input.election_id,
        position_id: input.position_id,
        partylist_id: input.partylist_id,
        image_link: input.image_link,
      });
    }),
  inviteAllInvitedVoters: protectedProcedure
    .input(
      z.object({
        election_id: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Validate commissioner
      const isElectionExists = await db.query.elections.findFirst({
        where: (elections, { eq }) => eq(elections.id, input.election_id),
        with: {
          commissioners: {
            where: (commissioners, { eq }) =>
              eq(commissioners.user_id, ctx.auth.userId),
          },
        },
      });
      if (!isElectionExists) throw new Error("Election does not exists");
      if (isElectionExists.commissioners.length === 0)
        throw new Error("Unauthorized");
      // const invitedVoters = await db.query.invited_voters.findMany({
      //   where: (invited_voters, { eq }) =>
      //     eq(invited_voters.election_id, input.election_id),
      // });
      // const invitedVotersIds = invitedVoters.map(
      //   (invitedVoter) => invitedVoter.id,
      // );
    }),
  createVoter: protectedProcedure
    .input(
      z.object({
        email: z.string().min(1),
        field: z.record(z.string().min(1)),
        election_id: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Validate commissioner

      const users = await clerkClient.users.getUserList({
        emailAddress: [input.email],
      });
      const user = users[0];
      // const user = await db.query.users.findFirst({
      //   where: (users, { eq }) => eq(users.id, ctx.auth.userId),
      // });
      if (!user) throw new Error("Unauthorized");
      if (input.email === user.emailAddresses[0]?.emailAddress) {
        await db.insert(voters).values({
          id: nanoid(),
          user_id: ctx.auth.userId,
          election_id: input.election_id,
          field: input.field,
        });
      } else {
        const isVoterExists = await db.query.elections.findFirst({
          where: (elections, { eq }) => eq(elections.id, input.election_id),
          with: {
            commissioners: {
              where: (commissioners, { eq }) =>
                eq(commissioners.user_id, ctx.auth.userId),
            },
          },
        });
        if (!isVoterExists) throw new Error("Election does not exists");

        if (isVoterExists.commissioners.length === 0)
          throw new Error("Unauthorized");

        const voters = await db.query.voters.findMany({
          where: (voters, { eq }) => eq(voters.election_id, input.election_id),
          with: {
            user: true,
          },
        });

        const userFromVoters = await clerkClient.users.getUserList({
          emailAddress: voters.map((voter) => voter.user.id),
        });

        const isVoterEmailExists = userFromVoters.find(
          (user) => user.emailAddresses[0]?.emailAddress === input.email,
        );

        if (isVoterEmailExists) throw new Error("Email is already a voter");

        const isInvitedVoterEmailExists =
          await db.query.invited_voters.findFirst({
            where: (invited_voters, { eq, and }) =>
              and(
                eq(invited_voters.election_id, input.election_id),
                eq(invited_voters.email, input.email),
              ),
          });
        if (isInvitedVoterEmailExists)
          throw new Error("Email is already exists");
        await db.insert(invited_voters).values({
          id: nanoid(),
          email: input.email,
          field: input.field,
          election_id: input.election_id,
        });
      }
    }),
  updateVoterField: protectedProcedure
    .input(
      z.object({
        fields: z.array(
          z.object({
            id: z.string().min(1),
            name: z.string().min(1),
            type: z.enum(["fromDb", "fromInput"]),
          }),
        ),
        election_id: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: Validate commissioner
      await db
        .update(voter_fields)
        .set(input)
        .where(eq(voter_fields.election_id, input.election_id));
    }),
  deleteSingleVoterField: protectedProcedure
    .input(
      z.object({
        election_id: z.string().min(1),
        field_id: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      await db
        .delete(voter_fields)
        .where(
          and(
            eq(voter_fields.election_id, input.election_id),
            eq(voter_fields.id, input.field_id),
          ),
        );
    }),
  editVoter: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        email: z.string().min(1),
        field: z.record(z.string().min(1)),
        election_id: z.string().min(1),
        account_status: z.enum(account_status_type_with_accepted),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: Validate commissioner
      if (input.account_status === "ACCEPTED") {
        const voter: Voter | undefined = await db.query.voters.findFirst({
          where: (voters, { eq, and }) =>
            and(
              eq(voters.id, input.id),
              eq(voters.election_id, input.election_id),
            ),
        });

        if (!voter) throw new Error("Voter not found");
        await db
          .update(voters)
          .set({
            field: input.field,
          })
          .where(eq(voters.id, input.id));

        return { type: "voter" };
      } else {
        const invited_voter: InvitedVoter | undefined =
          await db.query.invited_voters.findFirst({
            where: (invited_voters, { eq, and }) =>
              and(
                eq(invited_voters.id, input.id),
                eq(invited_voters.election_id, input.election_id),
              ),
          });
        if (!invited_voter) throw new Error("Voter not found");

        await db
          .update(invited_voters)
          .set({
            email: input.email,
            field: input.field,
          })
          .where(
            and(
              eq(invited_voters.id, input.id),
              eq(invited_voters.election_id, input.election_id),
            ),
          );

        return { type: "invited_voter" };
      }
    }),
  deleteVoter: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        election_id: z.string().min(1),
        is_invited_voter: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: Validate commissioner
      if (!input.is_invited_voter) {
        const voter: Voter | undefined = await db.query.voters.findFirst({
          where: (voters, { eq, and }) =>
            and(
              eq(voters.id, input.id),
              eq(voters.election_id, input.election_id),
            ),
        });

        if (!voter) throw new Error("Voter not found");

        await db
          .delete(voters)
          .where(
            and(
              eq(voters.id, input.id),
              eq(voters.election_id, input.election_id),
            ),
          );
      } else {
        const invited_voter: InvitedVoter | undefined =
          await db.query.invited_voters.findFirst({
            where: (invited_voters, { eq, and }) =>
              and(
                eq(invited_voters.id, input.id),
                eq(invited_voters.election_id, input.election_id),
              ),
          });

        if (!invited_voter) throw new Error("Voter not found");

        await db
          .delete(invited_voters)
          .where(
            and(
              eq(invited_voters.id, input.id),
              eq(invited_voters.election_id, input.election_id),
            ),
          );
      }
    }),
  deleteBulkVoter: protectedProcedure
    .input(
      z.object({
        election_id: z.string().min(1),
        voters: z.array(
          z.object({
            id: z.string().min(1),
            email: z.string().min(1),
            isVoter: z.boolean(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: Validate commissioner
      const votersIds = input.voters
        .filter((voter) => voter.isVoter)
        .map((voter) => voter.id);
      const invitedVotersIds = input.voters
        .filter((voter) => !voter.isVoter)
        .map((voter) => voter.id);
      if (votersIds.length)
        await db
          .delete(voters)
          .where(
            and(
              eq(voters.election_id, input.election_id),
              inArray(voters.id, votersIds),
            ),
          );
      if (invitedVotersIds.length)
        await db
          .delete(invited_voters)
          .where(
            and(
              eq(invited_voters.election_id, input.election_id),
              inArray(invited_voters.id, invitedVotersIds),
            ),
          );
      return { count: input.voters.length };
    }),
  uploadBulkVoter: protectedProcedure
    .input(
      z.object({
        election_id: z.string().min(1),
        voters: z.array(
          z.object({
            email: z.string().min(1),
            field: z.record(z.string().min(1)),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Validate commissioner
      const isElectionExists = await db.query.elections.findFirst({
        where: (elections, { eq }) => eq(elections.id, input.election_id),
        with: {
          commissioners: {
            where: (commissioners, { eq }) =>
              eq(commissioners.user_id, ctx.auth.userId),
          },
        },
      });

      if (!isElectionExists) throw new Error("Election does not exists");

      if (isElectionExists.commissioners.length === 0)
        throw new Error("Unauthorized");

      // await Promise.all(
      //   input.voters.map(async (voter) => {
      //     await isVoterOrInvitedVoterExists({
      //       election_id: input.election_id,
      //       email: voter.email,
      //     });
      //   }),
      // );

      const voters = await db.insert(invited_voters).values(
        input.voters.map((voter) => ({
          id: nanoid(),
          email: voter.email,
          field: voter.field,
          election_id: input.election_id,
        })),
      );

      return { count: voters.size };
    }),
});
