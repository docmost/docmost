import {
  Controller,
  Get,
  Req,
  Res,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { FastifyRequest, FastifyReply } from 'fastify';

import {
  NTLMNegotiationMessage,
  NTLMChallengeMessage,
  NTLMAuthenticateMessage,
  MessageType,
} from 'ntlm-server';

import { EnvironmentService } from '../environment/environment.service';
import { NTLMService } from './ntlm.service';

@Controller()
export class NTLMController {
  constructor(
    private readonly ntlmService: NTLMService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @Post('auth/ntlm')
  async ntlmAuth(@Req() req, @Res() res: FastifyReply) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      // Step 1: Challenge the client for NTLM authentication
      return res.status(401).header('WWW-Authenticate', 'NTLM').send();
    }

    if (authHeader.startsWith('NTLM ')) {
      // Step 2: Handle NTLM negotiation message
      const clientNegotiation = new NTLMNegotiationMessage(authHeader);

      if (clientNegotiation.messageType === MessageType.NEGOTIATE) {
        // Step 3: Send NTLM challenge message
        const serverChallenge = new NTLMChallengeMessage(clientNegotiation);
        const base64Challenge = serverChallenge.toBuffer().toString('base64');

        return res
          .status(401)
          .header('WWW-Authenticate', `NTLM ${base64Challenge}`)
          .send();
      } else if (clientNegotiation.messageType === MessageType.AUTHENTICATE) {
        // Step 4: Handle NTLM Authenticate message
        const clientAuthentication = new NTLMAuthenticateMessage(authHeader);

        // Here you'd perform LDAP or Active Directory authentication

        const client = this.ntlmService.createClient(
          clientAuthentication.domainName,
        );

        // Asynchronous bind to AD
        await this.ntlmService.bindAsync(client);

        const results = await this.ntlmService.searchAsync(client, {
          scope: 'sub',
          filter: `(userPrincipalName=${clientAuthentication.userName}@${clientAuthentication.domainName}*)`,
        });

        if (results.length == 1) {
          const ntlmSignInResult = await this.ntlmService.login(
            results.at(0)[this.environmentService.getLdapNameAttribute()],
            results.at(0)[this.environmentService.getLdapMailAttribute()],
            req.raw.workspaceId,
          );
          return res.status(200).send(ntlmSignInResult);
        } else return res.status(403).send();
      } else {
        console.warn('Invalid NTLM Message received.');
        return res.status(400).send('Invalid NTLM Message');
      }
    }

    res.status(400).send('Bad NTLM request');
  }
}
