// this file is used to export the schema for the database
// export * from './schema.sqlite'; // sqlite schema, used when DATABASE_PROVIDER=sqlite or DATABASE_PROVIDER=turso
// export * from './schema.mysql'; // mysql schema, used when DATABASE_PROVIDER=mysql
// The deploy platform provisions PostgreSQL and pushes
// `src/config/db/schema.postgres.ts`, so the runtime drizzle client (used by
// better-auth) must resolve the same column types.
export * from './schema.postgres'; // postgres schema, used when DATABASE_PROVIDER=postgresql
// export * from './schema.sqlite'; // sqlite schema, used when DATABASE_PROVIDER=sqlite or DATABASE_PROVIDER=turso
