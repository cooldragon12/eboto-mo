import {
  Button,
  Center,
  Flex,
  Text,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import type { Candidate, Partylist } from "@prisma/client";
import { api } from "../utils/api";
import EditCandidateModal from "./modals/EditCandidate";

const CandidateCard = ({
  candidate,
  refetch,
  partylists,
}: {
  candidate: Candidate;
  refetch: () => Promise<unknown>;
  partylists: Partylist[];
}) => {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const deletePositionMutation = api.candidate.deleteSingle.useMutation({
    onSuccess: async (data) => {
      await refetch();
      toast({
        title: `${data.first_name} ${data.last_name} deleted!`,
        description: "Successfully deleted candidate",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    },
  });

  return (
    <>
      <EditCandidateModal
        isOpen={isOpen}
        onClose={onClose}
        partylists={partylists}
        candidate={candidate}
        refetch={refetch}
      />
      <Center
        flexDirection="column"
        gap={2}
        w={48}
        h={32}
        border="1px"
        borderColor="gray.300"
        borderRadius="md"
        _dark={{
          borderColor: "gray.700",
        }}
        p={4}
      >
        <Text textAlign="center" w="full">
          {candidate.first_name} {candidate.last_name}
        </Text>

        <Flex>
          <Button onClick={onOpen} variant="ghost" size="sm" w="fit-content">
            Edit
          </Button>
          <Button
            onClick={() => deletePositionMutation.mutate(candidate.id)}
            isLoading={deletePositionMutation.isLoading}
            variant="ghost"
            colorScheme="red"
            size="sm"
            w="fit-content"
          >
            Delete
          </Button>
        </Flex>
      </Center>
    </>
  );
};

export default CandidateCard;
