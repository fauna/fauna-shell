import fetch from "node-fetch";

export type QueryResponse<T> = QuerySuccess<T> | QueryFailure;

export type QuerySuccess<T> = {
  status: 200;
  body: {
    data: T;
  };
};

export type QueryFailure = {
  status: number;
  body: {
    summary?: string;
    error: {
      code: string;
      message?: string;
    };
  };
};

export default class FaunaClient {
  endpoint: string;
  secret: string;
  timeout?: number;

  constructor(opts: { endpoint: string; secret: string; timeout?: number }) {
    this.endpoint = opts.endpoint;
    this.secret = opts.secret;
    this.timeout = opts.timeout;
  }

  async query<T>(
    query: string,
    opts?: {
      format?: string;
      typecheck?: boolean;
      secret?: string;
    }
  ): Promise<QueryResponse<T>> {
    const { format, typecheck, secret } = {
      format: opts?.format ?? "simple",
      typecheck: opts?.typecheck ?? undefined,
      secret: opts?.secret ?? this.secret,
    };
    const url = new URL(this.endpoint);
    url.pathname = "/query/1";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret ?? this.secret}`,
        "x-fauna-source": "Fauna Shell",
        ...(typecheck !== undefined && { "x-typecheck": typecheck.toString() }),
        ...(format !== undefined && { "x-format": format }),
      },
      body: JSON.stringify({ query }),
    });

    const json = await res.json();

    if (res.status === 200 || res.status === 201) {
      return {
        status: 200,
        body: {
          data: json.data as T,
        },
      };
    } else {
      return {
        status: res.status,
        body: {
          summary: json.summary,
          error: {
            code: json.error?.code,
            message: json.error?.message,
          },
        },
      };
    }
  }
}
