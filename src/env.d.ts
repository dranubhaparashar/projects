/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
	readonly PUBLIC_GOATCOUNTER_CODE?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
