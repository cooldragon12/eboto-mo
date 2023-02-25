import {
  Stack,
  FormControl,
  FormLabel,
  Input,
  FormErrorMessage,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Button,
} from "@chakra-ui/react";
import { Container } from "@react-email/container";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { api } from "../utils/api";

const VerifyPage = () => {
  const router = useRouter();
  const { token, type, status, accountType } = router.query;
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm();

  const verify = api.token.verify.useQuery(
    {
      token: token as string,
      type: type as "EMAIL_VERIFICATION" | "PASSWORD_RESET",
      status: status as "ACCEPTED" | "DECLINED" | undefined,
      accountType: accountType as "VOTER" | "COMMISSIONER" | undefined,
    },
    {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
    }
  );
  const resetPasswordMutation = api.user.resetPassword.useMutation();

  if (verify.isLoading) {
    return (
      <div>
        <h1>Loading...</h1>
      </div>
    );
  }

  if (verify.isError) {
    return (
      <div>
        <h1>Error</h1>
        <p>{verify.error.message}</p>
      </div>
    );
  }

  switch (verify.data) {
    case "EMAIL_VERIFICATION":
      return (
        <div>
          <h1>Success! </h1>
          <p>Your account has been verified. Please sign in.</p>
        </div>
      );
    case "PASSWORD_RESET":
      if (resetPasswordMutation.isSuccess) {
        return (
          <div>
            <h1>Success! </h1>
            <p>Your password has been reset. Please sign in.</p>
          </div>
        );
      }
      return (
        <Container>
          <form
            onSubmit={handleSubmit(async (data) => {
              await resetPasswordMutation.mutateAsync({
                token: token as string,
                password: data.password as string,
              });
            })}
          >
            <Stack spacing={4}>
              <FormControl
                isInvalid={!!errors.password}
                isRequired
                isDisabled={resetPasswordMutation.isLoading}
              >
                <FormLabel>Password</FormLabel>
                <Input
                  placeholder="Enter your password"
                  type="password"
                  {...register("password", {
                    required: "This is required.",
                    min: {
                      value: 8,
                      message: "Password must be at least 8 characters long.",
                    },
                    validate: (value) =>
                      value === getValues("confirmPassword") ||
                      "The passwords do not match.",
                  })}
                />
                {errors.password && (
                  <FormErrorMessage>
                    {errors.password.message?.toString()}
                  </FormErrorMessage>
                )}
              </FormControl>

              <FormControl
                isInvalid={!!errors.confirmPassword}
                isRequired
                isDisabled={resetPasswordMutation.isLoading}
              >
                <FormLabel>Confirm password</FormLabel>
                <Input
                  placeholder="Confirm your password"
                  type="password"
                  {...register("confirmPassword", {
                    required: "This is required.",
                    min: {
                      value: 8,
                      message: "Password must be at least 8 characters long.",
                    },
                    validate: (value) =>
                      value === getValues("password") ||
                      "The passwords do not match.",
                  })}
                />
                {errors.confirmPassword && (
                  <FormErrorMessage>
                    {errors.confirmPassword.message?.toString()}
                  </FormErrorMessage>
                )}

                {resetPasswordMutation.isError && (
                  <Alert status="error">
                    <AlertIcon />
                    <AlertTitle>Sign in error.</AlertTitle>
                    <AlertDescription>
                      {resetPasswordMutation.error.message}
                    </AlertDescription>
                  </Alert>
                )}
              </FormControl>

              <Button type="submit" isLoading={resetPasswordMutation.isLoading}>
                Sign in
              </Button>
            </Stack>
          </form>
        </Container>
      );
  }
};

export default VerifyPage;
