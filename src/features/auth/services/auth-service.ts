import { tryCatch } from "@walkup/walkup-utils";
import { communityDAL, legalDocumentDAL, userDAL } from "@/dal";
import { ConflictError, NotFoundError, ValidationError } from "@/dal/errors";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { auth } from "@/services/better-auth";
import { getSession } from "@/features/auth/utils/session";
import { captureNonCriticalError } from "@/lib/api/route-helpers";

/**
 * Context passed from API routes for audit and legal recording.
 */
export interface AuthRequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Auth service: business logic and orchestration for authentication
 * and onboarding operations. Delegates data access to DALs.
 */
export class AuthService {
  /**
   * Sign up a new user with email/password, optionally recording legal acceptances.
   *
   * @throws ConflictError if email already exists
   * @throws Error if account creation fails
   */
  static async signUpWithEmail(
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    },
    legalDocumentsAccepted: boolean,
    context: AuthRequestContext,
  ): Promise<{ redirect: string }> {
    const { data: authResult, error: authError } = await tryCatch(
      auth.api.signUpEmail({
        body: {
          email: data.email,
          password: data.password,
          name: `${data.firstName} ${data.lastName}`,
        },
      }),
    );

    if (authError) {
      if (authError.message?.includes("already exists")) {
        throw new ConflictError(
          "An account with this email already exists. Please sign in instead.",
        );
      }
      throw new Error("Failed to create account. Please try again.");
    }

    if (!authResult?.user) {
      throw new Error("Failed to create account. Please try again.");
    }

    const userId = authResult.user.id;

    if (legalDocumentsAccepted) {
      await this.recordLegalAcceptances(userId, context, {
        acceptanceMethod: "email",
        useSignupVariant: true,
      });
    } else {
      console.error("Legal documents not accepted, skipping recording");
    }

    return {
      redirect: `/verify-email?email=${encodeURIComponent(data.email)}`,
    };
  }

  /**
   * Accept legal documents for OAuth flow users.
   * Records acceptances, updates status, and sets profile photo if available.
   */
  static async acceptLegalDocuments(
    userId: string,
    context: AuthRequestContext,
  ): Promise<{ redirect: string }> {
    await this.recordLegalAcceptances(userId, context, {
      acceptanceMethod: "oauth_google",
      useSignupVariant: false,
    });

    // Update user status from pending_verification to email_verified
    const userProfile = await userDAL.getUserById(userId);
    if (userProfile.status === "pending_verification") {
      await userDAL.updateUserStatus(userId, "email_verified");
    }

    // Set user profile photo if available from Google OAuth
    const session = await getSession();
    if (session?.user?.image) {
      await userDAL.updateUserProfilePhoto(userId, session.user.image);
    }

    return { redirect: "/join-code" };
  }

  /**
   * Join a community using a join code during onboarding.
   *
   * @throws ConflictError if user already in a community
   * @throws NotFoundError if join code is invalid
   * @throws ValidationError if DAL rejects the join
   */
  static async joinCommunity(
    userId: string,
    joinCode: string,
  ): Promise<{ redirect: string }> {
    // Check if user is already in a community
    const existingMembership = await communityDAL.getMembershipForUser(userId);

    if (existingMembership) {
      throw new ConflictError(
        "You are already a member of a community. Please leave your current community first.",
      );
    }

    // Validate join code and get community
    const { data: community, error: validateError } = await tryCatch(
      communityDAL.validateJoinCodeForSignup(joinCode.trim()),
    );

    if (validateError) {
      throw new Error("Unable to validate join code. Please try again.");
    }

    if (!community) {
      throw new NotFoundError(
        "Invalid join code. Please check with your community administrator.",
      );
    }

    // Join the community
    const { data: communityInfo, error: joinError } = await tryCatch(
      communityDAL.joinCommunityForNewUser(userId, community.id),
    );

    if (joinError) {
      if (joinError instanceof ValidationError) {
        throw joinError;
      }
      throw new Error("Unable to join community. Please try again.");
    }

    if (!communityInfo) {
      throw new Error("Failed to join community. Please try again.");
    }

    // Update user status (non-critical)
    const { error: statusError } = await tryCatch(
      userDAL.updateUserStatus(userId, "incomplete_profile"),
    );

    if (statusError) {
      captureNonCriticalError(statusError, {
        route: "AuthService.joinCommunity",
        action: "update_user_status",
      });
    }

    return { redirect: "/onboarding" };
  }

  /**
   * Record legal document acceptances for TOS and Privacy Policy.
   * Shared by signUpWithEmail and acceptLegalDocuments.
   */
  private static async recordLegalAcceptances(
    userId: string,
    context: AuthRequestContext,
    options: {
      acceptanceMethod: "email" | "oauth_google";
      useSignupVariant: boolean;
    },
  ): Promise<void> {
    try {
      const documentVersions = await legalDocumentDAL.getAllCurrentVersions();

      const acceptancePromises = [];

      const recordFn = options.useSignupVariant
        ? legalDocumentDAL.recordAcceptanceForSignup.bind(legalDocumentDAL)
        : legalDocumentDAL.recordAcceptance.bind(legalDocumentDAL);

      if (documentVersions[LEGAL_DOCUMENT_IDS.TOS]) {
        const tosVersion = documentVersions[LEGAL_DOCUMENT_IDS.TOS];
        acceptancePromises.push(
          recordFn(
            userId,
            LEGAL_DOCUMENT_IDS.TOS,
            tosVersion.version,
            context.ipAddress,
            context.userAgent,
            options.acceptanceMethod,
          ),
        );
      } else {
        console.warn("No TOS document version found");
      }

      if (documentVersions[LEGAL_DOCUMENT_IDS.PRIVACY]) {
        const privacyVersion = documentVersions[LEGAL_DOCUMENT_IDS.PRIVACY];
        acceptancePromises.push(
          recordFn(
            userId,
            LEGAL_DOCUMENT_IDS.PRIVACY,
            privacyVersion.version,
            context.ipAddress,
            context.userAgent,
            options.acceptanceMethod,
          ),
        );
      } else {
        console.warn("No Privacy document version found");
      }

      await Promise.all(acceptancePromises);

      const updateFn = options.useSignupVariant
        ? userDAL.updateLegalAcceptancesForSignup.bind(userDAL)
        : userDAL.updateLegalAcceptances.bind(userDAL);

      await updateFn(userId, {
        tosVersion: documentVersions[LEGAL_DOCUMENT_IDS.TOS]?.version,
        tosAcceptedAt: new Date(),
        privacyVersion: documentVersions[LEGAL_DOCUMENT_IDS.PRIVACY]?.version,
        privacyAcceptedAt: new Date(),
      });
    } catch (error) {
      captureNonCriticalError(error, {
        route: "AuthService.recordLegalAcceptances",
        action: "record_legal_acceptances",
      });
    }
  }
}
