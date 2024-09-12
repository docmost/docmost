import { Inject, Injectable } from '@nestjs/common';
import { EnvironmentService } from '../environment/environment.service';
import * as ldap from 'ldapjs';

@Injectable()
export class NTLMService {
  constructor(private readonly environmentService: EnvironmentService) {}

  createClient = (domain: string) =>
    ldap.createClient({
      url: 'ldap://' + domain + this.environmentService.getLdapDomainSuffix(),
    });

  // Promisified version of ldap.Client.bind
  bindAsync = (client: ldap.Client): Promise<void> => {
    return new Promise((resolve, reject) => {
      client.bind(
        this.environmentService.getLdapUsername(),
        this.environmentService.getLdapPassword(),
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        },
      );
    });
  };

  // Promisified version of client.search
  searchAsync = (
    client: ldap.Client,
    options: ldap.SearchOptions,
  ): Promise<any[]> => {
    const baseDN: string = this.environmentService.getLdapBaseDn();
    return new Promise((resolve, reject) => {
      const entries: any[] = [];

      client.search(baseDN, options, (err, res) => {
        if (err) {
          reject(err);
        }

        res.on('searchEntry', (entry) => {
          const attributes = Object.fromEntries(
            entry.attributes.map(({ type, values }) => [
              type,
              values.length > 1 ? values : values[0],
            ]),
          );
          entries.push(attributes);
        });

        res.on('end', () => {
          resolve(entries);
        });

        res.on('error', (error) => {
          reject(error);
        });
      });
    });
  };
}
