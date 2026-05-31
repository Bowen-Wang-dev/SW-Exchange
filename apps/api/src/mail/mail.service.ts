import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type VerificationMailInput = {
  toEmail: string;
  username: string;
  verificationToken: string;
  verificationUrl: string;
  expiresAt: Date;
};

export type VerificationMailDelivery = {
  provider: "console";
  from: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async sendEmailVerificationMail(
    input: VerificationMailInput,
  ): Promise<VerificationMailDelivery> {
    const provider = this.resolveProvider();
    const from = this.getFromAddress();

    this.logger.log(
      [
        `[DEV MAIL][EMAIL_VERIFICATION] provider=${provider}`,
        `from=${from}`,
        `to=${input.toEmail}`,
        `username=${input.username}`,
        `expiresAt=${input.expiresAt.toISOString()}`,
        `verificationUrl=${input.verificationUrl}`,
        `verificationToken=${input.verificationToken}`,
      ].join(" "),
    );

    return {
      provider,
      from,
    };
  }

  private resolveProvider(): "console" {
    const provider = this.configService.get<string>("EMAIL_PROVIDER")?.trim().toLowerCase();

    if (!provider || provider === "console") {
      return "console";
    }

    this.logger.warn(
      `EMAIL_PROVIDER=${provider} is not implemented in v1.0.2. Falling back to the console provider.`,
    );
    return "console";
  }

  private getFromAddress() {
    return this.configService.get<string>("EMAIL_FROM")?.trim() || "no-reply@swexchange.local";
  }
}
