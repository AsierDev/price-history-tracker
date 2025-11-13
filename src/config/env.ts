/**
 * Build-time environment values injected via esbuild define
 * Keeps runtime free from process.env access inside the extension
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- injected at build time
declare const __NODE_ENV__: string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- injected at build time
declare const __AFFILIATE_AMAZON_TAG__: string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- injected at build time
declare const __AFFILIATE_EBAY_ID__: string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- injected at build time
declare const __AFFILIATE_ADMITAD_ID__: string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- injected at build time
declare const __FIREBASE_API_KEY__: string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- injected at build time
declare const __FIREBASE_AUTH_DOMAIN__: string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- injected at build time
declare const __FIREBASE_PROJECT_ID__: string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- injected at build time
declare const __FIREBASE_STORAGE_BUCKET__: string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- injected at build time
declare const __FIREBASE_MESSAGING_SENDER_ID__: string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- injected at build time
declare const __FIREBASE_APP_ID__: string;

type EnvShape = {
  NODE_ENV: string;
  AFFILIATE_AMAZON_TAG: string;
  AFFILIATE_EBAY_ID: string;
  AFFILIATE_ADMITAD_ID: string;
  FIREBASE: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
};

type RuntimeEnvOverrides = Partial<Omit<EnvShape, 'FIREBASE'>> & {
  FIREBASE?: Partial<EnvShape['FIREBASE']>;
};

type RuntimeEnvGlobal = typeof globalThis & {
  __PHT_RUNTIME_ENV__?: RuntimeEnvOverrides;
};

const RUNTIME_GLOBAL = globalThis as RuntimeEnvGlobal;

const definedValues: EnvShape = {
  NODE_ENV: typeof __NODE_ENV__ !== 'undefined' ? __NODE_ENV__ : 'development',
  AFFILIATE_AMAZON_TAG: typeof __AFFILIATE_AMAZON_TAG__ !== 'undefined' ? __AFFILIATE_AMAZON_TAG__ : '',
  AFFILIATE_EBAY_ID: typeof __AFFILIATE_EBAY_ID__ !== 'undefined' ? __AFFILIATE_EBAY_ID__ : '',
  AFFILIATE_ADMITAD_ID: typeof __AFFILIATE_ADMITAD_ID__ !== 'undefined' ? __AFFILIATE_ADMITAD_ID__ : '',
  FIREBASE: {
    apiKey: typeof __FIREBASE_API_KEY__ !== 'undefined' ? __FIREBASE_API_KEY__ : '',
    authDomain: typeof __FIREBASE_AUTH_DOMAIN__ !== 'undefined' ? __FIREBASE_AUTH_DOMAIN__ : '',
    projectId: typeof __FIREBASE_PROJECT_ID__ !== 'undefined' ? __FIREBASE_PROJECT_ID__ : '',
    storageBucket: typeof __FIREBASE_STORAGE_BUCKET__ !== 'undefined' ? __FIREBASE_STORAGE_BUCKET__ : '',
    messagingSenderId:
      typeof __FIREBASE_MESSAGING_SENDER_ID__ !== 'undefined' ? __FIREBASE_MESSAGING_SENDER_ID__ : '',
    appId: typeof __FIREBASE_APP_ID__ !== 'undefined' ? __FIREBASE_APP_ID__ : '',
  },
};

function getRuntimeOverrides(): RuntimeEnvOverrides {
  return RUNTIME_GLOBAL.__PHT_RUNTIME_ENV__ ?? {};
}

function resolveScalar<K extends keyof Omit<EnvShape, 'FIREBASE'>>(key: K): EnvShape[K] {
  const overrides = getRuntimeOverrides();
  const overrideValue = overrides[key];
  if (typeof overrideValue !== 'undefined') {
    return overrideValue as EnvShape[K];
  }
  return definedValues[key];
}

function resolveFirebaseValue<K extends keyof EnvShape['FIREBASE']>(key: K): string {
  const overrides = getRuntimeOverrides().FIREBASE;
  if (overrides && typeof overrides[key] !== 'undefined') {
    return overrides[key] as string;
  }
  return definedValues.FIREBASE[key];
}

export const ENV: EnvShape = {
  get NODE_ENV(): string {
    return resolveScalar('NODE_ENV');
  },
  get AFFILIATE_AMAZON_TAG(): string {
    return resolveScalar('AFFILIATE_AMAZON_TAG');
  },
  get AFFILIATE_EBAY_ID(): string {
    return resolveScalar('AFFILIATE_EBAY_ID');
  },
  get AFFILIATE_ADMITAD_ID(): string {
    return resolveScalar('AFFILIATE_ADMITAD_ID');
  },
  FIREBASE: {
    get apiKey(): string {
      return resolveFirebaseValue('apiKey');
    },
    get authDomain(): string {
      return resolveFirebaseValue('authDomain');
    },
    get projectId(): string {
      return resolveFirebaseValue('projectId');
    },
    get storageBucket(): string {
      return resolveFirebaseValue('storageBucket');
    },
    get messagingSenderId(): string {
      return resolveFirebaseValue('messagingSenderId');
    },
    get appId(): string {
      return resolveFirebaseValue('appId');
    },
  },
};

export const isProductionBuild = (): boolean => ENV.NODE_ENV === 'production';
