import {
  Controller,
  Get,
  Req,
  Res,
  HttpException,
  HttpStatus,
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
  constructor(private readonly ntlmService: NTLMService) {}

  @Get('auth/ntlm')
  async ntlmAuth(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      // Step 1: Challenge the client for NTLM authentication
      res.status(401).header('WWW-Authenticate', 'NTLM').send();
      return;
    }

    if (authHeader.startsWith('NTLM ')) {
      // Step 2: Handle NTLM negotiation message
      const clientNegotiation = new NTLMNegotiationMessage(authHeader);

      if (clientNegotiation.messageType === MessageType.NEGOTIATE) {
        // Step 3: Send NTLM challenge message
        const serverChallenge = new NTLMChallengeMessage(clientNegotiation);
        const base64Challenge = serverChallenge.toBuffer().toString('base64');

        res
          .status(401)
          .header('WWW-Authenticate', `NTLM ${base64Challenge}`)
          .send();
        return;
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

        // Assuming authentication is successful
        res.status(200).send(results);
        return;
      } else {
        console.warn('Invalid NTLM Message received.');
        res.status(400).send('Invalid NTLM Message');
        return;
      }
    }

    res.status(400).send('Bad NTLM request');
  }
}
