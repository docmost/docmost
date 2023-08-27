export interface ILogin {
  email: string,
  password: string
}

export interface IRegister {
  email: string,
  password: string
}

export interface ITokens {
  accessToken: string,
  refreshToken: string
}

export interface ITokenResponse {
  tokens: ITokens
}
