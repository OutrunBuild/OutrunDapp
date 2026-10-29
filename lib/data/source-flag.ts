// Single definition point of the data-source build judgment (onchain is the default; fixture
// builds opt out explicitly). NEXT_PUBLIC_ mirror is the client-inlinable projection; the server
// var covers SSR.
export const ONCHAIN_BUILD =
  process.env.NEXT_PUBLIC_OUTRUN_DATA_SOURCE !== 'fixture' &&
  process.env.OUTRUN_DATA_SOURCE !== 'fixture';
