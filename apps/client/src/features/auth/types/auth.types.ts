export interface ILogin {
  email: string;
  password: string;
}

export interface IRegister {
  name?: string;
  email: string;
  password: string;
}

export interface ISetupWorkspace {
  workspaceName: string;
  name: string;
  email: string;
  password: string;
}

export interface ITokens {
  accessToken: string;
  refreshToken: string;
}

export interface ITokenResponse {
  tokens: ITokens;
}

export interface IChangePassword {
  oldPassword: string;
  newPassword: string;
}

export interface IForgotPassword {
  email: string;
}

export interface IPasswordReset {
  token?: string;
  newPassword: string;
}

export interface IVerifyUserToken {
  token: string;
  type: string;
}
