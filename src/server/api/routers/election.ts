import { z } from "zod";
import { positionTemplate } from "../../../constants";
import { takenSlugs } from "../../../constants";

import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";

export const electionRouter = createTRPCRouter({
  getElectionVoter: protectedProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      const election = await ctx.prisma.election.findUnique({
        where: {
          slug: input,
        },
        include: {
          commissioners: true,
        },
      });

      if (!election) {
        throw new Error("Election not found");
      }

      if (
        !election.commissioners.some(
          (commissioner) => commissioner.userId === ctx.session.user.id
        )
      ) {
        throw new Error("You are not a commissioner of this election");
      }

      const invitedVoter = await ctx.prisma.invitedVoter.findMany({
        where: {
          electionId: election.id,
        },
        include: {
          election: {
            include: {
              voters: true,
            },
          },
        },
      });

      const voters = await ctx.prisma.voter.findMany({
        where: {
          electionId: election.id,
        },
        include: {
          user: true,
        },
      });

      return {
        invitedVoter,
        voters,
      };
    }),

  getElectionOverview: protectedProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      const election = await ctx.prisma.election.findFirst({
        where: {
          slug: input,
          commissioners: {
            some: {
              userId: ctx.session.user.id,
            },
          },
        },
      });

      if (!election) {
        throw new Error("Election not found");
      }

      const voters = await ctx.prisma.voter.aggregate({
        where: {
          electionId: election.id,
        },
        _count: {
          _all: true,
        },
      });

      const voted = await ctx.prisma.voter.aggregate({
        where: {
          electionId: election.id,
          user: {
            votes: {
              some: {
                electionId: election.id,
              },
            },
          },
        },
        _count: {
          _all: true,
        },
      });
      const invitedVoters = await ctx.prisma.invitedVoter.aggregate({
        where: {
          electionId: election.id,
        },
        _count: {
          _all: true,
        },
      });

      const positions = await ctx.prisma.position.aggregate({
        where: {
          electionId: election.id,
        },
        _count: {
          _all: true,
        },
      });
      const candidates = await ctx.prisma.candidate.aggregate({
        where: {
          electionId: election.id,
        },
        _count: {
          _all: true,
        },
      });

      return { election, voters, voted, positions, candidates, invitedVoters };
    }),
  getBySlug: protectedProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      return ctx.prisma.election.findUnique({
        where: {
          slug: input,
        },
      });
    }),
  getMyElections: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.election.findMany({
      where: {
        commissioners: {
          some: {
            userId: ctx.session.user.id,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }),
  getElectionData: publicProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      const election = await ctx.prisma.election.findUnique({
        where: {
          slug: input,
        },
      });

      if (election) {
        switch (election.publicity) {
          case "PUBLIC":
            return ctx.prisma.election.findUnique({
              where: {
                slug: input,
              },
              include: {
                positions: true,
                candidates: true,
                partylist: true,
              },
            });
          case "VOTER":
            if (ctx.session) {
              const isVoter = await ctx.prisma.election.findFirst({
                where: {
                  slug: input,
                  voters: {
                    some: {
                      userId: ctx.session.user.id,
                    },
                  },
                },
              });

              if (isVoter) {
                return ctx.prisma.election.findUnique({
                  where: {
                    slug: input,
                  },
                  include: {
                    positions: true,
                    candidates: true,
                    partylist: true,
                  },
                });
              }
            }
            break;
          case "PRIVATE":
            if (ctx.session) {
              const isCommissioner = await ctx.prisma.election.findFirst({
                where: {
                  slug: input,
                  commissioners: {
                    some: {
                      userId: ctx.session.user.id,
                    },
                  },
                },
              });

              if (isCommissioner) {
                return ctx.prisma.election.findUnique({
                  where: {
                    slug: input,
                  },
                  include: {
                    positions: true,
                    candidates: true,
                    partylist: true,
                  },
                });
              }
            }
        }
      }
      throw new Error("Election not found");
    }),
  getMyElectionsVote: protectedProcedure.query(async ({ ctx }) => {
    // return elections if I own it and with respect to the publicity
    return await ctx.prisma.election.findMany({
      where: {
        publicity: {
          not: "PRIVATE",
        },
        voters: {
          some: {
            userId: ctx.session.user.id,
          },
        },
      },
    });
  }),
  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        slug: z.string(),
        start_date: z.date(),
        end_date: z.date(),
        voting_start: z.number().nullish(),
        voting_end: z.number().nullish(),
        template: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (takenSlugs.includes(input.slug)) {
        throw new Error("Election slug is unavailable. Try another.");
      }

      const isElectionExists = await ctx.prisma.election.findUnique({
        where: {
          slug: input.slug,
        },
      });

      if (isElectionExists) {
        throw new Error("Election slug is already exists");
      }

      const newElection = await ctx.prisma.election.create({
        data: {
          name: input.name,
          slug: input.slug,
          start_date: input.start_date,
          end_date: input.end_date,
          voting_start: input.voting_start ? input.voting_start : undefined,
          voting_end: input.voting_end ? input.voting_end : undefined,
          commissioners: {
            create: {
              userId: ctx.session.user.id,
            },
          },
          partylist: {
            create: {
              name: "Independent",
              acronym: "IND",
            },
          },
        },

        select: {
          id: true,
          slug: true,
        },
      });

      if (input.template !== 0)
        await ctx.prisma.position.createMany({
          data:
            positionTemplate
              .find((template) => template.id === input.template)
              ?.positions.map((position, index) => ({
                name: position,
                electionId: newElection.id,
                order: index,
              })) || [],
        });

      return newElection;
    }),
  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ input, ctx }) => {
      const election = await ctx.prisma.election.findUnique({
        where: {
          id: input,
        },
        include: {
          commissioners: true,
        },
      });

      if (!election) {
        throw new Error("Election not found");
      }

      if (
        !election.commissioners.some(
          (commissioner) => commissioner.userId === ctx.session.user.id
        )
      ) {
        throw new Error("You are not a commissioner of this election");
      }

      // await ctx.prisma.user.update({
      //   where: {
      //     id: ctx.session.user.id,
      //   },
      //   data: {
      //     commissioners: {
      //       disconnect: {
      //         id: input,
      //       },
      //     },
      //   },
      // });

      // disconnect all of the voters with has election to their voters

      await ctx.prisma.election.delete({
        where: {
          id: input,
        },
      });

      return true;
    }),
});
