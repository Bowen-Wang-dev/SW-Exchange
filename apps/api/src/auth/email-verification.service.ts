import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, isNull, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import { emailVerificationTokens, users } from "../db/schema/index.js";
import { MailService } from "../mail/mail.service.js";
import { SecurityEventsService } from "../security/security-events.service.js";
import { UsersService } from "../users/users.service.js";

const VERIFY_EMAIL_PURPOSE = "VERIFY_EMAIL";
const DEFAULT_TOKEN_TTL_MINUTES = 60;

type RequestSecurityContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(MailService) private readonly mailService: MailService,
    @Inject(SecurityEventsService) private readonly securityEventsService: SecurityEventsService,
    @Inject(UsersService) private readonly usersService: UsersService,
  ) {}

  async requestVerification(
    userId: string,
    context?: RequestSecurityContext,
  ): Promise<{
    success: true;
    alreadyVerified: boolean;
    email: string;
    emailVerified: boolean;
    emailVerifiedAt: Date | null;
    deliveryProvider: "console" | null;
    expiresAt: Date | null;
  }> {
    const user = await this.usersService.findById(userId);

    if (!user || user.isSystem) {
      throw new UnauthorizedException("Invalid session.");
    }

    if (user.emailVerifiedAt) {
      await this.securityEventsService.recordEvent({
        actorUserId: user.id,
        actorRole: user.role,
        eventType: "EMAIL_VERIFICATION_REQUESTED",
        severity: "INFO",
        targetType: "USER",
        targetId: user.id,
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
        metadata: {
          email: user.email,
          purpose: VERIFY_EMAIL_PURPOSE,
          alreadyVerified: true,
          emailVerifiedAt: user.emailVerifiedAt,
        },
      });

      return {
        success: true,
        alreadyVerified: true,
        email: user.email,
        emailVerified: true,
        emailVerifiedAt: user.emailVerifiedAt,
        deliveryProvider: null,
        expiresAt: null,
      };
    }

    const now = new Date();
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(now.getTime() + this.getTokenTtlMinutes() * 60 * 1000);

    const result = await this.db.transaction(async (tx) => {
      const invalidatedRows = await tx
        .update(emailVerificationTokens)
        .set({
          usedAt: now,
        })
        .where(
          and(
            eq(emailVerificationTokens.userId, user.id),
            eq(emailVerificationTokens.purpose, VERIFY_EMAIL_PURPOSE),
            isNull(emailVerificationTokens.usedAt),
          ),
        )
        .returning({ id: emailVerificationTokens.id });

      const [tokenRow] = await tx
        .insert(emailVerificationTokens)
        .values({
          userId: user.id,
          email: user.email,
          tokenHash,
          purpose: VERIFY_EMAIL_PURPOSE,
          expiresAt,
          requestedIp: context?.ipAddress ?? null,
          requestedUserAgent: context?.userAgent ?? null,
        })
        .returning({
          id: emailVerificationTokens.id,
        });

      if (!tokenRow) {
        throw new InternalServerErrorException("Unable to create verification token.");
      }

      return {
        invalidatedCount: invalidatedRows.length,
      };
    });

    await this.securityEventsService.recordEvent({
      actorUserId: user.id,
      actorRole: user.role,
      eventType: "EMAIL_VERIFICATION_REQUESTED",
      severity: "INFO",
      targetType: "USER",
      targetId: user.id,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      metadata: {
        email: user.email,
        purpose: VERIFY_EMAIL_PURPOSE,
        replacedPendingCount: result.invalidatedCount,
        expiresAt,
      },
    });

    try {
      const delivery = await this.mailService.sendEmailVerificationMail({
        toEmail: user.email,
        username: user.username,
        verificationToken: rawToken,
        verificationUrl: this.buildVerificationUrl(rawToken),
        expiresAt,
      });

      await this.securityEventsService.recordEvent({
        actorUserId: user.id,
        actorRole: user.role,
        eventType: "EMAIL_VERIFICATION_SENT",
        severity: "INFO",
        targetType: "USER",
        targetId: user.id,
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
        metadata: {
          email: user.email,
          purpose: VERIFY_EMAIL_PURPOSE,
          provider: delivery.provider,
          from: delivery.from,
          expiresAt,
        },
      });

      return {
        success: true,
        alreadyVerified: false,
        email: user.email,
        emailVerified: false,
        emailVerifiedAt: null,
        deliveryProvider: delivery.provider,
        expiresAt,
      };
    } catch (error) {
      await this.securityEventsService.recordEvent({
        actorUserId: user.id,
        actorRole: user.role,
        eventType: "EMAIL_VERIFICATION_FAILED",
        severity: "WARNING",
        targetType: "USER",
        targetId: user.id,
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
        metadata: {
          email: user.email,
          purpose: VERIFY_EMAIL_PURPOSE,
          reason: "MAIL_SEND_FAILED",
        },
      });

      throw new InternalServerErrorException(
        error instanceof Error ? error.message : "Unable to send verification email.",
      );
    }
  }

  async confirmVerification(
    token: string,
    context?: RequestSecurityContext,
  ): Promise<{
    success: true;
    alreadyVerified: boolean;
    email: string;
    emailVerified: true;
    emailVerifiedAt: Date;
  }> {
    const normalizedToken = token.trim();

    if (!normalizedToken) {
      throw new BadRequestException("Verification token is required.");
    }

    const tokenHash = this.hashToken(normalizedToken);
    const now = new Date();
    const [tokenRecord] = await this.db
      .select({
        id: emailVerificationTokens.id,
        userId: emailVerificationTokens.userId,
        email: emailVerificationTokens.email,
        purpose: emailVerificationTokens.purpose,
        expiresAt: emailVerificationTokens.expiresAt,
        usedAt: emailVerificationTokens.usedAt,
        createdAt: emailVerificationTokens.createdAt,
        role: users.role,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(emailVerificationTokens)
      .innerJoin(users, eq(emailVerificationTokens.userId, users.id))
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .limit(1);

    if (!tokenRecord) {
      await this.securityEventsService.recordEvent({
        eventType: "EMAIL_VERIFICATION_FAILED",
        severity: "WARNING",
        targetType: "EMAIL_VERIFICATION",
        targetId: null,
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
        metadata: {
          purpose: VERIFY_EMAIL_PURPOSE,
          reason: "TOKEN_NOT_FOUND",
        },
      });
      throw new BadRequestException("Invalid or expired verification token.");
    }

    if (tokenRecord.usedAt) {
      await this.securityEventsService.recordEvent({
        actorUserId: tokenRecord.userId,
        actorRole: tokenRecord.role,
        eventType: "EMAIL_VERIFICATION_TOKEN_REUSED",
        severity: "WARNING",
        targetType: "USER",
        targetId: tokenRecord.userId,
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
        metadata: {
          email: tokenRecord.email,
          purpose: tokenRecord.purpose,
          issuedAt: tokenRecord.createdAt,
          consumedAt: tokenRecord.usedAt,
        },
      });
      throw new BadRequestException("Invalid or expired verification token.");
    }

    if (tokenRecord.expiresAt.getTime() <= now.getTime()) {
      await this.securityEventsService.recordEvent({
        actorUserId: tokenRecord.userId,
        actorRole: tokenRecord.role,
        eventType: "EMAIL_VERIFICATION_TOKEN_EXPIRED",
        severity: "WARNING",
        targetType: "USER",
        targetId: tokenRecord.userId,
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
        metadata: {
          email: tokenRecord.email,
          purpose: tokenRecord.purpose,
          issuedAt: tokenRecord.createdAt,
          expiresAt: tokenRecord.expiresAt,
        },
      });
      throw new BadRequestException("Invalid or expired verification token.");
    }

    const transactionResult = await this.db.transaction(async (tx) => {
      const [currentUser] = await tx
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          nickname: users.nickname,
          role: users.role,
          status: users.status,
          isSystem: users.isSystem,
          emailVerifiedAt: users.emailVerifiedAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, tokenRecord.userId))
        .for("update")
        .limit(1);

      if (!currentUser || currentUser.isSystem) {
        throw new BadRequestException("Verification token is no longer valid.");
      }

      if (currentUser.email !== tokenRecord.email) {
        throw new BadRequestException("Verification token is no longer valid.");
      }

      const emailVerifiedAt = currentUser.emailVerifiedAt ?? now;

      const [updatedUser] = await tx
        .update(users)
        .set({
          emailVerifiedAt,
          updatedAt: now,
        })
        .where(eq(users.id, currentUser.id))
        .returning({
          id: users.id,
          email: users.email,
          username: users.username,
          nickname: users.nickname,
          role: users.role,
          status: users.status,
          isSystem: users.isSystem,
          emailVerifiedAt: users.emailVerifiedAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (!updatedUser) {
        throw new InternalServerErrorException("Unable to update verification status.");
      }

      await tx
        .update(emailVerificationTokens)
        .set({
          usedAt: now,
        })
        .where(
          and(
            eq(emailVerificationTokens.userId, currentUser.id),
            eq(emailVerificationTokens.purpose, VERIFY_EMAIL_PURPOSE),
            isNull(emailVerificationTokens.usedAt),
          ),
        );

      return {
        user: updatedUser,
        alreadyVerified: Boolean(currentUser.emailVerifiedAt),
        emailVerifiedAt,
      };
    });

    await this.securityEventsService.recordEvent({
      actorUserId: transactionResult.user.id,
      actorRole: transactionResult.user.role,
      eventType: "EMAIL_VERIFICATION_CONFIRMED",
      severity: "INFO",
      targetType: "USER",
      targetId: transactionResult.user.id,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      metadata: {
        email: transactionResult.user.email,
        purpose: VERIFY_EMAIL_PURPOSE,
        alreadyVerified: transactionResult.alreadyVerified,
        emailVerifiedAt: transactionResult.emailVerifiedAt,
      },
    });

    return {
      success: true,
      alreadyVerified: transactionResult.alreadyVerified,
      email: transactionResult.user.email,
      emailVerified: true,
      emailVerifiedAt: transactionResult.emailVerifiedAt,
    };
  }

  private buildVerificationUrl(token: string) {
    const baseUrl = this.getWebAppUrl();
    return `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  }

  private getWebAppUrl() {
    const explicitUrl = this.configService.get<string>("WEB_APP_URL")?.trim();
    if (explicitUrl) {
      return explicitUrl.replace(/\/+$/, "");
    }

    const corsOrigin = this.configService.get<string>("CORS_ORIGIN")?.split(",")[0]?.trim();
    if (corsOrigin) {
      return corsOrigin.replace(/\/+$/, "");
    }

    return "http://localhost:3000";
  }

  private getTokenTtlMinutes() {
    const configuredRaw = this.configService.get<string | number>(
      "EMAIL_VERIFICATION_TOKEN_TTL_MINUTES",
    );
    const configured = Number(configuredRaw ?? DEFAULT_TOKEN_TTL_MINUTES);

    return Number.isFinite(configured) && configured > 0
      ? Math.floor(configured)
      : DEFAULT_TOKEN_TTL_MINUTES;
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
