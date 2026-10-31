import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class TwoFactorCodeDto {
  @IsString()
  @Matches(/^(?:\d{6}|[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{8}){3})$/)
  code!: string;
}
export class TwoFactorLoginDto extends TwoFactorCodeDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  challengeToken!: string;
}

export class TwoFactorReauthDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @Matches(/^2fa-(?:setup|enable|disable|recovery-regenerate)$/)
  purpose!: "2fa-setup" | "2fa-enable" | "2fa-disable" | "2fa-recovery-regenerate";
}

export class TwoFactorSetupDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  reauthToken!: string;
}

export class TwoFactorActionDto extends TwoFactorCodeDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  reauthToken!: string;
}
