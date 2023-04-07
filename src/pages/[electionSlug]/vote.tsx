import {
  Box,
  Button,
  Container,
  Stack,
  Text,
  Modal,
  Group,
  Alert,
  Title,
  Center,
  Loader,
  UnstyledButton,
} from "@mantine/core";
import { useDidUpdate, useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { Election } from "@prisma/client";
import {
  IconAlertCircle,
  IconCheck,
  IconFingerprint,
  IconX,
} from "@tabler/icons-react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import { useRouter } from "next/router";
import { useConfetti } from "../../lib/confetti";
import { getServerAuthSession } from "../../server/auth";
import { prisma } from "../../server/db";
import { api } from "../../utils/api";
import { isElectionOngoing } from "../../utils/isElectionOngoing";
import Balancer from "react-wrap-balancer";
import VoteCard from "../../VoteCard";
import Head from "next/head";
import toWords from "../../lib/toWords";
import { useState } from "react";

const VotePage = ({ election }: { election: Election }) => {
  const title = `${election.name} – Vote | eBoto Mo`;
  const router = useRouter();
  const { fireConfetti } = useConfetti();
  const [opened, { open, close }] = useDisclosure(false);

  const [votesState, setVotesState] = useState<
    {
      positionId: string;
      votes: string[];
      min: number;
      max: number;
    }[]
  >([]);

  const positions = api.election.getElectionVoting.useQuery(election.id, {
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const voteMutation = api.election.vote.useMutation({
    onSuccess: async () => {
      notifications.show({
        title: "Vote casted successfully!",
        message: "You can now view the realtime results",
        icon: <IconCheck size="1.1rem" />,
        autoClose: 5000,
      });
      await router.push(`/${election.slug}/realtime`);
      await fireConfetti();
    },
    onError: () => {
      notifications.show({
        title: "Error casting vote",
        message: voteMutation.error?.message,
        icon: <IconX size="1.1rem" />,
        color: "red",
        autoClose: 5000,
      });
    },
  });

  useDidUpdate(() => {
    if (positions.data) {
      setVotesState(
        positions.data.map((position) => {
          return {
            positionId: position.id,
            votes: [],
            min: position.min,
            max: position.max,
          };
        })
      );
    }
  }, [positions.data]);

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>

      <Container py="xl">
        {positions.isLoading ? (
          <Center h="100%">
            <Loader size="lg" />
          </Center>
        ) : positions.isError ? (
          <Text>Error:{positions.error.message}</Text>
        ) : !positions.data ? (
          <Text>Not found</Text>
        ) : (
          <>
            {/* <Modal
              opened={opened || voteMutation.isLoading}
              onClose={close}
              title={<Text weight={600}>Confirm Vote</Text>}
            >
              <form
                onSubmit={form.onSubmit((values) => {
                  console.log(values);
                })}
              >
                <Stack>
                  {positions.data.map((position) => {
                    const candidate = position.candidate.find(
                      (candidate) =>
                        candidate.id ===
                        votes
                          .find((vote) => vote.split("-")[0] === position.id)
                          ?.split("-")[1]
                    );

                    return (
                      <Box key={position.id}>
                        <Text lineClamp={1}>{position.name}</Text>
                        <Text
                          weight={600}
                          lineClamp={2}
                          color="gray.500"
                          size="lg"
                        >
                          {candidate
                            ? `${candidate.last_name}, ${candidate.first_name}${
                                candidate.middle_name
                                  ? " " + candidate.middle_name.charAt(0) + "."
                                  : ""
                              } (${candidate.partylist.acronym})`
                            : "Abstain"}
                        </Text>
                      </Box>
                    );
                  })}

                  {voteMutation.isError && (
                    <Alert
                      icon={<IconAlertCircle size="1rem" />}
                      title="Error"
                      color="red"
                    >
                      {voteMutation.error.message}
                    </Alert>
                  )}
                  <Group position="right" spacing="xs">
                    <Button
                      variant="default"
                      onClick={close}
                      disabled={voteMutation.isLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      loading={voteMutation.isLoading}
                      onClick={() => {
                        voteMutation.mutate({
                          electionId: election.id,
                          votes,
                        });
                      }}
                    >
                      Confirm
                    </Button>
                  </Group>
                </Stack>
              </form>
            </Modal> */}
            <Stack
              sx={{
                position: "relative",
              }}
            >
              <Box>
                <Title align="center">
                  <Balancer>Cast your vote for {election.name}</Balancer>
                </Title>
                <Text align="center">
                  <Balancer>Select your candidates for each position.</Balancer>
                </Text>
              </Box>
              <Stack>
                {positions.data.map((position) => {
                  return (
                    <Box key={position.id}>
                      <Text size="xl">{position.name}</Text>
                      <Text size="sm" color="grayText">
                        {position.min === 0 && position.max === 1
                          ? "Select only one."
                          : `Select ${
                              position.min
                                ? `at least ${toWords
                                    .convert(position.min)
                                    .toLowerCase()} and `
                                : ""
                            }at most ${toWords
                              .convert(position.max)
                              .toLowerCase()}. (${
                              position.min ? `${position.min} - ` : ""
                            }${position.max})`}
                      </Text>

                      <Group>
                        {position.candidate.map((candidate) => (
                          <VoteCard
                            key={candidate.id}
                            candidate={candidate}
                            position={position}
                            setVotesState={setVotesState}
                            votesState={votesState}
                          />
                        ))}

                        <VoteCard
                          position={position}
                          setVotesState={setVotesState}
                          votesState={votesState}
                        />
                      </Group>
                    </Box>
                  );
                })}
              </Stack>

              <Button
                onClick={open}
                // disabled={
                //   voteMutation.isLoading ||
                //   // if multiple selection has abstain vote, enable button. else, disable
                //   votesState.some(
                //     (vote) =>
                //       vote.max > 1 &&
                //       vote.votes.some(
                //         (vote) => vote.split("-")[1] === "abstain"
                //       )
                //   ) || // if single selection has no vote, enable button. else, disable
                //   votesState.some(
                //     (vote) =>
                //       vote.max === 1 &&
                //       vote.votes.every(
                //         (vote) => vote.split("-")[1] === "abstain"
                //       )
                //   )
                // }
                leftIcon={<IconFingerprint />}
                size="lg"
                sx={{
                  position: "sticky",
                  bottom: 100,
                  alignSelf: "center",
                  width: "fit-content",
                  marginTop: 12,
                  marginBottom: 100,
                }}
                radius="xl"
              >
                Cast Vote
              </Button>
            </Stack>
          </>
        )}
      </Container>
    </>
  );
};

export default VotePage;

export const getServerSideProps: GetServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  if (
    !context.query.electionSlug ||
    typeof context.query.electionSlug !== "string"
  )
    return { notFound: true };

  const session = await getServerAuthSession(context);
  const election = await prisma.election.findFirst({
    where: {
      slug: context.query.electionSlug,
    },
  });

  if (!election) return { notFound: true };

  if (!isElectionOngoing({ election, withTime: true }))
    return {
      redirect: {
        destination: `/${election.slug}`,
        permanent: false,
      },
    };

  if (election.publicity === "PRIVATE") {
    if (!session)
      return { redirect: { destination: "/signin", permanent: false } };

    const commissioner = await prisma.commissioner.findFirst({
      where: {
        electionId: election.id,
        userId: session.user.id,
      },
    });

    if (!commissioner) return { notFound: true };

    return {
      redirect: {
        destination: `/${election.slug}/realtime`,
        permanent: false,
      },
    };
  } else if (election.publicity === "VOTER") {
    if (!session)
      return { redirect: { destination: "/signin", permanent: false } };

    const vote = await prisma.vote.findFirst({
      where: {
        voterId: session.user.id,
        electionId: election.id,
      },
    });

    if (vote)
      return {
        redirect: {
          destination: `/${election.slug}/realtime`,
          permanent: false,
        },
      };
  } else if (election.publicity === "PUBLIC") {
    if (!session)
      return {
        redirect: { destination: `/${election.slug}`, permanent: false },
      };

    const vote = await prisma.vote.findFirst({
      where: {
        electionId: election.id,
        voterId: session.user.id,
      },
    });

    if (vote)
      return {
        redirect: {
          destination: `/${election.slug}`,
          permanent: false,
        },
      };
  }

  return {
    props: {
      election,
    },
  };
};
