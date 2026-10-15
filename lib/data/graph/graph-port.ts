// Graph query port: the interface-level mock point for everything subgraph-sourced (§11.1).
// Every response carries its own `_meta { block { number } hasIndexingErrors }` — documents are
// composed by the repository with that fragment appended, so each round trip self-reports its
// index position for the silent-degrade comparison in graph-repository.ts.
export type GraphMeta = {
  block: { number: number; hasIndexingErrors: boolean };
};

export type GraphResponse<T> = {
  data: T;
  meta: GraphMeta;
};

export interface GraphPort {
  query<T>(
    endpoint: string,
    document: string,
    variables?: Record<string, unknown>,
  ): Promise<GraphResponse<T>>;
}

export function createHttpGraphPort(): GraphPort {
  return {
    async query<T>(endpoint: string, document: string, variables?: Record<string, unknown>) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: document, variables: variables ?? {} }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`graph endpoint HTTP ${res.status}`);
      const body = (await res.json()) as {
        data?: Record<string, unknown> & {
          _meta?: { block?: { number?: string }; hasIndexingErrors?: boolean };
        };
        errors?: Array<{ message: string }>;
      };
      if (body.errors?.length) {
        throw new Error(`graph query errors: ${body.errors.map((e) => e.message).join('; ')}`);
      }
      if (!body.data) throw new Error('graph response carried no data');
      const metaRaw = body.data._meta;
      const payload = { ...body.data };
      delete payload._meta;
      return {
        data: payload as T,
        meta: {
          block: {
            number: Number(metaRaw?.block?.number ?? 0),
            hasIndexingErrors: Boolean(metaRaw?.hasIndexingErrors),
          },
        },
      };
    },
  };
}
