import { Configuration, Client } from 'typesense';

const host = process.env.TYPESENSE_HOST || 'localhost';
const port = parseInt(process.env.TYPESENSE_PORT || '8108', 10);
const protocol = process.env.TYPESENSE_PROTOCOL || 'http';
const apiKey = process.env.TYPESENSE_API_KEY || 'xyz';

const config = {
  nodes: [
    {
      host,
      port,
      protocol,
    },
  ],
  apiKey,
  connectionTimeoutSeconds: 2,
};

export const typesense = new Client(config);
